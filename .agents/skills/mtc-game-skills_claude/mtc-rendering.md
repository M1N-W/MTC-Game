---
name: mtc-rendering
description: >
  Canvas draw patterns and conventions for MTC The Game's rendering system.
  Use this skill at the start of EVERY task that touches BossRenderer.js, PlayerRenderer.js,
  or any canvas draw code for bosses or players. Trigger on: BossRenderer, PlayerRenderer,
  draw boss, draw player, add visual effect, add aura, add glow, add particle, add layer,
  ctx.save, ctx.restore, shadowBlur, worldToScreen, viewport cull, Math.random in draw,
  facing flip, hover animation, phase aura, deterministic particle, breathe animation,
  HP bar, hit flash, new boss visual, new player visual, rendering bug, glow leak,
  transform leak, draw order, layer system, screen-space vs world-space, RenderTokens,
  RT.palette, RT.glow, AutoRenderer, _bodyCache.
---

# MTC Rendering — Pure Draw Patterns

These patterns never change regardless of game balance or new features.
When in doubt about any draw code in this project, apply these rules.

---

## 0. Frame Lifecycle & Rendering Pipeline

The game loop in `game.js` follows a strict sequence every frame (Target: 60FPS):

1. **Input Handling** (`input.js`): Process keys and mouse.
2. **Logic Update** (`game.js` → `updateGame(dt)`):
   - Physics, AI (`_tickShared`), state transitions.
   - **CRITICAL**: All state mutations MUST happen here.
3. **Background Fill**: `drawGame()` fills the canvas with a linear gradient or solid color (no `clearRect` needed).
4. **Rendering Dispatch** (`game.js` → `drawGame()`):
   - Terrain (`map.js`) → Scars (decals, casings) → Entities (`enemies`, `boss`) → Player (`PlayerRenderer`) → Effects (`specialEffects`) → HUD (`CanvasHUD`, `UIManager`).
   - **Architectural Constraint**: Rendering logic must be "read-only" relative to the game state.

---

## 1. The Three Immutable Laws of draw()

```
1. NEVER write state in draw()       — only read, never mutate
2. NEVER use Math.random() in draw() — causes flicker + non-determinism
3. ALWAYS reset ctx.shadowBlur = 0   — leaks contaminate every draw after it
```

---

## 2. ctx.save / ctx.restore — Pairing Rules

Every transform block must be perfectly paired. Missing `restore()` = transform leak to ALL subsequent draws (silent, extremely hard to debug).

```js
// ✅ Correct
ctx.save();
ctx.translate(screen.x, screen.y);
ctx.rotate(angle);
// ... draw
ctx.restore();

// ✅ Nested — one pair per level
ctx.save();
ctx.translate(x, y);
ctx.save();
ctx.rotate(t);
ctx.stroke();
ctx.restore();
ctx.restore();

// ❌ Early return without restore = permanent transform leak
ctx.save();
ctx.translate(x, y);
if (entity.dead) return; // BUG — save without matching restore

// ✅ Fix: guard before the save, not inside it
if (entity.dead) return;
ctx.save();
ctx.translate(x, y);
// ... draw
ctx.restore();
```

---

## 3. shadowBlur — Reset After Every Glow Pass

Reset immediately after the draw call that uses the glow — not "at the end of the method".
A missed reset will tint every entity drawn after this one on the same frame.

```js
// ✅
ctx.shadowBlur = 14;
ctx.shadowColor = '#00ffff';
ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
ctx.shadowBlur = 0;   // ← reset here

// ✅ Dispatcher safety reset — catches leaks from any early return inside sub-draws
static draw(e, ctx) {
    if (!e.isOnScreen(200)) return;
    if (e instanceof KruFirst) BossRenderer.drawBossFirst(e, ctx);        // KruFirst BEFORE ManopBoss
    else if (e instanceof ManopBoss) BossRenderer.drawBoss(e, ctx);       // KruManop
    else if (e instanceof BossDog) BossRenderer.drawBossDog(e, ctx);
    ctx.shadowBlur = 0;   // ← catch-all
}
```

---

## 4. No Math.random() in draw() — Deterministic Oscillation

`draw()` runs 60×/s. `Math.random()` in draw = different value every frame = visible flicker.
Use time-based deterministic oscillation instead.

`performance.now()` — call ONCE per draw method, reuse everywhere inside it:

```js
// ✅ Call once at top, pass through to every sub-layer
static drawBossFirst(e, ctx) {
    const now = performance.now();
    const t   = now / 1000;   // seconds — for sin/cos oscillators
    // pass `now` or `t` to any layer that needs time-based animation
}
// ❌ Calling performance.now() inside each sub-layer = multiple calls per frame
//    with subtly different timestamps → phase jitter between layers
```

```js
// ❌ Never
for (let i = 0; i < 6; i++) {
  ctx.arc(Math.random() * R, 0, 3, 0, Math.PI * 2); // flickers every frame
}

// ✅ Deterministic seed pattern — animated, stable, no RNG
const t = performance.now() / 1000;
for (let i = 0; i < 6; i++) {
  const seed = i * 137.5; // golden angle spread
  const baseA = ((seed % 360) * Math.PI) / 180;
  const rise = (t * 0.3 + seed * 0.01) % 1.0; // 0→1 loop
  const px = Math.cos(baseA + t * 0.5) * R * 1.4;
  const py = -rise * R * 1.8;
  const alpha = Math.sin(rise * Math.PI); // fade in, fade out
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(px, py, 3, 0, Math.PI * 2);
  ctx.fill();
}
ctx.globalAlpha = 1;
```

---

## 5. World Space vs Screen Space

Entity positions are world coords. Canvas draws in screen coords. Convert once at the top of the draw method.

```js
const screen = worldToScreen(entity.x, entity.y);
```

Camera scale — always use the static helper, never read `camera.scale` directly:

```js
// ✅ Safe — handles undefined camera and missing scale property
const camScale = PlayerRenderer._getCamScale(); // same helper on BossRenderer
// ❌ camera.scale              — TypeError if camera is not yet initialised
// ❌ window.camera?.scale ?? 1 — spreads the silent-undefined pattern elsewhere
```

`_getCamScale()` is a static method on both `PlayerRenderer` and `BossRenderer`.
Use it everywhere camera scale is needed inside a draw path.

```js
const screen = worldToScreen(entity.x, entity.y);

// ── World-space elements: translate to screen, draw in local coords ──
ctx.save();
ctx.translate(screen.x, screen.y);
ctx.arc(0, 0, R, 0, Math.PI * 2); // (0,0) = entity centre in local space
ctx.restore();

// ── Screen-space elements: use screen.x/y directly, no translate ──
// HP bars, labels — drawn relative to screen pos, not inside any save block
ctx.fillText("HP", screen.x, screen.y - R - 20);

// ⚠️ Text inside a rotated ctx.save() block will also rotate — keep labels outside
// ⚠️ HP bar drawn OUTSIDE the body ctx.save() block — must stay screen-space
```

---

## 6. Viewport Culling

Skip ALL draw work when entity is off-screen — including aura setup.
The margin covers glow/aura that extends beyond the entity radius.

```js
// ✅ Dispatcher-level cull — one guard covers all sub-draws
static draw(e, ctx) {
    if (!e.isOnScreen(200)) return;   // 200px margin for large auras
    // ...
}

// ✅ Manual cull inside entity.draw() (when no dispatcher)
draw(ctx) {
    const screen = worldToScreen(this.x, this.y);
    const R = (this.radius ?? 20) + 40;
    if (screen.x < -R || screen.x > CANVAS.width  + R) return;
    if (screen.y < -R || screen.y > CANVAS.height + R) return;
    // safe to draw
}
```

---

## 7. Facing Flip Pattern

Flip only the body block. Rings, auras, and text must NOT flip — they should always face the player/camera.

```js
const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;

// ── Auras / rings — before flip block, always face forward ──
ctx.save();
ctx.translate(screen.x, screen.y);
ctx.arc(0, 0, auraR, 0, Math.PI * 2);
ctx.restore();

// ── Body block only — flip here ──
ctx.save();
ctx.translate(screen.x, screen.y);
if (isFacingLeft) ctx.scale(-1, 1);
// ... draw body, limbs, weapons
ctx.restore();

// ── Orbiting text labels — counter-rotate to stay readable ──
ctx.save();
ctx.translate(ox, oy);
ctx.rotate(-entity.angle); // cancels parent rotation
ctx.fillText(label, 0, 0);
ctx.restore();
```

---

## 8. Hover Animation Pattern

For floating/flying entities. Shadow ellipse compensates for the hover offset.

```js
const now = performance.now();
const hoverY = Math.sin(now / 150) * 4; // vertical bob
const hoverX = Math.sin(now / 230) * 1.2; // subtle lateral drift

ctx.save();
ctx.translate(screen.x + hoverX, screen.y + hoverY);

// Ground shadow shifts opposite to hover
ctx.ellipse(0, R * 1.25 - hoverY * 0.4, R * 1.05, R * 0.22, 0, 0, Math.PI * 2);

// All other layers draw at (0,0) inside this translate
ctx.restore();
```

---

## 9. Breathe Animation Pattern

Subtle scale pulse for living entities. Apply inside the body save block only.

```js
ctx.save();
ctx.translate(screen.x, screen.y);
const breathe = Math.sin(now / 250); // ~1.6s cycle
ctx.scale(1 + breathe * 0.018, 1 - breathe * 0.022);
// ... draw body
ctx.restore();
```

---

## 10. Phase-Aura Pattern (Boss)

Always use dual-check: explicit `e.phase` field + HP ratio fallback.
This ensures the aura renders correctly even before `this.phase` is set.

```js
const hpRatio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
const isP1 = e.phase === 1 || (!e.phase && hpRatio > 0.6);
const isP2 = e.phase === 2 || (!e.phase && hpRatio > 0.3 && hpRatio <= 0.6);
const isP3 = e.phase === 3 || (!e.phase && hpRatio <= 0.3);

if (isP1) {
  /* calm aura — cyan/green  */
} else if (isP2) {
  /* stressed aura — orange/red */
} else {
  /* critical aura — purple/white */
}
```

---

## 11. Layer Naming Convention

Label every visual layer so draw order is scannable. Use decimal layers to slot new effects without renumbering.

```
// ── LAYER 0   — Ground shadow ─────────────────────────────
// ── LAYER 0.5 — Phase aura ────────────────────────────────
// ── LAYER 0.6 — Ambient particles ─────────────────────────
// ── LAYER 1   — Berserk / state aura ──────────────────────
// ── LAYER 2   — Orbiting elements (rings, formulas, debris)
// ── LAYER 3   — State-gated effects (charge, telegraph) ───
// ── LAYER 4   — Equipment behind body (jetpack, wings) ────
// ── LAYER 5   — Body block (facing flip + breathe) ────────
// ── HP BAR    — Screen-space, outside all transforms ──────
// ── LOW HP    — Inside body transform, after body draw ────
```

---

## 12. Animation State — Read Only in draw()

`entity._anim` is written exclusively by `update()`. draw() reads it, never writes.

```js
// ✅ Read in draw
const sT = entity._anim?.skillT ?? 0;
const hurtT = entity._anim?.hurtT ?? 0;
const shootT = entity._anim?.shootT ?? 0;

// ❌ Never write in draw — this is a hidden state mutation
entity._anim.shootT = 1;
```

---

## 13. Radial Gradient — Standard Setup

```js
// Inner offset (-R*0.25, -R*0.30) creates a "light source from top-left" feel
const grad = ctx.createRadialGradient(-R * 0.25, -R * 0.3, 1, 0, 0, R);
grad.addColorStop(0, "#374151"); // bright centre
grad.addColorStop(0.55, "#1f2937");
grad.addColorStop(1, "#111827"); // dark edge
ctx.fillStyle = grad;
ctx.beginPath();
ctx.arc(0, 0, R, 0, Math.PI * 2);
ctx.fill();
```

---

## 14. New Boss Draw Method — Checklist

1. Guard: `ctx.shadowBlur = 0;` at top of method
2. Viewport cull: handled by dispatcher — don't add a second check inside the method
3. Convert: `const screen = worldToScreen(e.x, e.y);`
4. Label every layer: `// ── LAYER N ──`
5. Phase aura: dual-check pattern (§10)
6. Particles: deterministic seed (§4), no Math.random()
7. shadowBlur: reset after every glow pass (§3)
8. Facing flip: body block only, not rings/text (§7)
9. HP bar: outside body transform (screen coords)
10. Dispatcher order: KruFirst → ManopBoss → BossDog (KruFirst MUST be first — ManopBoss extends BossBase)

## 15. New Player Draw Method — Checklist

1. Create `js/rendering/[Name]Renderer.js` with `class [Name]Renderer { static _draw[Name](entity, ctx) {...} }`
2. Export: `window.[Name]Renderer = [Name]Renderer;` at end of file
3. In `PlayerRenderer.draw()` dispatcher: add `if (window.[Name]Renderer) [Name]Renderer._draw[Name](entity, ctx); else PlayerRenderer._draw[Name](entity, ctx);`
4. Add fallback stub `static _draw[Name](entity, ctx)` in `PlayerRenderer.js` (same body as XxxRenderer — used if file load order fails)
5. Load order in index.html: `[Name]Renderer.js` script tag BEFORE `PlayerRenderer.js`
6. Call `PlayerRenderer._drawGroundShadow()` and `PlayerRenderer._drawGroundFeet()` before LAYER 1
7. Call `PlayerRenderer._drawBase(entity, ctx)` for the body block if sharing Kao/Pat body shape
8. Read `entity._anim` only — never write
9. Extra effects (aura, ring, indicator): outside the body save/restore block
10. Verify stand aura helper name in PlayerRenderer.js before adding — no assumed helper names

---

## 16. charId-Guarded Effects in \_drawBase

`_drawBase()` is shared body code called by `KaoRenderer._drawKao()` and `PatRenderer._drawPat()` (and used directly as the fallback for unknown characters).
Character-specific effects that belong inside the body save block must be gated by `entity.charId`:

```js
// Inside _drawBase() body save block, after _drawHitFlash():
if (entity.charId === "kao") {
  const kaoDashT = entity._anim?.dashT ?? 0;
  // ... Kao-only dash glow
}
if (entity.charId === "pat") {
  const patHurtT = entity._anim?.hurtT ?? 0;
  // ... Pat-only parry flash
}
```

Rules:

- ❌ Do NOT add a separate `KaoRenderer._drawKaoExtra()` dispatch — `_drawBase` is already the Kao body path
- ❌ Do NOT check `instanceof KaoPlayer` inside draw() — charId string check is cheaper and safer
- ✅ Always reset `ctx.shadowBlur = 0` and `ctx.globalAlpha = 1` at the end of each guarded block
- Effects go AFTER `_drawHitFlash()` — flash must be the innermost layer

---

## 18. SVG Portrait System — ui.js window.PORTRAITS

Portrait images are **static SVG strings**, NOT canvas draw code.
They live in `window.PORTRAITS[charId]` inside `ui.js` and are injected into
`<div id="char-avatar-{charId}">` elements (96×112px) in the character select screen.

### Structural invariants (shared by all 4 characters)

```
<svg xmlns="..." viewBox="0 0 96 112">
  <defs>
    <!-- ptSkin filter: feGaussianBlur stdDeviation=0.6 — softens skin/face -->
    <!-- ptGlow / ptIrisN / ptFlash: radial/linear gradient defs per character -->
  </defs>

  <!-- Background gradient fill -->
  <!-- Signature glow element (LARGE, character-defining) -->
  <!-- Body / torso shape -->
  <!-- Neck -->
  <!-- Face: path Q26,38 48,28 Q70,38 (shared curve for all chars) -->
  <!-- Eyes: white sclera ellipse → iris radialGradient → dark pupil → glint -->
  <!-- Eyebrows: stroke-width 2.8 -->
  <!-- Nose / mouth / details -->
  <!-- Hair / accessories -->
  <!-- Weapon / equipment -->
</svg>
```

### Per-character signature elements (visual identity)

| charId | Signature element  | Notes                                         |
| ------ | ------------------ | --------------------------------------------- |
| `kao`  | Scope ring (r=9.5) | Glowing cyan ring over right eye              |
| `poom` | Naga snake         | Large serpent coiled behind body              |
| `auto` | Fire crown         | Flame burst above head                        |
| `pat`  | Iaido flash sweep  | Diagonal ice-blue blur lines corner-to-corner |

### Pat portrait specifics (established v3.35.x)

- `ptFlash` gradient: ice-blue (`#7ec8e3` → transparent), `feGaussianBlur stdDeviation=5`
- Topknot (chonmage): ellipse bun + gold cord — NOT bowl cut
- Iris: `ptIrisN` radialGradient (blue-white), white sclera ellipse, dark pupil, glint
- `ptSkin` filter applied to face and neck paths
- Zanzo ghost silhouette: low opacity (`~0.12`), offset behind main body
- Eyebrow stroke-width: 2.8 (matches Kao/Auto convention)
- Katana drawn prominently — not a thin line at the hip

### Rules

- ❌ Do NOT add `Math.random()`, `performance.now()`, or any JS to portrait SVGs — they are static strings
- ❌ Do NOT draw portraits on canvas — the system is SVG-injection only
- ✅ `ptSkin` filter (`feGaussianBlur stdDeviation=0.6`) is required on face + neck for all chars
- ✅ Iris must use a radialGradient def, not a flat fill — flat fill `#1a0808` is the old broken pattern
- ✅ Signature element must be visually comparable in size/prominence to Kao's scope ring
- ✅ When editing any portrait, read the other chars' SVGs first to verify shared face path coords

---

## 17. Muzzle Flash Pattern (Weapon-Local Space)

For characters whose weapon geometry is defined in a standalone `draw[X]Weapon(ctx)` function,
the muzzle flash must be drawn in the same local coordinate space as that function.

Pattern:

```js
// After drawPoomWeapon(ctx) call in LAYER 2:
if (poomShootT > 0.05) {
  const muzzleLocalX = 43; // weapon.translate(12) + muzzle_x(31) from weapon function
  const muzzleLocalY = 6; // weapon.translate(6) + muzzle_y(0)
  ctx.save();
  ctx.translate(muzzleLocalX, muzzleLocalY);
  // ... draw flash, rays — all relative to muzzle tip (0,0)
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.restore();
}
```

⚠️ If the weapon draw function changes its internal `ctx.translate()`, recalculate muzzleLocalX/Y.
⚠️ This block must be INSIDE the same `ctx.save()` that called `ctx.rotate(entity.angle)` —
the muzzle position is in aim-rotated local space, not world space.

---

## 19. Skill Tooltip Positioning — CSS + JS Pattern

`.skill-tooltip` uses `position: fixed` (NOT `absolute`) so it positions relative to
the viewport rather than any DOM ancestor. This avoids containing-block ambiguity when
tooltips are children of grid/flex containers.

CSS invariant:
.skill-tooltip {
position: fixed;
z-index: 9999; /_ above all game overlays _/
}

JS invariant — `_showTooltip()` in menu.js:

1. Force-measure height BEFORE adding `tt-visible` (opacity:0 → offsetHeight=0 trap):
   tooltip.style.visibility = 'hidden';
   tooltip.classList.add('tt-visible');
   const h = tooltip.offsetHeight || 224; // 224px = safe fallback
   tooltip.classList.remove('tt-visible');
   tooltip.style.visibility = '';
2. Use `getBoundingClientRect()` on the card — viewport-relative coords match `fixed`.
3. Prefer above card; fall back to below if topAbove < 8px from viewport edge.
4. Clamp left/right to [8, VW - w - 8].

❌ containerRect subtraction with position:absolute — containing block is unpredictable
❌ tooltip.offsetHeight before tt-visible — always returns 0 (opacity:0 not rendered)

---

## 20. UIManager Decomposition Pattern

After the March 2026 refactor, `setupCharacterHUD` delegates to private `_hud*` helpers.
Pattern to follow for any new HUD section:

```
setupCharacterHUD(player)              — public orchestrator; derives isPoom/isKao/isAuto/isPat
  _hudApplyThemeAndLabel(...)          — sets data-char attr + character name label
  _hudSetupAttackSlot(...)             — L-Click slot emoji
  _hudSetupPortraitAndWeapon(...)      — SVG portrait injection + weapon label
  _hudSetupPassiveSlot(...)            — passive badge (charId-specific)
  _hudSetupSkill1Slot(...)             — R-Click skill slot
  _hudSetupQSlot(...)                  — Q slot (creates DOM + arc canvas)
  _hudSetupExclusiveESlots(...)        — E slot (only one per char rendered)
  _hudSetupRitualAndMobileButtons(...) — Poom ritual slot + mobile skill btn emoji

updateSkillIcons(player)               — per-frame dispatcher
  _updateIconsPoom(player, setLock)    — Poom: eat/naga/ritual/garuda arc + eat-buff bar
  _updateIconsAuto(player, setLock)    — Auto: stealth/vacuum/det arcs, wanchai Q label
  _updateIconsPat(player,  setLock)    — Pat: zanzo/iaido/blade arcs
  _updateIconsKao(player,  setLock)    — Kao: stealth/teleport/clone arcs
```

`drawMinimap(ctx)` lives on **`CanvasHUD`**, not `UIManager`.
Called from `CanvasHUD.draw(ctx, dt)` every game frame.
Internal helpers: `_minimapDrawShell()`, `_minimapDrawContent()`, `_minimapDrawLabel()`

Decomposition rules:
✅ Each `_hud*` setup helper must be independently callable — no side effects on siblings
✅ Orchestrator (`setupCharacterHUD`) does no DOM work itself — only derives booleans and delegates
❌ Do NOT merge setup + update into one method — setup runs ONCE, update runs every frame
❌ Do NOT add char-specific logic to the orchestrator — it belongs in the matching `_hud*` helper

WaveManager follows the same orchestrator → pure helper pattern:
startNextWave() — public orchestrator
\_buildWavePayload(waveNum) — pure: returns { enemies[], bossWave, glitch }
\_spawnWaveEnemies(payload) — side effects: pushes to window.enemies
\_triggerWaveAnnouncement() — FX only

---

## 21. OffscreenCanvas Bitmap Caching — Static Body Parts

For geometry that never changes frame-to-frame, cache once to an `OffscreenCanvas`
and call `drawImage()` on every subsequent frame. Eliminates redundant path construction
and GPU state switches for the body layer.

**Cache lives on the Renderer class (static), never on the entity:**

```js
// At class level:
static _cache = {};   // PlayerRenderer._cache  /  BossRenderer._cache

// In the draw method:
const key = `${entity.charId}_${entity.radius}`;
if (!PlayerRenderer._cache[key]) {
    const size = entity.radius * 2 + 16;       // +16px margin for glow/outline
    const osc  = new OffscreenCanvas(size, size);
    const octx = osc.getContext('2d');
    octx.translate(size / 2, size / 2);        // centre matches live canvas convention
    // ... draw static body geometry to octx ...
    PlayerRenderer._cache[key] = osc.transferToImageBitmap();
}
const bm = PlayerRenderer._cache[key];
ctx.drawImage(bm, sx - bm.width / 2, sy - bm.height / 2);
```

**What belongs in the cache (drawn to OffscreenCanvas):**

- ✅ Static body silhouette (filled path, no animation)
- ✅ Fixed equipment geometry (collar, belt, static accessories)
- ✅ Boss body shape at a given phase (use phase-keyed entry: `boss_manop_p2`)

**What must NOT go in the cache:**

- ❌ Anything reading `performance.now()` or `entity._anim` — changes every frame
- ❌ Hit flash, glow overlays, oscillator-driven effects
- ❌ Anything driven by an external timer or game state

**Cache invalidation:**

- Boss phase change → delete the stale entry: `delete BossRenderer._cache[key]`
- Entity radius change (size-up attack) → same: delete and let it rebuild next frame
- ❌ Never clear the entire `_cache` object mid-session — forces full rebuild for all entities

**\_getCamScale() coupling:**
Cache bitmaps at world-unit size (1:1). Apply `ctx.scale(camScale, camScale)` in the
live draw path after `worldToScreen()`. This keeps the bitmap stable across zoom changes
rather than keying a separate bitmap per scale level.

**AutoRenderer cache pattern (Map-based, tier-keyed):**

AutoRenderer uses a Map cache (different from BossRenderer's single-key helper):

```js
// At class level:
static _bodyCache = new Map();  // AutoRenderer._bodyCache

static _getBodyBitmap(heatTier) {  // key 'body_t0'..'body_t3'
    const key = `body_t${heatTier}`;
    // build OffscreenCanvas once, then cache ImageBitmap
}

static _getHairBaseBitmap() {       // key 'hair_base'
    const key = 'hair_base';
    // build once
}
```

Cache invalidation is not needed (4 fixed heat tiers + static hair).
If `RT.override()` changes colors baked into these bitmaps → call:
`AutoRenderer._bodyCache.clear()`.

## 22. Batching & Optimization Strategies

1. **State Switch Minimization**:
   - Group entities with the same `shadowBlur` or `fillStyle` together to minimize `ctx` state overhead.
   - Dispatchers (`PlayerRenderer.draw`, `BossRenderer.draw`) ensure state is reset ONLY after all entities are processed.
2. **Resource Pools (Effects)**:
   - `ParticleSystem`, `FloatingTextSystem`, and `OrbitalParticleSystem` in `js/effects/` reuse objects from a pre-allocated pool to eliminate GC stutter.
3. **Spatial Partitioning**:
   - `SpatialGrid` (`js/weapons/SpatialGrid.js`) optimizes collision queries, reducing the number of `draw()` calls for off-screen entities when combined with viewport culling.
4. **Bitmap Caching**:
   - See §21 for using `OffscreenCanvas` to cache static geometry.

---

## 23. MapSystem Rendering Pipeline (map.js)

`MapSystem` has THREE separate draw calls per frame, invoked in sequence from `game.js`:

```
MapSystem.drawTerrain(ctx, camera)   ← BEFORE entities
MapSystem.draw()                     ← AFTER entities (objects in draw order)
MapSystem.drawLighting(ctx, ...)     ← LAST — composite shadow overlay
```

### drawTerrain() — 5-pass pipeline (order is fixed):

```
Pass 1: Arena boundary ring       — animated stroke arcs (haloAlphaBase + sin)
Pass 2: Tech-hex grid             — corners pre-computed (6× cos/sin outside loop), no string alloc
Pass 2b: Zone floors              — drawZoneFloors() colored floor tiles per zone
Pass 3: Circuit paths + packets   — throttled: _terrainFrame & 1 gate (every other frame only)
Pass 4: Zone auras                — zone-keyed radial gradients
```

### drawLighting() — composite shadow overlay:

```
1. Resize _lightCanvas to match main canvas if dimensions changed
2. lctx.fillStyle = rgba(night color) → fill entire canvas (establishes ambient darkness)
3. lctx.globalCompositeOperation = 'destination-out'  ← punches holes in the darkness
4. For each light source: radialGradient circle drawn at screen position
5. lctx.globalCompositeOperation = 'source-over'     ← restore for tint pass
6. CTX.drawImage(_lightCanvas, 0, 0)                 ← composite onto main canvas
```

⚠️ `_lightCanvas` is a persistent OffscreenCanvas on `MapSystem` — do NOT recreate every frame.
⚠️ Keep total light source count < 12 to avoid GPU fillRect overdraw cost.
⚠️ `punchLight(wx, wy, radius, type, intensity)` takes WORLD coordinates — it calls `worldToScreen()` internally.

### MapObject.draw() — type dispatcher:

`MapObject.draw()` is a switch on `this.type` that calls the matching standalone draw helper:

```
'desk'         → drawDesk(w, h)
'tree'         → drawTree(size)
'server'       → drawServer(w, h)
'datapillar'   → drawDataPillar(w, h)
'bookshelf'    → drawBookshelf(w, h)
'database'     → drawDatabase(w, h)
'coopstore'    → drawCoopStore(w, h)
'vendingmachine' → drawVendingMachine(w, h)
'mtcwall'      → drawMTCWall()
'chair'        → drawChair()
'cabinet'      → drawCabinet()
'blackboard'   → drawBlackboard()
'wall'         → drawWall()
```

Interactive subclasses (HackTerminal, MedStation, AmmoCrate, PowerNode) bypass this dispatcher
entirely — they override `draw()` directly and call `worldToScreen()` themselves.

⚠️ All standalone draw helpers assume `CTX` is pre-translated to the object's screen position
via `ctx.save() → ctx.translate(screen.x, screen.y)` in `MapObject.draw()`.
⚠️ Standalone helpers are pure draw functions — zero state mutation, zero `Math.random()`.

---

## 24. worldToScreen() — Global Coordinate Helper

`worldToScreen(wx, wy)` is a global function defined in `utils.js`.
Returns `{ x, y }` in canvas pixels. Used by ALL renderer files.

```js
// ✅ Every draw method starts with:
const screen = worldToScreen(entity.x, entity.y);

// ❌ Never read window.camera directly in draw code
// ❌ Never compute your own camera offset
```

Cross-file dependency: `worldToScreen` is a bare global (not on `window.*`) —
it is safe in strict mode only because `utils.js` loads first in index.html.

---

## 25. Section Index (quick reference)

| §   | Topic                                              |
| --- | -------------------------------------------------- |
| 0   | Frame lifecycle & rendering pipeline               |
| 1   | Three immutable laws of draw()                     |
| 2   | ctx.save / ctx.restore pairing                     |
| 3   | shadowBlur reset                                   |
| 4   | No Math.random() — deterministic oscillation       |
| 5   | World space vs screen space                        |
| 6   | Viewport culling                                   |
| 7   | Facing flip pattern                                |
| 8   | Hover animation pattern                            |
| 9   | Breathe animation pattern                          |
| 10  | Phase-aura pattern (Boss)                          |
| 11  | Layer naming convention                            |
| 12  | Animation state — read only in draw()              |
| 13  | Radial gradient standard setup                     |
| 14  | New boss draw method checklist                     |
| 15  | New player draw method checklist                   |
| 16  | charId-guarded effects in \_drawBase               |
| 17  | Muzzle flash pattern (weapon-local space)          |
| 18  | SVG portrait system                                |
| 19  | Skill tooltip positioning                          |
| 20  | UIManager decomposition pattern                    |
| 21  | OffscreenCanvas bitmap caching                     |
| 22  | Batching & optimization strategies                 |
| 23  | MapSystem rendering pipeline                       |
| 24  | worldToScreen() global helper                      |
| 25  | This index                                         |
| 26  | RenderTokens.js                                    |
| 27  | Font system — CSS properties + ctx.font convention |

---

## 26. RenderTokens.js — Visual Token System

Single source of truth for all ctx style values. Load before all renderer files.
Never hardcode hex colors or shadow values that have RT equivalents.

Usage:

```js
ctx.strokeStyle = RT.palette.danger; // '#ef4444'
ctx.shadowBlur = RT.glow.danger.blur; // 18
ctx.shadowColor = RT.glow.danger.color; // '#ef4444'
ctx.lineWidth = RT.stroke.medium; // 2.5
ctx.globalAlpha = RT.alpha.hitFlashFill; // 0.75
```

Skin override: `RT.override({ palette: { danger: '#ff0000' } })`
After override: invalidate any OffscreenCanvas caches that baked those colors.

---

## 27. Font System — CSS Custom Properties + ctx.font Convention

MTC uses a 4-family font system defined as CSS custom properties in `index.html`:

```css
:root {
  --font-display: "Orbitron", "Share Tech Mono", monospace; /* headers, zone IDs, score */
  --font-hud: "Rajdhani", sans-serif; /* HUD body, skill names, cooldown */
  --font-mono: "Share Tech Mono", monospace; /* canvas numbers, terminal text */
  --font-body: "Kanit", "Rajdhani", sans-serif; /* descriptions, Thai text */
}
```

### Canvas ctx.font rules (STRICT — applies to every draw method in map.js and renderers)

| Context                   | Font string                                         | Used for                                     |
| ------------------------- | --------------------------------------------------- | -------------------------------------------- |
| Zone labels, MTCRoom UI   | `"bold Npx 'Orbitron','Share Tech Mono',monospace"` | Zone IDs, citadel header, SAFE ZONE label    |
| Canvas numbers / timers   | `"bold Npx 'Share Tech Mono',monospace"`            | Damage numbers, cooldown timers, HP counts   |
| Small terminal text       | `"Npx 'Share Tech Mono',monospace"`                 | Subtitles, secondary labels on canvas        |
| Interactive object labels | `"700 Npx 'Rajdhani',sans-serif"`                   | HackTerminal, MedStation, AmmoCrate DOM text |

```js
// ✅ Canvas number — Share Tech Mono
CTX.font = "bold 9px 'Share Tech Mono',monospace";

// ✅ Zone label — Orbitron with monospace fallback
ctx.font = "bold 8px 'Orbitron','Share Tech Mono',monospace";

// ❌ Never use bare system fonts on canvas
CTX.font = "bold 9px Arial"; // no personality, inconsistent across OS
CTX.font = "bold 9px monospace"; // falls back to Courier New on Windows
```

### DOM HUD font rules (UIManager.js / injectCooldownStyles)

```css
/* Cooldown timer overlay — Rajdhani reads better than Orbitron at 11-13px */
.cd-timer-text {
  font: 700 13px "Rajdhani", sans-serif;
}

/* Skill name labels */
.skill-name {
  font-family: var(--font-hud);
}

/* Title-weight elements (wave announce, boss name) */
font-family: var(--font-display);
```

### Cross-file dependency

All four font families are imported in a **single Google Fonts request** in `index.html` `<head>`.
Adding a new canvas draw method that uses `Orbitron` or `Rajdhani` requires no additional import —
the fonts are globally available after page load. Do NOT add per-file `@import` or `<link>` tags.

⚠️ `ctx.font` strings with quotes MUST use single quotes inside the string literal:

```js
// ✅
CTX.font = "bold 8px 'Share Tech Mono',monospace";
// ❌ — breaks the JS string
CTX.font = 'bold 8px "Share Tech Mono",monospace';
```
