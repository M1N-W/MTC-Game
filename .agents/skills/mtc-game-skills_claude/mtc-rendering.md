---
name: mtc-rendering
description: >
  Rendering architecture patterns for MTC The Game. Use when modifying drawGame,
  canvas layering, renderer dispatch, viewport culling, renderer caches, lighting,
  HUD boundaries, or update-versus-draw separation.
---

# MTC Rendering - Architectural Patterns

This skill documents stable rendering structure only.
It excludes balance values, tuning constants, and release-specific visual tweaks.

---

## 1. Frame lifecycle ownership

- `js/game.js` owns `gameLoop`, `updateGame`, and `drawGame`.
- Simulation is advanced only in allowed loop modes.
- Rendering always flows through `drawGame` using the latest finalized simulation snapshot.

Loop-mode implications:
- hit-stop can draw without updating
- tutorial can update tutorial state without advancing the full gameplay state
- pause draws without simulation

Do not assume every visible frame ran a full gameplay update.

---

## 2. Hard separation: update versus draw

- `update(...)` mutates world state.
- `draw(...)` and renderer entry points consume state and write pixels only.

Draw code must not:
- mutate entity HP, cooldowns, positions for simulation, score, wave state, or AI state
- push into gameplay arrays such as `window.enemies`, `window.specialEffects`, or projectile collections

Renderer-local caches are allowed when they do not feed back into gameplay decisions.

---

## 3. Canonical draw order

`drawGame()` in `js/game.js` owns the pass order.
Passes 1–16 run **inside** a camera `CTX.save()/translate(shake)` block.
Passes 17 onward are **screen-space** (after `CTX.restore()` ends the world transform).

**World-space (inside camera transform):**

1. Background gradient fill
2. `mapSystem.drawTerrain()` — arena boundary, hex grid, zone auras, circuit paths, center landmark
3. `drawGrid()` — debug grid overlay
4. `meteorZones` visual indicators
5. `mapSystem.draw()` — walls, zone objects, MTC room
6. `drawDatabaseServer()`, `drawShopObject()` — interactive world objects
7. `decalSystem.draw()`, `shellCasingSystem.draw()` — floor-level battle scars
8. Low-HP navigation guide (animated dashed line to nearest heal source)
9. `powerups` via `EnemyRenderer`
10. `specialEffects` (drawn sequentially)
11. `drone.draw()`
12. `PlayerRenderer.draw(window.player, CTX)`
13. Enemy list — `EnemyRenderer.draw()` per enemy; `BossDog` instances route to `BossRenderer`
14. `BossRenderer.draw(window.boss, CTX)`
15. `ProjectileRenderer.drawAll()`, `particleSystem.draw()`, `floatingTextSystem.draw()`
16. `drawOrbitalEffects()`, `hitMarkerSystem.draw()`, `weatherSystem.draw()`
17. `CTX.restore()` — **camera transform ends here**

**Screen-space (outside camera transform):**

1. `mapSystem.drawLighting()` — receives full projectile array and landmark positions from caller
2. `drawDayNightHUD()`, `drawSlowMoOverlay()`, glitch effect
3. `drawWaveEvent()`, `DomainExpansion.draw()`, `GravitationalSingularity.draw()`
4. `CanvasHUD.draw()` with `UIManager.draw` as fallback
5. `TutorialSystem.draw()` last

When adding a new visual feature, decide first whether it belongs to:
- world pass (camera-translated, behind HUD)
- lighting pass (screen-space, no camera transform)
- overlay pass (screen-space vignettes/banners)
- HUD pass
- tutorial-last pass

---

## 4. Dispatcher structure

**`PlayerRenderer.draw(entity, ctx)`** — instanceof check order:
1. `AutoPlayer`
2. `PoomPlayer`
3. `KaoPlayer`
4. `PatPlayer`
5. generic `Player` fallback

**`BossRenderer.draw(entity, ctx)`** — instanceof check order:
1. `KruFirst` (checked before `KruManop` because both extend `BossBase`)
2. `KruManop`
3. `BossDog`

**`EnemyRenderer.draw(entity, ctx)`** — instanceof check order:
1. `MageEnemy`
2. `TankEnemy`
3. generic `Enemy`
4. `PowerUp`
5. optional fallback `e.draw()` (e.g. `GoldfishMinion`, future minions)

**`ProjectileRenderer.drawAll(projectiles, ctx)`** delegates to each projectile's own `draw()` method.

Dispatch depends on class identity and load order. Constructor globals must exist before draw begins.
Note: `BossDog` instances in the enemies array route to `BossRenderer`, not `EnemyRenderer`.

---

## 5. Batching and loop efficiency

The codebase uses loop-level batching rather than GPU-style batching:

- world entities are grouped by pass in `drawGame`
- projectiles, particles, floating text, and weather each have manager-owned draw passes
- viewport culling happens before expensive draw work
- `window.specialEffects` is updated in-place and then drawn sequentially

This architecture favors predictable pass ordering and minimal cross-pass mutation.

---

## 6. Resource management and caches

- `EnemyRenderer` owns a static body sprite cache keyed by visual identity.
- `BossRenderer` owns an offscreen bitmap cache for reusable body parts.
- pooled managers such as projectiles, particles, decals, and floating text are updated outside draw and rendered read-only during draw.
- the lighting pass is centralized in `mapSystem.drawLighting(...)` rather than being embedded in entity renderers.

Keep cache ownership on renderer modules or dedicated managers, not on gameplay entities.

---

## 7. Hidden rendering dependencies

- `worldToScreen`, `CANVAS`, `CTX`, and constructor globals must exist before any renderer executes.
- `EnemyRenderer.draw()` saves the current `window.CTX`, rebinds it to the active `ctx` parameter, and restores in a `try/finally` block. This is required so fallback `e.draw()` paths and shared helpers can reach the canvas context without an explicit argument.
- **Lighting is outside the camera transform**: `mapSystem.drawLighting()` is called after `CTX.restore()` ends the world-space translate. It receives the full projectile array and static landmark positions as arguments from the `drawGame()` caller.
- `drawGame()` depends on shared runtime surfaces such as `window.player`, `window.enemies`, `window.boss`, `window.specialEffects`, and manager singletons.
- HUD ownership belongs to `CanvasHUD`; entity renderers must not duplicate HUD responsibilities.

---

## 8. Coverage audit using skill-creator principles

Covered structural areas:
- frame ownership and loop modes
- update/draw separation
- concrete pass ordering
- renderer dispatch responsibilities
- cache ownership
- cross-file rendering dependencies

Important non-obvious dependencies now called out:
- `EnemyRenderer` relies on temporary `window.CTX` rebinding
- lighting is an external pass owned by `mapSystem`
- manager-owned draw passes are intentionally separated from entity renderers

Keep this file concise. Add only stable rendering structure, not volatile art tuning.

---

## 9. Safe pattern for new rendering work

1. Place the feature in the correct pass.
2. Read simulation state only.
3. Add culling before expensive work when relevant.
4. Keep cache ownership local to renderers or managers.
5. Document any new hidden cross-file dependency if rendering now relies on new shared state.
