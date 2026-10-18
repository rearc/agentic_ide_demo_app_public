from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, false
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ProfileCard(Base):
    """One card's place on one profile's board.

    A hidden entry keeps its place and size, so the card comes back as it was.
    """

    __tablename__ = 'profile_cards'

    profile_id: Mapped[int] = mapped_column(
        ForeignKey('profiles.id', ondelete='CASCADE'), primary_key=True
    )
    card_id: Mapped[int] = mapped_column(
        ForeignKey('cards.id', ondelete='CASCADE'), primary_key=True, index=True
    )
    x: Mapped[int] = mapped_column(Integer, nullable=False)
    y: Mapped[int] = mapped_column(Integer, nullable=False)
    w: Mapped[int] = mapped_column(Integer, nullable=False)
    h: Mapped[int] = mapped_column(Integer, nullable=False)
    hidden: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default=false(), nullable=False
    )

    def to_dict(self) -> dict:
        return {'x': self.x, 'y': self.y, 'w': self.w, 'h': self.h, 'hidden': self.hidden}
