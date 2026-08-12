# Bug Audit — Biotech Data Commons

## Scope

Read-only review of map object lifecycle, spatial collision indexing, barrel destruction, `damageArea()`, and enemy obstacle recovery for the approved Biotech Data Commons plan.

## Risk sheet

| Area | Blast radius | Dependency / load order | Smallest safe delta |
| --- | --- | --- | --- |
| Decorative props | Enemy steering and collision hot paths | `MapObject` -> `MapSystem._buildStaticGrid()` -> `queryNearby()` -> `Entity._steerAroundObstacles()` | Add an explicit `solid` constructor option and omit non-solid objects from `_staticGrid`. |
| Destructive map effects | Every later collision query and draw ordering | `MapSystem.damageArea()` -> static grid / sorted draw buffer | Compact via one map-owned removal primitive which rebuilds the grid and marks `_objectsDirty` only if something was removed. |
| Enemy recovery | Every enemy and boss that calls `_steerAroundObstacles()` | `MapObject.resolveCollision()` runs after enemy update; next update must consume its persisted contact state | Store normal/frame during collision and add a deterministic tangent on the next steering pass. |

## Findings

### P1 — `damageArea()` leaves removed props in the static collision grid

Evidence: `js/map.js:1965-1980` replaces `objects` with a surviving array and sets `_objectsDirty`, but does not call `_buildStaticGrid()`. `queryNearby()` reads `_staticGrid` at `js/map.js:1222-1243`. A destroyed prop therefore remains returned to collision resolution and steering until another path happens to rebuild the grid. This is the existing cache gap named in the plan.

Required behavior: route line-area destruction through the same in-place, map-owned removal/cache-refresh path as barrel removal. Rebuild only when the removal count is nonzero.

### P1 — Non-solid courtyard decorations would still enter collision/steering queries

Evidence: `MapObject` only derives solidity from `type !== 'decoration'` (`js/map.js:513-517`), so it cannot represent a non-solid tree or server without post-construction mutation. More importantly, `_buildStaticGrid()` inserts every object without a solidity check (`js/map.js:1182-1196`). `resolveCollision()` and steering later filter `obj.solid`, but every decorative tree/server would still consume grid storage, Set lookups, and five-probe loop iterations.

Required behavior: add `solid = true` to the prop creation interface (default preserves current behavior), assign it in `MapObject`, and skip `!obj.solid` objects while building the collision grid. Decorative props remain in `objects` so draw ordering and lighting remain unchanged.

### P1 — Current collision correction has no persisted contact signal and has a wrong zero-distance escape axis

Evidence: `resolveCollision()` only mutates position/velocity (`js/map.js:524-557`); `_steerAroundObstacles()` has no contact state to use (`js/entities/base.js:113-166`). This means repeated contact is indistinguishable from an ordinary probe hit, so the planned deterministic tangent recovery cannot be implemented by tuning the existing repulsion alone. In the `distance === 0` branch, it initializes normal `(0, 1)` but moves `entity.x += overlap` (`js/map.js:535-541`), so escape displacement and velocity normal disagree. An entity centered inside a prop can repeatedly resolve against the wrong axis and fail to make progress.

Required behavior: collision records `_mapContactNX`, `_mapContactNY`, and a monotonic/engine frame marker on the entity. Derive a deterministic nearest-face normal when distance is zero. On the next steering call only, blend a tangent whose sign is stable per entity (for example, id parity); clear or age out the contact marker after it has been consumed. Keep the existing five probes and reusable result buffer.

### P2 — `clear()` retains stale static-grid references

Evidence: `MapSystem.clear()` replaces `objects` but does not clear/rebuild `_staticGrid` (`js/map.js:1992`). Until a subsequent `init()` calls `_buildStaticGrid()`, `queryNearby()` can return removed objects. This shares the same cache-invalidation family as the barrel and line-destruction defect and can affect menu/restart transitions or isolated tests.

Required behavior: make `clear()` use the map-owned cache invalidation routine (or explicitly clear `_staticGrid` and reusable result/seen buffers) while retaining the intentional reset of the sorted buffer.

### P2 — The current smoke tests cannot prove the requested safe-garden layout or recovery behavior

Evidence: the added checks in `tests/ui_smoke.py:172-216` cover barrel removal and aggregate type counts only. They do not assert `solid` status, collision-grid membership, no overlaps among solid anchors, guaranteed 160/240-unit clearance, `damageArea()` grid rebuilding, or forward progress after collision.

Required behavior: add deterministic, browser-level assertions for the cases below. Keep tests independent of timing/animation output and do not require a full game session.

## Required regression cases

1. Build a map containing one solid desk and one `solid: false` tree/server. Assert both occur in render ordering, but `queryNearby()` returns only the solid desk and `isBlocked()` is false at the decorative prop.
2. Run `damageArea()` through one destructible solid prop while leaving another outside the segment. Assert exactly the hit object is absent from `objects`, absent from `queryNearby()`, and the untouched prop remains both rendered and collidable.
3. Mark one barrel exploded, run the barrel removal API, then assert remaining solid and decorative props persist, the barrel is absent from `queryNearby()`, and `_objectsDirty` is true. Verify a call with no flagged barrel leaves both cache state and object count unchanged.
4. For every enemy movement archetype, simulate one obstacle, a corner, a narrow turn, and the final courtyard anchor layout for 1.5 seconds. Assert no final circle/solid-rectangle overlap and positive displacement toward the intended side of the obstacle. Include an entity initialized at a prop center to exercise the zero-distance normal.
5. Generate the courtyard twice and compare exact coordinate/type/solidity tables. Assert eight solid trees, twelve decorative trees, two decorative data markers, no pairwise solid overlap, a 160-unit northern entrance, and a 240-unit central traversal corridor.
6. Call `clear()` after a grid build and assert `queryNearby()` returns no prior object.

## Architecture smell

Map collection mutation is currently split across direct assignment in `damageArea()`/`clear()` and the newer `removeObjectsByFlag()`, which makes derived-cache correctness depend on the particular destruction mechanism.

## Exit criteria and rollback

- Performance: static grid contains solid props only; no new arrays, object literals, or full-map scans are introduced into a per-frame enemy update.
- Coverage: browser smoke covers all six cases above, plus the existing barrel cache regression.
- Rollback: revert only the Biotech map coordinate table and the map mutation/contact-state changes; all legacy solid props retain `solid: true` by default.
