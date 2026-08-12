# Architecture audit — Biotech Data Commons

## Risk sheet

| Area | Current behavior | Blast radius | Minimal safe delta |
|---|---|---|---|
| Static grid | `_buildStaticGrid()` registers every `MapObject`, including `solid === false`. | Collision broad phase, projectile collision, enemy avoidance, line-of-sight. | Skip `!obj.solid` while building the grid. Rendering and lighting must continue to iterate `objects`. |
| Object removal | `removeObjectsByFlag()` already compacts in place, rebuilds the grid, and dirties draw order. `damageArea()` replaces `objects` with `surviving`, does not rebuild the grid. | Destroyed props remain in collision/LoS buffers until another rebuild; array references can become stale. | Add one map-owned predicate-compaction helper and make both removal paths use it. Only rebuild/sort-dirty when `removed > 0`. |
| Barrel explosion | Game loop marks only the hit barrel `isExploded`, then calls the map-owned flag removal once after all explosion effects. | Correct local barrel semantics rely on `removeObjectsByFlag()` retaining all unflagged props. | Preserve this two-pass sequencing; do not route barrel AoE through `damageArea()`. |
| Enemy recovery | Five probes run before physics, but map collision resolution happens later in `mapSystem.update()` after entity updates. `resolveCollision()` knows the contact normal but currently discards it. | Every enemy and boss class shares `EntityBase`; changes must not alter player/projectile motion. | Record only enemy AI contact state in `MapObject.resolveCollision()`, then consume it at the start of the next `_steerAroundObstacles()` call. |
| Shared nearby buffer | `queryNearby()` returns a reusable array and uses one reusable `Set`. | Nested or retained query results corrupt callers. Existing uses are sequential. | Do not add nested `queryNearby()` calls or retain its result. The recovery must use primitive contact fields, not a query. |

## Exact implementation hooks

1. **Non-solid props**: change `MapObject` construction to accept an optional `solid` parameter with current type-derived behavior as its default. Existing call sites stay valid. Courtyard placement may create `new MapObject(..., 'tree', false)` and `new MapObject(..., 'server', false)`.
2. **Collision indexing**: in `MapSystem._buildStaticGrid()` (`js/map.js`), continue before cell-coordinate work when `!obj || !obj.solid`. `checkCollision()`, `resolveCollision()`, enemy probes, projectile wall checks, and LoS then naturally omit decorative props without special cases.
3. **Central mutation**: evolve `removeObjectsByFlag()` into, or add beside it, a private predicate-based compactor. It must overwrite surviving elements into the existing `this.objects`, trim `.length`, call `_buildStaticGrid()`, and set `_objectsDirty = true` only when at least one object was removed. `damageArea()` should mark matched destructible objects or pass its line-hit predicate directly to this helper; retain current effect emission before compaction.
4. **Map design**: replace only the Zone C cluster calls with fixed object tables. Eight tree entries are solid; twelve trees and two server/data entries pass `solid: false`. Keep the existing clear zones, and validate all solid AABBs against the 160-unit entrance / 240-unit centre walk before appending. Do not use `Math.random()` in the new placement path.
5. **Stuck recovery**: after a successful solid collision on an AI entity, store primitive fields such as `_mapContactNX`, `_mapContactNY`, and `_mapContactFrame`; no point/vector object. At the next enemy `_steerAroundObstacles(dt)`, before its five-probe early return, apply a fixed-sign tangent (`-ny, nx` or `ny, -nx`) based on the contact normal and entity-stable parity, then clear/expire the contact state. Apply this only when `_aiMoveX` exists so player and projectile collision behavior stays unchanged.
6. **Containment and garden visuals**: draw terrain accents in `MapSystem.drawTerrain()` / `drawZoneFloors()` and prop glow in existing map-object draws. Draw functions must only derive from `_mapNow` and immutable placement/config values; they must not alter map state. Keep light-source iteration/culling in `drawLighting()`; decorative trees/servers are still valid lights.

## Dependency and load order

`js/map.js` loads before `js/entities/base.js`, which loads before `js/entities/enemy.js`, and all load before `js/game.js` (verified in `index.html`). Therefore map-owned collision fields can be written without importing the entity classes, and base steering can consume them without a new module dependency. The frame order is: enemy `update()` → `_steerAroundObstacles()` → `applyPhysics()` → `mapSystem.update()` collision resolution. Recovery is necessarily a one-frame-later steering correction unless map-collision ordering is redesigned; do not reorder the global game loop for this feature.

## Performance constraints and architecture smells

- Maintain 60 FPS: no map-wide scans in update/steering; continue to use the static grid and existing reusable query array. The only full collection work is the rare destruction-time grid rebuild.
- Allocate no arrays, objects, closures, or `Set`s in per-enemy recovery. Use numbers already stored on the entity.
- Preserve render culling and cached sorted-object behavior. Mutations must not cause per-frame sorting.
- Keep zone ambience bounded: existing code already draws four deterministic dots per visible zone. Add no dynamic particle systems or per-frame placement randomness.
- Architecture smell: `damageArea()` currently duplicates object-removal policy and swaps the `objects` array, contradicting the existing map cache contract.
- Architecture smell: the static grid's comments say collision indexing, but it currently indexes decorative objects too; the proposed `solid` mode makes that implicit coupling visible.

## Exit criteria and rollback

- Smoke tests assert: eight solid courtyard trees, twelve decorative trees, two decorative server/data props; decorative props draw but are absent from `queryNearby()` and cannot block LoS/projectiles/entities.
- Geometry test asserts no solid-solid AABB overlap and the required 160-unit entrance plus 240-unit centre route remain free.
- Destroying a barrel and a line-damaged prop each leaves unrelated props rendered, absent objects out of the static grid, and `_objectsDirty` true only after mutation.
- Enemy tests cover obstacle face, corner, narrow turn, and both groves. Each archetype clears contact and makes forward progress inside 1.5 seconds without ending inside a solid AABB.
- Validate with `npm run test:smoke`, JavaScript syntax checks, and `git diff --check`; profile the crowded courtyard with the normal enemy cap before release.
- Rollback is limited to the Zone C coordinate table and its accent draw branch. Retain the centralized removal and non-solid grid fix independently because they correct cache integrity rather than change presentation.
