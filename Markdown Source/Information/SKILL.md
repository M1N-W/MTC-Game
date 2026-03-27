# MTC Game — Architectural Conventions (SKILL.md)
**Status:** mtc-cache-v3.41.9

> **SCOPE:** This document captures timeless architectural patterns, invariants, and cross-module contracts that remain stable across balance updates. It intentionally omits all numeric values, damage numbers, cooldown thresholds, and config keys tied to `BALANCE`/`GAME_CONFIG`.

---

## §2 Class Name Map (constructor → window alias)

| Constructor      | window export        | Alias(es)                          | File                              |
|-----------------|---------------------|------------------------------------|-----------------------------------|
| `PlayerBase`     | `window.Player`      | _(base only)_                      | `entities/player/PlayerBase.js`   |
| `KaoPlayer`      | `window.KaoPlayer`   | _(none)_                           | `entities/player/KaoPlayer.js`    |
| `AutoPlayer`     | `window.AutoPlayer`  | _(none)_                           | `entities/player/AutoPlayer.js`   |
| `PoomPlayer`     | `window.PoomPlayer`  | _(none)_                           | `entities/player/PoomPlayer.js`   |
| `PatPlayer`      | `window.PatPlayer`   | _(none)_                           | `entities/player/PatPlayer.js`    |
| `EnemyBase`      | _(internal)_         | _(none)_                           | `entities/enemy.js`               |
| `Enemy`          | `window.Enemy`       | _(none)_                           | `entities/enemy.js`               |
| `TankEnemy`      | `window.TankEnemy`   | _(none)_                           | `entities/enemy.js`               |
| `MageEnemy`      | `window.MageEnemy`   | _(none)_                           | `entities/enemy.js`               |
| `PowerUp`        | `window.PowerUp`     | _(none)_                           | `entities/enemy.js`               |
| `BossBase`       | `window.BossBase`    | _(none)_                           | `entities/boss/BossBase.js`       |
| `KruManop`       | `window.KruManop`    | `window.ManopBoss`, `window.Boss`  | `entities/boss/ManopBoss.js`      |
| `KruFirst`       | `window.KruFirst`    | `window.BossFirst`                 | `entities/boss/FirstBoss.js`      |
| `BossDog`        | `window.BossDog`     | _(none)_                           | `entities/boss/ManopBoss.js`      |
| `NagaEntity`     | _(none)_             | _(none)_                           | `entities/summons.js`             |
| `Drone`          | _(none)_             | _(none)_                           | `entities/summons.js`             |
| `GoldfishMinion` | _(none)_             | _(none)_                           | `entities/boss/boss_attacks_manop.js` |
| `WeaponSystem`   | `window.weaponSystem`| _(singleton instance)_             | `weapons.js`                      |
| `ProjectileManager`| `window.projectileManager`| _(singleton instance)_     | `weapons.js`                      |
| `SpatialGrid`    | _(internal)_         | _(none)_                           | `weapons.js`                      |

---

## §3 Inheritance Chain

```
Entity  (entities/base.js)
├── PlayerBase  (entities/player/PlayerBase.js)  → window.Player
│   ├── KaoPlayer
│   ├── AutoPlayer
│   ├── PoomPlayer
│   └── PatPlayer
├── EnemyBase  (entities/enemy.js)
│   ├── Enemy
│   ├── TankEnemy
│   └── MageEnemy
├── BossBase  (entities/boss/BossBase.js)
│   ├── KruManop  [alias: window.ManopBoss, window.Boss]
│   └── KruFirst  [alias: window.BossFirst]
├── BossDog           ⚠️ extends Entity directly — NOT BossBase/EnemyBase
├── GoldfishMinion    ⚠️ extends Entity directly — NOT EnemyBase
├── NagaEntity        (entities/summons.js)
└── Drone             (entities/summons.js)
```

**Critical dispatch rules:**
- `BossRenderer.draw()` MUST check `instanceof KruFirst` BEFORE `instanceof KruManop` — both extend `BossBase`, so checking KruManop first would also match KruFirst.
- `PlayerRenderer.draw()` checks AutoPlayer → PoomPlayer → KaoPlayer → PatPlayer → fallback.

---

## §4 AI System: Load Order & API

### 4.1 Load Order (must follow this sequence)
```
config.js
entities/base.js
ai/UtilityAI.js
ai/EnemyActions.js
ai/PlayerPatternAnalyzer.js
ai/SquadAI.js
entities/player/...
entities/enemy.js        ← integrates UtilityAI + SquadAI
entities/boss/...
...
systems/WorkerBridge.js  ← wraps PlayerPatternAnalyzer off-thread
game.js                  ← calls all AI update hooks per frame
```

### 4.2 Public API Method Names

| Class / Singleton       | Method                                | Called From          | Frequency   |
|------------------------|---------------------------------------|----------------------|-------------|
| `UtilityAI`             | `.tick(dt, player, enemies)`          | `EnemyBase.update()` | Every frame (internally throttled) |
| `SquadAI` (singleton)   | `.update(dt, enemies, player)`        | `game.js updateGame` | Every frame (internally throttled 1Hz) |
| `SquadAI` (static)      | `.tagOnSpawn(enemy)`                  | `WaveManager.spawnEnemies()` | On spawn |
| `PlayerPatternAnalyzer` | `.sample(dt, player, boss)`           | `WorkerBridge.sendSample()` OR game.js fallback | Every frame (internally throttled 10Hz) |
| `PlayerPatternAnalyzer` | `.update(dt)`                         | game.js / fallback   | Every frame (internally throttled 4Hz) |
| `PlayerPatternAnalyzer` | `.dominantPattern()`                  | Boss AI, KruManop/KruFirst | Read cache any frame |
| `PlayerPatternAnalyzer` | `.kitingScore()`, `.circlingScore()`, `.standingScore()` | Boss AI | Read cache any frame |
| `PlayerPatternAnalyzer` | `.predictedPosition(aheadSeconds)`    | Boss projectile aim  | Read any frame |
| `PlayerPatternAnalyzer` | `.reset()`                            | Boss death, phase break | On event |
| `WorkerBridge`          | `.init()`                             | game.js `startGame()` | Once |
| `WorkerBridge`          | `.sendSample(dt, player, boss)`       | game.js updateGame   | Every frame |
| `WorkerBridge`          | `.reset()`                            | Boss death           | On event |

### 4.3 UtilityAI Decision Timer Pattern
- Decision interval driven by `BALANCE.ai.decisionInterval` (read at construction, not hardcoded).
- `_aiTimer` accumulates `dt`; decision only fires when `_aiTimer <= 0`.
- Initial timer offset: `Math.random() * 0.5` — staggers decisions across the enemy group.
- Writes `enemy._aiMoveX` / `enemy._aiMoveY` only — never touches `vx`/`vy` directly.

---

## §5 Critical Property Rules

### 5.1 Physics Velocity
- Physics: `entity.vx`, `entity.vy` (never `velocity.x`, `dx`, `dy` for physics application)
- AI movement direction: `entity._aiMoveX`, `entity._aiMoveY` (separate from physics vel)
- Dash impulse uses `vx`/`vy` directly; AI uses `_aiMove*` blend; both are never the same variable

### 5.2 Move Speed
- **Players:** `player.stats.moveSpeed` — the authoritative speed value used in physics
- **Enemies:** `enemy.speed` (flat property, not under `.stats`)
- **Boss subclasses:** `boss.moveSpeed` (flat, like enemies)
- ⚠️ Slow debuffs (PhysicsFormulaZone, BubbleProjectile) write to `player.stats.moveSpeed` — never to `entity.moveSpeed` for player characters.

### 5.3 Cooldown Keys (Player)
- All player skill cooldowns live on `player.cooldowns` object, not as flat properties.
- Examples (key names, not values): `cooldowns.dash`, `cooldowns.naga`, `cooldowns.vacuum`, `cooldowns.wanchai`, `cooldowns.ritual`, `cooldowns.iaido`, `cooldowns.zanzo`, `cooldowns.eat`, `cooldowns.garuda`, `cooldowns.detonation`

### 5.4 Hit Flash
- `entity._hitFlashTimer` — countdown to 0 (not a boolean)
- `entity._hitFlashBig` — boolean flag for "large" flash on critical/heavy hits
- Renderer checks both: big flash uses different radius expansion

### 5.5 Enemy Type Discriminant
- `enemy.type` string: `'basic'` | `'tank'` | `'mage'`
- Used by SquadAI for role assignment and EnemyRenderer for visual selection
- `BossDog` type is accessible but never matches 'basic'/'tank'/'mage' patterns

### 5.6 StatusEffect Timing
- `_tickShared(dt, player)` must be called at the **very beginning** of every living enemy's update path — after the `if (this.dead) return` guard, before any movement or combat logic.
- `_tickShared` owns: status tick (ignite, slow, shatter reaction), hit flash decay, UtilityAI.tick(), and SquadAI role read.
- Violating this order can cause status effects to fire in the wrong frame or AI decisions to be skipped.

### 5.7 Squad Role Property
- `entity._squadRole`: `'assault'` | `'flanker'` | `'shield'` | `'support'`
- Set immediately on spawn via `SquadAI.tagOnSpawn(e)` so role exists before first SquadAI tick.
- SquadAI logic: `type === 'tank'` → always `'shield'`; `type === 'mage'` → always `'support'`.

---

## §6 Global Window Variables (Canonical Exports)

### 6.1 Canvas & Rendering Globals (from `utils.js`)
- `CANVAS` — `HTMLCanvasElement`
- `CTX` — `CanvasRenderingContext2D`
- `camera` — `{ x, y }` object updated each frame by `updateCamera()`
- `worldToScreen(wx, wy)` → `{x, y}` — maps world coords to screen pixels
- `screenToWorld(sx, sy)` → `{x, y}` — inverse transform

### 6.2 Entity References (set by `game.js`)
- `window.player` — active `PlayerBase` subclass instance
- `window.enemies` — `Enemy[]` live array
- `window.boss` — `BossBase` subclass | `null`
- `window.drone` — `Drone` | `null`
- `window.powerups` — `PowerUp[]`
- `window.specialEffects` — mixed effect objects (DomainExpansion, BubbleProjectile, etc.)
- `window.lastBossKilled` — `boolean` flag set to `true` just before `window.boss = null` on death; used by achievement check

### 6.3 State Machine
- `window.gameState` — `'MENU'` | `'PLAYING'` | `'PAUSED'` | `'GAMEOVER'`
- `GameState` (from `systems/GameState.js`) — canonical owner; `window.gameState` is a compatibility alias
- Prefer `GameState.setPhase()` for state transitions; avoid setting `window.gameState` directly from new code

### 6.4 System Singletons
- `window.mapSystem` — `MapSystem` instance
- `window.weaponSystem` — `WeaponSystem` instance (also `var weaponSystem` in global scope)
- `window.projectileManager` — `ProjectileManager` instance
- `window.squadAI` — `SquadAI` instance
- `window.playerAnalyzer` — `PlayerPatternAnalyzer` instance (proxy when `WorkerBridge` active)
- `window.WorkerBridge` — bridge to `js/workers/analyzer-worker.js`
- `window.UIManager`, `window.CanvasHUD`, `window.Achievements`, `window.ShopManager`
- `window.Audio` — `AudioSystem` instance (⚠️ shadows native `window.Audio` constructor — use `document.createElement('audio')` instead of `new Audio()`)

### 6.5 Input Globals (from `input.js`)
- `keys` — `{ w, a, s, d, space, q, e, b, r, shift, t, f }` keyboard state
- `mouse` — `{ x, y, wx, wy, left, right }` pointer state
- `joysticks` — `{ left, right }` twin-stick state; aliased as `window.touchJoystickLeft/Right`
- `inputBuffer` — `{ space, rightClick, q, e, r }` timestamps for ~200ms buffering
- `checkInput(action, bufferTimeMs)` / `consumeInput(action)` — buffered input helpers

---

## §7 Domain Singleton Behavior

### 7.1 Singleton Architecture
Both `DomainExpansion` (KruManop) and `GravitationalSingularity` (KruFirst) are **singletons** created via:
```javascript
const MySingleton = Object.assign(Object.create(DomainBase), { /* overrides */ });
```
They are **never instantiated with `new`**.

### 7.2 Shared DomainBase API
- `canTrigger()` → `boolean` — checks `phase === 'idle' && cooldownTimer <= 0`
- `isInvincible()` → `boolean` — checks `phase !== 'idle'`
- `_beginCast(boss, castDur)` — sets `phase = 'casting'`, sets `boss._domainActive = true`
- `_endDomain(boss, cooldown)` — resets phase to `'idle'`, clears boss flags
- `abort(boss)` — emergency reset (called on boss death or `kill all` admin command)
- `_initRain(cfg)` — sets up matrix-rain column array (called once per trigger)
- `_announceKaijo(boss, subtitleJP, subtitleEN, colorA, colorB, voiceLine)` — standard domain announcement

### 7.3 Phase State Machine
```
'idle' → canTrigger() → trigger() → 'casting' → 'active' → 'ending' → 'idle'
```
- `boss._domainCasting` and `boss._domainActive` are set/cleared by the base class methods.
- While `_domainActive = true`: boss's `update()` returns early (domain owns the frame).
- On boss death: `BossBase._onDeath()` calls both `DomainExpansion._abort(null)` and `GravitationalSingularity._abort(null)` to prevent `isInvincible()` leaking across waves.

### 7.4 Game.js Integration Hooks
```javascript
// In updateGame():
if (DomainExpansion.phase !== 'idle') DomainExpansion.update(dt, boss, player);
if (GravitationalSingularity.phase !== 'idle') GravitationalSingularity.update(dt, boss, player);

// In drawGame():
if (DomainExpansion.phase !== 'idle') DomainExpansion.draw(CTX);
if (GravitationalSingularity.phase !== 'idle') GravitationalSingularity.draw(CTX);
```

---

## §8 Rendering Layer Order & Rules

### 8.1 Frame Draw Sequence (from `game.js drawGame()`)
```
1.  Clear canvas + background fill
2.  CTX.save() + screen-shake CTX.translate()
3.  mapSystem.drawTerrain(ctx, camera)      — hex grid, circuit paths, zone auras
4.  mapSystem.draw()                         — MapObjects + MTCRoom
5.  decalSystem.draw()                       — floor decals (blood/scorch)
6.  shellCasingSystem.draw()                 — ejected brass casings
7.  specialEffects[] draw loop               — DomainExpansion domain, boss attacks, BubbleProjectile...
8.  powerups[] draw loop                     — PowerUp entities
9.  enemies[] draw loop → EnemyRenderer      — enemy sprites
10. boss  → BossRenderer.draw(boss, ctx)     — boss sprite (null-checked)
11. player → PlayerRenderer.draw(player, ctx)— player sprite + aura
12. drone?.draw()                            — Drone entity
13. projectileManager.draw()                 — projectile sprites
14. particleSystem.draw()                    — particle FX
15. floatingTextSystem.draw()                — damage numbers, status text
16. hitMarkerSystem.draw()                   — hit X crosshairs
17. mapSystem.drawLighting(player, ...)      — shadow overlay (OffscreenCanvas, 30Hz)
18. drawSlowMoOverlay()                      — Bullet Time vignette + ring effects
19. DomainExpansion.draw(ctx)   (if active)  — domain screen overlay
20. GravitationalSingularity.draw(ctx)       — domain screen overlay
21. drawWaveEvent(ctx)                       — fog/speed wave overlays, WaveAnnouncementFX
22. CanvasHUD.draw(ctx, dt)                  — combo counter, minimap, confused warning
23. TutorialSystem.draw(ctx)                 — tutorial canvas highlights (last, always on top)
24. CTX.restore()                            — release screen-shake transform
```

### 8.2 Variable Declaration Rules (Rendering Scope)
- `const now = performance.now()` — always fetch ONCE at top of draw block, pass down
- All animation uses `performance.now()` trig (`Math.sin(now / period)`) — never `Math.random()` inside `draw()`
- `CTX.shadowBlur` MUST be reset to `0` after every usage; the catch-all in `BossRenderer.draw()` also resets it on exit

### 8.3 Update / Draw Separation Invariant
- `draw()` methods and renderer static methods MUST NOT modify gameplay state (HP, cooldowns, position for simulation, score, wave state, etc.)
- Render-local animation caches (e.g., `_bitmapCache`, linger timers) are permitted if they do not feed back into simulation decisions.
- `particleSystem`, `floatingTextSystem`, etc. are updated in `updateGame()` and drawn in `drawGame()` — never both in the same method.

---

## §9 `effects.js` Global Exports

| Export | Type | Description |
|--------|------|-------------|
| `spawnParticles(x, y, count, color)` | Function | Global wrapper → `particleSystem.spawn()` |
| `spawnFloatingText(text, x, y, color, size)` | Function | Global wrapper → `floatingTextSystem.spawn()` |
| `spawnHitMarker(x, y)` | Function | Spawns hit X crosshair via `hitMarkerSystem` |
| `spawnWanchaiPunchText(x, y)` | Function | Spawns "ORA!" impact text for Auto's stand rush |
| `spawnZanzoTrail(x, y, angle, alpha)` | Function | Spawns Pat Zanzo afterimage particle |
| `spawnBloodBurst(x, y)` | Function | Enemy death blood burst |
| `spawnKatanaSlashArc(x, y, angle)` | Function | Pat katana slash energy arc particle |
| `drawGlitchEffect(ctx)` | Function | Glitch wave screen distortion overlay |
| `particleSystem` | `ParticleSystem` instance | Object-pooled particle manager |
| `floatingTextSystem` | `FloatingTextSystem` instance | Object-pooled text popup manager |
| `hitMarkerSystem` | `HitMarkerSystem` instance | Hit X marker manager |
| `weatherSystem` | `WeatherSystem` instance | Rain/snow atmospheric system |
| `decalSystem` | `DecalSystem` instance | Floor decal manager |
| `shellCasingSystem` | `ShellCasingSystem` instance | Brass casing physics manager |
| `waveAnnouncementFX` | `WaveAnnouncementFX` instance | Full-screen wave-start cinematic |
| `updateOrbitalEffects(dt, players)` | Function | Ticks all `OrbitalParticleSystem` instances |
| `drawOrbitalEffects()` | Function | Draws all orbital particle rings |

---

## §10 Poom Special Cases

### 10.1 Weapon / Shoot Bypass
`PoomPlayer` does **NOT** route normal shoot through `WeaponSystem.shootSingle()`.
- `PoomPlayer.shoot()` calls `projectileManager.add(new Projectile(...))` directly.
- This means `weaponSystem.currentWeapon` has no effect on Poom's projectile properties.

### 10.2 Input Routing
| Key / Input | PoomPlayer behaviour |
|-------------|---------------------|
| L-Click (mouse.left) | Fire sticky rice projectiles via `shoot()` |
| R-Click (mouse.right) | `eatRice()` — consume combo stack, heal, apply buff |
| Q | `summonNaga()` — summon NagaEntity (NOT weapon switch) |
| E | `summonGaruda()` — summon Garuda entity |
| R | `ritualBurst()` — AoE from sticky stacks |
| SPACE | Dash (inherited from PlayerBase) |

### 10.3 Combo Stack Architecture
- Poom builds `stickyStacks` on enemy hits; ritual burst consumes all stacks.
- Stack count read by `BossBase` too: `boss.stickyStacks` tracks Poom's stacks applied to the boss.

### 10.4 Cosmic Balance Condition
- Condition: both `naga` AND `garuda` are alive simultaneously.
- When active, `player._cosmicBalance = true`.
- NagaEntity ignite integration: Naga hit ignites enemy when `owner._cosmicBalance`.

---

## §11 AutoPlayer Heat Tier & Wanchai Stand

### 11.1 Heat Tier Names (not values)
```
0 = COLD   (default, low activity)
1 = WARM   (moderate heat)
2 = HOT    (high heat, enhanced fire)
3 = OVERHEAT (peak, passive unlock trigger)
```
- Property: `entity._heatTier` (integer 0–3, not a string)

### 11.2 Q Skill Context Switch
- When `wanchaiActive === false` → Q fires **Vacuum Heat** (pull all nearby enemies)
- When `wanchaiActive === true` AND `passiveUnlocked === true` → Q fires **Stand Pull** (pull from Stand position)
- This context switch is reflected in the ring indicator drawn by `PlayerRenderer._drawAuto()`

### 11.3 Wanchai Stand Entity
- `WanchaiStand` is a separate entity on `player.wanchaiStand`, with its own ghost trail and update loop.
- Rendered by `PlayerRenderer._drawWanchaiStand()` — called AFTER the Auto body draw for correct z-order.
- Stand punch text spawned via `spawnWanchaiPunchText(x, y)` (not via `spawnFloatingText`).

### 11.4 Rage Mode & Passive Unlock
- `player._rageMode` — active during OVERHEAT passive window
- `player.passiveUnlocked` — permanent after first OVERHEAT trigger
- Achievement check: fires inside `update()` during OVERHEAT transition (not in draw)

---

## §12 BALANCE / config.js Key Structure (keys only)

> ⚠️ **Values are intentionally omitted.** Look up actual numbers in `config.js`.

### 12.1 Top-level keys
- `BALANCE.waves.*` — wave spawning and event schedule
- `BALANCE.characters.{kao|auto|poom|pat}.*` — per-character stat blocks
- `BALANCE.boss.*` — boss HP, speed, attack patterns, phase thresholds
- `BALANCE.enemy.*` — base enemy stats
- `BALANCE.score.*` — points per kill/boss/achievement
- `BALANCE.shop.*` — shop position, reroll cost
- `BALANCE.database.*` — database server position, URL, interaction radius
- `BALANCE.drone.*` — drone stats, overdrive threshold
- `BALANCE.ai.*` — AI decision intervals, squad coordination radius
- `BALANCE.map.*` — map object sizes, colour palettes
- `BALANCE.mtcRoom.*` — safe zone heal rate, buff cycle
- `BALANCE.LIGHTING.*` — ambient light, player/projectile light radius

### 12.2 GAME_CONFIG top-level keys
- `GAME_CONFIG.canvas.*` — camera smooth factor
- `GAME_CONFIG.physics.*` — worldBounds, friction, max velocity
- `GAME_CONFIG.visual.*` — screen shake decay
- `GAME_CONFIG.audio.*` — volume, BGM paths, SFX gain multipliers
- `GAME_CONFIG.abilities.*` — generic ability config (ritual cooldown, etc.)
- `MAP_CONFIG.*` — hex grid, arena, objects, paths, zones, auras, landmark

---

## §13 New Content Checklist

When adding a new file or class, verify:

- [ ] **Load order:** Added to `index.html` in correct position (after dependencies, before consumers)
- [ ] **Service worker:** Added to `sw.js` `urlsToCache` array
- [ ] **Window export:** `window.ClassName = ClassName` at file bottom
- [ ] **Inheritance:** Extends correct base (`Entity`, `EnemyBase`, `BossBase`, `PlayerBase`)
- [ ] **`_tickShared`:** If extending `EnemyBase`, called at start of living update path
- [ ] **Draw separation:** No state mutations inside `draw()` method
- [ ] **`Math.random()` in draw:** Must NOT be used — use `performance.now()` trig instead
- [ ] **`CTX.shadowBlur` reset:** All `shadowBlur` assignments followed by reset to `0`
- [ ] **New enemy type:** `SquadAI.tagOnSpawn()` must assign a default role on spawn
- [ ] **New boss:** Register kill stat in `AchievementSystem.stats` + `check()` case in `AchievementSystem.check()`
- [ ] **New boss domain:** Add `._abort(null)` call to `BossBase._onDeath()` reset block
- [ ] **New AI file:** Load after `entities/base.js`, before `entities/enemy.js`
- [ ] **SKILL.md §2 & §3:** Update class map and inheritance chain
- [ ] **PROJECT_OVERVIEW.md:** Update file structure table if files added/removed
