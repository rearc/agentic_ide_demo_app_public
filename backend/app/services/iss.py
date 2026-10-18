import logging
import time
from datetime import UTC, datetime, timedelta

import requests

logger = logging.getLogger(__name__)

TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE'

TLE_LENGTH = 69
CACHE_SECONDS = 2 * 60 * 60
RETRY_SECONDS = 10 * 60

# The last good TLE and when it was fetched (time.monotonic). CelesTrak asks for
# at most one request an hour, and an orbit changes slowly, so a card refresh
# within two hours is answered without a request.
_cached = None
_cached_at = 0.0
# When the last request failed: after a failure, wait RETRY_SECONDS before
# asking again, so an unreachable or refusing CelesTrak is not asked on every
# page load.
_failed_at = None

# A TLE fetched from CelesTrak on 18 October 2026, for when there is no network
# and nothing cached. A TLE describes the orbit at one moment, so this one
# drifts with time: positions computed from it grow less accurate over days to
# weeks, but still put the station roughly on its track.
STORED_TLE = {
    'name': 'ISS (ZARYA)',
    'line1': '1 25544U 98067A   26291.46721113  .00007452  00000+0  14361-3 0  9990',
    'line2': '2 25544  51.6327  50.0298 0006783 279.2532  80.7689 15.48923373590865',
}


def _parse_epoch(line1):
    """The TLE epoch (line 1, columns 19-32) as an ISO 8601 UTC string."""
    year = int(line1[18:20])
    year += 1900 if year >= 57 else 2000
    day_of_year = float(line1[20:32])
    start = datetime(year, 1, 1, tzinfo=UTC)
    epoch = start + timedelta(days=day_of_year - 1)
    return epoch.replace(microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')


def _parse(body):
    """Validate CelesTrak's three-line answer; it replies 200 to a bad query."""
    lines = [line.rstrip() for line in body.strip().splitlines()]
    if len(lines) != 3 or not all(lines):
        raise ValueError('Expected three non-empty lines')
    name, line1, line2 = lines
    if not line1.startswith('1 ') or not line2.startswith('2 '):
        raise ValueError('Not a TLE')
    if len(line1) != TLE_LENGTH or len(line2) != TLE_LENGTH:
        raise ValueError('TLE lines must be 69 characters')
    return {'name': name.strip(), 'line1': line1, 'line2': line2}


def _result(tle, source, fallback=False):
    result = {**tle, 'epoch': _parse_epoch(tle['line1']), 'source': source}
    if fallback:
        result['fallback'] = True
    return result


def _fallback():
    if _cached is not None:
        return _result(_cached, 'cached', fallback=True)
    return _result(STORED_TLE, 'stored', fallback=True)


def fetch(**_kwargs):
    global _cached, _cached_at, _failed_at

    now = time.monotonic()
    if _cached is not None and now - _cached_at < CACHE_SECONDS:
        return _result(_cached, 'celestrak')
    if _failed_at is not None and now - _failed_at < RETRY_SECONDS:
        return _fallback()

    try:
        resp = requests.get(TLE_URL, timeout=5)
        resp.raise_for_status()
        tle = _parse(resp.text)
        result = _result(tle, 'celestrak')
    except Exception:
        logger.exception('Failed to fetch the ISS TLE')
        _failed_at = now
        return _fallback()

    _cached = tle
    _cached_at = now
    _failed_at = None
    return result
