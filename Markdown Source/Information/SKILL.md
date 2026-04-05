# MTC Game — Architectural Conventions (SKILL.md)
**Status:** mtc-cache-v3.41.17a

> **SCOPE:** This document captures stable architectural patterns only. It intentionally excludes balance values, cooldowns, damage numbers, economy tuning, and other volatile `BALANCE` details.

---

## 1) Canonical Class Map

| Constructor | Window export / alias | File |
|---|---|---|
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
| `GarudaEntity` | `window.GarudaEntity` | `js/entities/summons.js` |
| `Drone` | `window.Drone`, `window.DroneEntity` | `js/entities/summons.js` |
| `GoldfishMinion` | (no window export) | `js/entities/boss/boss_attacks_manop.js` |
| `HealthComponent` | (no window export) | `js/entities/base.js` |
| `ENEMY_REGISTRY` | `window.ENEMY_REGISTRY` | `js/entities/enemy.js` |

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
│   │   ├── SummonerEnemy
│   │   ├── BufferEnemy
│   │   └── SummonedMinionEnemy
│   ├── TankEnemy
│   │   └── ShieldBraverEnemy
│   └── MageEnemy
├── BossBase
│   ├── KruManop
│   └── KruFirst
├── BossDog                  (Entity direct — not EnemyBase or BossBase)
├── GoldfishMinion           (Entity direct — boss attack minion)
├── NagaEntity               (Entity direct — Poom summon)
├── GarudaEntity             (Entity direct — Poom summon)
└── Drone                    (Entity direct — Auto/all characters)
```

Notes:
- `TankEnemy` and `MageEnemy` are direct `EnemyBase` subclasses. All other named enemy types descend through `Enemy`.
- `ShieldBraverEnemy` extends `TankEnemy`, not `EnemyBase` directly.
- `BossDog`, `GoldfishMinion`, `NagaEntity`, `GarudaEntity`, and `Drone` extend `Entity` directly; they are not `EnemyBase` descendants and do not go through `_tickShared()`.
- `SummonedMinionEnemy` extends `Enemy` and therefore participates in the `EnemyBase` shared contracts (`_tickShared`, `_ai`, `statusEffects`).
- `PowerUp` is not part of the `Entity` inheritance tree but is rendered through `EnemyRenderer`.
- `HealthComponent` is defined in `base.js` alongside `Entity`. It is composed in via `this.health = new HealthComponent(maxHp)`. Proxy getters (`hp`, `maxHp`, `dead`, `hitFlashTimer`) preserve backward-compatible call sites.

---

## 3) Update and Draw Separation

- `update(...)` owns simulation, timers, AI, damage, spawning, status effects, and physics writes.
- `draw(...)` and renderer entry points own canvas output only.
- Draw code must not mutate authoritative state such as HP, cooldowns, score, wave flags, entity arrays, or AI intent.

Allowed draw-side behavior:
- renderer-local caches
- deterministic visual oscillation
- `ctx` setup and cleanup

Forbidden draw-side behavior:
- spawning projectiles, enemies, or special effects
- modifying `window.enemies`, `window.specialEffects`, `projectileManager`, or `GameState`
- ticking cooldowns or status timers

---

## 4) Enemy Contracts

### 4.1 `_tickShared(dt, player)` invariant

Every concrete enemy `update()` must:
1. exit early if the enemy is dead
2. call `this._tickShared(dt, player)` as the first living-path gameplay operation
3. run movement, attacks, and per-class state only after that shared tick

### 4.2 AI intent contract

- `UtilityAI` writes `_aiMoveX` and `_aiMoveY` only.
- Physics velocities remain `vx` and `vy`.
- Enemy subclasses may blend AI intent with bespoke movement, but they must preserve the separation between AI intent and physics application.

### 4.3 Spawn and role contract

- `WaveManager` and `AdminSystem` both spawn through constructor exports from `window.ENEMY_REGISTRY`.
- `SquadAI.tagOnSpawn(enemy)` must run immediately after new enemies are inserted into `window.enemies`.
- Wave-event modifiers are applied through `window.applyWaveModifiersToEnemy`, not duplicated across callers.

---

## 5) Load Order Contract

This sequence matters:

```text
config.js
utils.js
entities/base.js
ai/UtilityAI.js
ai/EnemyActions.js
ai/PlayerPatternAnalyzer.js
ai/SquadAI.js
entities/player/*
entities/summons.js
entities/enemy.js
entities/boss/*
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

If a file defines globals consumed by later scripts, it must remain above its consumers in `index.html`.

---

## 6) State Ownership and Hidden Coupling

- `GameState` is the canonical owner for phase and loop state, with compatibility mirrors on `window.*`.
- `window.player`, `window.enemies`, `window.boss`, `window.powerups`, and `window.specialEffects` are still shared runtime surfaces across many files.
- `WorkerBridge` and `analyzer-worker.js` feed prediction data back into AI consumers.
- `EnemyRenderer.draw()` temporarily binds `window.CTX` so shared draw helpers and fallback draw paths can render safely.
- `window.ENEMY_REGISTRY` couples `enemy.js`, `WaveManager.js`, and `AdminSystem.js`.

---

## 7) Rendering Structure

- `drawGame()` in `js/game.js` owns frame orchestration.
- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static dispatchers.
- `EnemyRenderer` owns renderer-local body sprite caches.
- `BossRenderer` owns offscreen bitmap caches for stable boss parts.
- Lighting is a separate pass via `mapSystem.drawLighting(...)` that runs **outside** the camera transform (after `CTX.restore()`).

Dispatcher invariants (in check order):
- `PlayerRenderer`: `AutoPlayer` → `PoomPlayer` → `KaoPlayer` → `PatPlayer` → base fallback.
- `BossRenderer`: `KruFirst` → `KruManop` → `BossDog`. `KruFirst` is checked first because both `KruFirst` and `KruManop` extend `BossBase`.
- `EnemyRenderer`: `MageEnemy` → `TankEnemy` → `Enemy` → `PowerUp` → optional fallback `draw()`. Wraps `window.CTX` rebind in `try/finally` so helpers and fallback paths can use the active ctx.
- `BossDog` instances inside the enemies array are routed to `BossRenderer`, not `EnemyRenderer`.

---

## 8) Safe Change Checklist

- Preserve `index.html` dependency order.
- Keep draw paths free of gameplay mutation.
- Keep `_tickShared()` first in all enemy living update paths.
- Keep `GameState` as the canonical owner when adding new loop or phase state.
- Update both project docs and skill docs when class hierarchy, load order, or hidden coupling changes.
