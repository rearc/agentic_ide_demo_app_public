"""Open-Meteo, the provider behind the weather and daylight cards (no key)."""

from functools import lru_cache

import requests

GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'


@lru_cache(maxsize=128)
def geocode(city):
    """Look a city up on Open-Meteo: `(lat, lon, name)`, or None if not found.

    Cached per city. Raises on an HTTP or network failure: callers wrap it
    (ADR-009).
    """
    resp = requests.get(
        GEOCODE_URL,
        params={'name': city, 'count': 1},
        timeout=5,
    )
    resp.raise_for_status()
    results = resp.json().get('results')
    if not results:
        return None
    loc = results[0]
    return (loc['latitude'], loc['longitude'], loc.get('name', city))
