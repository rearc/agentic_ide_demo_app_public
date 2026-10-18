import logging

import requests

from app.services.open_meteo import FORECAST_URL, geocode

logger = logging.getLogger(__name__)


WEATHER_CODE_DESCRIPTIONS = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Foggy', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
}

# Icon names, not images: the frontend maps each to an icon (ICONS in
# frontend/src/components/Icon.jsx), so a name used here must be listed there.
WEATHER_CODE_ICONS = {
    0: 'sun', 1: 'sun', 2: 'cloud-sun', 3: 'cloud',
    45: 'fog', 48: 'fog',
    51: 'rain', 53: 'rain', 55: 'rain',
    61: 'rain', 63: 'rain', 65: 'rain',
    71: 'snow', 73: 'snow', 75: 'snow',
    80: 'rain', 81: 'rain', 82: 'rain',
    95: 'storm', 96: 'storm', 99: 'storm',
}


def _fallback(city, description):
    return {
        'fallback': True,
        'city': city,
        'temp': '--',
        'description': description,
        'icon': 'question',
        'humidity': None,
    }


def fetch(city='San Francisco', **_kwargs):
    try:
        geo = geocode(city)
        if not geo:
            return _fallback(city, f'Could not find location: {city}')

        lat, lon, name = geo
        resp = requests.get(
            FORECAST_URL,
            params={
                'latitude': lat,
                'longitude': lon,
                'current': 'temperature_2m,relative_humidity_2m,weather_code',
            },
            timeout=5,
        )
        resp.raise_for_status()
        current = resp.json()['current']
        code = current['weather_code']

        return {
            'city': name,
            'temp': current['temperature_2m'],
            'description': WEATHER_CODE_DESCRIPTIONS.get(code, 'Unknown'),
            'icon': WEATHER_CODE_ICONS.get(code, 'thermometer'),
            'humidity': current['relative_humidity_2m'],
        }
    except Exception:
        logger.exception('Failed to fetch weather for %s', city)
        return _fallback(city, 'Weather data unavailable')
