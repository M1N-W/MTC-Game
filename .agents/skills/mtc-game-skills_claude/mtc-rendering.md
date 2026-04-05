---
name: mtc-rendering
description: >
  Rendering architecture patterns for MTC The Game. Use when modifying drawGame,
  canvas layering, renderer dispatch, viewport culling, renderer caches, map terrain
  caches, lighting, HUD boundaries, or update-versus-draw separation.
---

# MTC Rendering - Architectural Patterns

This skill documents stable rendering structure only.
It excludes balance values, visual tuning constants, and release-specific art adjustments.

The coverage was revised using skill-creator principles:

- keep only stable structure
- document hidden dependencies that are costly to rediscover
- avoid volatile numbers and feature lists

---

## 1. Frame lifecycle ownership

- `js/game.js` owns `gameLoop`, `updateGame`, and `drawGame`.
- Simulation is advanced only in allowed loop modes.
- Rendering always flows through `drawGame` using the latest finalized simulation snapshot.

Loop-mode implications:

- hit-stop can draw without updating gameplay
- tutorial can update tutorial state without advancing the full gameplay state
- pause draws without simulation
- game over stops the gameplay RAF loop

Do not assume every visible frame ran a full gameplay update.

---

## 2. Hard separation: update versus draw

- `update(...)` mutates world state.
- `draw(...)` and renderer entry points consume state and write pixels only.

Draw code must not:

- mutate entity HP, cooldowns, score, phase, wave state, or AI state
- mutate gameplay arrays such as `window.enemies`, `window.specialEffects`, or projectile collections
- advance timers that affect simulation

Renderer-local caches are allowed when they do not feed back into gameplay decisions.

---

## 3. Canonical draw order

`drawGame()` in `js/game.js` owns the pass order:

1. background fill and camera transform
2. `mapSystem.drawTerrain(...)`
3. debug grid when enabled
4. meteor zone telegraphs
5. `mapSystem.draw()`
6. world landmarks such as database server and shop
7. decals and shell casings
8. low-HP world guide
9. powerups and `specialEffects`
10. drone and player
11. enemy list and boss
12. projectiles, particles, floating text, orbital effects, hit markers, and weather
13. lighting pass
14. screen-space overlays such as day or night, slow-mo, glitch, wave events, and domain overlays
15. `CanvasHUD` with `UIManager.draw` fallback
16. `TutorialSystem.draw` last

When adding a new visual feature, place it deliberately in one of those passes.

---

## 4. Dispatcher structure

- `PlayerRenderer.draw(entity, ctx)` dispatches by player subtype.
- `BossRenderer.draw(entity, ctx)` dispatches by boss subtype and `BossDog`.
- `EnemyRenderer.draw(entity, ctx)` dispatches by subtype order.
- `ProjectileRenderer.drawAll(projectiles, ctx)` renders projectile state owned elsewhere.

Dispatch depends on:

- constructor identity
- `instanceof` order
- script load order

Constructor globals must exist before draw begins.

---

## 5. Batching and pass organization

The codebase uses pass-level batching rather than GPU-style batching:

- world entities are grouped by pass in `drawGame`
- projectiles, particles, floating text, weather, decals, and shell casings each have manager-owned draw passes
- viewport culling happens before expensive draw work
- world-space drawing completes before the lighting and HUD passes

This architecture favors predictable layering and minimal cross-pass mutation.

---

## 6. Resource management and caches

- `EnemyRenderer` owns a static body sprite cache.
- `BossRenderer` owns offscreen bitmap caches.
- `MapSystem` owns the static terrain cache canvas.
- `MapSystem` also owns the lighting canvas used by `drawLighting(...)`.
- Pooled managers such as projectiles, particles, floating text, decals, shell casings, and weather are updated outside draw and rendered read-only during draw.

Keep cache ownership on renderer modules or dedicated managers, not on gameplay entities.

---

## 7. Hidden rendering dependencies

- `worldToScreen`, `CANVAS`, `CTX`, and constructor globals must exist before any renderer executes.
- `EnemyRenderer.draw()` temporarily binds `window.CTX` so shared helpers and fallback draw paths can render correctly.
- `drawGame()` depends on shared runtime surfaces such as `window.player`, `window.enemies`, `window.boss`, `window.specialEffects`, and manager singletons.
- `mapSystem.drawLighting(...)` depends on projectile lists, player state, landmark lights, camera transforms, and screen shake.
- `CanvasHUD.draw()` is the primary HUD owner.
- `UIManager.draw()` remains a compatibility fallback.
- `TutorialSystem.draw()` must remain last.

---

## 8. Coverage gaps this skill now closes

Structural items that were easy to miss before:

- `MapSystem` now owns both terrain caching and lighting caching
- HUD rendering has a primary path and a fallback path
- lighting is a distinct post-world pass, not an entity responsibility
- render dispatch depends on constructor availability and subtype order, not only on method names
- draw ordering is coupled to manager-owned passes outside renderer classes

---

## 9. Safe pattern for new rendering work

1. Place the feature in the correct render pass.
2. Read simulation state only.
3. Add culling before expensive work when relevant.
4. Keep cache ownership local to renderers or managers.
5. Document any new hidden cross-file dependency if rendering now relies on shared state outside the owning module.
