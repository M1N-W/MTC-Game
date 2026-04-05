# MTC Game - Project Overview (Architecture-Only)

**Status:** v3.41.18

This document is the architecture baseline for the current codebase.
It documents stable structure only.
It excludes balance values, cooldowns, damage numbers, and release-specific tuning.

---

## 1) Runtime Model

- Runtime: global browser scripts loaded explicitly from `index.html`.
- Main loop owner: `js/game.js`.
- Canonical frame entry points: `gameLoop(now)`, `updateGame(dt)`, `drawGame()`.
- Simulation and rendering are separate phases.
- `updateGame(dt)` mutates authoritative runtime state.
- `drawGame()` reads the finalized state snapshot and emits pixels only.

Loop modes that shape the architecture:

- Hit-stop can render without advancing gameplay simulation.
- Tutorial mode can advance tutorial state while skipping parts of gameplay update.
- Pause renders without advancing simulation.
- Game over stops the normal gameplay RAF loop.

---

## 2) Precise Script Load Order

Load order in `index.html` is a hard dependency contract.
New globals must load before their consumers.

### 2.1 Bootstrap and shared utilities

1. `js/config.js`
2. `js/utils.js`
3. `js/firebase-bundle.js`
4. `js/systems/CloudSaveSystem.js`
5. `js/systems/LeaderboardUI.js`

### 2.2 Early core systems

1. `js/audio.js`
2. `js/effects.js`
3. `js/weapons.js`
4. `js/map.js`
5. `js/ui.js`
6. `js/tutorial.js`

### 2.3 Entity and AI foundations

1. `js/entities/base.js`
2. `js/ai/UtilityAI.js`
3. `js/ai/EnemyActions.js`
4. `js/ai/PlayerPatternAnalyzer.js`
5. `js/ai/SquadAI.js`
6. `js/entities/player/PlayerBase.js`
7. `js/entities/player/KaoPlayer.js`
8. `js/entities/player/AutoPlayer.js`
9. `js/entities/player/PoomPlayer.js`
10. `js/entities/player/PatPlayer.js`
11. `js/entities/summons.js`
12. `js/entities/enemy.js`
13. `js/entities/boss/boss_attacks_shared.js`
14. `js/entities/boss/boss_attacks_manop.js`
15. `js/entities/boss/boss_attacks_first.js`
16. `js/entities/boss/BossBase.js`
17. `js/entities/boss/ManopBoss.js`
18. `js/entities/boss/FirstBoss.js`

### 2.4 Input, render dispatch, state, orchestration

1. `js/input.js`
2. `js/rendering/PlayerRenderer.js`
3. `js/rendering/BossRenderer.js`
4. `js/systems/GameState.js`
5. `js/systems/AdminSystem.js`
6. `js/systems/ShopSystem.js`
7. `js/systems/TimeManager.js`
8. `js/systems/WaveManager.js`
9. `js/systems/WorkerBridge.js`
10. `js/game.js`
11. `js/VersionManager.js`
12. `js/menu.js`

Load-order consequences:

- `Entity` must exist before any player, enemy, summon, or boss class.
- AI helpers must exist before `EnemyBase` constructs `UtilityAI`.
- Player and boss constructors must exist before render dispatchers rely on `instanceof`.
- `GameState` must exist before `game.js` writes canonical phase and alias state.
- `WorkerBridge` loads before `game.js` finishes booting, but `game.js` still guards all accesses.

---

## 3) Class Hierarchy and Runtime Surfaces

JavaScript does not define formal interfaces here.
The codebase uses inheritance plus shared method contracts such as `update()`, `draw()`, `takeDamage()`, and `_tickShared()`.

### 3.1 Inheritance tree

```text
Entity
├── Player
│   ├── KaoPlayer
│   ├── AutoPlayer
│   ├── PoomPlayer
│   └── PatPlayer
├── EnemyBase
│   ├── Enemy
│   │   ├── SniperEnemy
│   │   ├── PoisonSpitterEnemy
│   │   ├── ChargerEnemy
│   │   ├── HunterEnemy
│   │   ├── FatalityBomberEnemy
│   │   ├── HealerEnemy
│   │   ├── SummonedMinionEnemy
│   │   ├── SummonerEnemy
│   │   └── BufferEnemy
│   ├── TankEnemy
│   │   └── ShieldBraverEnemy
│   └── MageEnemy
├── BossBase
│   ├── KruManop
│   └── KruFirst
├── BossDog
├── NagaEntity
├── Drone
└── GarudaEntity
```

### 3.2 Important non-Entity classes

- `HealthComponent` is a composition helper used by `EnemyBase`.
- `KaoClone` is a helper class owned by `KaoPlayer`.
- `WanchaiStand` is a helper class owned by `AutoPlayer`.
- `PoisonPoolEffect` and `FatalityExplosionEffect` are effect objects in the `specialEffects` pipeline.
- `PlayerPatternAnalyzer`, `UtilityAI`, `SquadAI`, and `WorkerBridge` are logic systems, not entities.

### 3.3 Aliases and registry surfaces

- `Player` exports as `window.Player`.
- `KruManop` also exports as `window.KruManop`, `window.ManopBoss`, and `window.Boss`.
- `KruFirst` also exports as `window.KruFirst` and `window.BossFirst`.
- Enemy constructors are mirrored through `window.ENEMY_REGISTRY`.
- `PowerUp` is not part of the `Entity` inheritance tree, but it is drawn through `EnemyRenderer`.

---

## 4) Update/Draw Separation

- `update(...)` owns timers, AI, movement, physics, damage, spawning, wave progression, and authoritative state transitions.
- `draw(...)` and renderer entry points own canvas output only.
- Draw code must not mutate HP, cooldowns, phase, score, AI intent, entity arrays, or spawn state.

Allowed draw-side behavior:

- renderer-local bitmap or sprite caches
- deterministic visual oscillation derived from current state
- `ctx` setup and cleanup
- read-only viewport culling

Forbidden draw-side behavior:

- spawning projectiles, enemies, pickups, or gameplay effects
- mutating `GameState`
- mutating `window.enemies`, `window.specialEffects`, `projectileManager`, or wave state
- advancing cooldowns, status timers, or AI state

This is a project-wide invariant.
`drawGame()` orchestrates passes.
Simulation mutations belong in `updateGame()` and subsystem update methods only.

---

## 5) Critical Invariants

### 5.1 Enemy shared-tick invariant

- Every living enemy update path must call `EnemyBase._tickShared(dt, player)` first.
- `_tickShared()` centralizes status ticking, shared hit-flash decay, shared buff timers, ignite and shatter handling, and `UtilityAI` consumption.
- Enemy subclasses may add movement and attacks after that call only.

### 5.2 Physics and intent invariant

- `UtilityAI` writes `_aiMoveX` and `_aiMoveY`.
- Enemy subclasses decide how to translate that intent into `vx` and `vy`.
- `Entity.applyPhysics(dt)` remains the shared physics integration point.

### 5.3 State ownership invariant

- `GameState` is the canonical owner of phase, loop, and run-scoped mutable state.
- Compatibility globals still exist on `window.*`.
- `GameState._syncAliases()` is the bridge that mirrors canonical state into those globals.
- Any new primitive state mirrored to `window.*` must be re-synced deliberately.

### 5.4 Wave and boss ownership invariant

- `WaveManager` owns wave advancement, event activation, trickle spawning, and boss-wave entry.
- `BossBase` owns shared boss death cleanup.
- Boss subclasses own boss-specific AI and state machines.
- `game.js` owns the frame loop and delegates to wave, entity, and render systems.

### 5.5 Render boundary invariant

- `drawGame()` is the only canonical world-frame orchestrator.
- `CanvasHUD.draw()` is the primary HUD pass.
- `UIManager.draw()` exists as a compatibility fallback.
- `TutorialSystem.draw()` must remain last.

---

## 6) Hidden Cross-File Dependencies

### 6.1 Canonical state versus compatibility globals

- Many older systems still read `window.player`, `window.enemies`, `window.boss`, `window.powerups`, and `window.specialEffects`.
- `GameState` is canonical, but compatibility globals are still part of the runtime contract.
- Reset flows must update both the canonical owner and the mirrored surfaces.

### 6.2 Enemy registry coupling

- `js/entities/enemy.js` defines constructors and `window.ENEMY_REGISTRY`.
- `js/systems/WaveManager.js` consumes that registry for roster selection.
- `js/systems/AdminSystem.js` consumes the same registry for debug/admin spawns.

### 6.3 Wave modifier coupling

- `window.applyWaveModifiersToEnemy` is a shared modifier entry point.
- It is reused by normal wave spawns, admin spawns, and summoner-created minions.
- Wave-specific enemy mutation must stay centralized there instead of being duplicated.

### 6.4 Worker analysis coupling

- `WorkerBridge` communicates with `js/workers/analyzer-worker.js`.
- Worker results are written directly onto `window.playerAnalyzer` cache fields.
- Boss prediction behavior depends on that bridge even though the analyzer object lives elsewhere.

### 6.5 Rendering coupling

- `EnemyRenderer.draw()` temporarily binds `window.CTX` for shared draw helpers and fallback draw paths.
- `mapSystem.drawLighting(...)` depends on the current player, projectile list, landmark lights, camera transform, and screen shake state prepared outside the map module.
- `CanvasHUD` depends on wave-state globals such as fog-wave blackout state even though it is rendered as a HUD layer.

---

## 7) Rendering Pipeline Ownership

### 7.1 Canonical pass order

`drawGame()` in `js/game.js` owns the frame pass order:

1. background fill and camera transform
2. `mapSystem.drawTerrain(...)`
3. debug grid when enabled
4. meteor zone telegraphs
5. `mapSystem.draw()`
6. world landmarks such as database server and shop
7. decals and shell casings
8. low-HP navigation guide
9. powerups and `specialEffects`
10. drone and player renderer
11. enemy and boss renderers
12. projectile, particle, floating-text, orbital, hit-marker, and weather passes
13. lighting pass via `mapSystem.drawLighting(...)`
14. screen-space overlays such as day/night, slow-mo, glitch, wave events, and domain overlays
15. `CanvasHUD.draw(...)` with `UIManager.draw(...)` fallback
16. `TutorialSystem.draw(...)` last

### 7.2 Resource and cache ownership

- `EnemyRenderer` owns a body-sprite cache.
- `BossRenderer` owns offscreen bitmap caches.
- `MapSystem` owns the terrain cache canvas and the lighting canvas.
- Projectile, particle, floating-text, decal, shell-casing, and weather systems update outside draw and render read-only during draw.

---

## 8) Stable Documentation Scope

These documentation files should stay stable by documenting only:

- class hierarchy and alias surfaces
- initialization order and dependency chains
- update versus draw boundaries
- canonical state ownership
- hidden cross-file coupling
- rendering pass ownership

These files should not document:

- cooldown values
- damage values
- spawn percentages
- economy values
- balance constants from `BALANCE` or config tuning tables
- release or cache identifiers
