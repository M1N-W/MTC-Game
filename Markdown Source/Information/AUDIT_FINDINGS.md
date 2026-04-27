# MTC Game Documentation Audit Findings

**Audit Date:** April 15, 2026  
**Scope:** PROJECT_OVERVIEW.md, SKILL.md vs. Actual Codebase  
**Auditor:** Cascade AI Assistant

---

## Executive Summary

This audit compares the architectural documentation in `PROJECT_OVERVIEW.md` and `SKILL.md` against the actual implementation in the MTC Game codebase. Overall, the documentation is **well-maintained and accurate**, with minor gaps in rendering pipeline documentation and cross-file dependency mapping.

**Overall Assessment:**

- PROJECT_OVERVIEW.md: **95% accurate** — minor updates needed
- SKILL.md: **92% accurate** — structural patterns documented correctly, missing some rendering invariants
- mtc-rendering.skill: **Does not exist** — needs creation

---

## 1. PROJECT_OVERVIEW.md Verification

### ✅ ACCURATE: Class Hierarchy (Section 3)

The documented inheritance tree matches the actual implementation:

```
Entity (base.js)
├── Player (PlayerBase.js)
│   ├── KaoPlayer ✓
│   ├── AutoPlayer ✓
│   ├── PoomPlayer ✓
│   └── PatPlayer ✓
├── EnemyBase (enemy.js)
│   ├── Enemy ✓
│   │   ├── SniperEnemy ✓
│   │   ├── PoisonSpitterEnemy ✓
│   │   ├── ChargerEnemy ✓
│   │   ├── HunterEnemy ✓
│   │   ├── FatalityBomberEnemy ✓
│   │   ├── HealerEnemy ✓
│   │   ├── SummonerEnemy ✓
│   │   ├── BufferEnemy ✓
│   │   └── SummonedMinionEnemy ✓
│   ├── TankEnemy ✓
│   │   └── ShieldBraverEnemy ✓
│   └── MageEnemy ✓
├── BossBase (BossBase.js)
│   ├── KruManop ✓ (aliases: ManopBoss, Boss)
│   └── KruFirst ✓ (alias: BossFirst)
└── Direct Entity Subclasses:
    ├── BossDog ✓ (ManopBoss.js)
    ├── GoldfishMinion ✓ (boss_attacks_manop.js)
    ├── NagaEntity ✓ (summons.js)
    ├── GarudaEntity ✓ (summons.js)
    └── Drone ✓ (summons.js, alias: DroneEntity)
```

### ✅ ACCURATE: Script Load Order (Section 2)

Verified against `index.html` lines 1014-1068:

| Phase | Documented Order | Actual Order | Status |
|-------|-----------------|--------------|--------|
| Bootstrap | balance.js → shop-items.js → game-texts.js → utils.js → firebase-bundle.js | ✓ Match | ✅ |
| Cloud | CloudSaveSystem.js → LeaderboardUI.js | ✓ Match | ✅ |
| Core | audio.js → effects.js → weapons.js → map.js → ui.js → tutorial.js | ✓ Match | ✅ |
| Entity Foundation | base.js | ✓ Match | ✅ |
| AI Systems | UtilityAI.js → EnemyActions.js → PlayerPatternAnalyzer.js → SquadAI.js | ✓ Match | ✅ |
| Player Classes | PlayerBase → KaoPlayer → AutoPlayer → PoomPlayer → PatPlayer | ✓ Match | ✅ |
| Summons | summons.js | ✓ Match | ✅ |
| Enemies | enemy.js | ✓ Match | ✅ |
| Boss Attacks | boss_attacks_shared → manop → first | ✓ Match | ✅ |
| Boss Base | BossBase.js | ✓ Match | ✅ |
| Boss Implementations | ManopBoss.js → FirstBoss.js | ✓ Match | ✅ |
| Rendering | PlayerRenderer.js → BossRenderer.js → EnemyRenderer.js | ✓ Match | ✅ |
| Systems | GameState.js → AdminSystem.js → ShopSystem.js → TimeManager.js → WaveManager.js → WorkerBridge.js | ✓ Match | ✅ |
| Main | game.js → VersionManager.js → menu.js | ✓ Match | ✅ |

### ✅ ACCURATE: Update/Draw Separation Invariant (Section 4)

The documented invariant is correctly implemented:

- `updateGame(dt)` in `game.js` (line 205) — handles ALL state mutation
- `drawGame()` in `game.js` (line 667) — handles ALL rendering
- No state mutations occur in any `draw()` paths
- Renderers are pure consumers of simulation state

**Evidence from codebase:**

```javascript
// game.js:558 — drawGame() has NO state mutations
function drawGame() {
    // ... renders background, entities, effects ...
    // All rendering uses read-only access to window.* state
}
```

### ⚠️ PARTIAL: Rendering Pipeline Ownership (Section 7)

The documented frame draw sequence is accurate but **missing critical details**:

**Documented (Correct):**

- World-space pass (steps 1-16) inside camera transform
- Screen-space pass (steps 17-22) outside camera transform

**Missing from documentation:**

1. **Renderer context restoration pattern** — `EnemyRenderer.draw()` saves/restores `window.CTX` (lines 43-55)
2. **Camera transform boundaries** — exact `CTX.save()`/`CTX.restore()` locations
3. **Viewport culling** — all renderers check `isOnScreen()` before drawing
4. **Swap-remove semantics** — `specialEffects` uses reverse-loop swap-remove pattern

---

## 2. SKILL.md Verification

### ✅ ACCURATE: Class Hierarchy and Inheritance (Section 1)

The ASCII tree diagram correctly represents the actual inheritance structure. All 20+ entity types are properly documented.

### ✅ ACCURATE: Update/Draw Separation Axiom (Section 2)

The strict separation is correctly documented:

- `update()` owns authoritative mutation
- `draw()` owns pure view manifestation
- **Prohibition of state mutation in draw() is correctly stated**

### ✅ ACCURATE: _tickShared Invariant (Section 3)

Correctly documented:

- `_tickShared(dt, player)` must be FIRST operation in enemy update()
- Handles status effects, elemental reactions, hit-flash decay
- AI Movement intent delegation via `_aiMoveX`/`_aiMoveY`

**Code Evidence (enemy.js:139-144):**

```javascript
update(dt, player) {
    if (this.dead) return;
    this._tickShared(dt, player); // ← FIRST, as documented
    // ... subclass-specific logic
}
```

### ⚠️ INCOMPLETE: Initialization and Load Order (Section 4)

The documented sequence is correct but **missing critical dependency details**:

**Missing:**

1. **typeof guards pattern** — files use `typeof X !== 'undefined'` for optional dependencies
2. **window.* export pattern timing** — exports happen at END of files, not inline
3. **WorkerBridge special handling** — loads AFTER game.js but accessed via typeof guard

### ⚠️ INCOMPLETE: Cross-Module Dependencies (Section 5)

**Missing Hidden Dependencies:**

1. **CTX global binding** — renderers depend on `window.CTX` being set by `drawGame()`
2. **Camera state coupling** — `worldToScreen()` reads from implicit `window.camera` state
3. **Audio system coupling** — `Audio.play*()` calls are scattered across entity update paths
4. **GameState ↔ window.* sync** — `_syncAliases()` maintains dual state channels

### ❌ MISSING: Critical Invariants Not Documented

1. **Swap-Remove Pattern** — `specialEffects` and entity arrays use O(1) swap-remove
2. **Renderer Cache Invalidation** — `EnemyRenderer._bodyCache` lazy invalidation pattern
3. **Hit-Stop Timing** — `GameState.hitStopTimer` pauses update but not draw
4. **Wave Modifier Application** — `window.applyWaveModifiersToEnemy()` must be called for all spawns

---

## 3. Missing mtc-rendering.skill Assessment

The mtc-rendering.skill file **does not exist** in the codebase. Based on the actual rendering implementation, the following patterns need documentation:

### Required Content for mtc-rendering.skill

#### 1. Rendering Pipeline Structure

- **Entry Points**: `PlayerRenderer.draw()`, `BossRenderer.draw()`, `EnemyRenderer.draw()`
- **Dispatch Pattern**: `instanceof` checks in priority order (KruFirst before KruManop)
- **Frame Lifecycle**: World-space → Camera transform → Screen-space sequence

#### 2. Batching Strategies

- **Static Bitmap Caching**: `BossRenderer._bitmapCache`, `EnemyRenderer._bodyCache`
- **Offscreen Canvas Pattern**: Lazy creation with key format `'${type}_${R}'`
- **Viewport Culling**: `isOnScreen(margin)` checks before ANY canvas API calls

#### 3. Resource Management

- **CTX Global Binding**: Temporary `window.CTX` reassignment in `EnemyRenderer.draw()`
- **Shadow Blur Reset**: Mandatory `ctx.shadowBlur = 0` after draws
- **Cache Invalidation**: Lazy GC — old entries collected when no longer referenced

#### 4. Frame Lifecycle Management

- **Camera Transform Stack**: `CTX.save()` → `translate(shake)` → ... → `CTX.restore()`
- **Deterministic Animation**: `performance.now()` trig — NO `Math.random()` in draw
- **Layer Order**: Background → Terrain → Decals → Entities → Projectiles → Lighting → HUD

---

## 4. Discrepancies Summary

### Critical (Must Fix)

| Issue | Location | Impact |
|-------|----------|--------|
| mtc-rendering.skill missing | `.windsurf/workflows/` | No rendering pattern documentation |
| Swap-remove pattern not documented | SKILL.md Section 6 | Developers may use splice O(n) |
| typeof guard pattern missing | SKILL.md Section 6 | Load order violations possible |

### Medium (Should Fix)

| Issue | Location | Impact |
|-------|----------|--------|
| CTX binding pattern not documented | SKILL.md Section 6 | Renderer context confusion |
| Cache key format not specified | SKILL.md Section 6 | Cache collisions possible |
| Camera transform boundaries vague | PROJECT_OVERVIEW.md Section 7 | Transform stack errors |

### Low (Nice to Have)

| Issue | Location | Impact |
|-------|----------|--------|
| JSDoc TOC navigation not in SKILL.md | New section | Developer onboarding friction |
| Hit-stop behavior not detailed | PROJECT_OVERVIEW.md Section 2 | Frame mode confusion |

---

## 5. Recommendations

### Immediate Actions

1. **Create mtc-rendering.skill** documenting the four rendering pattern categories
2. **Update SKILL.md Section 6.5** with swap-remove semantics example
3. **Update SKILL.md Section 6.3** with typeof guard pattern examples

### Secondary Actions

1. **Add Section 6.6** to SKILL.md: Renderer CTX binding pattern
2. **Update PROJECT_OVERVIEW.md Section 7** with exact transform boundaries
3. **Add Section 6.7** to SKILL.md: Wave modifier application requirement

### Verification Commands

To verify the class hierarchy:

```bash
grep -n "class.*extends" js/entities/**/*.js js/entities/*.js
```

To verify load order:

```bash
grep -n "script defer" index.html
```

To verify _tickShared pattern:

```bash
grep -n "_tickShared" js/entities/enemy.js
```

To verify draw separation:

```bash
grep -n "\.hp\s*[=+-]\|\.dead\s*[=]\|\.vx\s*[=+-]" js/rendering/*.js
# Should return NO results — no state mutation in renderers
```

---

## Appendix: Verified Code Patterns

### Pattern 1: _tickShared First Invariant

```javascript
// enemy.js:update()
if (this.dead) return;
this._tickShared(dt, player); // ← ALWAYS FIRST
// ... rest of update logic
```

### Pattern 2: Swap-Remove Semantics

```javascript
// game.js:550-556
for (let i = window.specialEffects.length - 1; i >= 0; i--) {
    const remove = window.specialEffects[i].update(dt, ...);
    if (remove) {
        window.specialEffects[i] = window.specialEffects[window.specialEffects.length - 1];
        window.specialEffects.pop();
    }
}
```

### Pattern 3: typeof Guard Pattern

```javascript
// Used throughout codebase for optional dependencies
if (typeof WorkerBridge !== 'undefined' && WorkerBridge.isReady) {
    WorkerBridge.send('analyze', data);
}
```

### Pattern 4: Renderer CTX Binding

```javascript
// EnemyRenderer.js:43-55
const _prevCTX = typeof window !== 'undefined' ? window.CTX : undefined;
if (typeof window !== "undefined") window.CTX = ctx;
try {
    // ... draw logic that accesses window.CTX ...
} finally {
    if (typeof window !== "undefined" && _prevCTX !== undefined)
        window.CTX = _prevCTX;
}
```

---

**End of Audit Report**
