---
name: mtc-game-conventions
description: "Stable MTC The Game architecture: class hierarchy, update-versus-draw separation, script load order, EnemyBase shared-tick invariants, GameState ownership, enemy registry coupling, and worker/render hidden dependencies. Excludes BALANCE values and release-specific tuning."
---

# MTC The Game — Stable Architecture

Use this skill when changing entities, AI, rendering dispatch, load order, globals, `GameState`, wave spawning, or boss lifecycle.

Do not use this file for balance values, cooldowns, damage, economy, or other volatile config details.

---

## 1. Class hierarchy

Root: `Entity` in `js/entities/base.js`

- `Player` in `js/entities/player/PlayerBase.js`
  - `KaoPlayer`
  - `AutoPlayer`
  - `PoomPlayer`
  - `PatPlayer`
- `EnemyBase` in `js/entities/enemy.js`
  - `Enemy` (direct `EnemyBase` child — most specific types inherit from here)
    - `SniperEnemy`, `PoisonSpitterEnemy`, `ChargerEnemy`, `HunterEnemy`
    - `FatalityBomberEnemy`, `HealerEnemy`, `SummonerEnemy`, `BufferEnemy`
    - `SummonedMinionEnemy`
  - `TankEnemy` (direct `EnemyBase` child)
    - `ShieldBraverEnemy`
  - `MageEnemy` (direct `EnemyBase` child)
- `BossBase` in `js/entities/boss/BossBase.js`
  - `KruManop`
  - `KruFirst`
- direct `Entity` subclasses (not `EnemyBase` or `BossBase`)
  - `BossDog` (`js/entities/boss/ManopBoss.js`)
  - `GoldfishMinion` (`js/entities/boss/boss_attacks_manop.js`)
  - `Drone` (`js/entities/summons.js`, also `window.DroneEntity`)
  - `NagaEntity` (`js/entities/summons.js`)
  - `GarudaEntity` (`js/entities/summons.js`, `window.GarudaEntity`)

Important aliases:
- `KruManop` is also exported as `window.ManopBoss` and `window.Boss`
- `KruFirst` is also exported as `window.BossFirst`
- `Drone` is also exported as `window.DroneEntity`
- enemy constructors are additionally exposed through `window.ENEMY_REGISTRY`

Inheritance notes:
- `TankEnemy` and `MageEnemy` are direct `EnemyBase` subclasses. All other named enemy types go through `Enemy` first.
- `ShieldBraverEnemy` extends `TankEnemy`, not `EnemyBase` directly.
- `BossDog`, `GoldfishMinion`, `NagaEntity`, `GarudaEntity`, and `Drone` extend `Entity` directly and do **not** participate in `_tickShared()`.
- `HealthComponent` is defined in `js/entities/base.js` alongside `Entity`. Composed in via `this.health = new HealthComponent(maxHp)` with proxy getters to keep call sites backward-compatible.

---

## 2. Update versus draw

- `update(...)` owns authoritative simulation state.
- `draw(...)` and renderer `draw(...)` methods only read state and emit pixels.

Never mutate inside draw:
- HP, cooldowns, wave flags, score, phase, AI state, entity arrays, projectile arrays

Allowed inside draw:
- renderer-local caches
- `ctx.save()` and `ctx.restore()`
- deterministic visual animation based on read-only state

---

## 3. Enemy shared-tick invariant

`EnemyBase._tickShared(dt, player)` must run first in every living enemy update path.

That invariant protects:
- status-effect ticking
- shared hit-flash decay
- shared enemy buff timers
- shared AI tick and role consumption

AI contract:
- `UtilityAI` writes `_aiMoveX` and `_aiMoveY`
- enemy subclasses decide how to blend that intent into `vx` and `vy`

---

## 4. Script load order

Load order in `index.html` is a hard contract:

```text
config -> utils -> base -> AI files -> player files -> summons -> enemy ->
boss files -> input -> renderers -> GameState -> systems -> WaveManager ->
WorkerBridge -> game -> VersionManager -> menu
```

If a script defines globals consumed later, it must remain above those consumers.

---

## 5. Canonical ownership

- `GameState` is the canonical owner for game phase and loop state.
- `window.player`, `window.enemies`, `window.boss`, `window.powerups`, and `window.specialEffects` remain shared compatibility surfaces.
- `WaveManager` owns wave progression and boss-wave entry.
- `drawGame()` in `js/game.js` owns frame orchestration.

---

## 6. Hidden coupling to preserve

- `window.ENEMY_REGISTRY` couples `enemy.js`, `WaveManager.js`, and `AdminSystem.js`.
- `window.applyWaveModifiersToEnemy` is reused by normal spawns, admin spawns, and summoner-created minions.
- `WorkerBridge` and `analyzer-worker.js` feed prediction data back into AI consumers.
- `EnemyRenderer.draw()` saves the previous `window.CTX`, rebinds it to the active `ctx`, then restores in a `try/finally` block. This lets fallback `draw()` paths and shared helpers reach the canvas safely.
- Lighting runs through `mapSystem.drawLighting(...)` **outside** the camera transform — after `CTX.restore()` ends the world-space translate.

---

## 7. Rendering boundaries

- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static render dispatchers.
- Renderer caches belong to renderer modules, not gameplay entities.
- HUD ownership stays in `CanvasHUD` with `UIManager.draw` as fallback.
- Tutorial overlay is last.

Dispatch check order (matters for `instanceof` correctness):
- `PlayerRenderer`: `AutoPlayer` → `PoomPlayer` → `KaoPlayer` → `PatPlayer` → base
- `BossRenderer`: `KruFirst` → `KruManop` → `BossDog` (KruFirst first because both extend BossBase)
- `EnemyRenderer`: `MageEnemy` → `TankEnemy` → `Enemy` → `PowerUp` → fallback `e.draw()`
- `BossDog` in the enemies array routes to `BossRenderer`, not `EnemyRenderer`

---

## 8. Safe change checklist

1. Preserve `index.html` load order semantics.
2. Keep draw paths free of gameplay mutation.
3. Keep `_tickShared()` first in all enemy living update paths.
4. Prefer `GameState` over adding new global state owners.
5. Document new hidden coupling in the project overview or rendering skill when structure changes.
