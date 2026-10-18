"""Tests for the seed script.

Seeding is how every demo run reaches its starting state, so a broken seed is a
broken demo. ADR-014 records that the script is deliberately destructive; these
tests pin that behavior rather than treating it as a bug.
"""

import seed as seed_module
from seed import STARTER_TODO_TEXT
from app import db
from app.models.card import Card
from app.models.todo import Todo

EXPECTED_SLUGS = ['weather', 'quote', 'placeholder', 'space', 'todo']


def run_seed(app):
    """Seed the fixture's app, so the seeder writes to the test database.

    `seed()` defaults to building its own app; passing one in is what keeps this
    off the real `app.db`. An in-memory SQLite URI gives each engine its own
    database, so a separately-constructed app would not share this schema.
    """
    seed_module.seed(app)


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


class TestSeedContents:
    def test_seeds_the_five_demo_cards(self, app):
        run_seed(app)

        assert len(all_cards()) == 5

    def test_seeds_the_expected_slugs(self, app):
        run_seed(app)

        slugs = [c.slug for c in all_cards()]
        assert slugs == EXPECTED_SLUGS

    def test_every_seeded_card_is_active(self, app):
        run_seed(app)

        assert all(c.is_active for c in all_cards())

    def test_positions_are_sequential_and_unique(self, app):
        run_seed(app)

        positions = sorted(c.position for c in all_cards())
        assert positions == [1, 2, 3, 4, 5]

    def test_every_card_has_a_layout(self, app):
        """Without a layout the dashboard falls back to a computed grid, which
        is not the arrangement the demo is designed around."""
        run_seed(app)

        for card in all_cards():
            assert set(card.layout) == {'x', 'y', 'w', 'h'}, card.slug

    def test_weather_card_is_configured_with_a_city(self, app):
        run_seed(app)

        assert card_with_slug('weather').config == {
            'city': 'San Francisco'
        }

    def test_seeds_a_starter_todo_attached_to_the_todo_card(self, app):
        run_seed(app)

        todo_card = card_with_slug('todo')
        todos = db.session.scalars(db.select(Todo).filter_by(card_id=todo_card.id))
        assert [t.text for t in todos] == [STARTER_TODO_TEXT]


class TestSeedSourcesMatchTheDispatchTable:
    def test_every_seeded_source_has_a_service(self, app):
        """A seeded card whose source is not in SERVICES renders as a
        placeholder, which would silently break a demo card."""
        from app.routes.data import SERVICES

        run_seed(app)

        for card in all_cards():
            if card.source == 'todo':
                continue  # the todo card owns its data via /api/todos
            assert card.source in SERVICES, card.slug


class TestSeedPreservesUserData:
    """ADR-017: the default seed is additive and must never lose user data."""

    def test_reseeding_does_not_duplicate_cards(self, app):
        run_seed(app)
        run_seed(app)

        assert len(all_cards()) == 5

    def test_reseeding_reports_nothing_created_the_second_time(self, app):
        run_seed(app)

        assert seed_module.seed(app) == []

    def test_reseeding_keeps_a_card_added_at_runtime(self, app):
        run_seed(app)
        db.session.add(Card(slug='custom', title='Added live', source='weather'))
        db.session.commit()

        run_seed(app)

        assert has_card('custom')

    def test_reseeding_keeps_user_created_todos(self, app):
        run_seed(app)
        todo_card = card_with_slug('todo')
        db.session.add(Todo(card_id=todo_card.id, text='My own task'))
        db.session.commit()

        run_seed(app)

        assert 'My own task' in todo_texts()

    def test_reseeding_keeps_a_layout_the_user_dragged(self, app):
        run_seed(app)
        weather = card_with_slug('weather')
        weather.layout = {'x': 9, 'y': 9, 'w': 3, 'h': 3}
        db.session.commit()

        run_seed(app)

        assert card_with_slug('weather').layout == {
            'x': 9, 'y': 9, 'w': 3, 'h': 3,
        }

    def test_reseeding_keeps_a_card_the_user_renamed(self, app):
        run_seed(app)
        weather = card_with_slug('weather')
        weather.title = 'My Weather'
        db.session.commit()

        run_seed(app)

        assert card_with_slug('weather').title == 'My Weather'

    def test_reseeding_keeps_a_card_the_user_deactivated(self, app):
        run_seed(app)
        quote = card_with_slug('quote')
        quote.is_active = False
        db.session.commit()

        run_seed(app)

        assert card_with_slug('quote').is_active is False

    def test_adds_only_the_cards_that_are_missing(self, app):
        """The add-a-card workflow: a new default appears without a full reset."""
        run_seed(app)
        db.session.delete(card_with_slug('space'))
        db.session.commit()

        created = seed_module.seed(app)

        assert created == ['space']
        assert len(all_cards()) == 5

    def test_does_not_re_add_the_starter_todo_after_the_user_clears_it(self, app):
        run_seed(app)
        db.session.execute(db.delete(Todo))
        db.session.commit()

        run_seed(app)

        assert todo_texts() == []


class TestResetFlag:
    """`--reset` restores the pristine state, and is the only destructive path."""

    def test_reset_removes_a_card_added_at_runtime(self, app):
        run_seed(app)
        db.session.add(Card(slug='custom', title='Added live', source='weather'))
        db.session.commit()

        seed_module.seed(app, reset=True)

        assert not has_card('custom')

    def test_reset_removes_user_created_todos(self, app):
        run_seed(app)
        todo_card = card_with_slug('todo')
        db.session.add(Todo(card_id=todo_card.id, text='My own task'))
        db.session.commit()

        seed_module.seed(app, reset=True)

        assert 'My own task' not in todo_texts()

    def test_reset_restores_a_layout_the_user_dragged(self, app):
        run_seed(app)
        weather = card_with_slug('weather')
        weather.layout = {'x': 9, 'y': 9, 'w': 3, 'h': 3}
        db.session.commit()

        seed_module.seed(app, reset=True)

        assert card_with_slug('weather').layout == {
            'x': 0, 'y': 0, 'w': 4, 'h': 4,
        }

    def test_reset_leaves_exactly_the_five_default_cards(self, app):
        run_seed(app)
        db.session.add(Card(slug='custom', title='Added live', source='weather'))
        db.session.commit()

        seed_module.seed(app, reset=True)

        slugs = [c.slug for c in all_cards()]
        assert slugs == EXPECTED_SLUGS

    def test_reset_restores_the_starter_todo(self, app):
        run_seed(app)
        db.session.execute(db.delete(Todo))
        db.session.commit()

        seed_module.seed(app, reset=True)

        assert todo_texts() == [STARTER_TODO_TEXT]
