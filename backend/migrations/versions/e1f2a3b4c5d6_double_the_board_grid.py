"""Double the board grid

The board's grid goes from 12 columns to 24, and its rows from 46 px to 19 px
(with the same 8 px gap), so cards can be placed and sized in half steps.
Every saved place doubles, which leaves every card exactly where and as big as
it was.

Revision ID: e1f2a3b4c5d6
Revises: d8e9f0a1b2c3
Create Date: 2026-10-18 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e1f2a3b4c5d6'
down_revision = 'd8e9f0a1b2c3'
branch_labels = None
depends_on = None

profile_cards = sa.table(
    'profile_cards',
    sa.column('x', sa.Integer),
    sa.column('y', sa.Integer),
    sa.column('w', sa.Integer),
    sa.column('h', sa.Integer),
)


def upgrade():
    op.execute(
        profile_cards.update().values(
            x=profile_cards.c.x * 2,
            y=profile_cards.c.y * 2,
            w=profile_cards.c.w * 2,
            h=profile_cards.c.h * 2,
        )
    )


def downgrade():
    # Halved, rounding down; a size never drops below one cell. A place set
    # in a half step since the upgrade moves to the step before it.
    op.execute(
        profile_cards.update().values(
            x=profile_cards.c.x / 2,
            y=profile_cards.c.y / 2,
            w=sa.func.max(profile_cards.c.w / 2, 1),
            h=sa.func.max(profile_cards.c.h / 2, 1),
        )
    )
