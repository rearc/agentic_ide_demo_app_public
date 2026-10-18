"""Tests for the weather service.

Reference for testing a two-call service: `fetch` geocodes the city, then asks
for the forecast. Both calls are registered on `http_mock`; nothing reaches the
network.
"""

import pytest
import requests

from app.services import open_meteo, weather
from app.services.open_meteo import FORECAST_URL, GEOCODE_URL
from app.services.weather import WEATHER_CODE_ICONS


def register_geocode(http_mock, results):
    http_mock.get(GEOCODE_URL, json={'results': results}, status=200)


def register_forecast(http_mock, temperature=18.3, humidity=72, weather_code=3):
    http_mock.get(
        FORECAST_URL,
        json={
            'current': {
                'temperature_2m': temperature,
                'relative_humidity_2m': humidity,
                'weather_code': weather_code,
            }
        },
        status=200,
    )


SF_RESULT = [{'latitude': 37.77, 'longitude': -122.42, 'name': 'San Francisco'}]


@pytest.fixture
def success_payload(http_mock):
    """The service's response when the upstream is healthy."""
    register_geocode(http_mock, SF_RESULT)
    register_forecast(http_mock)
    return weather.fetch(city='San Francisco')


@pytest.fixture
def fallback_payload(http_mock):
    """The service's response when the upstream fails.

    The cache is cleared first: a test using both fixtures would otherwise
    reuse the coordinates `success_payload` cached and never reach the failing
    geocode call at all.
    """
    open_meteo.geocode.cache_clear()
    http_mock.get(GEOCODE_URL, status=500)
    return weather.fetch(city='San Francisco')


class TestHappyPath:
    def test_returns_current_conditions(self, http_mock):
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock, temperature=18.3, humidity=72, weather_code=3)

        result = weather.fetch(city='San Francisco')

        assert result == {
            'city': 'San Francisco',
            'temp': 18.3,
            'description': 'Overcast',
            'icon': 'cloud',
            'humidity': 72,
        }

    def test_unrecognized_weather_code_degrades_to_generic_label(self, http_mock):
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock, weather_code=1234)

        result = weather.fetch(city='San Francisco')

        assert result['description'] == 'Unknown'
        assert result['icon'] == 'thermometer'

    def test_uses_the_geocoders_canonical_city_name(self, http_mock):
        """The card is configured with 'sf'; the display name comes from the API."""
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock)

        assert weather.fetch(city='sf')['city'] == 'San Francisco'

    def test_defaults_to_san_francisco_when_no_city_configured(self, http_mock):
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock)

        weather.fetch()

        assert 'name=San+Francisco' in http_mock.calls[0].request.url


class TestGracefulFallback:
    """ADR-009: a failing upstream must degrade to fallback data, never raise."""

    def test_unknown_city_returns_located_fallback(self, http_mock):
        register_geocode(http_mock, [])

        result = weather.fetch(city='Nowhereville')

        assert result['fallback'] is True
        assert result['description'] == 'Could not find location: Nowhereville'
        assert result['city'] == 'Nowhereville'
        assert result['temp'] == '--'

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 500}, id='http-error'),
            pytest.param({'body': requests.ConnectionError('unreachable')}, id='unreachable'),
        ],
    )
    def test_geocoder_failure_returns_fallback(self, http_mock, upstream):
        http_mock.get(GEOCODE_URL, **upstream)

        result = weather.fetch(city='San Francisco')

        assert result['fallback'] is True
        assert result['description'] == 'Weather data unavailable'

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 503}, id='http-error'),
            # A 200 with an unexpected shape must not escape as a KeyError.
            pytest.param({'json': {'unexpected': 'shape'}, 'status': 200}, id='malformed'),
        ],
    )
    def test_forecast_failure_returns_fallback(self, http_mock, upstream):
        register_geocode(http_mock, SF_RESULT)
        http_mock.get(FORECAST_URL, **upstream)

        result = weather.fetch(city='San Francisco')

        assert result['fallback'] is True
        assert result['description'] == 'Weather data unavailable'

    def test_fallback_carries_the_same_keys_as_a_success(
        self, success_payload, fallback_payload
    ):
        """SVC-5: one component renders both, so a missing key is a crash."""
        assert set(fallback_payload) - {'fallback'} == set(success_payload)


class TestGeocodeCaching:
    def test_repeated_lookups_of_one_city_hit_the_geocoder_once(self, http_mock):
        """`geocode` is lru_cache'd, so the second fetch reuses the coordinates."""
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock)
        register_forecast(http_mock)

        weather.fetch(city='San Francisco')
        weather.fetch(city='San Francisco')

        geocode_calls = [c for c in http_mock.calls if c.request.url.startswith(GEOCODE_URL)]
        assert len(geocode_calls) == 1


class TestIconNames:
    """The condition icon is a name the frontend looks up (Icon.jsx)."""

    def test_every_condition_icon_is_one_the_frontend_draws(self, frontend_icon_names):
        assert set(WEATHER_CODE_ICONS.values()) <= frontend_icon_names

    def test_an_unknown_code_gets_an_icon_the_frontend_draws(
        self, http_mock, frontend_icon_names
    ):
        register_geocode(http_mock, SF_RESULT)
        register_forecast(http_mock, weather_code=1234)

        assert weather.fetch(city='San Francisco')['icon'] in frontend_icon_names

    def test_the_fallback_icon_is_one_the_frontend_draws(
        self, fallback_payload, frontend_icon_names
    ):
        assert fallback_payload['icon'] in frontend_icon_names
