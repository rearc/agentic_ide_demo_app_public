"""Tests for the quotes service - the simplest service shape (one call, no config)."""

import pytest
import requests

from app.services import quotes
from app.services.quotes import QUOTES_URL


@pytest.fixture
def success_payload(http_mock):
    """The service's response when the upstream is healthy."""
    http_mock.get(QUOTES_URL, json=[{'q': 'A quote.', 'a': 'Someone'}], status=200)
    return quotes.fetch()


@pytest.fixture
def fallback_payload(http_mock):
    """The service's response when the upstream fails."""
    http_mock.get(QUOTES_URL, status=500)
    return quotes.fetch()


class TestHappyPath:
    def test_returns_quote_text_and_author(self, http_mock):
        http_mock.get(
            QUOTES_URL,
            json=[{'q': 'Simplicity is the soul of efficiency.', 'a': 'Austin Freeman'}],
            status=200,
        )

        assert quotes.fetch() == {
            'text': 'Simplicity is the soul of efficiency.',
            'author': 'Austin Freeman',
        }

    def test_missing_fields_take_defaults(self, http_mock):
        http_mock.get(QUOTES_URL, json=[{}], status=200)

        assert quotes.fetch() == {'text': '', 'author': 'Unknown'}


class TestGracefulFallback:
    """ADR-009: a failing upstream must degrade to the canned quote, never raise."""

    @pytest.mark.parametrize(
        'upstream',
        [
            pytest.param({'status': 500}, id='http-error'),
            pytest.param({'body': requests.ConnectionError('unreachable')}, id='unreachable'),
            pytest.param({'body': 'not json at all', 'status': 200}, id='invalid-json'),
            pytest.param({'json': [], 'status': 200}, id='empty-list'),
            pytest.param({'json': {'not': 'a list'}, 'status': 200}, id='not-a-list'),
        ],
    )
    def test_failed_upstream_returns_the_flagged_fallback(self, http_mock, upstream):
        """QuoteCard renders an '(offline)' marker off the `fallback` flag."""
        http_mock.get(QUOTES_URL, **upstream)

        assert quotes.fetch()['fallback'] is True

    def test_fallback_carries_the_same_keys_as_a_success(
        self, success_payload, fallback_payload
    ):
        """SVC-5: one component renders both, so a missing key is a crash."""
        assert set(fallback_payload) - {'fallback'} == set(success_payload)
