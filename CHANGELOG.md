# 🎮 MTC Game — Changelog

---

## v3.6.14 — DeadlyGraph Overhaul & Universal Risk/Reward
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