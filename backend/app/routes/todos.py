from flask import Blueprint, jsonify, request

from app import db
from app.models.card import Card
from app.models.todo import Todo

todos_bp = Blueprint('todos', __name__)

# Matches Todo.text's column width and the frontend input's maxLength. The
# server enforces it too: a DOM attribute is not a validation boundary.
MAX_TEXT_LENGTH = 500


def _valid_card_id(value):
    """True if `value` is usable as a card id.

    `bool` is excluded explicitly: it is a subclass of `int` in Python, so
    `card_id: true` would otherwise resolve to card 1.
    """
    return isinstance(value, int) and not isinstance(value, bool)


def _validate_text(value):
    """Return an error message for `value`, or None if it is acceptable."""
    if not isinstance(value, str) or not value.strip():
        return 'text is required and must be non-empty'
    if len(value.strip()) > MAX_TEXT_LENGTH:
        return f'text must be {MAX_TEXT_LENGTH} characters or fewer'
    return None


@todos_bp.route('/todos', methods=['GET'])
def list_todos():
    raw_card_id = request.args.get('card_id')
    if raw_card_id is None:
        return jsonify({'error': 'Query parameter card_id is required'}), 400
    try:
        card_id = int(raw_card_id)
    except ValueError:
        # Distinct from "missing": reporting a supplied parameter as absent
        # sends the caller looking in the wrong place.
        return jsonify({'error': 'card_id must be an integer'}), 400
    card = db.session.get(Card, card_id)
    if not card:
        return jsonify({'error': 'Card not found'}), 404
    todos = db.session.scalars(
        db.select(Todo).filter_by(card_id=card_id).order_by(Todo.created_at.asc())
    )
    return jsonify([t.to_dict() for t in todos])


@todos_bp.route('/todos', methods=['POST'])
def create_todo():
    # silent=True so a request with no JSON content type returns our 400 with a
    # JSON error body, rather than werkzeug's 415 with an HTML one.
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    card_id = data.get('card_id')
    if card_id is None:
        return jsonify({'error': 'card_id is required'}), 400
    if not _valid_card_id(card_id):
        return jsonify({'error': 'card_id must be an integer'}), 400
    text_error = _validate_text(data.get('text', ''))
    if text_error:
        return jsonify({'error': text_error}), 400
    card = db.session.get(Card, card_id)
    if not card:
        return jsonify({'error': 'Card not found'}), 404
    todo = Todo(card_id=card_id, text=data['text'].strip())
    db.session.add(todo)
    db.session.commit()
    return jsonify(todo.to_dict()), 201


@todos_bp.route('/todos/<int:todo_id>', methods=['PATCH'])
def update_todo(todo_id):
    todo = db.session.get(Todo, todo_id)
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    if 'text' in data:
        text_error = _validate_text(data['text'])
        if text_error:
            return jsonify({'error': text_error}), 400
        todo.text = data['text'].strip()
    if 'done' in data:
        if not isinstance(data['done'], bool):
            return jsonify({'error': 'done must be a boolean'}), 400
        todo.done = data['done']
    if 'text' not in data and 'done' not in data:
        return jsonify({'error': 'No valid fields to update'}), 400
    db.session.commit()
    return jsonify(todo.to_dict())


@todos_bp.route('/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    todo = db.session.get(Todo, todo_id)
    if not todo:
        return jsonify({'error': 'Todo not found'}), 404
    db.session.delete(todo)
    db.session.commit()
    return '', 204
