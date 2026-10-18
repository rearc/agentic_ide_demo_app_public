"""Tests for the daylight service.

Two calls, like the weather service: geocode the city, then ask for the daily
sunrise, sunset and daylight duration of yesterday, today and tomorrow.
"""

import pytest
import requests

from app.services import daylight
from app.services.open_meteo import FORECAST_URL, GEOCODE_URL

SF_RESULT = [{'latitude': 37.77, 'longitude': -122.42, 'name': 'San Francisco'}]


def fallback(city, description):
    """The fallback: every key a success has, empty (SVC-5), and why."""
    return {
        'fallback': True,
        'city': city,
        'description': description,
        'sunrise': None,
        'sunset': None,
        'tomorrow_sunrise': None,
        'timezone': None,
        'daylight_seconds': None,
        'change_seconds': None,
    }


def register_geocode(http_mock, results=SF_RESULT):
    http_mock.get(GEOCODE_URL, json={'results': results}, status=200)


def register_forecast(http_mock):
    """Yesterday, today, tomorrow: the days are getting shorter."""
    http_mock.get(
        FORECAST_URL,
        json={
            'timezone': 'America/Los_Angeles',
            'daily': {
                'sunrise': [1792246500, 1792332960, 1792419420],
                'sunset': [1792286160, 1792372440, 1792458780],
                'daylight_duration': [39600.4, 39480.6, 39360.0],
            },
        },
        status=200,
    )


class TestHappyPath:
    def test_returns_todays_light(self, http_mock):
        register_geocode(http_mock)
        register_forecast(http_mock)

        result = daylight.fetch(city='San Francisco')

        assert result == {
            'city': 'San Francisco',
            'sunrise': 1792332960,
            'sunset': 1792372440,
            'tomorrow_sunrise': 1792419420,
            'timezone': 'America/Los_Angeles',
            'daylight_seconds': 39481,
            'change_seconds': -120,
        }

    def test_asks_for_three_days_of_daily_fields_in_local_time(self, http_mock):
        register_geocode(http_mock)
        register_forecast(http_mock)

        daylight.fetch(city='San Francisco')

        url = http_mock.calls[1].request.url
        assert 'daily=sunrise%2Csunset%2Cdaylight_duration' in url
        assert 'past_days=1' in url
        assert 'forecast_days=2' in url
        assert 'timezone=auto' in url
        assert 'timeformat=unixtime' in url
        assert 'latitude=37.77' in url
        assert 'longitude=-122.42' in url

    def test_defaults_to_san_francisco_when_no_city_configured(self, http_mock):
        register_geocode(http_mock)
        register_forecast(http_mock)

        daylight.fetch()

        assert 'name=San+Francisco' in http_mock.calls[0].request.url


class TestGracefulFallback:
    """ADR-009: a failing upstream must degrade to fallback data, never raise."""

    def test_unknown_city_returns_located_fallback(self, http_mock):
        register_geocode(http_mock, [])

        assert daylight.fetch(city='Nowhereville') == fallback(
            'Nowhereville', 'Could not find location: Nowhereville'
        )

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 500}, id='http-error'),
            pytest.param({'body': requests.ConnectionError('unreachable')}, id='unreachable'),
        ],
    )
    def test_geocoder_failure_returns_fallback(self, http_mock, upstream):
        http_mock.get(GEOCODE_URL, **upstream)

        assert daylight.fetch(city='San Francisco') == fallback(
            'San Francisco', 'Daylight data unavailable'
        )

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 500}, id='http-error'),
            pytest.param({'json': {'unexpected': 'shape'}, 'status': 200}, id='malformed'),
            pytest.param(
                {'json': {'timezone': 'GMT', 'daily': {'sunrise': []}}, 'status': 200},
                id='short-arrays',
            ),
        ],
    )
    def test_forecast_failure_returns_fallback(self, http_mock, upstream):
        register_geocode(http_mock)
        http_mock.get(FORECAST_URL, **upstream)

        assert daylight.fetch(city='San Francisco') == fallback(
            'San Francisco', 'Daylight data unavailable'
        )
