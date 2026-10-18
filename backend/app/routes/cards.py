from flask import Blueprint, jsonify, request

from app import db
from app.models.card import Card

cards_bp = Blueprint('cards', __name__)


@cards_bp.route('/cards', methods=['GET'])
def list_cards():
    cards = db.session.scalars(
        db.select(Card).filter_by(is_active=True).order_by(Card.position)
    )
    return jsonify([card.to_dict() for card in cards])


@cards_bp.route('/cards/<int:card_id>', methods=['GET'])
def get_card(card_id):
    card = db.get_or_404(Card, card_id)
    return jsonify(card.to_dict())


@cards_bp.route('/cards', methods=['POST'])
def create_card():
    # silent=True so a request with no JSON content type returns our 400 with a
    # JSON error body, rather than werkzeug's 415 with an HTML one.
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    required = ['slug', 'title', 'source']
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing required fields: {", ".join(missing)}'}), 400

    # Presence is not enough: a null or non-string value reaches the NOT NULL
    # constraint and surfaces as a 500 instead of a validation error.
    invalid = [
        f for f in required if not isinstance(data[f], str) or not data[f].strip()
    ]
    if invalid:
        return jsonify(
            {'error': f'Fields must be non-empty strings: {", ".join(invalid)}'}
        ), 400

    if db.session.scalars(db.select(Card).filter_by(slug=data['slug'])).first():
        return jsonify({'error': f'Card with slug "{data["slug"]}" already exists'}), 409

    card = Card(
        slug=data['slug'],
        title=data['title'],
        description=data.get('description', ''),
        icon=data.get('icon', ''),
        source=data['source'],
        config=data.get('config', {}),
        position=data.get('position', 0),
        is_active=data.get('is_active', True),
    )
    db.session.add(card)
    db.session.commit()
    return jsonify(card.to_dict()), 201


@cards_bp.route('/cards/<int:card_id>', methods=['PUT'])
def update_card(card_id):
    card = db.get_or_404(Card, card_id)
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Request body is required'}), 400

    for field in ['title', 'description', 'icon', 'source', 'config', 'layout', 'position', 'is_active']:
        if field in data:
            setattr(card, field, data[field])

    db.session.commit()
    return jsonify(card.to_dict())


@cards_bp.route('/cards/<int:card_id>', methods=['DELETE'])
def delete_card(card_id):
    card = db.get_or_404(Card, card_id)
    db.session.delete(card)
    db.session.commit()
    return '', 204
