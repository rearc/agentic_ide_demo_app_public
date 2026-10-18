"""Request checks shared by every route module.

Each helper answers a bad request by calling `abort`, which the app factory's
error handlers turn into `{"error": message}` with the same status (API-4).
"""

from flask import abort, request

from app import db

# SQLite stores integers in 64 bits; binding a larger Python int raises OverflowError.
SQLITE_INT_MIN = -(2**63)
SQLITE_INT_MAX = 2**63 - 1


def is_sqlite_integer(value):
    """True if `value` is an integer SQLite can store.

    `bool` is excluded explicitly: it is a subclass of `int` in Python, so
    `card_id: true` would otherwise resolve to card 1.
    """
    return (
        isinstance(value, int)
        and not isinstance(value, bool)
        and SQLITE_INT_MIN <= value <= SQLITE_INT_MAX
    )


def json_object_body():
    """The request's JSON body, which must be an object; answers 400 otherwise.

    `silent=True` so a request with no JSON content type reaches our 400 with a
    JSON error body, rather than werkzeug's 415 with an HTML one. An empty
    object is returned as is: the route's own validation decides what it lacks.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        abort(400, 'Request body must be a JSON object')
    return data


def get_or_404(model, record_id, description):
    """The `model` row with `record_id`; answers 404 with `description` if none.

    An id outside SQLite's range cannot exist, so it is not found rather than an
    overflow error.
    """
    if not is_sqlite_integer(record_id):
        abort(404, description)
    return db.get_or_404(model, record_id, description=description)
