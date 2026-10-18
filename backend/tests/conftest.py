"""Shared fixtures for the backend suite.

Two of these fixtures are autouse and exist to keep the suite deterministic:
`http_mock` makes an unmocked live HTTP call impossible, and
`clear_service_caches` stops one test's cached lookup from leaking into the next.
"""

import itertools
import re
from pathlib import Path

import pytest
import responses as responses_lib

from app import create_app
from app import db as _db
from app.models.card import Card
from app.models.profile import Profile
from app.models.profile_card import ProfileCard
from app.models.todo import Todo
from app.services import iss, open_meteo, quotes, space, weather


@pytest.fixture
def app():
    """A Flask app bound to a fresh in-memory database, with an active app context.

    The schema is built and torn down per test, so no test can observe rows
    written by another. The engine is disposed last: it holds the in-memory
    database's connection, which is otherwise left open for the garbage
    collector (a ResourceWarning per test).
    """
    flask_app = create_app('config.TestConfig')
    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()
        _db.engine.dispose()


@pytest.fixture
def client(app):
    """Flask test client for exercising routes."""
    return app.test_client()


@pytest.fixture(autouse=True)
def http_mock():
    """Register expected HTTP payloads; block every request that is not registered.

    Autouse, so it applies even to tests that never mention it: a request to a
    URL no test registered raises ConnectionError rather than reaching the real
    Open-Meteo / ZenQuotes / NASA APIs. The suite is therefore safe to run
    offline and cannot fail because of someone else's rate limit.
    """
    with responses_lib.RequestsMock(assert_all_requests_are_fired=False) as mock:
        yield mock


def _cached_callables():
    """Every lru_cache'd callable across the service layer.

    Discovered rather than listed, so a cache added to a new service is reset
    automatically. Missing one is near-invisible: the affected test passes
    without ever making the HTTP call it means to exercise.
    """
    return [
        obj
        for module in (weather, quotes, space, open_meteo)
        for obj in vars(module).values()
        if _is_cached(obj)
    ]


def _is_cached(obj):
    """True for an lru_cache-wrapped callable.

    Guarded, because a service module's namespace also holds Flask's
    `current_app` proxy, and any attribute access on that outside an app
    context raises rather than returning False.
    """
    try:
        return callable(getattr(obj, 'cache_clear', None))
    except RuntimeError:
        return False


def _reset_iss_cache():
    """The ISS service keeps its orbit data in module-level values, not an
    lru_cache, because the data expires (iss.py says why)."""
    iss._cached, iss._cached_at, iss._failed_at = None, 0.0, None


@pytest.fixture(autouse=True)
def clear_service_caches():
    """Reset every service-layer cache around each test (TEST-3)."""
    for cached in _cached_callables():
        cached.cache_clear()
    _reset_iss_cache()
    yield
    for cached in _cached_callables():
        cached.cache_clear()
    _reset_iss_cache()


@pytest.fixture
def make_card(app):
    """Factory for persisted Card rows. Override any field via keyword.

    The default slug is sequenced because the column is unique: calling this
    twice in one test must not collide inside the fixture.
    """
    slugs = itertools.count(1)

    def _make(**overrides):
        fields = {
            'slug': f'card-{next(slugs)}',
            'title': 'Weather',
            'description': 'Current conditions at a glance',
            'icon': 'cloud-sun',
            'source': 'weather',
            'config': {'city': 'San Francisco'},
            'position': 1,
        }
        fields.update(overrides)
        card = Card(**fields)
        _db.session.add(card)
        _db.session.commit()
        return card

    return _make


@pytest.fixture
def card(make_card):
    """A single persisted Card, for tests that just need one to exist."""
    return make_card(slug='weather')


@pytest.fixture
def todo_card(make_card):
    """A card todos may attach to: only cards with source 'todo' qualify."""
    return make_card(slug='todo', source='todo')


@pytest.fixture
def make_profile(app):
    """Factory for persisted Profile rows.

    `board` maps a card id to its entry, `{x, y, w, h}` plus an optional
    `hidden`. The default name is sequenced because the column is unique.
    """
    names = itertools.count(1)

    def _make(name=None, board=None):
        profile = Profile(
            name=name or f'Profile {next(names)}',
            board_entries=[
                ProfileCard(card_id=card_id, **entry)
                for card_id, entry in (board or {}).items()
            ],
        )
        _db.session.add(profile)
        _db.session.commit()
        return profile

    return _make


@pytest.fixture
def make_todo(app):
    """Factory for persisted Todo rows attached to a card."""

    def _make(card_id, text='A task', done=False):
        todo = Todo(card_id=card_id, text=text, done=done)
        _db.session.add(todo)
        _db.session.commit()
        return todo

    return _make


ICON_TABLE = Path(__file__).resolve().parents[2] / 'frontend/src/components/Icon.jsx'


@pytest.fixture(scope='session')
def frontend_icon_names():
    """The icon names the frontend can draw: the keys of ICONS in Icon.jsx.

    Icon names cross the stack as plain strings (a card's `icon`, the weather
    service's condition icon), so these tests are what catch a name the
    frontend does not know, which would otherwise render as no icon at all.
    """
    source = ICON_TABLE.read_text()
    table = source[source.index('export const ICONS = {'):]
    table = table[: table.index('\n}')]
    return set(re.findall(r"^\s*'?([a-z][\w-]*)'?:\s*\w+Icon,", table, re.MULTILINE))

