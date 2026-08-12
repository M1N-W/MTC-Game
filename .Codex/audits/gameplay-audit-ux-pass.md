# Gameplay / UX Systems Audit — Biotech Data Commons Follow-up

## Pre-implementation risk sheet

| Area | Blast radius | Risk | Smallest safe delta |
| --- | --- | --- | --- |
| Enemy obstacles | Every enemy archetype and both boss subclasses inherit `Entity._steerAroundObstacles()`; map collision runs after entity movement. | A broad pathfinding rewrite would alter combat spacing and frame cost. | Keep the five probes and static-grid query. Persist a bounded contact recovery window, blend a deterministic tangent into the *next* desired velocity, then clear only after measurable forward progress. |
| Canvas scale and input | Camera, world/screen conversion, terrain cache, all canvas draw calls, pointer aim, and HUD share CSS-pixel assumptions. | Browser-controlled zoom cannot be set or locked by page JavaScript; a CSS transform would desynchronize rendering, culling, and aiming. | Do not attempt browser-zoom locking. Add a game-owned `renderScale = 1.25` camera transform only after one shared screen/world transform layer and pointer normalization exist. |
| Wave portal | Wave clear check, `PortalSystem`, pause/upgrade overlay, boss death callback, and terminal log. | A partial guard can still emit duplicate log entries or start a second portal while paused. | Make a single wave-transition state machine the authority: `idle → activeGate → rewardPending → advancing`. Gate every creation request and clear only when `_advanceToWave()` begins. |
| Data Hijack / Bullet Time | `InputSystem`, `BodySwapSystem`, `TimeManager`, player stats, tutorial, HUD, and run upgrades. | Automatic casting without strict eligibility can waste shared Time Energy or activate while an overlay is open. | First surface contextual, rate-limited prompts and a clear readiness indicator; then add conservative opt-in auto-use behind a player setting if still needed. |

Architecture smell: visual gameplay feedback is split across floating text, canvas alerts, terminal DOM lines, and a blocking HTML overlay, so the same event can be announced several times with no priority owner.

## Dependency and load order

`utils.js` owns canvas dimensions, `camera`, and screen/world conversion. `map.js` consumes those transforms for terrain cache and prop draw. `entities/base.js` provides probe avoidance; `enemy.js` sets desired velocity and then calls it. `game.js` moves entities first and only then calls `mapSystem.update()` collision resolution. `PortalSystem`, `BodySwapSystem`, and `RunUpgradeSystem` load before `game.js`; `TimeManager` and `WaveManager` load immediately before it. `CrosshairSystem` loads after input and before game.

Critical lifecycle today:

1. `gameLoop()` computes `scaledDt` from `GameState.timeScale`.
2. `updateGame()` updates portal and consumes its transition before `_tickEntities()`.
3. `RunUpgradeSystem.offer()` changes phase to `PAUSED`, but `updateGame()` continues executing the rest of that frame.
4. `_tickEntities()` sees no active portal and an empty wave, so it can request the same next-wave gate again.

## Confirmed root causes and minimal repairs

### 1. Enemy remains attached between adjacent props

`MapObject.resolveCollision()` correctly stores only primitive contact normal/frame after pushing an enemy out (`js/map.js:539-582`). On the next frame `EnemyBase._steerAroundObstacles()` adds a tangent to the current velocity (`js/entities/base.js:116-129`). However, each enemy update writes a new direct/AI velocity before steering (`js/entities/enemy.js:1438-1471`, and `moveByIntent()` for other types). Collision then runs after all entity updates (`js/game.js:759-766`) and cancels the inward AI component. With two contacts, the last rectangle processed overwrites `_mapContactN*`; the next-frame one-frame tangent is too weak and normal-only escape can repeatedly point the enemy back into the gap.

Repair `Entity` with allocation-free fields initialized once: last normal, recovery TTL, stable side sign, last recovery position, and no-progress timer. In collision, accumulate contacts for the frame instead of overwriting them (sum and normalize for a corner), refresh TTL, and retain the selected side by enemy id. In steering, apply recovery before the direct/AI blend is finalized, retain tangent while TTL is live, and only clear after the enemy has moved at least its radius away from the contact start. Preserve the existing five probes, nearby-object scratch list, and static grid. Do not add pathfinding.

### 2. Browser zoom and map/input drift

The game has no camera zoom; `camera` contains only `x/y` and uses `CANVAS.width/height` as world-visible dimensions (`js/utils.js:207-235`). Pointer coordinates use CSS pixels directly (`js/input.js:536-544`) rather than scaling by `CANVAS.width / rect.width` and `CANVAS.height / rect.height`. This is safe only when CSS and backing-store dimensions match. Any later render scale, browser/device zoom change, display scaling, or CSS sizing change breaks aim alignment. The terrain cache is extracted with camera pixel coordinates, so applying an isolated CSS or canvas scale would also make the cached floor and world props appear to slide differently.

Browsers deliberately do not expose a reliable API to force the user agent's 125% browser zoom. It also cannot improve game performance: it often increases raster work or reduces available viewport. Treat “125%” as an in-game visual scale target, not browser zoom.

Repair by introducing one immutable `CAMERA_RENDER_SCALE = 1.25` and four shared helpers: screen-to-world, world-to-screen, viewport world width/height, and event-to-canvas coordinates. Canvas resize must use the element rect multiplied by device pixel ratio (capped at the approved performance ceiling); input must normalize pointer position by backing-store/rect ratios. Every terrain-cache draw, cull, map prop, entity, portal, alert, and crosshair must use the same transform. Do not use CSS `transform: scale()` on the canvas and do not set page zoom.

### 3. Crosshair shows both native pointer and custom cursor

`CrosshairSystem` hides `document.body.style.cursor` while playing (`js/systems/CrosshairSystem.js:49-75`), but `#gameCanvas { cursor: crosshair; }` is a more specific child rule (`css/base.css:133-138`). The canvas pointer therefore remains visible. Kao's configured custom crosshair is also purple (`#a855f7`) instead of the requested character-blue palette.

Repair with a scoped game-state class on the canvas/body, e.g. `.is-playing #gameCanvas { cursor: none; }`, and restore it on menu, pause exit, blur, and teardown. Keep real HTML controls pointer-accessible. Change `kao-sight` to the established cyan/blue command color and use a blue ring/chevron silhouette instead of the generic purple ring. Verify the custom crosshair is rendered in canvas space after the shared scale transform.

### 4. Two anomaly gates and duplicate gate notices

`PortalSystem.update()` sets `_active = false` and `_pendingTransition = true` upon pickup (`js/systems/PortalSystem.js:40-52`). `updateGame()` immediately consumes the transition, and `RunUpgradeSystem.offer()` pauses the game (`js/game.js:273-286`, `js/systems/RunUpgradeSystem.js:222-258`). But `_tickEntities()` continues in that same update and its wave-clear condition sees `PortalSystem.isActive() === false`, then opens another gate (`js/game.js:560-581`). The screenshot’s duplicated `ANOMALY GATE OPEN -> WAVE 2` lines are this state gap, not two intended spawn coordinates.

Repair by replacing the loose active/pending booleans with a portal lifecycle state owned by `PortalSystem` or a dedicated `WaveTransitionSystem`. `requestWavePortal()` may create a gate only from `idle`; pickup moves to `rewardPending` before callbacks; the reward callback owns the only transition to `advancing`; `_advanceToWave()` resets to `idle` after `startNextWave()` starts. Make terminal announcement emission part of the successful `idle → activeGate` transition, so it is structurally once per target wave. Boss callbacks must use the same request path and never call `setWave/startNextWave` directly unless the portal subsystem is absent.

### 5. Hijack and Bullet Time have weak value communication

Data Hijack is hidden behind `F`, competes with the nearby-server admin interaction, requires a kill of one of a limited eligible set, expires after 4 seconds, consumes 40 shared Time Energy, and grants only 0–35% speed plus 0–25% damage for 6 seconds (`js/game.js:412-430`, `js/systems/BodySwapSystem.js:10-143`). The player gets no readiness prompt when a valid snapshot is captured. Bullet Time is only a global `T` key path; it consumes 24 energy/sec at a 0.30 time scale (`js/input.js:480-492`, `js/systems/TimeManager.js:8-14`). Its tutorial is one early scripted step, not a contextual combat signal (`js/tutorial.js:193-200`).

Minimal usability repair: add a single combat-director prompt channel with priority/deduplication, separate from terminal logs. On eligible kill, show `DATA HIJACK READY — F — 4s` with energy cost and transformed bonus; when 3+ hostile projectiles or a threatening close-range cluster is detected and energy is at least 20, show `BULLET TIME READY — T — 70% SLOW`. Each prompt may appear at most once per 12 seconds and must disappear on snapshot expiry, activation, pause, or death. Add visible readiness/cooldown/energy-state badges in the existing skill HUD. Retain manual activation in this change; any automatic use must be opt-in and must never activate during UI pauses or when the player has reserved energy for Hijack.

### 6. Gate visual quality is constrained by current renderer

The anomaly gate is currently two spinning partial arcs, four radial ticks, a translucent disk, and an Inter/Arial label (`js/systems/PortalSystem.js:54-108`). It has no stable spatial frame, destination metadata, activation state, or interaction affordance, so it reads as a generic spinning circle.

Use the already-available canvas stack for a compact **Containment Relay**: a stable hexagonal containment frame, teal data lattice, amber indexed destination plate (`WAVE N+1`), four fixed pylons, a gently moving inner aperture, and a single short proximity cue. Use mono/tactical typography already used in the HUD, world-scale culling, and no DOM element. Restrict motion to the aperture (2.4s ease-in-out) and a low-alpha scanline; retain the same trigger radius.

## Measurable exit criteria and tests

- Collision: each normal archetype plus bosses traverses a test pair of solid props, a corner, and a 160-unit corridor for 1.5 seconds. No entity intersects a solid AABB after resolution, remains within one radius of the same contact point for more than 0.35s while trying to move, or allocates per frame. Test both contact-order permutations.
- Scaling: at 100%, 125%, and device-pixel-ratio 1/2 emulation, aim ray and custom crosshair are within 1 backing-store pixel of the pointer; a stationary world prop remains at the same world coordinate through resize/render-scale recomputation; terrain cache and props use identical camera transforms.
- Cursor: hover gameplay canvas in PLAYING state shows only the character crosshair; hover any interactive HTML element shows its normal cursor; menu, pause, blur, and game-over restore the native cursor.
- Portal: clear a normal and boss wave, collect the gate, pause on upgrade choice for at least five seconds, then choose. Exactly one gate object and exactly one terminal gate entry exist per target wave; the next wave starts once; no gate can spawn while a reward is pending.
- Ability UX: capture an eligible enemy and verify one Hijack-ready prompt plus HUD state; activate/expire/block it and verify prompt removal. Create eligible slow-motion threat and verify one prompt; verify suppression below 20 energy, during pause, and during prompt cooldown.
- Quality/performance: `npm run test:smoke`, JavaScript syntax checks, `git diff --check`, and browser smoke/E2E at 60 FPS with zero new unbounded arrays, DOM nodes, timers, or particle systems in the gameplay loop.

## Rollback

Keep the existing render scale at `1.0` behind one constant and keep portal-state migration localized behind the current `PortalSystem` API (`spawn/update/draw/isActive/consumeTransition`). Reverting those two files restores previous visual scale and wave behavior without map data or save migration. Keep recovery tuning as constants so a bad navigation feel can be adjusted or disabled without touching collision geometry.
