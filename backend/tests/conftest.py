"""Shared fixtures for the backend suite.

Two of these fixtures are autouse and exist to keep the suite deterministic:
`http_mock` makes an unmocked live HTTP call impossible, and
`clear_service_caches` stops one test's cached lookup from leaking into the next.
"""

import itertools

import pytest
import responses as responses_lib

from app import create_app
from app import db as _db
from app.models.card import Card
from app.models.todo import Todo
from app.services import quotes, space, weather


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
        for module in (weather, quotes, space)
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


@pytest.fixture(autouse=True)
def clear_service_caches():
    """Reset every service-layer cache around each test (TEST-3)."""
    for cached in _cached_callables():
        cached.cache_clear()
    yield
    for cached in _cached_callables():
        cached.cache_clear()


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
            'icon': '☀️',
            'source': 'weather',
            'config': {'city': 'San Francisco'},
            'layout': {'x': 0, 'y': 0, 'w': 4, 'h': 4},
            'position': 1,
            'is_active': True,
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
def make_todo(app):
    """Factory for persisted Todo rows attached to a card."""

    def _make(card_id, text='A task', done=False):
        todo = Todo(card_id=card_id, text=text, done=done)
        _db.session.add(todo)
        _db.session.commit()
        return todo

    return _make
