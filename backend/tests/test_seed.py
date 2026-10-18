"""Tests for the seed script.

Seeding is how every demo run reaches its starting state, so a broken seed is a
broken demo. By default the script is additive and never loses user data;
`--reset` is the only destructive path (ADR-017, which superseded ADR-014). The
default cards' places live on the "Default" profile's board (`DEFAULT_BOARD`).

Every call passes the fixture's app. `seed()` otherwise builds its own, which
would write to the real `app.db`; and since each in-memory SQLite engine has a
database of its own, a separately built app would not see this test's schema.
"""

from app import db
from app.models.card import Card
from app.models.profile import Profile
from app.models.todo import Todo
from app.routes.data import SERVICES
from seed import DEFAULT_BOARD, DEFAULT_PROFILE_NAME, STARTER_TODO_TEXT, default_cards, seed

DEFAULT_SLUGS = [c.slug for c in default_cards()]

# Cards that never call /api/data/<source>: the todo card owns /api/todos;
# the placeholder, timer and moon cards work in the browser alone.
SOURCES_WITHOUT_A_SERVICE = {'todo', 'placeholder', 'timer', 'moon'}


def all_cards():
    """Every card in the test database, in dashboard order."""
    return db.session.scalars(db.select(Card).order_by(Card.position)).all()


def card_with_slug(slug) -> Card:
    """The card with `slug`; raises if there is none."""
    return db.session.scalars(db.select(Card).filter_by(slug=slug)).one()


def has_card(slug) -> bool:
    return db.session.scalars(db.select(Card).filter_by(slug=slug)).first() is not None


def profile_named(name) -> Profile:
    """The profile called `name`; raises if there is none."""
    return db.session.scalars(db.select(Profile).filter_by(name=name)).one()


def profile_names():
    """Every profile's name, in creation order."""
    return list(db.session.scalars(db.select(Profile.name).order_by(Profile.id)))


def board_by_slug(profile):
    """`profile`'s board as {slug: entry}, which reads better than card ids."""
    return {
        db.session.get_one(Card, entry.card_id).slug: entry.to_dict()
        for entry in profile.board_entries
    }


def default_board():
    """`DEFAULT_BOARD` as the board serializes it: visible unless it says hidden."""
    return {slug: {'hidden': False, **place} for slug, place in DEFAULT_BOARD.items()}


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

    def test_creates_the_default_profile_holding_every_default_card(self, app):
        """The arrangement the demo is designed around; a default card missing
        from DEFAULT_BOARD would fail the seed outright."""
        seed(app)

        assert profile_names() == [DEFAULT_PROFILE_NAME]
        assert board_by_slug(profile_named(DEFAULT_PROFILE_NAME)) == default_board()

    def test_every_card_icon_is_empty_or_one_the_frontend_draws(
        self, app, frontend_icon_names
    ):
        seed(app)

        for card in all_cards():
            assert card.icon == '' or card.icon in frontend_icon_names, card.slug

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

    def test_reseeding_keeps_a_card_the_user_edited(self, app):
        seed(app)
        card_with_slug('weather').title = 'My Weather'
        db.session.commit()

        seed(app)

        assert card_with_slug('weather').title == 'My Weather'

    def test_reseeding_keeps_the_board_the_user_arranged(self, app):
        seed(app)
        default = profile_named(DEFAULT_PROFILE_NAME)
        default.board_entries[0].x = 9
        default.board_entries[1].hidden = True
        db.session.commit()
        arranged = board_by_slug(default)

        seed(app)

        assert board_by_slug(profile_named(DEFAULT_PROFILE_NAME)) == arranged

    def test_adds_only_the_cards_that_are_missing(self, app):
        """The add-a-card workflow: a new default appears without a full reset."""
        seed(app)
        db.session.delete(card_with_slug('space'))
        db.session.commit()

        created = seed(app)

        assert created == ['space']
        assert sorted(c.slug for c in all_cards()) == sorted(DEFAULT_SLUGS)

    def test_a_re_added_card_goes_back_on_the_default_profile_only(self, app):
        seed(app)
        other = Profile(name='Mine')
        db.session.add(other)
        db.session.delete(card_with_slug('space'))
        db.session.commit()

        seed(app)

        assert board_by_slug(profile_named(DEFAULT_PROFILE_NAME)) == default_board()
        assert board_by_slug(profile_named('Mine')) == {}

    def test_a_re_added_card_joins_no_board_when_default_is_gone(self, app):
        """Profiles exist, so the user has arranged their own: the seed neither
        recreates "Default" nor places the card on a profile it does not own."""
        seed(app)
        profile_named(DEFAULT_PROFILE_NAME).name = 'Renamed'
        db.session.delete(card_with_slug('space'))
        db.session.commit()

        seed(app)

        assert profile_names() == ['Renamed']
        assert 'space' not in board_by_slug(profile_named('Renamed'))

    def test_recreates_default_with_every_default_card_when_no_profile_exists(self, app):
        """Not only the cards this run created: with no profile at all, every
        default card already present is placed too."""
        seed(app)
        db.session.execute(db.delete(Profile))
        db.session.commit()

        created = seed(app)

        assert created == []
        assert board_by_slug(profile_named(DEFAULT_PROFILE_NAME)) == default_board()

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

    def test_reset_leaves_only_the_default_profile_at_the_default_board(self, app):
        seed(app)
        profile_named(DEFAULT_PROFILE_NAME).board_entries[0].x = 9
        db.session.add(Profile(name='Mine'))
        db.session.commit()

        seed(app, reset=True)

        assert profile_names() == [DEFAULT_PROFILE_NAME]
        assert board_by_slug(profile_named(DEFAULT_PROFILE_NAME)) == default_board()

    def test_reset_replaces_user_todos_with_the_starter_todo(self, app):
        seed(app)
        add_user_todo()

        seed(app, reset=True)

        assert todo_texts() == [STARTER_TODO_TEXT]
