"""Tests for /api/todos - the stateful card's CRUD surface.

The todo feature is the reference implementation for a card that owns a model and
table, so this file is the pattern to copy for the next stateful card. The body
and not-found checks every route shares are in test_routes_helpers.py.
"""

import pytest

from app.routes.helpers import SQLITE_INT_MAX


def list_todos(client, card_id):
    """The todos the API lists for `card_id`."""
    return client.get(f'/api/todos?card_id={card_id}').get_json()


class TestListTodos:
    def test_orders_todos_by_creation_time(self, client, todo_card, make_todo):
        make_todo(todo_card.id, text='First')
        make_todo(todo_card.id, text='Second')
        make_todo(todo_card.id, text='Third')

        texts = [t['text'] for t in list_todos(client, todo_card.id)]

        assert texts == ['First', 'Second', 'Third']

    def test_scopes_todos_to_the_requested_card(self, client, make_card, make_todo):
        card_a = make_card(slug='todo-a', source='todo')
        card_b = make_card(slug='todo-b', source='todo')
        make_todo(card_a.id, text='Belongs to A')
        make_todo(card_b.id, text='Belongs to B')

        texts = [t['text'] for t in list_todos(client, card_a.id)]

        assert texts == ['Belongs to A']

    def test_serializes_the_full_todo_shape(self, client, todo_card, make_todo):
        make_todo(todo_card.id)

        payload = list_todos(client, todo_card.id)[0]

        assert set(payload) == {'id', 'card_id', 'text', 'done', 'created_at', 'updated_at'}

    def test_missing_card_id_returns_400(self, client):
        response = client.get('/api/todos')

        assert response.status_code == 400
        assert response.get_json()['error'] == 'Query parameter card_id is required'

    @pytest.mark.parametrize(
        'card_id',
        [
            pytest.param('abc', id='not-a-number'),
            pytest.param(SQLITE_INT_MAX + 1, id='beyond-sqlite-range'),
        ],
    )
    def test_invalid_card_id_is_reported_as_invalid_not_missing(self, client, card_id):
        """Reporting a supplied parameter as absent sends the caller looking in
        the wrong place."""
        response = client.get(f'/api/todos?card_id={card_id}')

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'

    def test_unknown_card_returns_404(self, client):
        response = client.get('/api/todos?card_id=999')

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    def test_a_card_that_is_not_a_todo_card_returns_404(self, client, card):
        response = client.get(f'/api/todos?card_id={card.id}')

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'


class TestCreateTodo:
    def test_creates_and_returns_201(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'Write tests'})

        assert response.status_code == 201
        body = response.get_json()
        assert body['card_id'] == todo_card.id
        assert body['text'] == 'Write tests'
        assert body['done'] is False

    def test_new_todo_is_listed(self, client, todo_card):
        client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'Write tests'})

        assert len(list_todos(client, todo_card.id)) == 1

    def test_trims_surrounding_whitespace(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': '  padded  '})

        assert response.get_json()['text'] == 'padded'

    def test_missing_card_id_returns_400(self, client):
        response = client.post('/api/todos', json={'text': 'Orphan'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id is required'

    def test_boolean_card_id_is_rejected(self, client, todo_card):
        """`bool` is a subclass of `int` in Python, so an unguarded `card_id: true`
        resolves to card 1 and attaches the todo to the wrong card."""
        response = client.post('/api/todos', json={'card_id': True, 'text': 'A task'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'

    def test_a_card_that_is_not_a_todo_card_returns_404(self, client, card):
        response = client.post('/api/todos', json={'card_id': card.id, 'text': 'Misplaced'})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    @pytest.mark.parametrize(
        'text_field',
        [
            pytest.param({}, id='missing'),
            pytest.param({'text': '   '}, id='whitespace-only'),
            pytest.param({'text': 42}, id='not-a-string'),
        ],
    )
    def test_text_must_be_a_non_empty_string(self, client, todo_card, text_field):
        response = client.post('/api/todos', json={'card_id': todo_card.id, **text_field})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'text is required and must be non-empty'

    def test_text_at_the_length_limit_is_accepted(self, client, todo_card):
        """The frontend's maxLength is a convenience, not a boundary: the
        server enforces the limit too."""
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 500})

        assert response.status_code == 201

    def test_text_over_the_length_limit_is_rejected(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 501})

        assert response.status_code == 400
        assert '500 characters' in response.get_json()['error']

    def test_a_rejected_todo_is_not_persisted(self, client, todo_card):
        client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 501})

        assert list_todos(client, todo_card.id) == []


class TestUpdateTodo:
    @pytest.mark.parametrize(
        'changes',
        [{'done': True}, {'text': 'Rewritten'}, {'text': 'Rewritten', 'done': True}],
        ids=['done', 'text', 'both'],
    )
    def test_applies_the_fields_it_is_sent(self, client, todo_card, make_todo, changes):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json=changes)

        assert response.status_code == 200
        body = response.get_json()
        assert {field: body[field] for field in changes} == changes

    def test_trims_edited_text(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'text': '  padded  '})

        assert response.get_json()['text'] == 'padded'

    def test_change_is_persisted(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        client.patch(f'/api/todos/{todo.id}', json={'done': True})

        assert list_todos(client, todo_card.id)[0]['done'] is True

    def test_non_boolean_done_returns_400(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'done': 'yes'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'done must be a boolean'

    def test_whitespace_only_text_returns_400(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'text': '   '})

        assert response.status_code == 400

    def test_no_recognized_fields_returns_400(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'bogus': 'value'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'No valid fields to update'

    def test_invalid_done_leaves_the_text_unchanged(self, client, todo_card, make_todo):
        """Validate every field before assigning any (API-7)."""
        todo = make_todo(todo_card.id, text='Original')

        client.patch(f'/api/todos/{todo.id}', json={'text': 'New', 'done': 'yes'})

        assert list_todos(client, todo_card.id)[0]['text'] == 'Original'


class TestDeleteTodo:
    def test_returns_204_with_empty_body(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.delete(f'/api/todos/{todo.id}')

        assert response.status_code == 204
        assert response.data == b''

    def test_deleted_todo_is_gone(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        client.delete(f'/api/todos/{todo.id}')

        assert list_todos(client, todo_card.id) == []
