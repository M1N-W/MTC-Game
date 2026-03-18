# mtc-game-conventions SKILL.md — Patch Set
Apply each block as a str_replace in your IDE.
All changes are targeted — do NOT rewrite the whole file.

---

## PATCH 1 — Frontmatter description: fix `config.js BALANCE` → `BalanceConfig.js`

FIND:
```
game.js, config.js BALANCE, MTC Room,
```

REPLACE WITH:
```
game.js, BalanceConfig.js, MTC Room,
```

---

## PATCH 2 — §8 Muzzle Offsets: `weapons.js` → `WeaponSystem.js`

FIND:
```
Muzzle Offsets (shootSingle in weapons.js):
Each character+weapon combo has a distinct barrel offset (px).
Source of truth: shootSingle() in weapons.js — grep 'barrelOffset' or 'muzzleOffset'.
⚠️ KaoPlayer bypasses shootSingle() entirely → muzzle offset lives in KaoPlayer.fireWeapon().
Adding a new Kao weapon requires adding its offset there, not in weapons.js.
⚠️ PoomPlayer bypasses shootSingle() entirely → muzzle offset lives in PoomPlayer.shoot().
Offset is computed from drawPoomWeapon() geometry — see §10 for the formula.
Do NOT add Poom muzzle logic to weapons.js or shootSingle().
```

REPLACE WITH:
```
Muzzle Offsets (shootSingle in WeaponSystem.js):
Each character+weapon combo has a distinct barrel offset (px).
Source of truth: shootSingle() in js/weapons/WeaponSystem.js — grep 'barrelOffset' or 'muzzleOffset'.
⚠️ KaoPlayer bypasses shootSingle() entirely → muzzle offset lives in KaoPlayer.fireWeapon().
Adding a new Kao weapon requires adding its offset there, not in WeaponSystem.js.
⚠️ PoomPlayer bypasses shootSingle() entirely → muzzle offset lives in PoomPlayer.shoot().
Offset is computed from drawPoomWeapon() geometry — see §10 for the formula.
Do NOT add Poom muzzle logic to WeaponSystem.js or shootSingle().
```

---

## PATCH 3 — §13 New Char Checklist: `weapons.js` → `WeaponSystem.js`

FIND:
```
weapons.js — if character has unique weapon mechanics (e.g., projectile reflection)
```

REPLACE WITH:
```
js/weapons/WeaponSystem.js — if character has unique weapon mechanics (e.g., projectile reflection)
```

---

## PATCH 4 — §19 Performance Audit: `weapons.js (SpatialGrid)` → correct file

FIND:
```
enemy.js, js/effects/ (CombatEffects.js / ParticleSystem.js), map.js, weapons.js (SpatialGrid), ui.js (minimap)
```

REPLACE WITH:
```
enemy.js, js/effects/ (CombatEffects.js / ParticleSystem.js), map.js, js/weapons/SpatialGrid.js, ui.js (minimap)
```

---

## PATCH 5 — §20 HUD Emoji: `config.js` → `GameTexts.js`

FIND:
```
All skill-slot emoji live in GAME_TEXTS.hudEmoji (config.js).
```

REPLACE WITH:
```
All skill-slot emoji live in GAME_TEXTS.hudEmoji (js/config/GameTexts.js).
```

---

## PATCH 6 — §11 AutoPlayer Heat Tier: strip balance values, keep architecture only

FIND (entire section):
```
11. AutoPlayer Heat Tier System

Four tiers: COLD → WARM → HOT → OVERHEAT (0–100% heat meter).
Each tier applies damage multipliers, punch rate factors, and at OVERHEAT: crit bonus + HP drain.

Source of truth for all tier values: BALANCE.characters.auto in BalanceConfig.js.
Always verify ?? fallback values in AutoPlayer.js match BalanceConfig.js exactly.
Key config fields live under BALANCE.characters.auto — do NOT hardcode multipliers inline.

Stand Meter drain multipliers have direction-specific hazards (COLD = penalty, OVERHEAT = faster burn).
Wrong ?? fallbacks caused pre-v3.30.10 bugs — always verify against BalanceConfig.js before editing.

Wanchai (R-Click) active: Q becomes Stand Pull instead of Vacuum Pull.
HUD arc max for Q must be dynamic (read from config key, not hard-coded) because
standPullCooldown ≠ vacuumCooldown.
```

REPLACE WITH:
```
11. AutoPlayer Heat Tier System — Architectural Invariants

AutoPlayer tracks a heat meter with four discrete tiers (defined in BalanceConfig.js).
Tier transitions drive visual state changes (body cache key), audio cues, and mechanic unlocks.

Architecture rules:
- All tier thresholds and multipliers live in BALANCE.characters.auto — NEVER hardcode them inline.
- Always use ?? fallback values in AutoPlayer.js; mismatched fallbacks cause silent balance bugs.
- Heat tier change → invalidate AutoRenderer._bodyCache (bitmap is tier-keyed).
- _bodyCache keys are 'body_t0'..'body_t3' — one per tier, never more.

Wanchai (R-Click) active: Q becomes Stand Pull instead of Vacuum Pull.
HUD arc max for Q must be dynamic (read from config key, not hard-coded) because
standPullCooldown ≠ vacuumCooldown — these are separate config keys.
```

---

## PATCH 7 — §12 BalanceConfig.js Structure: remove concrete field layout, keep architectural rule

FIND (entire section):
```
12. BalanceConfig.js Structure (js/config/BalanceConfig.js)

BALANCE.characters[charId] = {
hp, maxHp, energy, maxEnergy, moveSpeed, dashSpeed,
xyzEnergyCost: N, // every active skill needs this
weapons: { weaponName: { damage, cooldown, range, speed } }
}

Energy cost pattern — use in every skill activation:
const cost = S.xyzEnergyCost ?? DEFAULT;
if ((this.energy ?? 0) < cost) {
spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
} else {
this.energy = Math.max(0, (this.energy ?? 0) - cost);
this.doSkill();
}
```

REPLACE WITH:
```
12. BalanceConfig.js — Architectural Rules (js/config/BalanceConfig.js)

Three config files in js/config/:
- BalanceConfig.js → window.BALANCE  (character stats, weapon data, enemy data, boss data, map)
- SystemConfig.js  → window.GAME_CONFIG  (engine settings, audio volumes, map visual constants)
- GameTexts.js     → window.GAME_TEXTS  (all UI strings, skill names, emoji, tutorial copy)

Architectural invariants:
- All numeric game values (HP, damage, cooldown, cost, speed) live in BalanceConfig.js ONLY.
- Character stat block: BALANCE.characters[charId] — read in constructor, never re-read in update().
- Weapon data: BALANCE.characters[charId].weapons[weaponKey] — WeaponSystem reads these at fire time.
- Boss data: BALANCE.boss[bossName] — boss constructor reads once, applies ?? fallback on every key.
- Every active skill activation MUST: (1) read cost from BALANCE, (2) guard on energy, (3) deduct energy.
- ❌ Never hardcode numeric literals where a BALANCE key exists — the config is silently ignored.
- ❌ Never read BALANCE inside draw() — stat access belongs in update() or constructor only.
```

---

## PATCH 8 — §16 Animation State Machine: strip decay rate values

FIND:
```
state: 'idle'|'walk'|'run'|'shoot'|'dash'|'hurt' — priority: dash>shoot>hurt>run>walk>idle
shootT: 0→1 decay ×5/s (~0.2s) — arm raise after firing
hurtT: 0→1 decay ×3/s (~0.33s) — flinch after hit
dashT: 0→1 decay ×4/s (~0.25s) — lean/stretch after dash
skillT: free-running per-character timer, decay ×1/s — see trigger table below
smoothMoveT: lerp of moveT, 8Hz convergence — prevents snap on start/stop
smoothAngle: shortest-arc lerp of entity.angle, same rate — null until first tick
```

REPLACE WITH:
```
state: 'idle'|'walk'|'run'|'shoot'|'dash'|'hurt' — priority: dash>shoot>hurt>run>walk>idle
shootT: 0→1 decay — arm raise after firing (rate in BalanceConfig.js)
hurtT: 0→1 decay — flinch after hit (rate in BalanceConfig.js)
dashT: 0→1 decay — lean/stretch after dash (rate in BalanceConfig.js)
skillT: free-running per-character timer — see trigger table below
smoothMoveT: lerp of moveT — prevents snap on start/stop
smoothAngle: shortest-arc lerp of entity.angle — null until first tick
```

---

## PATCH 9 — §17 HitStop: strip per-skill duration values

FIND:
```
Call sites (Phase 3.1 complete):
AutoPlayer — Wanchai Punch (R) crit: triggerHitStop(0.04)
AutoPlayer — Stand Rush (L-click) crit: triggerHitStop(0.04)
PatPlayer — Iaido Strike (R): triggerHitStop(isCrit ? 0.09 : 0.07)
```

REPLACE WITH:
```
Call sites (Phase 3.1 complete):
AutoPlayer — Wanchai Punch (R) crit
AutoPlayer — Stand Rush (L-click) crit
PatPlayer — Iaido Strike (R): crit path uses longer freeze than non-crit
(Exact durations live in BalanceConfig.js — do not hardcode)
```

---

## PATCH 10 — Add new §26 after §25 (GameState)

APPEND after the final line of §25 (`❌ Do NOT write GameState.isGlitchWave from WaveManager — the sync direction is one-way`):

```

---

26. Projectile Architecture — Cross-File Dependencies

Projectile.js (js/weapons/Projectile.js):
- Core data: x, y, vx, vy, angle, team, kind, weaponKind, isCrit, isReflected, symbol, bounces
- Angle update rule (established v3.40.x):
  ✅ team === 'player': this.angle = Math.atan2(this.vy, this.vx);  // locks to velocity direction
  ✅ team === 'enemy':  this.angle += dt * spinRate;                  // spinning glyph effect
  ❌ this.angle += dt * constant; // for ALL teams — player bullets visually skew over distance

ProjectileRenderer.js dispatch (js/rendering/ProjectileRenderer.js):
Priority order inside static draw(p, ctx):
1. p.isReflected — Pat Blade Guard reflect (team is already 'player', but renders enemy glyph + gold overlay)
2. p.kind === 'heatwave' — Auto heat wave projectile
3. p.kind === 'punch' — Wanchai fist projectile
4. p.kind === 'katana' — Pat slash wave (perpendicular-to-travel blade)
5. p.isPoom — Poom rice cluster
6. p.team === 'player' → _drawPlayerProjectile (branches on p.weaponKind: 'auto'|'sniper'|'shotgun'|else rifle)
7. else → _drawEnemyProjectile (spinning hex + math glyph)

isReflected flag contract (PatPlayer → ProjectileRenderer cross-file dependency):
✅ Set in tryReflectProjectile(): proj.isReflected = true; proj.team = 'player'; proj.owner = 'player';
✅ Read FIRST in ProjectileRenderer.draw() dispatcher — before team check
❌ If isReflected check is removed or moved after team check, reflected bullets lose enemy visual

WeaponSystem.js (js/weapons/WeaponSystem.js):
- p.weaponKind is set to currentWeapon string: 'auto' | 'sniper' | 'shotgun' | 'rifle'
- This is the authoritative source for weapon-keyed visual branching in ProjectileRenderer
- Poom bypasses WeaponSystem entirely — PoomPlayer.shoot() creates Projectile directly
```

---

## SUMMARY OF ALL PATCHES

| Patch | Section | Type |
|---|---|---|
| 1 | Frontmatter | Fix stale `config.js BALANCE` |
| 2 | §8 Muzzle | Fix `weapons.js` × 4 → `WeaponSystem.js` |
| 3 | §13 Checklist | Fix `weapons.js` → `WeaponSystem.js` |
| 4 | §19 Perf | Fix `weapons.js (SpatialGrid)` → `SpatialGrid.js` |
| 5 | §20 Emoji | Fix `config.js` → `GameTexts.js` |
| 6 | §11 Heat Tier | Strip balance values, keep architecture |
| 7 | §12 BalanceConfig | Replace field layout with architectural rules |
| 8 | §16 Anim State | Strip decay rate numbers |
| 9 | §17 HitStop | Strip per-skill duration values |
| 10 | §26 (NEW) | Add Projectile architecture cross-file deps |
