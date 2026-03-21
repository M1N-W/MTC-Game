---
name: mtc-game-conventions
description: "Timeless architecture and integration rules for MTC The Game. Use when modifying gameplay systems, entities, rendering dispatch, script load order, global state interactions, GameState migration paths, or AI/boss update flow contracts."
---

# MTC The Game - Stable Architectural Conventions

This skill documents long-lived architectural constraints.
It excludes balance values, cooldown numbers, damage values, and feature tuning data.

---

## 1) Canonical Class Map and Naming

Use constructor names exactly as implemented.

- `KruManop` is the canonical class in `js/entities/boss/ManopBoss.js`.
- `KruFirst` is the canonical class in `js/entities/boss/FirstBoss.js`.
- `BossDog` is a separate class in `ManopBoss.js`.
- Compatibility aliases may exist on `window`, but constructor checks should target canonical class names.

Incorrect constructor naming causes runtime branch misses in dispatcher logic.

---

## 2) Inheritance Hierarchy (Authoritative)

### 2.1 Entity tree

- `Entity` (`js/entities/base.js`)
  - `Player` (`js/entities/player/PlayerBase.js`)
    - `KaoPlayer`
    - `AutoPlayer`
    - `PoomPlayer`
    - `PatPlayer`
  - `EnemyBase` (`js/entities/enemy.js`)
    - `Enemy`
    - `TankEnemy`
    - `MageEnemy`
  - `BossBase` (`js/entities/boss/BossBase.js`)
    - `KruManop`
    - `KruFirst`
  - other direct subclasses:
    - `BossDog`
    - summon/attack entities in boss and summon files

### 2.2 Non-inheritance architecture notes

- Rendering classes are static utility classes (`PlayerRenderer`, `BossRenderer`).
- Shared behavior composition (for example health/status components) is used in addition to inheritance.

---

## 3) Script Load Order Contract

The game runs on ordered global script tags. Load order is part of architecture.

### 3.1 High-level order

1. core config/util/audio/effects/weapons/map/ui/tutorial
2. entity base + AI files
3. player/enemy/boss class files
4. input
5. renderers
6. systems (`GameState`, admin/shop/time/wave/worker bridge)
7. orchestration (`game.js`, `VersionManager.js`, `menu.js`)

### 3.2 Dependency-sensitive zones

- AI files must load before enemy classes that instantiate AI helpers.
- boss attack files must load before boss classes that call them.
- `WorkerBridge` must load before `game.js` if startup flow expects bridge availability.

---

## 4) Update and Draw Separation (Hard Rule)

### 4.1 Invariant

- `update()` owns simulation and gameplay mutation.
- `draw()` owns rendering only.
- Do not mutate gameplay state in draw paths.

### 4.2 Prohibited draw-side mutations

- hp/energy/cooldowns/status flags
- wave progression flags
- entity physics or AI state
- combat ownership and damage resolution

### 4.3 Allowed draw-local state

- renderer caches and memoized draw artifacts that do not alter gameplay outcomes.

---

## 5) Enemy Update Contract: `_tickShared()` First

Every enemy subclass `update(dt, player)` must call:

- `this._tickShared(dt, player)` as the first gameplay operation after dead/guard checks.

Reason:

- shared status timing
- common reaction/state transitions
- shared AI/support hooks

Any subclass that delays or skips this call can desynchronize status behavior.

---

## 6) Rendering Dispatch and Ownership

### 6.1 Dispatcher responsibility

- `PlayerRenderer.draw(...)` and `BossRenderer.draw(...)` select subtype render paths.
- Dispatcher checks rely on constructors being available and correctly named.

### 6.2 Rendering ownership boundary

- Entity classes expose state.
- Renderers decide visual layers and drawing strategy.
- Gameplay logic stays outside renderer classes.

---

## 7) Global State and Cross-Module Coupling

### 7.1 Shared runtime globals

Modules depend on shared surfaces such as:

- `window.player`
- `window.enemies`
- `window.boss`
- shared manager singletons

When refactoring, treat these as compatibility boundaries.

### 7.2 `GameState` as canonical owner

- `js/systems/GameState.js` is the canonical state manager.
- alias synchronization to legacy globals exists for backward compatibility.
- new code should read/write canonical `GameState` fields first.

### 7.3 Worker pipeline coupling

- `WorkerBridge` exchanges samples/results with `analyzer-worker`.
- analyzer outputs are consumed by gameplay AI decisions.
- this creates a hidden dependency chain across `game.js`, `WorkerBridge`, analyzer code, and enemy/boss logic.

---

## 8) Boss Lifecycle and Reset Contracts

Boss lifecycle operations must remain consistent across:

- normal defeat paths
- forced admin/debug transitions
- wave skip or state reset flows

Any singleton-like boss attack resource/state must be reset via the same lifecycle contract in all paths.

---

## 9) Safe Conventions for New Systems

When adding architecture-level features:

1. Preserve load-order assumptions in `index.html`.
2. Preserve update/draw separation.
3. Preserve `EnemyBase` shared-update contract.
4. Keep `GameState` as canonical source and only bridge to globals for compatibility.
5. Document new hidden coupling points in this file.

---

## 10) Explicitly Out of Scope for This Skill

Do not document or maintain here:

- cooldown, damage, hp, speed, or economic numbers
- balance and tuning parameters in config blocks
- release-specific feature snapshots
- one-off bugfix values

Those belong in code/config and changelog, not in timeless architecture guidance.

