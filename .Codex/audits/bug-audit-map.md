# Map explosive-barrel disappearance audit

## Deliverable

Root cause confirmed: shooting any barrel nulls the renderer's reusable draw buffer without setting its dirty flag. The following `MapSystem.draw()` allocates an empty buffer and intentionally does not repopulate it, so every remaining map object becomes invisible. The objects remain in `mapSystem.objects`; this is a rendering-cache invalidation defect, not an area-of-effect deletion.

## Pre-implementation risk sheet

| Area | Finding |
| --- | --- |
| Blast radius | Every map object drawn by `MapSystem.draw()` disappears immediately after the first projectile damages a barrel. Terrain, `mtcRoom`, and separately drawn database/shop landmarks are unaffected. |
| Dependency chain | `gameLoop` -> `_tickBarrelExplosions()` -> `mapSystem._sortedObjects` -> `MapSystem.draw()` -> `_ensureSortedObjectBuffer()` / `_objectsDirty`. |
| Load order | `map.js` defines the `MapSystem` cache contract before `game.js` consumes `window.mapSystem`; `game.js` updates before the same-frame `drawGame()` call. No inheritance or monkey-patch is involved. |
| Smallest safe delta | In `js/game.js`, remove the no-op cache invalidations at lines 605 and 658. At line 665, after assigning `survivingObjects`, set `mapSystem._objectsDirty = true` and rebuild the static grid once. Do not null the reusable buffer. |

## Exact mechanism

1. At `js/game.js:605`, a non-lethal barrel hit sets `_sortedObjects = null`.
2. `js/map.js:1171-1175` then creates a fresh empty buffer.
3. `js/map.js:1837-1841` refills that buffer only if `_objectsDirty` is truthy. A projectile hit never sets it.
4. The render loop therefore iterates an empty array and all map objects vanish. The same invalidation bug also runs at `js/game.js:658` and `:665` during a barrel death.

## Lifecycle and data-structure contract

- `objects` is the authoritative map-object array.
- `_sortedObjects` is a reusable, derived draw-order buffer. It must stay allocated to preserve the zero-GC draw path.
- `_objectsDirty` means the authoritative collection changed and the derived buffer must be rebuilt before the next draw.
- `_staticGrid` is another derived cache. It is built once in `init()` (`js/map.js:1177-1240`) but becomes stale when barrels are removed. After committing `survivingObjects`, rebuild it once (`mapSystem._buildStaticGrid()`) so collision/AI queries no longer see destroyed barrels.

## Remediation acceptance criteria

- Deal non-lethal barrel damage: all map objects remain visible; only that barrel's HP indicator changes.
- Destroy one barrel: exactly that barrel is removed; nearby enemies/player receive AoE; other objects remain visible and collidable.
- After the removal frame, `queryNearby()` excludes the destroyed barrel.
- Maintain one sort at most per collection mutation and no per-frame array allocation. Target remains compatible with a 60 FPS loop.
- Add a focused regression test or deterministic browser check covering non-lethal hit then lethal barrel destruction. Rollback is limited to the cache-invalidation lines in `js/game.js`.

## Architecture smell

`game.js` mutates two private `MapSystem` cache fields directly, which duplicates cache ownership and caused the contract mismatch; a future small `MapSystem.removeObjects(...)` method would centralize it, but that is outside this minimal fix.
