"""Tests for the Card and Todo models - column defaults, serialization, and the
JSON-column behavior that ADR-013 commits the app to.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app import db
from app.models.card import Card
from app.models.todo import Todo


class TestCardDefaults:
    def test_optional_columns_take_their_defaults(self, app):
        card = Card(slug='minimal', title='Minimal', source='placeholder')
        db.session.add(card)
        db.session.commit()

        assert card.description == ''
        assert card.icon == ''
        assert card.config == {}
        assert card.layout == {}
        assert card.position == 0
        assert card.is_active is True

    def test_created_at_is_populated(self, app):
        card = Card(slug='minimal', title='Minimal', source='placeholder')
        db.session.add(card)
        db.session.commit()

        assert card.created_at is not None

    def test_is_active_can_be_set_false(self, make_card):
        assert make_card(slug='hidden', is_active=False).is_active is False

    def test_position_is_stored(self, make_card):
        assert make_card(slug='fifth', position=5).position == 5


class TestCardConstraints:
    def test_slug_must_be_unique(self, app, make_card):
        make_card(slug='weather')

        db.session.add(Card(slug='weather', title='Duplicate', source='weather'))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

    def test_slug_is_required(self, app):
        db.session.add(Card(title='No slug', source='weather'))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

    def test_source_is_required(self, app):
        db.session.add(Card(slug='no-source', title='No source'))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()


class TestCardJsonColumns:
    """ADR-013: config and layout are JSON columns rather than separate tables."""

    def test_config_round_trips_a_nested_structure(self, app, make_card):
        config = {'city': 'Boston', 'units': {'temp': 'F', 'wind': 'mph'}, 'tags': [1, 2]}
        card = make_card(slug='nested', config=config)

        db.session.expire(card)

        assert card.config == config

    def test_layout_round_trips(self, app, make_card):
        layout = {'x': 2, 'y': 3, 'w': 6, 'h': 5}
        card = make_card(slug='positioned', layout=layout)

        db.session.expire(card)

        assert card.layout == layout

    def test_reassigning_config_persists(self, app, make_card):
        card = make_card(slug='reassign')

        card.config = {**card.config, 'city': 'Boston'}
        db.session.commit()
        db.session.expire(card)

        assert card.config['city'] == 'Boston'

    def test_in_place_mutation_of_config_is_not_persisted(self, app, make_card):
        """Gotcha: a plain JSON column has no mutation tracking.

        Mutating the dict in place leaves the session unaware the row is dirty,
        so the write is silently lost. Always reassign (see the test above).
        """
        card = make_card(slug='mutate', config={'city': 'San Francisco'})

        card.config['city'] = 'Boston'
        db.session.commit()
        db.session.expire(card)

        assert card.config['city'] == 'San Francisco'


class TestCardSerialization:
    def test_to_dict_exposes_the_api_contract(self, make_card):
        card = make_card(slug='weather', title='Weather', position=1)

        payload = card.to_dict()

        assert payload['id'] == card.id
        assert payload['slug'] == 'weather'
        assert payload['title'] == 'Weather'
        assert payload['position'] == 1
        assert payload['is_active'] is True

    def test_to_dict_gives_created_at_as_iso8601_in_utc(self, card):
        created_at = datetime.fromisoformat(card.to_dict()['created_at'])

        assert created_at.utcoffset() == timedelta(0)
        assert created_at.replace(tzinfo=None) == card.created_at

    def test_to_dict_leaves_created_at_null_before_the_card_is_saved(self):
        card = Card(slug='unsaved', title='Unsaved', source='placeholder')

        assert card.to_dict()['created_at'] is None

    def test_to_dict_keys_are_stable(self, card):
        assert set(card.to_dict()) == {
            'id', 'slug', 'title', 'description', 'icon', 'source',
            'config', 'layout', 'position', 'is_active', 'created_at',
        }


class TestTodoDefaults:
    def test_done_defaults_to_false(self, app, card):
        todo = Todo(card_id=card.id, text='A task')
        db.session.add(todo)
        db.session.commit()

        assert todo.done is False

    def test_timestamps_are_populated(self, app, card):
        todo = Todo(card_id=card.id, text='A task')
        db.session.add(todo)
        db.session.commit()

        assert todo.created_at is not None
        assert todo.updated_at is not None

    def test_updated_at_advances_on_change(self, app, card, make_todo):
        todo = make_todo(card.id)
        original = todo.updated_at

        todo.text = 'Edited'
        db.session.commit()

        assert todo.updated_at > original


class TestTodoConstraints:
    def test_card_id_is_required(self, app):
        db.session.add(Todo(text='Orphan'))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

    def test_card_id_must_name_an_existing_card(self, app):
        db.session.add(Todo(card_id=999, text='Orphan'))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

    def test_text_is_required(self, app, card):
        db.session.add(Todo(card_id=card.id))
        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()


class TestTodoCascade:
    def test_deleting_a_card_deletes_its_todos(self, app, card, make_todo):
        make_todo(card.id)

        db.session.delete(card)
        db.session.commit()

        assert db.session.scalars(db.select(Todo)).all() == []


class TestTodoSerialization:
    def test_to_dict_exposes_the_api_contract(self, card, make_todo):
        todo = make_todo(card.id, text='A task', done=True)

        payload = todo.to_dict()

        assert payload['id'] == todo.id
        assert payload['card_id'] == card.id
        assert payload['text'] == 'A task'
        assert payload['done'] is True

    @pytest.mark.parametrize('field', ['created_at', 'updated_at'])
    def test_to_dict_gives_timestamps_as_iso8601_in_utc(self, card, make_todo, field):
        todo = make_todo(card.id)

        timestamp = datetime.fromisoformat(todo.to_dict()[field])

        assert timestamp.utcoffset() == timedelta(0)
        assert timestamp.replace(tzinfo=None) == getattr(todo, field)

    def test_to_dict_keys_are_stable(self, card, make_todo):
        todo = make_todo(card.id)

        assert set(todo.to_dict()) == {
            'id', 'card_id', 'text', 'done', 'created_at', 'updated_at',
        }
