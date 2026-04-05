# MTC Game — Architectural Conventions (SKILL.md)

> Scope: stable architectural patterns only.
> Excludes cooldowns, damage numbers, spawn percentages, economy values, and other volatile `BALANCE` details.

---

## 1) Canonical Class Map

| Constructor | Window export / alias | File |
| --- | --- | --- |
| `Entity` | `window.Entity` | `js/entities/base.js` |
| `Player` | `window.Player` | `js/entities/player/PlayerBase.js` |
| `KaoPlayer` | `window.KaoPlayer` | `js/entities/player/KaoPlayer.js` |
| `AutoPlayer` | `window.AutoPlayer` | `js/entities/player/AutoPlayer.js` |
| `PoomPlayer` | `window.PoomPlayer` | `js/entities/player/PoomPlayer.js` |
| `PatPlayer` | `window.PatPlayer` | `js/entities/player/PatPlayer.js` |
| `EnemyBase` | `window.EnemyBase` | `js/entities/enemy.js` |
| `Enemy` | `window.Enemy` | `js/entities/enemy.js` |
| `TankEnemy` | `window.TankEnemy` | `js/entities/enemy.js` |
| `MageEnemy` | `window.MageEnemy` | `js/entities/enemy.js` |
| `SniperEnemy` | `window.SniperEnemy` | `js/entities/enemy.js` |
| `ShieldBraverEnemy` | `window.ShieldBraverEnemy` | `js/entities/enemy.js` |
| `PoisonSpitterEnemy` | `window.PoisonSpitterEnemy` | `js/entities/enemy.js` |
| `ChargerEnemy` | `window.ChargerEnemy` | `js/entities/enemy.js` |
| `HunterEnemy` | `window.HunterEnemy` | `js/entities/enemy.js` |
| `FatalityBomberEnemy` | `window.FatalityBomberEnemy` | `js/entities/enemy.js` |
| `HealerEnemy` | `window.HealerEnemy` | `js/entities/enemy.js` |
| `SummonerEnemy` | `window.SummonerEnemy` | `js/entities/enemy.js` |
| `BufferEnemy` | `window.BufferEnemy` | `js/entities/enemy.js` |
| `SummonedMinionEnemy` | `window.SummonedMinionEnemy` | `js/entities/enemy.js` |
| `PowerUp` | `window.PowerUp` | `js/entities/enemy.js` |
| `BossBase` | `window.BossBase` | `js/entities/boss/BossBase.js` |
| `KruManop` | `window.KruManop`, `window.ManopBoss`, `window.Boss` | `js/entities/boss/ManopBoss.js` |
| `KruFirst` | `window.KruFirst`, `window.BossFirst` | `js/entities/boss/FirstBoss.js` |
| `BossDog` | `window.BossDog` | `js/entities/boss/ManopBoss.js` |
| `NagaEntity` | `window.NagaEntity` | `js/entities/summons.js` |
| `Drone` | `window.Drone` | `js/entities/summons.js` |
| `GarudaEntity` | `window.GarudaEntity` | `js/entities/summons.js` |
| `ENEMY_REGISTRY` | `window.ENEMY_REGISTRY` | `js/entities/enemy.js` |

Supporting runtime classes that matter architecturally:

- `HealthComponent` in `js/entities/base.js`
- `KaoClone` in `js/entities/player/KaoPlayer.js`
- `WanchaiStand` in `js/entities/player/AutoPlayer.js`
- `PoisonPoolEffect` and `FatalityExplosionEffect` in `js/entities/enemy.js`

---

## 2) Inheritance Chain

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

Notes:

- `BossDog` is not an `EnemyBase` subclass.
- `PowerUp` is not part of the `Entity` tree.
- JavaScript does not use formal interfaces here.
- The shared behavioral contract is method-based: `update()`, `draw()`, `takeDamage()`, and `_tickShared()` where applicable.

---

## 3) Update and Draw Separation

- `update(...)` owns simulation, timers, AI, damage, spawning, state transitions, and physics writes.
- `draw(...)` and renderer entry points own pixel output only.
- Draw code must not mutate authoritative gameplay state.

Allowed draw-side behavior:

- renderer-local caches
- deterministic visual oscillation from read-only state
- `ctx.save()` and `ctx.restore()`
- viewport culling

Forbidden draw-side behavior:

- mutating HP, cooldowns, score, or phase
- mutating `GameState`
- mutating `window.enemies`, `window.specialEffects`, `projectileManager`, or wave state
- spawning gameplay entities or ticking gameplay timers

---

## 4) Enemy Contracts

### 4.1 `_tickShared(dt, player)` invariant

Every concrete enemy `update()` must:

1. exit immediately if dead
2. call `this._tickShared(dt, player)` as the first living-path step
3. run subclass movement, attacks, and bespoke state after that call

`_tickShared()` centralizes:

- status-effect ticking
- hit-flash decay
- ignite and shatter reactions
- shared enemy buff timers
- `UtilityAI` consumption

### 4.2 AI intent contract

- `UtilityAI` writes `_aiMoveX` and `_aiMoveY` only.
- Enemy subclasses choose how to convert that intent into `vx` and `vy`.
- `Entity.applyPhysics(dt)` remains the shared physics integration point.

### 4.3 Spawn and modifier contract

- `WaveManager` and `AdminSystem` both depend on `window.ENEMY_REGISTRY`.
- `SquadAI.tagOnSpawn(enemy)` must run after inserting new enemies into `window.enemies`.
- Wave modifiers are applied through `window.applyWaveModifiersToEnemy`.

---

## 5) Load Order Contract

This exact high-level sequence matters:

```text
config.js
utils.js
firebase-bundle.js
systems/CloudSaveSystem.js
systems/LeaderboardUI.js
audio.js
effects.js
weapons.js
map.js
ui.js
tutorial.js
entities/base.js
ai/UtilityAI.js
ai/EnemyActions.js
ai/PlayerPatternAnalyzer.js
ai/SquadAI.js
entities/player/PlayerBase.js
entities/player/KaoPlayer.js
entities/player/AutoPlayer.js
entities/player/PoomPlayer.js
entities/player/PatPlayer.js
entities/summons.js
entities/enemy.js
entities/boss/boss_attacks_shared.js
entities/boss/boss_attacks_manop.js
entities/boss/boss_attacks_first.js
entities/boss/BossBase.js
entities/boss/ManopBoss.js
entities/boss/FirstBoss.js
input.js
rendering/PlayerRenderer.js
rendering/BossRenderer.js
systems/GameState.js
systems/AdminSystem.js
systems/ShopSystem.js
systems/TimeManager.js
systems/WaveManager.js
systems/WorkerBridge.js
game.js
VersionManager.js
menu.js
```

Load-order rules:

- constructors must load before `instanceof`-based render dispatch
- `GameState` must load before `game.js`
- `WaveManager` must load before gameplay wants `startNextWave()`
- `WorkerBridge` and analyzer worker logic must exist before boss prediction sampling is used

---

## 6) State Ownership and Hidden Coupling

- `GameState` is the canonical owner for phase, loop, and run-scoped mutable state.
- `GameState._syncAliases()` mirrors canonical state back into compatibility globals on `window.*`.
- `window.player`, `window.enemies`, `window.boss`, `window.powerups`, and `window.specialEffects` remain shared runtime surfaces.
- `window.ENEMY_REGISTRY` couples `enemy.js`, `WaveManager.js`, and `AdminSystem.js`.
- `window.applyWaveModifiersToEnemy` couples wave spawning, admin spawning, and summoner spawning.
- `WorkerBridge` writes prediction caches directly onto `window.playerAnalyzer`.
- `EnemyRenderer.draw()` temporarily binds `window.CTX` for shared helpers and fallback draw paths.
- `CanvasHUD` depends on runtime globals such as fog-wave state even though it is a HUD layer.

---

## 7) Rendering Structure

- `drawGame()` in `js/game.js` owns frame orchestration.
- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static dispatchers.
- `MapSystem` owns terrain and lighting caches.
- `CanvasHUD.draw()` is the primary HUD pass.
- `UIManager.draw()` is the compatibility fallback.
- `TutorialSystem.draw()` is last.

Dispatcher invariants:

- Boss rendering depends on constructor identity.
- Enemy rendering dispatch order matters.
- `MageEnemy` must be checked before broader enemy fallbacks.

---

## 8) Safe Change Checklist

- Preserve `index.html` dependency order.
- Keep draw paths free of gameplay mutation.
- Keep `_tickShared()` first in all enemy living update paths.
- Keep `GameState` as the canonical owner when adding new loop or phase state.
- Document any new shared global, registry, worker bridge, or render dependency in the architecture docs.
