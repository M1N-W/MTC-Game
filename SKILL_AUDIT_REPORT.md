# MTC Game — Skill & Documentation Audit Report
Generated from codebase cross-reference, March 2026

---

## 1. mtc-game-conventions SKILL.md — Issues Found

### 1A. Stale File Name References (Factual Errors)

| Location | Stale Reference | Correct Reference | Impact |
|---|---|---|---|
| §8 L.324–331 (Muzzle Offsets) | `weapons.js` × 4 | `WeaponSystem.js` | Wrong file sent to AI |
| §13 L.416 (New Char Checklist) | `weapons.js` | `WeaponSystem.js` | Wrong file sent to AI |
| §19 L.729 (Perf Audit) | `weapons.js (SpatialGrid)` | `SpatialGrid.js` (separate file) | Wrong file |
| §20 L.739 (HUD Emoji) | `config.js` | `GameTexts.js` (GAME_TEXTS lives there) | Wrong file |
| Frontmatter trigger L.3 | `config.js BALANCE` | `BalanceConfig.js` | Trigger mismatch |

### 1B. Balance Values That Should Be Removed

| Section | Content to Remove | Why |
|---|---|---|
| §11 Heat Tier | "Four tiers: COLD→WARM→HOT→OVERHEAT (0–100%)" tier descriptions | These are BALANCE values |
| §11 Heat Tier | "Source of truth for all tier values: BALANCE.characters.auto" | Keep this architectural rule only |
| §12 BalanceConfig.js Structure | Entire BALANCE.characters[charId] field layout + energy cost code pattern with default `20` | All config values |
| §17 HitStop | Call site values `(0.04)`, `(0.09)`, `(0.07)` — these are balance durations | Balance values |
| §16 Animation State | Decay rates `×5/s`, `×3/s`, `×4/s`, `~0.2s`, `~0.33s`, `~0.25s` | Balance values |

### 1C. Missing Architectural Patterns

1. **Projectile angle fix** — `this.angle = Math.atan2(vy, vx)` for `team==='player'` is now an established pattern (added this session) — not documented
2. **`isReflected` flag contract** — partially in §23 but the renderer side (ProjectileRenderer dispatcher checks `isReflected` first, before team check) is not documented as a cross-file dependency
3. **GameTexts.js location of GAME_TEXTS** — §20 says `config.js` but `GAME_TEXTS` lives in `GameTexts.js`

---

## 2. mtc-rendering SKILL.md — Gaps Found

### 2A. Missing Cross-File Dependencies

| Pattern | Where It Lives | Impact |
|---|---|---|
| `p.isReflected` flag | Set in PatPlayer, read in ProjectileRenderer dispatcher | Hidden coupling — not documented |
| `window.meteorZones` draw loop | game.js drawGame() — uses lava-crater visual pattern | Not in rendering pipeline docs |
| `specialEffects[].draw(ctx)` call site | game.js drawGame() — called in render loop | Not in pipeline §0 |

### 2B. Missing Architectural Coverage

1. **ProjectileRenderer.js dispatch architecture** — team-based + kind-based + isReflected routing not documented
2. **specialEffects draw ordering** — drawn AFTER entities but BEFORE PlayerRenderer in game.js
3. **Projectile angle = Math.atan2(vy, vx)** — lock-to-velocity-vector pattern for player projectiles
4. **Burn zone / meteorZones visual pattern** — deterministic hash-seeded crack system

### 2C. §0 Frame Lifecycle — Incomplete Draw Order

Current §0 says:
> "Terrain → Scars → Entities → Player → Effects → HUD"

Actual verified order from game.js:
1. Background gradient fill
2. mapSystem.drawTerrain() — hex grid, arena, zone auras
3. meteorZones draw loop (world-space, before map objects)
4. mapSystem.draw() — MapObjects
5. Decals + Shell Casings
6. Low-HP navigation guide
7. Power-ups
8. specialEffects[].draw(ctx) — BEFORE entities
9. Enemies (EnemyBase.draw)
10. Boss (BossRenderer.draw)
11. Player (PlayerRenderer.draw)
12. Projectiles (ProjectileRenderer.drawAll)
13. HUD (CanvasHUD, UIManager)
14. glitchEffect (post-process overlay)

---

## 3. PROJECT_OVERVIEW.md — Issues Found

### 3A. Quick Reference Section Uses Stale File Names

| Task | Stale | Correct |
|---|---|---|
| "แก้ Weapon / Projectile System" | `weapons.js` | `WeaponSystem.js`, `ProjectileManager.js` |
| "เพิ่มศัตรูใหม่" | `effects.js` | `js/effects/CombatEffects.js` |
| "เพิ่มตัวละครใหม่" | `effects.js` | `js/effects/` (relevant module) |
| "เพิ่มสกิล" | `effects.js` | `js/effects/` (relevant module) |
| Multiple tasks | `config.js` | `BalanceConfig.js` |

### 3B. Architecture Descriptions That Are Accurate (No Change Needed)

- Class hierarchy (Entity → PlayerBase/EnemyBase/BossBase) ✅
- Inheritance chains (KaoPlayer/AutoPlayer/PoomPlayer/PatPlayer) ✅
- Load order §13 in SKILL ✅
- GameState migration status ✅
- specialEffects[] signature contract §24 ✅
- PatPlayer architectural invariants §23 ✅
