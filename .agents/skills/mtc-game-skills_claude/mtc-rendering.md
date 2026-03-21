---
name: mtc-rendering
description: >
  Rendering architecture patterns for MTC The Game. Use when modifying canvas render code,
  renderer dispatch, frame draw order, render caches, batching/loop strategies, viewport culling,
  HUD ownership boundaries, or draw/update separation constraints.
---

# MTC Rendering - Architectural Patterns

This skill documents stable rendering architecture only.
It excludes balance values, tuning constants, and release-specific visual tweaks.

---

## 1) Frame Lifecycle Ownership

### 1.1 Canonical frame contract

- `game.js` controls frame progression.
- simulation updates happen before rendering.
- rendering consumes finalized simulation state for that frame.

### 1.2 Phase separation

1. input and simulation update phase
2. world/entity rendering phase
3. HUD/overlay rendering phase

Do not interleave simulation mutation into render phase.

---

## 2) Update/Draw Separation Rule

- `update()` mutates gameplay state.
- `draw()` reads state and writes pixels.
- no gameplay mutations inside draw paths.

Allowed:

- render-local cache updates
- precomputed geometry cache refreshes

Not allowed:

- hp/cooldown/status changes
- combat ownership changes
- wave progression mutations

---

## 3) Rendering Pipeline Structure

### 3.1 Entity rendering pipeline

- Convert world to screen coordinates at draw entry.
- Apply culling before expensive work.
- Dispatch to type-specific renderer paths.
- Draw layers in deterministic order.
- reset draw context leak-prone fields before returning.

### 3.2 Layer discipline

- Keep visual layers explicit and ordered.
- Draw world-space layers inside transformed blocks.
- Draw UI labels/HP bars in screen-space outside body transforms.

---

## 4) Dispatcher and Type Resolution

### 4.1 Boss dispatch

- dispatch order must respect concrete constructors and inheritance relationships.
- use canonical classes (`KruFirst`, `KruManop`, `BossDog`) in checks.

### 4.2 Player dispatch

- player dispatch should branch by stable subtype identity.
- renderer-specific effects should remain in renderer paths, not leak into game loop orchestrators.

---

## 5) Batching and Loop Efficiency Patterns

### 5.1 Culling-first strategy

- cull off-screen entities before allocating draw state or building effects.
- avoid per-entity expensive setup for entities that will not be visible.

### 5.2 Draw-loop determinism

- avoid randomness during draw.
- use deterministic time-based oscillation from a single frame timestamp.
- compute reusable frame values once and pass through sub-layers.

### 5.3 Context state hygiene

- pair every `ctx.save()` with matching `ctx.restore()`.
- reset sticky context fields (for example `shadowBlur`, `globalAlpha`) after use.

---

## 6) Resource Management and Render Caches

### 6.1 Cache ownership

- renderer-owned caches belong on renderer classes, not gameplay entities.
- cache keys should encode structural draw identity (type/phase/shape), not transient gameplay state.

### 6.2 Invalidation rules

- invalidate only affected cache entries on structural visual changes.
- avoid global cache flushes unless renderer schema changed.

### 6.3 Offscreen bitmap strategy

- use bitmap/offscreen caches for static geometry segments.
- keep dynamic and time-varying layers out of static caches.

---

## 7) Cross-Module Rendering Dependencies

### 7.1 `CanvasHUD` ownership

- HUD/minimap canvas responsibilities belong to HUD systems, not entity renderers.
- entity renderers should not duplicate HUD logic.

### 7.2 Load-order dependencies

- renderers rely on constructor availability for runtime dispatch checks.
- `worldToScreen` and related camera helpers must exist before renderer draw calls.

### 7.3 Shared-state dependencies

- renderers depend on state objects prepared by game/system layers.
- preserve contract boundaries so rendering remains a read-only consumer.

---

## 8) Safe Pattern for New Rendering Features

1. Define which phase owns the feature (world render vs HUD render).
2. Ensure feature reads simulation state only.
3. Add culling and deterministic timing.
4. Keep context hygiene strict.
5. Add cache only if geometry is structurally stable.
6. Document new cross-file dependency if it introduces implicit coupling.

---

## 9) Explicit Exclusions

This rendering skill must not track:

- damage/cooldown/stat numbers
- config tuning values
- release-specific art tweak constants
- temporary effects tuning details

Keep this file architecture-stable across game updates.

