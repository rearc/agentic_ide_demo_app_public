"""Profiles: named boards. A board says which cards a profile shows and where.

On the wire a board is an object keyed by card id as a string:
`{"3": {"x": 0, "y": 0, "w": 4, "h": 4, "hidden": false}}`.
"""

import re

from flask import Blueprint, abort, jsonify

from app import db
from app.models.card import Card
from app.models.profile import Profile
from app.models.profile_card import ProfileCard
from app.routes.helpers import get_or_404, is_sqlite_integer, json_object_body

profiles_bp = Blueprint('profiles', __name__)

# Matches Profile.name's column width.
MAX_NAME_LENGTH = 50

# The smallest value each of a board entry's place fields may hold.
PLACE_MINIMUMS = {'x': 0, 'y': 0, 'w': 1, 'h': 1}
ENTRY_FORMAT = (
    'an object with integer x and y (0 or more), w and h (1 or more), '
    'and an optional boolean hidden'
)


def _validated_name(value):
    """`value` trimmed, if it is an acceptable profile name; answers 400 otherwise."""
    if not isinstance(value, str) or not value.strip():
        abort(400, 'name must be a non-empty string')
    name = value.strip()
    if len(name) > MAX_NAME_LENGTH:
        abort(400, f'name must be {MAX_NAME_LENGTH} characters or fewer')
    return name


def _require_unused_name(name, profile_id=None):
    """Answer 409 if a profile other than `profile_id` already has `name`."""
    holder = db.session.scalars(db.select(Profile).filter_by(name=name)).first()
    if holder is not None and holder.id != profile_id:
        abort(409, f'A profile named "{name}" already exists')


def _is_entry(value):
    return (
        isinstance(value, dict)
        and set(PLACE_MINIMUMS) <= set(value) <= {*PLACE_MINIMUMS, 'hidden'}
        and all(
            is_sqlite_integer(value[field]) and value[field] >= minimum
            for field, minimum in PLACE_MINIMUMS.items()
        )
        and isinstance(value.get('hidden', False), bool)
    )


def _card_id(key):
    """The card id a board key names, or None when it cannot name a card."""
    # Canonical digits only: "03" would name card 3 a second time.
    if not re.fullmatch(r'0|[1-9][0-9]*', key):
        return None
    card_id = int(key)
    return card_id if is_sqlite_integer(card_id) else None


def _validated_board(value):
    """`value` checked as a board (API-7), as the rows to store; answers 400
    for a malformed board or a key that names no card."""
    if not isinstance(value, dict):
        abort(400, 'board must be an object keyed by card id')
    for key, entry in value.items():
        if not _is_entry(entry):
            abort(400, f'board["{key}"] must be {ENTRY_FORMAT}')

    ids = {key: _card_id(key) for key in value}
    existing = set(
        db.session.scalars(
            db.select(Card.id).where(Card.id.in_([i for i in ids.values() if i is not None]))
        )
    )
    unknown = [key for key, card_id in ids.items() if card_id not in existing]
    if unknown:
        abort(400, f'Unknown card id(s): {", ".join(unknown)}')

    return [
        ProfileCard(card_id=ids[key], **{'hidden': False, **entry})
        for key, entry in value.items()
    ]


@profiles_bp.route('/profiles', methods=['GET'])
def list_profiles():
    profiles = db.session.scalars(db.select(Profile).order_by(Profile.id))
    return jsonify([profile.to_dict() for profile in profiles])


@profiles_bp.route('/profiles', methods=['POST'])
def create_profile():
    data = json_object_body()
    name = _validated_name(data.get('name'))
    board_entries = _validated_board(data.get('board', {}))
    _require_unused_name(name)

    profile = Profile(name=name, board_entries=board_entries)
    db.session.add(profile)
    db.session.commit()
    return jsonify(profile.to_dict()), 201


@profiles_bp.route('/profiles/<int:profile_id>', methods=['PATCH'])
def update_profile(profile_id):
    profile = get_or_404(Profile, profile_id, 'Profile not found')
    data = json_object_body()
    if 'name' not in data and 'board' not in data:
        abort(400, 'No valid fields to update')
    name = _validated_name(data['name']) if 'name' in data else None
    board_entries = _validated_board(data['board']) if 'board' in data else None
    if name is not None:
        _require_unused_name(name, profile.id)
        profile.name = name
    if board_entries is not None:
        # Replaces the whole board: entries not sent are removed (delete-orphan).
        profile.board_entries = board_entries
    db.session.commit()
    return jsonify(profile.to_dict())


@profiles_bp.route('/profiles/<int:profile_id>', methods=['DELETE'])
def delete_profile(profile_id):
    profile = get_or_404(Profile, profile_id, 'Profile not found')
    if db.session.scalar(db.select(db.func.count(Profile.id))) == 1:
        abort(409, 'The last profile cannot be deleted')
    db.session.delete(profile)
    db.session.commit()
    return '', 204
