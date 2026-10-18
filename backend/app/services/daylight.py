import logging

import requests

from app.services.open_meteo import FORECAST_URL, geocode

logger = logging.getLogger(__name__)


def _fallback(city, description):
    # Every key a success has (SVC-5), so the card can read any of them, plus
    # why there is no data.
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
                'daily': 'sunrise,sunset,daylight_duration',
                'past_days': 1,
                'forecast_days': 2,
                # Times as instants (Unix seconds), so a countdown across a
                # daylight-saving change is still right; the city's time zone
                # comes back by name for showing them in its local time.
                'timezone': 'auto',
                'timeformat': 'unixtime',
            },
            timeout=5,
        )
        resp.raise_for_status()
        body = resp.json()
        # The daily arrays hold yesterday, today and tomorrow, in that order.
        daily = body['daily']
        durations = daily['daylight_duration']

        return {
            'city': name,
            'sunrise': daily['sunrise'][1],
            'sunset': daily['sunset'][1],
            'tomorrow_sunrise': daily['sunrise'][2],
            'timezone': body['timezone'],
            'daylight_seconds': round(durations[1]),
            'change_seconds': round(durations[1] - durations[0]),
        }
    except Exception:
        logger.exception('Failed to fetch daylight for %s', city)
        return _fallback(city, 'Daylight data unavailable')
