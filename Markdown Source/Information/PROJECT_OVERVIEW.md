# MTC Game - Project Overview (Architecture-Only)

**Release alignment:** service worker cache id **`mtc-cache-v3.41.5`** (`sw.js` `CACHE_NAME`); see `Markdown Source/CHANGELOG.md` for per-version notes.

This document is the architecture baseline for the current codebase.
It intentionally excludes balance values, cooldowns, damage numbers, and release-specific stats.

---

## 1) Runtime Stack and Execution Model

- Runtime: Vanilla JavaScript (global script tags, no ES module loader in `index.html`), HTML5 Canvas 2D, Web Audio API.
- Main pattern: advance simulation state in `updateGame`, then render in `drawGame` from that snapshot.
- Authoritative loop: `js/game.js` — `gameLoop` → `updateGame(dt)` (when allowed) → `drawGame()`.
- **Frame modes** (see `gameLoop`): hit-stop may skip `updateGame`; active **tutorial** may skip `updateGame` unless the step is an “action” step; **PAUSED** draws without updating; **GAMEOVER** stops the RAF loop.

---

## 2) Script Load Order and Dependency Chain

Load order is explicit in `index.html` and is a hard architectural contract. Any new script that introduces globals must load **before** its consumers.

### 2.1 Bootstrap and optional cloud (before `audio.js`)

1. `js/firebase-bundle.js` — Firebase client init (`window.firebaseAuth`, `window.MTCFirebase`, etc.).
2. `js/config.js`
3. `js/utils.js`
4. `js/systems/CloudSaveSystem.js` — Firestore sync for local save (depends on utils + Firebase).
5. `js/systems/LeaderboardUI.js` — Google / leaderboard UI (depends on utils + Firebase).

### 2.2 Early core scripts

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
6. Player class files (`PlayerBase`, then character subclasses)
7. `js/entities/summons.js`
8. `js/entities/enemy.js`
9. Boss attack modules (`boss_attacks_shared.js`, `boss_attacks_manop.js`, `boss_attacks_first.js`)
10. `js/entities/boss/BossBase.js`, `ManopBoss.js`, `FirstBoss.js`

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

## 3) Class Hierarchy (Current Code)

### 3.1 Core entity inheritance

- `Entity` (`js/entities/base.js`)
  - `Player` (`js/entities/player/PlayerBase.js`, `window.Player`)
    - `KaoPlayer`, `AutoPlayer`, `PoomPlayer`, `PatPlayer`
  - `EnemyBase` (`js/entities/enemy.js`)
    - `Enemy`, `TankEnemy`, `MageEnemy`
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop` (`js/entities/boss/ManopBoss.js`)
    - `KruFirst` (`js/entities/boss/FirstBoss.js`)
  - Other direct `Entity` subclasses (illustrative):
    - `BossDog` (boss-related modules)
    - `Drone` and summon/minion types in `js/entities/summons.js`
    - Boss attack-spawned entity classes in `boss_attacks_*.js` where defined

### 3.2 Rendering layer structure

- `PlayerRenderer`, `BossRenderer` — static dispatchers; not gameplay owners.
- `EnemyRenderer`, `ProjectileRenderer` — invoked from `drawGame` for enemies, powerups, and projectiles (see `js/game.js`).
- Dispatch relies on constructors / `instanceof` (e.g. `BossDog` branches to `BossRenderer`).

---

## 4) Update/Draw Separation Invariant

- `update()` paths own gameplay mutation.
- `draw()` / renderer methods read state and emit pixels.
- `draw()` must not apply authoritative gameplay mutations (HP, cooldowns, positions for simulation, wave state, score, etc.).

**Practical nuance:** render-local caches are permitted if they do not feed back into simulation decisions. Diagnostic counters on functions are not gameplay state.

---

## 5) Critical Invariants and Contracts

### 5.1 Enemy update contract

- `EnemyBase._tickShared(dt, player)` must run at the **start of the living update path** (after any `if (this.dead) return`), before movement or combat. All enemy subclasses follow this pattern.

### 5.2 Boss lifecycle contract

- Boss boundaries (spawn, phase transitions, death cleanup) coordinate across `WaveManager`, `BossBase` / subclasses, `game.js`, and `AdminSystem`. Boss attack singletons must reset on every exit path.

### 5.3 Game state ownership

- `GameState` (`js/systems/GameState.js`) is the canonical owner for phase, loop flags, and core references; compatibility aliases mirror onto `window.*`.
- Prefer extending `GameState` rather than introducing new ad-hoc globals.

---

## 6) Hidden Cross-Module Coupling (Important)

### 6.1 Global runtime surfaces

- Shared objects include `window.player`, `window.enemies`, `window.boss`, `window.drone`, `window.powerups`, and singleton managers loaded from `ui.js` / systems.

### 6.2 Worker analysis chain

- `WorkerBridge` sends samples to `js/workers/analyzer-worker.js`; results feed analyzer-driven AI. Coupling ties frame sampling, worker messages, and enemy/boss logic.

### 6.3 Optional cloud layer

- Firebase init and `CloudSaveSystem` depend on load order after `utils.js`. They must fail soft so local play still works offline.

### 6.4 Systems bridging old and new architecture

- `GameState` alias synchronization supports mixed call sites.
- `WaveManager`, `game.js`, and UI share state through canonical and legacy channels.

---

## 7) Rendering Pipeline Ownership (summary)

### 7.0 Campus map generation (simulation data, not draw order)

- `MapSystem.generateCampusMap` (`js/map.js`) places procedural `MapObject` instances using a **clear-zone predicate** (`_isClearZone`) so clusters do not block spawn, citadel/database/shop approaches, or gate gaps.
- **Cluster placement** is center-anchored grid logic with optional jitter; per-type footprints are read from the map configuration block in `js/config.js` (single source for dimensions used at generation time).

### 7.1 Frame draw sequence

- `drawGame` in `game.js` defines the frame draw sequence: background / terrain / map / world objects / decals / entities (player, enemies, boss, drone) / projectiles / particles / lighting / HUD overlays / tutorial canvas overlay.
- **CanvasHUD** (`ui.js`) owns combo, minimap, and related canvas HUD; `game.js` calls `CanvasHUD.draw` when defined, with `UIManager.draw` as legacy fallback.
- Entity classes supply state; renderers and `drawGame` orchestrate order — renderers must not own simulation.

Detail: see `.agents/skills/mtc-game-skills_claude/mtc-rendering.md`.

---

## 8) Service Worker and Runtime Version Source

- Cache identity: `sw.js` (`CACHE_NAME`).
- Version display: `js/VersionManager.js` messaging from the service worker.
- Do not treat documentation version strings as source of truth for architecture.

---

## 9) Documentation Scope Rules

This overview should stay stable by documenting only:

- class hierarchy and ownership boundaries
- initialization/load-order constraints
- update vs draw architectural separation
- cross-module dependencies and invariants

This overview should not store:

- balance/config numbers
- damage/cooldown/stat values
- release-by-release feature snapshots
- tuning constants that change frequently
