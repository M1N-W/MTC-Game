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
  transform leak, draw order, layer system, screen-space vs world-space.
---

# MTC Rendering — Pure Draw Patterns

These patterns never change regardless of game balance or new features.
When in doubt about any draw code in this project, apply these rules.

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
if (entity.dead) return;   // BUG — save without matching restore

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

```js
// ❌ Never
for (let i = 0; i < 6; i++) {
    ctx.arc(Math.random() * R, 0, 3, 0, Math.PI * 2);   // flickers every frame
}

// ✅ Deterministic seed pattern — animated, stable, no RNG
const t = performance.now() / 1000;
for (let i = 0; i < 6; i++) {
    const seed = i * 137.5;                                        // golden angle spread
    const baseA = (seed % 360) * Math.PI / 180;
    const rise  = (t * 0.3 + seed * 0.01) % 1.0;                  // 0→1 loop
    const px    = Math.cos(baseA + t * 0.5) * R * 1.4;
    const py    = -rise * R * 1.8;
    const alpha = Math.sin(rise * Math.PI);                        // fade in, fade out
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
}
ctx.globalAlpha = 1;
```

---

## 5. World Space vs Screen Space

Entity positions are world coords. Canvas draws in screen coords. Convert once at the top of the draw method.

```js
const screen = worldToScreen(entity.x, entity.y);

// ── World-space elements: translate to screen, draw in local coords ──
ctx.save();
ctx.translate(screen.x, screen.y);
ctx.arc(0, 0, R, 0, Math.PI * 2);   // (0,0) = entity centre in local space
ctx.restore();

// ── Screen-space elements: use screen.x/y directly, no translate ──
// HP bars, labels — drawn relative to screen pos, not inside any save block
ctx.fillText('HP', screen.x, screen.y - R - 20);

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
ctx.rotate(-entity.angle);   // cancels parent rotation
ctx.fillText(label, 0, 0);
ctx.restore();
```

---

## 8. Hover Animation Pattern

For floating/flying entities. Shadow ellipse compensates for the hover offset.

```js
const now = performance.now();
const hoverY = Math.sin(now / 150) * 4;     // vertical bob
const hoverX = Math.sin(now / 230) * 1.2;   // subtle lateral drift

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
const breathe = Math.sin(now / 250);              // ~1.6s cycle
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
const isP1 = (e.phase === 1) || (!e.phase && hpRatio > 0.60);
const isP2 = (e.phase === 2) || (!e.phase && hpRatio > 0.30 && hpRatio <= 0.60);
const isP3 = (e.phase === 3) || (!e.phase && hpRatio <= 0.30);

if (isP1)      { /* calm aura — cyan/green  */ }
else if (isP2) { /* stressed aura — orange/red */ }
else           { /* critical aura — purple/white */ }
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
const sT     = entity._anim?.skillT ?? 0;
const hurtT  = entity._anim?.hurtT  ?? 0;
const shootT = entity._anim?.shootT ?? 0;

// ❌ Never write in draw — this is a hidden state mutation
entity._anim.shootT = 1;
```

---

## 13. Radial Gradient — Standard Setup

```js
// Inner offset (-R*0.25, -R*0.30) creates a "light source from top-left" feel
const grad = ctx.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
grad.addColorStop(0,    '#374151');   // bright centre
grad.addColorStop(0.55, '#1f2937');
grad.addColorStop(1,    '#111827');   // dark edge
ctx.fillStyle = grad;
ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
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

1. Add `instanceof NewPlayer` check in `PlayerRenderer.draw()` dispatcher
2. Call `PlayerRenderer._drawGroundShadow()` and `PlayerRenderer._drawGroundFeet()` before LAYER 1
3. Read `entity._anim` only — never write
4. Extra effects (aura, ring, indicator): outside the body save/restore block
5. Verify stand aura helper name in PlayerRenderer.js before adding — no assumed helper names

---

## 16. charId-Guarded Effects in _drawBase

`_drawBase()` is shared by Kao, Pat, and the generic player fallback.
Character-specific effects that belong inside the body save block must be gated by `entity.charId`:

```js
// Inside _drawBase() body save block, after _drawHitFlash():
if (entity.charId === 'kao') {
    const kaoDashT = entity._anim?.dashT ?? 0;
    // ... Kao-only dash glow
}
if (entity.charId === 'pat') {
    const patHurtT = entity._anim?.hurtT ?? 0;
    // ... Pat-only parry flash
}
```

Rules:
- ❌ Do NOT add a separate `_drawKaoExtra()` dispatch — _drawBase is already the Kao body path
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

| charId | Signature element     | Notes                                              |
|--------|-----------------------|----------------------------------------------------|
| `kao`  | Scope ring (r=9.5)    | Glowing cyan ring over right eye                   |
| `poom` | Naga snake            | Large serpent coiled behind body                   |
| `auto` | Fire crown            | Flame burst above head                             |
| `pat`  | Iaido flash sweep     | Diagonal ice-blue blur lines corner-to-corner      |

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
    const muzzleLocalX = 43;  // weapon.translate(12) + muzzle_x(31) from weapon function
    const muzzleLocalY = 6;   // weapon.translate(6) + muzzle_y(0)
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
      z-index: 9999;    /* above all game overlays */
  }

JS invariant — `_showTooltip()` in menu.js:
  1. Force-measure height BEFORE adding `tt-visible` (opacity:0 → offsetHeight=0 trap):
       tooltip.style.visibility = 'hidden';
       tooltip.classList.add('tt-visible');
       const h = tooltip.offsetHeight || 224;   // 224px = safe fallback
       tooltip.classList.remove('tt-visible');
       tooltip.style.visibility = '';
  2. Use `getBoundingClientRect()` on the card — viewport-relative coords match `fixed`.
  3. Prefer above card; fall back to below if topAbove < 8px from viewport edge.
  4. Clamp left/right to [8, VW - w - 8].

  ❌  containerRect subtraction with position:absolute — containing block is unpredictable
  ❌  tooltip.offsetHeight before tt-visible — always returns 0 (opacity:0 not rendered)

---

## 20. UIManager Decomposition Pattern

After the March 2026 refactor, large UIManager methods are split into private helpers.
Pattern to follow for any new HUD section:

  setupCharacterHUD(player)     — public orchestrator, calls private helpers
  _applyHUDTheme(player)       — sets data-char attr + character name label
  _setupSkillIconsXxx(player)  — creates skill icon DOM + registers listeners (per char)
  _updateIconsXxx()            — reads player state, toggles CSS classes, updates CD arcs (per char)
  drawMinimap()                — canvas-only, called from the game loop

Decomposition rule:
  ✅ Each private helper must be independently callable without side effects on siblings
  ✅ Orchestrator does no DOM work itself — only delegates and guards
  ❌ Do NOT merge icon setup + icon update into one method — setup runs once, update runs every frame

WaveManager follows the same pattern:
  startNextWave()               — public orchestrator
  _buildWavePayload(waveNum)   — pure: returns { enemies[], bossWave, glitch }
  _spawnWaveEnemies(payload)   — side effects: pushes to window.enemies
  _triggerWaveAnnouncement()   — FX only