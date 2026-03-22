---
name: mtc-rendering
description: >
  Rendering architecture patterns for MTC The Game. Use when modifying canvas render code,
  renderer dispatch, frame draw order, render caches, batching/loop strategies, viewport culling,
  HUD ownership boundaries, or draw/update separation constraints.
---

# MTC Rendering - Architectural Patterns

This skill documents stable rendering architecture only.
It excludes balance values, tuning constants, and release-specific visual tweaks.

---

## 1) Frame lifecycle ownership

### 1.1 Canonical frame contract

- `js/game.js` → `gameLoop` owns scheduling.
- **Simulation** runs in `updateGame` when the loop mode allows it.
- **Rendering** runs in `drawGame`, consuming the current simulation snapshot.

### 1.2 Loop modes affecting update vs draw

- **Hit-stop:** `updateGame` is skipped; `drawGame` still runs (freeze frame effect).
- **Tutorial (active):** `TutorialSystem.update` always; `updateGame` only when the tutorial step requires player action; then `drawGame`.
- **Paused:** `drawGame` only.
- **Playing (normal):** `updateGame` then `drawGame`.

Do not assume every `PLAYING` frame executes `updateGame`.

### 1.3 Phase separation (logical)

1. Input and simulation update (when scheduled).
2. World / entity rendering inside camera transform where applicable.
3. Screen-space overlays: lighting pass, day/night HUD, slow-mo overlay, glitch, wave-event overlays, domain/singularity draw hooks.
4. **CanvasHUD** (combo, minimap, warnings) — primary; `UIManager.draw` remains legacy fallback in `drawGame`.
5. **TutorialSystem.draw** — canvas tutorial overlay (spotlight / world pulse), after most world content.

---

## 2) Update/Draw Separation Rule

- `update()` mutates gameplay state.
- `draw()` / renderer entrypoints read state and write pixels.
- No authoritative gameplay mutations inside draw paths.

**Allowed in draw:** render-local caches, deterministic animation phase derived from `performance.now()` or frame dt passed as read-only, strict `ctx.save`/`restore` pairs.

**Not allowed:** HP/cooldown/score/wave mutations, entity physics writes for simulation, AI state mutation.

---

## 3) `drawGame` layer order (structural)

Order is defined in `drawGame()` in `js/game.js`:

1. Background gradient (full canvas).
2. Camera translate (screen shake offset).
3. Terrain (`mapSystem.drawTerrain`), grid, meteor zones, `mapSystem.draw`, database server draw, shop object draw.
4. Decals / shell casings (below entities).
5. Optional low-HP navigation guide (world-space line — visual only).
6. Powerups → `EnemyRenderer` where applicable.
7. `specialEffects` collection `draw()`.
8. `window.drone` draw.
9. `PlayerRenderer.draw(player)`.
10. **Enemies:** cull with `isOnScreen`; `BossDog` → `BossRenderer`, else `EnemyRenderer`.
11. Boss → `BossRenderer` if alive and on screen.
12. `ProjectileRenderer.drawAll` / projectile batch.
13. Particle and floating-text systems.
14. Orbital effects (character-specific hook), hit markers, weather.
15. Restore camera transform; then lighting pass (`mapSystem.drawLighting`) with projectile list for occlusion cues.
16. Day/night HUD, slow-mo overlay, glitch overlay, wave-event / domain / singularity draws.
17. `CanvasHUD.draw` (or `UIManager.draw` fallback).
18. `TutorialSystem.draw` last among canvas layers.

**Cross-cutting:** `CTX.save`/`restore` discipline around sub-passes; reset `globalAlpha` and other sticky state after world draws.

---

## 4) Dispatcher and type resolution

### 4.1 Boss / special enemy dispatch

- `BossRenderer` handles boss types and `BossDog` when detected in the enemy list.
- Branching uses `instanceof` / constructor identity — class definitions must be loaded before `drawGame` runs.

### 4.2 Player dispatch

- `PlayerRenderer.draw` switches on character implementation type.

### 4.3 Projectile and particle systems

- `projectileManager` and `particleSystem` are shared pools mutated in `updateGame` and read-only in draw.
- Rendering must not enqueue new simulation events; spawn paths belong in update / combat code.

---

## 5) Batching and loop efficiency patterns

### 5.1 Culling-first strategy

- Call `isOnScreen` (or equivalent) before running heavy per-entity draws.

### 5.2 Draw-loop determinism

- Avoid `Math.random()` in draw paths for gameplay-affecting visuals.
- Prefer deterministic oscillation from `performance.now()` or a frame `dt` passed in.

### 5.3 Context state hygiene

- Pair `ctx.save()` / `ctx.restore()`.
- Reset `globalAlpha`, `shadowBlur`, `lineDash`, and similar after use.

---

## 6) Resource management and render caches

### 6.1 Cache ownership

- Renderer-owned caches belong on renderer modules or static renderer state — not on gameplay entities.

### 6.2 Invalidation

- Invalidate when structural visual identity changes (character, phase, weapon mode), not every frame.

### 6.3 Background gradient cache

- `drawGame` caches a gradient object when canvas size or palette identity changes — pattern: avoid rebuilding every frame.

---

## 7) Cross-module rendering dependencies

### 7.1 CanvasHUD ownership

- `CanvasHUD` (`js/ui.js`) owns combo, minimap shell, and related canvas HUD. Entity renderers must not duplicate that responsibility.

### 7.2 Load-order dependencies

- Renderers require `worldToScreen`, `getCamera`, and constructor globals to exist.
- `TutorialSystem.draw` depends on `TutorialSystem` state updated in `update` / tutorial step logic.

### 7.3 Shared-state dependencies

- Renderers read `window.player`, `window.enemies`, `window.boss`, and manager singletons.
- `mapSystem` provides terrain + lighting APIs consumed in `drawGame`.

---

## 8) Documentation completeness (skill-creator checklist)

| Area | Status |
|------|--------|
| Frame pipeline ownership | Documented (`drawGame` + loop modes). |
| Update vs draw | Documented. |
| Concrete draw order | Documented (section 3). |
| Renderer types (Player/Boss/Enemy/Projectile) | Documented. |
| Pool / system coupling (projectiles, particles) | Documented. |
| HUD boundary (CanvasHUD vs entities) | Documented. |
| Hidden coupling | Implicit via globals and `mapSystem`; called out in section 7. |

**Residual gaps (inherent to codebase):** any future extract of `EnemyRenderer`/`drawGame` sub-steps should update section 3 in lockstep. Shader/post-process pipelines are not used (Canvas 2D only).

---

## 9) Safe pattern for new rendering features

1. Decide world pass vs overlay pass vs HUD pass using section 3.
2. Read simulation state only; mutate nothing authoritative.
3. Add culling before expensive work.
4. Keep `ctx` hygiene strict.
5. Document new cross-file dependency if it introduces implicit coupling.

---

## 10) Explicit exclusions

This rendering skill must not track:

- damage/cooldown/stat numbers
- config tuning values
- release-specific art tweak constants
- temporary effects tuning details

Keep this file architecture-stable across game updates.
