# Code fixer — Biotech Data Commons

## Implemented

- Added opt-in `MapObject` solidity while preserving type-derived defaults; non-solid garden foliage and data markers stay drawable but are excluded from the static collision grid.
- Replaced Zone C clusters with the approved deterministic Data Commons table: eight solid tree anchors, twelve decorative trees, and two decorative servers. The central vending machine was moved out of the required 160-unit entrance and 240-unit route.
- Centralized object compaction in `MapSystem._removeObjectsIf()`. Barrel-flag removal and `damageArea()` now rebuild collision data only after a real mutation; `clear()` clears all derived collision references.
- Corrected zero-distance collision normals and records primitive AI contact state. The next shared steering pass applies a deterministic tangent without allocations, queries, or a game-loop reorder.
- Added palette tokens, lower-opacity terrain, containment rails, and bounded 2.4s / 3.6s / 4.8s deterministic animation using the existing canvas paths.
- Extended browser smoke coverage for decorative collision exclusion, damage-area invalidation, clear invalidation, exact courtyard geometry, barrel persistence, and zero-distance anti-stuck recovery.

## Architecture checks

- `map.js` still loads before `entities/base.js`; only primitive contact fields cross that boundary.
- Draw methods only consume `_mapNow` and placement data. Gameplay mutations remain in map update/removal paths.
- The collision grid remains the hot-path broad phase; added full collection work is destruction-time only.

## Planned verification

- Run JavaScript syntax checks, Python compilation, and `git diff --check` here. The test-runner agent owns the full browser smoke run.
