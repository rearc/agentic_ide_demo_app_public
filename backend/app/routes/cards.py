from flask import Blueprint, abort, jsonify

from app import db
from app.models.card import Card
from app.routes.helpers import get_or_404, is_sqlite_integer, json_object_body

cards_bp = Blueprint('cards', __name__)

REQUIRED_FIELDS = ['slug', 'title', 'source']


def _is_non_empty_string(value):
    return isinstance(value, str) and bool(value.strip())


def _is_string(value):
    return isinstance(value, str)


def _is_object(value):
    return isinstance(value, dict)


def _is_layout(value):
    return (
        _is_object(value)
        and set(value) == {'x', 'y', 'w', 'h'}
        and all(is_sqlite_integer(n) for n in value.values())
    )


def _is_boolean(value):
    return isinstance(value, bool)


# field -> (check, what the field must be). The one place that says what a card's
# fields hold, shared by create and update.
FIELD_RULES = {
    'slug': (_is_non_empty_string, 'a non-empty string'),
    'title': (_is_non_empty_string, 'a non-empty string'),
    'source': (_is_non_empty_string, 'a non-empty string'),
    'description': (_is_string, 'a string'),
    'icon': (_is_string, 'a string'),
    'config': (_is_object, 'an object'),
    'layout': (_is_layout, 'an object with integer x, y, w and h'),
    'position': (is_sqlite_integer, 'an integer'),
    'is_active': (_is_boolean, 'a boolean'),
}
OPTIONAL_FIELDS = [f for f in FIELD_RULES if f not in REQUIRED_FIELDS]
# slug is how the seed recognises a default card (ADR-017), so an update
# never changes it and ignores whatever is sent for it.
UPDATABLE_FIELDS = [f for f in FIELD_RULES if f != 'slug']


def _validate_card_fields(data, fields=FIELD_RULES, required=()):
    """Answer 400 for a missing required field or a wrongly typed one among
    `fields`, the fields this request may set (API-7)."""
    missing = [f for f in required if f not in data]
    if missing:
        abort(400, f'Missing required fields: {", ".join(missing)}')
    for field in fields:
        is_valid, expected = FIELD_RULES[field]
        if field in data and not is_valid(data[field]):
            abort(400, f'{field} must be {expected}')


@cards_bp.route('/cards', methods=['GET'])
def list_cards():
    cards = db.session.scalars(
        db.select(Card).filter_by(is_active=True).order_by(Card.position)
    )
    return jsonify([card.to_dict() for card in cards])


@cards_bp.route('/cards/<int:card_id>', methods=['GET'])
def get_card(card_id):
    card = get_or_404(Card, card_id, 'Card not found')
    return jsonify(card.to_dict())


@cards_bp.route('/cards', methods=['POST'])
def create_card():
    data = json_object_body()
    _validate_card_fields(data, required=REQUIRED_FIELDS)

    if db.session.scalars(db.select(Card).filter_by(slug=data['slug'])).first():
        abort(409, f'Card with slug "{data["slug"]}" already exists')

    # Optional fields left out take the model's column defaults.
    card = Card(
        **{f: data[f] for f in REQUIRED_FIELDS},
        **{f: data[f] for f in OPTIONAL_FIELDS if f in data},
    )
    db.session.add(card)
    db.session.commit()
    return jsonify(card.to_dict()), 201


@cards_bp.route('/cards/<int:card_id>', methods=['PUT'])
def update_card(card_id):
    card = get_or_404(Card, card_id, 'Card not found')
    data = json_object_body()
    _validate_card_fields(data, fields=UPDATABLE_FIELDS)

    for field in UPDATABLE_FIELDS:
        if field in data:
            setattr(card, field, data[field])

    db.session.commit()
    return jsonify(card.to_dict())


@cards_bp.route('/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    card = get_or_404(Card, card_id, 'Card not found')
    db.session.delete(card)
    db.session.commit()
    return '', 204
