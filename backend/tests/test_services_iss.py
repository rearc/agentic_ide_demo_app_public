"""Tests for the ISS service.

One call to CelesTrak for the station's two-line element set (TLE), kept for
two hours in a module-level cache, with a stored TLE as the last resort.
"""

import pytest
import requests

from app.services import iss
from app.services.iss import STORED_TLE, TLE_URL

LINE1 = '1 25544U 98067A   26291.46721113  .00007452  00000+0  14361-3 0  9990'
LINE2 = '2 25544  51.6327  50.0298 0006783 279.2532  80.7689 15.48923373590865'
BODY = f'ISS (ZARYA)             \n{LINE1}\n{LINE2}\n'
HOUR = 60 * 60


@pytest.fixture
def clock(monkeypatch):
    """A controllable time.monotonic: set `clock.now`."""

    class Clock:
        now = 1000.0

    monkeypatch.setattr(iss.time, 'monotonic', lambda: Clock.now)
    return Clock


def tle_line1(epoch_field):
    """A line 1 with the given 14-character epoch field (columns 19-32)."""
    return LINE1[:18] + epoch_field + LINE1[32:]


class TestHappyPath:
    def test_returns_the_tle_and_its_epoch(self, http_mock):
        http_mock.get(TLE_URL, body=BODY)

        assert iss.fetch() == {
            'name': 'ISS (ZARYA)',
            'line1': LINE1,
            'line2': LINE2,
            'epoch': '2026-10-18T11:12:47Z',
            'source': 'celestrak',
        }

    def test_requests_the_iss_element_set_as_tle(self, http_mock):
        http_mock.get(TLE_URL, body=BODY)

        iss.fetch()

        assert http_mock.calls[0].request.url == TLE_URL

    @pytest.mark.parametrize(
        ('field', 'expected'),
        [
            pytest.param('26001.00000000', '2026-01-01T00:00:00Z', id='day-one-is-1-january'),
            pytest.param('25365.50000000', '2025-12-31T12:00:00Z', id='last-day-half'),
            pytest.param('56001.00000000', '2056-01-01T00:00:00Z', id='56-is-2056'),
            pytest.param('57001.00000000', '1957-01-01T00:00:00Z', id='57-is-1957'),
            pytest.param('99365.25000000', '1999-12-31T06:00:00Z', id='99-is-1999'),
        ],
    )
    def test_epoch_conversion_and_year_rule(self, http_mock, field, expected):
        http_mock.get(TLE_URL, body=f'ISS\n{tle_line1(field)}\n{LINE2}\n')

        assert iss.fetch()['epoch'] == expected


class TestCache:
    def test_makes_no_second_request_within_two_hours(self, http_mock, clock):
        http_mock.get(TLE_URL, body=BODY)
        iss.fetch()

        clock.now += 2 * HOUR - 1
        result = iss.fetch()

        assert len(http_mock.calls) == 1
        assert result['source'] == 'celestrak'
        assert 'fallback' not in result

    def test_requests_again_after_two_hours(self, http_mock, clock):
        http_mock.get(TLE_URL, body=BODY)
        iss.fetch()

        clock.now += 2 * HOUR
        iss.fetch()

        assert len(http_mock.calls) == 2


class TestGracefulFallback:
    """ADR-009: a failing upstream must degrade to fallback data, never raise."""

    FAILURES = [
        pytest.param({'status': 500}, id='http-error'),
        pytest.param({'body': requests.ConnectionError('unreachable')}, id='unreachable'),
        pytest.param({'body': 'No GP data found', 'status': 200}, id='no-data-found'),
        pytest.param({'body': f'ISS\n{LINE1[:-1]}\n{LINE2}\n', 'status': 200}, id='short-line'),
    ]

    @pytest.mark.parametrize('upstream', FAILURES)
    def test_failure_without_cache_returns_the_stored_tle(self, http_mock, upstream):
        http_mock.get(TLE_URL, **upstream)

        assert iss.fetch() == {
            **STORED_TLE,
            'epoch': '2026-10-18T11:12:47Z',
            'source': 'stored',
            'fallback': True,
        }

    @pytest.mark.parametrize('upstream', FAILURES)
    def test_failure_with_cache_returns_the_old_tle(self, http_mock, clock, upstream):
        http_mock.get(TLE_URL, body=BODY)
        iss.fetch()
        http_mock.reset()
        http_mock.get(TLE_URL, **upstream)

        clock.now += 3 * HOUR
        result = iss.fetch()

        assert result == {
            'name': 'ISS (ZARYA)',
            'line1': LINE1,
            'line2': LINE2,
            'epoch': '2026-10-18T11:12:47Z',
            'source': 'cached',
            'fallback': True,
        }

    def test_after_a_failure_waits_ten_minutes_before_asking_again(self, http_mock, clock):
        http_mock.get(TLE_URL, status=500)
        iss.fetch()

        clock.now += 9 * 60
        assert iss.fetch()['source'] == 'stored'
        assert len(http_mock.calls) == 1

        clock.now += 2 * 60
        iss.fetch()
        assert len(http_mock.calls) == 2
