---
name: mtc-game-conventions
description: "Stable MTC The Game architecture: full class hierarchy, strict update-versus-draw separation, exact script load order, EnemyBase shared-tick invariant, GameState alias ownership, enemy registry coupling, and worker or render hidden dependencies. Excludes BALANCE values, stats, and release-specific tuning."
---

# MTC The Game — Stable Architecture

Use this skill when changing entities, AI, rendering dispatch, load order, globals, `GameState`, wave spawning, or boss lifecycle.

Do not use this file for cooldowns, damage, spawn percentages, economy values, or other volatile config details.

---

## 1. Class hierarchy

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

Supporting runtime classes that matter architecturally:

- `HealthComponent`
- `KaoClone`
- `WanchaiStand`
- `PoisonPoolEffect`
- `FatalityExplosionEffect`

Important aliases:

- `KruManop` is also exported as `window.KruManop`, `window.ManopBoss`, and `window.Boss`
- `KruFirst` is also exported as `window.KruFirst` and `window.BossFirst`
- enemy constructors are mirrored through `window.ENEMY_REGISTRY`

---

## 2. Update versus draw

- `update(...)` owns authoritative simulation state.
- `draw(...)` and renderer `draw(...)` methods only read state and emit pixels.

Never mutate inside draw:

- HP
- cooldowns
- score
- phase
- wave state
- AI state
- entity arrays
- projectile arrays

Allowed inside draw:

- renderer-local caches
- `ctx.save()` and `ctx.restore()`
- deterministic visual animation from read-only state
- viewport culling

---

## 3. Enemy shared-tick invariant

`EnemyBase._tickShared(dt, player)` must run first in every living enemy update path.

That invariant protects:

- status-effect ticking
- shared hit-flash decay
- ignite and shatter handling
- shared enemy buff timers
- shared AI consumption

AI contract:

- `UtilityAI` writes `_aiMoveX` and `_aiMoveY`
- enemy subclasses decide how to blend that intent into `vx` and `vy`
- `Entity.applyPhysics(dt)` remains the shared physics integration point

---

## 4. Exact script load order

Load order in `index.html` is a hard contract:

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

If a script defines globals consumed later, it must remain above those consumers.

---

## 5. Canonical ownership

- `GameState` is the canonical owner for game phase, loop state, and run-scoped mutable state.
- `GameState._syncAliases()` mirrors canonical state back to compatibility globals.
- `window.player`, `window.enemies`, `window.boss`, `window.powerups`, and `window.specialEffects` remain shared runtime surfaces.
- `WaveManager` owns wave progression, event activation, trickle spawning, and boss-wave entry.
- `drawGame()` in `js/game.js` owns frame orchestration.

---

## 6. Hidden coupling to preserve

- `window.ENEMY_REGISTRY` couples `enemy.js`, `WaveManager.js`, and `AdminSystem.js`.
- `window.applyWaveModifiersToEnemy` is reused by normal spawns, admin spawns, and summoner-created minions.
- `WorkerBridge` and `analyzer-worker.js` feed prediction data back into `window.playerAnalyzer`.
- `EnemyRenderer.draw()` temporarily binds `window.CTX` for shared draw helpers and fallback draw paths.
- `mapSystem.drawLighting(...)` depends on player state, projectile collections, landmark lights, camera transforms, and screen shake state prepared elsewhere.
- `CanvasHUD` reads wave-state globals such as fog-wave blackout state.

---

## 7. Rendering boundaries

- `PlayerRenderer`, `BossRenderer`, `EnemyRenderer`, and `ProjectileRenderer` are static render dispatchers.
- `MapSystem` owns terrain and lighting caches.
- Renderer caches belong to render modules or managers, not gameplay entities.
- HUD ownership stays in `CanvasHUD` with `UIManager.draw` as fallback.
- `TutorialSystem.draw` is last.

---

## 8. Safe change checklist

1. Preserve `index.html` load order semantics.
2. Keep draw paths free of gameplay mutation.
3. Keep `_tickShared()` first in all enemy living update paths.
4. Prefer `GameState` over adding new state owners.
5. Document any new shared global, registry, worker bridge, or render dependency when structure changes.
