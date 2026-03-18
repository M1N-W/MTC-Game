# mtc-rendering SKILL.md — Additions
Append these sections to the end of the existing SKILL.md.
Also apply the §0 pipeline correction described below.

---

## CORRECTION TO §0 — Frame Lifecycle: Complete Draw Order

Replace the current §0 draw order description with the verified sequence from game.js:

```
Frame render pipeline (drawGame() in game.js) — verified order:

1.  Background gradient fill (no clearRect — gradient covers full canvas)
2.  CTX.save() + screen shake translate
3.  mapSystem.drawTerrain(CTX, camera)      — hex grid, arena ring, zone auras, circuit paths
4.  meteorZones draw loop                   — lava crater visuals (BEFORE map objects)
5.  mapSystem.draw()                         — MapObjects (desks, trees, servers, etc.)
6.  drawDatabaseServer() / drawShopObject() — proximity aura helpers
7.  decalSystem.draw()                       — floor decals (blood, scorch)
8.  shellCasingSystem.draw()                 — ejected shell casings
9.  Low-HP navigation guide line             — floor-level routing cue
10. Power-ups
11. specialEffects[].draw(ctx)              — MeteorStrike, DomainExpansion, DeadlyGraph, etc.
12. window.enemies — EnemyBase.draw() per enemy
13. window.boss — BossRenderer.draw()
14. PlayerRenderer.draw() — player character
15. ProjectileRenderer.drawAll() — all projectiles
16. CTX.restore() — end shake block
17. CanvasHUD.draw() — minimap, combo bar, ammo
18. UIManager DOM updates (skill arcs, HP bars)
19. drawGlitchEffect() — post-process chromatic aberration overlay (last)
```

Key ordering constraints that must not change:
- meteorZones (step 4) BEFORE mapSystem.draw() (step 5) — craters appear under objects
- specialEffects (step 11) BEFORE entities (steps 12–14) — effects appear under characters
- glitchEffect (step 19) LAST — overlays everything including HUD

---

## §28. ProjectileRenderer.js — Dispatch Architecture

`ProjectileRenderer` is a static-only class. Never instantiate it.
All draw logic is contained in `js/rendering/ProjectileRenderer.js`.
Load order: after `Projectile.js` and `map.js` (needs `worldToScreen`).

### Dispatch priority (static draw(p, ctx)):

```
1. p.isReflected           → _drawReflectedProjectile()   Pat Blade Guard — FIRST, before team check
2. p.kind === 'heatwave'   → _drawHeatWave()              Auto stand heat wave
3. p.kind === 'punch'      → _drawWanchaiPunch()          Wanchai fist model
4. p.kind === 'katana'     → _drawKatanaWave()            Pat slash wave
5. p.isPoom                → _drawPoomProjectile()        Poom rice cluster
6. p.team === 'player'     → _drawPlayerProjectile()      Kao weapons (branches on weaponKind)
7. else                    → _drawEnemyProjectile()       Enemy math glyphs
```

### isReflected check MUST be first

`tryReflectProjectile()` in PatPlayer sets `proj.team = 'player'` simultaneously with
`proj.isReflected = true`. If the `isReflected` guard were checked after the `team` guard,
the reflected projectile would silently route to `_drawPlayerProjectile` and lose its
enemy glyph identity. **Do not reorder.**

### _drawPlayerProjectile weapon branches:

```
wk = p.weaponKind || (p.color === '#3b82f6' ? 'auto' : 'rifle')

isGolden || isCharged → golden buff path (takes precedence over weapon kind)
wk === 'auto'         → compact electric bolt (blue #3b82f6)
wk === 'sniper'       → hyper-velocity tracer (rose #f43f5e), longest trail
wk === 'shotgun'      → fat slug (orange #fb923c), ellipse body wider than tall
else (rifle)          → armor-piercing needle (indigo #6366f1)
```

WeaponSystem.js sets `p.weaponKind = this.currentWeapon` after creating each Projectile.
Authoritative string values: `'auto'` | `'sniper'` | `'shotgun'` | `'rifle'`.

### Projectile angle = velocity direction (established v3.40.x)

```js
// In Projectile.update(dt):
if (this.team === 'player') {
    this.angle = Math.atan2(this.vy, this.vx);  // locks to actual travel direction
} else {
    this.angle += dt * spinRate;                  // enemy glyphs spin visually
}
```

This ensures player bullets face their travel direction at every frame, including
after ricochet bounces. `spinRate` is a BALANCE value — do not hardcode.

---

## §29. specialEffects[] — Draw Architecture

`window.specialEffects` is a plain JS array. Each element must implement:
- `update(dt, player, meteorZones, boss)` — fixed positional signature (see §24 of mtc-game-conventions)
- `draw(ctx)` — called in the render pipeline BEFORE entities (step 11 in pipeline)

### Draw call site in game.js:

```js
// Called BEFORE enemies/boss/player in drawGame():
for (const fx of window.specialEffects) {
    if (fx.draw) fx.draw(CTX);
}
```

### Rendering rules for specialEffect.draw():

- Must follow all three immutable draw laws (§1 of mtc-rendering)
- `ctx.save() / ctx.restore()` required around every transform block
- `ctx.shadowBlur = 0` required after every glow pass
- ❌ No `Math.random()` — use deterministic time-based oscillators
- ❌ No state mutation (do not write to `window.meteorZones` or player properties inside draw)
- `worldToScreen(this.x, this.y)` for all world-space to screen-space conversion

### MeteorStrike draw phases:

```
phase === 'warning':
  1. Warning zone: radial gradient fill + pulsing dashed ring
  2. Travel trail: 3 gradient stroke passes (width 16/10/7px), direction-aligned
  3. Smoke wisps: 6 deterministic particles (golden-angle seed + rise loop)
  4. Rock body: 8-vertex polygon, ctx.save()/rotate(spin)/ctx.restore()

phase === 'impact':  draw() is no-op (effect returned true from update, pending removal)
```

---

## §30. meteorZones[] — Burn Zone Rendering

`window.meteorZones` is populated by `MeteorStrike.update()` at impact time.
Drawn in game.js drawGame() BEFORE mapSystem.draw() (step 4 in pipeline).

### Render layers per zone:

```
1. Viewport cull — early continue if outside CANVAS bounds + 40px margin
2. Scorch floor   — dark radial gradient (world-space, fades at edge)
3. Lava core      — pulsing orange radial, unique phase per zone: Math.sin(t * K + z.x * offset)
4. Crack lines    — hash-seeded: (sx * 73856093) ^ (sy * 19349663) → 5–7 cracks with forks
5. Danger ring    — animated stroke, fadeAlpha driven by z.life
```

### Hash-seeded crack invariant:

```js
const sx = Math.round(z.x); const sy = Math.round(z.y);
const hash = (sx * 73856093) ^ (sy * 19349663);
```

Each zone's crack layout is uniquely determined by its world position.
**Never use Math.random() for crack generation** — positions are stable across frames.

### fadeAlpha pattern:

```js
const fadeAlpha = z.life < 0.8 ? z.life / 0.8 : 1.0;
```

Duration-agnostic (works with any `meteorBurnDuration` BALANCE value).
Apply `fadeAlpha` as outer multiplier to every `globalAlpha` set in the zone loop.

---

## §31. World-Space vs Screen-Space Quick Reference

| Element | Coordinate System | How to Convert |
|---|---|---|
| Entity positions (x, y) | World | `worldToScreen(x, y)` |
| Projectile positions | World | `worldToScreen(p.x, p.y)` |
| meteorZones (x, y) | World | `worldToScreen(z.x, z.y)` |
| specialEffect positions | World | `worldToScreen(this.x, this.y)` |
| HP bars, damage numbers | Screen | Use screen.x/y from worldToScreen directly |
| HUD (minimap, arcs) | Screen | CanvasHUD operates in screen coords only |
| Particle spawn positions | World | Particles store world coords, draw via worldToScreen |
| MeteorStrike trail | World → Screen | Convert impact point, compute travel offset in screen px |

### Screen-space elements MUST NOT be inside a world-transform save block:

```js
// ✅ Correct
ctx.save(); ctx.translate(screen.x, screen.y);
// ... draw world-space body geometry
ctx.restore();
ctx.fillText("97", screen.x, screen.y - 30); // ← screen-space text OUTSIDE restore

// ❌ Wrong — text rotates/scales with entity transform
ctx.save(); ctx.translate(screen.x, screen.y); ctx.rotate(angle);
ctx.fillText("97", 0, -30); // rotates with the entity!
ctx.restore();
```
