# ADR-013: JSON Columns for Card Configuration and Layout

**Date:** March 2026
**Status:** Accepted; the layout half superseded by ADR-019

### Context

The Card model needs to store two types of flexible data:

1. **Configuration (`config`):** Each card type has different configuration needs. The weather card needs a `city` field, the space card needs nothing, and a future card type might need entirely different fields. This shape varies per card type and could change as new types are added.
2. **Layout (`layout`):** The grid position and size of each card (`x`, `y`, `w`, `h`), which is always read and written as a complete unit when the user rearranges the dashboard.

The alternatives were: (a) JSON columns on the Card table, (b) a separate normalized table for config key-value pairs, or (c) fixed columns for every possible config field.

### Decision

Both `config` and `layout` are stored as JSON columns on the Card model. This provides flexibility for `config` — new card types can define whatever configuration shape they need without requiring a database migration. For `layout`, the data is a fixed shape but is always read and written atomically, so a JSON column avoids an unnecessary join to a separate layout table.

### Consequences

- Adding a new card type with unique configuration needs requires zero schema changes.
- The config structure is implicit (defined by convention in each service) rather than explicit (defined by a schema). This trades type safety for flexibility.
- JSON columns in SQLite have limited query capabilities — you can't efficiently filter or index on fields within the JSON. This is acceptable because the app never needs to query cards by their config contents.
- Layout persistence is simple: the frontend sends the full layout object, and the backend stores it as-is.
