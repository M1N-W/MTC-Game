# UI / Creative Audit — Biotech Data Commons

## Deliverable

Implement the approved mixed direction as **Biotech Data Commons**: a legible retro-futurist campus whose south courtyard is an overgrown data garden, framed—not filled—by industrial containment details.

**DFII:** 13/15 (impact 4, context fit 5, feasibility 5, performance safety 5, consistency risk 6). The memorable anchor is a dark garden aisle where teal data markers and amber containment marks emerge between deep-green tree canopies. This avoids the previous visual noise by making the route, not the prop density, the dominant composition.

## Current-state findings

- The screenshot’s clutter comes from competing bright zone fills, full-strength grid lines, repeated prop rows, and barrels visually sitting inside ordinary play lanes.
- `js/map.js` already provides static terrain caching, world-space viewport culling, shared `_mapNow`, and deterministic canvas animation. Use these paths; do not add a DOM layer, sprite sheet, extra particle collection, or a per-frame object allocation.
- `drawZoneFloors()` already emits four ambient dots per zone. Do not increase this count. Garden life must come from the tree/server draw pass instead.
- `drawTree()` currently has a 2.0-second sparkle and an alpha of `0.55`; lower it to the requested 4.8-second, `0.35` maximum treatment.
- Architectural smell: dynamic floor borders and labels currently compete with the cached zone floors; the new containment treatment should consolidate their visual hierarchy rather than introducing another bright boundary language.

## Required visual system

### Palette and layer budget

Use these values as configuration tokens; do not scatter equivalent literal colors through draw methods.

| Role | Value | Use |
| --- | --- | --- |
| arena charcoal | `#080C12` | containment underlay, wall bodies, label-pill background |
| panel charcoal | `#0D1117` | server faces and contained-zone insets |
| command amber | `#F59E0B` | Citadel / command routes and containment pulse |
| hazard orange | `#F97316` | barrels, Co-op route, destructible warning only |
| data teal | `#22D3EE` | Server Farm, garden data markers, cool containment segment |
| foliage green | `#4ADE80` | leaf highlight, garden label, foliage glow |
| dark leaf | `#243D0E` | tree midtone, solid-cover outline |

Set the static terrain to the following maximum opacities. These values intentionally sit below combat, player, projectile, and interaction layers.

| Surface | floor alpha | grid alpha | border / label alpha |
| --- | ---: | ---: | ---: |
| global hex | `0.04` fill | `0.12` stroke | n/a |
| Server Farm | `0.10` | `0.14` | teal `0.18` base, `0.26` at pulse peak |
| Archives | `0.12` | `0.14` | amber `0.18` base, `0.26` at pulse peak |
| Courtyard | `0.10` | `0.12` | green `0.16` base, `0.22` at pulse peak |
| Lecture halls | `0.10` | `0.12` | retain violet only at `0.16` maximum |
| Database / Co-op | `0.10` | `0.12` | amber/orange `0.18` maximum |

Use `#0D1117` at alpha `0.72` for label-pill fills and accent text at alpha `0.88`; text must never be drawn below a 4.5:1 effective contrast against its pill. Keep labels `11px bold monospace` or larger, so they remain readable at the current camera scale.

### Courtyard placement table

All coordinates are world-space `MapObject(x, y, 50, 50, type, options)` top-left positions. They are fixed tables—no jitter. The table yields eight solid tree anchors, twelve decorative non-solid trees, and two decorative non-solid servers.

| Group | Coordinates |
| --- | --- |
| solid left grove | `(-520, 585)`, `(-405, 660)`, `(-500, 780)`, `(-350, 915)` |
| solid right grove | `(420, 560)`, `(300, 685)`, `(435, 780)`, `(320, 925)` |
| decorative left foliage | `(-550, 500)`, `(-450, 540)`, `(-340, 590)`, `(-545, 700)`, `(-430, 740)`, `(-315, 820)` |
| decorative right foliage | `(325, 525)`, `(455, 610)`, `(350, 760)`, `(475, 830)`, `(300, 900)`, `(460, 970)` |
| decorative data markers | `(-255, 690, 40, 70, server)`, `(215, 835, 40, 70, server)` |

Preserve a clear north entrance `x = -80…80, y = 400…560` (160 world units) and the main garden route `x = -120…120, y = 560…1050` (240 world units). Do not place barrels, vending machines, labels, or containment marks inside either clearance rectangle. Keep the already approved barrel positions: `(1020,-410)`, `(-1020,-410)`, `(800,520)`, and `(-1020,520)`.

The decorative props need no collision cell and must not be a collision-testing fallback. They retain the normal renderer and light; however, give them a static `decorative` render alpha of `0.68`, with a leaf-hex alpha of `0.26` and shadow alpha of `0.14`. Solid tree anchors remain at full alpha with a `2px` dark-leaf outline and foliage highlight alpha `0.80`. This makes cover readable without making decorative vegetation look disabled or creating a new iconography system.

### Containment and motion

Draw containment as non-colliding terrain accents, behind all map props, not as `MapObject`s:

- Courtyard north edge: amber rails `(-600, 418)→(-100, 418)` and `(100, 418)→(600, 418)`, leaving the 200-unit visual entry opening centered on the real 160-unit collision-clear opening.
- Courtyard side rails: teal `(-588, 480)→(-588, 1025)` and `(588, 480)→(588, 1025)`.
- Use 2 world-pixel lines, a `6px` maximum glow blur, inset 12 units from zone edges, with no corner nodes, warnings, text, or barriers. The absence of visual fixtures on the central route is deliberate negative space.

Keep all animation phase-driven from `_mapNow`, with no randomness in draw calls and no allocation of particle records:

- Amber/teal containment infrastructure: 2.4s sinusoidal pulse, `easeInOutSine`; alpha `0.14→0.26`, never more than `6px` blur.
- Foliage glow: 3.6s sinusoidal pulse, `easeInOutSine`; alpha `0.16→0.28`; apply only to the existing outer leaf stroke/highlight.
- Three existing leaf sparkles: 4.8s phase cycle, alpha `0.10→0.35`, radius `2px`; use a deterministic phase derived from tree coordinates.
- Decorative server LEDs use the same 2.4s infrastructure period at 60% of a solid server’s glow; keep the existing light source count and cached lighting cadence unchanged.

## Readability and acceptance constraints

- Maintain the render order: terrain/containment → map props → entities/projectiles → HUD. Terrain may never cover bullets, enemies, telegraphs, or labels.
- Non-solid foliage and servers must be absent from `_staticGrid`, `queryNearby()`, collision resolution, and `isBlocked()`, while still being included in sorted drawing and lighting.
- Barrels remain the sole hazard-orange prop category. Keep 180+ world-unit distance from garden routes and landmark approaches; never use orange for a decorative garden item.
- Do not use color alone for destructibility or collision. Barrels keep their existing striped silhouette; solid tree anchors differ through stronger silhouette/outline, not a red/green-only distinction.
- At the normal gameplay zoom, retain a 24px screen-space clean band around the player silhouette and target health bars. If a decorative prop would enter it, the normal viewport cull/order must let the actor layer read over the prop; do not add an occluding foreground effect.
- Respect `prefers-reduced-motion` if canvas preference support already exists; otherwise, keep the above pulses subtle enough that freezing `_mapNow` leaves a fully readable static map.

## Implementation verification

1. Assert exact courtyard counts (8 solid trees, 12 decorative trees, 2 decorative servers) and clearance for both route rectangles.
2. Assert every decorative prop draws but is excluded from `_staticGrid`, `queryNearby`, and collision checks.
3. Inspect the map at the default game camera. The central route must be the first perceptual read; Citadel, Server Farm, and Co-op paths must remain more visually prominent than courtyard decoration.
4. Confirm containment remains behind objects/entities and all dynamic effects are deterministic, culled, and allocation-free at 60 FPS.
