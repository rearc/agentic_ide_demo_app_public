"""Contract every service's outbound HTTP must satisfy, regardless of payload.

This asserts on *how* the request is made rather than what comes back
(SVC-6). The graceful-fallback tests elsewhere only run once a request has
returned or errored; a request with no timeout never does either, so the
fallback they cover would never fire.

Patched at `requests.get` rather than via `responses`, because a timeout is a
send-time argument and never appears on the recorded request.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services import quotes, space, weather

EXPECTED_TIMEOUT = 5

# (label, payload the mocked response yields, call to make)
SERVICE_CALLS = [
    (
        'weather',
        {
            'results': [{'latitude': 37.7, 'longitude': -122.4, 'name': 'San Francisco'}],
            'current': {
                'temperature_2m': 18.0,
                'relative_humidity_2m': 70,
                'weather_code': 0,
            },
        },
        lambda: weather.fetch(city='San Francisco'),
    ),
    ('quotes', [{'q': 'A quote.', 'a': 'Someone'}], quotes.fetch),
    (
        'space',
        {
            'title': 'Pillars',
            'url': '',
            'explanation': '',
            'date': '',
            'media_type': 'image',
        },
        space.fetch,
    ),
]


@pytest.fixture
def mocked_get():
    """Patch `requests.get` with a response that satisfies every service."""
    response = MagicMock()
    response.raise_for_status.return_value = None
    with patch('requests.get', return_value=response) as mock_get:
        mock_get.response = response
        yield mock_get


@pytest.mark.parametrize('label,payload,call', SERVICE_CALLS)
def test_every_outbound_request_sets_a_timeout(app, mocked_get, label, payload, call):
    """No timeout means a hung upstream pins a worker forever.

    The fallback path cannot rescue that: it only runs once the request
    returns or raises.
    """
    mocked_get.response.json.return_value = payload

    call()

    assert mocked_get.call_count >= 1, f'{label} made no request'
    for index, made_call in enumerate(mocked_get.call_args_list):
        assert made_call.kwargs.get('timeout') == EXPECTED_TIMEOUT, (
            f'{label} request #{index} has no timeout={EXPECTED_TIMEOUT}'
        )
