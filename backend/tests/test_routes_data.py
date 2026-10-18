"""Tests for /api/data/<source> - the service dispatch seam (ADR-008).

Adding a data source means writing a `fetch(**kwargs)` and adding one entry to
`SERVICES`. These tests cover the dispatch itself, so a new source only needs
its own service test plus a dispatch case here.
"""

import pytest

from app.routes.data import SERVICES
from app.services.open_meteo import FORECAST_URL, GEOCODE_URL
from app.services.quotes import QUOTES_URL
from app.services.space import APOD_URL

# For each source, a (key, value) its healthy upstream below puts in the
# response and its fallback cannot: proof the source reached its own service.
# A source added to SERVICES fails the dispatch test until it has a case here.
DISPATCH_CASES = {
    'weather': ('city', 'Somewhere'),
    'quote': ('author', 'Someone'),
    'space': ('title', 'Pillars'),
    'daylight': ('sunrise', 1792332960),
}


@pytest.fixture
def healthy_upstreams(http_mock):
    """Every upstream API answering successfully."""
    http_mock.get(
        GEOCODE_URL,
        json={'results': [{'latitude': 1.0, 'longitude': 2.0, 'name': 'Somewhere'}]},
    )
    http_mock.get(
        FORECAST_URL,
        json={
            # One body serves the weather card ('current') and the daylight card.
            'current': {'temperature_2m': 1.0, 'relative_humidity_2m': 2, 'weather_code': 0},
            'timezone': 'GMT',
            'daily': {
                'sunrise': [1792246500, 1792332960, 1792419420],
                'sunset': [1792286160, 1792372440, 1792458780],
                'daylight_duration': [39600, 39480, 39360],
            },
        },
    )
    http_mock.get(QUOTES_URL, json=[{'q': 'A quote.', 'a': 'Someone'}])
    http_mock.get(APOD_URL, json={'title': 'Pillars', 'media_type': 'image'})
    return http_mock


@pytest.mark.parametrize('source', SERVICES)
def test_each_source_answers_with_its_own_services_data(client, healthy_upstreams, source):
    key, value = DISPATCH_CASES[source]

    response = client.get(f'/api/data/{source}')

    assert response.status_code == 200
    assert response.get_json()[key] == value


def test_unknown_source_returns_404_naming_it(client):
    """A card whose source has no service gets this 404, and the frontend shows
    a placeholder: the documented failure when the registries drift (ADR-008)."""
    response = client.get('/api/data/nonexistent')

    assert response.status_code == 404
    assert response.get_json() == {'error': 'Unknown source: nonexistent'}


def test_query_params_are_forwarded_to_the_service(client, healthy_upstreams):
    client.get('/api/data/weather?city=Boston')

    assert 'name=Boston' in healthy_upstreams.calls[0].request.url


def test_unrecognized_query_params_are_absorbed(client, healthy_upstreams):
    """Services take **_kwargs, so a stale card config cannot 500 the route."""
    assert client.get('/api/data/quote?stale=param&another=1').status_code == 200


def test_upstream_failure_still_answers_200_with_the_fallback(client, http_mock):
    """ADR-009: a card degrades to its fallback rather than an error response."""
    http_mock.get(QUOTES_URL, status=500)

    response = client.get('/api/data/quote')

    assert response.status_code == 200
    assert response.get_json()['fallback'] is True
