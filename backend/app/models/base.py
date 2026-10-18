"""The declarative base every model subclasses, and the helpers the models share.

Models subclass `Base` rather than Flask-SQLAlchemy's `db.Model`. `db.Model` is
built at runtime, so a type checker cannot see the keyword arguments SQLAlchemy
gives each model's constructor; `Base` is an ordinary class it can follow. The
app factory hands `Base` to Flask-SQLAlchemy (`SQLAlchemy(model_class=Base)`),
so `db.metadata` - what `db.create_all()` and Alembic read - is `Base.metadata`.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


def isoformat_utc(value: datetime | None) -> str | None:
    """`value` as ISO-8601 text with its UTC offset, or None when unset.

    The app writes every timestamp in UTC, but SQLite stores datetimes without a
    timezone, so a value read back is naive. Without the offset a client would
    read it as local time.
    """
    if value is None:
        return None
    return value.replace(tzinfo=UTC).isoformat()
