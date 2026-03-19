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
    *   **Composition: `HealthComponent`** (`base.js`): All entities possess a `this.health` component which encapsulates HP, maxHp, and lifesteal logic, separating it from movement/AI.
    *   **`PlayerBase`** (`PlayerBase.js`): Proxies properties to `HealthComponent`. Shared HUD wire-up and death handlers.
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
2.  **Core Utilities**: `utils.js` (global `worldToScreen`) → `audio.js`.
3.  **Visual Systems**: `ParticleSystem.js` → `WeatherSystem.js` → `CombatEffects.js` → ... → `PostProcessor.js`.
4.  **Combat Engine**: `SpatialGrid.js` → `Projectile.js` → `ProjectileManager.js` → `WeaponSystem.js` → `PoomWeapon.js`.
5.  **Systems & UI**: `map.js` → `ShopManager.js` → `UIManager.js` → `CanvasHUD.js` → `tutorial.js`.
6.  **Entity Foundations**: `base.js` (must be first entity file).
7.  **AI & Logic**: `UtilityAI.js` → `EnemyActions.js` → `PlayerPatternAnalyzer.js` → `SquadAI.js`.
8.  **Concrete Entities**: `PlayerBase.js` → [Kao/Auto/Poom/Pat] → `enemy.js` → `BossBase.js` → [Manop/First].
9.  **Rendering Dispatchers**: `RenderTokens.js` → `RenderSkins.js` → [CharRenderers] → `ProjectileRenderer.js` → `PlayerRenderer.js` → `BossRenderer.js`.
10. **Game Heart**: `GameState.js` → `AdminSystem.js` → `WaveManager.js` → `WorkerBridge.js` → `game.js`.

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

## §6. Hidden Dependencies & Implicit Coupling

MTC Game relies on several "global singletons" and resource pools that create implicit dependencies between seemingly unrelated modules.

### 1. Global State Managers (window.*)
*   **`window.gameState`**: The central source of truth for wave progress, score, and shop status. Modules like `enemy.js` read this to scale difficulty.
*   **`window.player`**: Set in `game.js` during `startGame()`. Accessed by AI and rendering systems to calculate distances and aim angles.
*   **`window.enemies` / `window.boss`**: Arrays/Objects managed by `WaveManager.js`. Renderers iterate over these to perform viewport culling.

### 2. Resource Pools & Shared Arrays
*   **`window.specialEffects`**: A shared array where `meteorZones`, `Shockwave`, and `DomainExpansion` effects are pushed. `drawGame()` iterates this to render non-entity visuals.
*   **`window.renderProfiler`**: Used for frame-timing diagnostics. If `RenderProfiler.js` is missing, the game will fail during the `requestAnimationFrame` loop.
*   **`window.adminSystem`**: Handles cheats and dev-console state. It can override `BALANCE` values at runtime, which is why documentation must never rely on static config numbers.

### 3. Event-Like Callbacks
*   **`spawnParticles()` / `spawnFloatingText()`**: Global functions (from `utils.js` via `ParticleSystem.js`) used everywhere.
*   **`ParticleSystem._inst`**: The hidden singleton instance that manages the particle pool.
