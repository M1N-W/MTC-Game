# MTC Game — Performance Optimization Plan

**Session date:** March 2026 | **Target:** 60 FPS smooth, reduce GC stutter

---

## Legend

- ✅ DONE — patched & output file ready
- 🔲 TODO — planned, not yet implemented
- ⏭️ SKIP — investigated, not needed (already implemented)

---

## Audit Summary (files reviewed)

| File | Lines | Status |
|---|---|---|
| `enemy.js` | 1596 | ✅ Patched |
| `BossRenderer.js` | 1574 | ✅ Already had culling |
| `PlayerRenderer.js` | 5004 | ⏭️ Player always on-screen, low priority |
| `effects.js` | 2598 | ✅ Patched |
| `map.js` | 1891 | ✅ Patched |
| `config.js` | — | ✅ Patched (added `*ColorBase` keys) |

Files **not yet audited:** `game.js`, `weapons.js`, `ui.js`, `summons.js`, boss attack files

---

## TIER 1 — High Impact, Low Risk

### T1-A ✅ EnemyRenderer viewport culling

**File:** `enemy.js` — `EnemyRenderer.draw()` (dispatcher)
**Change:** Added cull guard before any sub-method runs

```js
const screen = worldToScreen(e.x, e.y);
const R = (e.radius ?? 20) + 40;
if (screen.x < -R || screen.x > CANVAS.width + R ||
    screen.y < -R || screen.y > CANVAS.height + R) return;
```

**Impact:** Late-game 40 enemies, only ~15 on-screen → ~60% fewer draw calls

---

### T1-B ✅ Date.now() → performance.now() in EnemyRenderer

**File:** `enemy.js` — `drawEnemy()`, `drawTank()`, `drawMage()`
**Change:** All 3 draw methods changed from `Date.now()` to `performance.now()`
**Reason:** Consistent with BossRenderer/PlayerRenderer, sub-ms float, avoids integer boxing

---

### T1-C ✅ Decal viewport culling

**File:** `effects.js` — `Decal.draw()`
**Change:** Added cull guard at top of draw() using anchor `(this.x, this.y)` + `radius` margin

```js
if (typeof CANVAS !== 'undefined') {
    const screen = worldToScreen(this.x, this.y);
    const pad = this.radius + 4;
    if (screen.x < -pad || screen.x > CANVAS.width + pad ||
        screen.y < -pad || screen.y > CANVAS.height + pad) return;
}
```

**Why:** Decals are persistent (18s lifetime, cap 80) — late-game floor is covered with them across the 3200×3200 world

---

### T1-D ✅ Arena boundary — string alloc elimination

**Files:** `config.js` + `map.js` — `drawTerrain()` arena block
**Change:** Replaced `.replace('{a}', (...).toFixed(3))` pattern with `ctx.globalAlpha` + solid RGB string

**config.js additions** (backward-compat — old `*Color` keys kept):

```js
// arena block
haloColorBase: 'rgb(180,100,20)',
midColorBase:  'rgb(120,60,10)',
rimColorBase:  'rgb(250,180,30)',
dashColorBase: 'rgb(245,158,11)',

// landmark block
outerColorBase: 'rgb(250,180,30)',
innerColorBase: 'rgb(34,211,238)',
spokeColorBase: 'rgb(250,180,30)',
```

**map.js change:** arena (4 strokes) + landmark rings + spokes + center dot

```js
// Before (allocs string every frame)
ctx.strokeStyle = A.haloColor.replace('{a}', (A.haloAlphaBase + Math.sin(t * 0.6) * 0.03).toFixed(3));

// After (zero alloc)
ctx.globalAlpha = A.haloAlphaBase + Math.sin(t * 0.6) * 0.03;
ctx.strokeStyle = A.haloColorBase;
```

**Impact:** ~9 string allocations/frame eliminated (arena×4 + landmark×3 + center dot×1 + spoke×1) → ~540 objects/s GC pressure removed

---

### T1-E ⏭️ Already done — no action needed

| System | Status |
|---|---|
| `BossRenderer.draw()` viewport cull | ✅ `isOnScreen(200)` in dispatcher |
| `Particle.draw()` viewport cull | ✅ exists |
| `FloatingText.draw()` viewport cull | ✅ exists |
| `OrbitalParticle.draw()` viewport cull | ✅ exists |
| `ShellCasing.draw()` viewport cull | ✅ exists |
| `MapSystem.draw()` objects culling | ✅ dirty-flag sort + CULL margin |
| `drawZoneFloors()` culling | ✅ exists |
| `drawTerrain` hex grid | ✅ viewport-culled colStart/colEnd |
| Circuit packets | ✅ throttled every 2 frames |
| `effects.js splice()` | ✅ none — all swap-and-pop |
| `enemy.js splice()` | ✅ none |
| `Math.random()` in draw paths | ✅ all in spawn/init only |

---

## TIER 2 — Medium Impact, Medium Risk

### T2-A 🔲 splice() → swap-and-pop audit in remaining files

**Files to check:** `game.js`, `weapons.js`
**Action:**

```bash
grep -n "\.splice(" js/game.js js/weapons.js
```

Replace any `.splice(i, 1)` in entity/projectile remove loops with swap-and-pop

---

### T2-B 🔲 String template literals in UI draw path

**File:** `ui.js`
**Problem:** `` `HP: ${player.hp}` `` allocates string every frame even when value unchanged
**Fix pattern:**

```js
if (this._cachedHp !== this.hp) {
    this._hpStr = `HP: ${this.hp}`;
    this._cachedHp = this.hp;
}
ctx.fillText(this._hpStr, x, y);
```

**Scope:** Audit which HUD values change every frame vs. only on hit/heal

---

### T2-C 🔲 Boss attack particle pool audit

**Files:** `boss_attacks_first.js`, `boss_attacks_manop.js`
**Problem:** Boss attacks may use `new Particle(...)` directly instead of `particleSystem.spawn()`
**Action:** `grep -n "new Particle\|new FloatingText" js/entities/boss/boss_attacks_*.js`

---

## TIER 3 — Lower Priority / Higher Risk

### T3-A 🔲 Enemy-enemy proximity — SpatialGrid expand scope

**File:** `game.js`, `UtilityAI.js`
**Problem:** UtilityAI `_nearbyAlliesList` query may be O(N²) over all enemies
**Risk:** High — must not touch AI write paths. Read-only spatial query only.
**Note:** Check `_nearbyAlliesList.length = 0` pattern is already there (it is ✅)

### T3-B 🔲 `instanceof` in hot loop → type flag

**Files:** `game.js`, `BossRenderer.js`
**Problem:** `instanceof KruFirst` in entity loop = prototype chain walk per entity per frame
**Fix:** Add `this._entityType = 'kru_first'` string flag, compare with `===` instead
**Risk:** Medium — must preserve KruFirst > KruManop dispatch order in BossRenderer

### T3-C 🔲 `ctx.save/restore` pair audit — transform leak check

**File:** `BossRenderer.js` (KruFirst 5-layer system)
**Action:** Count save/restore pairs in each draw function — must be equal
**Risk:** Medium — KruFirst has complex nested layers

---

## Output Files

### Session 1

| File | Changes |
|---|---|
| `enemy.js` | T1-A viewport cull in dispatcher · T1-B Date.now→performance.now ×3 |
| `effects.js` | T1-C Decal.draw() viewport cull |
| `map.js` | T1-D arena + landmark globalAlpha refactor |
| `config.js` | T1-D `*ColorBase` RGB keys (arena ×4, landmark ×3) |

### Session 2

| File | Changes |
|---|---|
| `game.js` | G1 mapSystem.update zero-alloc buffer · G2 specialEffects for loop · G3 meteorZones globalAlpha |
| `ui.js` | U1 minimap trail loop globalAlpha (24 toFixed/frame eliminated) |

---

## Remaining Work

### 🔲 W1 — weapons.js SpatialGrid integer key (Medium)

**File:** `weapons.js`
**Problem:** Template literal key in `build()` (N allocs) + `query()` (9× per projectile) = ~220 string allocs/frame
**Fix:** Pack cx,cy into 32-bit integer key

```js
_cellKey(cx, cy) { return ((cx & 0xFFFF) << 16) | (cy & 0xFFFF); }
// build(): const key = this._cellKey(this._cellCoord(e.x), this._cellCoord(e.y));
// query(): const cell = this._cells.get(this._cellKey(cx + dx, cy + dy));
```

Safe range: map 3200px / cell 128px = 25 cells max, fits 16-bit ✅

### 🔲 U2 — ui.js minimap POI pulse rgba (Low)

**File:** `ui.js` — `_minimapDrawContent()`
~8 template literal rgba strings with pulse multiplier per frame
Same globalAlpha + solid color pattern as U1

### 🔲 T2-C — Boss attack particle pool audit (Medium)

```bash
grep -n "new Particle\|new FloatingText" js/entities/boss/boss_attacks_*.js
```

### 🔲 T3-B — instanceof → type flag in enemy draw loop (Low)

---

## Next Session Checklist

1. Upload `weapons.js` → patch W1 (SpatialGrid integer key)
2. Upload `ui.js` → patch U2 (minimap POI globalAlpha)
3. `grep new Particle` in boss attack files → T2-C
4. Measure FPS before/after in `Debug.html`
