---
name: architecture-consistency-checklist
description: "A short 1-page checklist used to verify architecture consistency before any merge to prevent doc drift. All AI agents must run through this checklist before finalizing logic or committing major architectural changes."
---

# Architecture Consistency Checklist (MTC The Game)

This checklist must be reviewed before any merge to ensure that code changes do not drift away from the core architectural constraints of MTC The Game.

## 1. Class Hierarchy & Naming
- [ ] **Canonical Constructors:** Are we using the correct canonical class names (e.g., `KruManop`, `KruFirst`) for dispatchers and `instanceof` checks rather than legacy aliases?
- [ ] **Inheritance Boundaries:** Do new entities correctly derive from the established base classes (`PlayerBase`, `EnemyBase`, `BossBase`)?

## 2. Update vs. Draw Separation (Hard Contract)
- [ ] **No Gameplay Mutation in Draw:** Are `draw()` functions 100% free of gameplay state mutations (e.g., no modifying HP, cooldowns, status flags, combat ownership, wave progression)?
- [ ] **Pure State Consumer:** Do renderers and `draw()` functions act purely as read-only consumers of the finalized `update()` simulation state?

## 3. Enemy `_tickShared()` Invariant
- [ ] **Shared Tick Execution:** Does every newly added or modified Enemy/Boss `update(dt, player)` call `this._tickShared(dt, player)` as the first gameplay operation after death/guard checks?

## 4. Script Load Order & Dependencies
- [ ] **Dependency Alignment:** Do new/modified script tags respect the global load order (e.g., AI files before Enemy instantiations, `WorkerBridge` before `game.js`)?
- [ ] **Hidden Coupling Check:** Are cross-module dependencies (like the `analyzer-worker` pipeline to `WorkerBridge`) intact and not broken by script renaming or reordering?

## 5. State Ownership & Rendering Dispatch
- [ ] **Canonical GameState:** Are changes reading/writing to `js/systems/GameState.js` natively where possible, treating `window.player`, `window.enemies` as compatibility aliases?
- [ ] **HUD Rendering Isolation:** Is HUD/minimap logic kept strictly inside HUD systems (`CanvasHUD`) and completely absent from entity `Renderer` classes?
- [ ] **Dispatcher Logic:** Do dispatcher functions (like `PlayerRenderer.draw`, `BossRenderer.draw`) branch properly by stable subtype without executing gameplay logic?

## 6. Documentation & Volatile Data (Doc Drift Guard)
- [ ] **No Balance Data in Architecture Docs:** Are architectural files (e.g., `PROJECT_OVERVIEW.md`, `mtc-game-conventions.md`, `mtc-rendering.md`) strictly free from volatile numbers like HP, damage, speed, or cooldown tuning?
- [ ] **Architecture Doc Sync:** Do any structural changes (new systems, changed load orders, or new critical cross-file coupling) made in this work branch require a corresponding update to the architectural markdown files?
