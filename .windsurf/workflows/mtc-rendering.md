---
description: MTC Game rendering pipeline architecture — dispatcher patterns, layer ordering, caching strategies, and cross-file invariants for Canvas 2D rendering
---

# MTC Game Rendering Architecture Skill

## Overview

This skill covers the structural rendering patterns of MTC: Enhanced Edition. The game uses a **single HTML5 Canvas 2D context** (`CTX`) with a frame-by-frame retained-mode drawing pipeline. All rendering is orchestrated by `drawGame()` in `js/game.js`.

**Key rule:** `draw()` methods and renderer static methods MUST NOT modify gameplay state (HP, cooldowns, positions, score, wave counters). Render-local caches are permitted if they do not feed back into simulation.

---

## 1. Renderer Dispatcher Pattern

### 1.1 Static Dispatcher Classes

Both `PlayerRenderer` and `BossRenderer` are **static-method-only classes** — no instance state is held. Their entry point is always `ClassName.draw(entity, ctx)`.

```javascript
// Correct usage — called from drawGame()
PlayerRenderer.draw(player, CTX);
BossRenderer.draw(boss, CTX);
```

### 1.2 BossRenderer Dispatch Order (CRITICAL)

```javascript
static draw(e, ctx) {
    if (e instanceof KruFirst) BossRenderer.drawBossFirst(e, ctx);   // ← FIRST
    else if (e instanceof KruManop) BossRenderer.drawBoss(e, ctx);   // ← SECOND
    else if (e instanceof BossDog) BossRenderer.drawBossDog(e, ctx); // ← THIRD
    ctx.shadowBlur = 0; // catch-all reset
}
```

**Why order matters:** Both `KruManop` and `KruFirst` extend `BossBase` (which extends `Entity`). Checking `instanceof KruManop` first would silently match `KruFirst` if they share a prototype chain change. Always check the more specific subclass first.

### 1.3 PlayerRenderer Dispatch Order

```javascript
static draw(entity, ctx) {
    if (entity instanceof AutoPlayer) PlayerRenderer._drawAuto(entity, ctx);
    else if (entity instanceof PoomPlayer) PlayerRenderer._drawPoom(entity, ctx);
    else if (entity instanceof KaoPlayer) PlayerRenderer._drawKao(entity, ctx);
    else if (entity instanceof PatPlayer) PlayerRenderer._drawPat(entity, ctx);
    else PlayerRenderer._drawBase(entity, ctx); // generic fallback
}
```

### 1.4 Viewport Culling (before draw)

All renderers perform viewport culling BEFORE any canvas API calls:

```javascript
// BossRenderer.draw() — skip if off-screen
if (!e.isOnScreen(200)) return; // 200px margin covers aura/domain rings

// PlayerRenderer.draw() — inline cull
const _cullScreen = worldToScreen(entity.x, entity.y);
const _cullR = (entity.radius || 20) + 80;
if (_cullScreen.x < -_cullR || _cullScreen.x > CANVAS.width + _cullR ||
    _cullScreen.y < -_cullR || _cullScreen.y > CANVAS.height + _cullR) return;
```

`isOnScreen(margin)` is defined on `Entity` (`js/entities/base.js`) and checks against `CANVAS` dimensions.

---

## 2. Frame Draw Sequence

The canonical draw order in `drawGame()` (`js/game.js`):

```
1.  CTX.clearRect / background fill
2.  CTX.save()  +  screen-shake CTX.translate(shakeX, shakeY)
3.  mapSystem.drawTerrain(ctx, camera)       — hex grid, circuit paths, zone floors, auras, landmark rings
4.  mapSystem.draw()                          — MapObjects (desks, servers, trees, walls) + MTCRoom
5.  decalSystem.draw()                        — floor decals (blood splatter, scorch marks)
6.  shellCasingSystem.draw()                  — ejected brass casings (physics-simulated)
7.  specialEffects[].draw()  loop             — boss attacks, BubbleProjectile, DomainExpansion visual objects
8.  powerups[].draw()  loop                   — PowerUp entities
9.  enemies[].draw()  loop → EnemyRenderer    — enemy sprites (EnemyBase subclasses)
10. BossRenderer.draw(boss, ctx)              — boss sprite (null-checked)
11. PlayerRenderer.draw(player, ctx)          — player sprite + aura ring (via _drawKao/Auto/Poom/Pat)
12. drone?.draw()                             — Drone entity (orbit + rotors)
13. projectileManager.draw()                  — all live Projectile sprites
14. particleSystem.draw()                     — Particle pool (circle, binary, zanzo, slash_arc, steam)
15. floatingTextSystem.draw()                 — damage/heal/status text popups
16. hitMarkerSystem.draw()                    — hit X crosshair markers
17. mapSystem.drawLighting(player, ...)       — shadow overlay (OffscreenCanvas, throttled 30Hz)
18. drawSlowMoOverlay()                       — Bullet Time vignette, letterbox, ripple rings
19. DomainExpansion.draw(ctx)    (if active)  — full-screen domain overlay (Manop)
20. GravitationalSingularity.draw(ctx)        — full-screen domain overlay (KruFirst)
21. drawWaveEvent(ctx)                        — fog/speed wave overlays + WaveAnnouncementFX
22. CanvasHUD.draw(ctx, dt)                   — combo counter, confused warning, minimap (on top)
23. TutorialSystem.draw(ctx)                  — tutorial spotlight/dim (very last — always on top)
24. CTX.restore()                             — release screen-shake transform
```

---

## 3. Coordinate System & World→Screen Transform

```javascript
// utils.js — the single coordinate transform function
function worldToScreen(worldX, worldY) {
    return {
        x: worldX - camera.x,
        y: worldY - camera.y
    };
}

// camera is updated each frame in updateGame():
// camera.x += (player.x - CANVAS.width/2 - camera.x) * GAME_CONFIG.canvas.cameraSmooth
// camera.y += (player.y - CANVAS.height/2 - camera.y) * GAME_CONFIG.canvas.cameraSmooth
```

**All entity rendering MUST use `worldToScreen(entity.x, entity.y)` for the screen origin.**

The camera origin (world 0,0) is always at screen center when no player is present.

---

## 4. OffscreenCanvas Caching (BossRenderer)

`BossRenderer` uses an `OffscreenCanvas` cache for static boss body parts that don't change per frame:

```javascript
static _getOrCreateBodyBitmap(key, w, h, paintFn, dirty = false) {
    if (!dirty && BossRenderer._bitmapCache.has(key)) {
        return BossRenderer._bitmapCache.get(key); // cache hit — no allocation
    }
    const osc = new OffscreenCanvas(w, h);
    const octx = osc.getContext('2d');
    paintFn(octx); // paint static content
    BossRenderer._bitmapCache.set(key, osc);
    return osc;
}
// Usage:
ctx.drawImage(bmp, -bmpSize / 2, -bmpSize / 2);
```

**When to pass `dirty = true`:** On phase transitions (`isEnraged` flip, phase number change) to force repaint. Otherwise the stale bitmap persists.

**Cache key format:** `'<boss>_<variant>'` e.g. `'manop_body_50'`, `'dog_normal'`.

---

## 5. Lighting System (30Hz OffscreenCanvas)

```javascript
// mapSystem._lightCanvas — a secondary OffscreenCanvas for the shadow overlay
// mapSystem.drawLighting(player, projectiles, extraLights) in drawGame()
```

**Throttle:** Frame counter check `(this._lightFrame & 1) !== 0` → skips redraw every other frame (effectively 30Hz at 60fps). On skip frames, `CTX.drawImage(lc, 0, 0)` blits the cached result.

**Technique:**
1. Fill OffscreenCanvas with `rgba(nightR, nightG, nightB, darkness)` — ambient shadow layer.
2. Punch holes at light sources using `globalCompositeOperation = 'destination-out'` (radial gradient erase).
3. Overlay tinted bloom with `'source-over'` (warm/cool/green glow per source type).
4. `CTX.drawImage(lc, 0, 0)` composites onto main canvas.

**Light sources:** player, projectiles (team-tinted), datapillars (cool), server racks (warm), trees (green), database POI, shop POI, MTCRoom.

---

## 6. Screen Shake Architecture

Screen shake is applied as a **single translate** at the start of `drawGame()`, released by `CTX.restore()` at the end:

```javascript
// drawGame():
CTX.save();
const shake = getScreenShakeOffset();
CTX.translate(shake.x, shake.y);
// ... all world-space rendering here ...
CTX.restore(); // shake ends — HUD/tutorial draw AFTER this restore
```

`getScreenShakeOffset()` in `utils.js`:
- Returns `{x: 0, y: 0}` when `screenShake <= 1` (perf guard — no sub-pixel jitter).
- Decays by `GAME_CONFIG.visual.screenShakeDecay` factor per frame.

**HUD elements** (CanvasHUD, TutorialSystem) are drawn **after** `CTX.restore()` — they are never shaken.

---

## 7. Minimap (Dual Clip Architecture)

The minimap has a **two-level `save/restore` pattern** to correctly isolate blend mode, alpha, and clip state:

```javascript
// OUTER SAVE — explicitly resets composite/alpha/shadow leaked from lighting
ctx.save();
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 1;
ctx.shadowBlur = 0;

    CanvasHUD._minimapDrawShell(ctx, ...);  // border ring (no clip)

    // INNER SAVE — establishes circular clip region
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius - 1, 0, Math.PI * 2);
    ctx.clip(); // ← clip is active from here

        CanvasHUD._minimapDrawContent(ctx, ...); // grid, sweep, blips — all clipped

    ctx.restore(); // ← INNER restore — clip released; CRITICAL ORDER

CanvasHUD._minimapDrawLabel(ctx, ...); // label drawn outside clip

ctx.restore(); // ← OUTER restore
```

**Why two levels:** The inner `clip()` must be isolated so it doesn't contaminate the label draw or subsequent HUD elements. The outer save guards against blend mode leakage from `mapSystem.drawLighting()` which uses `destination-out`.

---

## 8. Animation Rules

### 8.1 No `Math.random()` in `draw()`

All animation uses deterministic `performance.now()` trigonometry:

```javascript
// ✅ Correct
const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.5;

// ❌ Never in draw()
Math.random() // creates GC pressure and breaks determinism
```

Exceptions: `_crackLines` and screen crack VFX in boss attacks use `Math.random()` but are seeded ONCE in `update()` and cached.

### 8.2 `performance.now()` — Fetch Once

```javascript
// ✅ Fetch once at top of draw block
const now = performance.now();
// Pass `now` to sub-methods — do NOT call performance.now() repeatedly in a loop
```

### 8.3 `shadowBlur` Reset Rule

Every `ctx.shadowBlur = N` assignment MUST be followed by `ctx.shadowBlur = 0` before returning or passing control to the next draw section.

The `BossRenderer.draw()` catch-all: `ctx.shadowBlur = 0` always runs after dispatch, covering any method that returns early without cleanup.

---

## 9. PlayerRenderer Shared Animation State (`_getLimbParams`)

All character draw methods call `PlayerRenderer._getLimbParams(entity, now, speedCap)` to get shared squash-stretch and limb parameters:

```javascript
// Returns:
{
  moveT,        // 0–1 movement speed normalized to speedCap
  bob,          // sin(walkCycle) — vertical body bob
  breathe,      // sin(now/220) — idle breathing
  stretchX,     // horizontal squash-stretch scale
  stretchY,     // vertical squash-stretch scale
  bobOffsetY,   // vertical offset at run peak
  shootLift,    // upward arm raise during shoot
  shootReach,   // forward arm extend during shoot
  hurtPushX/Y,  // recoil push direction on hit
  runLean,      // forward body lean angle in radians
  dashStretchX, // horizontal elongation during dash
  shadowScaleX, shadowScaleY, shadowAlphaMod, // ground shadow scaling
  footL, footR, // foot swing offsets { x, y }
  animState     // entity._anim.state string
}
```

All values read from `entity._anim` (set by `PlayerBase.update()`) — never recomputed in draw.

---

## 10. EnemyRenderer Sprite Caching (Perf Phase 4)

`EnemyRenderer` maintains a `Map` cache for offscreen body gradient sprites to eliminate per-frame gradient recreation:

```javascript
// Key format: `${type}_${R}` — one sprite per (type × radius) pair
static _bodyCache = new Map();

static _getBodySprite(key, R, fn) {
    if (EnemyRenderer._bodyCache.has(key)) {
        return EnemyRenderer._bodyCache.get(key);
    }
    const PAD = 3;
    const size = Math.ceil(R * 2) + PAD * 2 + 4;
    const oc = document.createElement('canvas');
    oc.width = oc.height = size;
    const ox = oc.getContext('2d');
    fn(ox, R, size / 2, size / 2);
    EnemyRenderer._bodyCache.set(key, oc);
    return oc;
}
```

**Cache key pattern**: `'enemy_18'`, `'tank_25'`, `'mage_20'` — type + collision radius.

**Invalidation**: Lazy — new keys create new entries; stale entries are GC'd when no longer referenced. No manual cache clearing needed.

**Context rebind pattern**: `EnemyRenderer.draw()` saves/restores `window.CTX` so legacy `draw()` methods can access the active context:

```javascript
const _prevCTX = window.CTX;
window.CTX = ctx;
try {
    // dispatch to specific draw methods
} finally {
    window.CTX = _prevCTX;
}
```

---

## 11. JSDoc Navigation Convention (Cross-Cutting)

All renderer source files follow the JSDoc header convention for AI-assisted navigation:

```javascript
/**
 * js/rendering/EnemyRenderer.js
 * ════════════════════════════════════════════════════════════════════════════
 * Enemy-only draw dispatcher and renderer helpers.
 *
 * @module js/rendering/EnemyRenderer
 * @fileoverview Static dispatcher for all enemy type rendering
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────────────
 *  L.11   static _bodyCache       Offscreen sprite cache Map
 *  L.12   static draw(e, ctx)    Main entry — viewport cull + dispatch
 *  L.72   static _getBodySprite() Lazy offscreen canvas creator
 *  ...
 *
 * ⚠️  draw() rebinds window.CTX — must restore in finally block
 * ⚠️  _bodyCache grows unbounded — lazy GC only when entries unreferenced
 * ════════════════════════════════════════════════════════════════════════════
 */
```

**Navigation contract**: `grep -n 'L\.' js/rendering/*.js` returns all TOC entries with exact line numbers.

---

## 12. Cross-File Rendering Dependencies

| Renderer / Draw Method | Depends On (implicit) | Source |
|---|---|---|
| `BossRenderer.draw()` | `worldToScreen()`, `CANVAS`, `CTX` | `utils.js` |
| `PlayerRenderer.draw()` | `worldToScreen()`, `CANVAS`, `CTX`, `mouse.wx/wy` | `utils.js`, `input.js` |
| `CanvasHUD.drawMinimap()` | `worldToScreen()`, `window.isFogWave`, `MTC_DATABASE_SERVER`, `BALANCE.shop` | `utils.js`, `WaveManager.js`, `AdminSystem.js`, `config.js` |
| `mapSystem.drawLighting()` | `getScreenShakeOffset()`, `CANVAS`, `CTX` | `utils.js` |
| `EnemyRenderer` | `worldToScreen()`, `CTX`, `window.CTX` | `utils.js` |
| `DomainExpansion.draw(ctx)` | `worldToScreen()`, `window.boss`, `window.player` | `utils.js`, `GameState.js` |
| `GravitationalSingularity.draw(ctx)` | `worldToScreen()`, `window.boss`, `window.player`, `BALANCE.boss.gravitationalSingularity` | `utils.js`, `config.js` |
| `TutorialSystem.draw(ctx)` | `worldToScreen()`, `MTC_SHOP_LOCATION`, `MTC_DATABASE_SERVER` | `utils.js`, `ShopSystem.js`, `AdminSystem.js` |
| `drawSlowMoOverlay()` | `CANVAS`, `CTX`, `worldToScreen()`, `window.player`, `window.isSlowMotion` | `utils.js`, `TimeManager.js` |

---

## 13. Rendering & Global State Invariants

1. **No state mutation in draw:** `draw()` methods must not write to `entity.hp`, `player.cooldowns`, `window.score`, `GameState`, etc.
2. **World-space all entities:** Never hardcode screen coordinates for entity positions — always use `worldToScreen(entity.x, entity.y)`.
3. **Save/restore symmetry:** Every `ctx.save()` must have a matching `ctx.restore()`. Unmatched saves leak transform state across frames.
4. **shadowBlur cleanup:** Always reset `ctx.shadowBlur = 0` — never rely on the next save/restore to clear it.
5. **No `Math.random()` in draw:** All randomness for visual FX must be cached in `update()` and read in `draw()`.
6. **Domain draws after world, before HUD:** Domain overlay draws (steps 19–20) must occur after all entities but before `CanvasHUD` — they are full-screen overlays that intentionally obscure game entities.
7. **Tutorial always last:** `TutorialSystem.draw()` is always the final canvas call — it must overlay everything including HUD.
