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

`drawGame()` in `js/game.js` owns the pass order:

1. background and camera transform
2. terrain, map objects, decals, and low-HP world guide
3. powerups and `specialEffects`
4. drone and player
5. enemy list and boss
6. projectiles, particles, floating text, orbital effects, hit markers, weather
7. lighting pass
8. screen-space overlays: day/night HUD, slow-mo, glitch, wave events, domain overlays
9. `CanvasHUD` with `UIManager.draw` fallback
10. `TutorialSystem.draw` last

When adding a new visual feature, decide first whether it belongs to:
- world pass
- lighting pass
- overlay pass
- HUD pass
- tutorial-last pass

---

## 4. Dispatcher structure

- `PlayerRenderer.draw(entity, ctx)` dispatches by player subtype.
- `BossRenderer.draw(entity, ctx)` dispatches by boss subtype and `BossDog`.
- `EnemyRenderer.draw(entity, ctx)` dispatches `MageEnemy`, then `TankEnemy`, then generic `Enemy`, then `PowerUp`, then optional fallback `draw()`.
- `ProjectileRenderer.drawAll(projectiles, ctx)` renders projectile state owned elsewhere.

Dispatch depends on class identity and load order. Constructor globals must exist before draw begins.

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
- `EnemyRenderer.draw()` temporarily binds `window.CTX` so shared helpers and fallback draw paths can render correctly.
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
