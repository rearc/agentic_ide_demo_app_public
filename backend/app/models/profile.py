from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, isoformat_utc
from app.models.profile_card import ProfileCard


class Profile(Base):
    """A named board: which cards it shows and where."""

    __tablename__ = 'profiles'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(UTC), nullable=False
    )
    # delete-orphan lets a route replace the whole board by assigning a new list.
    # passive_deletes leaves deleting a profile's rows to the database's cascade
    # (DB-12) rather than loading them first.
    board_entries: Mapped[list[ProfileCard]] = relationship(
        cascade='all, delete-orphan',
        passive_deletes=True,
        order_by=ProfileCard.card_id,
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            # Keyed by card id as a string, which is what a JSON object key is.
            'board': {str(entry.card_id): entry.to_dict() for entry in self.board_entries},
            'created_at': isoformat_utc(self.created_at),
        }
