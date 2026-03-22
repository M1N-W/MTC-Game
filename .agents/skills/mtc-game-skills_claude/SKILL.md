---
name: mtc-game-conventions
description: "Timeless MTC The Game architecture — class hierarchy, update/draw separation, script load order, GameState/globals contracts, enemy _tickShared invariant, WorkerBridge coupling, and frame-loop modes. Excludes BALANCE/config numbers and balance tuning."
---

# MTC The Game — Stable Architecture (SKILL)

Use this skill when changing gameplay systems, entities, render dispatch, load order, globals, `GameState`, AI/worker flows, or boss lifecycle.

**Out of scope here:** any numeric tuning, cooldowns, damage, economy, or feature lists that live in `js/config.js` / `BALANCE` / changelogs.

---

## 1. Class hierarchy (inheritance)

Root: `Entity` (`js/entities/base.js`) — position, physics, `HealthComponent` pattern for combatants.

- **`Player`** (`js/entities/player/PlayerBase.js`, exported as `window.Player`)
  - `KaoPlayer`, `AutoPlayer`, `PoomPlayer`, `PatPlayer`
- **`EnemyBase`** (`js/entities/enemy.js`)
  - `Enemy`, `TankEnemy`, `MageEnemy`
- **`BossBase`** (`js/entities/boss/BossBase.js`)
  - `KruManop` (class in `ManopBoss.js`), `KruFirst` (class in `FirstBoss.js`)
- **Other `Entity` subclasses** (non-exhaustive; extend via boss/summon modules):
  - `BossDog` (same module family as Manop boss content)
  - Summons and boss-linked entities in `js/entities/summons.js` (includes `Drone extends Entity`)
  - Boss attack / minion classes defined in `boss_attacks_*.js` as applicable

**Rendering:** `PlayerRenderer`, `BossRenderer` are not entity subclasses — they are static draw dispatchers keyed off runtime types (`instanceof` / constructor identity). `EnemyRenderer` and `ProjectileRenderer` are used from `game.js` for enemies, powerups, and projectiles.

---

## 2. Update vs draw (hard rule)

- **`update(dt, …)`** — owns simulation: movement intent, timers, combat resolution hooks, AI, status effects.
- **`draw(ctx)` / renderer `draw(...)`** — reads entity state and issues canvas operations only.

**Forbidden in draw paths:** mutating gameplay state (HP, energy, cooldowns, wave flags, score, entity positions for simulation purposes, AI internal state).  

**Allowed:** render-only caches (e.g. easing buffers used only for visuals), `ctx.save`/`restore`, and diagnostics stored only on function objects for logging — never authoritative game state.

**Entity base note:** `_standAura_update` vs `_standAura_draw` in `base.js` — update belongs in the simulation tick; draw helpers must not advance gameplay rules.

---

## 3. Enemy `_tickShared(dt, player)` invariant

Defined on `EnemyBase` (`js/entities/enemy.js`). Every concrete enemy `update()` must:

1. Return immediately if `this.dead` (when that guard exists).
2. Call **`this._tickShared(dt, player)`** as the **first** substantive step of the living path — before movement, steering, or shooting.

Skipping or reordering breaks shared status/AI/hit-flash/ignite behavior across enemy types.

---

## 4. Script load order (contract)

Order is fixed in `index.html`. Anything that defines globals consumed later must appear **above** consumers.

**Pre-game / services (before `config.js`):**

1. `js/firebase-bundle.js` — Firebase SDK init (`window.firebaseAuth`, `MTCFirebase`, …).
2. `js/config.js` — game constants and text tables.
3. `js/utils.js` — persistence helpers, math, camera, score/wave accessors.
4. `js/systems/CloudSaveSystem.js` — cloud sync (depends on utils + Firebase).
5. `js/systems/LeaderboardUI.js` — auth UI hook (depends on utils + Firebase).

**Core engine:**

6. `js/audio.js` → `effects.js` → `weapons.js` → `map.js` → `ui.js` → `tutorial.js`

**Entities & AI:**

7. `js/entities/base.js`
8. `js/ai/UtilityAI.js` → `EnemyActions.js` → `PlayerPatternAnalyzer.js` → `SquadAI.js`
9. Player classes → `summons.js` → `enemy.js` → boss attack modules → `BossBase.js` → `ManopBoss.js` → `FirstBoss.js`

**Input & render:**

10. `js/input.js`
11. `js/rendering/PlayerRenderer.js` → `BossRenderer.js`

**Systems & loop:**

12. `GameState.js` → `AdminSystem.js` → `ShopSystem.js` → `TimeManager.js` → `WaveManager.js` → `WorkerBridge.js`
13. `js/game.js` → `VersionManager.js` → `menu.js`

New scripts must be inserted where dependency direction allows (consumers after providers).

---

## 5. Frame loop modes (`js/game.js`)

`gameLoop` drives all frames. Modes:

- **Hit-stop:** while `GameState.hitStopTimer > 0`, **`drawGame()` only`** — no `updateGame`.
- **`PLAYING` + tutorial active:** `TutorialSystem.update()` always; **`updateGame`** runs only when `TutorialSystem.isActionStep()` is true; then `drawGame`.
- **`PLAYING` (normal):** `updateGame` then `drawGame`.
- **`PAUSED`:** `drawGame` only (frozen simulation).
- **`GAMEOVER`:** loop stops; static menu/victory DOM takes over.

This is an architectural constraint: tutorial and hit-stop deliberately bypass full simulation on some frames.

---

## 6. Canonical state ownership

- **`GameState`** (`js/systems/GameState.js`) — phase (`MENU` / `PLAYING` / `PAUSED` / `GAMEOVER`), loop flags, entity references, hit-stop / time scale, glitch-wave flags. It syncs selected fields to legacy `window.*` aliases — new code should prefer `GameState` and existing sync methods.
- **Globals:** `window.player`, `window.enemies`, `window.boss`, `window.powerups`, `window.drone`, etc. Many modules assume these exist during `PLAYING`. Refactors must preserve shape and sync timing.

---

## 7. Hidden cross-module coupling

- **Worker pipeline:** `WorkerBridge` ↔ `js/workers/analyzer-worker.js` — sampled inputs feed analyzer state consumed by AI (`PlayerPatternAnalyzer` / related). Changing sampling frequency or message schema affects difficulty and fairness.
- **Shop / map / UI:** `ShopManager`, `MTC_SHOP_LOCATION`, `MTC_DATABASE_SERVER` — proximity and pause behavior tie `game.js`, `ShopSystem.js`, `ui.js`, `input.js`.
- **Campus procedural map:** `MapSystem.generateCampusMap` (`js/map.js`) uses `_isClearZone` and center-anchored cluster placement; footprint sizes for placement must stay aligned with the map configuration consumed by that generator (navigation and collisions depend on consistent object layout).
- **Wave / boss:** `WaveManager`, `game.js`, `BossBase` subclasses, and admin commands share boss spawn/cleanup paths — attack singletons must be cleared on every exit path.
- **Firebase (optional):** `firebase-bundle` and `CloudSaveSystem` run after utils; failure must not block offline play.

---

## 8. Boss lifecycle contract

Boss spawn, phase transitions, defeat, and admin-forced clears must all run the same cleanup for boss-owned singletons and attack state. Asymmetric cleanup causes stale attacks or orphaned entities.

---

## 9. Safe change checklist

1. Preserve `index.html` load order semantics.
2. Preserve update/draw separation and `_tickShared` ordering.
3. Prefer `GameState` + documented sync over new globals.
4. When touching workers, verify analyzer consumers still agree on data shape.
5. Document new coupling edges in project overview or rendering skill if they affect architecture.

---

## 10. Related skills

- **Rendering pipeline detail:** `mtc-rendering.md` (draw phases, renderers, HUD ownership).
- **Project narrative baseline:** `Markdown Source/Information/PROJECT_OVERVIEW.md`.
