# UX Pass Test Audit

## Current test harness

- `tests/ui_smoke.py` is a synchronous Playwright smoke suite. It requires a separately started static server at `http://localhost:8765`; `npm run test:smoke` only invokes the Python script.
- It checks boot invariants, character-selection CSS contracts, skill-registry helpers, the Biotech map's current non-solid props, map-cache invalidation, courtyard clearance, and one zero-distance collision recovery case.
- There is no JavaScript unit-test runner, screenshot baseline, browser-zoom matrix, or performance harness. Add assertions to `ui_smoke.py` unless a focused Node test harness is introduced deliberately.

## Required test additions

### 1. Enemy passage and recovery

- Add a deterministic simulation for each live enemy constructor/archetype that is expected to call `Entity._steerAroundObstacles()`. Use one shared map fixture with: a single box, a 90-degree corner, a 72--96 px gap between two props, and the two solid courtyard groves.
- Start every fixture both centered in the gap and offset toward each left/right face. Step `enemy.update(1 / 60, player)` plus `map.update([enemy], 1 / 60)` for 90 frames. Assert the enemy is not colliding, changes quadrant/forward distance by at least one radius, and does not remain in contact for more than 12 consecutive frames.
- Repeat with `id` parity 0 and 1 so both deterministic tangent directions escape. Assert the five-probe buffer/query result is reused: no map-object full scan and no new persistent per-enemy collections.
- Preserve a direct `MapObject.resolveCollision()` test for a center-inside-AABB contact. Assert normal, cancelled into-surface velocity, and contact state are consistent before the next steering pass consumes them.

### 2. Single anomaly-gate lifecycle

- Unit-smoke `PortalSystem.spawn()` twice before collection. Assert `isActive()` remains true, the latest request is the only target retained, and `consumeTransition()` returns exactly once after one player overlap.
- Exercise `requestWavePortal(nextWave)` twice while clear-ready, then call the main wave-clear branch once. Assert one active gate, one terminal-log gate entry, one floating announcement, and no pending target.
- Move the player into the gate, tick transition, and assert exactly one `setWave`/`startNextWave` progression. Immediately tick another frame with no enemies and assert no replacement gate is spawned until the new wave becomes clear.
- Cover both normal and boss-wave `RunUpgradeSystem.offer()` paths: the selection callback advances once, and a cancelled/cleared run cannot leave a portal or pending target behind.

### 3. Camera, fixed 125% presentation, and pointer mapping

- Add a Playwright viewport matrix at 1280x720, 1536x864, and 1920x1080 with `device_scale_factor` 1 and 2. Use the selected 125% game presentation policy, rather than browser-native zoom (Playwright cannot reliably control the user's browser zoom).
- For each viewport, capture canvas CSS size, backing-store size, the effective game scale, and a world point projected with `worldToScreen()` then inverted by `screenToWorld()`. Assert the round trip is within 0.5 world units.
- Move the camera to at least three separated world locations, including the courtyard. Render two frames and assert every sampled map-object screen position changes by exactly the camera delta times the game scale, with no object-specific offset or double-scaling.
- Assert the canvas remains fully visible (no page scrollbars), HUD is screen-space, and world-layer drawing does not leak a CSS `transform`, browser `zoom`, or stale canvas dimensions after resize.

### 4. Crosshair and cursor contract

- Start a Kao run, move the mouse inside the canvas, and assert `getComputedStyle(document.body).cursor === 'none'` and `#gameCanvas` has no competing crosshair cursor while the phase is `PLAYING`.
- Move to the menu, game-over, and modal/shop states; assert the browser cursor is restored and buttons retain a usable pointer cursor.
- Add a public, test-only read-only crosshair snapshot (selected profile key, colors, radius, screen x/y) or a deterministic canvas pixel/screenshot assertion. Verify Kao selects the blue theme from `MTC_CROSSHAIRS`, tracks the mouse at the scaled canvas coordinate, and does not draw outside the canvas.
- Repeat one profile assertion for each character to prevent Kao fallback from masking a missing profile.

### 5. Notifications, labels, and anomaly-gate visual hierarchy

- Test `TerminalLog.push()` with repeated identical system events. The redesign should coalesce or replace duplicates; assert a single visible row per event key, bounded rows, newest-first/defined ordering, and `aria-live="polite"` remains set.
- Trigger a gate open, a run-upgrade offer, combat damage, and a skill instructional cue in the same frame. Query their screen rectangles and assert they do not intersect the HUD top, skill bar, terminal-log safe rectangle, or each other after the notification-layout pass.
- Screenshot the gate state at a fixed timestamp and canvas size. Assert the new multi-part gate has its interaction cue and label rendered once, uses the intended teal/amber palette, and has no DOM text over the canvas gate label.
- Add accessible DOM checks for all new instructional notifications: semantic status/alert role, non-empty text, no focus steal during combat, and dismissal/expiry cleanup.

### 6. Hijack and slow-motion usefulness

- Add scenario tests with controlled enemy count, enemy health, player energy, cooldown state, and one eligible hijack target. Assert the tutorial/notification offers a context cue exactly once per cooldown window; duplicate frames must not append duplicate notices.
- Trigger slow motion at sufficient energy: assert `timeScale` changes to `SLOW_MO_TIMESCALE`, energy drains on real time, the visual state activates, and a high-threat cue appears only when the chosen threat threshold is true. At low energy, assert it remains inactive and reports one warning.
- Trigger hijack under its intended threat/target condition. Assert target conversion/effect duration and damage or crowd-control result satisfy the tuned values; assert it neither fires without an eligible target nor repeats while cooldown/lock is active.
- If auto-cast is implemented, test manual override, one activation per qualifying encounter, priority when both skills qualify, and no auto-cast during paused/shop/tutorial/game-over phases.

### 7. Map visuals and performance guardrails

- Preserve the existing exact map-layout test but add sampled world/screen snapshot assertions for zone labels: every zone label is inside its zone's title-safe strip and does not overlap a major prop or another label at all supported scales.
- Instrument `MapSystem.queryNearby`, static-grid rebuild, sorted-object rebuild, and terrain cache creation through temporary counters exposed only in test mode. During 300 steady-state frames with a moving camera, assert no static-grid rebuild, no terrain-cache rebuild, and no map-wide collision scan.
- Take fixed seeded screenshots for overview and courtyard close-up. Gate visual comparisons on a small tolerance to catch reintroduced clutter, text overlap, and camera-relative map drift without making animation frames flaky.

## Likely regressions and constraints

- The present `PortalSystem` exposes only `isActive()` and `consumeTransition()`. Tests cannot observe spawn count, target, or render model without a small read-only snapshot/debug API; do not reach into closure state.
- `requestWavePortal()` guards an active portal, but duplicate log lines can still originate from repeated request/progression calls. A one-gate visual assertion alone will not detect duplicate user-facing messages.
- `MapSystem.queryNearby()` deliberately returns a reusable mutable array. Tests must consume/copy observations before another query; retaining that reference is a false-positive source.
- Existing enemy coverage only tests a bare `Entity` at zero distance, not the requested two-object approach, live enemy updates, or 1.5-second forward progress.
- `TerminalLog` currently appends every event and has no identity/coalescing semantics. The desired duplicate suppression needs a testable event key or dedupe policy, not string matching spread across callers.
- Native browser zoom is outside game-code control and conflicts with the viewport accessibility comment in `index.html`. Test a game-owned 1.25 rendering scale and coordinate conversion; retain user browser zoom unless product direction explicitly changes accessibility policy.
- `#gameCanvas` currently has `cursor: crosshair`, while `CrosshairSystem` hides only `document.body` during `PLAYING`. The canvas rule must be tested because it can override or reintroduce the browser cursor.
- Screenshots must freeze time/weather/particles or compare a clipped stable region. Current map, gate, slow-motion, and weather effects animate continuously.
- The map renderer already uses cached terrain, static-grid collision, object culling, and a dirty sorted-object buffer. Tests must fail any redesign that rebuilds these per frame or adds unbounded particles.

## Commands

```powershell
python -m http.server 8765
```

```powershell
npm run test:smoke
```

```powershell
node --check js/map.js
node --check js/game.js
node --check js/entities/base.js
node --check js/systems/PortalSystem.js
node --check js/systems/CrosshairSystem.js
node --check js/systems/TimeManager.js
git diff --check
```

For screenshot coverage, run Chromium headed once when updating approved baselines, then run the same Playwright checks headless in CI. Do not approve visual snapshots while browser zoom, OS text scale, canvas DPR, time, or weather are uncontrolled.
