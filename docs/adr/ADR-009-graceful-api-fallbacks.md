# ADR-009: Graceful API Fallbacks Over Exceptions

**Date:** March 2026
**Status:** Accepted

### Context

The dashboard integrates with free external APIs, among them Open-Meteo for weather data, Zen Quotes for inspirational quotes and NASA APOD for space imagery, all with rate limits. During the workshop, 30+ attendees might be running the app simultaneously, all hitting the same APIs from the same network. The risk of hitting rate limits, encountering network issues on conference wifi, or having an API go down during a live demo was significant.

If a service raised an exception on failure, the API route would return a 500 error, and the corresponding card would display an error state. One flaky API could degrade the experience for every attendee during a live demo.

### Decision

All external API service functions (`weather.py`, `quotes.py`, `space.py`) use try/catch blocks and return fallback data instead of raising exceptions. Each service:

- Catches HTTP errors and logs them via Python's `logging` module.
- Returns a dictionary with sensible fallback content (e.g., the quote service returns a hardcoded inspirational quote; the weather service returns an error message explaining the failure).
- Includes a `fallback: True` flag so the frontend can detect and style degraded states differently (e.g., marking a quote as "(offline)").

This was primarily a pragmatic decision to prevent workshop disruption. The risk of rate limiting or connectivity issues during a live demo with dozens of concurrent users was too high to leave cards in a broken error state.

### Consequences

- The dashboard remains functional even when external APIs are unavailable — cards render with fallback content rather than error messages.
- Workshop demos are resilient to network issues, rate limits, and API outages.
- Silent failures could mask bugs during development — a service could be misconfigured and still appear to "work" because it silently falls back.
- The fallback pattern adds a small amount of complexity to each service function, but the pattern is consistent and easy to follow.
