# MTC Game - Project Overview (Architecture-Only)

This document is the architecture baseline for the current codebase.
It intentionally excludes balance values, cooldowns, damage numbers, and release-specific stats.

---

## 1) Runtime Stack and Execution Model

- Runtime: Vanilla JavaScript (global script tags, no module loader), HTML5 Canvas 2D, Web Audio API.
- Main pattern: update simulation state first, then render from that state.
- Authoritative game loop is in `js/game.js`:
  - `updateGame(dt)` handles gameplay mutation.
  - `drawGame()` renders frame output.
- Draw paths are expected to be deterministic and side-effect-free for gameplay state.

---

## 2) Script Load Order and Dependency Chain

Load order is explicit in `index.html` and is a hard architectural contract.

### 2.1 Early core scripts

1. `js/config.js`
2. `js/utils.js`
3. `js/audio.js`
4. `js/effects.js`
5. `js/weapons.js`
6. `js/map.js`
7. `js/ui.js`
8. `js/tutorial.js`

### 2.2 Entity and AI foundations

1. `js/entities/base.js`
2. `js/ai/UtilityAI.js`
3. `js/ai/EnemyActions.js`
4. `js/ai/PlayerPatternAnalyzer.js`
5. `js/ai/SquadAI.js`
6. Player classes, enemy classes, boss attack files, boss classes

### 2.3 Input, rendering, systems, orchestration

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

Any new file that introduces globals used by another file must be loaded before its consumers.

---

## 3) Class Hierarchy (Current Code)

### 3.1 Core entity inheritance

- `Entity` (`js/entities/base.js`)
  - `Player` (`js/entities/player/PlayerBase.js`)
    - `KaoPlayer`
    - `AutoPlayer`
    - `PoomPlayer`
    - `PatPlayer`
  - `EnemyBase` (`js/entities/enemy.js`)
    - `Enemy`
    - `TankEnemy`
    - `MageEnemy`
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop` (`js/entities/boss/ManopBoss.js`)
    - `KruFirst` (`js/entities/boss/FirstBoss.js`)
  - Other direct `Entity` subclasses:
    - `BossDog` (`ManopBoss.js`)
    - summon entities in `js/entities/summons.js`
    - attack entities such as `GoldfishMinion` in boss attack files

### 3.2 Rendering layer structure

- `PlayerRenderer` and `BossRenderer` are static utility renderers (not gameplay owners).
- Renderers dispatch by runtime type checks (`instanceof`) and assume class constructors are loaded.

---

## 4) Update/Draw Separation Invariant

### 4.1 Required behavior

- `update()` methods own gameplay mutation.
- `draw()` methods only read state and produce pixels.
- `draw()` must not apply gameplay mutations (HP, cooldown, position, status, wave state, etc.).

### 4.2 Practical nuance

- Render-local caches are allowed in draw paths (for rendering optimization).
- These caches must remain rendering-only and must not feed back into gameplay logic.

---

## 5) Critical Invariants and Contracts

### 5.1 Enemy update contract

- `EnemyBase._tickShared(dt, player)` must execute first in enemy subclass `update()` methods.
- This centralizes status ticking and shared enemy state transitions.

### 5.2 Boss lifecycle contract

- Boss lifecycle boundaries (spawn, phase transitions, death cleanup) are coordinated across:
  - `WaveManager`
  - `BossBase` and boss subclasses
  - admin/debug commands in `AdminSystem`
- Boss attack singleton/state cleanup must happen consistently at all exit paths.

### 5.3 Game state ownership

- `GameState` is the canonical state manager in `js/systems/GameState.js`.
- Compatibility aliases still mirror state onto legacy `window.*` access patterns.
- New architectural work should target `GameState` first, not new ad-hoc globals.

---

## 6) Hidden Cross-Module Coupling (Important)

The codebase uses shared globals and implicit contracts; these are coupling edges to preserve during refactors.

### 6.1 Global runtime surfaces

- Shared runtime objects include `window.player`, `window.enemies`, `window.boss`, and manager singletons.
- Files across entities/systems/rendering assume these globals exist and are shape-compatible.

### 6.2 Worker analysis chain

- `WorkerBridge` sends sampled data to `js/workers/analyzer-worker.js`.
- Worker output is synchronized back into analyzer state used by enemy/boss behavior.
- This creates an implicit dependency between game loop sampling and AI consumers.

### 6.3 Systems that bridge old and new architecture

- `GameState` alias synchronization supports mixed old/new call sites.
- `WaveManager`, `game.js`, and UI layers share state through both canonical and compatibility channels.

---

## 7) Rendering Pipeline Ownership

### 7.1 Frame-level ownership

- `game.js` orchestrates frame order.
- world rendering is split into entity renderers and environment draw paths.
- HUD/canvas overlay responsibilities are centralized in UI rendering systems rather than individual entities.

### 7.2 Renderer boundaries

- Entity classes provide state for rendering.
- Renderers transform that state into visuals and should not become simulation controllers.

---

## 8) Service Worker and Runtime Version Source

- Runtime cache/version identity is owned by `sw.js` (`CACHE_NAME`).
- Version display sync is handled by `js/VersionManager.js`.
- Documentation should not hardcode release numbers as source-of-truth architecture data.

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

