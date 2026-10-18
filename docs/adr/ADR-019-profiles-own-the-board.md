# ADR-019: Profiles Own the Board; Cards Are a Library

**Date:** October 2026
**Status:** Accepted (supersedes ADR-013's layout half)

### Context

Each card stored where it sat (`layout`) and whether it showed (`is_active`).
That gave the dashboard one arrangement, and changing which cards appear meant
editing data by hand or code. Two features need more:

- **A library:** hide a card from the board without deleting it (its todos and
  settings survive), and bring it back from a drawer.
- **Profiles:** several saved boards to switch between: which cards each shows
  and where, including a "full screen" board that is one card resized large.

Once a card can sit in different places on different boards, its position is a
fact about the board, not about the card.

The board could be stored two ways:

1. **A JSON `board` column on `profiles`**, mapping card ids to positions. One
   table, and the stored value is the API's shape. But a card id inside JSON
   is invisible to the database: deleting a card leaves its entry in every
   board unless each delete path remembers to remove it.
2. **A `profile_cards` table**, one row per card on a board, with foreign keys
   to both `profiles` and `cards`. One more small model, and saving a board
   replaces its rows.

### Decision

- **A profile is a named board.** `profiles` holds `id`, `name` (unique) and
  `created_at`; `profile_cards` holds `profile_id`, `card_id`, `x`, `y`, `w`,
  `h` and `hidden`, keyed by the pair, with both foreign keys `ON DELETE
  CASCADE`.
- **The board is a table, not JSON.** The structure itself cannot hold an
  entry for a card or a profile that no longer exists: the database removes it
  (DB-12), on every delete path, with no code to remember. This replaces
  ADR-013's reasoning for `layout`, which held while each card had exactly one
  position.
- **Cards are the library.** `cards` loses `layout` and `is_active`; `GET
  /api/cards` returns every card. A new card belongs to no board until someone
  adds it.
- **Hiding keeps the place.** Removing a card from a board marks its row
  `hidden` rather than deleting it, so the card comes back at its last size.
- **The API speaks in whole boards.** A profile's `board` is an object keyed
  by card id; `PATCH /api/profiles/<id>` with a `board` replaces it, after
  checking every card id exists (API-7).
- **The seed builds a "Default" profile** from `DEFAULT_BOARD` in `seed.py`.
  It stays additive (ADR-017): a newly created default card is added to
  Default only, never to a board the user made; `--reset` rebuilds Default.

### Consequences

- Switching boards, hiding and restoring cards need no code change, and no
  card is ever deleted to tidy a board.
- The database guarantees every board entry names a real card; there is no
  cleanup code to forget.
- `profile_cards` is the third table and the second with foreign keys to
  `cards`. The `todos` table's cascade (DB-12) is the model it follows.
- Which profile a browser shows is that browser's choice (stored in
  `localStorage`), not shared state.
- `config` stays a JSON column on `cards` for the reasons ADR-013 gives; only
  its `layout` half is superseded.
