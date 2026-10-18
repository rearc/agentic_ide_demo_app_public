from flask import Blueprint, abort, jsonify, request

from app import db
from app.models.card import Card
from app.models.todo import Todo
from app.routes.helpers import get_or_404, is_sqlite_integer, json_object_body

todos_bp = Blueprint('todos', __name__)

# Matches Todo.text's column width and the frontend input's maxLength. The
# server enforces it too: a DOM attribute is not a validation boundary.
MAX_TEXT_LENGTH = 500

# The only kind of card that owns todos.
TODO_CARD_SOURCE = 'todo'


def _validate_card_id(value):
    if not is_sqlite_integer(value):
        abort(400, 'card_id must be an integer')


def _require_todo_card(card_id):
    """Answer 404 unless `card_id` is a todo card."""
    card = db.session.get(Card, card_id)
    if card is None or card.source != TODO_CARD_SOURCE:
        abort(404, 'Todo card not found')


def _validate_text(value):
    """Answer 400 unless `value` is acceptable todo text."""
    if not isinstance(value, str) or not value.strip():
        abort(400, 'text is required and must be non-empty')
    if len(value.strip()) > MAX_TEXT_LENGTH:
        abort(400, f'text must be {MAX_TEXT_LENGTH} characters or fewer')


def _validated_changes(data):
    """The fields of a PATCH body, checked and ready to assign (API-7)."""
    changes = {}
    if 'text' in data:
        _validate_text(data['text'])
        changes['text'] = data['text'].strip()
    if 'done' in data:
        if not isinstance(data['done'], bool):
            abort(400, 'done must be a boolean')
        changes['done'] = data['done']
    if not changes:
        abort(400, 'No valid fields to update')
    return changes


@todos_bp.route('/todos', methods=['GET'])
def list_todos():
    raw_card_id = request.args.get('card_id')
    if raw_card_id is None:
        abort(400, 'Query parameter card_id is required')
    try:
        card_id = int(raw_card_id)
    except ValueError:
        # Distinct from "missing": reporting a supplied parameter as absent
        # sends the caller looking in the wrong place.
        abort(400, 'card_id must be an integer')
    _validate_card_id(card_id)
    _require_todo_card(card_id)
    todos = db.session.scalars(
        db.select(Todo).filter_by(card_id=card_id).order_by(Todo.created_at.asc())
    )
    return jsonify([t.to_dict() for t in todos])


@todos_bp.route('/todos', methods=['POST'])
def create_todo():
    data = json_object_body()
    card_id = data.get('card_id')
    if card_id is None:
        abort(400, 'card_id is required')
    _validate_card_id(card_id)
    _validate_text(data.get('text', ''))
    _require_todo_card(card_id)
    todo = Todo(card_id=card_id, text=data['text'].strip())
    db.session.add(todo)
    db.session.commit()
    return jsonify(todo.to_dict()), 201


@todos_bp.route('/todos/<int:todo_id>', methods=['PATCH'])
def update_todo(todo_id):
    todo = get_or_404(Todo, todo_id, 'Todo not found')
    changes = _validated_changes(json_object_body())
    for field, value in changes.items():
        setattr(todo, field, value)
    db.session.commit()
    return jsonify(todo.to_dict())


@todos_bp.route('/todos/<int:todo_id>', methods=['DELETE'])
def delete_todo(todo_id):
    todo = get_or_404(Todo, todo_id, 'Todo not found')
    db.session.delete(todo)
    db.session.commit()
    return '', 204
