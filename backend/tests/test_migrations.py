"""Tests that the Alembic chain runs forwards and backwards.

`DB-5` in docs/coding_standards.md requires every migration to have a working
`downgrade()`. That is only credible if something exercises it, so these tests
run the whole chain up and back down against a throwaway file database.

A file database rather than `:memory:` because Alembic opens its own connection,
and each connection to an in-memory SQLite URI gets a database of its own.
"""

import os
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config as AlembicConfig
from alembic.script import ScriptDirectory

from app import create_app, db
from app.models.card import Card
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

    app = create_app(TmpMigrationConfig)
    with app.app_context():
        yield config, sa.create_engine(url)


def table_names(engine):
    return set(sa.inspect(engine).get_table_names())


def test_upgrade_creates_the_application_tables(migration_db):
    config, engine = migration_db

    command.upgrade(config, 'head')

    assert {'cards', 'todos'} <= table_names(engine)


def test_upgrade_then_downgrade_leaves_no_application_tables(migration_db):
    """Every downgrade() in the chain must actually reverse its upgrade."""
    config, engine = migration_db

    command.upgrade(config, 'head')
    command.downgrade(config, 'base')

    remaining = table_names(engine)
    assert 'cards' not in remaining
    assert 'todos' not in remaining


def test_chain_can_be_replayed(migration_db):
    """Up, down, and up again - catches a downgrade that leaves debris behind."""
    config, engine = migration_db

    command.upgrade(config, 'head')
    command.downgrade(config, 'base')
    command.upgrade(config, 'head')

    assert {'cards', 'todos'} <= table_names(engine)


def add_card_with_a_todo():
    card = Card(slug='weather', title='Weather', source='weather')
    db.session.add(card)
    db.session.commit()
    db.session.add(Todo(card_id=card.id, text='A task'))
    db.session.commit()


def test_chain_replays_over_a_database_holding_data(migration_db):
    """The tests above run on empty tables; a downgrade or upgrade can also
    trip over rows that reference each other."""
    config, engine = migration_db
    command.upgrade(config, 'head')
    add_card_with_a_todo()

    command.downgrade(config, 'base')
    command.upgrade(config, 'head')

    assert {'cards', 'todos'} <= table_names(engine)


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
    env.py turns them off for migrations. No migration in the chain rebuilds
    `cards` while `todos` exists, so this test appends one."""
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


@pytest.mark.parametrize('model', [Card, Todo], ids=lambda m: m.__tablename__)
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


@pytest.mark.parametrize('model', [Card, Todo], ids=lambda m: m.__tablename__)
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
