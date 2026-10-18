"""Tests for the Card and Todo models: what the database enforces and how
timestamps serialize.

Column defaults and the API shape of `to_dict()` are asserted through the
routes (test_routes_cards.py, test_routes_todos.py), where a client sees them.
"""

from datetime import datetime, timedelta

import pytest
from sqlalchemy.exc import IntegrityError

from app import db
from app.models.card import Card
from app.models.todo import Todo


class TestCard:
    def test_slug_must_be_unique(self, card):
        """slug is the frontend's registry key. The create route checks for a
        duplicate first; this constraint is what holds when two requests race."""
        db.session.add(Card(slug=card.slug, title='Duplicate', source='weather'))

        with pytest.raises(IntegrityError):
            db.session.commit()

        db.session.rollback()

    def test_in_place_mutation_of_config_is_not_persisted(self, make_card):
        """Pins the gotcha behind DB-9: a plain JSON column has no mutation
        tracking, so mutating the dict in place is silently lost. Reassign it.

        If this starts failing, the column gained mutation tracking and DB-9
        needs revisiting.
        """
        card = make_card(config={'city': 'San Francisco'})

        card.config['city'] = 'Boston'
        db.session.commit()
        db.session.expire(card)

        assert card.config['city'] == 'San Francisco'

    def test_to_dict_gives_created_at_as_iso8601_in_utc(self, card):
        created_at = datetime.fromisoformat(card.to_dict()['created_at'])

        assert created_at.utcoffset() == timedelta(0)
        assert created_at.replace(tzinfo=None) == card.created_at

    def test_to_dict_leaves_created_at_null_before_the_card_is_saved(self):
        card = Card(slug='unsaved', title='Unsaved', source='placeholder')

        assert card.to_dict()['created_at'] is None


class TestTodo:
    def test_deleting_a_card_deletes_its_todos(self, card, make_todo):
        """Fails if SQLite's foreign keys are off: `ON DELETE CASCADE` is then
        inert, and the todos outlive their card."""
        make_todo(card.id)

        db.session.delete(card)
        db.session.commit()

        assert db.session.scalars(db.select(Todo)).all() == []

    def test_updated_at_advances_on_change(self, card, make_todo):
        todo = make_todo(card.id)
        original = todo.updated_at

        todo.text = 'Edited'
        db.session.commit()

        assert todo.updated_at > original

    @pytest.mark.parametrize('field', ['created_at', 'updated_at'])
    def test_to_dict_gives_timestamps_as_iso8601_in_utc(self, card, make_todo, field):
        todo = make_todo(card.id)

        timestamp = datetime.fromisoformat(todo.to_dict()[field])

        assert timestamp.utcoffset() == timedelta(0)
        assert timestamp.replace(tzinfo=None) == getattr(todo, field)
