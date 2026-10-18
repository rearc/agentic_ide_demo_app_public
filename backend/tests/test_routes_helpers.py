"""Tests for the request checks every route shares (app/routes/helpers.py).

Each check is run against every route that uses it: a route that reads
`request.get_json()` or calls `db.get_or_404` itself skips the check, and only
that route's case here fails.
"""

import pytest

from app.routes.helpers import SQLITE_INT_MAX

BODY_ERROR = {'error': 'Request body must be a JSON object'}

# Every route that takes a JSON body. The ids are filled in from the `todo`
# fixture, whose card is the one the card routes act on.
WRITE_ROUTES = [
    ('POST', '/api/cards'),
    ('PUT', '/api/cards/{card_id}'),
    ('POST', '/api/todos'),
    ('PATCH', '/api/todos/{todo_id}'),
]

# Every route that looks a row up by id, with the message it answers when none.
ID_ROUTES = [
    ('GET', '/api/cards/{id}', 'Card not found'),
    ('PUT', '/api/cards/{id}', 'Card not found'),
    ('DELETE', '/api/cards/{id}', 'Card not found'),
    ('PATCH', '/api/todos/{id}', 'Todo not found'),
    ('DELETE', '/api/todos/{id}', 'Todo not found'),
]


@pytest.fixture
def todo(todo_card, make_todo):
    return make_todo(todo_card.id)


@pytest.mark.parametrize(('method', 'path'), WRITE_ROUTES)
def test_every_write_route_rejects_a_body_that_is_not_an_object(client, todo, method, path):
    url = path.format(card_id=todo.card_id, todo_id=todo.id)

    response = client.open(url, method=method, json=[1])

    assert response.status_code == 400
    assert response.get_json() == BODY_ERROR


@pytest.mark.parametrize(
    ('data', 'content_type'),
    [
        pytest.param('slug=stocks', 'application/x-www-form-urlencoded', id='form-data'),
        pytest.param('{not valid json', 'application/json', id='malformed-json'),
    ],
)
def test_a_body_that_is_not_json_gets_the_same_json_400(client, data, content_type):
    """Without our check, Werkzeug answers form data with a 415 and malformed
    JSON with its own 400, each with a different message."""
    response = client.post('/api/cards', data=data, content_type=content_type)

    assert response.status_code == 400
    assert response.get_json() == BODY_ERROR


def test_an_empty_object_reaches_the_routes_own_validation(client):
    """`{}` is falsy but is an object: the route, not the body check, says what
    it lacks."""
    response = client.post('/api/cards', json={})

    assert response.status_code == 400
    assert response.get_json()['error'].startswith('Missing required fields')


@pytest.mark.parametrize(
    'record_id',
    [
        pytest.param(999, id='no-such-row'),
        pytest.param(SQLITE_INT_MAX + 1, id='beyond-sqlite-range'),
    ],
)
@pytest.mark.parametrize(('method', 'path', 'message'), ID_ROUTES)
def test_an_id_that_names_no_row_answers_404(client, method, path, message, record_id):
    """An id beyond SQLite's 64-bit range would otherwise overflow into a 500."""
    response = client.open(path.format(id=record_id), method=method, json={})

    assert response.status_code == 404
    assert response.get_json() == {'error': message}
