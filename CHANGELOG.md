# 🎮 MTC Game — Changelog

---

## v3.11.2 — Boss Architecture Refactor & Heat System Removal
*Released: March 7, 2026*

### 🏛️ Boss System Refactoring
- **BossBase class creation** — Extracted shared boss lifecycle into `BossBase extends Entity` with common methods:
  - `speak()` — Gemini AI speech handling
  - `_updateHUD()` — Centralized HUD updates
  - `_onDeath()` — Standardized death cleanup, particle effects, score, powerups, wave progression
- **Class renaming for clarity:**
  - `Boss` → `KruManop` ("Kru Manop the Dog Summoner")
  - `BossFirst` → `KruFirst` ("Kru First the Physics Master")
- **Backward compatibility maintained** — Window aliases: `window.Boss = KruManop`, `window.BossFirst = KruFirst`
- **Module exports updated** — Both new canonical names and legacy aliases included

### 🧹 Ignite System Removal
- **Complete ignite removal** from all boss entities (BossDog, KruManop, KruFirst)
  - Removed `igniteTimer`, `igniteDPS` tracking
  - Removed ignite overlay rendering from BossRenderer
  - Removed ignite-related damage calculations and reductions
- **BossRenderer cleanup** — Removed ignite overlay drawing code from all boss draw methods
- **Documentation updates** — boss_attacks.js comments updated to reflect new class names

### 🔥 AutoPlayer Heat System Removal
- **Heat gauge completely removed** — No more heat tiers, heat scaling, or overheat mechanics:
  - Removed `heat`, `heatTier` properties
  - Removed `_addHeat()`, `_updateHeatTier()`, `_getHeatDmgMult()`, `_getEffectivePunchRate()` methods
  - Removed Heat bar UI elements and tier color displays
- **Melee mode toggle removed** — Simplified to Stand Rush only during Wanchai (no F-key toggle)
- **Vacuum Heat simplified** — No longer applies ignite debuff to enemies
- **Damage calculations simplified** — Removed Heat tier multipliers from all damage formulas

### 🔧 Configuration & Bug Fixes
- **BALANCE path fixes** — Updated to use correct `BALANCE.characters.auto` paths
- **Cooldown corrections** — Fixed to match config values:
  - Vacuum: 8s (was 6s)
  - Detonation: 5s (was 8s)
  - Wanchai duration: 3s (was using stale config)
- **Stat adjustments:**
  - Energy cost: 32 (was 35)
  - Damage reduction: 30% (was 50%)
  - Lifesteal: 1% (was 2%)
  - Crit chance: 0.25 bonus (was 0.40)
  - Crit multiplier: 2.0x (was 2.2x)
- **UI fixes** — Added missing Q/E cooldown visual displays
- **Stand Rush miss improvement** — Added fist overlay animation even when missing

### 📊 Code Statistics
- **534 lines removed**, 304 lines added — Net reduction of 230 lines
- **Simplified architecture** — Reduced complexity while maintaining all gameplay functionality
- **Improved maintainability** — Cleaner inheritance hierarchy and removed complex Heat mechanics

### 🔧 Files Changed
- `boss.js` — BossBase extraction, class renaming, ignite removal
- `boss_attacks.js` — Documentation updates for new class names
- `AutoPlayer.js` — Heat system removal, config fixes, UI improvements
- `sw.js` — Updated to v3.11.2

---

## v3.11.0 — Wanchai Stand Humanoid Redesign & Manual Stand Rush
*Released: March 5, 2026*

### 🎨 Visual Overhaul: WanchaiStand Entity (AutoPlayer)
- **Complete draw() rewrite** — Stand is now a proper humanoid phantom fighter (6 layers) instead of floating orb with chains
- **Layer 0 — Ghost trail:** Silhouette shapes (head oval + torso) replace generic fire blobs
- **Layer 1 — Heat halo:** Radial oval with punch-reactive burst ring
- **Layer 2 — Waist fade:** Torso dissolves into heat shimmer downward — no legs (Stand identity)
- **Layer 3 — Torso:** Humanoid shape, armor plates, hex power core, heat vents — DNA matches Auto player body
- **Layer 4 — Arms & Fists:** Two independent arms (`drawArm(±1, isActive)`), punch side extends with impact burst + radial sparks on active fist
- **Layer 5 — Head:** Buzzcut 3 forward-swept spikes (Auto's signature), squint fire-orange iris, narrow vertical pupils, scar under left eye, furrowed brow tension crease, tight-set mouth, jaw tension lines
- **Layer 6 — Name chip:** Pill-shaped HUD label replaces faded flat text
- All oscillators (`breath`, `eyeFlick`, `sway`) precomputed once per frame — no state mutation in draw

### 🔧 Ghost Figure Cleanup (PlayerRenderer.js)
- Removed old inline ghost silhouette block from `_drawAuto()` — corona ring, scanlines, horns/eyes, arm stubs were a leftover placeholder rendering on top of `WanchaiStand.draw()`
- Retained: Detonation AOE ring, Stand Rush fist trail overlay, ORA text (`วันชัย วันชัย!`)
- `WanchaiStand.draw()` is now sole renderer for the Stand entity

### 🎮 Gameplay: Stand Rush Manual Targeting (AutoPlayer)
- **L-Click anywhere while Wanchai active** → Stand teleports to cursor position immediately, regardless of enemy proximity
- `_manualPosTimer = 0.30s` grace period prevents leash from snapping Stand back after manual teleport
- Hit range extended: `playerRushRange + 60px` tolerance for cluster hits
- Miss whiff VFX: orange/gold sparks + mini rush-fist overlay at cursor — Stand remains at target position
- Miss no longer silently returns; Stand repositions for next enemy to walk into

### 🔧 Files Changed
- `AutoPlayer.js` — `WanchaiStand.draw()` full rewrite, `_doPlayerMelee()` manual rush logic, `WanchaiStand.update()` leash grace period
- `PlayerRenderer.js` — Ghost figure block removed from `_drawAuto()`
*Released: February 27, 2026*

### ✨ Feature Rework: DeadlyGraph (Boss Kru Manop)
- **Dynamic beam length** — Ray vs arena-circle intersection replaces hardcoded `graphLength`; beam now stops exactly at arena boundary regardless of angle
- **Phase-distinct visuals:**
  - Phase 1 (Scanning): Cyan/blue core beam, grid tick marks, gentle sine wave decoration, label `y = x`
  - Phase 2 (Standby): Faint dashed gray — unchanged feel
  - Phase 3 (Active): Red/orange Overclock beam, thicker core (10px), faster + wider sine wave, label `f(x) !!!`, `⚡ RISK/REWARD ZONE ⚡` text
- **Universal Risk/Reward buff** — `graphBuffTimer` replaces Kao-only `onGraph` check; all characters gain ×1.5 damage while standing on Phase 3 beam, but take ×1.5–2× incoming damage
- **Destruction FX** — `damageArea` now fires `addScreenShake` (5 for objects, 8 for MTC Room) and color-matched particles (gray for walls, green for trees, orange scorch from laser)

### 🔧 Files Changed
- `effects.js` — DeadlyGraph full rewrite
- `map.js` — damageArea FX upgrade
- `KaoPlayer.js` — `takeDamage` override + `fireWeapon` graphBuff multiplier
- `AutoPlayer.js` — `takeDamage` onGraph penalty + `dealDamage` graphBuff multiplier
- `PoomPlayer.js` — `dealDamage` graphBuff multiplier added (takeDamage penalty already existed)

---

## v3.6.1 — Cooldown UI Hybrid System & Invisible Pets Fix
*Released: February 27, 2026*

### 🎨 UI Overhaul: Hybrid Cooldown Display
- Replaced all vertical mask (`.cooldown-mask`) with circular arc (`conic-gradient`) as single universal standard
- Skills ≤5s: Arc only (no timer text) to reduce visual noise
- Skills >5s: Arc + countdown timer for strategic planning
- Teleport (Kao): Shows arc only when charges > 0, full arc + timer when charges = 0
- Fixed `skill1-hint` for AutoPlayer showing `STAND` → now correctly shows `R-Click`
- Fixed `nagaTimer` and `ritualTimer` rendering duplicate numbers on top of arc overlay

### 🐛 Bug Fixes
- **[Visual] Invisible Pets** — BossDog and GoldfishMinion now render correctly
  - BossDog: render loop now routes `instanceof BossDog` → `BossRenderer` instead of `EnemyRenderer`
  - GoldfishMinion: added `else if (typeof e.draw === 'function') e.draw()` fallback in `EnemyRenderer`, CTX swap handles correct canvas automatically
- **[Crash] Poom vs Boss/Barrel** — Added guard clause `if (!enemy || typeof enemy.addStatus !== 'function') return` in `applyStickyTo()` preventing crash when projectile hits Boss or ExplosiveBarrel
- **[Fix] AutoPlayer wanchai cooldown arc** — Fixed `player.isWanchaiActive` (undefined) → `player.wanchaiActive`, and `cooldowns.stealth` → `cooldowns.wanchai`

### 🔧 Files Changed
- `ui.js`, `PoomPlayer.js`, `AutoPlayer.js` — Hybrid arc system
- `enemy.js` — EnemyRenderer fallback draw
- `game.js` — BossDog render routing
- `boss.js` — GoldfishMinion class (was missing entirely), BossRenderer dispatch

---

## v3.4.1 — StatusEffect Framework Migration
*Released: February 26, 2026*

### 🎯 Major Features
- **StatusEffect Framework** — Complete architecture overhaul for enemy status management
- **Sticky Rice System** — Migrated from legacy Map-based system to modern StatusEffect framework
- **Ritual Burst** — Now consumes status effects directly from enemies

### 🔧 Technical
- **−178 lines** removed (legacy sticky system), **+45 lines** added (framework) → net −133 lines
- Enemy classes now own their status effects
- Player uses adapter pattern for backward compatibility
- Framework ready for burn, poison, freeze effects

### 🐛 Bug Fixes
- Fixed projectile `onHit` callback not applying sticky status
- Resolved ritual burst not finding stacked enemies
- Eliminated legacy code memory leaks
- Removed debug console logs

---

## v3.4.0 — Critical Bug Fixes
- DOM access guards, RAF race condition fix, memory leak cleanup

## v3.3.3 — Kills Display Fix
- Fixed kills counter on game over screen

## v3.3.2 — UI Bug Fixes
- Various UI and display improvements

---

## v3.1.0 — Phase 2: Faculty Update

### 🎨 Visual
- Complete boss visual overhaul — white theme for all faculty-themed enemies (Boss, BossFirst, BossDog, GoldfishMinion)
- Enhanced particle systems and visual feedback during boss encounters

---

## v3.0.1 — Auto/Kao Restore + Orbital Effects

### 🎮 Characters
- AutoPlayer model fully restored
- KaoPlayer model enhanced
- New orbital particle system for Auto and Kao abilities

---

## v3.0.0 — Students Update

### 🎨 Complete Character Redesign
- All 3 player characters restyled with dark sci-fi + Thai High School Anime theme
- Service Worker cache updated for new character assets

---

## v2.7.0 — The Great Rebalancing

### ⚖️ Balance
- Enemy/Boss HP scaling formulas completely rebalanced (config-driven)
- Difficulty curve smoothed across all phases
- **Kao Weapon Master nerfs:**
  - Shotgun: 1.5× pellets (was higher)
  - Sniper: charge capped at 2.5×
  - Clone damage: 60% of original
- 14 critical bugs resolved across AI, collision, performance

---

*Older versions not archived.*