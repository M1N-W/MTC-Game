# MTC Game — System & Logic Blueprint

A pure-architecture reference document distilled from the Vanilla JS "MTC The Game" codebase, intended as a translation guide for rebuilding a wave-survival top-down shooter in **Vite + TypeScript + Phaser 3**.

> **Scope:** systems, math, AI, state machines, entity contracts, and optimization concepts.
> **Excluded:** Canvas rendering, DOM/CSS, art-style decisions, theme-specific copy, audio waveforms.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Core Gameplay Systems & Math](#2-core-gameplay-systems--math)
3. [Entity Architecture (OOP Blueprint)](#3-entity-architecture-oop-blueprint)
4. [Advanced AI Logic](#4-advanced-ai-logic)
5. [Performance & Optimization Concepts](#5-performance--optimization-concepts)
6. [Phaser 3 Migration Notes](#6-phaser-3-migration-notes)

---

## 1. High-Level Architecture

### 1.1 Module layering (load order matters)

```
config/balance       ← all tunables (frozen)
utils                ← math, RNG, camera, score, wave, dt
GameState            ← singleton mutable runtime state
TimeManager          ← timeScale / hitStop / slow-mo energy
entities/base        ← Entity, HealthComponent
ai/UtilityAI         ← per-enemy decision system
ai/EnemyActions      ← static action library (movement intents)
ai/SquadAI           ← squad-level role assignment (1Hz)
ai/PlayerPatternAnalyzer ← ring-buffer pattern detector (10Hz sample, 4Hz cache)
workers/analyzer-worker  ← off-thread copy of analyzer
systems/WorkerBridge ← main↔worker proxy + 10Hz throttle
entities/player/*    ← Hero subclasses (one per character)
entities/enemy       ← EnemyBase + Enemy/Tank/Mage/Sniper/Charger/...
entities/boss/*      ← BossBase + per-boss state machines
weapons              ← Projectile, ProjectileManager, SpatialGrid
systems/WaveManager  ← wave lifecycle, trickle spawn, modifiers, boss queue
map                  ← static MapSystem + spatial bucket grid
game (main loop)     ← rAF loop, phase gating, glue
```

### 1.2 Game phase state machine

`GameState.phase ∈ { 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER' }`

Transitions are central; entity ticks must early-exit when `phase !== 'PLAYING'` (except a still-frame draw during `PAUSED` and a final draw on `GAMEOVER`). `setPhase()` is the single writer.

### 1.3 Frame pipeline

Per `requestAnimationFrame(now)` tick:

1. Compute `dt = clamp((now − lastTime) / 1000, 0, 0.1)` *(cap @ 100ms protects against tab-switch huge dt).*
2. If `hitStopTimer > 0`: decrement, render previous state, skip update — pure freeze-frame for impact.
3. Tick slow-motion energy on **real dt** (independent of `timeScale`).
4. `scaledDt = dt * timeScale` — **all gameplay updates use scaledDt**.
5. `updateGame(scaledDt)` → wave events → shop buffs → proximity → entities → barrels → environment.
6. `drawGame()` once per loop.
7. Stop the rAF when phase becomes `GAMEOVER`; restart on `startGame()`.

---

## 2. Core Gameplay Systems & Math

### 2.1 Player movement, dash, aiming

**Movement (impulse + friction + speed cap):**

```
ax, ay = normalizedInputDirection   // (-1..1, 1..-1)
vx += ax * ACCELERATION * dt        // ACCELERATION ≈ 1800 px/s²
vy += ay * ACCELERATION * dt
vx *= FRICTION                      // FRICTION ≈ 0.88 per frame
vy *= FRICTION
speed = hypot(vx, vy)
if speed > MAX_SPEED: scale vx,vy down to MAX_SPEED
x += vx * dt
y += vy * dt
clamp x,y to worldBounds (±1500)
```

`MAX_SPEED` is the product of:

```
maxSpeed = baseMoveSpeed
         × stealthSpeedBonus?       // 1.5 while invisible
         × speedBoost               // pickup/skill multiplier
         × metaSpeedMult            // permanent meta unlocks
         × (1 + comboCount * 0.01)  // combo additive
         × secondWindMult?          // ×1.3 if hp/maxHp ≤ 20%
         × bladeGuardSpeedMult?     // ×0.6 while blocking (Pat)
```

**Dash (impulse, fixed duration, cooldown):**

```
angle      = (ax==0 && ay==0) ? facingAngle : atan2(ay, ax)
dashSpeed  = dashDistance / 0.2          // travel ~dashDistance px in 200 ms
if slowMotionActive: dashSpeed *= 4      // dash ignores bullet-time scaling
vx, vy     = cos(angle)*dashSpeed, sin(angle)*dashSpeed
isDashing  = true (cleared via setTimeout 200 ms)
cooldown   = dashCooldown * skillCooldownMult
spawn 5 afterimage ghosts at 30 ms intervals
```

`isDashing` grants i-frames (`takeDamage` early-exit) and overrides friction.

**Aiming vector (mouse or right-stick):**

```
angle = atan2(mouseWorldY - playerY, mouseWorldX - playerX)
mouseWorld = screenToWorld(mouseScreen, camera)
camera lerps: camera.x += (player.x − halfW − camera.x) * 0.1
```

**Shooting vector (per pellet):**

```
fireAngle = playerAngle + (pellet>1 ? rand(−spread/2, spread/2) : 0)
bullet.vx = cos(fireAngle) * bulletSpeed
bullet.vy = sin(fireAngle) * bulletSpeed
bullet.life = range / bulletSpeed       // auto-expire by distance
```

Critical hit: `Math.random() < (baseCritChance + situationalBonuses)` → `damage *= critMultiplier`.

### 2.2 Wave progression & difficulty scaling

**Wave definition (frozen config):**

```ts
WAVE_SCHEDULE = {
  fogWaves:    [2, 8, 11, 14],
  speedWaves:  [4, 7, 13],
  glitchWaves: [5, 10],
  darkWave:    [1],
  bossWaves:   derived from BOSS_ENCOUNTERS[].wave,
  maxWaves:    15,
}
BOSS_ENCOUNTERS = [
  { wave: 3,  boss:'manop', phase:'basic',     displayLevel:1 },
  { wave: 6,  boss:'first', phase:'basic',     displayLevel:1 },
  { wave: 9,  boss:'manop', phase:'dogRider',  displayLevel:2 },
  { wave: 12, boss:'first', phase:'advanced',  displayLevel:2 },
  { wave: 15, boss:'manop', phase:'goldfish',  displayLevel:3 },
]
```

**Enemy count per wave (linear):**

```
count = enemiesBase + (wave − 1) * enemiesPerWave   // 5 + (w−1)*2
if isBossWave: count = ceil(count * 1.5)            // 50% extra during boss
```

**Enemy stats per wave (geometric/linear hybrid):**

```
hp     = floor(baseHp * (1 + hpPerWave) ^ wave)     // ~exp growth, e.g. 0.19/wave
speed  = baseSpeed   + wave * speedPerWave          // linear
damage = baseDamage  + wave * damagePerWave         // linear
```

**Boss HP scaling:**

```
hp = floor(baseHp * hpMultiplier ^ (encounterIndex − 1))
```

**Trickle spawning** (smooths spawn pressure):

```
batchSize = clamp(ceil(count / 6), 1, 3)
interval  = isDarkWave ? 1.8s
          : isBossWave ? 2.0s
          : max(0.9, 1.4 − (wave−1)*0.04)            // tightens with wave
spawn first batch immediately; remainder over time
isTrickleActive = remaining > 0     // gates next-wave advancement
```

**Wave clear gate** (advance wave when):

```
!inTutorial &&
!isCurrentBossWave &&
enemies.length === 0 && !boss && !waveSpawnLocked && !isTrickleActive
```

**Wave modifiers** *(orthogonal flags applied at start):*

| Modifier | Effect |
|---|---|
| **Glitch** | invert WASD, +HP bonus to player, lock spawn behind countdown, set `glitchIntensity` ramp |
| **Fog** | radar offline, vignette overlay (gameplay: reduced AI awareness optional) |
| **Speed** | live-patches every enemy `speed *= 1.5`; reverses on wave end via `WeakSet` guard |
| **Dark** | ominous vignette; slower trickle interval (1.8s) |

**Glitch wave HP injection** = `+100` to player `maxHp` & `hp`, removed when wave ends.

### 2.3 Scoring & rewards

```
score per kill: BALANCE.score[type]            // basic 100, tank 200, mage 280, boss 6000
score per powerup pickup: BALANCE.score.powerup
score per achievement: BALANCE.score.achievement
boss death award: BALANCE.score.boss * encounterDifficulty
```

**EXP & level curve (per character):**

```
gainExp(amount):
  exp += amount
  comboCount = min(MAX, comboCount + 1)
  comboTimer = COMBO_MAX_TIME (3.0s; resets each kill)
  while (exp ≥ expToNextLevel): levelUp()

levelUp():
  exp -= expToNextLevel
  level++
  expToNextLevel = floor(expToNextLevel * expLevelMult)   // typically 1.30
  damageMultiplier += damageMultiplierPerLevel            // additive 0.08–0.12
  cooldownMultiplier = max(0.5, cooldownMultiplier − cdrPerLevel)
  if (maxHpPerLevel > 0): maxHp += k; hp += k
```

**Combo multiplier** (composes everywhere):

```
finalDamageMult = baseDamageMult * (1 + comboCount * 0.01)
finalSpeedMult  = baseSpeedMult  * (1 + comboCount * 0.01)
```

**Powerup drops** (probabilistic on kill):

```
dropChance = BALANCE.powerups.dropRate * enemyDropMult
if rand() < dropChance: spawn powerup at corpse
```

### 2.4 Time, cooldowns, and global state

**TimeManager (singleton on `window`):**

- `timeScale ∈ [0.30, 1.0]`, `1.0` = normal, `0.30` = bullet-time.
- `slowMoEnergy ∈ [0, 1]`: drains at 0.14/s while active, recharges at 0.07/s — both on **real dt**.
- Toggle requires `slowMoEnergy ≥ 0.05`.
- `hitStopTimer` is a freeze-frame budget capped at 0.5s. `triggerHitStop(ms|sec)` takes the *max* of current and requested, never downgrades.

**Cooldowns** are stored as remaining seconds on the entity:

```
cooldowns.dash   = stats.dashCooldown   * skillCooldownMult
cooldowns.stealth= stats.stealthCooldown* cooldownMultiplier * skillCooldownMult
weaponCooldown -= dt; gated by canShoot()
```

In bullet-time, **dash cooldown ticks 3× faster** to keep dash spammable for cinematic feel.

**GameState (single source of truth)** owns:

- `loopRunning`, `phase`
- entity refs: `player`, `enemies[]`, `boss`, `powerups[]`, `specialEffects[]`, `meteorZones[]`, `drone`
- timing: `hitStopTimer`, `timeScale`, `isSlowMotion`, `slowMoEnergy`
- glitch state: `isGlitchWave`, `glitchIntensity`, `controlsInverted`, `_glitchWaveHpBonus`, `waveSpawnLocked`, `waveSpawnTimer`, `pendingSpawnCount`
- run stats: `waveStartDamage`, `bossEncounterCount`
- async timer handles (clearable on reset): `_bossSpawnTimer`

`resetRun()` zeroes everything atomically and **must be the only path to fresh state** to avoid leaks (boss ticking after restart, encounter index drift, etc.).

---

## 3. Entity Architecture (OOP Blueprint)

### 3.1 Class hierarchy

```
Entity (base)
├── Player                    (abstract base hero)
│   ├── KaoPlayer             (stealth/ambush identity)
│   ├── AutoPlayer            (heat/brawler identity)
│   ├── PoomPlayer            (summon/sticky identity)
│   └── PatPlayer             (katana/parry identity)
├── EnemyBase                 (UtilityAI-aware base)
│   ├── Enemy   (basic)
│   ├── TankEnemy
│   ├── MageEnemy
│   ├── SniperEnemy
│   ├── ChargerEnemy
│   ├── HunterEnemy
│   ├── PoisonSpitterEnemy
│   ├── ShieldBraverEnemy
│   ├── FatalityBomberEnemy
│   ├── HealerEnemy
│   ├── SummonerEnemy
│   ├── BufferEnemy
│   └── SummonedMinionEnemy
├── BossBase
│   ├── ManopBoss             (3-phase summoner)
│   └── KruFirst              (physics-themed adaptive)
├── PowerUp
├── Particle / FloatingText / HitMarker (pooled effects)
└── Drone (orbital ally)
```

### 3.2 `Entity` contract

```ts
class Entity {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  angle: number;
  applyPhysics(dt): void          // integrate velocity; clamps to domain when active
  _steerAroundObstacles(dt): void // 5-ray probe arc, repulsion impulse
  isOnScreen(buffer?: number): boolean
}
```

### 3.3 `HealthComponent` (composition over inheritance)

```ts
class HealthComponent {
  maxHp: number
  hp: number
  dead: boolean
  flashDuration: number       // default 0.10s
  hitFlashTimer: number       // counts down to 0
  _onDeathCb: ((killer)=>void) | null
  tick(dt): void
  takeDamage(amt, killer?): boolean   // returns true if killed
  heal(amt, cap?): void
  get isAlive(): boolean
}
```

Owners expose `hp/maxHp/dead/hitFlashTimer` via proxy getters so call-sites never differentiate ECS vs OOP.

### 3.4 `Player` essential interface

```ts
interface Hero extends Entity {
  // identity
  charId: 'kao' | 'auto' | 'poom' | 'pat'
  stats: CharacterConfig
  health: HealthComponent
  // resources
  energy: number; maxEnergy: number
  cooldowns: { dash: number; stealth: number; shoot: number }
  // status flags
  isDashing: boolean; isInvisible: boolean; ambushReady: boolean
  isConfused: boolean; isBurning: boolean; bladeGuardActive: boolean
  // multipliers (composable)
  damageMultiplier: number      // getter that folds combo
  cooldownMultiplier: number
  skillCooldownMult: number
  speedBoost: number; metaSpeedMult: number
  // progression
  level: number; exp: number; expToNextLevel: number
  comboCount: number; comboTimer: number
  passiveUnlocked: boolean; stealthUseCount: number
  _abilityUnlock: { skillsUnlocked: string[]; ... }
  // animation FSM
  _anim: { state: string; t,shootT,hurtT,dashT,skillT,smoothMoveT,smoothAngle }
  // methods
  update(dt, keys, mouse): void
  dash(ax, ay): void
  activateStealth(): void; breakStealth(): void
  takeDamage(amt): { damage, isCrit }
  heal(amt): void
  gainExp(amount): void
  levelUp(): void
  shoot?(dt): void              // character-specific
  isUnlocked(skillKey): boolean
  unlock(skillKey): boolean
}
```

### 3.5 `EnemyBase` essential interface

```ts
interface EnemyBase extends Entity {
  id: number                              // monotonic, never reused
  type: string                            // 'basic' | 'tank' | 'mage' | ...
  health: HealthComponent
  speed: number; damage: number; maxHp: number
  // status framework
  statusEffects: Map<string, StatusEffect>
  stickyStacks: number; stickySlowMultiplier: number
  igniteTimer: number; igniteDPS: number
  // AI state
  _ai: UtilityAI | null
  _squadRole: 'assault'|'flanker'|'shield'|'support'|'pressure'|'anchor'
  _aiMoveX: number; _aiMoveY: number      // written by UtilityAI, blended in update()
  // buffs from BufferEnemy
  _enemySpeedBuff: number; _enemySpeedBuffTimer: number
  _enemyDamageBuff: number; _enemyDamageBuffTimer: number

  _tickShared(dt, player): void           // statuses + flash + DoT + AI tick
  addStatus(type, data): void
  removeStatus(type): void
  getStatus(type): StatusEffect | null
  tickStatuses(dt): void
  takeDamage(amt, player?): void          // wires onDeath, then delegates
  heal(amt): void
  hasLineOfSightTo(target, maxDist): boolean
  isFrontHit(attacker, cosThreshold?): boolean
  findLowestHpAlly(range, ratioThreshold?, opts?): EnemyBase | null
  countNearbyAllies(range): number
  moveByIntent(dt, player, directWeight, aiWeight, closeSlowFactor, pullSpeed, idleDrag): void
  _onDeath(player?): void                 // override per subclass
}
```

### 3.6 `StatusEffect` framework

```ts
interface StatusEffect {
  type: string
  stacks: number
  remaining: number      // seconds
  meta: object
  onApply?:  (target, fx) => void
  onTick?:   (target, fx, dt) => void
  onExpire?: (target, fx) => void
}
```

`addStatus()` merges with existing effects, refreshing duration with `max(remaining, incoming)` and accumulating stacks. `tickStatuses()` ticks remaining, calls `onTick`, removes when expired (using a pre-allocated `_statusToRemove[]` to avoid reallocation).

### 3.7 `BossBase` contract

```ts
interface BossBase extends Entity {
  name: string
  difficulty: number
  hp/maxHp/dead         // direct fields (not Health-component proxied here)
  hitFlashTimer: number
  state: string                       // FSM key
  stateTimer: number
  skills: Record<string, { cd, max, ... }>
  phase: 1 | 2 | 3                    // health-gated transitions
  isInvulnerable: boolean
  speak(text?): void
  _updateHUD(): void
  _onDeath(): void                    // award score, drop powerups, advance wave
  takeDamage(amt): void               // each subclass adds invuln layers
  update(dt, player): void
}
```

### 3.8 `Projectile` contract

```ts
interface Projectile {
  x,y,vx,vy: number
  angle: number
  damage: number; isCrit: boolean
  team: 'player' | 'enemy'
  life: number                  // seconds remaining; auto = range/speed
  radius: number; size: number  // visual vs collision (often equal)
  pierce: number                // hit count remaining; 0 = consumed on hit
  bounces: number               // ricochet count remaining
  hitSet?: Set<Entity>          // for piercing — prevents double damage
  kind: string                  // 'bullet' | 'punch' | 'heatwave' | ...
  onHit?(target): void          // callback for explosions, status apply, etc.
  update(dt): boolean           // returns expired flag
  checkCollision(target): boolean
}
```

Wall-hit logic: clamp position to bounds; if `bounces > 0` flip the relevant axis velocity, decrement, recompute `angle`; otherwise `life = 0`.

### 3.9 `MapObject` (static obstacle) contract

```ts
interface MapObject {
  x, y, w, h: number
  solid: boolean
  type: string
  resolveCollision(entity): void   // push entity out via AABB-vs-circle MTV
}
```

---

## 4. Advanced AI Logic

### 4.1 Decision-frequency design

| System | Tick rate | Driver |
|---|---|---|
| `UtilityAI` per enemy | 2 Hz (0.5s) | `_aiTimer` accumulator on the enemy |
| `SquadAI` global | 1 Hz (1.0s) | singleton `_timer` accumulator |
| `PlayerPatternAnalyzer.sample()` | 10 Hz | `_sampleTimer` |
| `PlayerPatternAnalyzer._recompute()` | 4 Hz | `_cacheTimer` |
| Worker bridge `postMessage` | 10 Hz | `_sampleAccum` throttle |

This decoupling keeps decision-making out of the 60 Hz hot path; cached results are read every frame at zero cost.

### 4.2 Utility AI scoring

**Per-enemy personality vector** (from `BALANCE.ai.personalities[type]`):

```
{ aggression: 0..1, caution: 0..1, teamwork: 0..1 }
basic:    { 0.6, 0.2, 0.3 }
tank:     { 0.8, 0.1, 0.5 }
mage:     { 0.3, 0.8, 0.2 }
sniper:   { 0.72, 0.35, 0.20 }
anchor:   { 0.55, 0.35, 0.55 }
pressure: { 0.92, 0.08, 0.25 }
support:  { 0.22, 0.78, 0.72 }
```

**Per-tick context (gathered once):**

```
dx, dy   = player.x − enemy.x, player.y − enemy.y
dist     = hypot(dx, dy) || 1
hpRatio  = hp / maxHp
allies   = enemies within squad.coordinationRadius (≈300px)
```

**Action utility scorers** (each returns 0–1):

```
uAttack    = base * aggression
           * max(0.2, 1 − dist/800)
           * (0.6 + hpRatio * 0.4)

uRetreat   = (hpRatio > hpThresh + 0.1) ? 0
           : base * caution * max(0, (hpThresh+0.1 − hpRatio)/(hpThresh+0.1))
             // hpThresh default 0.3

uFlank     = (alliesNearby < 1) ? 0
           : base * teamwork
             * (1 − min(1, |dist − optDist|/optDist))      // optDist 220
             * hpRatio

uHoldLine  = base * (0.45 + 0.55*teamwork)
             * (0.65 + hpRatio*0.35)
             * max(0.25, distScore@optDist=420)

uCharge    = base * aggression
             * max(0.2, distScore@optDist=240)
             * (0.5 + 0.5*hpRatio)

uSupport   = (type ∉ {healer,summoner,buffer}) ? 0
           : base * (0.55 + 0.45*teamwork)
             * (dist<180 ? 0.4 : 1)
             * (0.7 + 0.3*hpRatio)

uHazardDrop= (type !== 'poison_spitter') ? 0
           : base * max(0.25, distScore@optDist=420)
             * (0.7 + 0.3*hpRatio)
```

`distScore@opt = 1 − min(1, |dist − opt| / opt)` is the canonical "preferred-distance" function.

**Selection:** pick max utility, then **squad role overrides** (except `RETREAT`, which always wins to preserve survival logic):

```
role=='flanker'  → FLANK
role=='shield'   → SHIELD_WALL
role=='anchor'   → HOLD_LINE
role=='pressure' → CHARGE
role=='support'  → HEAL_ALLY | BUFF_ALLY | SUMMON (by type)
```

**Decision execution** writes only `enemy._aiMoveX/_aiMoveY` (unit vector); the enemy's own update blends it with direct chase via `moveByIntent(directWeight, aiWeight, …)`. **AI never writes `vx/vy` directly** — that lane is owned by physics and force-pulls.

### 4.3 EnemyActions (movement library)

| Action | Output direction (unit vector into `_aiMoveX/Y`) |
|---|---|
| `RETREAT` | `−(dx,dy)/dist`, plus wall-avoidance bias toward world center within `margin=100` of bounds (±1500); renormalized |
| `FLANK` | perpendicular to player axis: `(dy,−dx)/dist`, with sign chosen to balance ally density across the perpendicular line (less-crowded side wins) |
| `SHIELD_WALL` | `0.6 * toCentroid + 0.4 * towardPlayer`, normalized — tanks group up while still pressuring |
| `STRAFE_ORBIT(orbitDist)` | `0.7 * tangent + 0.3 * radialCorrection` where `tangent=(−dy,dx)/dist` and `radial = (dist−orbitDist)/orbitDist * (dx,dy)/dist` |
| `HOLD_LINE(ideal)` | retreat if `dist < 0.78*ideal`; advance if `dist > 1.12*ideal`; else strafe `(dy,−dx)*sign*0.85` |
| `CHARGE` | direct `(dx,dy)/dist` |
| `SUPPORT_BACKLINE` | hover toward nearest non-support ally `0.55` and away from player `0.45` |

### 4.4 Squad AI — role assignment

**Spatial bucket grid** (cell = `coordinationRadius` ≈ 300px):

```
build(enemies):  for e in enemies: cells[hash(e.x,e.y)].push(e)
nearby(x,y):     return concat of 9 neighbouring cells
```

**Role pipeline (1 Hz):**

1. For every living enemy, compute `defaultRole = roleDefaults[type]` (e.g. tank→shield, mage→support, summoner→support, charger→pressure, sniper→anchor).
2. If default role ∈ `{SHIELD, SUPPORT, PRESSURE, ANCHOR}` → assign and stop.
3. Otherwise (basic enemies):
   a. Get `nearby` allies via grid.
   b. Compute centroid `(cx, cy)` and `distFromCentroid`.
   c. `isOuter = distFromCentroid > coordinationRadius * 0.5`.
   d. Count current `flankerCount` in neighborhood.
   e. If `isOuter && flankerCount < flankerBudget` → `FLANKER`; else `ASSAULT`.

**`tagOnSpawn(enemy)`** assigns the default role immediately so a freshly spawned enemy is never roleless before the first tick.

### 4.5 Player Pattern Analyzer (the "brain reader")

**Ring buffer** (zero allocation after construction):

```
ANALYZER_SAMPLES = 30                  // ~3s at 10Hz
posX, posY: Float32Array
dist:       Float32Array               // distance to boss at sample time
side:       Int8Array                  // ±1 cross-product sign vs boss-player axis
head, count                            // ring write index, fill count
```

**Per-sample:**

```
dist[i]  = hypot(player − boss)
mvx,mvy  = player − prevPlayer
bpx,bpy  = player − boss
side[i]  = sign(bpx * mvy − bpy * mvx)   // +left / −right relative to boss-player line
```

**Pattern recompute (4 Hz):** walk buffer; bucket each step:

```
distInc++   if Δdist > +5    (kiting away)
distDec++   if Δdist < −5    (closing)
standCount++ otherwise
sidePlus++  if side[i] > 0
sideMinus++ if side[i] < 0

kiteScore   = distInc / total
circleScore = min(sidePlus, sideMinus) * 2 / total   // requires both sides — true orbiting
standScore  = standCount / total

dominantPattern =
  kite > 0.55  → 'kiting'
  circle>0.45  → 'circling'
  stand > 0.60 → 'standing'
  else         → 'mixed'

bias = sidePlus − sideMinus
dominantDirection =
  bias > 0.25*total  → 'left'
  bias < −0.25*total → 'right'
  else               → 'none'
```

**Linear prediction** (zero physics, intentionally cheap):

```
velocityEstimate: Δposition / sampleInterval  (between 2 newest samples)
predictedPosition(aheadSeconds): pos + vel * min(aheadSeconds, 0.5)
```

### 4.6 Web Worker integration

- The same analyzer math is duplicated in `analyzer-worker.js` (`WorkerAnalyzer` class — no DOM/window).
- `WorkerBridge.sendSample(dt, player, boss)` throttles main→worker `postMessage` at 10 Hz with `_sampleAccum` (coalesces to latest position; stable cadence via modulo remainder).
- Worker posts results back at 4 Hz only (cache-tick gated).
- Bridge writes `_workerPredReady`, `_workerPredX`, `_workerPredY`, `_cachedPattern`, `_cachedDir`, scores onto the **main-thread proxy** `playerAnalyzer`.
- `predictedPosition()` returns the worker result when ready, else falls back to the main-thread ring buffer.
- Worker errors set `_isReady=false` → graceful degradation to main-thread analyzer.

### 4.7 Boss adaptive AI (counter-play)

Bosses **read cached analyzer results every 2s** during their CHASE state and pick attacks accordingly:

| Player pattern | Counter (Manop) | Counter (KruFirst) |
|---|---|---|
| `kiting`, kite > 0.55–0.6 | `DeadlyGraph` (long laser) → `ChalkWall` to cut off | `SuvatCharge` (close gap) or `FreeFall` (AoE cut-off) |
| `standing`, stand > 0.6 | `EquationSlam` (high-punish AoE) → `Log457` charge | high-priority single-target burst |
| `circling`, circle > 0.45 | predictive aim (lead time scales by phase) | `ParabolicVolley` with `±120px lead` along orbit direction |
| `mixed` | weighted-random regular skill rotation |

**Phase transitions** are HP-gated and **reset the analyzer** (player often shifts strategy at phase break, so stale data is misleading):

```
ManopBoss:
  phase 2 trigger: hp ≤ maxHp * phase2Threshold[encounter]
  phase 3 trigger: hp ≤ maxHp * phase3Threshold[encounter]
KruFirst:
  derivationMode: hp ≤ maxHp * 0.40
  isEnraged:      hp ≤ maxHp * 0.50
  singularityMode: triggered by skill, not HP
On every transition: playerAnalyzer.reset(); shorten counter-skill cooldowns.
```

**Predictive aiming for projectiles:**

```
leadT = boss.phase >= 2 ? 0.35 : 0.20
target = playerAnalyzer.predictedPosition(leadT) ?? player
aimAngle = atan2(target.y − boss.y, target.x − boss.x)
```

**Invulnerability layers** (priority order; first-true wins):

1. `_inSafeZone` (boss inside player safe-room)
2. `DomainExpansion.isInvincible()` (player ult active)
3. `this.isInvulnerable` (mid-channel)

---

## 5. Performance & Optimization Concepts

### 5.1 Object pooling

**Pattern (Particle / FloatingText / HitMarker share this template):**

```
class Pooled {
  static _pool: Pooled[] = []
  static MAX_POOL = N            // soft cap; excess simply GC'd
  static acquire(...args): Pooled {
    return _pool.length > 0
      ? _pool.pop().reset(...args)
      : new Pooled(...args)
  }
  reset(...args): this { /* reinit all fields */; return this }
  release(): void {
    this.data = {}                          // null large refs to help GC
    if (_pool.length < MAX_POOL) _pool.push(this)
  }
}
```

**Pool sizes (proven at 60fps with 40+ enemies):**

| Pool | MAX_POOL | Live cap |
|---|---|---|
| `Particle._pool` | 300 | `ParticleSystem.MAX_PARTICLES = 150` (FIFO eviction of oldest) |
| `FloatingText._pool` | 80 | unbounded live (rare to exceed) |
| `HitMarker._pool` | 80 | typically <40 active |
| `OrbitalParticle._pool` | 40 | spawns beyond cap silently dropped |

**Removal pattern (everywhere):** `swap-and-pop` instead of `splice` — `O(1)` deletion. Order is preserved only for things where order matters; particles & projectiles use additive blend so order is irrelevant.

```
for (let i = arr.length − 1; i >= 0; i--) {
  if (shouldRemove(arr[i])) {
    arr[i].release()
    arr[i] = arr[arr.length − 1]
    arr.pop()
  }
}
```

**Pool warm-up:** `clear()` (called on game restart) returns live instances to the pool rather than discarding, so the next run starts with a hot pool of 150 pre-constructed particles.

### 5.2 Spatial partitioning

Two independent grids exist, each tuned to its workload.

**A) Dynamic projectile grid (`weapons.js → SpatialGrid`)**

- Cell size: **128 px** (≥ largest collision radius — enemy 20 + projectile 18).
- Built once per frame in `ProjectileManager.update()` — enemies are in one cell each (centre-point insertion).
- Query is a **3×3 cell** (9-cell) neighborhood of the projectile position.
- Hash key: `((cx & 0xFFFF) << 16) | (cy & 0xFFFF)` — integer key, zero string allocations.
- Map values are reusable arrays returned to a per-grid `_pool[]` on rebuild.
- Query result buffer (`_results[]`) is reused — `length = 0` between calls.

**Complexity:** `O(E + P*k)` where `k≈4` per projectile vs. brute force `O(P*E)`. At `P=40, E=60` → ~200 checks/frame vs ~2400.

**B) Static map grid (`map.js → MapSystem._staticGrid`)**

- Same 128 px cell, same integer hash.
- Built **once** after `generateCampusMap()` — objects never move.
- An object spans multiple cells if AABB overlaps; it's registered in every cell it touches (with `_staticGridSeen` Set used during query to dedupe).
- `queryNearby(wx, wy, radius)` returns objects within a square radius — used by:
  - Player/enemy collision resolution.
  - `Entity._steerAroundObstacles()` 5-ray probe avoidance.
  - LOS testing (`hasLineOfSightTo`).

**C) Squad AI bucket grid (`SquadAI._BucketGrid`)**

- Cell size = squad coordination radius (~300 px).
- Rebuilt 1×/second only.
- Used to find nearby allies for centroid + role budget without `O(N²)` scans.

### 5.3 Allocation discipline (zero-GC hot path rules)

| Rule | Reason |
|---|---|
| Never `new Particle/FloatingText/HitMarker` directly — use `acquire()` | avoid GC pauses |
| Clear arrays with `.length = 0`, never `arr = []` | reuses backing storage |
| Reuse single context objects (e.g. `UtilityAI._decision`) across ticks | avoid per-tick allocation |
| Use `Float32Array` / `Int8Array` for ring buffers | typed arrays = no boxing |
| Pre-allocate `_statusToRemove[]` etc. for tickStatuses removal | prevents per-tick alloc |
| Spatial grid hash via packed integer, not string | string hashing is GC-heavy |
| Reuse cell arrays via pool inside the grid itself | rebuild every frame is fine if zero alloc |
| Throttle worker `postMessage` with `_sampleAccum` | unbounded message queues freeze the page |

### 5.4 Render-side perf (concepts that matter even in Phaser)

- Cache static gradients (e.g. fog vignette) keyed by `(W, H, alphaBucket)` — only rebuild when bucketed value changes.
- Bake the static hex/zone floor terrain into an off-screen canvas once at map init.
- Throttle expensive overlays/particle spawns (circuit packets render every other frame).
- Skip whole render branches via early-exits when state is idle (e.g. `_smRipples.length === 0 && energy === 1` skips slow-mo overlay entirely).

### 5.5 Steering (cheap obstacle avoidance, no path-finding)

`Entity._steerAroundObstacles(dt)` — `O(objects × 5 rays)`:

```
PROBE_DIST   = 80
PROBE_COUNT  = 5
PROBE_ANGLES = [-60°, -30°, 0, +30°, +60°]
FORCE        = 520 px/s² impulse magnitude

if speed < 10: skip
nearby = mapSystem.queryNearby(x, y, PROBE_DIST + 32)   // spatial grid
for each ray:
  px = x + cos(angle+offset) * PROBE_DIST
  py = y + sin(...) * PROBE_DIST
  for each nearby solid (broad-phase AABB):
    nearestPoint = clamp(probe, AABB)
    repDir = entity − nearestPoint
    strength = max(0, 1 − len(repDir)/PROBE_DIST)
    accumulate steerX, steerY
    break (one object per ray)
if any: vx += normalize(steer)*FORCE*dt
```

This must run **before** `applyPhysics(dt)` each frame.

---

## 6. Phaser 3 Migration Notes

| Concept here (Vanilla JS) | Phaser 3 equivalent / mapping |
|---|---|
| `Entity` base + `_steerAroundObstacles` | `Phaser.Physics.Arcade.Sprite` body + custom `preUpdate()` for steering; keep ray-probe logic, query via `Arcade.Group` or your own broadphase |
| `HealthComponent` | TS class composed onto Phaser sprites (`sprite.health = new HealthComponent(...)`) |
| `SpatialGrid` (projectiles) | Arcade Physics already does broadphase via SAT/sweep; you can drop this in favor of `Group.collide(group, group)` and an `overlap()` callback. Keep the pattern only if you need precise control of pierce/bounce hitSets. |
| `MapSystem._staticGrid` | Either keep your own grid (Phaser tilemaps still need it for non-tile colliders) or use `StaticGroup` + `physics.overlap`. |
| `Particle._pool` | `Phaser.GameObjects.Particles` has its own pooling (`emitter.setQuantity` + lifespan). Replace custom particles with emitter configs. |
| `FloatingText._pool` | `Phaser.GameObjects.Text` + a manual pool (Phaser doesn't pool Text by default). |
| `requestAnimationFrame` loop, `dt clamp 0.1`, `hitStop` | Phaser's `update(time, delta)` with `delta` already in ms. Implement hit-stop by setting `scene.physics.world.isPaused = true` for a duration, **but keep your own `hitStopTimer` for a freeze-frame draw because Phaser will keep rendering**. |
| `timeScale` global | `scene.time.timeScale` *and* `scene.physics.world.timeScale` both need to be set. Alternatively, multiply your own `scaledDt` and pass to `update()` callbacks. |
| `slowMoEnergy` ticking on real-dt | Use `scene.game.loop.rawDelta` (unscaled) for resource ticking. |
| `triggerHitStop(ms)` | Same algorithm; gate `update()` on `hitStopTimer > 0`. |
| `GameState` singleton | A `Registry` (`scene.registry`) for primitives + a custom `GameStateService` class for entity refs. |
| `WaveManager` | A scene-level service. Keep trickle batches via `scene.time.addEvent({ delay, repeat })`. |
| `UtilityAI` / `SquadAI` | Keep verbatim as TS classes. They are pure logic — Phaser-agnostic. |
| `PlayerPatternAnalyzer` + worker | Keep verbatim. The Web Worker pattern works in Vite (`new Worker(new URL('./analyzer.worker.ts', import.meta.url), { type: 'module' })`). |
| `BALANCE` config | Move to `src/config/balance.ts` with `as const` + `Readonly<>` for compile-time freezing. Use TypeScript discriminated unions for `BOSS_ENCOUNTERS`. |
| `Projectile.pierce/bounces/hitSet` | Implement on a `Bullet extends Phaser.Physics.Arcade.Sprite` with custom `body.onWorldBounds` for ricochet. |
| `StatusEffect` Map | Identical TS class. Phaser-agnostic. |
| Boss FSMs | Strongly typed `type BossState = 'CHASE' | 'SUVAT_CHARGE' | ...`. Keep state-timer pattern; consider XState if FSMs grow. |
| Camera lerp | Phaser's `camera.startFollow(player, true, 0.1, 0.1)` does this. |

### 6.1 Suggested TypeScript file layout (greenfield project)

```
src/
  config/
    balance.ts              // exported `as const`, deep-readonly
    waveSchedule.ts
    bossEncounters.ts
  state/
    GameState.ts            // singleton service
    TimeManager.ts          // timeScale, hitStop, slow-mo energy
  components/
    HealthComponent.ts
    StatusEffect.ts
  entities/
    Entity.ts               // your own base or extension over Phaser.Sprite
    Hero.ts                 // abstract; concrete: KaoHero, AutoHero, ...
    EnemyBase.ts
    Enemy.ts ...            // type-keyed subclasses
    BossBase.ts
    Bosses/*.ts
    Projectile.ts
  ai/
    UtilityAI.ts
    EnemyActions.ts
    SquadAI.ts
    PlayerPatternAnalyzer.ts
    analyzer.worker.ts
    WorkerBridge.ts
  systems/
    WaveManager.ts
    SpawnSystem.ts
    SpatialGrid.ts          // optional if not using Arcade groups
  pools/
    Pool.ts                 // generic acquire/release pool
  scenes/
    BootScene.ts
    GameScene.ts            // owns the loop + composes systems
    UIScene.ts              // HUD overlay
  main.ts
```

### 6.2 Migration priorities (suggested order)

1. **Port pure logic first**, no rendering: `balance.ts`, `GameState`, `HealthComponent`, `StatusEffect`, `UtilityAI`, `EnemyActions`, `SquadAI`, `PlayerPatternAnalyzer` + worker, `Pool<T>`.
2. **Define entity contracts** as TypeScript interfaces (use the contracts in §3).
3. **Build a smoke-test scene** with one Hero and a few enemies driven by UtilityAI — no waves yet — to validate AI math.
4. **Add WaveManager + trickle spawning** with config-driven boss queue.
5. **Layer in projectiles + collision** (start with Arcade physics; only build SpatialGrid if profiling shows need).
6. **Bosses last** — phase FSMs are content, not engine, and benefit from a stable platform.
7. **Theme & art** — last step; the engine should be theme-agnostic by design.

### 6.3 Things to keep verbatim (battle-tested)

- The 2 Hz / 1 Hz / 4 Hz / 10 Hz tick decoupling.
- Personality × distance × HP scoring formulas in §4.2.
- Counter-pick logic in §4.7 (kiting → cut-off; standing → AoE; circling → lead).
- Analyzer ring-buffer math (`side` cross product, `kite/circle/stand` thresholds).
- Wall-avoidance ray probe (5 rays @ ±60° / ±30° / 0°).
- Pool pattern (`acquire`/`release`/`reset`/`MAX_POOL`).
- Swap-and-pop removal idiom.
- Hit-stop semantics (max-not-replace, capped at 0.5s, freezes update only).
- `dt` clamp at 0.1s.
- Boss health-gated phase transitions resetting the analyzer.

### 6.4 Things to redesign in TS

- **Replace `window.*` global state** with explicit imports/services + a `Registry` for cross-scene data.
- **Replace string-typed roles/states** with TypeScript string-literal unions for compile-time safety.
- **Replace duck-typed config lookups** (`BALANCE.ai.actions[name] ?? defaults[name]`) with typed records keyed by string-literal unions.
- **Replace `instanceof` branching for character types** with a `kind: 'kao' | 'auto' | 'poom' | 'pat'` discriminator on Hero.
- **Replace Health as proxy getters** with explicit `entity.health.hp` access — TS makes the indirection cheap and clear.

---

*End of blueprint. Translation guidance: every section above is engine-agnostic. The Phaser layer should be a thin adapter around the pure-logic classes; do not let `Phaser.Sprite` leak into AI / WaveManager / GameState code.*
