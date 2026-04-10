# MTC Game — Architectural Conventions (SKILL.md)

> **SCOPE:** This document exclusively captures **timeless architectural patterns**. It deliberately excludes configurable values, balance statistics (like cooldowns, damage multipliers, durations), feature lists, and any numeric constants tied to gameplay tuning. This ensures the skill file remains a stable, robust reference across all versions.

---

## 1. Class Hierarchy and Inheritance Chains

The game object graph originates from a strict inheritance tree built upon the root `Entity` class.

### 1.1 Core Inheritance Tree

```text
Entity (Root Base Class)
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
├── BossDog                  (Entity direct child)
├── GoldfishMinion           (Entity direct child)
├── NagaEntity               (Entity direct child)
├── GarudaEntity             (Entity direct child)
└── Drone                    (Entity direct child)
```

### 1.2 Hierarchy Invariants
- **Direct Entity Subclasses**: Entities like `BossDog`, `GoldfishMinion`, `Drone`, `NagaEntity`, and `GarudaEntity` bypass the core combatant logic and thus extend `Entity` directly. They do **not** participate in the standard `_tickShared()` pipelines.
- **Component Composition**: `HealthComponent` is distinct from the inheritance tree. It is composed into combatants (`this.health = new HealthComponent(maxHp)`), but proxy getters (`hp`, `maxHp`, `dead`) wrap this on the entity surface for backward compatibility.

---

## 2. Update() / Draw() Separation Axiom

The system architecture mandates a strict separation between logical simulation and view rendering.

### 2.1 The `update()` Path
- **Purpose**: Authoritative simulation mutation.
- **Responsibilities**: Modifying positions (`vx`, `vy`), executing AI logic, resolving hit detection, applying damage, ticking state timers, orchestrating spawn functions, and updating flags.

### 2.2 The `draw()` Path
- **Purpose**: Pure view manifestation.
- **Responsibilities**: Emitting pixels, deterministic visual animations derived from read-only states, and managing context states via `ctx.save()` / `ctx.restore()`.
- **PROHIBITION**: Any code within a `draw()` call must **never** mutate authoritative state. It cannot alter `hp`, advance cooldown cycles, decrement effect timers, push additions to `window.enemies` / `window.specialEffects`, or update AI intent flags.

---

## 3. The `_tickShared` Invariant

All subclasses of `EnemyBase` must adhere to a strict implementation contract regarding their lifecycle updates.

- **The Rule**: `this._tickShared(dt, player)` **must** be the very first operation executed within the living logic path of an enemy's `update(dt, player)` override.
- **Purpose**: `_tickShared` centralizes mandatory state resolution. It handles ticking status effects, resolving elemental reactions, advancing hit-flash decay, processing buff logic, and consuming base AI intent. Bypassing or delaying this call compromises the core logic and forces the simulation out of sync.

### 3.1 AI Movement Intent Delegation
- The `UtilityAI` does not directly mutate enemy velocities. Instead, it writes purely to intent vectors (`_aiMoveX` and `_aiMoveY`).
- The specific `EnemyBase` subclass evaluates this intent within its `update()` method and calculates the final `vx` and `vy` applications.

---

## 4. Initialization and Runtime Script Load Order

Script loading order defined in the application entrypoint (`index.html`) is a hard architectural constraint. A module must safely load to the global scope before its consumers instantiate.

The deterministic load sequence is:
1. Environment & Utility (`balance.js`, `shop-items.js`, `game-texts.js`, `utils.js`, `firebase-bundle.js`)
2. Core Entity Foundation (`entities/base.js`)
3. Logic & AI Analyzers (`ai/UtilityAI.js`, `ai/EnemyActions.js`, `ai/PlayerPatternAnalyzer.js`, `ai/SquadAI.js`)
4. Entity Implementations (`entities/player/*`, `entities/summons.js`, `entities/enemy.js`, `entities/boss/*`)
5. Sub-Systems & Input (`input.js`)
6. Rendering Engines (`rendering/PlayerRenderer.js`, `rendering/BossRenderer.js`, `rendering/EnemyRenderer.js`)
7. Central Orchestration (`systems/GameState.js`, `systems/AdminSystem.js`, `systems/TimeManager.js`, `systems/WaveManager.js`, `systems/WorkerBridge.js`)
8. Main Application Frame (`game.js`, `VersionManager.js`, `menu.js`)

---

## 5. Explicit Cross-Module Dependencies

Certain globally scoped channels create implicit system couplings that orchestrate broader interactions.

- **Canonical State Ownership**: `GameState` strictly owns phase transitions and loop execution states. Shared arrays (`window.enemies`, `window.specialEffects`) are maintained for surface level compatibility.
- **Enemy Registry Instantiation**: `window.ENEMY_REGISTRY` serves as the centralized factory. `WaveManager` (for normal gameplay spawns) and `AdminSystem` (for developer tools) both strictly couple to this registry for generic instantiations.
- **Enemy Rendering Boundary**: Enemy simulation classes remain defined in `entities/enemy.js`, while `rendering/EnemyRenderer.js` consumes those constructors for draw dispatch. Renderer extraction must not move update logic, AI state, or registry ownership out of `EnemyBase` descendants.
- **Asynchronous Workloads**: `WorkerBridge` couples background pattern analytics to the `PlayerPatternAnalyzer`, creating an asynchronous pipeline feeding back into `UtilityAI`.
- **System-wide Scaling**: `window.applyWaveModifiersToEnemy` is a required invocation applicable seamlessly across standard spawns, boss-summoned entities, and admin debug creations to ensure standardized stat adjustments.

---

## 6. Additional Timeless Architectural Patterns

### 6.1 JSDoc Header Navigation Convention

Every JavaScript file must open with a single self-contained JSDoc header block (`/** … */`) containing three contiguous sections:

1. **Standard JSDoc tags**: `@module`, `@fileoverview`, and key `@exports` documenting the file's public API
2. **Table of Contents**: Lists every top-level symbol prefixed with `L.<line-number>` (e.g., `L.42 class Router`)
3. **Architecture & Pitfalls**: Load-order dependencies, `window.*` exports, and concrete ⚠️ warnings from real debugging sessions

**Navigation Contract**: Running `grep -n 'L\.' <file>` must return every TOC entry with exact line numbers, enabling AI/human navigation without opening the file.

**Maintenance Rule**: Update headers only in the same commit that alters logic—never schedule periodic bulk refreshes. Emit minimal patches affecting only changed TOC lines unless symbol order shifts by >20 lines.

### 6.2 The `window.*` Export Pattern

All public constructors and singletons are explicitly bound to `window` at file end:

```javascript
window.Enemy = Enemy;
window.EnemyBase = EnemyBase;
window.ENEMY_REGISTRY = { basic: { ctor: Enemy }, ... };
```

This enables cross-file access without ES modules or import graphs. The pattern is:
1. Define classes/functions in file-local scope first
2. Export via `window.Name = Name` at end of file
3. Consumers access via `window.Name` (or `typeof window.Name !== 'undefined'` guards)

### 6.3 `typeof` Guard Pattern for Optional Dependencies

For dependencies that may load later or conditionally (e.g., `WorkerBridge`), always use runtime guards:

```javascript
// Correct — safe even if WorkerBridge loads later
if (typeof WorkerBridge !== 'undefined' && WorkerBridge.isReady) {
    WorkerBridge.send('analyze', data);
}

// Also correct for optional systems
const score = (typeof BALANCE !== 'undefined') ? BALANCE.score.enemy : 100;
```

This pattern allows files to load in any order within their tier and enables graceful degradation when systems are disabled.

### 6.4 Renderer Static Dispatcher + Cache Pattern

Renderers are static-method-only classes (no instance state). Entry point is always `ClassName.draw(entity, ctx)`.

**Viewport Culling**: All renderers check `isOnScreen(margin)` BEFORE any canvas API calls:

```javascript
static draw(e, ctx) {
    // Cull before any drawing
    const screen = worldToScreen(e.x, e.y);
    const R = (e.radius ?? 20) + 40;
    if (screen.x < -R || screen.x > CANVAS.width + R ||
        screen.y < -R || screen.y > CANVAS.height + R) return;
    
    // ... actual draw logic
}
```

**Sprite Caching**: `EnemyRenderer` uses `Map` caches for offscreen body sprites:

```javascript
static _bodyCache = new Map();
static _getBodySprite(key, R, fn) {
    if (EnemyRenderer._bodyCache.has(key)) return EnemyRenderer._bodyCache.get(key);
    const oc = document.createElement('canvas');
    oc.width = oc.height = Math.ceil(R * 2) + 10;
    const ox = oc.getContext('2d');
    fn(ox, R, oc.width/2, oc.height/2);
    EnemyRenderer._bodyCache.set(key, oc);
    return oc;
}
```

Cache keys follow pattern `'${type}_${R}'` (e.g., `'enemy_18'`). Invalidation is lazy—new keys create new entries; old entries are GC'd when no longer referenced.

### 6.5 Array Ownership and Swap-Remove Semantics

`window.specialEffects` and similar pooled arrays use reverse-loop swap-remove for O(1) removals without mid-iteration mutation bugs:

```javascript
// game.js update loop
for (let i = specialEffects.length - 1; i >= 0; i--) {
    const effect = specialEffects[i];
    if (effect.update(dt, player)) {
        // Effect signals completion — remove via swap-remove
        specialEffects[i] = specialEffects[specialEffects.length - 1];
        specialEffects.pop();
    }
}
```

**Invariant**: Arrays are updated in-place during `updateGame()`, then read during `drawGame()` without mid-frame mutation. Draw passes must never `push` to or `splice` entity arrays.
