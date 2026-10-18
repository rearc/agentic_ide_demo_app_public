"""Tests that the Alembic chain runs forwards and backwards.

`DB-5` in docs/coding_standards.md requires every migration to have a working
`downgrade()`. That is only credible if something exercises it, so these tests
run the whole chain up and back down against a throwaway file database.

A file database rather than `:memory:` because Alembic opens its own connection,
and each connection to an in-memory SQLite URI gets a database of its own.
"""

import os
from datetime import datetime
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory

from app import create_app, db
from app.models.card import Card
from app.models.profile import Profile
from app.models.profile_card import ProfileCard
from app.models.todo import Todo

# Absolute, so the suite does not depend on the process working directory.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = str(BACKEND_ROOT / 'migrations')
VERSIONS_DIR = str(BACKEND_ROOT / 'migrations' / 'versions')


@pytest.fixture
def migration_db(tmp_path):
    """An empty on-disk database plus an Alembic config pointed at it.

    Built through the real `create_app`, because Flask-Migrate's env.py reads
    the engine off `current_app.extensions['migrate']`. Passing a config class
    rather than a dotted string exercises the other half of the factory seam.
    Both engines are disposed afterwards, so no connection is left open.
    """
    db_path = tmp_path / 'migration_test.db'
    url = f'sqlite:///{db_path}'

    class TmpMigrationConfig:
        SQLALCHEMY_DATABASE_URI = url
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        TESTING = True

    config = AlembicConfig(str(Path(MIGRATIONS_DIR) / 'alembic.ini'))
    config.set_main_option('script_location', MIGRATIONS_DIR)
    config.set_main_option('sqlalchemy.url', url)

    engine = sa.create_engine(url)
    app = create_app(TmpMigrationConfig)
    with app.app_context():
        yield config, engine
        db.session.remove()
        db.engine.dispose()
    engine.dispose()


def table_names(engine):
    return set(sa.inspect(engine).get_table_names())


def test_upgrade_then_downgrade_leaves_no_application_tables(migration_db):
    """Every downgrade() in the chain must actually reverse its upgrade."""
    config, engine = migration_db

    command.upgrade(config, 'head')
    command.downgrade(config, 'base')

    assert not {'cards', 'todos', 'profiles', 'profile_cards'} & table_names(engine)


def add_card_with_a_todo():
    card = Card(slug='weather', title='Weather', source='weather')
    db.session.add(card)
    db.session.commit()
    db.session.add(Todo(card_id=card.id, text='A task'))
    db.session.commit()


def test_chain_replays_over_a_database_holding_data(migration_db):
    """Up, down, and up again, with rows that reference each other in place:
    catches a downgrade that leaves debris behind, and a step that trips over
    existing data."""
    config, engine = migration_db
    command.upgrade(config, 'head')
    add_card_with_a_todo()

    command.downgrade(config, 'base')
    command.upgrade(config, 'head')

    assert {'cards', 'todos'} <= table_names(engine)


# The revision before profiles: cards still carry `layout` and `is_active`.
BEFORE_PROFILES = 'c7d8e9f0a1b2'

# `cards` as it stands at BEFORE_PROFILES, for writing and reading rows the
# current model cannot describe.
OLD_CARDS = sa.table(
    'cards',
    sa.column('id', sa.Integer),
    sa.column('slug', sa.String),
    sa.column('title', sa.String),
    sa.column('description', sa.String),
    sa.column('icon', sa.String),
    sa.column('source', sa.String),
    sa.column('position', sa.Integer),
    sa.column('created_at', sa.DateTime),
    sa.column('layout', sa.JSON),
    sa.column('is_active', sa.Boolean),
)


def insert_old_card(connection, card_id, layout, is_active=True):
    connection.execute(
        OLD_CARDS.insert().values(
            id=card_id,
            slug=f'card-{card_id}',
            title='A card',
            description='',
            icon='',
            source='weather',
            position=card_id,
            created_at=datetime(2026, 1, 1),
            layout=layout,
            is_active=is_active,
        )
    )


def test_upgrade_moves_card_layouts_onto_a_default_profile(migration_db):
    """An inactive card becomes a hidden entry; a card whose layout the board
    cannot hold (the old default `{}`, or a value out of bounds) gets 4 by 4,
    stacked below the lowest visible card."""
    config, engine = migration_db
    command.upgrade(config, BEFORE_PROFILES)
    with engine.begin() as connection:
        insert_old_card(connection, 1, {'x': 0, 'y': 0, 'w': 4, 'h': 4})
        insert_old_card(connection, 2, {'x': 4, 'y': 0, 'w': 4, 'h': 9}, is_active=False)
        insert_old_card(connection, 3, {})
        insert_old_card(connection, 4, {'x': -1, 'y': 0, 'w': 4, 'h': 4})

    command.upgrade(config, 'head')

    profile = db.session.scalars(db.select(Profile)).one()
    assert profile.name == 'Default'
    assert profile.to_dict()['board'] == {
        '1': {'x': 0, 'y': 0, 'w': 4, 'h': 4, 'hidden': False},
        '2': {'x': 4, 'y': 0, 'w': 4, 'h': 9, 'hidden': True},
        '3': {'x': 0, 'y': 4, 'w': 4, 'h': 4, 'hidden': False},
        '4': {'x': 0, 'y': 8, 'w': 4, 'h': 4, 'hidden': False},
    }


def test_downgrade_restores_card_layouts_from_the_first_profile(migration_db):
    """A hidden entry comes back inactive, and a card absent from the first
    profile comes back inactive with no layout, whatever later profiles hold."""
    config, engine = migration_db
    command.upgrade(config, 'head')
    shown, hidden, elsewhere = (
        Card(slug=slug, title='A card', source='weather')
        for slug in ('shown', 'hidden', 'elsewhere')
    )
    db.session.add_all([shown, hidden, elsewhere])
    db.session.flush()
    # The upgrade created "Default", so it is the first profile.
    db.session.scalars(db.select(Profile)).one().board_entries = [
        ProfileCard(card_id=shown.id, x=0, y=0, w=4, h=4),
        ProfileCard(card_id=hidden.id, x=4, y=0, w=6, h=7, hidden=True),
    ]
    db.session.add(Profile(name='Second', board_entries=[
        ProfileCard(card_id=elsewhere.id, x=0, y=0, w=4, h=4),
    ]))
    db.session.commit()

    command.downgrade(config, BEFORE_PROFILES)

    with engine.connect() as connection:
        rows = connection.execute(
            sa.select(OLD_CARDS.c.slug, OLD_CARDS.c.layout, OLD_CARDS.c.is_active)
        ).all()
    assert {row.slug: (row.layout, row.is_active) for row in rows} == {
        'shown': ({'x': 0, 'y': 0, 'w': 4, 'h': 4}, True),
        'hidden': ({'x': 4, 'y': 0, 'w': 6, 'h': 7}, False),
        'elsewhere': (None, False),
    }


REBUILD_CARDS_MIGRATION = """
from alembic import op

revision = 'rebuild_cards'
down_revision = '{down_revision}'


def upgrade():
    with op.batch_alter_table('cards', recreate='always'):
        pass


def downgrade():
    pass
"""


def add_rebuild_cards_migration(config, directory):
    """Append to the chain a migration that rebuilds `cards` in batch mode."""
    head = ScriptDirectory.from_config(config).get_current_head()
    directory.mkdir()
    (directory / 'rebuild_cards.py').write_text(
        REBUILD_CARDS_MIGRATION.format(down_revision=head)
    )
    config.set_main_option('path_separator', 'os')
    config.set_main_option(
        'version_locations', os.pathsep.join([VERSIONS_DIR, str(directory)])
    )


def test_a_migration_that_rebuilds_cards_keeps_their_todos(migration_db, tmp_path):
    """Batch mode on SQLite rebuilds a table: copy, drop, rename. Dropping
    `cards` with foreign keys on would cascade-delete every todo, which is why
    env.py turns them off for migrations. The profiles migration rebuilds
    `cards` too, but at that revision the models no longer match the table, so
    this test appends a rebuild at head, where the ORM can write the rows."""
    config, _engine = migration_db
    command.upgrade(config, 'head')
    add_card_with_a_todo()
    add_rebuild_cards_migration(config, tmp_path / 'extra_versions')

    command.upgrade(config, 'head')

    assert db.session.scalars(db.select(Todo.text)).all() == ['A task']


def test_app_still_enforces_foreign_keys_after_migrating(migration_db):
    """env.py turns foreign keys off for the migration connection; the pool
    then hands that same connection to the app, so it must turn them back on."""
    config, _engine = migration_db
    command.upgrade(config, 'head')
    add_card_with_a_todo()

    db.session.execute(db.delete(Card))
    db.session.commit()

    assert db.session.scalars(db.select(Todo)).all() == []


@pytest.mark.parametrize(
    'model', [Card, Todo, Profile, ProfileCard], ids=lambda m: m.__tablename__
)
def test_migrated_schema_matches_the_model_exactly(migration_db, model):
    """The drift check this file exists for.

    Derived from the model's own metadata rather than a list typed out here, so
    adding a column without a migration fails. Equality, not subset: drift is a
    defect in either direction. Note the rest of the suite builds its schema
    with `create_all()`, which cannot catch this - production runs `db upgrade`.
    """
    config, engine = migration_db

    command.upgrade(config, 'head')

    migrated = {c['name'] for c in sa.inspect(engine).get_columns(model.__tablename__)}
    declared = {c.name for c in model.__table__.columns}
    assert migrated == declared, (
        f'{model.__tablename__} drift - '
        f'only in migration: {sorted(migrated - declared)}, '
        f'only in model: {sorted(declared - migrated)}'
    )


@pytest.mark.parametrize(
    'model', [Card, Todo, Profile, ProfileCard], ids=lambda m: m.__tablename__
)
def test_migrated_not_null_constraints_match_the_model(migration_db, model):
    """A column present but nullable in one and not the other still breaks
    writes that the create_all()-backed tests accept."""
    config, engine = migration_db

    command.upgrade(config, 'head')

    migrated = {
        c['name']: c['nullable']
        for c in sa.inspect(engine).get_columns(model.__tablename__)
    }
    for column in model.__table__.columns:
        if column.primary_key:
            continue
        assert migrated[column.name] == column.nullable, (
            f'{model.__tablename__}.{column.name} nullable mismatch: '
            f'migration={migrated[column.name]} model={column.nullable}'
        )
