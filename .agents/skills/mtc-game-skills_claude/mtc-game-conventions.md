---
name: mtc-game-conventions
description: "Project-specific architectural patterns, constraints, and invariants for MTC The Game. Focuses on long-term stability and high-level structure. Trigger on: architecture rules, update/draw separation, tickShared, inheritance, AI architecture, load order, performance invariants."
---

# MTC The Game — Timeless Architectural Patterns

Stack: Vanilla JS (ES6+) + HTML5 Canvas 2D + Web Audio API.
Target: 60 FPS | Status: Beta v3.40.4

---

## §0. Architectural Constraints (STRICT)

### 1. Separation of Concerns (Logic vs Rendering)
MTC Game follows a rigid separation between `update(dt)` and `draw(ctx)`. Violating this causes desync and performance degradation.

*   **`update(dt, player, ...)`**:
    *   Handles physics (`this.x += this.vx * dt`), AI logic, and state changes.
    *   **Mandatory dt usage**: All continuous changes must be multiplied by `dt`.
*   **`draw(ctx)`**:
    *   **READ-ONLY**: Never modify entity health, position, or any state property.
    *   **Deterministic**: Use time-based oscillators (e.g., `Math.sin(now * speed)`) for animation.
    *   ❌ **No `Math.random()`**: Randomization is strictly forbidden in the draw path.
    *   ❌ **No Object Allocation**: Never use `new` or `{ }` / `[ ]` literals inside `draw()`.

### 2. Critical Invariants
*   **`_tickShared(dt, player)`**: For all `EnemyBase` subclasses, this MUST be the first line of the `update()` method. It handles AI timers, status effects (Freeze/Ignite), and hit flashes.
*   **`_anim` State Machine**: Both Players and Enemies use an `_anim` object to store decay timers (`hurtT`, `dashT`, `shootT`) that drive visual offsets without affecting logical collisions.
*   **Strict Mode**: All files use `"use strict";`. Global variables must be accessed via `window.*` (e.g., `window.player`, `window.enemies`) except when using `typeof` guards.

---

## §1. Inheritance Hierarchy

MTC uses a deep OOP structure for entities and a shallow structure for world objects.

### Entity Hierarchy (`js/entities/`)
Every entity is logically ticked and rendered in the main loop.

*   **`Entity`** (`base.js`): Base physics, position, radius.
    *   **`PlayerBase`** (`PlayerBase.js`): Shared HUD wire-up, lifesteal, and death handlers.
        *   `KaoPlayer`, `AutoPlayer`, `PoomPlayer`, `PatPlayer`.
    *   **`EnemyBase`** (`enemy.js`): Owns `_tickShared`, status effects, and UtilityAI interface.
        *   `Enemy`, `TankEnemy`, `MageEnemy`.
    *   **`BossBase`** (`BossBase.js`): Shared boss lifecycle, music management, and death explosions.
        *   `KruManop`, `KruFirst`.

### MapObject Hierarchy (`js/map.js`)
Static or interactable objects. They do NOT have physics velocity or AI.

*   **`MapObject`**: Base collision and standard drawing.
    *   `ExplosiveBarrel`: Destructible hazard.
    *   `PowerNode`: Passive ground aura system (pulsing violet-900 core).

---

## §2. AI Architecture

The AI is distributed across four distinct layers to balance complexity and performance.

| Layer | System | Tick Rate | Role |
| :--- | :--- | :--- | :--- |
| **Individual** | `UtilityAI.js` | 2Hz (0.5s) | Core decision tree; scores actions then calls `EnemyActions`. |
| **Tactical** | `EnemyActions.js` | N/A | Static library of movement routines (`retreat`, `flank`, `strafe`). |
| **Analysis** | `WorkerBridge.js` | 4Hz–10Hz | Off-main-thread pattern detection via `analyzer-worker.js`. |
| **Squad** | `SquadAI.js` | 1Hz (1.0s) | Global coordination; assigns roles (Assault, Flanker, Shield). |

### Invariants for AI Development:
1.  **Indirect Movement**: AI must never write directly to `vx`/`vy`. It writes to `_aiMoveX`/`_aiMoveY`, which are resolved by the base physics system.
2.  **Stateless Actions**: `EnemyActions` is a stateless library; if an action needs memory (e.g., a "retreating" flag), that memory belongs to the entity's `UtilityAI` instance.

---

## §3. Initialization & Script Load Order

Script order in `index.html` is critical for dependency availability. If a file loads out of order, the game will crash on `ReferenceError`.

1.  **Configuration**: `BalanceConfig.js` → `SystemConfig.js` → `GameTexts.js`
2.  **Core Utilities**: `utils.js` (provides `worldToScreen`, `spawnParticles`).
3.  **Visual Systems**: `ParticleSystem.js` → `WeatherSystem.js` → `PostProcessor.js`.
4.  **Combat Engine**: `SpatialGrid.js` → `Projectile.js` → `WeaponSystem.js`.
5.  **AI & Hierarchy**: `base.js` → `UtilityAI.js` → `PlayerPatternAnalyzer.js` → `SquadAI.js`.
6.  **Entity Implementation**: `PlayerBase.js` → [Characters] → `enemy.js` → `BossBase.js` → [Bosses].
7.  **Rendering Dispatchers**: `RenderTokens.js` → [CharRenderers] → `PlayerRenderer.js` → `BossRenderer.js`.
8.  **App Orchestration**: `GameState.js` → `WaveManager.js` → `game.js` (Loops started here).

---

## §4. Performance Invariants

Performance is managed by minimizing **Redraws**, **Memory Allocation**, and **String Operations** in the hot loop.

### 1. Zero-Allocation Rule
Avoid creating any objects or strings inside any method that runs 60 times per second.
*   ✅ `ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff0000';`
*   ❌ `ctx.fillStyle = \`rgba(255,0,0,${alpha})\`;` (Creates a new string every frame).

### 2. Viewport Culling
Every `draw()` method (except the player) MUST verify visibility before executing logic.
```js
const screen = worldToScreen(this.x, this.y);
if (!this.isOnScreen(80)) return; // Cull with buffer margin
```

### 3. Array Management
*   **Swap-and-Pop**: Use `arr[i] = arr[arr.length-1]; arr.length--;` for O(1) removals. Never use `splice()`.
*   **Object Pooling**: Use `spawnParticles()` and `floatingTextSystem`. Never `new` particles in the update loop.

---

## §5. Documentation Standards

### 1. JSDoc Module Headers
Every JS file MUST start with a block comment containing a Table of Contents (TOC) and Critical Pitfalls. This allows AI assistants to understand the file structure without reading the entire content.

### 2. Versioning (`sw.js`)
The `CACHE_NAME` in `sw.js` must be incremented on EVERY commit involving code changes to ensure players receive the latest assets.
*   **Major**: Breaking changes / Engine migration.
*   **Minor**: New major systems or 4+ new files.
*   **Patch**: Bug fixes, balance tweaks, or documentation updates.
