"""Tests for the seed script.

Seeding is how every demo run reaches its starting state, so a broken seed is a
broken demo. By default the script is additive and never loses user data;
`--reset` is the only destructive path (ADR-017, which superseded ADR-014).

Every call passes the fixture's app. `seed()` otherwise builds its own, which
would write to the real `app.db`; and since each in-memory SQLite engine has a
database of its own, a separately built app would not see this test's schema.
"""

import pytest

from app import db
from app.models.card import Card
from app.models.todo import Todo
from app.routes.data import SERVICES
from seed import STARTER_TODO_TEXT, default_cards, seed

DEFAULT_SLUGS = [c.slug for c in default_cards()]

# Cards that never call /api/data/<source>: the todo card owns /api/todos, and
# the placeholder renders without fetching.
SOURCES_WITHOUT_A_SERVICE = {'todo', 'placeholder'}


def all_cards():
    """Every card in the test database, in dashboard order."""
    return db.session.scalars(db.select(Card).order_by(Card.position)).all()


def card_with_slug(slug) -> Card:
    """The card with `slug`; raises if there is none."""
    return db.session.scalars(db.select(Card).filter_by(slug=slug)).one()


def has_card(slug) -> bool:
    return db.session.scalars(db.select(Card).filter_by(slug=slug)).first() is not None


def todo_texts():
    """The text of every todo in the test database."""
    return list(db.session.scalars(db.select(Todo.text)))


def add_runtime_card():
    """A card the user added through the API after seeding."""
    db.session.add(Card(slug='custom', title='Added live', source='weather'))
    db.session.commit()


def add_user_todo():
    """A todo the user wrote on the seeded todo card."""
    db.session.add(Todo(card_id=card_with_slug('todo').id, text='My own task'))
    db.session.commit()


class TestSeedContents:
    def test_seeds_the_default_cards(self, app):
        seed(app)

        assert [c.slug for c in all_cards()] == DEFAULT_SLUGS

    def test_positions_are_sequential_and_unique(self, app):
        seed(app)

        positions = sorted(c.position for c in all_cards())
        assert positions == list(range(1, len(DEFAULT_SLUGS) + 1))

    def test_every_card_has_a_layout(self, app):
        """Without a layout the dashboard falls back to a computed grid, which
        is not the arrangement the demo is designed around."""
        seed(app)

        for card in all_cards():
            assert set(card.layout) == {'x', 'y', 'w', 'h'}, card.slug

    def test_every_seeded_source_has_a_service(self, app):
        """A seeded card whose source is not in SERVICES renders as a
        placeholder, which would silently break a demo card."""
        seed(app)

        for card in all_cards():
            if card.source in SOURCES_WITHOUT_A_SERVICE:
                continue
            assert card.source in SERVICES, card.slug

    def test_seeds_a_starter_todo_attached_to_the_todo_card(self, app):
        seed(app)

        todo_card = card_with_slug('todo')
        todos = db.session.scalars(db.select(Todo).filter_by(card_id=todo_card.id))
        assert [t.text for t in todos] == [STARTER_TODO_TEXT]


class TestSeedPreservesUserData:
    """ADR-017: the default seed is additive and must never lose user data."""

    def test_reseeding_does_not_duplicate_cards(self, app):
        seed(app)

        seed(app)

        assert [c.slug for c in all_cards()] == DEFAULT_SLUGS

    def test_reseeding_keeps_a_card_added_at_runtime(self, app):
        seed(app)
        add_runtime_card()

        seed(app)

        assert has_card('custom')

    def test_reseeding_keeps_user_created_todos(self, app):
        seed(app)
        add_user_todo()

        seed(app)

        assert 'My own task' in todo_texts()

    @pytest.mark.parametrize(
        ('field', 'value'),
        [
            ('layout', {'x': 9, 'y': 9, 'w': 3, 'h': 3}),
            ('title', 'My Weather'),
            ('is_active', False),
        ],
    )
    def test_reseeding_keeps_a_card_the_user_edited(self, app, field, value):
        seed(app)
        setattr(card_with_slug('weather'), field, value)
        db.session.commit()

        seed(app)

        assert getattr(card_with_slug('weather'), field) == value

    def test_adds_only_the_cards_that_are_missing(self, app):
        """The add-a-card workflow: a new default appears without a full reset."""
        seed(app)
        db.session.delete(card_with_slug('space'))
        db.session.commit()

        created = seed(app)

        assert created == ['space']
        assert sorted(c.slug for c in all_cards()) == sorted(DEFAULT_SLUGS)

    def test_does_not_re_add_the_starter_todo_after_the_user_clears_it(self, app):
        seed(app)
        db.session.execute(db.delete(Todo))
        db.session.commit()

        seed(app)

        assert todo_texts() == []


class TestResetFlag:
    """`--reset` restores the pristine state, and is the only destructive path."""

    def test_reset_leaves_exactly_the_default_cards(self, app):
        seed(app)
        add_runtime_card()

        seed(app, reset=True)

        assert [c.slug for c in all_cards()] == DEFAULT_SLUGS

    def test_reset_restores_a_layout_the_user_dragged(self, app):
        seed(app)
        card_with_slug('weather').layout = {'x': 9, 'y': 9, 'w': 3, 'h': 3}
        db.session.commit()

        seed(app, reset=True)

        assert card_with_slug('weather').layout == {'x': 0, 'y': 0, 'w': 4, 'h': 4}

    def test_reset_replaces_user_todos_with_the_starter_todo(self, app):
        seed(app)
        add_user_todo()

        seed(app, reset=True)

        assert todo_texts() == [STARTER_TODO_TEXT]
