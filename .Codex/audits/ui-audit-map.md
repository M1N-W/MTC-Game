# Map Visual and Interaction Audit

## Deliverable

Adopt **ordered campus sectors**: a sparse combat hub, recognizable purpose-built rooms, and deliberate cover groups that preserve two clear traversal lanes per zone. This uses the existing Canvas map system, zone floors, static spatial grid, and `createCluster()` helper.

## Pre-implementation risk sheet

| Area | Finding | Smallest safe delta |
|---|---|---|
| Barrel explosion | `game.js:_tickBarrelExplosions()` assigns `_sortedObjects = null` when a projectile hits a barrel, but does not set `_objectsDirty = true`. `MapSystem.draw()` then creates an empty buffer and skips repopulating it, making every object disappear. | Replace both barrel-path buffer invalidations with `mapSystem._objectsDirty = true`; after removing an exploded barrel, rebuild the static grid so collision and nearby queries do not retain a deleted barrel. |
| Ordered placement | The map already uses named zone-aligned clusters. The screenshot reads cluttered because every zone carries near-uniform repeated cover plus bright grids, lights, labels, auras, HUD, and enemies at once. | Reduce static cover 30–40%, retain one dominant pattern per zone, and reserve primary circulation lanes. Do not add decorative object types. |
| Traversal | The spawn/approach corridors are protected by `_isClearZone()`, but individual room layouts lack explicit cross-lanes and sightline rules. | Define two lanes and a focal landmark per zone in `generateCampusMap()`; place barrels only at the edge of cover, never in an open lane or the spawn radius. |
| Performance | Placement occurs only at map init and rendering already uses culling plus a sorted draw buffer. | Keep generation deterministic and allocation-free during `draw()`/`update()`; continue using the existing static grid and only rebuild it after object removal. |

Dependency and load order: `balance.js` (`MAP_CONFIG`, `BALANCE`) -> `map.js` (`MapObject`, `ExplosiveBarrel`, `MapSystem`) -> `game.js` (barrel hit/removal) -> `MapSystem.draw()` / `queryNearby()`.

Architecture smell: map object lifetime is mutated in `game.js` while `map.js` owns the sorted cache and spatial grid, so cache invalidation is currently duplicated and incomplete.

## Recommended design: Ordered Campus Sectors

**Direction:** *retro-futurist campus operations map*. The differentiation anchor is a calm, readable central operations plaza with four distinctly patterned wings rather than a uniformly packed battlefield. DFII: 13/15 (impact 4, fit 5, feasibility 5, performance 5, consistency risk 6).

| Area | Ordered layout | Keep clear |
|---|---|---|
| Central hub | No new props inside the existing 300 px spawn radius; use the Citadel, Database, and Co-op as large visual anchors only. | Full radial escape route and boss-combat space. |
| Server Farm east | Two 3-rack server rows aligned north-south with a single cross-aisle; use the east datapillars as a perimeter rhythm. Remove the third full rack row. | 120 px central service lane and the west approach. |
| Archives west | Three bookshelf rows with two desk "reading islands" offset between rows; remove the isolated final shelf row. | One horizontal aisle plus a clean east entrance. |
| Courtyard south | Two asymmetric tree groves, each 2 x 2, at the far west/east corners; remove the back hedge and two near-hub groves. | A 280 px north-south garden walk through the center. |
| Lecture halls | Two compact 2 x 2 desk pods, shifted toward each outer wall, rather than 3 x 2 grids. | The inner side of each hall for arena circulation. |
| Barrels | Four maximum: one flank beside each Server Farm/Archives cover group and two beside the outer lecture-hall desks. Use a 90 px obstacle clearance. | Never place in a protected lane, at a gate, or within 300 px of spawn. |

Use the existing palette with one color story per room: Archives `#fbbf24`, Server Farm `#22d3ee`, Courtyard `#86efac`, and neutral hub `#080d18`. Reduce zone-floor/grid opacity by about one third and draw zone labels at low contrast; props then become the hierarchy instead of competing with the floor. Keep motion limited to existing server/datapillar pulses (0.3 s / 2.0 s) and barrel low-health warning, with no additional animated decorations.

## Three viable directions

1. **Ordered Campus Sectors (recommended).** Sparse hub, two lanes per wing, and room-specific cover grammars. It delivers immediate readability with the smallest code change.
2. **Fortified Perimeter.** Move most cover to outer walls, leave a large open interior, and use paired barricade pockets at each cardinal approach. Strong for boss fights but makes rooms less distinct.
3. **Asymmetric Encounter Islands.** Build three small cover islands per zone, each with a different tactical role (safe, flank, explosive). More organic, but needs stronger placement validation to avoid unfair collision paths.

## Exit criteria and rollback

- At 1920 x 900, the center remains readable with no prop within the 300 px spawn radius; every populated zone has two continuous player-width lanes (>= 90 px).
- Shooting one barrel removes only that barrel; all remaining props continue to render, collide, light, and appear in `queryNearby()`.
- Preserve the current 60 FPS target: no new per-frame allocations, no full sort unless `_objectsDirty`, and static grid rebuilt only after a mutation.
- Add a regression test for barrel removal/cache rebuilding and run `npm test` plus the existing UI smoke test. Rollback is one revert of the map-placement and cache-invalidation diff.
