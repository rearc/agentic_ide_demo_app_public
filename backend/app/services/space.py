import logging

import requests
from flask import current_app

logger = logging.getLogger(__name__)

APOD_URL = 'https://api.nasa.gov/planetary/apod'


# NASA answers 429 (or 403) when the shared DEMO_KEY's quota is spent. Only then
# is "set a key" the fix; for anything else it would send the user looking in
# the wrong place.
REFUSED_STATUSES = {403, 429}
NO_KEY_MESSAGE = (
    'Set NASA_API_KEY in .env for Astronomy Picture of the Day: '
    'the shared DEMO_KEY is heavily rate limited'
)
UNAVAILABLE_MESSAGE = 'Astronomy Picture of the Day is unavailable right now'


def fetch(**_kwargs):
    configured_key = current_app.config.get('NASA_API_KEY', '')

    try:
        resp = requests.get(
            APOD_URL,
            params={'api_key': configured_key or 'DEMO_KEY'},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        explanation = data.get('explanation', '')
        return {
            'title': data.get('title', ''),
            'url': data.get('url', ''),
            'explanation': explanation[:200] + '...' if len(explanation) > 200 else explanation,
            'date': data.get('date', ''),
            'media_type': data.get('media_type', 'image'),
        }
    except Exception as error:
        logger.exception('Failed to fetch NASA APOD')
        return {
            'fallback': True,
            'title': 'Space Photo Unavailable',
            'url': '',
            'explanation': _fallback_message(error, configured_key),
            'date': '',
            'media_type': 'image',
        }


def _fallback_message(error, configured_key):
    refused = (
        isinstance(error, requests.HTTPError)
        and error.response is not None
        and error.response.status_code in REFUSED_STATUSES
    )
    return NO_KEY_MESSAGE if refused and not configured_key else UNAVAILABLE_MESSAGE
