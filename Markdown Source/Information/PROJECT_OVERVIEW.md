# MTC Game - Project Overview (Architecture-Only)

**Release alignment:** service worker cache id **`mtc-cache-v3.42.1`** (`sw.js` `CACHE_NAME`); see `Markdown Source/CHANGELOG.md` for per-version notes.

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

### 2.1 Bootstrap and config/cloud scripts

1. `js/balance.js`
2. `js/shop-items.js`
3. `js/game-texts.js`
4. `js/utils.js`
5. `js/firebase-bundle.js`
6. `js/systems/CloudSaveSystem.js`
7. `js/systems/LeaderboardUI.js`

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
4. `js/rendering/EnemyRenderer.js`
5. `js/systems/GameState.js`
6. `js/systems/AdminSystem.js`
7. `js/systems/ShopSystem.js`
8. `js/systems/TimeManager.js`
9. `js/systems/WaveManager.js`
10. `js/systems/WorkerBridge.js`
11. `js/game.js`
12. `js/VersionManager.js`
13. `js/menu.js`

### 2.5 Modular split entry points

The legacy `css/main.css` and `js/config.js` bundles have been retired. Their responsibilities are now split across these stable entry modules:

| File | Purpose |
| --- | --- |
| `css/base.css` | Reset, fonts, body, canvas, and root layout |
| `css/overlays.css` | Interaction prompts, pause state, resume prompt |
| `css/admin-console.css` | Admin terminal layout and CRT styling |
| `css/shop.css` | Shop modal and item presentation |
| `css/hud.css` | HUD, boss bar, skill bar, achievements |
| `css/menus.css` | Main menu overlay and CTA layout |
| `css/screens.css` | Victory screen presentation |
| `css/char-select.css` | Character carousel and flip-card system |
| `css/tutorial.css` | Tutorial overlay layout and prompts |
| `css/ui-extras.css` | Mobile UI, tooltips, loading, and game-over extras |
| `js/balance.js` | `WAVE_SCHEDULE`, `BALANCE`, `GAME_CONFIG`, `VISUALS`, `ACHIEVEMENT_DEFS`, `MAP_CONFIG` |
| `js/shop-items.js` | `SHOP_ITEMS` catalog |
| `js/game-texts.js` | `GAME_TEXTS` localization and HUD copy |
| `js/rendering/EnemyRenderer.js` | Enemy-only draw dispatcher and renderer helpers |

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
    - `Enemy` (direct `EnemyBase` subclass — most specific types inherit from this)
      - `SniperEnemy`
      - `PoisonSpitterEnemy`
      - `ChargerEnemy`
      - `HunterEnemy`
      - `FatalityBomberEnemy`
      - `HealerEnemy`
      - `SummonerEnemy`
      - `BufferEnemy`
      - `SummonedMinionEnemy`
    - `TankEnemy` (direct `EnemyBase` subclass)
      - `ShieldBraverEnemy`
    - `MageEnemy` (direct `EnemyBase` subclass)
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop` (`window.ManopBoss`, `window.Boss` aliases)
    - `KruFirst` (`window.BossFirst` alias)
  - Other direct `Entity` subclasses (not `EnemyBase` or `BossBase`)
    - `BossDog` (`js/entities/boss/ManopBoss.js`)
    - `GoldfishMinion` (`js/entities/boss/boss_attacks_manop.js`)
    - `Drone` (`js/entities/summons.js`, also exported as `window.DroneEntity`)
    - `NagaEntity` (`js/entities/summons.js`)
    - `GarudaEntity` (`js/entities/summons.js`, exported as `window.GarudaEntity`)

### 3.2 Non-Entity gameplay objects with frame contracts

- `HealthComponent` is defined in `js/entities/base.js` (same file as `Entity`). It is composed into combatants via `this.health = new HealthComponent(maxHp)`. Proxy getters on the owner (`hp`, `maxHp`, `dead`, `hitFlashTimer`) keep call sites backward-compatible.
- `UtilityAI`, `SquadAI`, `PlayerPatternAnalyzer`, and `WorkerBridge` are logic objects, not entities.
- `PoisonPoolEffect` and `FatalityExplosionEffect` participate in the `specialEffects` pipeline through `update()` + `draw()`, but do not inherit from `Entity`.

### 3.3 Renderer structure

- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static dispatchers.
- Enemy simulation types remain in `js/entities/enemy.js`; enemy canvas rendering is decoupled into `js/rendering/EnemyRenderer.js`.
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

- `enemy.js` exports constructors and `window.ENEMY_REGISTRY`; `js/rendering/EnemyRenderer.js` consumes those constructors for render dispatch.
- `WaveManager` consumes the registry for wave composition.
- `AdminSystem` consumes the same registry for debug spawning.

### 6.3 Rendering cross-file coupling

- `drawGame()` orchestrates the frame, but `EnemyRenderer.draw()` saves the previous `window.CTX`, rebinds it to the current `ctx` parameter, executes in a `try/finally` block, and restores the saved value on exit. This lets fallback `draw()` paths and shared draw helpers reach the active canvas context safely.
- `mapSystem.drawLighting()` runs **outside** the camera transform (`CTX.restore()` ends the world-space translate before lighting begins). It depends on the full projectile array and static landmark positions provided by the caller.

### 6.4 Worker pipeline coupling

- `WorkerBridge` and `js/workers/analyzer-worker.js` feed `PlayerPatternAnalyzer` results back into gameplay consumers.
- Changes to analyzer data flow affect boss prediction and enemy aim prediction.

### 6.5 Optional cloud coupling

- Firebase bootstrap and cloud save systems depend on early load order and must fail soft so offline local play remains functional.

---

## 7) Rendering Pipeline Ownership

### 7.1 Frame draw sequence

`drawGame()` in `js/game.js` owns the canonical pass order. Steps 1–16 execute inside a camera `CTX.save()/translate(shake)` block; steps 17 onward are screen-space (outside that transform).

**World-space (inside camera transform):**

1. Background gradient fill
2. `mapSystem.drawTerrain()` — arena boundary, hex grid, zone auras, circuit paths, center landmark
3. `drawGrid()` — debug grid overlay
4. `meteorZones` visual indicators
5. `mapSystem.draw()` — walls, zone objects, MTC room
6. `drawDatabaseServer()`, `drawShopObject()` — interactive world objects
7. `decalSystem.draw()`, `shellCasingSystem.draw()` — floor-level battle scars
8. Low-HP navigation guide (dashed line to nearest heal source)
9. `powerups` via `EnemyRenderer`
10. `specialEffects` (update-driven, drawn sequentially)
11. `drone.draw()`
12. `PlayerRenderer.draw(window.player, CTX)`
13. Enemy list: `EnemyRenderer.draw()` per enemy; `BossDog` instances route to `BossRenderer`
14. `BossRenderer.draw(window.boss, CTX)`
15. `ProjectileRenderer.drawAll()`, `particleSystem.draw()`, `floatingTextSystem.draw()`
16. `drawOrbitalEffects()`, `hitMarkerSystem.draw()`, `weatherSystem.draw()`
17. `CTX.restore()` — **camera transform ends here**

**Screen-space (outside camera transform):**

18. `mapSystem.drawLighting()` — full-screen lighting pass; receives projectile array and landmark positions
19. `drawDayNightHUD()`, `drawSlowMoOverlay()`, glitch effect
20. `drawWaveEvent()`, `DomainExpansion.draw()`, `GravitationalSingularity.draw()`
21. `CanvasHUD.draw()` with `UIManager.draw` as fallback
22. `TutorialSystem.draw()` last

### 7.2 Resource management patterns

- `EnemyRenderer` owns a body-sprite cache.
- `BossRenderer` owns an offscreen bitmap cache.
- Manager-owned systems such as projectiles, particles, floating text, decals, and weather are updated elsewhere and drawn here.

---

## 8) Documentation Files and Stable Scope

| File | Location | Purpose |
| --- | --- | --- |
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
