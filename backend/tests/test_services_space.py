"""Tests for the space (NASA APOD) service.

Reference for a service that reads config: it reaches its API key via
`current_app.config`, so these tests take the `app` fixture for its app context.
"""

import pytest
import requests

from app.services import space
from app.services.space import APOD_URL

APOD_PAYLOAD = {
    'title': 'Pillars of Creation',
    'url': 'https://apod.nasa.gov/apod/image/pillars.jpg',
    'explanation': 'A star-forming region in the Eagle Nebula.',
    'date': '2026-07-19',
    'media_type': 'image',
}


@pytest.fixture
def success_payload(app, http_mock):
    """The service's response when the upstream is healthy."""
    http_mock.get(APOD_URL, json=APOD_PAYLOAD, status=200)
    return space.fetch()


@pytest.fixture
def fallback_payload(app, http_mock):
    """The service's response when the upstream fails."""
    http_mock.get(APOD_URL, status=500)
    return space.fetch()


class TestHappyPath:
    def test_returns_the_picture_of_the_day(self, app, http_mock):
        http_mock.get(APOD_URL, json=APOD_PAYLOAD, status=200)

        assert space.fetch() == APOD_PAYLOAD

    def test_video_media_type_is_preserved(self, app, http_mock):
        """SpaceCard branches on media_type to render a link instead of an image.
        'image' is also the default, so only a video shows it is passed through."""
        http_mock.get(APOD_URL, json={**APOD_PAYLOAD, 'media_type': 'video'}, status=200)

        assert space.fetch()['media_type'] == 'video'

    def test_missing_fields_degrade_to_defaults(self, app, http_mock):
        http_mock.get(APOD_URL, json={}, status=200)

        assert space.fetch() == {
            'title': '', 'url': '', 'explanation': '', 'date': '', 'media_type': 'image',
        }


class TestExplanationTruncation:
    """The card shows a preview, so long explanations are cut at 200 characters."""

    def test_explanation_at_the_limit_is_not_truncated(self, app, http_mock):
        http_mock.get(APOD_URL, json={**APOD_PAYLOAD, 'explanation': 'x' * 200}, status=200)

        assert space.fetch()['explanation'] == 'x' * 200

    def test_explanation_over_the_limit_is_truncated_with_ellipsis(self, app, http_mock):
        http_mock.get(APOD_URL, json={**APOD_PAYLOAD, 'explanation': 'x' * 201}, status=200)

        assert space.fetch()['explanation'] == 'x' * 200 + '...'


class TestApiKeyHandling:
    def test_configured_key_is_sent(self, app, http_mock):
        http_mock.get(APOD_URL, json=APOD_PAYLOAD, status=200)

        space.fetch()

        assert 'api_key=test-nasa-key' in http_mock.calls[0].request.url

    def test_falls_back_to_demo_key_when_unset(self, app, http_mock):
        """The app must still boot and fetch with no NASA_API_KEY configured."""
        app.config['NASA_API_KEY'] = ''
        http_mock.get(APOD_URL, json=APOD_PAYLOAD, status=200)

        space.fetch()

        assert 'api_key=DEMO_KEY' in http_mock.calls[0].request.url


class TestGracefulFallback:
    """ADR-009: a failing upstream must degrade to fallback data, never raise."""

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 500}, id='http-error'),
            pytest.param({'body': requests.ConnectionError('unreachable')}, id='unreachable'),
            pytest.param({'body': '<html>gateway error</html>', 'status': 200}, id='invalid-json'),
        ],
    )
    def test_failed_upstream_returns_the_flagged_fallback(self, app, http_mock, upstream):
        http_mock.get(APOD_URL, **upstream)

        assert space.fetch()['fallback'] is True

    def test_fallback_url_is_empty_so_no_broken_image_renders(self, fallback_payload):
        assert fallback_payload['url'] == ''

    def test_fallback_carries_the_same_keys_as_a_success(
        self, success_payload, fallback_payload
    ):
        """SVC-5: one component renders both, so a missing key is a crash."""
        assert set(fallback_payload) - {'fallback'} == set(success_payload)


class TestFallbackMessage:
    """Only a refused DEMO_KEY is fixed by setting a key; for any other failure,
    advice to set one sends the user looking in the wrong place."""

    @pytest.mark.parametrize('status', [403, 429])
    def test_demo_key_refused_suggests_configuring_a_key(self, app, http_mock, status):
        app.config['NASA_API_KEY'] = ''
        http_mock.get(APOD_URL, status=status)

        assert 'NASA_API_KEY' in space.fetch()['explanation']

    def test_own_key_refused_does_not_blame_the_key(self, app, http_mock):
        http_mock.get(APOD_URL, status=429)

        assert 'NASA_API_KEY' not in space.fetch()['explanation']

    def test_other_failure_without_a_key_does_not_blame_the_key(self, app, http_mock):
        app.config['NASA_API_KEY'] = ''
        http_mock.get(APOD_URL, status=500)

        assert 'NASA_API_KEY' not in space.fetch()['explanation']
