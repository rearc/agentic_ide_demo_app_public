"""Move card layouts into profiles

A profile is a named board. Every card's stored layout moves into a profile
named "Default" (an inactive card as a hidden entry), and `cards` loses its
`layout` and `is_active` columns.

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-10-18 12:00:00.000000

"""
from datetime import UTC, datetime

from alembic import op
import sqlalchemy as sa


revision = 'd8e9f0a1b2c3'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None

DEFAULT_PROFILE_NAME = 'Default'
# Where a card without a usable layout lands: this size, at the bottom.
FALLBACK_SIZE = {'w': 4, 'h': 4}
PLACE_MINIMUMS = {'x': 0, 'y': 0, 'w': 1, 'h': 1}

# The columns this migration reads and writes, as they stand when it runs.
cards = sa.table(
    'cards',
    sa.column('id', sa.Integer),
    sa.column('layout', sa.JSON),
    sa.column('is_active', sa.Boolean),
)
profiles = sa.table(
    'profiles',
    sa.column('id', sa.Integer),
    sa.column('name', sa.String),
    sa.column('created_at', sa.DateTime),
)
profile_cards = sa.table(
    'profile_cards',
    sa.column('profile_id', sa.Integer),
    sa.column('card_id', sa.Integer),
    sa.column('x', sa.Integer),
    sa.column('y', sa.Integer),
    sa.column('w', sa.Integer),
    sa.column('h', sa.Integer),
    sa.column('hidden', sa.Boolean),
)


def _is_place(layout):
    """True for a layout the board can hold: exactly integer x, y, w and h
    within their bounds. The old card route accepted any integers."""
    return (
        isinstance(layout, dict)
        and set(layout) == set(PLACE_MINIMUMS)
        and all(
            isinstance(layout[k], int)
            and not isinstance(layout[k], bool)
            and layout[k] >= minimum
            for k, minimum in PLACE_MINIMUMS.items()
        )
    )


def _board_rows(card_rows, profile_id):
    """A board entry per card: its own layout where usable, otherwise 4 by 4
    stacked below the lowest visible card."""
    placed = [row for row in card_rows if _is_place(row.layout)]
    bottom = max(
        (row.layout['y'] + row.layout['h'] for row in placed if row.is_active),
        default=0,
    )
    entries = []
    for row in card_rows:
        if _is_place(row.layout):
            place = dict(row.layout)
        else:
            place = {'x': 0, 'y': bottom, **FALLBACK_SIZE}
            bottom += FALLBACK_SIZE['h']
        entries.append(
            {
                'profile_id': profile_id,
                'card_id': row.id,
                'hidden': not row.is_active,
                **place,
            }
        )
    return entries


def upgrade():
    op.create_table(
        'profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.create_table(
        'profile_cards',
        sa.Column('profile_id', sa.Integer(), nullable=False),
        sa.Column('card_id', sa.Integer(), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('w', sa.Integer(), nullable=False),
        sa.Column('h', sa.Integer(), nullable=False),
        sa.Column('hidden', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.ForeignKeyConstraint(['card_id'], ['cards.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['profile_id'], ['profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('profile_id', 'card_id'),
    )
    op.create_index(
        op.f('ix_profile_cards_card_id'), 'profile_cards', ['card_id'], unique=False
    )

    connection = op.get_bind()
    connection.execute(
        profiles.insert().values(name=DEFAULT_PROFILE_NAME, created_at=datetime.now(UTC))
    )
    profile_id = connection.execute(
        sa.select(profiles.c.id).where(profiles.c.name == DEFAULT_PROFILE_NAME)
    ).scalar_one()
    card_rows = connection.execute(
        sa.select(cards.c.id, cards.c.layout, cards.c.is_active).order_by(cards.c.id)
    ).all()
    entries = _board_rows(card_rows, profile_id)
    if entries:
        op.bulk_insert(profile_cards, entries)

    # Rebuilds `cards` on SQLite; env.py turns foreign keys off, or dropping the
    # old table would cascade-delete the board just written.
    with op.batch_alter_table('cards', schema=None) as batch_op:
        batch_op.drop_column('is_active')
        batch_op.drop_column('layout')


def downgrade():
    with op.batch_alter_table('cards', schema=None) as batch_op:
        batch_op.add_column(sa.Column('layout', sa.JSON(), nullable=True))
        batch_op.add_column(
            sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False)
        )

    # The cards go back to the first profile's board; a card absent from it
    # was on no board, so it comes back inactive.
    connection = op.get_bind()
    first_profile_id = connection.execute(sa.select(sa.func.min(profiles.c.id))).scalar()
    entries = connection.execute(
        sa.select(profile_cards).where(profile_cards.c.profile_id == first_profile_id)
    ).all()
    connection.execute(cards.update().values(is_active=False))
    for entry in entries:
        connection.execute(
            cards.update()
            .where(cards.c.id == entry.card_id)
            .values(
                layout={'x': entry.x, 'y': entry.y, 'w': entry.w, 'h': entry.h},
                is_active=not entry.hidden,
            )
        )

    op.drop_index(op.f('ix_profile_cards_card_id'), table_name='profile_cards')
    op.drop_table('profile_cards')
    op.drop_table('profiles')
