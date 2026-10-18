"""Tests for the app-wide error handlers.

Every error answers `{"error": "..."}` as JSON with its status code (API-4,
SEC-4), including the ones Flask and Werkzeug raise before a route runs. An
`abort` inside a route is covered by each route's own 400 and 404 tests.
"""

import logging

import pytest


@pytest.fixture
def broken_route(app):
    """Register a route that raises, standing in for any unexpected bug."""

    def broken_view():
        raise RuntimeError('internal detail the client must not see')

    app.add_url_rule('/api/broken', view_func=broken_view)
    return '/api/broken'


def test_unknown_api_path_answers_json_404(client):
    response = client.get('/api/no-such-thing')

    assert response.status_code == 404
    assert response.is_json
    assert 'error' in response.get_json()


def test_unsupported_method_answers_json_405_and_keeps_the_allow_header(client):
    response = client.patch('/api/cards')

    assert response.status_code == 405
    assert response.is_json
    assert 'GET' in response.headers['Allow']


def test_unhandled_exception_answers_a_generic_json_500(client, broken_route):
    response = client.get(broken_route)

    assert response.status_code == 500
    assert response.get_json() == {'error': 'Internal server error'}


def test_unhandled_exception_is_logged_with_its_traceback(client, broken_route, caplog):
    with caplog.at_level(logging.ERROR, logger='app'):
        client.get(broken_route)

    assert caplog.records[-1].exc_info is not None
    assert 'internal detail the client must not see' in caplog.text
