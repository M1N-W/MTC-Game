# MTC Game - Project Overview (Architecture-Only)

**Release alignment:** service worker cache id **`mtc-cache-v3.41.13`** (`sw.js` `CACHE_NAME`); see `Markdown Source/CHANGELOG.md` for per-version notes.

This document is the architecture baseline for the current codebase.
It intentionally excludes balance values, cooldowns, damage numbers, and release-specific stats.

---

## 1) Runtime Stack and Execution Model

- Runtime: Vanilla JavaScript loaded by global script tags in `index.html`.
- Rendering: HTML5 Canvas 2D with static renderer classes and manager-owned draw passes.
- Audio: Web Audio API via `js/audio.js`.
- Authoritative frame loop: `js/game.js` owns `gameLoop`, `updateGame(dt)`, and `drawGame()`.
- Simulation and rendering are deliberately decoupled: update mutates world state, draw consumes the finalized snapshot.

Frame modes in `gameLoop` are part of the architecture:
- Hit-stop can skip `updateGame` while still rendering.
- Tutorial mode may run tutorial state without running the full gameplay update.
- Pause renders without advancing simulation.
- Game over stops the normal RAF gameplay loop.

---

## 2) Script Load Order and Dependency Chain

Load order is explicit in `index.html` and is a hard contract. New globals must load before their consumers.

### 2.1 Bootstrap and cloud-first scripts

1. `js/firebase-bundle.js`
2. `js/config.js`
3. `js/utils.js`
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
6. Player class files
7. `js/entities/summons.js`
8. `js/entities/enemy.js`
9. Boss attack files
10. `js/entities/boss/BossBase.js`
11. `js/entities/boss/ManopBoss.js`
12. `js/entities/boss/FirstBoss.js`

### 2.4 Input, rendering, systems, orchestration

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

---

## 3) Class Hierarchy and Runtime Surfaces

### 3.1 Core inheritance tree

- `Entity` (`js/entities/base.js`)
  - `Player` (`js/entities/player/PlayerBase.js`, exported as `window.Player`)
    - `KaoPlayer`
    - `AutoPlayer`
    - `PoomPlayer`
    - `PatPlayer`
  - `EnemyBase` (`js/entities/enemy.js`)
    - `Enemy`
    - `TankEnemy`
    - `MageEnemy`
    - `SniperEnemy`
    - `ShieldBraverEnemy`
    - `PoisonSpitterEnemy`
    - `ChargerEnemy`
    - `HunterEnemy`
    - `FatalityBomberEnemy`
    - `HealerEnemy`
    - `SummonerEnemy`
    - `BufferEnemy`
    - `SummonedMinionEnemy`
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop` (`window.ManopBoss`, `window.Boss` aliases)
    - `KruFirst` (`window.BossFirst` alias)
  - Other direct `Entity` subclasses
    - `BossDog`
    - `Drone`
    - `NagaEntity`
    - boss attack and minion entities defined in `boss_attacks_*.js`

### 3.2 Non-Entity gameplay objects with frame contracts

- `HealthComponent` supports combatant health state and hit-flash timing.
- `UtilityAI`, `SquadAI`, `PlayerPatternAnalyzer`, and `WorkerBridge` are logic objects, not entities.
- `PoisonPoolEffect` and `FatalityExplosionEffect` participate in the `specialEffects` pipeline through `update()` + `draw()`, but do not inherit from `Entity`.

### 3.3 Renderer structure

- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static dispatchers.
- Renderer dispatch is keyed by constructor identity and `instanceof`.
- Renderers are consumers of simulation state, not owners of gameplay rules.

---

## 4) Update/Draw Separation Invariant

- `update()` paths own authoritative mutation: timers, HP, movement, AI, spawning, wave state, buffs, and damage.
- `draw()` paths and renderer methods own canvas output only.
- Draw code must not modify score, HP, cooldowns, spawn state, AI intent, wave progression, or authoritative positions.

Permitted render-local behavior:
- sprite or bitmap caches owned by renderer classes
- context state setup and cleanup
- deterministic visual animation derived from current read-only state

Forbidden render behavior:
- spawning gameplay entities
- mutating `window.enemies`, `window.specialEffects`, `projectileManager`, or `GameState`
- advancing cooldowns or status timers

---

## 5) Critical Invariants and Contracts

### 5.1 Enemy lifecycle contract

- `EnemyBase._tickShared(dt, player)` must run first in every living enemy `update()` path.
- `UtilityAI` writes intent into `_aiMoveX` and `_aiMoveY`; it does not own physics velocity directly.
- Shared enemy buffs and debuffs are normalized through `EnemyBase`, not duplicated in renderer code.

### 5.2 Wave and spawn contract

- `WaveManager` is the sole owner of wave progression, trickle spawn state, boss-wave entry, and wave-event activation.
- Enemy creation now routes through `window.ENEMY_REGISTRY` and registry-aware spawn selection.
- Wave-specific speed modifiers are centralized in `window.applyWaveModifiersToEnemy`, which is reused by normal spawning, admin spawning, and summoner-created minions.

### 5.3 Boss lifecycle contract

- Boss setup and cleanup span `WaveManager`, `BossBase`, boss subclasses, `game.js`, and `AdminSystem`.
- Boss-owned attack singletons and domain/singularity state must reset through every boss exit path, including admin shortcuts.

### 5.4 Array ownership and removal pattern

- `window.specialEffects` is updated in-place and uses swap-remove semantics in `game.js` for O(1) removals.
- Entity arrays and pooled managers are updated before draw and then read in draw passes without mid-frame mutation.

---

## 6) Hidden Cross-Module Coupling

### 6.1 Canonical and legacy state channels

- `GameState` is the canonical owner for phase and loop state.
- Legacy `window.*` globals remain compatibility surfaces for older systems and renderer access.

### 6.2 Enemy registry coupling

- `enemy.js` exports constructors and `window.ENEMY_REGISTRY`.
- `WaveManager` consumes the registry for wave composition.
- `AdminSystem` consumes the same registry for debug spawning.

### 6.3 Rendering cross-file coupling

- `drawGame()` orchestrates the frame, but `EnemyRenderer.draw()` temporarily binds `window.CTX` so fallback draw paths and shared helpers can still render correctly.
- `mapSystem.drawLighting()` runs after the main world draw pass and depends on projectile and landmark data prepared outside the lighting module.

### 6.4 Worker pipeline coupling

- `WorkerBridge` and `js/workers/analyzer-worker.js` feed `PlayerPatternAnalyzer` results back into gameplay consumers.
- Changes to analyzer data flow affect boss prediction and enemy aim prediction.

### 6.5 Optional cloud coupling

- Firebase bootstrap and cloud save systems depend on early load order and must fail soft so offline local play remains functional.

---

## 7) Rendering Pipeline Ownership

### 7.1 Frame draw sequence

`drawGame()` in `js/game.js` owns the canonical pass order:

1. world background and camera transform
2. terrain, map objects, decals, and low-HP guide
3. powerups and `specialEffects`
4. drone and player renderers
5. enemy and boss renderers
6. projectile, particle, floating-text, orbital, hit-marker, and weather passes
7. lighting pass
8. screen-space overlays such as day/night HUD, slow-mo, glitch, wave events, and domain overlays
9. `CanvasHUD` with `UIManager.draw` as fallback
10. `TutorialSystem.draw` last

### 7.2 Resource management patterns

- `EnemyRenderer` owns a body-sprite cache.
- `BossRenderer` owns an offscreen bitmap cache.
- Manager-owned systems such as projectiles, particles, floating text, decals, and weather are updated elsewhere and drawn here.

---

## 8) Documentation Files and Stable Scope

| File | Location | Purpose |
|---|---|---|
| `PROJECT_OVERVIEW.md` | `Markdown Source/Information/` | Architecture baseline for runtime structure, invariants, and hidden coupling |
| `SKILL.md` | `Markdown Source/Information/` | Stable architectural conventions reference for class hierarchy, load order, and invariants |
| `mtc-game-conventions.md` | `.agents/skills/mtc-game-skills_claude/` | Agent-facing stable architecture skill |
| `mtc-rendering.md` | `.agents/skills/mtc-game-skills_claude/` | Rendering pipeline, dispatcher, cache, and frame-pass skill |
| `CHANGELOG.md` | `Markdown Source/` | Version-specific implementation notes |

This overview should stay stable by documenting only:
- class hierarchy and ownership boundaries
- initialization and dependency order
- update/draw separation
- critical invariants and hidden cross-file dependencies

This overview should not store:
- balance or config values
- damage, cooldown, economy, or spawn percentages
- release-specific tuning notes
- transient implementation details that belong in the changelog
