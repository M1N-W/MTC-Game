---
name: mtc-rendering
description: >
  Rendering architecture patterns for MTC The Game. Use when modifying drawGame,
  canvas layering, renderer dispatch, viewport culling, renderer caches, lighting,
  HUD boundaries, or update-versus-draw separation.
---

# MTC Rendering - Architectural Patterns

This skill documents **stable rendering structure only**. It explicitly excludes volatile configuration parameters, visual balance values, and specific tuning parameters.

---

## 1. Hard Separation: Update vs. Draw

The application maintains an absolute bifurcation between logical simulation and visual rendering.

- **`update(dt)`**: Exclusively mutates game state, positions, timers, array inclusions, and logic boundaries.
- **`draw(ctx)`**: Exclusively queries read-only game state to plot visual manifestations on the Canvas 2D context.

**Strict Prohibition**:
Render paths (`drawGame`, `EnemyRenderer.draw`, etc.) must **never**:
- Spawn new active entities into gameplay arrays.
- Alter simulation values like `hp`, cooldowns, or current phase states.
- Mutate shared arrays (`window.enemies`, `window.specialEffects`, etc.).

---

## 2. The Deterministic Frame Pipeline

`drawGame()` (`js/game.js`) orchestrates the atomic rendering frame. It is split chronologically into two coordinate spaces.

### 2.1 World-Space Block (Camera Transformed)
Everything plotted here is subject to screen shaking and character tracking. Bound securely inside a `CTX.save()` and `CTX.translate()` wrap.
- Background and grid geometries.
- `mapSystem` terrains and structural zone limits.
- Entities (`decals`, `powerups`, `specialEffects`).
- Live Combatants (`drone`, `PlayerRenderer`, `EnemyRenderer`, `BossRenderer`).
- Airborne/particle payloads (`Projectiles`, `hitMarkers`).

### 2.2 Screen-Space Block (Absolute Projection)
`CTX.restore()` is called to destroy the camera transform. UI and post-processing run in standard screen coordinates.
- **Lighting Map**: `mapSystem.drawLighting(...)` receives the entity arrays but operates entirely decoupled from camera translations.
- Environment Overlays (`DayNightHUD`, visual glitches, `WaveEvent` banners).
- Core HUD (`CanvasHUD` bounding data).
- The `TutorialSystem` fallback (plotted at the absolute top layer).

---

## 3. Dispatch Routing and Context Rebinding

Renderers serve as static dispatchers enforcing execution contracts.

### 3.1 Strict Context Safety (`EnemyRenderer`)
`EnemyRenderer.draw(entity, ctx)` introduces a mandatory `try/finally` block that manages `window.CTX`.
- **Why?** It securely caches `window.CTX`, rebinds the global to the active `ctx` parameter, and guarantees restoration in the `finally` block.
- **Effect**: This creates a bulletproof mechanism ensuring any shared visual utility (or legacy fallback `entity.draw()` methods) correctly accesses the current rendering context without mutating it for siblings.

### 3.2 Dispatch Hierarchies (Load & Identity Coupling)
Dispatch checking intrinsically relates to constructor instances, thus maintaining a strict dependency on `index.html` loading orders.
- **PlayerRenderer Checks**: `AutoPlayer` → `PoomPlayer` → `KaoPlayer` → `PatPlayer`
- **BossRenderer Checks**: `KruFirst` → `KruManop` → `BossDog`
- **EnemyRenderer Boundary**: `EnemyRenderer` loads after `entities/enemy.js` and depends on `Enemy`, `TankEnemy`, `MageEnemy`, and `PowerUp` already being on the global scope before its `instanceof` dispatch runs.
*(Note: `KruFirst` sits higher than `KruManop` explicitly because both extend the same `BossBase`, necessitating strict hierarchical checking).*

---

## 4. Cache Ownership Architecture

Resource caching occurs strictly at the renderer level to prevent injecting UI bloat into combatant entities.
- **Locality**: Caches (e.g., `EnemyRenderer`'s static body sprites, `BossRenderer`'s offscreen composing bitmaps) exist locally within the renderer modules.
- Entities maintain string pointers (like `.type` or `.name`), but the pixels reside exclusively partitioned within the rendering system.
