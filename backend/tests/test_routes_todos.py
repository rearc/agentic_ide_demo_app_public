"""Tests for /api/todos - the stateful card's CRUD surface.

The todo feature is the reference implementation for a card that owns a model and
table, so this file is the pattern to copy for the next stateful card.
"""

import pytest

from app import db
from app.models.todo import Todo

BODY_ERROR = {'error': 'Request body must be a JSON object'}
HUGE_ID = 2**63


@pytest.fixture
def todo_card(make_card):
    """A card todos may attach to: only cards with source 'todo' qualify."""
    return make_card(slug='todo', source='todo')


class TestListTodos:
    def test_returns_todos_for_the_card(self, client, todo_card, make_todo):
        make_todo(todo_card.id, text='First')

        response = client.get(f'/api/todos?card_id={todo_card.id}')

        assert response.status_code == 200
        assert [t['text'] for t in response.get_json()] == ['First']

    def test_returns_empty_list_when_card_has_no_todos(self, client, todo_card):
        assert client.get(f'/api/todos?card_id={todo_card.id}').get_json() == []

    def test_orders_todos_by_creation_time(self, client, todo_card, make_todo):
        make_todo(todo_card.id, text='First')
        make_todo(todo_card.id, text='Second')
        make_todo(todo_card.id, text='Third')

        texts = [t['text'] for t in client.get(f'/api/todos?card_id={todo_card.id}').get_json()]

        assert texts == ['First', 'Second', 'Third']

    def test_scopes_todos_to_the_requested_card(self, client, make_card, make_todo):
        card_a = make_card(slug='todo-a', source='todo')
        card_b = make_card(slug='todo-b', source='todo')
        make_todo(card_a.id, text='Belongs to A')
        make_todo(card_b.id, text='Belongs to B')

        texts = [t['text'] for t in client.get(f'/api/todos?card_id={card_a.id}').get_json()]

        assert texts == ['Belongs to A']

    def test_missing_card_id_returns_400(self, client):
        response = client.get('/api/todos')

        assert response.status_code == 400
        assert response.get_json()['error'] == 'Query parameter card_id is required'

    def test_unknown_card_returns_404(self, client):
        response = client.get('/api/todos?card_id=999')

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    def test_a_card_that_is_not_a_todo_card_returns_404(self, client, make_card):
        weather = make_card(slug='weather', source='weather')

        response = client.get(f'/api/todos?card_id={weather.id}')

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    def test_card_id_beyond_the_database_range_returns_400(self, client):
        response = client.get(f'/api/todos?card_id={HUGE_ID}')

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'

    def test_serializes_the_full_todo_shape(self, client, todo_card, make_todo):
        make_todo(todo_card.id)

        payload = client.get(f'/api/todos?card_id={todo_card.id}').get_json()[0]

        assert set(payload) == {'id', 'card_id', 'text', 'done', 'created_at', 'updated_at'}


class TestCreateTodo:
    def test_creates_and_returns_201(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'Write tests'})

        assert response.status_code == 201
        body = response.get_json()
        assert body['text'] == 'Write tests'
        assert body['done'] is False

    def test_new_todo_is_listed(self, client, todo_card):
        client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'Write tests'})

        assert len(client.get(f'/api/todos?card_id={todo_card.id}').get_json()) == 1

    def test_trims_surrounding_whitespace(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': '  padded  '})

        assert response.get_json()['text'] == 'padded'

    def test_missing_card_id_returns_400(self, client):
        response = client.post('/api/todos', json={'text': 'Orphan'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id is required'

    def test_missing_text_returns_400(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id})

        assert response.status_code == 400
        assert 'text is required' in response.get_json()['error']

    def test_whitespace_only_text_returns_400(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': '   '})

        assert response.status_code == 400

    def test_non_string_text_returns_400(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': todo_card.id, 'text': 42})

        assert response.status_code == 400

    def test_unknown_card_returns_404(self, client):
        response = client.post('/api/todos', json={'card_id': 999, 'text': 'Orphan'})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    def test_a_card_that_is_not_a_todo_card_returns_404(self, client, make_card):
        weather = make_card(slug='weather', source='weather')

        response = client.post('/api/todos', json={'card_id': weather.id, 'text': 'Misplaced'})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo card not found'

    def test_empty_json_body_is_validated_by_the_route(self, client):
        response = client.post('/api/todos', json={})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id is required'

    @pytest.mark.parametrize('body', [[1], 'x', 42, None])
    def test_a_body_that_is_not_an_object_returns_400(self, client, body):
        response = client.post('/api/todos', json=body)

        assert response.status_code == 400
        assert response.get_json() == BODY_ERROR


class TestUpdateTodo:
    def test_marks_a_todo_done(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'done': True})

        assert response.status_code == 200
        assert response.get_json()['done'] is True

    def test_edits_the_text(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'text': 'Rewritten'})

        assert response.get_json()['text'] == 'Rewritten'

    def test_trims_edited_text(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'text': '  padded  '})

        assert response.get_json()['text'] == 'padded'

    def test_updates_both_fields_at_once(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        body = client.patch(
            f'/api/todos/{todo.id}', json={'text': 'Rewritten', 'done': True}
        ).get_json()

        assert body['text'] == 'Rewritten'
        assert body['done'] is True

    def test_change_is_persisted(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        client.patch(f'/api/todos/{todo.id}', json={'done': True})

        assert client.get(f'/api/todos?card_id={todo_card.id}').get_json()[0]['done'] is True

    def test_non_boolean_done_returns_400(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'done': 'yes'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'done must be a boolean'

    def test_empty_text_returns_400(self, client, todo_card, make_todo):
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

        text = db.session.scalars(db.select(Todo.text).filter_by(id=todo.id)).one()
        assert text == 'Original'

    @pytest.mark.parametrize('body', [[1], 'x', 42, None])
    def test_a_body_that_is_not_an_object_returns_400(self, client, todo_card, make_todo, body):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json=body)

        assert response.status_code == 400
        assert response.get_json() == BODY_ERROR

    def test_id_beyond_the_database_range_returns_404(self, client):
        response = client.patch(f'/api/todos/{HUGE_ID}', json={'done': True})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo not found'

    def test_unknown_id_returns_404(self, client):
        response = client.patch('/api/todos/999', json={'done': True})

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo not found'


class TestDeleteTodo:
    def test_returns_204_with_empty_body(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.delete(f'/api/todos/{todo.id}')

        assert response.status_code == 204
        assert response.data == b''

    def test_deleted_todo_is_gone(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        client.delete(f'/api/todos/{todo.id}')

        assert client.get(f'/api/todos?card_id={todo_card.id}').get_json() == []

    def test_id_beyond_the_database_range_returns_404(self, client):
        assert client.delete(f'/api/todos/{HUGE_ID}').status_code == 404

    def test_unknown_id_returns_404(self, client):
        response = client.delete('/api/todos/999')

        assert response.status_code == 404
        assert response.get_json()['error'] == 'Todo not found'


class TestCardIdTypeValidation:
    """`bool` is a subclass of `int` in Python, so an unguarded `card_id: true`
    resolves to card 1 and silently attaches the todo to the wrong card."""

    def test_boolean_card_id_is_rejected(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': True, 'text': 'A task'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'

    def test_boolean_card_id_does_not_create_a_todo(self, client, todo_card):
        client.post('/api/todos', json={'card_id': True, 'text': 'A task'})

        assert client.get(f'/api/todos?card_id={todo_card.id}').get_json() == []

    def test_card_id_beyond_the_database_range_is_rejected(self, client):
        response = client.post('/api/todos', json={'card_id': HUGE_ID, 'text': 'A task'})

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'

    def test_string_card_id_is_rejected(self, client, todo_card):
        response = client.post('/api/todos', json={'card_id': 'abc', 'text': 'A task'})

        assert response.status_code == 400

    def test_non_integer_query_card_id_is_reported_as_invalid_not_missing(self, client):
        """Reporting a supplied parameter as absent sends the caller looking in
        the wrong place."""
        response = client.get('/api/todos?card_id=abc')

        assert response.status_code == 400
        assert response.get_json()['error'] == 'card_id must be an integer'


class TestTextLengthIsEnforcedServerSide:
    """The frontend's maxLength is a convenience, not a boundary."""

    def test_text_at_the_limit_is_accepted(self, client, todo_card):
        response = client.post(
            '/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 500}
        )

        assert response.status_code == 201

    def test_text_over_the_limit_is_rejected(self, client, todo_card):
        response = client.post(
            '/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 501}
        )

        assert response.status_code == 400
        assert '500 characters' in response.get_json()['error']

    def test_over_long_text_is_not_persisted(self, client, todo_card):
        client.post('/api/todos', json={'card_id': todo_card.id, 'text': 'x' * 501})

        assert client.get(f'/api/todos?card_id={todo_card.id}').get_json() == []

    def test_patch_rejects_over_long_text(self, client, todo_card, make_todo):
        todo = make_todo(todo_card.id)

        response = client.patch(f'/api/todos/{todo.id}', json={'text': 'x' * 501})

        assert response.status_code == 400

    def test_post_without_json_content_type_returns_400(self, client):
        response = client.post('/api/todos', data='card_id=1')

        assert response.status_code == 400
        assert response.get_json() == BODY_ERROR
