# MTC Game - Project Overview (Architecture-Only)

**Release alignment:** service worker cache id **`mtc-cache-v3.41.9`** (`sw.js` `CACHE_NAME`); see `Markdown Source/CHANGELOG.md` for per-version notes.

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

### 2.1 Bootstrap and optional cloud (before entity scripts)

1. `js/firebase-bundle.js` — Firebase client init (`window.firebaseAuth`, `window.MTCFirebase`, etc.).
2. `js/config/BalanceConfig.js` — `window.BALANCE` (all character/enemy/boss stats).
   `js/config/SystemConfig.js` — `window.MAP_CONFIG`, `window.GAME_CONFIG` (map dimensions, system settings).
   `js/config/GameTexts.js` — `window.GAME_TEXTS` (UI strings, skill names, HUD emoji, boss taunts).
3. `js/utils.js` — `worldToScreen()`, `spawnParticles()`, `showVoiceBubble()` globals.
4. `js/systems/CloudSaveSystem.js` — Firestore sync for local save (depends on utils + Firebase).
5. `js/systems/LeaderboardUI.js` — Google / leaderboard UI (depends on utils + Firebase).

### 2.2 Effects, weapons, map, and UI foundations

1. `js/effects/ParticleSystem.js` — particle pool (must load first in effects block).
   `js/effects/WeatherSystem.js`, `CombatEffects.js`, `VisualPolish.js`, `OrbitalEffects.js`, `PatEffects.js`.
   ⚠️ `effects/` is a **directory of modules**, not a single `effects.js` file.
2. `js/weapons/SpatialGrid.js` — collision grid (must load first in weapons block).
   `js/weapons/Projectile.js`, `WeaponSystem.js`, `ProjectileManager.js`, `PoomWeapon.js`.
3. `js/map.js`
4. `js/ui.js` — `window.PORTRAITS`, `UIManager`, `CanvasHUD`.
5. `js/tutorial.js`

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
2. `js/rendering/RenderTokens.js` — visual token singleton (`window.RT`). **Must load first** in the rendering block; all renderer files depend on `RT.*` constants.
   `js/rendering/KaoRenderer.js`, `AutoRenderer.js`, `PoomRenderer.js`, `PatRenderer.js` — per-character renderers. Each must load **before** `PlayerRenderer.js`.
   `js/rendering/PlayerRenderer.js` — dispatcher + shared helpers + fallback stubs for each char renderer.
   `js/rendering/BossRenderer.js`, `ProjectileRenderer.js`
3. `js/systems/GameState.js`
4. `js/systems/AdminSystem.js`
5. `js/systems/ShopSystem.js`
6. `js/systems/TimeManager.js`
7. `js/systems/WaveManager.js`
8. `js/ui/UIManager.js`, `CanvasHUD.js`, `AchievementSystem.js`, `ShopManager.js`
9. `js/audio.js`
10. `js/game.js`
11. `js/VersionManager.js`
12. `js/menu.js`
13. `js/systems/WorkerBridge.js` — spawns `analyzer-worker` via `new Worker(...)`. **Must load after `game.js`**; the worker is a separate thread context that does not share `window.*`.

---

## 3) Class Hierarchy (Current Code)

### 3.1 Core entity inheritance

- `Entity` (`js/entities/base.js`)
  - `PlayerBase` (`js/entities/player/PlayerBase.js`, exported as `window.Player`)
    - `KaoPlayer`, `AutoPlayer`, `PoomPlayer`, `PatPlayer`
  - `EnemyBase` (`js/entities/enemy.js`)
    - `Enemy`, `TankEnemy`, `MageEnemy`
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop` (`js/entities/boss/ManopBoss.js`)
    - `KruFirst` (`js/entities/boss/FirstBoss.js`)
  - Other direct `Entity` subclasses (illustrative):
    - `BossDog` (`js/entities/boss/ManopBoss.js` — same file as `KruManop`)
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
- **CanvasHUD** (`ui.js`) owns combo, minimap, and related canvas HUD; `game.js` calls `CanvasHUD.draw` when defined, with `UIManager.draw` as legacy fallback. Minimap helpers (`_minimapDrawShell`, `_minimapDrawContent`, `_minimapDrawLabel`) live on `CanvasHUD`, not `UIManager`.
- **RenderTokens** (`js/rendering/RenderTokens.js`, `window.RT`) is the single source of truth for all `ctx` style values (palette hex, glow blur/color, stroke widths, alpha presets). All renderer files read from `RT.*`; never hardcode hex colors or shadow values that have RT equivalents.
- Entity classes supply state; renderers and `drawGame` orchestrate order — renderers must not own simulation.

Detail: see `.agents/skills/mtc-game-skills_claude/mtc-rendering.md`.

---

## 8) Service Worker and Runtime Version Source

- Cache identity: `sw.js` (`CACHE_NAME`).
- Version display: `js/VersionManager.js` messaging from the service worker.
- Do not treat documentation version strings as source of truth for architecture.

## 9) CSS Architecture

- `css/main.css` is an **`@import` manifest** — it contains no styles itself, only `@import` calls to 10 sub-files in the same `css/` directory.
- Sub-files and their REGION coverage:

| File                   | Region                                              |
| ---------------------- | --------------------------------------------------- |
| `base.css`             | CSS vars · reset · body · canvas                    |
| `overlays.css`         | Interaction prompts · Pause screen · Admin console  |
| `shop.css`             | Shop modal · Achievement gallery                    |
| `hud.css`              | Achievements toast · Boss HP bar · Skill bar        |
| `menu.css`             | Main menu overlay · panels · transitions            |
| `character-select.css` | Victory screen · Character cards · Flip card system |
| `tutorial.css`         | Tutorial overlay                                    |
| `mobile.css`           | Mobile controls · touch · haptic                    |
| `ux.css`               | UX patches · high score · skill tooltips            |
| `loading.css`          | Loading screen · extracted inline styles            |

- `index.html` references `css/main.css` via a single `<link>` tag — no per-module `<link>` tags.
- CSS custom properties (`--font-*`, `--dur-*`, `--ease-*`) are defined in `base.css` and consumed by all subsequent files; **load order of `@import` statements in `main.css` is a hard contract**.

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
