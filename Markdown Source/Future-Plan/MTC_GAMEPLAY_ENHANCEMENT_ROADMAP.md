# MTC Gameplay Enhancement Roadmap

## Boundary

This roadmap keeps MTC The Game as MTC The Game.

Adventua is a mechanics reference only. It must not rename Kao, Auto, Poom, Pat,
replace the school-survival/campus tone, or convert maps into Isekai domains.

Do not add `BRAVER_PROFILES`, `ADVENTUA_LEVELS`, `GAME_TEXTS.adventua`, Braver
titles, or Adventua story beats to runtime code. New systems must be adapted to
the current MTC universe: school pressure, campus survival, digital anomalies,
teacher bosses, and cute-colorful arcade action.

## Current Architecture Baseline

- Runtime stack: vanilla JavaScript, global script tags, HTML5 Canvas 2D, DOM UI.
- Entry surfaces: `index.html`, `Debug.html`, and `sw.js` must stay in sync for
  every new runtime file.
- Main loop: `js/game.js` owns `gameLoop`, `updateGame(dt)`, and `drawGame()`.
- Input: `js/input.js` owns mouse state. Desktop aim uses `mouse.wx/mouse.wy`;
  mobile aim must keep using the existing joystick path.
- Player facing: `PlayerBase.update()` already rotates toward the current aim
  point. New crosshair rendering must not replace this logic.
- Wave flow: `WaveManager` and `GameState` own enemy/boss/wave state. Portal
  progression must attach at the wave-clear boundary instead of bypassing it.
- Time system: `js/systems/TimeManager.js` already exists. Energy tuning must
  extend it instead of creating a second slow-motion manager.
- Rendering split: renderer-only systems draw from finalized state. Update
  systems mutate state. Draw functions must not mutate gameplay state.

## Dirty Worktree Warning

Before implementation, inspect `git status --short`.

Known release surfaces for these mechanics:

- `index.html`
- `Debug.html`
- `sw.js`
- `js/game.js`
- `js/balance.js`
- `js/game-texts.js`
- `Markdown Source/CHANGELOG.md`
- `Markdown Source/Information/PROJECT_OVERVIEW.md`

Do not revert unrelated dirty files. If a file is already dirty, patch only the
smallest relevant block.

## Creative Directions

1. Digital School Tech
   - Visuals: cyan `#22d3ee`, purple `#a855f7`, warning red `#ef4444`.
   - Timing: crosshair pulse 0.12 s ease-out, portal ring loop 1.2 s linear.
   - Assets: 64x64 crosshair atlas cells, 128x128 portal ring frames.

2. Cute Campus Arcade
   - Visuals: mint `#86efac`, yellow `#facc15`, pink `#fb7185`.
   - Timing: emote pop 0.18 s `backOut`, dialogue slide 0.16 s ease-out.
   - Assets: 48x48 Kenney-style emote bubbles, 32x32 pickup icons.

3. Glitch Survival
   - Visuals: teal `#14b8a6`, magenta `#d946ef`, black alpha `rgba(2,6,23,0.72)`.
   - Timing: portal distortion 0.08 s jitter, bridge flicker 0.5 s sine pulse.
   - Assets: 96x96 glitch tear frames, 16x16 bridge collision tiles.

Recommended direction: Digital School Tech, because it fits MTC's existing
glitch waves, Firebase/cloud UI tone, and teacher-boss sci-fi moments without
changing the story identity.

## Architecture Smells To Watch

- Global load order is fragile; every new singleton must load before `game.js`
  and after any dependency it reads.
- Wave clear and wave advance are currently tightly coupled; portal flow needs
  a small explicit waiting state.
- Several systems expose globals directly; new systems should keep narrow public
  methods and internal private state.
- DOM UI can leak nodes if dialogue/emote logs append without caps.
- Canvas effects can allocate each frame if particles, emotes, or portal rings
  create throwaway objects in `update()` or `draw()`.

## Exit Criteria

- Performance: 60 FPS target on desktop, no per-frame allocations in new
  crosshair, portal, emote, or bridge update paths.
- Stability: no uncapped arrays; removals use swap-pop or bounded queues.
- Rendering: viewport culling for visible-only effects.
- Architecture: logic/update functions contain no canvas drawing calls; draw
  functions contain no gameplay mutation.
- Test coverage: `node --check` for touched JS and smoke test for load order.
- Rollback: each feature can be disabled by removing one script tag and its
  corresponding config hook.

## Milestone 1: Mechanics-Only Crosshair System

### Goal

Add a custom mouse crosshair per current MTC character while preserving all
existing character names and abilities.

### Config

Add this to `js/balance.js` near other runtime constants:

```js
const MTC_CROSSHAIRS = Object.freeze({
    kao: Object.freeze({ key: 'kao-sight', color: '#a855f7', accent: '#f0abfc' }),
    auto: Object.freeze({ key: 'wanchai-sight', color: '#ef4444', accent: '#facc15' }),
    poom: Object.freeze({ key: 'sticky-rice-seal', color: '#22c55e', accent: '#bbf7d0' }),
    pat: Object.freeze({ key: 'katana-focus', color: '#7ec8e3', accent: '#e0f2fe' }),
});
window.MTC_CROSSHAIRS = MTC_CROSSHAIRS;
```

### Public Interface

```js
window.CrosshairSystem.init();
window.CrosshairSystem.update(dt);
window.CrosshairSystem.draw(ctx);
window.CrosshairSystem.setCrosshair(key);
window.CrosshairSystem.clear();
```

### Integration Steps

1. Create `js/systems/CrosshairSystem.js`.
2. Load it after `js/input.js` and before renderer/game systems in both
   `index.html` and `Debug.html`.
3. Initialize it after `InputSystem.init()`.
4. Call `CrosshairSystem.update(dt)` after `updateMouseWorld()`.
5. Call `CrosshairSystem.draw(CTX)` near the end of world rendering and before
   HUD overlays.
6. Call `CrosshairSystem.clear()` when a run ends or returns to menu/game over.
7. Hide the browser cursor only while `GameState.phase === 'PLAYING'`.

### Code Pattern

```js
function _initGameUI(charType) {
    if (typeof CrosshairSystem !== 'undefined') {
        const profile = window.MTC_CROSSHAIRS && window.MTC_CROSSHAIRS[charType];
        CrosshairSystem.setCrosshair(profile?.key || 'kao-sight');
    }
}
```

### Performance Budget

- O(1) update.
- No object allocation in `update()` or `draw()`.
- Draw only when gameplay is active.

## Milestone 2: Portal Wave Flow

### Goal

Stop auto-advancing the wave immediately after clear. Spawn an MTC-styled
digital portal or school-tech dimensional tear. Advance only when the player
enters it.

### Public Interface

```js
window.PortalSystem.spawn({ x, y, targetWave, mapId });
window.PortalSystem.update(dt, player);
window.PortalSystem.draw(ctx);
window.PortalSystem.clear();
window.PortalSystem.isActive();
window.PortalSystem.consumeTransition();
```

### MTC Adaptation

- Portal label: "ANOMALY GATE" or localized MTC equivalent.
- Visual style: glitchy cyan-purple ring with small classroom grid fragments.
- Story usage: school/campus anomaly, not fantasy realm travel.

### Integration Steps

1. Find the wave-clear branch where enemies, boss, trickle enemies, and spawn
   queues are fully empty.
2. Replace immediate `setWave()` plus `startNextWave()` with
   `PortalSystem.spawn()`.
3. Add `GameState.phase` or a small flag for "WAITING_PORTAL" if needed.
4. On player overlap, clear portal and call the existing next-wave transition.
5. Keep boss clear, shop, achievement, and save hooks in the same order unless
   the code requires an explicit split.

### Code Pattern

```js
function maybeSpawnWavePortal() {
    if (typeof PortalSystem === 'undefined') return;
    if (!WaveManager.isWaveCleared()) return;
    if (PortalSystem.isActive()) return;

    PortalSystem.spawn({
        x: mapSystem.getSafeCenterX(),
        y: mapSystem.getSafeCenterY(),
        targetWave: GameState.wave + 1,
        mapId: mapSystem.currentMapId || 'campus',
    });
}
```

### Performance Budget

- One active portal at a time.
- No array growth.
- Draw path culls when off-screen.

## Milestone 3: Time Manipulation Energy

### Goal

Refine existing slow motion into a clear energy resource without replacing
`TimeManager`.

### Config

```js
const MTC_TIME_ENERGY = Object.freeze({
    maxEnergy: 100,
    drainPerSecond: 24,
    rechargePerSecond: 16,
    minActivateEnergy: 20,
    slowScale: 0.30,
});
window.MTC_TIME_ENERGY = MTC_TIME_ENERGY;
```

### Integration Steps

1. Audit `TimeManager` current energy/drain behavior.
2. Move tunables into `balance.js`.
3. Add HUD readout through existing HUD surfaces.
4. Ensure hit-stop, pause, and game-over do not drain energy.

### Performance Budget

- O(1) update.
- No DOM write every frame unless value bucket changed.

## Milestone 4: Body Swap

### Goal

Let the player temporarily control an eligible recently defeated enemy body,
adapted to MTC enemy types.

### Public Interface

```js
window.BodySwapSystem.capture(enemy, killer);
window.BodySwapSystem.canSwap(player);
window.BodySwapSystem.activate(player);
window.BodySwapSystem.update(dt, player);
window.BodySwapSystem.cancel(player);
window.BodySwapSystem.clear();
```

### Rules

- Store only one recent eligible enemy snapshot.
- Snapshot expires after a short window, e.g. 4.0 s.
- Exclude bosses, summons, projectiles, and unstable special entities.
- Restore original player body after duration or lethal damage.
- Keep score, achievements, and damage ownership attributed to the player.

### Code Pattern

```js
const BODY_SWAP_ELIGIBLE = Object.freeze({
    basic: true,
    charger: true,
    hunter: true,
    sniper: true,
    bomber: false,
    healer: false,
});
```

### Performance Budget

- One snapshot object reused internally.
- No cloning full enemy instances.
- O(1) activation and cancel path.

## Milestone 5: System Alerts And Terminal Log

### Goal

Make status overlays affect entity logic and record important scene messages in
a capped DOM terminal log, using MTC's school-tech tone.

### Public Interfaces

```js
window.AlertSystem.emit(entity, key, options);
window.AlertSystem.update(dt);
window.AlertSystem.draw(ctx);
window.AlertSystem.clear();

window.TerminalLog.push({ sender, text, type });
window.TerminalLog.clear();
```

### Config

```js
const MTC_ALERTS = Object.freeze({
    overclock: Object.freeze({ duration: 1.8, speedMult: 1.18, label: '[OVERCLOCK]' }),
    warning: Object.freeze({ duration: 1.2, label: '[WARNING]' }),
});
window.MTC_ALERTS = MTC_ALERTS;
```

### Integration Steps

1. Emit `warning` when energy or ammo-equivalent resources are low.
2. Emit `overclock` when selected enemies enter chase or boosted states.
3. Apply temporary modifiers in update logic, not in draw code.
4. Cap terminal entries, e.g. 6-8 visible and no retained hidden backlog.
5. Reuse DOM nodes or replace in capped batches to avoid leaks.

### Performance Budget

- Active emote array is hard-capped.
- Expired removals use swap-pop.
- Dialogue DOM updates happen only when a new entry is pushed.

## Milestone 6: Projectile Bridges

### Goal

Allow specific projectiles to create temporary bridges over safe obstacle gaps.

### Public Interface

```js
window.BridgeSystem.tryCreateBridge(projectile, hitInfo);
window.BridgeSystem.update(dt);
window.BridgeSystem.draw(ctx);
window.BridgeSystem.clearAll();
```

### Integration Steps

1. Mark only Kao sniper critical projectiles as bridge-capable.
2. Detect bridge-capable projectile hits against standard internal obstacle objects, excluding critical MTC objects.
3. Store hard-capped bridge rectangles with TTL in `BridgeSystem`.
4. Modify wall collision checks to ask `BridgeSystem` for passable overlays.
5. Keep bridge draw separate from bridge collision mutation.

### Performance Budget

- Hard cap active bridges, e.g. 8.
- Collision check uses a small bounded list.
- Bridge draw is culled by camera viewport.

## Milestone 7: Roguelike Upgrades And Boss Powers

### Goal

Offer random run upgrades on level-up and unlock special powers/items from MTC
boss progression without replacing existing passive unlocks.

### Public Interface

```js
window.RunUpgradeSystem.offer(player);
window.RunUpgradeSystem.apply(player, upgradeId);
window.RunUpgradeSystem.clearRun();
```

### Foundation Implementation Notes

- Runtime file: `js/systems/RunUpgradeSystem.js`.
- Flow: portal transition pauses at a 3-choice system patch overlay before the
  next wave starts.
- Boss clears pass a boss-wave context into the same overlay and draw from a
  high-tier boss-data extraction pool.
- Upgrade UI is DOM-only, event-driven, and removed immediately after selection.
- Run reset calls `clearRun()` so Time Energy and Data Hijack tuning cannot
  bleed into a new run.

### Config

```js
const RUN_UPGRADES = Object.freeze({
    quick_reload: Object.freeze({ maxStacks: 3, weight: 10 }),
    focused_dash: Object.freeze({ maxStacks: 2, weight: 8 }),
    anomaly_resist: Object.freeze({ maxStacks: 1, weight: 5 }),
});
window.RUN_UPGRADES = RUN_UPGRADES;
```

### MTC Boss Reward Rules

- Kru Manop rewards should feel like classroom pressure turned into tools.
- Kru First rewards should lean into physics, momentum, gravity, and equations.
- Rewards must be named in MTC language and should not introduce Adventua lore.

## Release Checklist

1. `node --check` every touched JS file.
2. Start local server and smoke test `index.html`.
3. Select Kao, Auto, Poom, and Pat; verify each crosshair appears.
4. Verify desktop cursor hides only during active gameplay.
5. Verify mobile aim still works and does not depend on desktop cursor.
6. Verify player still rotates toward `mouse.wx/mouse.wy`.
7. Verify wave does not auto-advance after portal milestone lands.
8. Verify dialogue log caps entries and does not leak DOM nodes.
9. Verify emote effects expire and rollback entity modifiers.
10. Regenerate `sw.js` if runtime files changed.
11. Update `CHANGELOG.md` and `PROJECT_OVERVIEW.md`.
12. Sweep for accidental identity drift:

```powershell
rg -n "Adventua|Braver|BRAVER_PROFILES|ADVENTUA_LEVELS|GAME_TEXTS\\.adventua" js "Markdown Source/Future-Plan" "Markdown Source/CHANGELOG.md" "Markdown Source/Information/PROJECT_OVERVIEW.md"
```

Only pre-existing class names such as `ShieldBraverEnemy` may remain.

## Phaser Appendix

The current implementation target is vanilla JavaScript and Canvas 2D.

Phaser 3, Vite, and TypeScript remain a future migration path only. Do not write
new runtime features as Phaser systems until the project formally migrates.

If the migration starts later:

- Convert global singletons into scene plugins or typed services.
- Convert `updateGame(dt)` systems into Phaser scene update hooks.
- Replace DOM load-order contracts with module imports.
- Preserve MTC identity and port mechanics only.
