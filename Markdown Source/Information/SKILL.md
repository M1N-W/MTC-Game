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
1. Environment & Utility (`config.js`, `utils.js`)
2. Core Entity Foundation (`entities/base.js`)
3. Logic & AI Analyzers (`ai/UtilityAI.js`, `ai/EnemyActions.js`, `ai/PlayerPatternAnalyzer.js`, `ai/SquadAI.js`)
4. Entity Implementations (`entities/player/*`, `entities/summons.js`, `entities/enemy.js`, `entities/boss/*`)
5. Sub-Systems & Input (`input.js`)
6. Rendering Engines (`rendering/PlayerRenderer.js`, `rendering/BossRenderer.js`)
7. Central Orchestration (`systems/GameState.js`, `systems/AdminSystem.js`, `systems/TimeManager.js`, `systems/WaveManager.js`, `systems/WorkerBridge.js`)
8. Main Application Frame (`game.js`, `VersionManager.js`, `menu.js`)

---

## 5. Explicit Cross-Module Dependencies

Certain globally scoped channels create implicit system couplings that orchestrate broader interactions.

- **Canonical State Ownership**: `GameState` strictly owns phase transitions and loop execution states. Shared arrays (`window.enemies`, `window.specialEffects`) are maintained for surface level compatibility.
- **Enemy Registry Instantiation**: `window.ENEMY_REGISTRY` serves as the centralized factory. `WaveManager` (for normal gameplay spawns) and `AdminSystem` (for developer tools) both strictly couple to this registry for generic instantiations.
- **Asynchronous Workloads**: `WorkerBridge` couples background pattern analytics to the `PlayerPatternAnalyzer`, creating an asynchronous pipeline feeding back into `UtilityAI`.
- **System-wide Scaling**: `window.applyWaveModifiersToEnemy` is a required invocation applicable seamlessly across standard spawns, boss-summoned entities, and admin debug creations to ensure standardized stat adjustments.
