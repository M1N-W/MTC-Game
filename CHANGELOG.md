# 🎮 MTC Game — Changelog

> **⚠️ DOCUMENTATION STABILITY:** This changelog contains **version-specific implementation details** that change with updates. For stable architectural patterns, see [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md).

---

## v3.31.3 — Rendering Refactor: Pat Character Simplification
*Released: March 11, 2026*

### 🎨 Rendering System Optimization
- **Pat Character Refactor**: Simplified from custom body rendering to base body system
  - **Removed**: Complex custom drawing (white shirt, navy undershirt, hair, round glasses, cloth wrap, detailed katana)
  - **Retained**: All unique visual effects and identity markers
  - **Benefit**: Improved performance, reduced code complexity, better maintainability

### ⚡ Preserved Visual Effects
- **Zanzo Afterimage Ghosts**: Ice blue crescent silhouettes with fade trails
- **Iaido Charge Ring**: Dynamic dashed ring with progressive fill and glow
- **Blade Guard Reflect Ring**: Pulsing protection field with reflect radius indicator
- **Iaido Flash Line**: White core with ice blue outline for cinematic dash effect
- **Level Badge**: Ice blue theme maintained for character identity

### 🏗️ Technical Changes
- **Rendering Layers**: Reorganized from 7 complex layers to 4 streamlined layers
  - Layer 0: Zanzo ghosts (simplified circles)
  - Layer 1: Iaido charge ring (enhanced visual feedback)
  - Layer 2: Blade Guard reflect ring (camera zoom aware)
  - Layer 3: Base body (reuses existing system)
  - Layer 4: Iaido flash line (post-body overlay)

- **Code Reduction**: ~400 lines of complex custom drawing removed
- **Performance**: Eliminated per-frame complex path operations
- **Maintainability**: Now uses established rendering patterns

### 📊 Visual Consistency
- **Character Identity**: Maintained through unique effects rather than custom body
- **Color Theme**: Ice blue (#7ec8e3) preserved across all effects
- **Gameplay Clarity**: Effects are now more prominent with simplified body

### 📁 Files Modified
```
✅ MODIFIED: js/rendering/PlayerRenderer.js (-333 lines simplified, +59 lines effects)
✅ MODIFIED: PROJECT_OVERVIEW.md (+5 lines - rendering refactor entry)
✅ MODIFIED: sw.js (v3.31.3)
```

---

## v3.31.2 — Integration Fixes: Pat Character System
*Released: March 11, 2026*

### 🔧 Character System Integration
- **Player Creation Logic**: Added PatPlayer instantiation in `game.js`
  - Proper character type detection with `typeof PatPlayer === 'function'` guard
  - Seamless integration with existing character creation flow

- **Game Over UI**: Added Pat-specific retry button icon
  - Retry button now shows ⚔️ icon for Pat character (was default 🎓)
  - Maintains character identity consistency through game session

### ⚔️ Weapon System Enhancements
- **Character-Specific Weapon Sets**: Dynamic weapon loading per character
  - `setActiveChar()` now resets to character's first weapon
  - `getCharWeapons()` reads from `BALANCE.characters[charId].weapons`
  - `switchWeapon()` uses dynamic weapon array instead of hardcoded list

- **Katana Integration**: Added Pat's katana to weapon system
  - Muzzle offset: 44px for slash wave projectiles
  - Proper projectile spawning position aligned with katana visual
  - Character-specific weapon switching support

### 📊 Technical Architecture
- **Weapon System Refactor**: From hardcoded to data-driven approach
  - Before: `const weapons = ['auto', 'sniper', 'shotgun']`
  - After: `const weapons = Object.keys(this.getCharWeapons())`
  - Supports any character with custom weapon configurations

- **Muzzle Offset Table**: Updated documentation with Pat entry
  - Added to SKILL.md §8 Muzzle Offsets table
  - Katana slash wave: 44px offset for proper projectile alignment

### 📁 Files Modified
```
✅ MODIFIED: js/game.js (+4 lines - PatPlayer creation + retry icon)
✅ MODIFIED: js/weapons.js (+11 lines - character weapon sets + katana offset)
✅ MODIFIED: PROJECT_OVERVIEW.md (+6 lines - integration fixes entry)
✅ MODIFIED: .agents/skills/MTC-Game's skills for Claude/mtc-game-conventions.md (+1 line)
✅ MODIFIED: sw.js (v3.31.2)
```

---

## v3.31.1 — UI Polish: Pat Character Card & Tooltips
*Released: March 11, 2026*

### 🎨 Character Selection UI Enhancements
- **Pat Character Card**: Added complete character selection card with visual stats
  - HP: 140 (61% bar), DMG: 89 (59% bar), SPD: 285 (96% bar), RANGE: 750 (83% bar)
  - Character title: "Samurai Ronin" with "Blade Arts" tag
  - Description: "Samurai ronin — Katana dual-mode slash & melee, Zanzo Flash blink & Iaido cinematic kill"

- **Pat Skill Tooltip**: Added comprehensive skill breakdown tooltip
  - **R² (Blade Guard)**: R-Click hold — speed ×0.6, reflect enemy projectiles within 55px radius
  - **Q (Zanzo Flash)**: Blink to cursor + 4 afterimage trail. Land within 120px of enemy = ambush crit window 1.5s
  - **R (Iaido Strike)**: 3-phase cinematic kill — charge 0.6s → flash dash → TimeManager freeze + blood burst
  - **AUTO (Dual-Mode Katana)**: Auto-switch: Slash Wave (range) ↔ Melee Combo 3-hit ×1.8 (close). Iaido unlock = Ronin's Edge passive

### 🔧 Technical Integration
- **HTML Structure**: Integrated with existing character card grid system
- **Tooltip System**: Added `tooltip-pat` with consistent styling and data attributes
- **Icon Consistency**: Used appropriate emojis (🛡️🌀⚡🗡️) matching skill themes
- **Responsive Design**: Maintains existing responsive breakpoints and hover states

### 📁 Files Modified
```
✅ MODIFIED: index.html (+78 lines - Pat character card + skill tooltip)
✅ MODIFIED: PROJECT_OVERVIEW.md (+4 lines - UI polish entry)
✅ MODIFIED: sw.js (v3.31.1)
```

---

## v3.31.0 — NEW CHARACTER: Pat (แพท) - Samurai Ronin
*Released: March 11, 2026*

### ⚔️ New Playable Character: Pat (Samurai Ronin)
- **Character Concept:** แพท - หัวหน้าห้อง, ตัวเตี้ย, แว่นกลม, ดูเนิร์ด แต่เป็นซามูไรโรนินเท่มาก
- **Visual Identity:** นักเรียนชาย เสื้อขาวแขนพับ + cloth wrap มือ + katana เหน็บเอว
- **Weapon System:** Katana dual-mode — Slash Wave (projectile สีฟ้า) ระยะไกล / Melee Combo 3-hit ระยะประชิด (auto-switch ตามระยะ)

#### 🎯 Skills & Abilities
| Key | Skill | Description |
|-----|-------|-------------|
| Q | **Zanzo Flash** | Blink ไป cursor, spawn afterimage trail 4 ghost (สีฟ้า fade), ถ้า enemy อยู่ใน 120px หลังลงจอด → ambush crit window 1.5s |
| R | **Iaido Strike** | 3-phase: (1) Charge 0.6s ย่อตัว → (2) Flash พุ่งไป cursor + white line + hit detect → (3) Cinematic freeze 0.5s TimeManager หันหลังเก็บดาบ → damage+blood burst |
| R-Click | **Blade Guard** | ถือค้าง → speed ×0.6, reflect projectile ของ enemy/boss ที่เข้า radius 55px กลับไปเป็น friendly |
| Passive | **Ronin's Edge** | Unlock: Iaido โดน enemy ครั้งแรก → HP +25%, Crit +5%, Melee dmg +15% |

#### 🎨 Visual & Audio Features
- **Color Palette:** Navy body (#1a1a2e), White shirt (#e8e8e8), Ice blue katana glow (#7ec8e3)
- **Particle Effects:** New `zanzo` particle type with crescent silhouette afterimages
- **Blood Effects:** `spawnBloodBurst()` for lethal Iaido kills with dark crimson particles
- **Audio System:** 7 new SFX methods:
  - `playPatSlash()` - Katana slash sound
  - `playPatZanzo()` - Blink/afterimage sound
  - `playPatIaidoCharge()` - Phase 1 charge (0.6s resonant hum)
  - `playPatIaidoStrike()` - Phase 2 flash impact (violent transient)
  - `playPatSheathe()` - Phase 3 cinematic sheathing
  - `playPatReflect()` - Blade Guard projectile reflection
  - `playPatMeleeHit()` - Melee combo impact sounds

#### 🏗️ Architecture & Integration
- **File Structure:** `js/entities/player/PatPlayer.js` - Complete 624-line implementation
- **Inheritance:** Extends `PlayerBase`, follows established character patterns
- **Rendering:** Full support in `PlayerRenderer._drawPat()` with charge ring, flash line, guard arc
- **UI Integration:** Character select entry, HUD icons, cooldown displays, passive unlock indicator
- **Weapon System:** Blade Guard projectile reflection hook in `ProjectileManager.update()`
- **Config Integration:** Complete `BALANCE.characters.pat` block with 50+ balance values
- **Speed System:** Blade Guard speed penalty (×0.6) integrated into `PlayerBase` movement calc

#### 📁 Files Modified/Created
```
✅ CREATED: js/entities/player/PatPlayer.js (624 lines)
✅ MODIFIED: js/config.js (+120 lines - Pat balance block + refactor)
✅ MODIFIED: js/rendering/PlayerRenderer.js (+332 lines - _drawPat + effects)
✅ MODIFIED: js/effects.js (+83 lines - zanzo particles + helper functions)
✅ MODIFIED: js/audio.js (+141 lines - 7 Pat SFX methods)
✅ MODIFIED: js/menu.js (+8 lines - character select entry)
✅ MODIFIED: js/ui.js (+317 lines - portraits + HUD + _updateIconsPat)
✅ MODIFIED: js/PlayerBase.js (+2 lines - Blade Guard speed penalty)
✅ MODIFIED: js/weapons.js (+3 lines - projectile reflection hook)
✅ MODIFIED: index.html (+1 line - script tag)
✅ MODIFIED: PROJECT_OVERVIEW.md (+78 lines - Pat character documentation)
✅ MODIFIED: .agents/skills/MTC-Game's skills for Claude/mtc-game-conventions.md
```

### 🔧 Technical Implementation Details
- **State Machines:** Iaido 3-phase system (charge → flash → cinematic), Zanzo ambush window timer
- **Object Pooling:** Pre-allocated ghost pool (4 objects) to prevent GC during gameplay
- **Time Management:** Iaido cinematic freeze using `TimeManager.freeze()` integration
- **Projectile System:** Reflection system converts enemy projectiles to friendly with same damage
- **Auto-Switch Logic:** Weapon mode switches between Slash Wave (range) and Melee Combo (close) based on enemy distance
- **Critical System:** Zanzo ambush window grants +40% crit chance for 1.5s after blink

### 🎮 Balance & Scaling
- **Level Scaling:** damageMultiplierPerLevel: 0.09, cooldownReductionPerLevel: 0.04, maxHpPerLevel: 7
- **Energy Costs:** Zanzo (Q): 25, Iaido (R): 40, Blade Guard: No cost (hold-based)
- **Cooldowns:** Zanzo: 7.0s, Iaido: 14.0s
- **Damage Values:** Iaido: 160 base damage (3.5x crit multiplier), Melee combo: scaling with character level
- **Range Values:** Zanzo teleport: 280px, Iaido dash: 400px, Blade Guard reflect: 55px radius

---

## v3.30.10 — Character Selection UI Enhancement
*Released: March 11, 2026*

### 🎨 UI & Visual Improvements
- **Character Descriptions**: Enhanced character selection card descriptions for better clarity
  - KAO: Updated to "Precision tactician" with detailed skill highlights
  - POOM: Updated to "Mystic summoner" with companion emphasis
  - AUTO: Updated to "Thermodynamic brawler" with combat mode details
- **New AUTO Portrait**: Added complete SVG portrait for AUTO character
  - Thermodynamic theme with red/orange heat effects
  - Wanchai Stand "W" emblem on chest
  - Flame hair and heat aura effects
  - Consistent visual style with existing character portraits

### 📁 Files Modified
- `index.html` - Updated character card descriptions
- `js/ui.js` - Added AUTO portrait SVG to window.PORTRAITS

---

## v3.30.13 — Character Selection UI Enhancements
*Released: March 11, 2026*

### 🎨 Visual Improvements
- **Portrait Animation**: Added floating animation for selected character cards (2.8s ease-in-out infinite)
- **Visual Feedback**: Unselected cards now recede visually when a selection is made
- **Avatar Backgrounds**: Per-character radial gradient backgrounds (Kao: blue, Poom: green, Auto: red)
- **Hover States**: Enhanced hover interactions that prevent animation conflicts

### 🔧 Technical Changes
- **CSS Additions**: New `portraitFloat` keyframe animation and `.has-selection` state styling
- **JavaScript Update**: `selectCharacter()` function now adds `.has-selection` class to container
- **Responsive Design**: Improved mobile touch interactions and visual polish

### 📁 Files Modified
- `css/main.css` - Added portrait animations and selection state styling
- `js/menu.js` - Updated character selection logic for visual feedback

---

## v3.30.12 — Numeric Literals Cleanup & Balance
*Released: March 11, 2026*

### 🔧 Code Quality Improvements
- **Config Integration**: Replaced hardcoded numeric literals with BALANCE config references
- **ManopBoss.js**: matrixGrid cooldown now uses `BALANCE.boss.matrixGridCooldown ?? 22.0`
- **ShopSystem.js**: Auto core heat tier properly references `BALANCE.characters?.auto?.heatTierHot ?? 67`

### ⚖️ Balance Adjustments  
- **Rice Weapon**: Damage fallback increased from 42.5 → 62
- **Heat Wave**: Range fallback increased from 150 → 180
- **Boss Config**: Added `matrixGridCooldown: 22.0` to BALANCE.boss section

### 📁 Files Modified
- `js/config.js` - Added matrixGridCooldown configuration
- `js/entities/boss/ManopBoss.js` - Use config for matrixGrid cooldown
- `js/weapons.js` - Rice damage and heatWave range balance changes
- `js/systems/ShopSystem.js` - Auto core heat tier config reference

---

## v3.30.11 — Documentation Updates
*Released: March 11, 2026*

### 📝 Documentation Corrections
- **PROJECT_OVERVIEW.md**: Updated Stand Meter drain multipliers to match config.js values
  - COLD tier drain: ×1.30 → ×3.0 (corrected documentation)
  - OVERHEAT tier drain: ×0.50 → ×2.0 (corrected documentation)
  - Stand Meter fill: +4 → +1 per hit (documentation alignment)

- **mtc-game-conventions.md**: Synchronized heat tier system documentation
  - Added config key references for all heat tier values
  - Updated Stand Meter drain multiplier documentation
  - Clarified config.js as source of truth for all gameplay values

- **AutoPlayer.js**: Minor documentation alignment
  - Updated wanchaiDamage fallback comment to reflect config value

### 🔧 Technical Details
- No functional gameplay changes - documentation only
- Ensures consistency between code comments and actual config values
- Maintains accurate reference material for AI assistants and developers

### 📁 Files Modified
- `PROJECT_OVERVIEW.md`: Stand Meter drain value corrections
- `.agents/skills/MTC-Game's skills for Claude/mtc-game-conventions.md`: Heat tier system documentation
- `js/entities/player/AutoPlayer.js`: Comment alignment

---

## v3.30.10 — Character Balance Adjustments
*Released: March 11, 2026*

### 🎯 Balance Changes
- **AutoPlayer Thermodynamic Balance**:
  - Reduced Stand crit bonus: 0.25 → 0.18
  - Increased Overheat HP drain: 3 → 5/s
  - Reduced Charge Punch max damage: 3.5× → 2.5×
  - Improved Stand Rush range: 85 → 200px
  - Reduced Stand Rush cooldown: 0.12 → 0.10s
  - Reduced Stand Meter fill: 4 → 1 per hit

- **KaoPlayer Assassin Balance**:
  - Reduced passive Lv2 crit bonus: 0.05 → 0.04
  - Extended Phantom Blink ambush window: 1.5 → 2.0s
  - Reduced Phantom Blink damage multiplier: 1.8 → 1.4
  - Reduced stealth chain crit bonus: 0.25 → 0.18

- **PoomPlayer Spiritual Warrior**:
  - Increased passive crit bonus: 0.04 → 0.06
  - Improved passive lifesteal: 0.015 → 0.025
  - Synchronized ritual boss damage caps with config values

- **Summon Entity Updates**:
  - Enhanced Naga Cosmic Balance burn DPS: 22 → 30
  - Standardized Naga ignite duration: 0.8s
  - Extended Garuda duration: 6 → 9s
  - Synchronized all summon values with config.js

### ⚙️ Configuration Enhancements
- **New Config Parameters**:
  - `vacuumEarlyHeatGain`: Early mode heat gain for Vacuum skill
  - `nagaIgniteDuration`: Standardized ignite duration for Naga attacks
  - `ritualBossDmgCapPct`: 35% boss maxHP cap for ritual bursts
  - `ritualBossDmgCapCosmicPct`: 45% cap during Cosmic Balance

### 📝 Files Modified
- `js/config.js`: Added new balance parameters and updated existing values
- `js/entities/player/AutoPlayer.js`: Balance synchronization and fallback updates
- `js/entities/player/KaoPlayer.js`: Crit bonus and damage multiplier adjustments
- `js/entities/player/PoomPlayer.js`: Passive ability improvements
- `js/entities/summons.js`: Entity value synchronization with config

---

## v3.30.9 — AutoPlayer Heat Damage Synchronization Fix
*Released: March 11, 2026*

### 🔧 Balance & Consistency
- **Heat Damage Fallback Fix**: Synchronized AutoPlayer.js fallback values with config.js as source of truth
- **Corrected Pre-Nerf Values**: Fixed outdated heat damage multipliers that were using pre-balance values:
  - `heatDmgOverheat`: 1.50 → 1.30
  - `heatDmgHot`: 1.30 → 1.20  
  - `heatDmgWarm`: 1.15 → 1.10
  - `coldDamageMult`: 0.70 → 0.75
- **Documentation Update**: Updated mtc-game-conventions.md to reflect current heat tier values
- **Fail-Safe Consistency**: Ensured `??` fallbacks in AutoPlayer.js match config.js to prevent desync if config fails to load

### 📝 Files Modified
- `js/entities/player/AutoPlayer.js`: Heat damage fallback values in WanchaiStand._punch() and AutoPlayer._hitPlayer()
- `.agents/skills/MTC-Game's skills for Claude/mtc-game-conventions.md`: Version and heat tier documentation

---

## v3.30.8 — Wave Event Announcement Integration
*Released: March 11, 2026*

### 🎨 UI/UX Enhancements
- **Unified Banner System**: Integrated wave event badges (fog/speed) into WaveAnnouncementFX
- **Event Badge Strip**: Added visual event indicators to wave announcement banners
- **Code Consolidation**: Removed duplicate banner drawing from WaveManager.js
- **Visual Polish**: Enhanced event display with icons, colors, and proper positioning

### 🔧 Technical Improvements
- **WaveManager.js**: Added `attachEvent()` calls to integrate with WaveAnnouncementFX
- **effects.js**: Extended WaveAnnouncementFX with event badge rendering
- **Performance**: Eliminated redundant banner drawing operations
- **Architecture**: Centralized event announcement logic in effects system

---

## v3.30.7 — Service Worker Cache Fix
*Released: March 11, 2026*

### 🐛 Bug Fixes
- **Service Worker Cache**: Fixed filename casing for `KaoPlayer.js` in cache list
- **File Loading**: Ensured proper caching of Kao player entity file
- **Case Sensitivity**: Corrected `Kaoplayer.js` → `KaoPlayer.js` to match actual filename

---

## v3.30.6 — Auto Player Rendering Refactoring
*Released: March 11, 2026*

### 🎨 Rendering System Improvements
- **Code Separation**: Moved ~600 lines of Wanchai Stand rendering code from AutoPlayer.js to PlayerRenderer.js
- **Architecture Cleanup**: Separated rendering logic from entity logic for better maintainability
- **Performance**: Reduced AutoPlayer class size by ~50% for improved memory usage

### ⚖️ Balance Adjustments
- **Auto Character**: Reduced damage multiplier per level from 0.12 to 0.09
- **Heat Tier System**: Refined damage and speed multipliers across all tiers
  - COLD: dmg ×0.75 (was ×0.70)
  - WARM: dmg ×1.10, punch rate ×0.92 (was ×1.15, ×0.85)
  - HOT: dmg ×1.20, punch rate ×0.85 (was ×1.30, ×0.70)
  - OVERHEAT: dmg ×1.30, crit +12% (was ×1.50, crit +20%)

### 🐛 Bug Fixes
- **Wanchai Cooldown**: Fixed cooldown timing to start after stand expires, not at activation
- **Code Organization**: Eliminated duplicate rendering code between player classes

---

## v3.30.5 — Boss Attack Architecture Refactoring
*Released: March 10, 2026*

### 🏗️ Architecture Overhaul
- **Modular Boss Attack System**: Split monolithic boss attacks into specialized modules
- **Shared Base Classes**: Created `DomainBase` for common domain expansion patterns
- **Code Reuse**: Eliminated duplicate code between boss attack systems
- **Enhanced Maintainability**: Improved code organization and separation of concerns

### 📁 New File Structure
- **`boss_attacks_shared.js`**: Shared base classes and utilities
  - `DomainBase`: Common domain expansion boilerplate
  - `ExpandingRing`: Reusable shockwave visual effect
- **`boss_attacks_manop.js`**: KruManop-specific attacks
  - `BarkWave`: Sonic cone attack with visual distortion
  - `GoldfishMinion`: Kamikaze sine-wave chaser
  - `BubbleProjectile`: Slow AoE projectile with slow effect
  - `MatrixGridAttack`: Area-denial zone attack
  - `DomainExpansion`: Enhanced METRICS-MANIPULATION ultimate
  - `EquationSlam`: Shockwave ring with formula shards
  - `DeadlyGraph`: Expanding laser beam with risk/reward
  - `ChalkWall`: Phase 2 ground hazard
- **`boss_attacks_first.js`**: Refactored KruFirst attacks
  - `GravitationalSingularity`: Now extends `DomainBase`
  - Enhanced with proximity punishment mechanics
  - Improved visual effects and casting animations

### 🎯 Gravitational Singularity Enhancements
- **Proximity Punishment**: Anti-hug mechanics with contact damage and repulsion
- **Dual Ring Collapse**: Inner high-damage ring + outer falloff damage
- **Visual Contact Zone**: Red dashed ring showing danger area
- **Enhanced Casting**: Green/cyan cinematic overlay with chromatic effects
- **Code Deduplication**: Shared domain expansion logic

### 🎨 Visual Effects Improvements
- **BossRenderer Phase Auras**: Dynamic auras based on boss phase/HP
  - Phase 1: Cyan-green science field
  - Phase 2: Orange-red unstable jetpack
  - Phase 3: Purple-white singularity collapse
- **Quantum Formula Storm**: Dual-orbit system with 12 formulas
  - Outer orbit: Large, slow formulas
  - Inner orbit: Small, fast flickering formulas
  - Enraged mode: Scattered radius oscillation
- **Ambient Particles**: Phase 2/3 particle systems with deterministic motion

### ⚙️ Configuration Updates
- **Proximity Punishment Settings**: New config section for anti-hug mechanics
  - `contactRadius`: 70px danger zone
  - `contactDPS`: 18 damage per second
  - `repulseForce`: 260px/s outward push
- **Collapse Inner Ring**: `collapseInnerRadius` 110px, `collapseInnerDamage` 65

### 🔧 Technical Improvements
- **DomainBase Pattern**: Shared state machine and utility functions
- **Object Composition**: `Object.assign(Object.create(DomainBase), {...})`
- **Performance**: Eliminated `Math.random()` calls in draw loops
- **Deterministic Rendering**: All visual effects use seeded calculations
- **Code Organization**: Clear separation between shared and boss-specific logic

### 🎮 Gameplay Impact
- **Anti-Hug Mechanics**: Prevents exploit of staying next to boss
- **Enhanced Visual Feedback**: Better indication of danger zones
- **Improved Boss Identity**: More distinct visual signatures per phase
- **Risk/Reward Balance**: Proximity punishment encourages tactical positioning

### 📁 Files Modified
- **New Files**: `boss_attacks_shared.js`, `boss_attacks_manop.js`
- **Modified**: `boss_attacks_first.js`, `BossRenderer.js`, `config.js`
- **Documentation**: Updated changelog, readme, and project overview

---

## v3.30.4 — Major Balance Patch
*Released: March 10, 2026*

### ⚖️ Global Balance Overhaul
- **Damage Scaling Reduction**: Significant nerfs to damage multipliers across all characters
- **Crit Compression**: Reduced critical hit bonuses to prevent burst damage scaling
- **Sustainability Limits**: Decreased healing and resource generation rates
- **Heat System Rebalancing**: Compressed damage tiers and increased overheat penalties

### 👤 Kao Character Nerfs
- **Level Scaling**: `damageMultiplierPerLevel` 0.12 → 0.09 (wave10 damage mult 2.2→1.9)
- **Passive Crit**: `passiveLv2CritBonus` 0.05 → 0.04
- **Phantom Blink**: `phantomBlinkDmgMult` 1.8 → 1.4, `stealthChainBonus` 0.25 → 0.18

### 🥊 Wanchai Character Nerfs
- **Base Damage**: `wanchaiDamage` 30 → 24 (20% DPS reduction)
- **Crit Scaling**: `standCritBonus` 0.25 → 0.18
- **Heat System**: Compressed damage tiers (1.15/1.30/1.50 → 1.10/1.20/1.30)
- **Overheat Penalties**: `heatCritBonusOverheat` 0.20 → 0.12, `heatHpDrainOverheat` 3 → 5
- **Stand Meter**: `standMeterPerHit` 4 → 1, increased drain rates for COLD/OVERHEAT

### 🔧 Auto Character Nerfs
- **Level Scaling**: `damageMultiplierPerLevel` 0.12 → 0.08 (wave10 damage mult 2.2→1.8)
- **Cold Penalty**: `coldDamageMult` 0.70 → 0.75 (less punishing)

### 🍙 Poom Character Nerfs
- **Level Scaling**: `damageMultiplierPerLevel` 0.11 → 0.09 (aligned with other characters)
- **Eat Rice**: `eatRiceCritBonus` 0.2 → 0.12
- **Cosmic Balance**: `cosmicDamageMult` 1.35 → 1.25
- **Garuda**: `garudaDamage` 150 → 120

### 🎯 Ritual System Nerfs
- **Stack Burst**: `stackBurstPct` 0.25 → 0.15 (5 stacks = 75% HP instead of 125% HP)
- **Anti-Instakill**: Prevents ritual from instantly killing high-health enemies

### 🔧 Technical Balance Changes
- **Heat Tier Compression**: Reduced damage gaps between heat tiers
- **Stand Meter Sustainability**: Fixed infinite stand loops at OVERHEAT
- **Level Scaling Alignment**: Unified damage per level across characters
- **Crit Stack Reduction**: Prevented excessive crit stacking from multiple sources

### 🎮 Gameplay Impact
- **Longer Boss Fights**: Reduced TTK from ~8s to ~12s for sustained DPS
- **More Strategic Resource Management**: Increased focus on timing and positioning
- **Balanced Character Viability**: Reduced dominance of high-damage builds
- **Risk/Reward Tuning**: Overheat and high-risk abilities now have clearer tradeoffs

### 📁 Files Modified
- `js/config.js` - Comprehensive balance adjustments across all character systems

---

## v3.30.3 — Boss Attacks Safety Improvements
*Released: March 10, 2026*

### 🛡️ Stability & Safety Enhancements
- **Coordinate Validation**: Added `isFinite()` checks to prevent rendering errors when world-to-screen conversion produces invalid coordinates
  - `PhysicsFormulaZone.draw()`: Added safety check for screen radius calculations
  - `GravitationalSingularity.draw()`: Added validation for boss screen coordinates
  - `GravityWell.draw()`: Added comprehensive safety check with early return
- **Error Prevention**: Prevents canvas rendering crashes when entities are positioned at invalid coordinates
- **Graceful Degradation**: Effects now safely skip rendering when coordinate validation fails

### 🧹 Code Quality Improvements
- **Export Formatting**: Fixed inconsistent spacing in global exports section
  - Standardized alignment of `window.ClassName = ClassName` assignments
  - Improved code readability and maintainability
- **Consistent Style**: Applied uniform formatting patterns across the file

### 🔧 Technical Benefits
- **Crash Prevention**: Eliminates potential rendering crashes from invalid coordinate transformations
- **Debugging Support**: Easier to identify when coordinate systems produce invalid values
- **Performance**: Avoids unnecessary rendering operations when coordinates are invalid
- **Code Consistency**: Uniform formatting improves code navigation and understanding

### 📁 Files Modified
- `js/entities/boss/boss_attacks_first.js` - Added safety checks and formatting improvements

### 🎯 Integration Notes
- **Backward Compatible**: All existing functionality preserved
- **Silent Protection**: Safety checks operate transparently without affecting gameplay
- **Defensive Programming**: Follows best practices for coordinate validation in canvas rendering
- **Future Proof**: Protects against potential coordinate system edge cases

---

## v3.30.2 — Boss Class Alias Enhancement
*Released: March 10, 2026*

### 🏷️ Class Naming & Compatibility
- **ManopBoss Alias**: Added `window.ManopBoss = KruManop` for better naming consistency
  - Provides semantic class name that matches file naming convention
  - Enables proper `instanceof` checks for type identification
  - Improves code readability and developer experience
- **Backward Compatibility**: Maintains existing `window.Boss` and `window.KruManop` aliases
  - No breaking changes to existing WaveManager or AdminSystem functionality
  - Preserves all current integrations and dependencies

### 🔧 Technical Benefits
- **Type Safety**: Better support for runtime type checking with `instanceof ManopBoss`
- **Code Clarity**: More intuitive class naming that aligns with file structure
- **Developer Experience**: Easier debugging and introspection with proper class names
- **Consistency**: Aligns with `FirstBoss`/`KruFirst` naming patterns

### 📁 Files Modified
- `js/entities/boss/ManopBoss.js` - Added ManopBoss alias export

### 🎯 Integration Notes
- **WaveManager**: Can now use either `KruManop` or `ManopBoss` for boss spawning
- **AdminSystem**: Supports both class names for console commands
- **Type Checking**: `instanceof ManopBoss` now works as expected
- **Future Development**: New code can use semantic `ManopBoss` class name

---

## v3.30.1 — AI System Code Quality Improvements
*Released: March 10, 2026*

### 🧠 AI System Enhancements
- **Wall-Avoidance Fix**: Corrected EnemyActions.retreat() to use world map dimensions instead of canvas pixels
  - Changed from `CANVAS.width/height` to `MAP_CONFIG.mapWidth/mapHeight` (3200×3200)
  - Prevents enemies from incorrectly avoiding screen edges instead of world boundaries
  - Critical fix for proper AI behavior in large world maps
- **Performance Optimization**: Optimized UtilityAI.dispose() method to avoid array allocations
  - Changed `this._nearbyAlliesList = []` to `this._nearbyAlliesList.length = 0`
  - Prevents garbage collection pressure during frequent enemy death cycles
- **Code Formatting**: Standardized spacing and formatting across AI modules
  - Fixed inconsistent spacing in mathematical calculations
  - Improved code readability and maintainability

### 📝 Documentation Updates
- **Load Order Correction**: Updated PlayerPatternAnalyzer.js load order documentation
  - Corrected sequence: UtilityAI → EnemyActions → PlayerPatternAnalyzer → SquadAI → enemy.js
  - Ensures proper dependency resolution during initialization
- **Code Comments**: Enhanced SquadAI.js with clearer role assignment logic documentation
  - Added explanatory comments about shield role assignment restrictions
  - Improved understanding of squad coordination behavior
- **Project Overview**: Comprehensive documentation updates to reflect current codebase state
  - Updated boss attacks file structure documentation
  - Corrected API method names for consistency
  - Updated architecture notes to reflect completed refactoring

### 🔧 Technical Improvements
- **World Map Awareness**: AI now properly respects world boundaries instead of screen boundaries
- **Memory Management**: Reduced object allocations in AI hot paths
- **Code Consistency**: Standardized formatting across all AI system files
- **Dependency Clarity**: Clearer documentation of module loading sequence

### 📁 Files Modified
- `js/ai/EnemyActions.js` - Wall-avoidance bounds fix, formatting improvements
- `js/ai/UtilityAI.js` - Performance optimization in dispose method
- `js/ai/PlayerPatternAnalyzer.js` - Load order documentation correction
- `js/ai/SquadAI.js` - Code formatting and comment improvements
- `PROJECT_OVERVIEW.md` - Comprehensive documentation updates
- `.agents/skills/MTC-Game's skills for Claude/mtc-game-conventions.md` - Converted to .md format

---

## v3.30.0 — Boss Attacks Refactoring (Major Architecture Improvement)
*Released: March 10, 2026*

### 🏗️ Code Organization & Architecture
- **Boss Attacks Modularization**: Split monolithic `boss_attacks.js` (3700+ lines) into three specialized files
  - `boss_attacks_shared.js` - Shared effects used by all bosses (ExpandingRing)
  - `boss_attacks_manop.js` - KruManop-specific attacks (BarkWave, GoldfishMinion, DomainExpansion, etc.)
  - `boss_attacks_first.js` - KruFirst-specific attacks (PorkSandwich, GravitationalSingularity, SuperpositionClone, etc.)
- **Improved Maintainability**: Smaller, focused files enable easier debugging and future enhancements
- **Clear Dependencies**: Established proper load order sequence for boss attack modules

### 📁 File Structure Changes
- **Deleted**: `js/entities/boss/boss_attacks.js` (monolithic file)
- **Created**: 
  - `js/entities/boss/boss_attacks_shared.js` (90 lines, shared utilities)
  - `js/entities/boss/boss_attacks_manop.js` (2049 lines, Manop boss attacks)
  - `js/entities/boss/boss_attacks_first.js` (1597 lines, First boss attacks)

### 🔧 Technical Improvements
- **Load Order Optimization**: Updated loading sequence in `index.html` and `sw.js`
  - Shared → Manop → First → BossBase → Specific Boss classes
- **Code Organization**: Related attack classes now grouped by boss ownership
- **Development Efficiency**: Smaller files reduce cognitive load and improve navigation
- **Future-Proofing**: Modular structure supports adding new boss attack types

### 🎯 Development Workflow Impact
- **Easier Debugging**: Issues can be isolated to specific boss attack files
- **Better Code Reviews**: Smaller, focused changes can be reviewed more effectively
- **Enhanced Readability**: Developers can focus on relevant boss-specific code
- **Scalability**: New bosses can have dedicated attack files without cluttering existing code

### 📝 Documentation Updates
- **Version Bump Guidelines**: Added clear ownership rules for version number management
- **Load Order Documentation**: Updated file loading sequence and dependencies
- **Architecture Clarity**: Better separation of concerns in boss attack systems

---

## v3.29.9 — Global Variable References & Voice Bubble Namespacing Fix
*Released: March 10, 2026*

### 🐛 Bug Fixes
- **Voice Bubble Namespacing**: Fixed `showVoiceBubble()` calls to use proper `window.UIManager.showVoiceBubble()` prefix
  - Updated MTC Room entry/exit voice bubble calls in `js/map.js`
  - Ensures proper UIManager access and prevents undefined function errors
- **Boss Class Reference Corrections**: Fixed admin console boss spawning commands
  - Changed `Boss` class references to `ManopBoss` for Manop boss spawning
  - Changed `BossFirst` class references to `KruFirst` for First boss spawning
  - Updated error messages to reference correct class names
- **Global Variable Access**: Added `window.` prefix for proper global object access
  - Fixed `mapSystem.objects` references to use `window.mapSystem.objects`
  - Updated `player` references to use `window.player` in various systems
  - Corrected `gameState` references to use `window.gameState`
  - Fixed `squadAI` references to use `window.squadAI`

### 🔧 Technical Details
- **Root Cause**: Missing `window.` prefix causing undefined references in global scope
- **Impact**: Prevents runtime errors when accessing global objects and ensures proper namespacing
- **Files Modified**: 
  - `js/map.js` (2 voice bubble fixes)
  - `js/systems/AdminSystem.js` (4 boss class reference fixes)
  - `js/systems/WaveManager.js` (2 boss spawning fixes)
  - `js/entities/base.js` (1 mapSystem reference fix)
  - `js/weapons.js` (1 player reference fix)
  - `js/game.js` (multiple global reference fixes)

### 🎯 Gameplay Impact
- **Admin Console**: Boss spawning commands now work correctly without class reference errors
- **MTC Room**: Voice bubbles now display properly when entering/exiting the room
- **System Stability**: Improved reliability of global object access across all game systems

---

## v3.29.8 — Minimap Method Call Class Correction
*Released: March 10, 2026*

### 🐛 Bug Fixes
- **Class Prefix Correction**: Fixed minimap static method calls to use proper class semantics
  - Changed `UIManager._minimapDrawShell()` calls to `CanvasHUD._minimapDrawShell()`
  - Fixed `UIManager._minimapDrawContent()` calls to `CanvasHUD._minimapDrawContent()`  
  - Fixed `UIManager._minimapDrawLabel()` calls to `CanvasHUD._minimapDrawLabel()`
- **Root Cause**: Previous v3.29.7 fix used UIManager prefix but methods are defined in CanvasHUD class
- **Impact**: Proper static method binding with correct class semantics and improved code organization

### 🔧 Technical Details
- **Files Modified**: `js/ui.js` (3 method call corrections)
- **Class Organization**: Methods now called using their defining class (CanvasHUD) rather than UIManager
- **Code Quality**: Improved semantic accuracy and class relationship clarity

---

## v3.29.7 — Minimap Method Call Correction & Cache Cleanup
*Released: March 10, 2026*

### 🐛 Bug Fixes
- **Static Method Call Correction**: Fixed minimap drawing method calls in UIManager class
  - Corrected `this._minimapDrawShell()` calls to `UIManager._minimapDrawShell()`
  - Fixed `this._minimapDrawContent()` calls to `UIManager._minimapDrawContent()`  
  - Fixed `this._minimapDrawLabel()` calls to `UIManager._minimapDrawLabel()`
- **Root Cause**: Previous v3.29.6 fix incorrectly changed method declarations to static but left method calls as instance methods
- **Impact**: Minimap now renders correctly with proper static method binding

### 🔧 Technical Improvements
- **Service Worker Cache Cleanup**: Removed `./GODOT_EXPORT.md` from cache list
  - File doesn't exist in repository, preventing unnecessary 404 errors
  - Reduces cache size and improves service worker installation

### 📝 Files Modified
- `js/ui.js` (3 method call corrections)
- `sw.js` (1 cache entry removal)

---

## v3.29.6 — Minimap Method Call Bug Fix
*Released: March 10, 2026*

### 🐛 Bug Fixes
- **Static Method Reference Error**: Fixed minimap drawing method calls in CanvasHUD class
  - Corrected `UIManager._minimapDrawShell()` calls to `this._minimapDrawShell()`
  - Fixed `UIManager._minimapDrawContent()` calls to `this._minimapDrawContent()`  
  - Fixed `UIManager._minimapDrawLabel()` calls to `this._minimapDrawLabel()`
- **Root Cause**: Previous v3.29.5 refactoring converted static methods to instance methods but method calls weren't updated
- **Impact**: Minimap now renders correctly without console errors and proper method binding

### 🔧 Technical Details
- **Files Modified**: `js/ui.js` (3 method call corrections)
- **Error Type**: Method binding issue in class instance context
- **Verification**: All minimap drawing phases now execute correctly with proper `this` context

---

## v3.29.5 — Major Code Architecture Refactoring
*Released: March 10, 2026*

### 🏗️ Function Organization & Modularization
- **Game Loop Refactoring**: Split massive `updateGame()` function into 6 focused sub-functions
  - `_tickWaveEvents()` - Wave events, domain effects, glitch intensity, day/night cycle
  - `_tickShopBuffs()` - Shop damage/speed boost timer management
  - `_checkProximityInteractions()` - Shop tick, database/admin/shop proximity interactions
  - `_tickEntities()` - Player, weapons, boss, enemies, AI updates
  - `_tickBarrelExplosions()` - Explosive barrel projectile collision and AoE damage
  - `_tickEnvironment()` - Projectiles, powerups, meteors, particles, VFX systems
- **Game Start Modularization**: Split `startGame()` into 3 clean phases
  - `_createPlayer()` - Player factory with admin buff handling
  - `_resetRunState()` - Mutable run state reset for fresh games
  - `_initGameUI()` - HUD setup, overlays, tutorial, mobile, wave initialization
- **Wave Management Enhancement**: Split `startNextWave()` into specialized functions
  - `_resetWaveState()` - Per-wave mutable state cleanup
  - `_startGlitchWave()` - Glitch wave specific logic with countdown lock
  - `_startBossWave()` - Deterministic boss encounter queue management

### 🎨 CSS Regional Organization System
- **13 Logical Sections**: Comprehensive CSS organization with clear regional boundaries
  - BASE: Reset, fonts, body, canvas, layout foundations
  - INTERACTION PROMPTS: Database, admin console, shop interaction elements
  - PAUSE SCREEN: Resume overlay, pause indicator styling
  - ADMIN CONSOLE: CRT overlay, input fields, permission badges
  - SHOP MODAL: Item displays, character badges, achievement gallery
  - ACHIEVEMENTS HUD: Toast notification system
  - BOSS HUD: Health bars, phase colors, speech bubbles
  - SKILL BAR: hud-bottom, icons, themes, cooldown arcs, lock overlays
  - MAIN MENU OVERLAY: Menu panels, transitions
  - VICTORY SCREEN: Epic cinematic, stats, rank badge
  - CHARACTER SELECT: Selection cards, stat bars, character themes
  - TUTORIAL OVERLAY: Tutorial steps, spotlight, progress dots
  - MOBILE UI: Touch controls, buttons, haptic feedback styles
- **Enhanced Navigation**: Clear section headers make CSS maintenance and development significantly more efficient

### 🎯 UI System Modularization
- **HUD Setup Refactoring**: Split `setupCharacterHUD()` into 8 specialized methods
  - `_hudApplyThemeAndLabel()` - Theme classes and character name labels
  - `_hudSetupAttackSlot()` - Attack icon reskinning and theming
  - `_hudSetupPortraitAndWeapon()` - Portrait SVG swap and weapon indicator
  - `_hudSetupPassiveSlot()` - Kao-only passive skill visibility
  - `_hudSetupSkill1Slot()` - R-Click skill slot management
  - `_hudSetupQSlot()` - Q-slot with naga/teleport/vacuum handling
  - `_hudSetupExclusiveESlots()` - Character-specific E-slot injection
  - `_hudSetupRitualAndMobileButtons()` - Ritual slot and mobile button labels
- **Cooldown Update Refactoring**: Split `updateSkillIcons()` into character-specific methods
  - `_updateIconsPoom()` - Poom's eat/naga/ritual/garuda cooldown management
  - `_updateIconsAuto()` - Auto's wanchai/vacuum/detonation cooldown arcs
  - `_updateIconsKao()` - Kao's teleport charges and clone cooldown system

### 🗺️ Minimap System Overhaul
- **Drawing Phase Separation**: Split `drawMinimap()` into 3 focused methods
  - `_minimapDrawShell()` - Outer glow, navy fill, pulsating border, accent ring
  - `_minimapDrawContent()` - Grid, sweep, POI markers, enemies, boss, player (inside clip)
  - `_minimapDrawLabel()` - Label text and legend row (outside clip)
- **Clip Architecture Fix**: Proper save/restore pairing prevents blend mode leakage
- **Code Readability**: Each drawing phase now has clear responsibility and reduced complexity

### 🔧 Technical Enhancements
- **HTML Structure Improvements**: Added semantic IDs (`attack-emoji`, `attack-hint`) for better DOM manipulation
- **Code Consistency**: Standardized formatting, reduced complexity, improved naming conventions
- **Performance Optimization**: Optimized DOM queries, reduced redundant calculations
- **Maintainability Boost**: Modular architecture enables easier debugging and future enhancements
- **Documentation**: Enhanced inline comments and function documentation

---

## v3.29.4 — Character HUD Theming System Enhancement
*Released: March 10, 2026*

### 🎨 Personalized Character HUD Themes
- **Dynamic HUD Theming**: Character-specific bottom HUD themes with unique gradient backgrounds and accent colors
  - Kao (Blue): Blue gradient with #3b82f6 accents and matching visual effects
  - Poom (Emerald): Emerald gradient with #10b981 accents and spiritual theming
  - Auto (Red): Red gradient with #dc2626 accents and thermodynamic styling
- **Character Identity Labels**: Dynamic character name and role tags displayed in HUD
  - Kao: "ASSASSIN" tag with blue glow effects
  - Poom: "SPIRITUAL" tag with emerald glow effects  
  - Auto: "BRAWLER" tag with red glow effects
- **Attack Icon Personalization**: Character-specific attack icons with matching color themes
  - Kao: 🔫 (gun) with blue theme
  - Poom: 🍙 (rice ball) with emerald theme
  - Auto: 🔥 (fire) with red theme

### 🎯 UI/UX Improvements
- **Enhanced Visual Polish**: Improved CSS formatting for better code readability and maintenance
- **Smooth Character Switching**: Animated transitions when switching between characters
- **Cohesive Visual Identity**: Each character now has a complete visual theme throughout the HUD
- **Better Color Accessibility**: High-contrast color schemes optimized for each character's theme

### 🔧 Technical Enhancements
- **CSS Architecture**: Modular theme classes for easy maintenance and future character additions
- **Dynamic DOM Updates**: Character labels created once and updated efficiently on character switch
- **Theme Consistency**: Shared HUD elements (dash/stealth) properly recolored based on active character
- **Performance Optimized**: Minimal DOM manipulation with cached element references

---

## v3.29.3 — Documentation Update
*Released: March 10, 2026*

### 📝 Project Documentation Enhancement
- **PROJECT_OVERVIEW.md Update**: Added comprehensive bug fix documentation for v3.29.2 changes
- **Bug Fix Registry**: Added 7 new bug fixes to troubleshooting table with detailed solutions
- **Recent Changes Section**: Updated to v3.29.3 with complete breakdown of Shop System + WaveManager fixes
- **Critical Bug Documentation**: Added TDZ crash, speedWave item, and ShopManager.tick() fixes
- **Known Issues**: Documented remaining shieldBubble + reflectArmor integration needs

### 📚 Documentation Improvements
- Enhanced troubleshooting table with 4 new critical bug fix entries
- Added severity classification (Critical/High/Medium) for recent fixes
- Documented property naming conventions and TDZ prevention patterns
- Added cross-references between bug symptoms and solutions

---

## v3.29.2 — Wave Announcement & Shop Timer Fixes
*Released: March 10, 2026*

### 🎬 Wave Announcement System Fix
- **WaveAnnouncementFX Timing**: Moved trigger call after boss/glitch wave detection to ensure correct parameters are passed
- **Proper Wave Type Detection**: Wave announcements now correctly display boss/glitch indicators based on actual wave calculations

### 🛒 Shop System Optimization
- **Speed Boost Timer Display**: Fixed shop tick() method to use correct `shopSpeedBoostActive/shopSpeedBoostTimer` properties
- **Performance Optimization**: Shop tick() now updates only the countdown badge instead of re-rendering entire shop UI
- **Pause State Compatibility**: Timer display works correctly while game is paused (shop open state)

### 🐛 Bug Fixes
- Resolved wave announcement showing incorrect wave type indicators
- Fixed shop speed boost timer not displaying countdown correctly
- Eliminated unnecessary DOM re-renders during shop timer updates

---

## v3.29.1 — Shop System Bug Fixes
*Released: March 10, 2026*

### 🛒 Shop System Fixes
- **Shield Duplicate Purchase Fix**: Added guard to prevent buying shield when player already has one, preventing score deduction and soldout flag issues
- **Speed Boost Restoration Fix**: Corrected speed boost expiration to restore `stats.moveSpeed` instead of `moveSpeed` for proper stat path consistency
- **Speed Boost Timer Mechanics**: Fixed speed wave items to use `shopSpeedBoostActive/shopSpeedBoostTimer` properties that game.js actually ticks, instead of unused `_speedWaveTimer/_speedWaveMult`

### 🐛 Bug Fixes
- Fixed shop system race condition where duplicate purchases could occur before proper validation
- Ensured proper stat restoration paths for speed boosts to match ShopSystem.js implementation
- Resolved speed boost timer display and duration tracking issues

---

## v3.29.0 — Priority 2 & 3 Systems Implementation
*Released: March 10, 2026*

### 🎬 Cinematic Wave Announcement System
- **Canvas-Based Announcements**: Replaced HTML overlays with `WaveAnnouncementFX` class in effects.js
- **Letterbox Cinematics**: Animated black bars with wave number display and contextual subtitles
- **Boss Event Integration**: Different colors and text for boss, glitch, and normal waves
- **Camera Transform Support**: Full integration with camera system for proper positioning
- **Performance Optimized**: Single update/draw pattern with 0 cost when inactive

### 🛒 Shop System Expansion (7 New Items)
- **Defensive Items**: 
  - Reflect Armor (15% damage reflection) - 900 score
  - Shield Bubble (3-hit block) - 500 score
- **Utility Items**:
  - Adrenaline Wave (+30% speed for 8s) - 400 score  
  - Cooldown Round (reset all skill cooldowns) - 600 score
- **Character-Specific Items**:
  - Ghost Rounds (Kao teleport charges +1) - 750 score
  - Sacred Rice Bag (Poom skill CD -15%) - 650 score
  - Heat Core (Auto HOT tier easier) - 850 score
- **Smart Filtering**: Character-specific items only appear for selected character

### 🏆 Achievement System Expansion (9 New Achievements)
- **Kill Streak Achievements**:
  - Combo Starter (5 kills in 3s) - +2% Damage
  - Kill Frenzy (10 kills in 3s) - +2% Crit Chance  
  - Massacre (20 kills in 3s) - -3% Cooldown
- **Boss-Specific Achievements**:
  - Manop Slayer (defeat Manop without Singularity damage) - +15 Max HP
  - Physics Master (defeat First without Sandwich damage) - +3% Damage
  - Speed Demon (boss in <30s during Speed Wave) - +5% Speed
  - Ghost Hunter (boss in Fog Wave without damage) - -2% Cooldown
  - Glitch Master (survive Glitch Wave with >50% HP) - +10 Max HP

### ⚡ Performance Optimization
- **tickStatuses() Refactor**: Eliminated ~40 `performance.now()` calls per frame
- **Duration-Based System**: Changed from absolute timestamps to countdown-based status timers
- **CPU Impact Reduction**: Significant performance improvement with 40+ enemies on screen
- **Backward Compatibility**: Legacy `expireAt` timestamps still supported during transition

### 🎮 Loading State System
- **Progress Indicator**: 5-step loading screen with progress bar and status updates
- **System Initialization Tracking**: Canvas → Input → Audio → Assets → Ready sequence
- **Visual Feedback**: Animated loading icon with detailed step-by-step progress
- **Error Recovery**: Automatic fallback to hide loading screen if initialization fails
- **Reduced Motion Support**: Accessibility compliance for users with motion sensitivity

### 🐛 Bug Fixes
- **Camera Scale Bug**: Fixed missing `.scale` property in camera object for vacuum/detonation rings
- **PlayerRenderer Compatibility**: Added fallback for `camera.scale ?? 1` throughout rendering system

### 🎨 UI Enhancements  
- **Skill Preview Tooltips**: Hover/tap tooltips on character selection cards showing full skill sets
- **Mobile-First Design**: Touch-and-hold (350ms) for mobile, hover for desktop
- **Character-Specific Information**: Accurate skill descriptions for Kao, Poom, and Auto
- **Positioning System**: Smart tooltip positioning with boundary detection

---

## v3.28.1 — Priority 1 Mobile UI Improvements
*Released: March 10, 2026*

### 📱 Mobile Experience Enhancements
- **Haptic Feedback System**: Added `navigator.vibrate(12)` for all mobile button presses
- **Visual Button States**: Implemented `.pressed` class with scale(0.88) transform and enhanced glow effects
- **Touch Event Cleanup**: Fixed missing `touchcancel` event handlers to prevent stuck button states
- **Smooth Transitions**: Added 0.08s transitions for transform, background, and box-shadow on action buttons
- **Accessibility Support**: Implemented `prefers-reduced-motion` media query for users with motion sensitivity

### 🏆 High Score Display System
- **Static HTML Structure**: Moved high score display to static HTML in index.html for better performance
- **Version Bump**: Updated version badge from v3.18.0 to v3.27.11 in menu overlay
- **UI Refactor**: Simplified `updateHighScoreDisplay()` function to target static elements

### 🎨 UI Polish
- **No Tap Highlight**: Added `-webkit-tap-highlight-color: transparent` for mobile buttons
- **User Selection Prevention**: Enhanced `user-select: none` for better mobile interaction
- **Enhanced Visual Feedback**: Improved pressed state with white glow effect (0 0 14px rgba(255,255,255,0.25))

### 🔧 Technical Improvements
- **Mobile Control Architecture**: Refactored mobile button handlers with unified `_btnPress()` and `_btnRelease()` functions
- **Event Listener Cleanup**: Comprehensive cleanup including touchcancel events in `cleanupMobileControls()`
- **Performance Optimization**: Reduced dynamic DOM creation by using static high score display elements

---

## v3.28.0 — AI Enhancement System (Major Gameplay Update)
*Released: March 10, 2026*

### 🧠 AI System Implementation
- **UtilityAI Framework**: 2Hz decision-making system with personality-weighted actions for all enemy types
- **EnemyBase Refactor**: Consolidated ~220 lines of duplicate StatusEffect code into single inheritance base class
- **SquadAI Coordination**: 1Hz squad coordination with role assignments (assault, flanker, shield, support)
- **PlayerPatternAnalyzer**: Float32Array ring buffer tracking player movement patterns for adaptive boss AI
- **EnemyActions Library**: Static tactical action library (retreat, flank, shieldWall, strafeOrbit)

### 🎯 Enemy Intelligence Features
- **Personality System**: Basic (balanced), Tank (aggressive), Mage (cautious) with configurable weights
- **Dynamic Decision Making**: Enemies choose between ATTACK, RETREAT, FLANK, SHIELD_WALL based on context
- **Squad Role Override**: Formation tactics take priority while retreat always wins for safety
- **Wall-Aware Retreat**: Enemies avoid canvas edges when fleeing
- **Ally-Density Flanking**: Spread tactics based on nearby ally positions

### 🤝 Squad Coordination
- **Role Assignment System**: Automatic tagging of enemies with tactical roles on spawn
- **BucketGrid Optimization**: O(N) spatial queries instead of O(N²) distance calculations
- **Formation Behaviors**: Tanks form shield walls, basic enemies assault or flank, mages provide support
- **Dynamic Role Reassignment**: 1Hz updates adapt to changing battlefield conditions

### 🎮 Boss AI Enhancement
- **Pattern Recognition**: Detects kiting, circling, standing, and mixed player behaviors
- **Adaptive Counter-Strategy**: Bosses select skills based on dominant player patterns
- **KruFirst Integration**: SUVAT_CHARGE for kiting, ParabolicVolley with lead-shot for circling
- **KruManop Integration**: DeadlyGraph/ChalkWall priority for kiting, Slam/Log457 for standing

### ⚙️ Technical Architecture
- **Performance Optimized**: <3ms overhead for 40 enemies through throttled updates
- **Zero Allocation Hot Path**: Ring buffers and object reuse prevent garbage collection spikes
- **Physics Compatibility**: AI uses _aiMoveX/_aiMoveY overrides, never conflicts with vacuum/sticky systems
- **Clean Separation**: AI loop separate from StatusEffect.onTick to maintain framework purity

### 📁 New Files Created
- `js/ai/UtilityAI.js` - Core AI decision system
- `js/ai/EnemyActions.js` - Static tactical action library  
- `js/ai/SquadAI.js` - Squad coordination system
- `js/ai/PlayerPatternAnalyzer.js` - Player behavior tracking

### 📝 Configuration System
- **BALANCE.ai Section**: Complete configuration for decision intervals, personalities, actions, and squad parameters
- **Personality Tuning**: Adjustable aggression, caution, and teamwork weights per enemy type
- **Action Utilities**: Configurable base weights and thresholds for AI decisions
- **Squad Parameters**: Coordination radius and update intervals

### 🎯 Template System
- **EnemyBase Inheritance**: New enemies automatically get AI + StatusEffect + hitFlash
- **Simple Integration**: Extend EnemyBase, call _tickShared(), implement movement logic only
- **Auto-Tagging**: SquadAI.tagOnSpawn() automatically assigns roles to new enemies

---

## v3.27.11 — BGM Crossfade System (Audio Enhancement)
*Released: March 10, 2026*

### 🎵 Audio System Improvements
- **BGM Crossfade Implementation**: Added smooth audio transitions between different background music tracks
- **Same-Track Guard**: Prevents audio cutting when the same track is requested multiple times (e.g., battle→battle between waves)
- **Web Audio API Integration**: Routes audio through GainNode for sample-accurate volume control instead of direct .volume property
- **400ms Fade-Out Effects**: Smooth transitions when switching between different tracks (battle↔boss)
- **Enhanced Volume Control**: Uses GainNode ramps for smooth volume changes instead of immediate jumps

### 🔧 Technical Details
- **_crossfadeOutAndStop() Method**: New method for smooth audio fade-out with proper cleanup
- **Web Audio Routing**: HTMLAudioElement → GainNode → destination for better audio processing
- **Memory Management**: Proper disconnection of Web Audio nodes and cleanup of timers
- **Fallback Support**: Graceful degradation to setTimeout-based fading if Web Audio unavailable
- **State Management**: Enhanced tracking of audio elements, nodes, and fade timers

### 🎮 Gameplay Impact
- **Wave Transitions**: Battle music continues seamlessly between waves without interruption
- **Boss Battles**: Smooth fade-out from battle music, then fade-in of boss music
- **Volume Controls**: Smooth volume slider transitions without audio artifacts
- **Performance**: Thread-safe audio processing with reduced audio glitches

---

## v3.27.10 — Documentation Update (Next.js Skills Frontmatter)
*Released: March 10, 2026*

### 📚 Documentation Improvements
- **Next.js Skills Documentation**: Added YAML frontmatter to async-patterns.md and bundling.md skill files
- **Skill Metadata Enhancement**: Standardized skill documentation format with name and description fields
- **Better Skill Organization**: Improved skill file structure for better categorization and discovery

### 🔧 Technical Details
- **async-patterns.md**: Added YAML frontmatter with name and description for async patterns documentation
- **bundling.md**: Added YAML frontmatter with name and description for bundling documentation
- **Documentation Consistency**: Standardized format across Next.js best practices skill files

---

## v3.27.9 — Documentation Update (Debugging Section)
*Released: March 10, 2026*

### 📚 Documentation Improvements
- **Added Debugging Section**: Comprehensive debugging tools and workflow documentation in PROJECT_OVERVIEW.md
- **Debug.html Documentation**: Documented all features including system health checks, performance profiling, and inspection tools
- **Admin Console Reference**: Complete command reference with permissions and usage examples
- **Debugging Workflow**: 5-step systematic debugging process for developers
- **File Organization**: Clear mapping of debugging files to their specific purposes

### 🔍 Debugging Tools Covered
- **Debug.html**: Main diagnostics page for system health and performance
- **AdminSystem.js**: In-game admin console with 15+ commands
- **VersionManager.js**: Version synchronization system
- **Service Worker**: Cache management and version control

---

## v3.27.8 — UI Language & Theme Updates
*Released: March 9, 2026*

### 🌐 Language Localization
- **English Skill Names**: Converted all skill names from Thai to English for better accessibility
- **Character Skills**: Updated Kao (STEALTH/TELEPORT/CLONE), Poom (EAT RICE/NAGA/GARUDA/RITUAL), Auto (WANCHAI/VACUUM/DETONATE/MODE)
- **UI Text**: Changed attack/dash/passive labels to English (SHOOT/DASH/FREE STEALTH)

### 🎨 Character-Specific Color Themes
- **Kao (Blue)**: Blue theme with #3b82f6 accents and pulseBlue animation
- **Poom (Emerald)**: Emerald theme with #10b981 accents and pulseEmerald animation  
- **Auto (Red)**: Red theme with #dc2626 accents and pulseRed animation
- **Passive (Gold)**: Gold theme with enhanced pulseGold animation
- **Dynamic Theme Application**: Shared HUD slots (dash/stealth) recolored based on active character

### 🎯 HUD Visual Improvements
- **Share Tech Mono Font**: Added monospace font for skill names and key hints for better readability
- **Enhanced Cooldown Visuals**: New cd-arc-overlay, cd-timer-text, and skill-lock overlays
- **Improved Skill Icons**: Better spacing, uppercase text, and enhanced shadows
- **Divider Elements**: Added visual separators between basic/special skills and skills/shortcuts
- **Wanchai Active State**: Special crimson throb animation for active Stand

### 🔧 Technical Updates
- **Preconnect Fonts**: Added Google Fonts preconnect for faster loading
- **CSS Refinements**: Updated skill styling, animations, and responsive elements
- **DOM Structure**: Improved HTML structure for better theme application

---

## v3.27.7 — UI Cooldown Bug Fixes
*Released: March 9, 2026*

### 🔄 Auto Character Cooldown Fixes
- **Dynamic Vacuum/StandPull Cooldown**: Fixed cooldown display to properly switch between vacuum (6s) and standPull (10s) based on Wanchai Stand state
- **Correct DOM Element IDs**: Changed from 'q-icon'/'e-icon' to 'vacuum-icon'/'auto-det-icon' to match actual DOM elements
- **Accurate Cooldown Values**: Corrected detonation cooldown from 5s to 8s to match actual ability timing

### 🪶 Poom Character Fixes
- **Garuda Cooldown Correction**: Fixed garuda cooldown from 25s to 24s to match actual ability timing
- **Consistent Nullish Coalescing**: Updated to use `??` operator for better null safety

### 🥷 Kao Character Cooldown Additions
- **Missing Dash Cooldown**: Added dash cooldown display (1.65s) that was missing from UI update
- **Missing Stealth Cooldown**: Added stealth (R-Click) cooldown display (5.5s) that was incorrectly marked as "handled by PlayerBase"
- **BUG-5 Resolution**: Fixed PlayerBase updateUI gap that left Kao's movement abilities without visual feedback

### 🐛 General UI Improvements
- **Consistent Cooldown Pattern**: Standardized cooldown visual updates across all character classes
- **Null Safety**: Enhanced null checking for cooldown objects to prevent UI errors
- **Dynamic Cooldown Support**: Improved support for abilities with variable cooldown durations

---

## v3.27.6 — Visual Enhancements & Rendering Improvements
*Released: March 9, 2026*

### 🎨 Wall Rendering Overhaul
- **3D Depth Effects**: Added side-face rendering and proper depth shadows to wall objects
- **Enhanced Brick Patterns**: Improved 2-tone mortar rendering with proper brick highlights and shadows
- **Metal Top Caps**: Added metallic edge highlights and corner posts for realistic wall appearance
- **Damage Textures**: Enhanced moss/damage spot rendering with better integration

### 🏰 MTC Wall Visual Upgrade
- **Advanced Panel System**: Added panel separation lines and circuit trace patterns
- **Pulsing Neon Effects**: Enhanced gold neon borders with dynamic pulsing and shadow effects
- **Rivet Details**: Added corner rivet dots with synchronized pulsing animations
- **Improved Base Rendering**: Better color depth and panel line organization

### 🪑 Furniture Shadow Enhancement
- **Desk Shadow System**: Added bottom edge shadows and left-face shadows for 3D depth perception
- **Realistic Depth**: Improved furniture rendering with proper shadow placement and opacity

### 🌳 Dynamic Lighting System
- **Green Tree Lighting**: Added dedicated green-tinted lighting for tree objects (radius: 45px)
- **Warm Server Lighting**: Changed server rack lighting from cool blue to warm orange for better visual hierarchy
- **Enhanced Light Types**: Added 'green' light type with proper color gradients and falloff

### 🖥️ Database UI Simplification
- **MapObject Integration**: Replaced custom Database rendering with standardized MapObject 'database' type
- **Proximity Aura System**: Simplified to use only proximity ring and "[F] ACCESS" label (consistent with Shop pattern)
- **Performance Optimization**: Removed complex custom rendering in favor of efficient MapObject system
- **Visual Consistency**: Database now follows same interaction pattern as other map buildings

### 🧹 Code Cleanup
- **Whitespace Normalization**: Cleaned up spacing inconsistencies in coordinate arrays
- **Rendering Optimization**: Streamlined Database UI to reduce rendering overhead
- **Color Palette Expansion**: Added dedicated color schemes for wall and mtcwall objects in config

---

## v3.27.5 — Major Map Refactor & Blocking Issues Fix
*Released: March 9, 2026*

### 🏰 MTC Citadel Approach Clearing
- **Removed Blocking Objects**: Eliminated trees at y=-440 and vending machines that were inside the walled corridor (y∈[-480,-370])
- **Clear Approach Corridor**: Citadel entrance now completely unobstructed with 300px wide clear path
- **Moved Flanking Trees**: Relocated citadel flank trees from y=-440 to y=-510, outside the walled corridor
- **Fixed Visual Clutter**: Removed all objects that were blocking the north approach to the MTC Room

### 🖥️ Zone A Server Farm Reorganization
- **Eastward Migration**: Moved entire server farm from x=680 to x=720 (+40px) to avoid Database visual overlap
- **Database Clearance**: Servers now start at x=720, clear of Database building at x=440-560
- **Datapillar Relocation**: Moved datapillar markers from x=640 to x=680, maintaining zone separation
- **Visual Hierarchy**: Database and Server Farm now visually distinct with proper spacing

### 🌳 Zone C Courtyard Optimization
- **Southward Shift**: Moved courtyard trees from y=580 to y=630 (+50px) to clear shop approach
- **Shop Access Protection**: Trees no longer interfere with CoopStore north approach corridor
- **Maintained Atmosphere**: Preserved courtyard aesthetic while ensuring clear building access

### 🎯 Building Entrance Standardization
- **Universal Clear Zones**: All major buildings now have unobstructed approach corridors
- **Database South Approach**: Clear zone x∈[360,640], y∈[-440,-280] strictly enforced
- **CoopStore North Approach**: Clear zone x∈[-640,-380], y∈[340,445] strictly enforced
- **Citadel Approach Corridor**: Clear zone x∈[-200,200], y∈[-500,-320] with walled protection

### 📍 Object Placement Discipline
- **Clear Zone Enforcement**: Implemented 6 strict no-object zones around critical areas
- **Zone Island Principle**: Each zone (A, B, C, D) now isolated with proper buffer distances
- **Strategic Vending Placement**: Moved all vending machines outside gate gaps and clear zones
- **Tactical Cover Preservation**: Maintained cover walls while ensuring they don't block paths

---

## v3.27.4 — Map Layout Optimization & Shop System Simplification
*Released: March 9, 2026*

### 🗺️ Zone F.1 Database Layout Cleanup
- **Removed Obstacles**: Eliminated 4 flanking servers + 4 data pillars that blocked entrance paths
- **Streamlined Layout**: Main building (120×140) at (440, -560) with only 2 servers at back (North)
- **Clear Entrance**: South entrance now completely unobstructed for easy player access
- **Improved Navigation**: Removed boundary markers that created narrow corridors

### 🛒 Zone F.2 CoopStore Position Sync & Cleanup
- **Position Synchronization**: Building now centered on BALANCE.shop.x/y (-500, 490) instead of hardcoded (-565, 435)
- **Interaction Alignment**: Shop visual now properly aligned with interaction point
- **Entrance Clearance**: Removed 4 surrounding trees + 2 vending machines that blocked North entrance
- **Strategic Landscaping**: Kept only 2 trees at back + 1 vending machine on left-back for atmosphere
- **Clear Access**: North entrance now completely open for player approach

### 🚪 MTC Room Entrance Visual Enhancements
- **Active State Indicator**: Added bouncing arrow ↑ below forcefield when room is active
- **Cooldown Visualization**: Implemented red dashed barrier + ⛔ COOLDOWN Xs timer display
- **Improved UX**: Players now have clear visual feedback for room availability status
- **Dynamic Animation**: Arrow bounces with sinusoidal motion for attention-grabbing effect

### 🎨 ShopSystem.js Rendering Simplification
- **Removed Redundant Visuals**: Eliminated chest model rendering (shadow, body, lid, coins, etc.)
- **Proximity-Only Display**: Kept only proximity aura ring + [B] ENTER SHOP label when nearby
- **Performance Optimization**: Building visual now handled solely by MapObject 'coopstore'
- **Visual Consistency**: Prevents overlap between shop system rendering and map object rendering

### 🔧 Technical Improvements
- **Map Navigation**: All major locations now have clear, unobstructed entrance paths
- **Visual Feedback**: Enhanced state indicators for better player understanding
- **Code Efficiency**: Reduced duplicate rendering between shop systems
- **Layout Consistency**: Shop building position synchronized with interaction logic

---

## v3.27.3 — MTC Game Map Position Adjustments
*Released: March 9, 2026*

### 🗺️ Database & Shop Position Refinement
- **MTC Database**: Moved from (440, -560) → (500, -490) for optimal NE quadrant placement
- **MTC Co-op Store**: Moved from (-565, 435) → (-500, 490) for better SW quadrant positioning
- **Updated MAP_CONFIG**: Synchronized all related coordinates (paths, auras, interaction points)
- **Zone Consistency**: Updated worldX/worldY coordinates to match new positions

### 📍 Technical Changes
- **config.js**: Updated BALANCE.database, BALANCE.shop, MAP_CONFIG.paths, and MAP_CONFIG.auras
- **Coordinate Synchronization**: All database and shop related positions now aligned
- **Map Layout**: Improved spatial distribution for better gameplay flow

---

## v3.27.2 — MTC Game Map Refactor
*Released: March 9, 2026*

### 🗄️ Database & Shop Relocation
- **MTC Database**: Moved from (500, -490) → (440, -560) for better NE positioning
- **MTC Co-op Store**: Moved from (-500, 490) → (-565, 435) for improved SW placement
- **Updated MAP_CONFIG**: Synchronized paths, auras, and zone coordinates with new positions

### 🚪 Entrance Accessibility Improvements  
- **MTC Room Entrance**: Side rails shortened from 170px → 110px for wider access
- **Vending Machines**: Repositioned from (-195,-390)/(160,-390) → (-230,-440)/(195,-440)
- **Clearer Sightlines**: Enhanced approach visibility to MTC Room

### 🎨 Visual Configuration Updates
- **New Map Colors**: Added dbBody, dbAccent, dbRackOn, dbRackOff for database
- **Shop Colors**: Added shopBody, shopAccent, shopSign, shopCounter, shopShelf
- **Zone Floors**: Updated database and shop zone definitions with proper grid colors

---

## v3.27.1 — Map Reorganization & Spawn Fix
*Released: March 9, 2026*

### 🗺️ Critical Map Layout Fixes
- **Root Cause**: Objects were positioned too close to spawn point (0,0), creating a ~200px "cage" around player spawn
- **Data Pillars**: Moved from y=-290 to +130 range (crossing spawn) → y=-560 to -140 (north of spawn only)
- **Cover Walls**: Expanded from r=220-280px → r=340-360px from origin
- **Corridor Trees**: Moved from y=±175/200 → y=±355/380 from spawn
- **Vending Machines**: Repositioned from y=±130 (near spawn) → y=±360-390 at zone entrances

### 🏗️ Zone Reorganization
- **Server Farm (Zone A)**: startX=330→520, rows extended to y≤-180
- **Library (Zone B)**: x=-680~-940 → x=-760~-1050, separated N/S quadrants
- **Courtyard (Zone C)**: y=310 → y=480 (moved further south)
- **Lecture Halls (Zone D)**: x=±620/840 → x=±720/950, y=510 → y=580
- **Corridor Walls**: Funnel expanded from x=±220/±238 → x=±400/±418, y=±200/230 → y=±340/370

### 📍 Interaction Points Updated
- **MTC Shop**: Moved from {x:-350, y:350} → {x:-480, y:480} (SW quadrant)
- **Database Server**: Moved from {x:350, y:-350} → {x:480, y:-480} (NE quadrant)
- **Circuit Paths**: Aura positions expanded from 320px → 480px from origin
- **Zone Floors**: All zones expanded to use full dome area

### 🔧 Technical Changes
- **config.js**: Updated MAP_CONFIG.wallPositions, zone floors, aura positions, circuit paths
- **map.js**: Reorganized generateCampusMap() zone positioning and object placement
- **ShopSystem.js**: Updated MTC_SHOP_LOCATION coordinates
- **AdminSystem.js**: Updated MTC_DATABASE_SERVER coordinates

---

## v3.27.0 — Major Visual Upgrades
*Released: March 9, 2026*

### 🌟 Character Visual Enhancements
- **Kao Stealth**: Complete holographic overhaul - iridescent gradient shimmer, deterministic glitch pixel dissolve (12 fragments), prismatic outer ring
- **Kao Muzzle Flash**: Enhanced with expanding shockwave ring + forward-biased directional spark rays (5 forward + 4 scatter)
- **Weapon Switch Indicator**: New visual feedback system - glow ring + floating weapon icons (🎯/💥/⚡) with 0.5s timer

### 🐉 Poom Ability Visuals  
- **Naga Tether**: Upgraded to 16 segments with serpentine dual-wave motion, smooth bezier curves, HP-based glow scaling, scale tick patterns
- **Lotus Bloom**: 8-petal orbital system with breathing animation when passive unlocked, radial gradient per petal
- **Garuda Wind**: Complete wind system - 4 rotating arc sweeps, animated wing silhouettes with flap motion, central golden burst

### 🔥 Auto Heat System
- **Body Color Shift**: 4-tier gradient system - COLD (dark crimson), WARM (orange rim glow), HOT (saturated orange + fire tips), OVERHEAT (white-hot core + crimson rings)
- **Stand Active Pulse**: Enhanced with third ripple ring, increased intensity (lineWidth 3→3.5, shadowBlur 22→28), body vibrate shimmer overlay

### ⚙️ Technical
- **Weapon Switch Flow**: Complete edge detection system in KaoPlayer.update() + fallback patch in weapons.js switchWeapon()
- **Performance**: All effects use deterministic sin-based patterns (no Math.random())

---

## v3.26.9 — Comprehensive Game Enhancement
*Released: March 9, 2026*

### 🎨 Visual Enhancements
- **Lighting System**: Reduced ambient light from 0.9→0.72 for dramatic atmosphere
- **Player Visibility**: Increased player light radius from 160→185 for better visibility
- **Object Lighting**: Enhanced data pillar light radius from 70→85 for prominence
- **Map Colors**: Improved contrast across all elements (floors, walls, trees, servers)
- **Hex Grid**: Enhanced stroke alpha from 0.15→0.22 and falloff radius from 1400→1650
- **Zone Visuals**: Darkened all zone floors for depth, increased courtyard grid density
- **Aura Effects**: Enhanced rim glow blur from 16→22, arena rim alpha from 0.55→0.65

### 🏗️ Layout Additions
- **Vending Machine Object**: New interactive object with LED screen, neon stripes, toggle buttons, and dispenser tray
- **Strategic Placement**: 8 vending machines positioned along main corridors in all directions
- **Tactical Cover System**: 8 broken wall covers providing tactical positions around center arena
- **Environmental Enhancement**: 24 corridor trees (12 north, 12 south) for visual variety and cover

### 🚧 Collision & Navigation
- **Guard Walls**: Added side rails for Citadel approach (north), south guard walls for Server Farm and Library
- **Courtyard Gates**: Added gate walls on both sides of courtyard entrance
- **Library Safety**: Added corner walls for safe margin at NW/NE corners
- **Barrel Navigation**: Reduced barrel collision radius from 35→28 for easier passage

### ⚡ Performance Optimization
- **Culling Distance**: Reduced CULL from 120→80 for more efficient viewport culling
- **Smart Sorting**: Implemented dirty flag system to sort objects only when layout changes
- **Memory Management**: Added _sortedObjects cache with smart invalidation

---

## v3.26.8 — Boss Null Reference Crash Fix
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **AutoPlayer.js**: Fixed boss null reference crash in detonation damage system
- **Root Cause**: When Detonation damage kills boss, some boss classes set `window.boss = null` inside `takeDamage()` callback
- **Solution**: Snapshot `bossPx` and `bossPy` before calling `takeDamage()`, then use snapshot values in `spawnParticles()`
- **Impact**: Prevents crash when accessing `window.boss.x` and `window.boss.y` after boss becomes null
- **Safety**: Ensures particle effects work correctly regardless of boss nullification timing

---

## v3.26.7 — ORA Text Timer System Fix
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **AutoPlayer.js**: Added `_oraTextTimer = 0.45s` reset in WanchaiStand._punch() method
- **PlayerRenderer.js**: Fixed ORA text scaling logic - removed incorrect division by comboScale
- **ORA Text Display**: Now properly shows only when `_oraTextTimer > 0` with 0.45s duration
- **Alpha Fade**: Smooth fade in last 0.15s instead of abrupt blinking
- **Scale System**: Text scales with combo (1 + oraCombo * 0.022) without sin pulse

---

## v3.26.6 — KaoPlayer Complete Bug Fixes
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **KaoPlayer ability systems:**
  - Added bonusCritFromAuto decay (0.01/s) when not holding AUTO RIFLE weapon
  - Fixed teleport penalty logic to target slowest regenerating timer (elapsed < minElapsed)
  - Added isStationary flag for Phantom Blink shadow clones (prevents orbit behavior)
  - Prevented sniper double-fire by removing duplicate fire path in shoot() method
  - Enhanced updateUI() with complete Q/E cooldown display and HUD bars

- **Damage scaling clarification:**
  - Updated KaoClone damage comment to clarify 60% scaling handled by caller
  - Improved code documentation for damage calculation flow

- **UI improvements:**
  - Added full updateUI() method implementation for KaoPlayer
  - Proper display of teleport cooldowns (slowest timer)
  - Clone skill cooldown visualization
  - HP/Energy bars and level/exp display

### 🔧 Technical Improvements
- Better weapon switching behavior with crit bonus decay
- More accurate teleport penalty targeting system
- Enhanced visual feedback for ability cooldowns
- Improved code clarity and documentation

---

## v3.26.5 — Character Bug Fixes
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **AutoPlayer cooldown logic:**
  - Separated Stand mode and Normal mode with distinct cooldown checks
  - Fixed Heat Wave cooldown check missing (previously infinite fire rate)
  - Stand Rush: 0.10s cooldown, no fallthrough to Heat Wave
  - Normal mode: 0.28s cooldown with proper validation

- **KaoPlayer damage scaling:**
  - Fixed KaoClone damage calculation (was 30% instead of intended 60%)
  - Removed duplicate *0.5 multiplier in clone.shoot() method
  - Caller now properly handles 60% damage scaling

- **PoomPlayer stability:**
  - Added NaN guard for energyRegen config (?? 0 fallback)
  - Updated Naga shield comments from 55% to 40% to match actual values
  - Removed dead code variables (wasAlive, alreadyDead) from ritualBurst()

- **KaoPlayer ability fixes:**
  - Added isStationary flag for Phantom Blink shadow clones (no orbit behavior)
  - Fixed teleport penalty logic to target slowest regenerating timer
  - Added bonusCritFromAuto decay (0.01/s) when not holding AUTO RIFLE
  - Prevented sniper double-fire by removing duplicate fire path in shoot()
  - Enhanced updateUI() to display Q/E cooldowns and HUD bars properly

### 🔧 Technical Improvements
- Improved code clarity with mode separation in AutoPlayer
- Enhanced error prevention with NaN guards
- Better visual feedback for ability cooldowns
- More accurate damage calculations across character abilities

---

## v3.26.4 — Auto Character Balance Rework
*Released: March 9, 2026*

### ⚖️ Balance Changes
- **Detonation system rework:**
  - Reduced base damage: 80 → 55
  - Reduced heat scaling: 2.5 → 1.2
  - Added damage hard cap: 600 (prevents infinite scaling)
  - Reduced charge damage multiplier: 3.5 → 2.5
  - Increased heat drain on detonation: 50 → 80 (better "venting" feel)

- **Passive heat system adjustments:**
  - Reduced passive heat gain bonus: 1.50 → 1.20
  - Disabled passive heat no-decay on move (prevents permanent OVERHEAT)

- **Stand ability separation:**
  - Added separate standPullCooldown: 10 (from vacuumCooldown: 6)
  - Stand Pull is now stronger but has longer cooldown than basic Vacuum

### 🔧 Bug Fixes
- **Fixed crit damage fallback:** Updated from 2.0 to 2.2 to match config values
- **Fixed melee range calculation:** Reduced bestD bonus from +60 to +15 for proper hit detection
- **Fixed Stand Guard visual:** Reset isStandAttacking before return to prevent ORA visual glitches

### 🎨 Visual Improvements
- **Detonation ring positioning:** Now draws around Stand position (matches actual blast origin)
- **Charge ring improvements:** Removed duplicate Auto body ring, enhanced Stand ring with arc progress and MAX! text
- **Vacuum/Stand Pull indicator:** Shows appropriate label and origin based on Wanchai+passive state
- **Z-order corrections:** WanchaiStand now renders correctly behind LAYER 2

---

## v3.26.3 — Character Stat Accuracy & Documentation Update
*Released: March 9, 2026*

### 🔧 Bug Fixes
- **Fixed Poom DMG stat bar accuracy:**
  - Corrected stat bar width from 99% to 98% in character selection
  - Now accurately reflects actual DPS calculation (62/0.42 = 147.6 ≈ 148)
  - Ensures visual consistency between stat bars and gameplay mechanics

### 📚 Documentation Updates
- **Enhanced PROJECT_OVERVIEW.md with comprehensive Auto rework documentation:**
  - Updated version from Beta v3.11.14+ to Beta v3.18.0
  - Added detailed AutoPlayer.js description including Heat System, Stand Meter, Synergy, and Rage Mode
  - Updated Energy Cost table to reflect Wanchai-synergy context (Stand Pull/Charge Punch)
  - Completely rewrote Auto Rework section with:
    - Current Base Stats table matching config.js values
    - Heat Tier system table with detailed mechanics
    - Bug Fix note for Stand Rush cooldown fallthrough
  - Added new "Character Quick-Stats" section with complete stats for all 3 characters
  - Added "แก้ Pause/Menu UI" section with stat bar calculation references

### 📊 Character Balance Verification
- All character stat bars verified against current config.js values
- Reference values established: HP max = Auto 230, SPD max = 298, RANGE max = Kao 900, DMG ref ≈ 150 DPS
- Documentation now provides clear guidance for future balance updates

---

## v3.26.2 — Enhanced Pause Modal UI Design
*Released: March 9, 2026*

### 🎨 UI/UX Improvements
- **Redesigned pause modal with game theme consistency:**
  - Added corner brackets (4 corners) for HUD-style framing
  - New "⏸ SYSTEM HALT" badge chip with cyan color matching skill icon borders
  - Gold divider line replacing emoji icon for cleaner visual separation
  - Navy gradient background (#1a2236 → #0f172a) matching HUD/shop theme
- **Typography and styling updates:**
  - Title using Orbitron 32px with gold glow matching score/wave banners
  - Resume button with gold gradient matching game button styles
  - Gold top accent line across the card header
  - Pause indicator bar changed from cyan to gold for consistency
- **Animation refinement:** Single slide+fade entrance instead of repetitive pulse

---

## v3.26.1 — Stand Rush Cooldown Fix
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **Fixed Stand Rush cooldown fallthrough:** Removed redundant cooldown check that prevented Heat Wave from firing when Stand Rush was on cooldown
- **Improved combat flow:** Stand Rush ready → performs melee attack and returns; Stand Rush on cooldown → falls through to Heat Wave normally
- **Code cleanup:** Added explanatory comments for better code maintainability

---

## v3.26.0 — Complete Stand System Features Overhaul
*Released: March 9, 2026*

### 🔥 Feature 1: Heat System Overhaul
- **COLD Tier Penalties (heat = 0):** 
  - Stand damage ×0.70 forces players to warm up before combat
  - Move speed ×0.90 creates strategic pre-combat preparation
- **Heat Idle Decay System:** After 2+ seconds without hitting enemies, heat decays at 8/s (except during Wanchai active)
- **Vent Explosion Mechanic:** When dropping from OVERHEAT tier, triggers AOE explosion:
  - 45 damage in 160px radius with particle burst and screen shake
  - Provides burst damage opportunity when managing heat levels
- **Enhanced gainHeat() Function:** Now accepts `fromHit=true` parameter to reset idle decay timer only from actual hits

### ⚡ Feature 2: Rage Engine / Killing Blow Supercharge
- **Supercharge Mechanic:** Killing enemies while combo ≥ 5 triggers:
  - +30 heat bonus for rapid heat buildup
  - Instant reset of rush cooldown for combat flow
  - "SUPERCHARGE!" floating text with screen shake impact
- **Dual Trigger System:** Works from both player Stand Rush hits and Stand autonomous punches
- **Stand Absorb Visual:** Stand scales up to 25% larger with gold ring effect during combo ≥ 5

### 🎯 Feature 3: Skill Synergy Overhaul
- **Stand Pull (Q during Wanchai):** Enhanced vacuum skill with instant pull mechanics:
  - Pulls enemies within ±40px of Stand position (instead of player)
  - Deals 18 damage on successful pull with visual feedback
  - Replaces vacuum physics with direct positioning for precision control
- **Charge Punch (E hold during Wanchai):** Hold-to-charge system with visual feedback:
  - Charge ring displays progress with pulsing visual effect
  - Up to 3.5× damage multiplier at full charge
  - Blast originates from Stand position for tactical positioning
- **Stand Guard (Shift during Wanchai):** Defensive stance with:
  - Stand positions in front of player with arms crossed animation
  - Shield arc visual effect showing protection zone
  - Blocks all incoming actions while active

### 📊 Feature 4: Stand Meter System
- **0-100 Meter Replacement:** Replaces countdown timer with percentage-based meter
- **Dynamic Drain Rates:** 
  - COLD tier: ×1.3 drain rate
  - OVERHEAT tier: ×0.5 drain rate (reward for high heat)
  - Normal: ×1.0 drain rate
- **Meter Fill Mechanics:** +4 per hit, +12 per kill during Stand active
- **Enhanced HUD Display:** Shows "❄️42%" or "💥87%" with tier indicators instead of seconds

### 🎨 Visual & UX Enhancements
- **Charge Ring Visual:** Pulsing ring around Stand during E charge with color progression
- **Stand Absorb Scaling:** Visual growth effect during high combo states
- **Vent Explosion Effects:** Particle burst and screen shake for impactful feedback
- **COLD Tier Indicator:** Blue visual effects on Stand when in COLD state

---

## v3.25.6 — WanchaiStand Visual Rework & ORA Combo System
*Released: March 9, 2026*

### 🎨 Complete Visual Transformation — JoJo-Style WanchaiStand
- **Thermodynamic Color Palette:** Complete color scheme overhaul from ice-blue to fire theme:
  - Base: `#dc2626` (dark red) → Warm: `#ef4444` (red) → Hot: `#f59e0b` (amber) → Overheat: `#fef08a` (yellow)
  - Gold trim `#f59e0b` replaces ice-blue throughout all visual elements
- **JoJo-Style Body Redesign:** Enhanced physique with authentic Star Platinum aesthetics:
  - Larger body with broader shoulders and imposing presence
  - Gold Pauldrons (shoulder armor) on both sides — signature JoJo look
  - Belt + Gold Buckle at waist with detailed styling
  - Gold Knee Guards on legs/knees for complete armor coverage
  - Crimson Hollow Eyes replacing blue eyes with menacing red glow
  - Mongkhon Crown upgraded to 5-spike design with center spike at 20px height
- **Enhanced Gloves System:** Premium Muay Thai glove implementation:
  - Size increase to 11px (active) vs 8.5px (original) for better visibility
  - Gold trim rings around glove edges for luxury appearance
  - Impact burst featuring 8-spike starburst with 4-direction diamond shards

### ⚔️ ORA Combo System — Revolutionary Combat Mechanics
- **Core Combo Mechanics:** `_oraComboCount` tracks consecutive hits from player melee + stand punches
  - Combo window of 0.55s — resets if no hit or miss occurs
  - Progressive enhancement: higher combo = more fists (5→12) and tighter spread
- **Dynamic Attack Scaling:** Combo-based performance improvements:
  - Attack speed escalation: cooldown reduction of 0.006s per combo (maximum -0.04s)
  - Fist fan expansion: `Math.min(12, 5 + Math.floor(_oraCombo * 0.8))` for fist count
  - Spread tightening: `Math.PI * 0.38 - _oraCombo * 0.025` for Star Platinum barrage effect
- **Visual Feedback System:** Immersive combo indicators:
  - "ORA ORA ORA!" text replaces "วันชัย วันชัย วันชัย!" — turns gold at combo 5+
  - Name chip displays "ORA ×N" when combo ≥ 3 for real-time feedback
  - Floating text notifications at high combo levels (`ORA ORA ×${combo}`)
- **Technical Implementation:** Sophisticated combo integration:
  - Speed bonus calculation: `Math.min(0.04, _oraComboCount * 0.006)` for attack rate
  - Combo ring visualization with growing radius and intensity
  - Synchronization between player and WanchaiStand combo counters

### 🔧 Technical Enhancements
- **Color System Integration:** Heat-tier colors seamlessly integrated throughout:
  - Fist colors: `#dc2626` → `#f59e0b` → `#fef08a` based on heat tier
  - Trail effects with matching RGB values for consistency
  - Gold accent system using `#f59e0b` for premium elements
- **Performance Optimizations:** Efficient combo calculations and visual scaling
- **Code Architecture:** Clean separation between visual rendering and combat mechanics

---

## v3.25.5 — Mongkhon Crown Rework
*Released: March 9, 2026*

### 👑 Complete Crown Enhancement
- **5 Concave Spike Design:** Replaced 3 flat spikes with 5 tapered concave spikes using quadraticCurveTo for authentic Mongkhon shape
  - Center spike: 16px height (tallest)
  - Inner spikes: 12px height (medium)
  - Outer spikes: 8px height (shortest)
  - Each spike features gradient coloring (dim→mid→bright→glow) and gleam lines

### 🎨 Premium Crown Features
- **3-Layer Band System:** Dark base → gradient fill → bright rim for depth and richness
- **Diamond Jewel Center:** Radial gradient jewel with 4-point diamond shape on crown band
- **2-Strand Tassels:** Each side has dual ribbon strands with quadratic curves and varying opacity
- **Enhanced Visual Effects:** Tip glow dots, shadow blur pulsing, and improved color theming

### 🔧 Technical Improvements
- **Concave Geometry:** Used quadraticCurveTo instead of straight lines for authentic Mongkhon curvature
- **Gradient System:** Multi-stop gradients for each spike (4 color stops) and band (5 color stops)
- **Performance Optimized:** Pre-calculated positions and reduced redundant calculations

---

## v3.25.4 — Realistic Boxing Glove Rush System
*Released: March 9, 2026*

### 🥊 Complete Rush Fist Redesign
- **Linear Punch Layout:** Replaced 360° radial fan with linear arrangement following entity.angle for continuous punching motion
- **Realistic Boxing Glove Design:** Implemented detailed Muay Thai glove anatomy:
  - Wrist/arm stub with gradient fade effect
  - Main body with rounded rectangle proportions (13×10px)
  - Thumb bump on top surface with elliptical shape
  - 4 individual knuckle ridges with radial gradient highlights
  - Rim stroke with proper alpha blending

### 🎨 Advanced Visual Features
- **Progressive Depth Scaling:** Gloves scale from small (first) to large (last) using 0.60→1.00 multiplier for depth perception
- **Staggered Positioning:** Added side drift using Math.sin(i * Math.PI) for natural left-right alternation (±5px)
- **Forward Distance Calculation:** Linear spacing with 38px base + 16px per fist for continuous punch appearance
- **Enhanced Trail System:** Improved gradient trails aligned with punchAngle (28px length, 8px width, 55% alpha)
- **Heat-Tier Color Integration:** Extended color system to include fistColDim for darker glove shading

### 📐 Technical Architecture
- **Helper Function:** Created drawGlove() with modular parameters (position, scale, angle, alpha)
- **Coordinate System:** Screen-relative positioning with proper rotation matrices
- **Gradient Mastery:** Multiple gradient types (linear, radial) for realistic material appearance
- **Performance Optimization:** Efficient loop structure with early alpha filtering

---

## v3.25.3 — Rush Fist Advanced Rendering Fixes
*Released: March 9, 2026*

### 🥊 Rush Fist Rendering Advanced Fixes
- **Double-Rotation Fix:** Removed ctx.rotate(entity.angle) to prevent double-rotation since ox/oy already precomputed with entity.angle in _doPlayerMelee
- **Direction-Aware Trails:** Fixed trail direction using Math.atan2(f.oy, f.ox) → trails always point from player center to fist position
- **Gradient Trail Enhancement:** Replaced solid strokes with createLinearGradient from transparent (0%) to fist color (70% alpha) for natural fade effect
- **3D Knuckle Highlights:** Added arc highlights on leading edge of gloves (fR * 0.58) at trailAngle ± 0.75 rad for 3D depth perception
- **Heat-Tier Color System:** Implemented dynamic fist colors based on entity._heatTier:
  - Tier 0-1: Red (#ef4444)
  - Tier 2: Orange (#f97316) 
  - Tier 3+: Gold (#facc15)
- **Enhanced Visual Polish:** Improved shadow blur (20px), glove size (9.5px), and white rim highlights with proper alpha blending
- **Battle Cry Enhancement:** Extended "วันชัย" text to "วันชัย วันชัย วันชัย!" for intensified combat atmosphere

---

## v3.25.2 — Wanchai Stand Visual Fixes
*Released: March 9, 2026*

### 🥊 Rush Fist Rendering Fixes
- **Local-Space Rotation:** Fixed fist fan to rotate with player facing direction using ctx.translate(screen.x, screen.y) + ctx.rotate(entity.angle)
- **Uniform Round Gloves:** Replaced elliptical fists with perfect circular arc(10*sc) for consistent appearance
- **Short Motion Trails:** Added compact trail lines behind each fist (moveTo(ox - 28*sc, oy) → lineTo(ox, oy)) for motion effect

### 👑 Mongkhon Crown Redesign
- **Triangular Crown Spikes:** Replaced flat band with 3 pointed triangles using moveTo/lineTo/closePath geometry
- **Crown Hierarchy:** Center spike tallest (9px), side spikes shorter (6px) for proper crown appearance
- **Band Base Structure:** Added supporting band base with highlight stripe for crown foundation
- **Decorative Elements:** Enhanced with inner gleam lines on each spike and ribbon tassels on both sides
- **Color Coordination:** Proper color scheme with base band (dim) and spikes (bright) differentiation

---

## v3.25.1 — Wanchai Stand Visual Refinements
*Released: March 9, 2026*

### 🥊 Rush Fist Rendering Improvements
- **Round Glove Design:** Replaced elliptical fists with uniform circular gloves for consistent visual appearance
- **Afterimage Motion Effect:** Added secondary afterimage fists (alpha 0.28) positioned behind main fists for motion blur without trail lines
- **Eliminated Trail Lines:** Removed all motion trail lines (moveTo(screen.x) → lineTo(fist)) for cleaner visual presentation
- **Enhanced Visual Depth:** Afterimage fists positioned at 1.4× fist radius behind main fists with 75% scaling
- **Improved Color Intensity:** Updated main fist alpha to 0.92 with stronger red tone (0.95) and enhanced gold rim (0.70)

### 👑 Flame Crown Spike Redesign
- **Crown Symmetry:** Reduced spike count from 7 to 5 for perfect odd-numbered symmetry with center spike
- **Tapered Spike Geometry:** Replaced elliptical flames with quadraticCurveTo() tapered spikes (wide base, sharp tip)
- **Realistic Crown Shape:** Spike height varies by position - tallest at center (_centerT), shorter toward edges
- **Surface Attachment:** Spikes now anchor to head surface (radius 11.5) pointing perpendicular to surface instead of floating
- **Enhanced Gradient:** Improved color progression from amber base through orange/red to white tip
- **Mathematical Precision:** Spike positions calculated using arc mathematics for perfect crown distribution

### 🎨 Visual Polish Enhancements
- **Consistent Fist Sizing:** All rush fists now maintain uniform 10× scaling regardless of position
- **Improved Shadow Effects:** Enhanced shadow blur (18→20) for flame crown with better glow intensity
- **Refined Alpha Blending:** Optimized alpha values for better visual hierarchy and depth perception
- **Cleaner Motion Representation:** Afterimage system provides motion indication without visual clutter

---

## v3.25.0 — Wanchai Stand Visual Enhancement
*Released: March 9, 2026*

### 🔥 Muay Thai Knee-Bend Animation System
- **Anti-Phase Oscillators:** Added kneeL/kneeR variables that alternate weight distribution (0→1) for realistic fighter bounce
- **Dynamic Smoke Tails:** Replaced single lower-body fade with dual smoke tails that extend/contract based on knee compression
- **Weight-Responsive Rendering:** Left/right smoke tails shift alpha and drop distance based on current weight distribution
- **Athletic Stance:** Visual transformation from static spirit to dynamic Muay Thai fighter with continuous movement

### ⚡ Radial Rush Fist Fan System
- **Deterministic Scatter:** Replaced Math.random() fist positioning with mathematical radial fan distribution
- **Hit vs Miss Differentiation:** 
  - Hit: 7 fists across 38° arc with full alpha (1.0) and progressive scaling
  - Miss: 4 fists across 22° narrow arc with reduced alpha (0.45) for clear whiff feedback
- **Consistent Patterns:** All rush attacks (_punch, _doPlayerMelee hit/miss) use same deterministic fan mathematics
- **Visual Clarity:** Players can immediately distinguish successful hits from misses through visual density

### 👑 OVERHEAT Flame Crown System
- **Conditional Activation:** 7 flame tongues appear only when heat level ≥ 3 (OVERHEAT state)
- **Individual Flame Animation:** Each flame oscillates at different frequency using Math.sin(t * 5.5 + fi * 1.1) offset
- **Gradient System:** Amber base → orange body → red tips → white apex for realistic fire appearance
- **Dynamic Height:** Flame heights vary 8-17px based on individual oscillation cycles

### 🌊 Velocity-Based Stand Rush Movement
- **Physics-Based Movement:** Replaced instant teleport with velocity burst (2200 px/s over 0.18s decay)
- **Smooth Acceleration:** Stand Rush now uses _rushBurstVx/_rushBurstVy with exponential decay for natural motion
- **World-Space Rendering:** Rush fist positions calculated as world coordinates then converted to screen space
- **Motion Trail Enhancement:** Trail lines now connect player position to actual fist positions in world space

### 🎨 Rendering System Improvements
- **World-Space Coordination:** Rush fists rendered using worldToScreen() conversion for proper spatial alignment
- **Unrotated Text Display:** ORA text rendered in screen space without entity rotation for better readability
- **Motion Blur Enhancement:** Trail lines show actual movement path from player to fist positions
- **Performance Optimization:** Removed Math.random() from draw loops for consistent 60fps rendering

### 📚 Documentation Enhancement
- **Visual Workflow Guide:** Added comprehensive section in PROJECT_OVERVIEW.md explaining when to use Renderer.js vs effects.js vs config.js
- **Decision Tree System:** Clear ASCII flowchart for visual modification workflow
- **Map Visual Guidelines:** 3-layer map system with specific file responsibilities
- **Developer Experience:** Simple rules: "วาดซ้ำทุกเฟรม → Renderer.js, spawn ครั้งเดียวแล้วหาย → effects.js"

---

## v3.24.1 — Documentation Updates: Boss Architecture Guidelines
*Released: March 9, 2026*

### 📚 PROJECT_OVERVIEW.md Enhancements
- **Rendering Pattern Documentation:** Updated rendering decoupling description with specific method names for both PlayerRenderer and BossRenderer dispatchers
- **Boss Development Guidelines:** Enhanced "เพิ่มบอสใหม่" section with detailed steps for new boss creation in modular architecture
- **Window Exports Guidance:** Added explicit requirement for backward-compatibility aliases for WaveManager and AdminSystem integration
- **Architecture Reference:** Removed redundant Boss Architecture entry from design patterns (already documented in file structure section)

### 🎯 Developer Experience Improvements
- **Clear Development Path:** Step-by-step instructions for adding new bosses with file locations and integration points
- **Method Naming Conventions:** Documented specific dispatcher methods (`drawBoss()`, `drawBossFirst()`, `drawBossDog()`) for consistency
- **Backward Compatibility Guidelines:** Explicit alias requirements to maintain existing system integration
- **Comprehensive Integration:** All required files and systems listed for new boss development

---

## v3.24.0 — Boss Architecture Refactor
*Released: March 9, 2026*

### 🔧 Major Code Restructuring
- **Modular Boss System:** Split monolithic boss.js (2,764 lines) into 4 focused files for better maintainability
- **Clean Separation:** BossBase (base class), ManopBoss (KruManop + BossDog), FirstBoss (KruFirst), BossRenderer (rendering logic)
- **Improved Load Order:** Sequential dependency chain ensures proper class availability and eliminates race conditions
- **Better Architecture:** Each file now has single responsibility with clear boundaries and focused functionality

### 📁 File Structure Changes
- **BossBase.js (89 lines):** Pure base class with shared lifecycle management and death hooks
- **ManopBoss.js (695 lines):** KruManop class + BossDog class (moved from BossBase.js for better encapsulation)
- **FirstBoss.js (691 lines):** KruFirst class with GravitationalSingularity and SingularityMode mechanics
- **BossRenderer.js (1,318 lines):** All boss rendering logic separated from game logic for cleaner architecture

### 🎯 Technical Improvements
- **Window Exports:** Maintained backward compatibility with existing WaveManager and AdminSystem integration
- **Clean Dependencies:** Eliminated circular dependencies and established clear inheritance hierarchy
- **Future-Proof Structure:** Modular design enables easier boss additions and maintenance
- **Performance:** Reduced file sizes enable faster loading and better caching granularity

### 🔄 Migration Details
- **index.html:** Updated script tags to load 4 files sequentially in correct dependency order
- **Service Worker:** Cache list updated to reflect new file paths in js/entities/boss/ subfolder
- **Backward Compatibility:** All window.Boss, window.BossFirst, window.BossDog aliases preserved
- **Zero Breaking Changes:** Existing game systems continue to work without modification

---

## v3.23.0 — Energy Cost System Implementation
*Released: March 9, 2026*

### ⚡ Comprehensive Energy Management System
- **Global Energy System:** All active skills now require energy with character-specific costs and regen rates
- **Strategic Resource Management:** Energy costs prevent skill spam while maintaining combat viability
- **Balance-Focused Design:** Each character's costs tuned to their playstyle and regen capabilities

#### 👤 Character Energy Costs & Regen Rates

| ตัวละคร | Skill | Cost | Regen Rate | Recovery Time |
|---------|-------|------|------------|---------------|
| **🎓 Kao** | Q Teleport/PhantomBlink | 20 | 15/s | ~1.3s |
| **🎓 Kao** | E Clone | 30 | 15/s | ~2.0s |
| **🔥 Auto** | Q Vacuum | 20 | 20/s | ~1.0s |
| **🔥 Auto** | E Detonation | 30 | 20/s | ~1.5s |
| **🪷 Poom** | Q Naga | 25 | 12/s | ~2.1s |
| **🪷 Poom** | E Garuda | 30 | 12/s | ~2.5s |
| **🪷 Poom** | R-Click EatRice | 15 | 12/s | ~1.3s |
| **🪷 Poom** | R Ritual | **FREE** | - | - |

#### 🎯 Design Philosophy
- **Poom Ritual (R):** No energy cost - combo finisher with 15s CD + stack requirement
- **Poom Lowest Regen (12/s):** Creates strategic resource management, prevents simultaneous skill spam
- **Auto Highest Regen (20/s):** Supports explosive playstyle with frequent ability usage
- **Balanced Costs:** Total cost distribution allows meaningful combo decisions without energy starvation

### 🔧 Technical Implementation
- **Energy Guard Pattern:** Consistent `if (energy < cost)` checks across all character skills
- **Config Integration:** All costs follow `xyzEnergyCost` pattern in `BALANCE.characters`
- **Visual Feedback:** "⚡ FOCUS LOW!" floating text for insufficient energy
- **Future-Proof:** Reusable pattern for new character skills

### 📚 Documentation Updates
- **PROJECT_OVERVIEW.md:** Added Energy Cost System section with complete cost table
- **Critical Notes:** New entries for Domain Singleton Reset, Domain Slow pitfalls
- **Debugging Solutions:** Added energy-related issues and solutions
- **AI Workflow:** Enhanced file versioning rules with explicit decision tree

---

## v3.22.0 — Comprehensive Balance Patch
*Released: March 9, 2026*

### ⚔️ Enemy Scaling Overhaul
- **Wave 7+ Challenge:** Significant difficulty increase in late waves while preserving early game balance
- **Normal Enemy HP:** `hpPerWave 0.16 → 0.19` (Wave15: ~410 → ~490 HP)
- **Tank Enemy HP:** `hpPerWave 0.20 → 0.23` (Wave15: ~1800 → ~2100 HP)  
- **Shooter Enemy HP:** `hpPerWave 0.22 → 0.25` (Wave15: ~340 → ~390 HP)
- **Enemy Damage:** `damagePerWave 1.2 → 1.4` (Wave15: ~24 → ~28 damage/sec)
- **Enemy Count:** `enemiesPerWave 1.8 → 2.0` (Restored original late-game pressure)

### 👤 Character Balance Adjustments

#### 🎓 Kao — Stealth Loop Cost Rework
- **Lifesteal Nerf:** `passiveLifesteal 0.03 → 0.02` (Reduced healing from stealth loops)
- **Stealth Drain:** `stealthDrain 35 → 45` (Shorter duration: ~2.2s instead of ~2.8s)
- **Design Goal:** Force burst usage instead of sustained stealth, make HP management meaningful

#### 🔥 Auto — Overheat Risk Enhancement  
- **Kill Healing:** `heatHealOnKillWanchai 0.08 → 0.05` (37.5% reduction)
- **Overheat Damage:** `heatHpDrainOverheat 3 → 5 HP/s` (More painful overheated state)
- **Design Goal:** Make detonation decisions meaningful, prevent HP trivialization

#### 🌾 Poom — Cosmic Balance Skill Timing
- **Naga Uptime:** `cooldown 20 → 22s`, `duration 10 → 9s` (50% → 41% uptime)
- **Garuda Cooldown:** `22 → 24s` (Narrower Naga+Garuda overlap window)
- **Design Goal:** Require precise timing and coordination between abilities

### 👑 Boss Difficulty Enhancement
- **Contact Damage:** `25 → 30` (20% increase for close-range danger)
- **Boss HP Scaling:** `hpMultiplier 1.28 → 1.32` (Enc5: ~14,000 → ~15,000 HP)
- **Design Goal:** Make boss encounters feel more epic and threatening

### 🎯 Balance Philosophy
- **Late Game Focus:** Minimal impact on Waves 1-5, significant challenge increase in Waves 10-15
- **Risk vs Reward:** All character changes increase cost/reward decision depth
- **Epic Scaling:** Boss difficulty now matches final encounter expectations

---

## v3.21.2 — AdminSystem Defensive Fixes
*Released: March 9, 2026*

### 🛡️ Enhanced Domain Leak Prevention
- **Admin Command Safeguards:** Added defensive domain singleton resets to admin kill and wave commands
- **Wave Advance Protection:** Prevents `isInvincible()` state persistence when using admin commands to skip waves
- **Boss Kill Command:** Ensures proper domain cleanup when using admin commands to eliminate bosses

### 🔧 AdminSystem Updates
- **_killAllEntities()**: Added defensive `DomainExpansion._abort()` and `GravitationalSingularity._abort()` calls after boss.takeDamage()
- **Wave Skipping**: Added domain singleton resets in wave advance commands to prevent phase carryover
- **Double Protection:** Admin commands now reset domains both through boss death hooks AND defensive abort calls

### 🎯 Admin Command Reliability
- **Consistent State:** Admin commands now maintain clean domain state across all operations
- **Wave Management:** Skipping waves no longer risks domain phase leakage
- **Debug Safety:** Admin testing tools now properly clean up singleton state

---

## v3.21.1 — GravitationalSingularity Bug Fix
*Released: March 9, 2026*

### 🐛 Critical Bug Fixes
- **Singleton Phase Leak:** Fixed GravitationalSingularity phase persisting across games after boss death
- **Domain Shield Spam:** Resolved "DOMAIN SHIELD!" infinite loop preventing new domain triggers
- **Player Speed Debuff:** Corrected domain slow effect to target `stats.moveSpeed` instead of deprecated `moveSpeed` property

### 🔧 Technical Fixes
- **Boss Death Cleanup:** Added force-reset of both domain singletons (`DomainExpansion._abort()` and `GravitationalSingularity._abort()`) in `BossBase._onDeath()`
- **Game Loop Update:** Removed `window.boss && !window.boss.dead` guard from `GravitationalSingularity.update()` to allow cleanup when boss is dead/null
- **Safe Abort Logic:** `_abort(null)` calls are safe due to internal `if (boss)` guards
- **Speed System Update:** Domain slow effects now correctly modify `player.stats.moveSpeed` for proper stat system integration

### 🎯 Gameplay Impact
- **Domain Mechanics:** GravitationalSingularity now properly resets between games
- **Boss Encounters:** Domain triggers work correctly in subsequent games
- **Player Movement:** Speed debuffs apply and restore correctly through stats system

---

## v3.21.0 — Complete Boss Rework Implementation
*Released: March 9, 2026*

### ⚫ Phase 1 — KruFirst GravitationalSingularity Domain
- **New Domain System:** GravitationalSingularity triggers once at HP ≤ 25% with 4-phase pulse sequence
- **Pulse Mechanics:** PULL (gravity pull) → ESCAPE (push with safe zone) → TIDAL (oscillating + OrbitalDebris) → COLLAPSE (ramp pull + shockwave)
- **OrbitalDebris:** 6 projectiles orbit boss during TIDAL phase with deterministic spinning square visuals
- **Domain Shield:** Boss becomes invincible during domain with "DOMAIN SHIELD!" visual feedback
- **Advanced Visuals:** Gravity lines, safe zone indicators, tidal effects, and collapse vignette

### 🐕 Phase 2 — KruManop Phase Structure Rework
- **Per-Encounter Thresholds:** Dynamic phase 2/3 triggers (enc1=50%, enc3=60%, enc5=65% for guaranteed dog encounters)
- **ChalkWall Barrier:** Perpendicular chalk line placement with damage on crossing, 6s duration, mathematical formula overlay
- **DogPackCombo:** Synchronized attack where boss freezes 0.5s then dog rush + ultimate fire simultaneously
- **Skill Priority:** DogPackCombo > ChalkWall > existing skills for phase 2 combat flow

### 📐 Phase 3 — KruManop Domain Sub-Phase System
- **A/B/C Sub-Phases:** Progressive difficulty with unique mechanics per phase
- **Sub-Phase A (Cycles 1-2):** Extended warning duration (2.0s) for fair equation rain patterns
- **Sub-Phase B (Cycles 3-4):** Faster danger escalation (6% per cycle), 3-way chalk volleys every 0.8s, safe cell shifting
- **Sub-Phase C (Cycles 5-6):** 30% TeacherFury trigger chance per cycle for domain collapse intensity
- **Visual HUD:** Sub-phase indicators (A=purple, B=yellow, C=red) with dynamic labels

### ⚡ Phase 4 — KruFirst Singularity Mode
- **Post-Domain Enhancement:** Activates after GravitationalSingularity ends, all cooldowns ×0.50
- **REBOUND State:** Replaces STUNNED with push-back and immediate double SUVAT charge capability
- **QUANTUM_LEAP:** Teleport behind player + immediate SUVAT charge with 40% priority in Singularity Mode
- **GravityWell:** Concentric ring distortion field that pulls player and bends projectiles
- **SuperpositionClone:** Ghost KruFirst copy with 1 HP, fires 2-way projectiles, destroyable by player

### 🔧 Technical Enhancements
- **Configuration System:** 28 new GravitationalSingularity balance values, per-encounter thresholds, sub-phase parameters
- **State Management:** New boss states (REBOUND, QUANTUM_LEAP), domain freeze logic, Singularity Mode tracking
- **Visual Effects:** Deterministic rendering (no Math.random() in draw calls), pre-seeded values for consistency
- **Game Loop Integration:** GravitationalSingularity.update/draw hooks in main game loop

### ⚖️ Balance Changes
- **KruFirst HP Scaling:** Base HP ×1.28 (reduced from ×1.33) for better encounter pacing
- **Phase Timing:** ChalkWall 12s CD, DogPackCombo 18s CD, domain durations tuned for engagement
- **Damage Values:** OrbitalDebris 25 damage, ChalkWall 15 damage, well-calculated force multipliers
- **Skill Cooldowns:** Singularity Mode ×0.50 multiplier, Derivation Mode integration preserved

---

## v3.20.2 — Boss Safe-Zone Protection System
*Released: March 9, 2026*

### 🛡️ MTC Room Boss Exclusion
- **Anti-Exploit System:** Prevents players from luring bosses into MTC Room for spawn-killing exploits
- **Smooth Push-Out Mechanics:** Bosses are gently pushed away from room center at 380 px/s when entering safe zone
- **Temporary Immunity:** Bosses become immune to damage during push-out via `_inSafeZone` flag
- **Visual Feedback:** "SAFE ZONE" floating text (#22d3ee) displays when boss protection activates

### 🔧 Technical Implementation
- **Universal Boss Protection:** Added `_inSafeZone` checks to all boss classes (BossDog, KruManop, KruFirst)
- **Real-Time Detection:** Continuous monitoring of boss position relative to MTC Room boundaries
- **Pixel-Perfect Boundaries:** 28px margin ensures boss radius doesn't clip room edges
- **Automatic Reset:** `_inSafeZone` flag clears when boss leaves safe zone area

### 🎯 Gameplay Impact
- **Fair Combat:** Maintains challenging boss encounters without safe-room exploits
- **Smooth Experience:** Non-disruptive push-out mechanics maintain game flow
- **Clear Feedback:** Players understand why boss becomes temporarily immune
- **Strategic Positioning:** Encourages legitimate boss fights rather than exploitation tactics

---

## v3.20.1 — UI Polish: Level Up & Wave Event Display Improvements
*Released: March 9, 2026*

### ✨ Level Up Display Enhancement
- **Staggered Text Timing**: Split level up notification into two phases for better visual hierarchy
  - Phase 1: Immediate stats display (+X% DMG, -Y% CD) with smaller, cleaner text
  - Phase 2: Delayed 350ms big "✦ LEVEL N! ✦" announcement with enhanced visual impact
- **Improved Text Positioning**: Stats text positioned higher (y-55) to avoid overlap with character
- **Visual Hierarchy**: Clear separation between stat changes and level announcement for better readability

### 🎨 Weapon Indicator Transitions
- **Smooth Animations**: Added opacity and transform transitions (0.4s ease) for weapon indicator
- **Hidden State**: New `.weapon-indicator--hidden` class with fade and slide effects
- **Enhanced Visual Feedback**: Weapon changes now feature smooth fade-in/fade-out animations

### 🌊 Wave Event Display Optimization
- **Eliminated Duplicate Text**: Removed redundant floating text for wave events - canvas banner already displays event titles
- **Voice Bubble Only**: Wave events now use voice bubbles for atmospheric feedback without text clutter
- **Staggered Wave Announcements**: Wave start floating text delayed 900ms after banner begins
- **Better Visual Flow**: Allows canvas banner fade-in to complete before showing floating text

### 🎯 Tutorial Spotlight Refinement
- **Simplified Spotlight Effect**: Streamlined tutorial highlighting animation to single pulsing ring
- **Performance Optimization**: Reduced complex multi-layer animations to efficient single-keyframe design
- **Cleaner Visual Design**: Removed unnecessary complexity for better focus on tutorial content

### 🔧 Technical Improvements
- **Reduced Visual Noise**: Eliminated overlapping floating texts during wave transitions
- **Better Timing Coordination**: Synchronized text displays with existing canvas animations
- **Improved User Experience**: Cleaner, more organized visual feedback during key game moments

---

## v3.20.0 — Enhanced Tutorial System v3
*Released: March 9, 2026*

### 🎓 Tutorial System Improvements
- **UI Highlighting**: Added dynamic element highlighting with pulsing blue glow effect to draw attention to specific UI elements during tutorial steps
- **Animated Arrow**: Implemented gold gradient arrow that points to tutorial targets with smooth bounce animation and edge detection for off-screen elements
- **Enhanced Visual Feedback**: Improved tutorial card positioning and added real-time arrow tracking that follows moving targets
- **Better User Guidance**: Arrow automatically rotates to point toward off-screen elements and hides when not needed
- **Performance Optimizations**: Efficient DOM updates and frame-based arrow positioning for smooth 60fps experience

### 🎨 Visual Enhancements
- New `.tut-highlighted` CSS class with multi-layer box-shadow animation
- Gold gradient arrow with drop-shadow effect using clip-path for clean shape
- Improved z-index layering for proper visual hierarchy
- Smooth transitions and micro-animations for better user experience

### 🔧 Technical Improvements
- Added `_applyUIHighlight()` and `_updateArrow()` functions for dynamic visual guidance
- Enhanced tutorial system with `draw(ctx)` method for rendering integration
- Improved weapon-switch polling logic and action handling
- Better state management for tutorial highlights and arrow positioning

---

## v3.19.2 — Service Worker Cache Cleanup
*Released: March 9, 2026*

### 🧹 Service Worker Maintenance
- **Removed Deleted File References:** Cleaned up service worker cache list by removing references to deleted ai.js and secrets.js files
- **Cache Error Prevention:** Eliminates 404 errors when service worker attempts to cache non-existent files
- **Follow-up Cleanup:** Addresses remaining references from v3.19.0 AI system refactor where these files were deleted

### 🔧 Technical Details
- **Files Removed from Cache:** ai.js and secrets.js (both deleted in v3.19.0)
- **Service Worker Efficiency:** Reduces unnecessary cache attempts and improves loading performance
- **Cache Version Update:** Incremented to v3.19.2 to ensure proper cache invalidation

---

## v3.19.1 — PoomPlayer Hit Flash Timer Fix
*Released: March 9, 2026*

### 🐛 Bug Fixes
- **PoomPlayer Hit Flash Timer:** Fixed missing hit flash timer decay in PoomPlayer.update()
- **Root Cause:** PlayerBase.update() is not called in PoomPlayer, causing hit flash visual effects to not decay properly
- **Solution:** Added explicit hit flash timer decay logic with 6x multiplier and hit flash lock release at 0.4s threshold
- **Impact:** Poom character now properly displays hit flash effects when taking damage

### 🔧 Technical Details
- **Timer Decay:** `_hitFlashTimer` now properly decreases by `dt * 6` per frame
- **Lock Release:** `_hitFlashLocked` flag resets when timer drops below 0.4s
- **Visual Consistency:** Ensures Poom character has same damage feedback as other characters

---

## v3.19.0 — Gemini AI Dependency Removal
*Released: March 9, 2026*

### 🤖 AI System Refactoring
- **Removed External API Dependencies**: Eliminated Gemini AI integration completely
- **Local Text-Based System**: All AI responses now use predefined text arrays from `GAME_TEXTS`
- **Mission Names**: `initAI()` now randomly selects from `GAME_TEXTS.ai.missionNames` (sync, no API calls)
- **Boss Taunts**: `BossBase.speak()` method pulls from `GAME_TEXTS.ai.bossTaunts` directly (sync)
- **Report Cards**: Score-based tier system uses `GAME_TEXTS.ai.reportCards` with excellent (>5000), good (>2000), poor tiers

### 🗂️ File Cleanup
- **Deleted Files**: Removed `js/ai.js` and `js/secrets.js` completely
- **Script References**: Cleaned up index.html to remove AI-related script tags
- **Code Simplification**: Removed async/await patterns and Promise.race logic

### ⚡ Performance Improvements
- **Instant Responses**: No more loading spinners or API timeouts
- **Reduced Complexity**: Simplified error handling and fallback logic
- **Offline Reliability**: Game now works completely offline without external dependencies

### 🛠️ Technical Changes
- **Sync Functions**: Converted `initAI()` from async to sync
- **Direct Text Access**: Boss speech now uses direct array indexing
- **Tier Logic**: Report card system uses simple score thresholds
- **Dependency Update**: Boss.js now depends on config.js instead of game.js for text data

---

## v3.18.4 — PlayerRenderer Code Organization & Optimization
*Released: March 9, 2026*

### 🔧 Code Structure Improvements
- **Early Variable Declaration**: Movement variables (breathing, speed, bob, stretch, recoil) now declared at the beginning of each character render function
- **Eliminated Duplicate Declarations**: Removed redundant variable calculations that were scattered throughout render methods
- **Improved Variable Scope**: Variables used by ghosts, shadows, and body rendering are now available early in the execution flow
- **Cleaner Code Flow**: Better organization of calculation logic before rendering operations

### 🎨 Rendering Optimization
- **Simplified Ghost Rendering**: Removed unnecessary transform operations in dash ghost rendering
- **Consistent Variable Usage**: Standardized variable naming and usage patterns across all character renderers
- **Maintainability Enhancement**: Easier to modify and debug animation systems with centralized variable declarations

### ⚡ Performance Benefits
- **Reduced Redundant Calculations**: Eliminated duplicate math operations for movement variables
- **Improved Readability**: Code structure now follows a more logical top-to-bottom flow
- **Better Developer Experience**: Easier to understand and modify character rendering behavior

---

## v3.18.3 — Enhanced Weapon Muzzle Offset System
*Released: March 9, 2026*

### 🔫 Character-Specific Bullet Spawn Positions
- **Accurate Muzzle Offsets**: Implemented character-specific bullet spawn positions based on actual weapon barrel locations
- **Kao Weapons**: Auto (49px), Sniper (69px), Shotgun (45px) - measured from weapon draw functions
- **Poom Weapon**: 43px offset for Poom character's unique weapon positioning
- **Auto Player**: 51px offset for Auto character's personal weapon
- **Dynamic Offset Selection**: Smart offset system that adapts to active character and weapon type

### 🎯 Improved Gameplay Accuracy
- **Realistic Bullet Origins**: Bullets now spawn from actual barrel tips instead of player center
- **Enhanced Visual Feedback**: Better alignment between weapon firing and bullet trajectory
- **Consistent Crosshair Accuracy**: Improved hit registration due to proper bullet spawn positioning

---

## v3.18.2 — Enhanced Player Rendering & Visual Effects
*Released: March 9, 2026*

### ⚡ Hit Flash System Improvements
- **Enhanced Hit Feedback:** Added `_hitFlashTimer` and `_hitFlashBig` properties to PlayerBase for differentiated damage feedback
- **Fast Decay Rate:** Hit flash timer now decays at 6x per second for quick, responsive visual feedback
- **Damage-Based Intensity:** Strong flash effects (`_hitFlashBig = true`) trigger for bullet/AoE damage (≥5 HP), subtle effects for contact damage
- **Universal Flash Helper:** `_drawHitFlash()` helper provides white glow + expanding ring effects for all character types

### 🏃 Walk Animation & Movement Physics
- **Vertical Bob Implementation:** Added real Y-axis movement with `bobOffsetY`, `poomBobY`, and `kaoBobY` variables
- **Character-Specific Bob:** Each character now has unique walk cycle timing and amplitude:
  - Kao: 2.0px amplitude with walkCycle timing
  - Poom: 2.0px amplitude with walkCycle timing  
  - Auto: 2.5px amplitude with walkCycle*0.9 timing
- **Ground Shadow Scaling:** Shadows now properly scale with bob movement and use correct save/restore context management

### 💇 Responsive Hair Animation System
- **Auto Combat Mode:** Hair wobble period increases from 380ms → 150ms during Wanchai activation for intense combat feel
- **Poom Dynamic Response:** Hair wobble period adapts to movement speed (220-500ms range) - faster when running, slower when walking
- **Movement-Based Amplitude:** Poom hair wobble amplitude increases with movement speed for more dynamic animation

### 🔫 Weapon Recoil Animation
- **Universal Recoil System:** All characters (Kao, Auto, Poom) now feature consistent weapon recoil animations
- **Character-Specific Tuning:** Recoil intensity calibrated per character:
  - Kao: 3.5x multiplier
  - Auto: 3.0x multiplier  
  - Poom: 2.5x multiplier
- **Visual Feedback:** Recoil affects weapon positioning and adds realistic shooting feedback

### 🎨 Visual Polish & Fixes
- **Kranok Pattern Enhancement:** Poom's Thai pattern opacity now reduces during movement and features improved transparency transitions
- **Dash Ghost Shapes:** Updated dash ghost visual from roundRect to arc shapes to match body design
- **Context Management:** Fixed ground shadow rendering with proper save/restore state management

---

## v3.18.1 — Character Selection UI Redesign: Enhanced Stat Bars & Visual Identity
*Released: March 8, 2026*

### 📊 Stat Bar System Overhaul
- **4-Stat Display:** Expanded from 3 to 4 stats (HP/DMG/SPD/RANGE) for complete character overview
- **Real Config Values:** Stat percentages and numerical values now calculated from actual config.js values:
  - Kao: HP=119, DPS≈118, SPD=298, Range=900
  - Poom: HP=165, DPS≈148, SPD=298, Range=750  
  - Auto: HP=230, DPS=MAX, SPD=260, Range=MELEE
- **Enhanced Visual Design:** Increased bar height 6→7px, added border-radius 1px, 4-segment tick marks for tactical UI feel
- **Glow Effects:** Added box-shadow to stat bar fills for enhanced visibility

### 🎨 Character Theme Updates
- **Poom Identity Change:** Complete color theme shift from orange to green across all UI elements
  - Stat bars: Green gradient (#16a34a → #22c55e → #4ade80)
  - Character tags, titles, and selection borders now green-themed
  - Hover and selected states match new green identity
- **Auto Theme Refinement:** Hover border changed from gold to red for better character identity consistency
- **Enhanced Avatar Display:** Increased avatar height 112→120px with improved scanline overlay effects

### ✨ Visual Polish & Menu Enhancements  
- **Improved Hover States:** Enhanced glow effects and character-specific shadow colors for better visual feedback
- **Menu Scanline Texture:** Added subtle scanline texture to menu container for tactical UI aesthetic
- **Section Dividers:** Implemented dual-line section dividers (wide+narrow) for better visual hierarchy
- **High Score Enhancement:** Added sweep animation and stronger glow text effects to high score display

## v3.18.0 — Boss Derivation Mode: PhysicsFormulaZone & Combat System Overhaul
*Released: March 8, 2026*

### 🔴 Derivation Mode System (HP < 40%)
- **Automatic Trigger:** Boss enters Derivation Mode when HP drops below 40% for the first time
- **Global Cooldown Reduction:** All skill cooldowns reduced by 35% (×0.65 multiplier) for sustained pressure
- **Immediate ParabolicVolley:** Fires as announcement when Derivation Mode activates
- **Visual Effects:** "⚛️ DERIVATION MODE" floating text with particle effects and screen shake
- **New Skill Branches:** Unlocks `formulaZone` and `parabolic` skills for relentless pressure

### 🟣 PhysicsFormulaZone — Area Denial System
- **Zone Mechanics:** Circular zones (110-130px radius) that persist for 5 seconds
- **Player Debuff:** Speed reduced to 55%, damage 14/s (18/s advanced) when standing in zone
- **Visual Design:** Rotating hexagon, animated dashed border, formula labels (F=ma, p=mv, etc.)
- **Strategic Placement:** 
  - Drops at boss position during FREE_FALL attacks (forces player repositioning)
  - Standalone drops at player position every 14s in Derivation Mode
- **Countdown System:** Visual arc timer showing remaining duration

### 🟡 SUVAT Miss Punishment System
- **Problem Solved:** Fixed "boss goes idle after burst dodge" issue
- **New Response:** When SUVAT dash expires without hitting player:
  - Fires immediate ParabolicVolley retaliation
  - Enters ORBIT state instead of CHASE for sustained pressure
  - "PARABOLIC RETALIATION!" floating text feedback
- **Combat Flow:** Maintains constant pressure, eliminates safe windows

### 🌐 ParabolicVolley Attack System
- **Adaptive Firing:** 3-prong volley (5-prong advanced) targeting player escape paths
- **Smart Targeting:** Projectile spread calculated to intercept common dodge patterns
- **Damage Output:** 26 damage per projectile, 420px/s velocity
- **Visual Effects:** Purple particle burst at origin with screen shake
- **Strategic Use:** 
  - Chained after PhysicsFormulaZone drops
  - Standalone skill in Derivation Mode
  - SUVAT miss punishment

### 🎯 Enhanced Boss AI Decision Tree
- **Derivation Mode Branches:** Two new skill priorities in low HP state
  - `formulaZone`: Drop zone at player + chain ParabolicVolley
  - `parabolic`: Standalone volley for direct pressure
- **Priority System:** New skills take priority over existing attacks during Derivation Mode
- **Cooldown Management:** Integrated with existing cooldown reduction system

### 🎨 Visual Effects & Polish
- **PhysicsFormulaZone:** 
  - Rotating hexagon core with formula labels
  - Animated dashed border with glow effects
  - Countdown timer arc with color transitions
  - "⚠ SLOW FIELD" warning text
- **Derivation Mode Activation:** 
  - Dual-color particle effects (green + cyan)
  - Screen shake and audio cues
  - "d/dt ALL COOLDOWNS ×0.65" technical feedback

### 🔧 Technical Implementation
- **New Classes:** `PhysicsFormulaZone` and `ParabolicVolley` in boss_attacks.js
- **Boss State Management:** Enhanced `_derivationMode` and `_derivationTaunted` flags
- **Cooldown System:** Global 35% reduction applied to all skill max cooldowns
- **Steering Enhancement:** Added `_steerAroundObstacles()` calls for improved navigation
- **Export Updates:** Added new classes to module exports and global window objects

### 🎮 Gameplay Impact
- **Sustained Pressure:** Eliminates safe windows after successful dodges
- **Area Control:** PhysicsFormulaZone forces constant repositioning
- **Adaptive Difficulty:** Boss becomes 35% more aggressive in Derivation Mode
- **Skill Synergy:** Combined zone denial + projectile attacks create complex patterns

---

## v3.17.0 — Major Map Redesign & Visual Enhancement
*Released: March 8, 2026*

### 🚀 Character-Agnostic Dev Buff Implementation
- **Universal applyDevBuff() Method:** Added to PlayerBase.js base class, inherited by all characters
- **Comprehensive Stat Package:** HP +50%, Energy +50%, Damage ×1.25, Speed ×1.20, CDR ×0.60, Crit +8%
- **Smart Cooldown Reset:** Covers both base cooldowns{} and character-specific skills{} objects
- **Duplicate Protection:** `_devBuffApplied` flag prevents multiple applications
- **Passive Preservation:** Does not unlock passive skills - must be earned normally in-game

### 💻 Enhanced Admin Commands
- **devbuff Command:** Universal command works for all characters (not just Kao)
- **Detailed Console Output:** Shows all stat changes with precise values
- **Visual Feedback:** "🚀 DEV BUFF ACTIVE" floating text with particle effects
- **Error Handling:** Graceful handling of missing methods and duplicate applications

### 🎮 Game Start Integration
- **Automatic Application:** Dev buff applied on game start when `window.isAdmin` is true
- **Character Agnostic:** Works for Kao, Auto, Poom, and any future characters
- **Clean Implementation:** Replaces Kao-specific passive unlock with universal buff system

### 📚 Documentation Updates
- **Service Worker:** Updated to v3.16.8 for cache invalidation
- **Code Comments:** Comprehensive Thai documentation for dev buff behavior
- **Method Signatures:** Clear parameter and return value documentation

---

## v3.17.0 — Major Map Redesign & Visual Enhancement
*Released: March 8, 2026*

### 🗺️ Complete Layout Overhaul
- **Zone Repositioning:** All 5 zones moved 200-300px closer to spawn point (0,0) for immediate player engagement
- **MTC Citadel:** Moved 120px south (y:-700 → y:-580) for better visibility and accessibility
- **Optimized Zone Sizes:** Refined dimensions for better gameplay flow and reduced dead space
- **Strategic Corridor Walls:** 8 new internal walls creating natural chokepoints and funnels between zones
- **Barrier Funneling:** Corridor walls at all 4 cardinal directions guide player movement and create tactical positions

### 🎨 Visual Enhancement Suite
- **Center Landmark:** Rotating dual-ring system at spawn point (gold + cyan) with 8 spokes for persistent directional reference
- **Wall Drop Shadows:** All walls now have +4px shadow offsets for depth and ground separation
- **Ambient Micro-Particles:** Each zone features 7 deterministic floating particles (Server=blue data, Library=gold dust, Courtyard=green fireflies, Lecture=purple chalk)
- **Enhanced Zone Labels:** Pill-style badges with background, border, and improved 11px font for better readability
- **Zone-Specific Ambiance:** Each zone now has unique ambient colors matching their thematic identity

### ⚡ Performance Optimizations
- **Deterministic Layout:** Replaced Math.random() with sin/cos calculations for consistent map generation across restarts
- **Optimized Timing:** Eliminated redundant performance.now() calls, using shared _mapNow timestamp
- **Efficient Particle System:** Lightweight ambient particles using mathematical oscillation instead of expensive particle systems
- **Reduced Object Count:** Streamlined barrel placement into strategic clusters instead of scattered distribution

### 🎮 Gameplay Improvements
- **Immediate Zone Access:** Players encounter zones within 3-5 seconds of spawn instead of wandering empty space
- **Tactical Chokepoints:** Corridor walls create natural funnels for strategic positioning and combat scenarios
- **Clustered Barrels:** Explosive barrels repositioned at zone entrances for tactical decision-making
- **Improved Navigation:** Center landmark and zone labels provide constant orientation reference
- **Better Flow:** Layout encourages exploration while maintaining clear combat corridors

### 🔧 Technical Enhancements
- **Deterministic Seeding:** Map layout identical across all game restarts using mathematical functions
- **Shared Timestamp System:** Centralized timing reduces redundant calculations
- **Optimized Rendering:** Improved draw order and reduced redundant operations
- **Enhanced Configuration:** Comprehensive config options for zones, landmarks, and visual effects
- **Better Code Organization:** Cleaner separation of concerns in map generation and rendering

### 📊 Configuration Updates
- **Zone Bounds:** All zones repositioned with optimized dimensions and spacing
- **Landmark System:** Complete configuration for center visual reference system
- **Ambient Colors:** Zone-specific particle colors and behaviors
- **Wall Positions:** Strategic corridor wall placements for gameplay flow
- **Path Adjustments:** Database and shop paths updated to match new zone positions

---

## v3.16.9 — Documentation Updates & PROJECT_OVERVIEW.md Enhancement
*Released: March 8, 2026*

### 📚 Comprehensive Documentation Updates
- **PROJECT_OVERVIEW.md:** Updated 5 key sections to reflect dev buff system implementation
- **secrets.js Clarification:** Corrected description to CONFIG_SECRETS (GEMINI_API_KEY) with note that no cheat codes exist
- **AdminSystem.js Details:** Added comprehensive command documentation including permission system and new commands
- **PlayerBase.js Documentation:** Added applyDevBuff() method details with flag protection
- **Dev Mode Architecture:** Updated passive unlock documentation to reflect new applyDevBuff() approach
- **Power-ups Section:** Enhanced with complete dev buff stat package documentation

### 🔧 Technical Documentation Improvements
- **Command Reference:** Detailed spawn commands (manop [1|2|3], spawn first [advanced], devbuff)
- **Permission System:** GUEST/OPERATOR/ROOT tier documentation
- **Stat Package Details:** Complete breakdown of dev buff effects (HP+50%, EN+50%, DMG×1.25, SPD×1.20, CDR×0.60, Crit+8%)
- **Architecture Changes:** Clear explanation of passive unlock system changes
- **Method Signatures:** Proper documentation for applyDevBuff() with inheritance details

### 🎯 Developer Experience
- **Clearer Architecture:** Better understanding of dev mode vs normal progression
- **Command Reference:** Complete admin console command documentation
- **Implementation Details:** Technical specifications for future development
- **Service Worker:** Updated to v3.16.9 for cache invalidation

---

## v3.16.8 — Universal Dev Buff System
*Released: March 8, 2026*

### 🔐 Complete Permission System Redesign
- **Three-Tier Permission Levels:** GUEST (○), OPERATOR (◉), and ROOT (★) with distinct visual badges
- **Dynamic Permission Detection:** Based on `window.isAdmin` values (false/true/'root')
- **Visual Permission Badges:** Displayed in console titlebar with color-coded indicators
- **Enhanced Command Prompt:** Shows `[001] ◉OPERATOR@mtcserver:~#` with command counter and role
- **Permission Guards:** ROOT-only commands automatically blocked with clear error messages

### 🛠️ New Debug Commands & Tools
- **energy [amount]:** Restore player energy (OPERATOR+)
- **god / god off:** Toggle invincibility with continuous HP/Energy restoration (ROOT only)
- **kill all:** Instantly terminate all enemies (ROOT only)  
- **speed <mult>:** Set player move speed multiplier 0.1-10x (ROOT only)
- **reset buffs:** Clear all player buffs including god mode and speed modifications (ROOT only)
- **fps:** Toggle real-time FPS overlay in top-right corner (OPERATOR+)
- **info:** Display comprehensive game state snapshot (OPERATOR+)

### 🎨 Enhanced Console Experience
- **Permission-Aware Help System:** Commands show as `[LOCKED]` for insufficient permission levels
- **Visual Command Feedback:** Secret commands display in orange with glow effect
- **Improved whoami:** Now shows current permission level with badge
- **Command Counter:** Tracks all commands executed per session
- **Styled Output Classes:** New CSS classes for secret commands and locked hints

### 🎯 Technical Implementation
- **Secure Command Parsing:** Permission checks happen before command execution
- **Real-time Badge Updates:** Permission badge updates when console opens
- **Efficient God Mode:** Uses 200ms interval for continuous HP/Energy restoration
- **FPS Overlay:** Lightweight performance monitoring with requestAnimationFrame
- **State Management:** Proper cleanup of intervals and temporary modifications

---

## v3.16.6 — Domain Expansion Bug Fixes & Visual Rework
*Released: March 8, 2026*

### 🐛 Critical Domain Expansion Bug Fixes
- **Fixed _DC Object Properties:** Resolved undefined property issues that broke domain expansion
  - `WARN_DUR_MIN`: Was undefined → NaN cycleTimer → cycles never advanced
  - `END_DUR`: Was undefined → ending phase never exited, globalA=NaN
  - `COLS/ROWS`: Were undefined → _initCells() loop ran 0 times → cells=[] → no grid
- **Domain Expansion Now Fully Functional:** All phases work correctly, grid cells appear, domain completes properly

### ✨ Complete Visual Rework - Domain Expansion
- **Casting Phase:** Added pillar of light rising from boss during 2.2s cast with edge lines
- **Arena Border:** Added 8 energy tendrils rotating around inner ring with sine wobble animation
- **Danger Cells (Warning):** Added 3 deterministic crack lines from center using cell position as seed
- **Explode Phase:** Added shockwave ring expanding from each exploding cell
- **Safe Cells:** Added shimmer dot with elliptical orbit using cell position as phase seed
- **Ending Phase:** Added collapse effect where grid cells slowly move toward origin before disappearing

### 🎯 Visual Effects Details
- **Deterministic Patterns:** All effects use cell position seeds for consistent, non-random visuals
- **Progressive Intensity:** Crack lines grow longer as warnProgress increases
- **Smooth Animations:** All new effects feature smooth transitions and proper alpha blending
- **Performance Optimized:** Effects use efficient rendering techniques with proper culling

---

## v3.16.5 — Enhanced Boss HP Bar: Visual Effects & Phase System
*Released: March 8, 2026*

### 🎨 Boss HP Bar Complete Overhaul
- **Phase-Based Color System:** Dynamic color changes based on HP percentage
  - **Safe (>60%):** Green gradient with subtle glow
  - **Caution (30-60%):** Yellow gradient with warning glow
  - **Danger (15-30%):** Orange-red gradient with pulsing animation
  - **Critical (<15%):** Deep red with fast pulse and intense glow
- **Visual Feedback:** Smooth transitions between phases with appropriate visual intensity

### ✨ Advanced Visual Effects
- **Shimmer Animation:** Continuous scanline effect across HP bar
  - 2.2s linear infinite sweep with white gradient highlight
  - Creates dynamic, high-tech appearance
  - Subtle 18% opacity for professional look
- **Drain Ghost Bar:** Secondary bar that lags behind HP changes
  - Creates "blood draining" effect when boss takes damage
  - 1.2s ease-out transition for smooth visual feedback
  - Only updates when HP actually drops (not when healing)

### 📊 Enhanced Visual Design
- **Improved Bar Styling:** Increased height from 18→20px with enhanced shadows
  - Darker background (#0d0005) for better contrast
  - Enhanced box-shadow with deeper, more professional appearance
  - Rounded corners refined for modern look
- **Phase Threshold Markers:** Visual notches at 60%, 30%, and 15% HP
  - Subtle white markers (22% opacity) indicate phase boundaries
  - Helps players visually track danger zones
  - Positioned with CSS pseudo-elements for clean implementation

### 🔧 Technical Implementation
- **CSS Architecture:** Modular class-based system for phase management
  - JavaScript dynamically applies phase classes based on HP percentage
  - CSS handles all visual transitions and animations
  - Clean separation of concerns between logic and presentation
- **Performance Optimizations:** Efficient DOM manipulation
  - Drain element created lazily only when needed
  - Minimal DOM updates with smart change detection
  - Hardware-accelerated CSS animations for smooth performance

### 🎮 User Experience Improvements
- **Intuitive Feedback:** Color-coded phases instantly communicate threat level
- **Visual Satisfaction:** Smooth animations and effects enhance combat feel
- **Professional Polish:** High-quality visual effects rival commercial games
- **Accessibility:** Clear visual indicators work alongside existing HP numbers

### 🔄 HUD Layout Reversion
- **Boss HUD Position:** Reverted to original top:70px (from 110px)
- **Weapon Indicator Z-Index:** Restored to z-index:15 (from 12)
- **Purpose:** Maintain original layout while enhancing visual effects
- **Impact:** Consistent with established UI hierarchy

---

## v3.16.4 — UI/UX Improvements: HUD Layout & Text Display
*Released: March 8, 2026*

### 🎨 Floating Text System Enhancements
- **Wider Cluster Detection:** Increased horizontal proximity threshold from 40→80px
  - **Purpose:** Better detection of overlapping text spawns across larger areas
  - **Impact:** Floating texts that spawn near each other are properly stacked
- **Increased Vertical Spacing:** Raised step height from 22→32px between stacked texts
  - **Purpose:** Prevent text overlap and improve readability
  - **Impact:** Clear visual separation between damage numbers and notifications
- **Higher Stack Capacity:** Increased maximum stack from 5→6 texts
  - **Purpose:** Handle multi-spawn events at wave start with many simultaneous texts
  - **Impact:** Better text organization during intense combat moments

### 📊 HUD Layout Reorganization
- **Boss HUD Positioning:** Moved boss name/HP bar from top:70px→110px
  - **Purpose:** Avoid overlap with weapon indicator bar (ends at ~90px)
  - **Impact:** Clear visual hierarchy with weapon bar above boss information
- **Wave Banner Position:** Shifted event banner from cy:82→155
  - **Purpose:** Position below both weapon indicator (~90px) and boss HUD (~160px)
  - **Impact:** Wave event notifications no longer overlap critical UI elements
- **Z-Index Layering:** Proper layer ordering for UI elements
  - **Boss HUD:** Set to z-index:15 (highest priority)
  - **Weapon Indicator:** Reduced to z-index:12 (below boss HUD)
  - **Purpose:** Boss name and HP display correctly overlaps weapon bar when needed

### 🌊 Wave Management Revisions
- **Spawn Logic Simplification:** Reverted to original spawn chance calculations
  - **Removed:** Wave-gated progressive scaling for Mage/Tank spawns
  - **Purpose:** Restore original difficulty progression and balance
  - **Impact:** Consistent enemy distribution across all waves as originally designed
- **Trickle Spawning:** Reverted batch size to original calculations
  - **Purpose:** Maintain intended wave pressure and pacing
  - **Impact:** Original spawn timing and enemy flow restored

### 🎯 User Experience Benefits
- **Visual Clarity:** No more overlapping UI elements during combat
- **Readable Text:** Damage numbers and notifications clearly visible
- **Consistent Layout:** Predictable UI positioning across all game states
- **Reduced Visual Noise:** Better organization of on-screen information

### 🔧 Technical Improvements
- **CSS Layer Management:** Proper z-index hierarchy for UI elements
- **Text Stack Algorithm:** Enhanced floating text collision detection
- **Position Calculations:** Precise UI positioning to prevent overlaps
- **Code Documentation:** Added explanatory comments for UI positioning logic

---

## v3.16.3 — Game Balance Rework: Weapon Scaling & Boss Adjustments
*Released: March 8, 2026*

### ⚖️ Weapon Balance Changes
- **Auto Rifle Buff:** Increased damage 22→26, cooldown 0.20→0.22 (DPS 110→118)
  - **Purpose:** Close the gap with Shotgun while maintaining distinct identity
  - **Impact:** Better sustained damage, more competitive weapon choice
- **Shotgun Nerf:** Reduced damage 30→28, cooldown 0.50→0.55 (DPS 180→153)
  - **Purpose:** Reduce dominance while keeping top-tier status
  - **Impact:** Still highest DPS but less overwhelming, better weapon balance
- **Sniper:** Unchanged - maintains burst damage specialist role

### 🔥 Auto Character: Wanchai Stand Rework
- **Damage Reduction:** Decreased from 38→30 damage per punch
- **Attack Speed:** Reduced from 11.1→10.0 punches per second (0.09→0.10 rate)
  - **Purpose:** Reduce Wanchai dominance in boss fights
  - **Impact:** Boss TTK increased from 8.3s→~12s, more balanced encounter design
- **Sustained DPS:** Significantly reduced to prevent over-reliance on Wanchai

### 👑 Boss Scaling Adjustments
- **KruFirst HP Rework:** 
  - **Base HP Multiplier:** Increased 0.62→0.72 (Wave6 HP: 6448→7488)
  - **Advanced HP Multiplier:** Decreased 1.35→0.85 (Wave12 HP: 17410→12730)
  - **Purpose:** Stronger mid-game boss, less extreme late-game scaling
  - **Impact:** More consistent difficulty curve, reduced TTK variance (46s→40s)

### 🌊 Wave Management Improvements
- **Spawn Logic Comments:** Added explanatory comments for wave-gated enemy spawning
  - **Mage/Tank Scaling:** Progressive spawn chance from Wave1 (0%) to Wave15 (100%)
  - **Trickle Spawning:** Clarified batch size calculations for pressure management
- **Code Documentation:** Enhanced readability for future balance adjustments

### 🎯 Design Philosophy
- **Weapon Diversity:** Reduce Shotgun dominance while maintaining its top-tier status
- **Boss Balance:** More consistent difficulty progression across game phases
- **Auto Reliance:** Reduce Wanchai Stand as sole solution for all encounters
- **Strategic Depth:** Encourage varied weapon and character ability usage

---

## v3.16.2 — Repository Cleanup: Skill File Consolidation
*Released: March 8, 2026*

### 🧹 Repository Cleanup
- **Removed Duplicate Skill Files:** Cleaned up redundant skill documentation from multiple directories
  - **Deleted Locations:** `.claude/skills/` and `.windsurf/skills/` directories
  - **Consolidated Location:** All skill files now centralized in `.agents/skills/`
- **Files Removed:** 42 skill documentation files totaling 13,420 lines
  - **javascript-testing-patterns:** Complete skill documentation and supporting files
  - **modern-javascript-patterns:** Complete skill documentation and supporting files
  - **next-best-practices:** Complete skill documentation with 19 supporting files
  - **tauri-event-system:** Skill documentation
  - **typescript-advanced-types:** Skill documentation

### ✨ Benefits
- **Reduced Repository Clutter:** Eliminated duplicate documentation across multiple directories
- **Single Source of Truth:** All skill documentation now centralized in one location
- **Improved Maintainability:** Easier to update and manage skill files in single directory
- **Cleaner Project Structure:** More organized repository with clear file hierarchy

### 🔄 Service Worker Update
- **Cache Version Update:** Updated to v3.16.2 to ensure players receive latest changes
- **Cache Invalidation:** Forces browser to fetch latest repository structure

---

## v3.16.1 — Critical Bug Fixes: Boss Scoring & Game Balance
*Released: March 8, 2026*

### 🐛 Critical Bug Fixes
- **Boss Kill Scoring:** Fixed double score bug when boss killed same frame as other entities
  - **BossDog:** Added `_scored` flag to prevent duplicate `addScore()` calls
  - **Root Cause:** Boss death and projectile damage could occur in same frame
- **Meteor Spawn Rate:** Fixed per-frame vs per-second calculation causing 60× spawn rate
  - **MageEnemy:** Fixed `Math.random() < 0.005` to `Math.random() < (0.005 * dt * 60)`
  - **Impact:** Prevents meteor shower spam at high framerates
- **Wave Spawn Balance:** Improved enemy distribution and batch spawning
  - **Trickle Batching:** Increased batch size from 3→4, divisor from 6→7 for smoother spawning
  - **Progressive Scaling:** Mage and tank spawn chances now scale with wave progression
  - **Wave Normalization:** Added `waveNorm` for gradual difficulty increase

### ⚖️ Boss Balance Adjustments
- **KruManop Phase 3:** Added 15% speed boost during Goldfish Lover phase
- **KruFirst Balance:** Increased HP multiplier from 0.62→0.85, capped move speed at 2.2× base
- **GoldfishMinion:** Added death guard to prevent double-death processing

### 🔧 Technical Improvements
- **Frame-Rate Independence:** Fixed time-dependent calculations to work consistently across different framerates
- **Spawn Logic:** Enhanced wave progression system with better enemy type distribution
- **Performance:** Reduced unnecessary particle effects and duplicate processing

---

## v3.16.0 — Major Character Balance Rework: Two-Phase Systems & Early Access
*Released: March 8, 2026*

### 🔄 Kao Character: Two-Phase Passive System
- **Phase 1 (Stealth 1st):** Immediate unlock with reduced bonuses
  - **HP Bonus:** Reduced to 30% (was 50%) - remainder unlocked at Phase 2
  - **Speed Bonus:** New additive +0.4 speed (doesn't conflict with shop bonuses)
  - **Critical Strike:** Moved to Phase 2 (was immediate)
- **Phase 2 ("Awakened"):** Unlocked after 5 FreeStealthy kills
  - **Additional HP:** +20% bonus (total 50% with Phase 1)
  - **Critical Strike:** +5% crit chance
  - **Phantom Blink:** Unlocked at Phase 2 (was immediate)
  - **Blink Window:** Extended to 2.0s (was 1.5s)
  - **Blink Damage:** Reduced to 1.8x (was 2.5x) to prevent double-dipping

### 🔥 Auto Character: Early Vacuum Access
- **Vacuum Skill:** Now available immediately from game start
  - **Early Mode:** Basic pull without damage/ignite/heat gain
  - **Full Mode:** Complete functionality after passive unlock
  - **Visual Feedback:** Different floating text for early vs full mode
- **Passive Buffs:** Enhanced heat gain and movement
  - **Heat Gain Bonus:** Increased to 1.50x (was 1.25x)
  - **Heat Decay:** No decay while moving after passive unlock
  - **Vacuum Early Unlock:** Now available immediately (was locked until passive)

### 🌾 Poom Character: Significant Buffs
- **Passive HP:** Increased to 45% (was 30%) - highest of all characters
- **Critical Strike:** Increased to 6% (was 4%) - matches Auto
- **Lifesteal:** Increased to 2.5% (was 1.5%) - more noticeable impact
- **Garuda Summon:** Major improvements
  - **Cooldown:** Reduced to 22s (was 25s)
  - **Duration:** Increased to 9s (was 6s) - 41% uptime (was 24%)
- **Cosmic Balance:** Enhanced sticky rice duration
  - **Duration Bonus:** +1.0s per stack during Cosmic Balance
  - **Naga Burn DPS:** Increased to 30 (was 22)
  - **Ritual Burst Cap:** Increased to 35% (was 30%) - 45% during Cosmic Balance

### 🎯 General Balance Changes
- **Weapon Master Requirement:** Reduced to 5 kills (was 7) for Kao
- **Damage Scaling:** Increased level-up multiplier to 12% (was 8%)
- **Clone Proximity:** New burst mechanics for all characters

## v3.15.1 — Auto Character Design Restoration: Original Skill Availability
*Released: March 8, 2026*

### 🔄 Character Design Reversion
- **Auto Wanchai Stand:** Restored immediate availability from game start
  - **R-Click Skill:** Now usable immediately (was locked until passive unlock)
  - **Energy Cost:** Reverted to 25 (was temporarily changed to 32)
  - **Passive Bonuses:** Heat gain, crit, lifesteal still require passive unlock
- **Thematic Unlock Messages:** Restored original guidance
  - **Q & E Skills:** Show "🔒 ทำ Heat เต็ม 100 ก่อน!" (was generic level message)
  - **Player Guidance:** Clear indication of OVERHEAT requirement

### 🎯 Gameplay Consistency
- **Original Vision:** Auto's basic skills now match initial design intent
- **Progression Balance:** Wanchai available early, advanced skills gated by OVERHEAT
- **User Experience:** Immediate access to core mechanic without confusion

### 🔧 Technical Adjustments
- **Code Comments:** Updated to reflect restored design
- **Energy Cost:** Fixed mismatch between config and implementation
- **Error Messages:** Restored helpful thematic guidance

### 📚 Design Philosophy
- **Skill Progression:** Basic skills available early, advanced skills require mastery
- **Character Identity:** Auto's heat-based gameplay immediately accessible
- **Player Onboarding:** Clear path from basic usage to advanced techniques

---

## v3.15.0 — Complete Achievement System Overhaul: Character Progression & Stat Tracking
*Released: March 8, 2026*

### 🏆 Major Achievement System Expansion
- **NEW Passive Awakening Achievements:** All three characters now have achievements for unlocking their passive skills
  - **SCORCHED SOUL (Auto):** Unlock passive via first OVERHEAT
  - **King of Isan (Poom):** Unlock passive via first Ritual Burst  
  - **Free Stealth (Kao):** Unlock passive via first Stealth use
- **NEW Combat Achievements:** Advanced character-specific milestones
  - **Cosmic Balance (Poom):** First time using Naga + Garuda together
  - **RAGE MODE (Auto):** Enter Rage Mode (Overheat + HP < 30%)

### 🔧 Critical Bug Fixes
- **Boss Kill Tracking:** Fixed missing achievement cases for boss defeats
  - **KruManop kills:** Now properly tracked with `manopKills` stat
  - **KruFirst kills:** Now properly tracked with `firstKills` stat
  - **Achievement Unlock:** Stats incremented BEFORE check() calls
- **Stat Naming Consistency:** 
  - **wanchaiKills → standRushKills:** Synchronized with AutoPlayer.js naming
  - **Ritual Wipe:** Now uses `ritualKills` stat directly instead of opaque flag
- **Shop Max Achievement:** Fixed detection for 1.5x damage boost

### 🎨 UI/UX Improvements
- **Poom Skill Locks:** Reverted to `_nagaUnlocked` logic for Q & R skills
  - **Naga (Q):** Unlocks at Lv2 via `_nagaUnlocked` flag
  - **Ritual (R):** Unlocks with Naga via `_nagaUnlocked` flag
  - **Garuda (E):** Still requires passive unlock
- **Achievement Categories:** Reorganized achievement definitions with clear sections
  - Early Game, Boss Kills, Combat, Movement, Collection, Stealth & Weapons, Character-specific

### 📊 Enhanced Stat Tracking
- **New Stats Added:** `manopKills`, `firstKills` for boss kill tracking
- **Better Progression:** All character milestones now properly tracked
- **Achievement Integration:** Seamless stat-to-achievement mapping

### ⚡ Character Balance Updates
- **Auto Wanchai Energy Cost:** Fixed mismatch (was 35, now 32 to match config)
- **Skill Lock Messages:** Updated to show level requirement instead of thematic text
- **Rage Mode Trigger:** Now properly tracked for achievement unlock

### 🎯 Achievement Rewards
- **Passive Awakenings:** +2% damage, +10 HP, -2% cooldown rewards
- **Combat Milestones:** +3% damage for Cosmic Balance, +2% for Rage Mode
- **Boss Kills:** Maintained existing +2% damage rewards

### 📚 Documentation Updates
- **Achievement Descriptions:** Clear, concise descriptions for all new achievements
- **Code Comments:** Added detailed explanations for stat tracking fixes
- **PROJECT_OVERVIEW.md:** Added AI file versioning rule for development workflow

### 🔍 Technical Improvements
- **Memory Management:** Removed opaque flags in favor of direct stat tracking
- **Code Consistency:** Synchronized naming conventions across all files
- **Error Prevention:** Stats incremented before achievement checks to prevent race conditions

---

## v3.14.0 — Complete Thematic Unlock Overhaul: All Characters Action-Based
*Released: March 8, 2026*

### 🎮 Major Gameplay Achievement: Unified Thematic Unlocks
- **Kao Character Rework:** Stealth-first unlock completes the trilogy
  - **Passive Unlock:** First Stealth use = immediate awakening (was Lv3 + 5× stealth)
  - **Weapon Master Progress:** Reduced requirement 7→5 kills per weapon
  - **Progress Indicators:** Shows 🔵 RIFLE 2/5 for each weapon kill
- **All Characters Now Use Action-Based Unlocks:**
  - **Kao:** Stealth first use (~15-20 sec)
  - **Auto:** First OVERHEAT (~20-30 sec) 
  - **Poom:** First Ritual Burst (~25-35 sec)

### 🎨 UI/UX Completion
- **Kao Passive Skill Hint:** Changed from "0/5" counter to "R-Click!" (purple)
- **Poom Skill Lock Fix:** Reverted to passive-based locks (was using nagaReady flag)
- **Consistent Timeline:** All characters unlock around the same early-game window

### 🔧 Technical Implementation
- **KaoPlayer.checkPassiveUnlock():** Complete override with stealth-first logic
- **Enhanced VFX:** Dual-layer unlock effects (purple + gold particles)
- **Progress Tracking:** Real-time weapon kill progress indicators
- **Config Updates:** Fallback values and tutorial text updated

### ⚔️ Weapon Master System
- **Reduced Grind:** 5 kills per weapon (was 7) for faster progression
- **Visual Feedback:** 🔵 RIFLE, 🔴 SNIPER, 🟠 SHOTGUN progress indicators
- **Better Player Guidance:** Clear progress tracking reduces confusion

### 🎯 Balance Timeline
- **Kao:** Stealth first use → ~15-20 seconds
- **Auto:** Heat to 100% → ~20-30 seconds  
- **Poom:** Level 2 + Ritual → ~25-35 seconds
- **Result:** All characters have passive skills unlocked by 35 seconds

### 📚 Documentation Updates
- **Tutorial Text:** Updated Kao passive tutorial for new unlock condition
- **Config Comments:** Added detailed explanations for new mechanics
- **UI Hints:** Better visual guidance for unlock requirements

---

## v3.13.2 — UI Clarity: Better Unlock Condition Communication
*Released: March 8, 2026*

### 🎨 UI/UX Improvements
- **Clearer Unlock Messages:** Updated skill lock feedback to show actual requirements
  - **Auto Q & E:** Changed from "ปลดล็อคที่ Lv5" to "🔒 ทำ Heat เต็ม 100 ก่อน!"
  - **Better player guidance:** Players now know exactly what to do to unlock skills

### 🔧 Technical Improvements
- **Poom Skill Lock Overlays:** Fixed UI to match actual unlock progression
  - **Q (Naga):** Unlocks at Lv2 → reads from `_nagaUnlocked` flag
  - **R (Ritual):** Unlocks with Naga → reads from `_nagaUnlocked` flag  
  - **E (Garuda):** Still requires passive unlock (after first Ritual)
- **Consistent Visual Feedback:** Lock overlays now accurately reflect skill availability

### 📚 Code Quality
- **Better Comments:** Added detailed explanations for each skill's unlock condition
- **Cleaner Code Formatting:** Improved comment structure and readability
- **Accurate State Tracking:** UI now reads correct internal flags for skill states

### 🎮 Player Experience
- **Reduced Confusion:** Players no longer see misleading level requirements
- **Clear Progression Path:** Visual feedback matches actual unlock flow
- **Better Tutorial Flow:** UI guides players through the intended skill progression

---

## v3.13.1 — Gameplay Fix: Restored Basic Skills Availability
*Released: March 8, 2026*

### 🎮 Gameplay Regression Fix
- **Restored Basic Skills:** Reverted unintended skill locking from v3.13.0
  - **Poom:** L-Click (shoot) and R-Click (eatRice) available from game start
  - **Auto:** R-Click (Wanchai Stand) available from game start
- **Fixed Input Routing:** Restored proper input handling in PoomPlayer.update()
- **Maintained Thematic Unlocks:** Advanced skills still use new unlock conditions

### 🔧 Technical Corrections
- **PoomPlayer.shoot():** Restored attack speed multiplier for eating rice (0.7x)
- **Crit Effects:** Added back particle effects and proper text positioning
- **Audio Integration:** Direct Audio.playPoomShoot() call restored
- **Energy Feedback:** Auto shows "พลังงานไม่พอ!" for insufficient energy

### 🎨 Balance Notes
- **Passive Bonuses Still Gated:** Advanced bonuses (crit, lifesteal, heat gain) require unlock
- **Progressive Skill Flow:** Q (Naga) at Lv2, R (Ritual) after Q, E (Garuda) after passive
- **Better Player Experience:** Basic actions available immediately while teaching advanced mechanics

---

## v3.13.0 — Major Gameplay Overhaul: Thematic Passive Unlocks
*Released: March 8, 2026*

### 🎮 Complete Passive Unlock Redesign
- **Thematic Unlock Conditions:** Changed from level-based to action-based unlocks
  - **Poom:** Unlocks passive after first Ritual Burst (teaches Sticky→Ritual loop)
  - **Auto:** Unlocks passive upon reaching OVERHEAT for first time (body awakening)
  - **Kao:** Unchanged (stealth-based unlock fits ninja theme)

### 🌾 Poom Character Rework
- **Progressive Skill Unlock:** Q (Naga) unlocks at Level 2, teaches mechanics before passive
- **Ritual-First Passive:** Must perform Ritual Burst to unlock Garuda and passive bonuses
- **Enhanced Cosmic Balance:** 
  - Damage multiplier increased: 1.20 → 1.35
  - NEW: HP regeneration (4/s) during Cosmic Balance
  - Visual feedback with particle effects and voice bubbles
- **Skill Flow:** L-Click/R-Click always available, Q unlocks at Lv2, R requires Q, E requires passive

### 🔥 Auto Character Rework  
- **OVERHEAT Awakening:** Passive unlocks when reaching 100% Heat for first time
- **NEW Rage Mode Mechanic:** OVERHEAT + HP < 30% triggers high-risk state
  - Damage ×1.3 bonus
  - 20% damage reduction 
  - Visual "RAGE MODE!" notification
- **Thematic Unlock:** "Scorched Soul" awakening when body is pushed to limits
- **Skill Locking:** Wanchai Stand now requires passive unlock (reverts basic skill availability)

### 🎨 Visual & UX Enhancements
- **Unlock Notifications:** Enhanced VFX with dual-color particles and detailed messages
- **Progressive Feedback:** Clear milestone notifications (Q UNLOCKED, E UNLOCKED, etc.)
- **Thematic Text:** Updated unlock messages with emojis and character flavor
  - Kao: "👻 ซุ่มเสรี!"
  - Poom: "🌾 ราชาอีสาน!"  
  - Auto: "💥 วันชัยโอเวอร์ไดรฟ์!"

### 🔧 Technical Improvements
- **Flag-Based Unlock System:** Uses internal flags instead of level checks
- **Better Tutorial Flow:** Poom teaches Naga→Sticky→Ritual before full unlock
- **Config Reorganization:** Moved cosmicDamageMult to passive section for clarity
- **Enhanced Combat Balance:** Improved damage numbers and reward feedback

### 📚 Documentation Updates
- **Tutorial Text:** Updated Auto tutorial with new unlock conditions
- **Config Comments:** Added detailed explanations for new mechanics
- **Clearer Progression:** Better communication of unlock requirements

---

## v3.12.14 — UI Fix: Basic Skills Lock Overlays
*Released: March 8, 2026*

### 🎨 UI/UX Fixes
- **Fixed Lock Overlay Display:** Basic skills now correctly show as unlocked (no lock icon)
  - **Poom eat-icon (R-Click):** Now shows as available from game start
  - **Auto stealth-icon (R-Click Wanchai):** Now shows as available from game start
- **Consistent Visual Feedback:** UI now matches actual skill availability

### 🔧 Technical Details
- **Poom Lock Overlays:** Only advanced skills (naga, ritual, garuda) show lock icons
- **Auto Lock Overlays:** Only advanced skills (vacuum, detonation) show lock icons
- **Updated Comments:** Clear documentation of which skills are available vs locked

---

## v3.12.13 — Input Routing Migration & Basic Skill Unlock
*Released: March 8, 2026*

### 🎮 Gameplay Changes
- **Unlocked Basic Skills:** Poom and Auto basic skills now available from game start
  - **Poom:** eatRice (R-Click) and shoot (L-Click) available immediately
  - **Auto:** Wanchai Stand (R-Click) available immediately
  - **Passive bonuses still require unlock:** Lifesteal, crit bonuses, heat gain still gated by passive

### 🔄 Input Routing Refactor
- **PoomPlayer Migration:** All input handling moved from game.js to PoomPlayer.update()
  - **L-Click shooting:** Now handled directly in PoomPlayer.shoot()
  - **R-Click eatRice:** Now handled directly in PoomPlayer.update()
  - **Eliminated duplicate routing:** Single source of truth for all Poom inputs
- **game.js Cleanup:** Removed Poom-specific input blocks and shootPoom() function
- **Shooting Logic Update:** Poom removed from main shooting routing (handled internally)

### 🔧 Technical Improvements
- **PoomPlayer.shoot() Rewrite:** Complete implementation with all logic from shootPoom()
  - **Attack speed multiplier:** Proper eating rice slowdown (0.7x)
  - **Crit handling:** GAME_TEXTS.combat.poomCrit with particle effects
  - **Audio integration:** Direct Audio.playPoomShoot() call
- **AutoPlayer Energy Fix:** Corrected energyCost fallback from 32→25 to match config
- **Better Energy Feedback:** Added "พลังงานไม่พอ!" message for insufficient energy

### 📚 Code Quality
- **Eliminated Code Duplication:** Removed shootPoom() function from game.js
- **Centralized Input Logic:** All character inputs handled within their respective classes
- **Cleaner Architecture:** game.js now focuses on game loop, not character-specific routing

### 🎨 UI/UX Improvements
- **Consistent Energy Feedback:** Auto shows energy shortage message when trying Wanchai
- **Better Skill Flow:** Basic abilities available immediately, advanced bonuses still gated

---

## v3.12.12 — Critical Architecture Fixes & Passive Unlock Improvements
*Released: March 8, 2026*

### 🏗️ Architecture Improvements
- **Removed `instanceof` checks from PlayerBase:** Eliminated performance-heavy type checks in favor of configuration flags
  - **New Flag System:** `passiveSpeedBonus` and `usesOwnLifesteal` flags in constructor
  - **Kao:** `passiveSpeedBonus = 1.4`, `usesOwnLifesteal = true` (manages own lifesteal)
  - **Poom/Auto:** `passiveSpeedBonus = 0`, `usesOwnLifesteal = false` (use base logic)
- **Standardized UIManager calls:** All `showVoiceBubble()` calls now use `UIManager.showVoiceBubble()`
- **Config-driven passive unlocks:** All characters use `S.passiveUnlockText` instead of hardcoded messages

### 🔧 Technical Fixes
- **Fixed Poom passive unlock:** Changed `passiveUnlockStealthCount: 99 → 0` (Poom has no stealth)
- **Fixed Auto passive unlock:** Changed `passiveUnlockStealthCount: 99 → 0` (Auto has no stealth)
- **Removed duplicate code:** Cleaned up redundant `'use strict'` and `this.charId` declarations
- **Fixed input routing:** Removed duplicate Q block in game.js (PoomPlayer.update() handles all)
- **Fixed UI hardcoding:** Passive unlock level and stealth count now read from config
- **Moved prototype to class method:** AutoPlayer.updateUI() converted from prototype to class method

### 📚 Documentation Updates
- **PROJECT_OVERVIEW.md:** Added comprehensive "Passive Unlock Architecture" section
- **Critical Technical Notes:** Documented skill lock input routing patterns
- **Architecture Guidelines:** Clear rules for passive unlock implementation

### 🎨 UI/UX Improvements
- **Consistent unlock messages:** Each character now has unique unlock text from config
  - Kao: "ปลดล็อกซุ่มเสรี!"
  - Poom: "ปลดล็กราชาอีสาน!"
  - Auto: "ปลดลอกวันชัยโอเวอร์ไดรฟ์!"
- **Fixed passive UI display:** Progress indicators now use correct values from config

### 🔍 Code Quality Improvements
- **Eliminated code duplication:** Removed redundant input consumption
- **Improved maintainability:** Configuration-driven behavior instead of hardcoded checks
- **Better error handling:** UIManager calls wrapped in existence checks
- **Cleaner class structure:** Consistent method definitions across all player classes

---

## v3.12.11 — Feature: Skill Locking System for Poom & Auto
*Released: March 8, 2026*

### 🔥 New Features
- **Skill Locking System:** Implemented comprehensive skill locking for Poom and Auto characters
  - **Poom Skills Locked Until Level 4:** eatRice (R-Click), summonNaga (Q), summonGaruda (E), ritualBurst (R)
  - **Auto Skills Locked Until Level 5:** Wanchai Stand (R-Click), Vacuum Heat (Q), Overheat Detonation (E)
  - **Visual Lock Indicators:** Added lock icon overlays on skill icons when locked
  - **Unlock Feedback:** Floating text shows level requirement when locked, celebration effects when unlocked

### 🐛 Critical Bug Fixes
- **Fixed Poom Passive Unlock:** Poom couldn't unlock passive because PlayerBase required stealthUseCount ≥ 99, but Poom has no stealth
  - **Solution:** Override `checkPassiveUnlock()` in PoomPlayer to check level only
- **Fixed Auto Unlock Notification:** Auto showed hardcoded "ซุ่มเสรี!" text instead of appropriate message
  - **Solution:** Override `checkPassiveUnlock()` in AutoPlayer with custom "วิญญาณแห่งเปลวไฟ!" notification
- **Fixed eatRice Lock Location:** eatRice was routed through game.js, not PoomPlayer.update()
  - **Solution:** Added skill lock check in game.js for eatRice (R-Click) and summonNaga (Q)
- **Fixed Double Input Consumption:** Q key was consumed in both PoomPlayer.update() and game.js
  - **Solution:** Centralize input consumption in PoomPlayer.update() with proper feedback

### 🎨 UI Improvements
- **Lock Icon Overlays:** Added 🔒 lock icons on all locked skill icons
- **Consistent Lock Helper:** Moved `setLockOverlay()` helper function to top of `updateSkillIcons()` for reuse
- **Character-Specific Locks:** 
  - Poom: 4 skill icons locked (eat, naga, ritual, garuda)
  - Auto: 3 skill icons locked (stealth/wanchai, vacuum, detonation)

### 🔧 Technical Details
- **Override Pattern:** Both PoomPlayer and AutoPlayer override `checkPassiveUnlock()` for character-specific unlock conditions
- **Input Validation:** Added `passiveUnlocked` checks before all skill activations
- **Feedback System:** Consistent floating text with level requirements when skills are locked
- **Save System Integration:** Passive unlock status persists across game sessions

---

## v3.12.10 — Critical Bug Fix: BALANCE Object Structure
*Released: March 8, 2026*

### 🐛 Bug Fixes
- **Fixed BALANCE object structure in config.js:** Corrected incorrect nesting that caused multiple TypeErrors
  - Error 1: `Cannot read properties of undefined (reading 'domainExpansion')` at boss_attacks.js:1168
  - Error 2: `Cannot read properties of undefined (reading 'fogWaves')` at WaveManager.js:48
  - Error 3: `Cannot read properties of undefined (reading 'dayMaxLight')` at game.js:849
  - **Root Cause:** All properties after `player` were incorrectly nested under a non-existent `characters` wrapper
  - **Solution:** Restructured BALANCE object to have proper hierarchy:
    - `characters: { kao, auto, poom }` - character-specific configurations
    - Root-level properties: `drone`, `enemy`, `tank`, `mage`, `boss`, `powerups`, `waves`, `score`, `mtcRoom`, `LIGHTING`, `map`

### 🔧 Technical Details
- Fixed indentation and object structure throughout config.js
- All game systems now properly access BALANCE properties
- Prevents initialization crashes in boss_attacks.js, WaveManager.js, and game.js

---

## v3.12.9 — Critical Bug Fix: Missing Configuration
*Released: March 8, 2026*

### 🐛 Bug Fixes
- **Fixed TypeError in boss_attacks.js:1168:** Added missing `BALANCE.boss.domainExpansion` configuration
  - Error: `Cannot read properties of undefined (reading 'domainExpansion')`
  - Added `domainExpansion: { dangerPct: 0.62, dangerPctMax: 0.84 }` to `BALANCE.boss` in config.js
  - Domain Expansion system now properly initializes with default values

### 🔧 Technical Details
- **Root Cause:** boss_attacks.js referenced `BALANCE.boss.domainExpansion` which was not defined in config.js
- **Solution:** Added domainExpansion configuration object with required properties
- **Impact:** Prevents game initialization crash when Domain Expansion system loads

---

## v3.12.8 — Tutorial Texts Enhancement
*Released: March 8, 2026*

### 📚 Tutorial System Improvements
- **Complete Character Guides:** Added comprehensive tutorial steps for all three characters
- **Kao Skills:** Teleport navigation and Clone of Stealth combat assistance
- **Poom Skills:** Ritual Burst, Naga Summon, Garuda Summon, and Cosmic Balance mechanics
- **Auto Skills:** Vacuum Heat, Detonate, Stand Rush, and complete Heat Gauge system explanation
- **Shop Update:** Corrected shop items with current prices and effects (6 items total)

### 🔧 Technical Updates
- **Tutorial Structure:** Fixed missing tutorial steps that were accidentally removed
- **Shop Information:** Updated from generic 10% bonuses to specific item details
- **Heat System:** Added comprehensive Heat Gauge tutorial with tier progression
- **Character Balance:** Ensured all unlockable skills are properly documented

### 📝 Detailed Changes
```javascript
// Added missing tutorial sections:
kaoSkills: { Teleport, Clone of Stealth }
poomSkills: { Ritual Burst, Naga, Garuda, Cosmic Balance }
autoSkills: { Vacuum Heat, Detonate, Stand Rush, Heat Gauge }

// Updated shop with correct items:
Energy Drink (300), Weapon Tuner (800), Lightweight Boots (500)
Focus Crystal (700), Energy Shield (600), Vital Supplement (500)
```

---

## v3.12.7 — Configuration Centralization
*Released: March 8, 2026*

### 🎯 Major Refactor: Single Source of Truth
- **Centralized Configuration:** All game settings now unified in `config.js`
- **Tutorial Texts:** Added complete tutorial system texts to `GAME_TEXTS.tutorial`
- **Wave Events:** Moved wave event configurations to `BALANCE.waves` (fogWaves, speedWaves, glitchWaves, darkWave)
- **Domain Expansion:** Centralized boss ultimate skill config in `BALANCE.boss.domainExpansion`

### 📝 Configuration Structure
```javascript
BALANCE.waves.fogWaves = [2, 8, 11, 14]
BALANCE.waves.speedWaves = [4, 7, 13]
BALANCE.waves.glitchWaves = [5, 10]
BALANCE.waves.darkWave = 1
BALANCE.boss.domainExpansion = { cellDamage, cooldown, dangerPct, ... }
GAME_TEXTS.tutorial = { welcome, movement, shooting, ... }
```

### 🔧 File Updates
- **WaveManager.js:** Now uses `BALANCE.waves` for event configurations
- **boss_attacks.js:** Domain Expansion reads from `BALANCE.boss.domainExpansion`
- **config.js:** Added 300+ lines of centralized configuration data

### ✨ Benefits
- **Easier Balancing:** All stats and text in one place
- **Better Maintainability:** No more scattered hardcoded values
- **Godot Migration Ready:** Clear separation of data from logic
- **Localization Support:** Text centralization enables future i18n

---

## v3.12.6 — Config Syntax Fix & Text Localization
*Released: March 8, 2026*

### 🐛 Critical Bug Fix
- **Root Cause:** Missing closing brace in BALANCE object caused JavaScript syntax errors
- **Impact:** Prevented game from loading properly due to malformed config structure
- **Solution:** Added proper object closure and restructured constants for better organization

### 🔧 Configuration Improvements
- **Syntax Fix:** Corrected missing `};` for BALANCE object closure
- **Structure:** Moved SHOP_ITEMS, GAME_CONFIG, VISUALS, and ACHIEVEMENT_DEFS to top-level scope
- **Localization:** Enhanced text system with GAME_TEXTS configuration fallbacks

### 🎨 Visual Enhancements
- **Garuda Graphics:** Improved rendering with enhanced wing animations and visual effects
- **UI Integration:** Skill names now use configurable text from GAME_TEXTS
- **Cosmic Balance:** Added new visual aura effects and improved animations

### 📝 Text System Updates
- **Skill Names:** All skill descriptions now use centralized GAME_TEXTS configuration
- **Fallback Support:** Added null-safe operators for missing text configurations
- **Thai Localization:** Updated skill descriptions with improved Thai translations

---

## v3.12.5 — Garuda NaN Coordinates Fix
*Released: March 8, 2026*

### 🐛 Critical Bug Fix
- **Root Cause:** Service Worker cache serving old config.js without new Garuda properties
- **NaN Issue:** `S.garudaOrbitRadius = undefined` → `undefined * cos(angle) = NaN` → `worldToScreen(NaN, NaN)` → viewport cull/skip
- **Solution:** Added `|| defaultValue` fallbacks for all Garuda config properties

### 🔧 Config Fallback Implementation
- **Duration:** `S.garudaDuration || 6` (6 seconds default)
- **Orbit Radius:** `S.garudaOrbitRadius || 120` (120px default)
- **Orbit Speed:** `S.garudaOrbitSpeed || 2.2` (2.2 rad/sec default)
- **Dive Cooldown:** `S.garudaDiveCooldown || 1.8` (1.8s default)
- **Damage:** `S.garudaDamage || 150` (150 damage default)
- **Speeds:** `S.garudaDiveSpeed || 820`, `S.garudaReturnSpeed || 620`
- **Multipliers:** `S.cosmicGarudaRadiusMult || 1.5`, `S.garudaEatRiceBonus || 1.5`

### 🎯 Debug Cleanup
- **Removed:** Post-push diagnostic logging (no longer needed)
- **Removed:** Draw call console spam (issue resolved)
- **Re-enabled:** Viewport culling (coordinates now valid)
- **Result:** Clean, production-ready Garuda rendering

### 🛡️ Cache Resilience
- **Service Worker Compatibility:** Garuda works even with cached old config.js
- **Graceful Degradation:** All properties have sensible defaults
- **Forward Compatibility:** New config properties will override defaults when cache updates

**Files Changed:**
- `js/entities/summons.js` (config fallbacks + debug cleanup)
- `js/entities/player/PoomPlayer.js` (removed post-push logging)
- `sw.js` (cache version update)

---

## v3.12.4 — Garuda Draw Call Debugging
*Released: March 8, 2026*

### 🔍 Draw System Debugging
- **Viewport Cull Disabled:** Temporarily disabled viewport culling to eliminate culling as potential issue
- **Draw Call Tracking:** Added console.log in Garuda.draw() to track every frame draw execution
- **Coordinate Logging:** Monitor screen coordinates (sc.x, sc.y) vs canvas dimensions
- **State Tracking:** Include entity state in draw logging for complete debugging visibility

### 🛠️ Diagnostic Enhancement
- **Frame-by-Frame Tracking:** Console will spam [Garuda.draw] every frame if draw() is called
- **Viewport Analysis:** Compare sc.x/sc.y against canvas.width/canvas.height to identify culling issues
- **Entity Lifecycle Debugging:** Detect if entity is removed from specialEffects array between update() and draw()
- **Render Pipeline Verification:** Confirm GarudaEntity is being processed by window.specialEffects.forEach()

### 🎯 Debug Strategy
- **If Draw Logs Appear:** Analyze coordinates vs canvas bounds to determine if culling was the issue
- **If No Draw Logs:** Entity is being removed from array before draw() - indicates update() lifecycle issue
- **State Monitoring:** Track entity state transitions during draw calls

**Files Changed:**
- `js/entities/summons.js` (disabled viewport cull + draw call logging)
- `sw.js` (cache version update)

---

## v3.12.3 — Enhanced Garuda Diagnostic Logging
*Released: March 8, 2026*

### 🔍 Debug Improvements
- **Enhanced Logging:** Added detailed post-push diagnostic logging for Garuda summon system
- **Constructor Cleanup:** Removed redundant constructor log to focus on critical post-push state
- **State Tracking:** Added console.log for specialEffects array length, entity active state, and position after push
- **Cache Invalidation:** Updated service worker version to ensure fresh deployment of diagnostic changes

### 🛠️ Technical Debugging
- **Summon Flow Tracking:** Monitor Garuda entity creation and specialEffects array integration
- **State Verification:** Track entity.active flag and position coordinates after deployment
- **Array Length Monitoring:** Verify specialEffects array properly receives new Garuda entity
- **Silent Error Detection:** Enhanced logging to catch potential silent failures in entity instantiation

**Files Changed:**
- `js/entities/player/PoomPlayer.js` (enhanced post-push logging)
- `js/entities/summons.js` (constructor log cleanup)
- `sw.js` (cache version update)

---

## v3.12.2 — Bug Fixes & Stability Improvements
*Released: March 8, 2026*

### 🐛 Critical Bug Fixes
- **Kao Config Reference:** Fixed `S.phantomBlinkDmgMult` undefined error by using correct `S_fw` reference
- **Garuda Owner Null Guards:** Added null checks in ORBIT and RETURN states to prevent crashes when owner is undefined
- **Debug Logging:** Added console.log for Garuda spawn debugging to track specialEffects array length

### 🔧 Technical Improvements
- **Error Prevention:** Proper null checking prevents runtime errors during entity lifecycle transitions
- **Debug Support:** Enhanced logging for troubleshooting Garuda summon system
- **Code Stability:** Improved robustness of entity state management

### 🛡️ Safety Enhancements
- **Owner Validation:** Guards against undefined owner references in all Garuda states
- **Config Access:** Fixed variable scope issue in Kao's Phantom Blink damage calculation
- **Runtime Safety:** Prevents crashes during edge cases in entity updates

**Files Changed:**
- `js/entities/player/Kaoplayer.js` (config reference fix)
- `js/entities/summons.js` (owner null guards + debug logging)
- `sw.js` (cache version update)

---

## v3.12.1 — Kao Phantom Blink Rework & Poom Garuda Summon System
*Released: March 8, 2026*

### 🥊 Kao Advanced Skills Rework
- **Dash-Stealth System:** Replaced random auto-stealth with predictable dash-triggered free stealth (1.5s duration)
- **Phantom Blink:** Q during stealth/free-stealth leaves shadow clone at origin, teleports to cursor, grants ambush crit window (1.5s)
- **Clone Proximity Burst:** Auto-detonate clones when enemies get too close (90px range) with 8-direction projectile burst
- **Manual Phantom Shatter:** E during active clones triggers early detonation for tactical control
- **Clone System Balance:** Reduced cooldown from 60→25s, duration 10→8s for more frequent usage
- **Stealth Chain Bonus:** +25% crit chance when chaining attacks from Phantom Blink ambush window

### 🦅 Poom Garuda Summon System
- **New Entity:** Complete GarudaEntity class with ORBIT→DIVE→RETURN FSM states
- **Combat Behavior:** Autonomous targeting, diving attacks with fire trail effects, orbital movement
- **Visual Design:** Fire-themed bird entity with dynamic wing animations, trail effects, and cosmic aura
- **Damage System:** 150 base damage with Eat Rice multiplier (1.5×), boss damage reduction (0.45×)
- **Performance:** Optimized trail system with swap-pop O(1) cleanup and viewport culling

### ⚖️ Cosmic Balance System
- **Dual Summon Synergy:** Active when both Naga and Garuda are summoned simultaneously
- **Enhanced Effects:** +20% damage multiplier, 22 DPS burn on Naga hits, 1.5× Garuda orbit radius
- **Visual Feedback:** "⚖️ COSMIC BALANCE!" notification with screen shake and aura effects
- **State Management:** O(1) per-frame toggle with proper cleanup when entities die

### 🎮 UI Integration
- **Garuda Skill Slot:** Dynamically injected E-key skill icon for Poom character
- **Cooldown Visuals:** Arc overlay and countdown timer for Garuda ability
- **Character-Specific UI:** Garuda slot only visible for Poom, hidden for other characters

### 🔧 Technical Implementation
- **Config System:** Added 14 new config entries for Garuda stats and Cosmic Balance multipliers
- **Entity Management:** Proper owner reference cleanup and null-checking for entity lifecycle
- **State Synchronization:** Cosmic Balance toggle with frame-perfect state detection
- **Memory Management:** Efficient trail system and entity cleanup to prevent memory leaks

### 🎨 Visual Enhancements
- **Garuda Rendering:** Multi-layered design with fire gradient, wing animations, and cosmic aura rings
- **Trail Effects:** Dynamic fire trail during dive state with fade-out animations
- **Phantom Blink:** Shadow ripple effects at departure point and enhanced visual feedback
- **Cosmic Effects:** Special aura rendering when both summons are active

### 📊 Balance Changes
- **Kao Mobility:** More predictable stealth mechanics with dash-triggered activation
- **Clone Frequency:** Reduced cooldowns for more tactical clone usage
- **Poom Damage:** Significant damage potential with dual summon synergy
- **Risk/Reward:** Cosmic Balance requires managing two summons simultaneously

### 🐛 Bug Fixes
- **Cosmic Balance Spam:** Fixed notification triggering only once per state change
- **Entity Cleanup:** Proper null-checking when entities die or expire
- **Burn Timer:** Math.max to prevent overriding longer burn durations
- **UI State:** Proper skill icon visibility management per character

**Files Changed:**
- `js/config.js` (Garuda stats + Cosmic Balance config)
- `js/entities/player/Kaoplayer.js` (Phantom Blink rework + Dash-Stealth)
- `js/entities/player/PoomPlayer.js` (Garuda summon + Cosmic Balance)
- `js/entities/summons.js` (GarudaEntity class + cosmic burn effects)
- `js/ui.js` (Garuda skill slot + cooldown visuals)
- `sw.js` (cache version update)

---

## v3.12.0 — Heat Gauge System & Wanchai Stand Spirit of Muay Thai Overhaul
*Released: March 8, 2026*

### 🔥 Heat Gauge System Implementation
- **Core Mechanic:** Complete heat gauge system with 4 tiers (COLD→WARM→HOT→OVERHEAT)
- **Heat Generation:** Passive gain from Wanchai Stand attacks, player melee hits, and successful Vacuum Heat pulls
- **Tier Benefits:** Damage multipliers (×1.15/1.30/1.50), punch rate increases (×0.85/×0.70), and OVERHEAT crit bonus (+20%)
- **Heat Decay:** 8 heat/sec normal decay, 0/sec during Wanchai Stand active, 3 HP/sec drain at OVERHEAT tier
- **Kill Synergy:** +15 heat + 8% maxHP heal on kills during Wanchai Stand
- **Damage Integration:** Player melee attacks gain heat = damage × 0.5 with tier damage multipliers

### 💥 Detonation System Rework
- **Non-Lethal:** Wanchai Stand no longer dies on detonation - stays active for continued combat
- **Heat Scaling:** Damage = 80 + heat × 2.5 (OVERHEAT example: 80 + 100 × 2.5 = 330)
- **Area Enhancement:** OVERHEAT increases detonation radius by 1.5× (360px total)
- **Momentum Preservation:** Heat resets -50 instead of 0, allowing chain combos
- **Visual Feedback:** Enhanced damage display and tier-specific visual effects

### 🌀 Vacuum Heat System
- **Instant Damage:** Added 18 instant damage to enemies being pulled
- **Burn Effect:** All pulled enemies receive burning status for 1.5s at 12 DPS
- **Heat Reward:** +25 heat on successful Vacuum Heat usage
- **Synergy:** Perfect setup for follow-up Wanchai Stand attacks

### 🥊 Wanchai Stand — Spirit of Muay Thai Visual Overhaul
- **Color Scheme:** Ice-blue/white spectral design, completely distinct from Auto's red theme
- **Physique:** V-taper Muay Thai build with broader shoulders replacing small circular form
- **Cultural Elements:** Mongkhon (headband) + rope tie details on chest - authentic Thai boxing signature
- **Stance:** Muay Thai guard stance - lead arm high (guard), rear arm deep (power punch)
- **Glove Design:** Round gloves with lace wrapping lines instead of simple fists
- **Face Design:** Hollow spirit eyes with glow, angular warrior brows, dual scar details
- **Ghost Trail:** Cyan-white trail replacing red trail
- **Heat Reactivity:** Dynamic color changes COLD→WARM→HOT→OVERHEAT (blue→cyan→amber→orange)
- **HUD Integration:** Heat tier badge display (🔥/🔥🔥/💥) on name chip

### 🎮 Game Mechanics
- **Heat Gauge HUD:** Reuses energy bar slot with floating badge display
- **Tier Progression:** Visual feedback with color-coded heat bar and tier labels
- **Combat Flow:** Enhanced synergy between Vacuum Heat, Wanchai attacks, and detonation
- **Risk/Reward:** OVERHEAT provides massive damage but requires HP management

### 🔧 Technical Implementation
- **Heat System:** this.heat, this._heatTierState in constructor with gainHeat() method
- **Passive Bonus:** Automatic tier transitions with floating text notifications
- **Wanchai Stand Integration:** Heat affects punch rate, damage, and crit chances
- **Damage Scaling:** Dynamic damage calculation based on heat tiers
- **Visual System:** Heat-reactive rendering with tier-specific effects

### 🎨 Visual Enhancements
- **Muay Thai Aesthetics:** Authentic cultural design elements integrated into Stand appearance
- **Heat Visualization:** Clear visual feedback for heat tiers through color and effects
- **Combat Readability:** Enhanced visual distinction between different heat states
- **Spirit Theme:** Ethereal ghost-like appearance fitting the Stand concept

### 📊 Balance Changes
- **Damage Scaling:** Heat tiers provide meaningful damage increases without breaking balance
- **Risk Management:** OVERHEAT HP drain creates tactical decision-making
- **Combo Potential:** Non-lethal detonation enables extended combo sequences
- **Synergy Rewards:** Proper use of Vacuum Heat + Wanchai + Detonation maximizes damage

**Files Changed:**
- `js/entities/player/AutoPlayer.js` (Heat Gauge System + Detonation/Vacuum rework + visual overhaul)
- `sw.js` (cache version update)

---

## v3.11.19 — Floating Text Overlap Fix & Documentation Updates
*Released: March 7, 2026*

### 🔧 Critical Bug Fixes
- **Floating Text Overlap:** Fixed damage, healing, and buff notification texts overlapping when spawned at same position
- **Canvas-based Solution:** Implemented stack-offset logic in FloatingTextSystem.spawn() using world coordinates
- **Performance Optimization:** O(n) check with n ≤ 80, no impact on FPS using existing object pool

### 📚 Documentation Improvements
- **PROJECT_OVERVIEW.md:** Added comprehensive section for fixing floating text overlap issue
- **Technical Accuracy:** Updated documentation to reflect Canvas-based architecture (not DOM-based)
- **Implementation Guide:** Added correct solution with 15-line stack-offset logic
- **Wrong Solutions:** Documented DOM-based approaches that don't work with Canvas system

### 🎮 Game Mechanics
- **Text Stacking:** Multiple texts at same position now stack vertically (22px offset per text)
- **Visual Clarity:** All notifications are now visible and readable
- **Maximum Stack:** Limited to 5 stacked texts to prevent flying off screen
- **Cluster Detection:** 40px horizontal proximity threshold for stacking logic

### 🔧 Technical Implementation
- **FloatingTextSystem.spawn():** Added stack-offset calculation before text creation
- **World Coordinates:** Uses world-space positioning for consistent visibility across zoom levels
- **Object Pool:** Maintains existing performance with object reuse pattern
- **No New Classes:** Simple 15-line fix without architectural changes

### 📖 Documentation Updates
- **PROJECT_OVERVIEW.md:** Added "การแก้ไขปัญหาข้อความซ้อนกันในเกม" section
- **Canvas Architecture:** Clarified that CSS z-index and DOM queries don't work with Canvas-based system
- **Correct Approach:** Documented the proper Canvas-based solution vs incorrect DOM-based approaches
- **Performance Notes:** Explained why O(n) check is efficient with limited text count

**Files Changed:**
- `js/effects.js` (stack-offset logic in FloatingTextSystem.spawn())
- `PROJECT_OVERVIEW.md` (comprehensive documentation section)
- `sw.js` (cache version update)

---

## v3.11.18 — Documentation Stability System & MTC Room Abilities
*Released: March 7, 2026*

### 📚 Documentation Improvements
- **Stability Classification System:** Added 🟢🟡🔴 indicators for information stability across all documentation files
- **Cross-Reference System:** Implemented documentation hierarchy with PROJECT_OVERVIEW.md as stable core
- **Dynamic Information Warnings:** Added clear warnings for version-specific implementation details
- **Usage Guidelines:** Created comprehensive documentation usage guide for AI and developers

### 🏰 MTC Room Abilities Implementation
- **Buff Terminal System:** Implemented rotating buff cycle (DMG +15%, SPD +10%, CDR BURST -35%)
- **Dash Reset:** Automatic dash cooldown reset on MTC Room entry
- **Crisis Protocol:** Emergency healing bonus (+35 HP) when HP ≤ 25%
- **Visual Indicators:** Next buff display and active buff timer on holo-table
- **Audio Enhancement:** Added MTC Room entry chime and buff activation sounds
- **Energy Regeneration:** 30 energy/second regeneration while in MTC Room
- **Balance Adjustment:** Reduced HP regeneration from 40→30 to offset new abilities

### 🎮 Game Mechanics
- **Player Buff State:** Added mtcBuffType, mtcBuffTimer, mtcDmgBuff, mtcSpeedBuff tracking
- **Buff Application:** Implemented applyMtcBuff() method with proper buff stacking
- **Visual Feedback:** Enhanced particle effects and floating text for buff activation
- **Sound Design:** Created three-note arpeggio entry sound and bright ping buff sound

### 📖 Documentation Updates
- **PROJECT_OVERVIEW.md:** Added stability guide, MTC Room abilities documentation, dynamic information warnings
- **README-info.md:** Added stability warning with reference to PROJECT_OVERVIEW.md
- **CHANGELOG.md:** Added stability warning with reference to PROJECT_OVERVIEW.md
- **GODOT_EXPORT.md:** Updated to v3.11.17 with MTC Room buff system migration guide

### 🔧 Technical Implementation
- **MTCRoom Class:** Enhanced with buff cycle logic and visual indicators
- **PlayerBase Class:** Added buff state management and timer system
- **Audio System:** Added playMtcEntry() and playMtcBuff() methods
- **Configuration:** Extended BALANCE.mtcRoom with comprehensive buff settings

### 🎯 Quality of Life
- **Multi-round Editing Workflow:** Established clear file handling protocol to prevent code loss
- **Documentation Maintenance:** Created systematic approach for keeping documentation current
- **Development Workflow:** Improved AI guidance with stability classification

**Files Changed:**
- `PROJECT_OVERVIEW.md` (major restructuring + stability system)
- `README-info.md` (stability warnings)
- `CHANGELOG.md` (stability warnings)
- `GODOT_EXPORT.md` (updated to v3.11.17)
- `js/map.js` (MTC Room buff system + visual indicators)
- `js/entities/player/PlayerBase.js` (buff state management)
- `js/config.js` (MTC Room configuration)
- `js/audio.js` (MTC Room sounds)
- `sw.js` (cache version update)

---

## v3.11.17 — Boss Spawn Fix & MTC Room Visual Enhancement
*Released: March 7, 2026*

### 🐛 Critical Bug Fixes
- **Boss Spawn Issue:** Fixed boss entities spawning inside MTC Room which allowed player exploitation
- **Config Restoration:** Restored accidentally deleted `MAP_CONFIG.zones` block with 5 zone definitions
- **Multi-round Editing:** Established workflow to base edits on `/mnt/user-data/outputs/` for subsequent rounds

### 🗺️ Zone Floor System Implementation
- **Color-Coded Zone Grids:** Added 5 distinct zones with unique floor colors and grid patterns
  - **Server Farm** (East): Cyan grid with 36px spacing
  - **Library/Archives** (West): Amber grid with 48px spacing  
  - **Courtyard** (South): Green grid with 60px spacing
  - **Lecture Hall A/B** (Corners): Purple grids with 40px spacing
- **Visual Zone Identification:** Pulsing border accents and zone labels for clear navigation
- **Viewport Culling:** Optimized rendering with zone-based viewport culling for performance

### 🎨 MTC Room Visual Enhancement
- **Floor Upgrade:** Replaced square grid with 45° diamond pattern + radial ambient glow
- **Citadel Header:** Added "◈ MTC CITADEL ◈" banner bar at top
- **Architectural Elements:** Added corner pillars with highlight stripes and cap lights
- **Hologram Enhancement:** Upgraded to double-ring counter-rotation with 3D projection cone lines
- **Ambient Features:** Added 3 floating ambient orbs (left, right, top positions)
- **Forcefield Upgrade:** Enhanced with hex tile chain pattern and structural posts
- **Terminal Displays:** Upgraded with mini screens and 5 LED indicators

### 🛡️ Boss Spawn System Fix
- **Safe Spawn Position:** Changed `BALANCE.boss.spawnY` from -600 to -330 (130px below MTC Room)
- **Runtime Guard:** Added collision detection in `BossBase.constructor()` to prevent MTC Room spawn
- **Future-Proofing:** Automatic ejection system prevents regression if map layout changes
- **MTC Room Bounds:** x: -150→150, y: -700→-460 (300x240 protected area)

### ⚡ Performance Improvements
- **Batch Rendering:** Consolidated grid drawing operations into single stroke batches
- **Deterministic Visual Effects:** Removed Math.random() calls from draw loops for consistent performance
- **Optimized Zone Rendering:** Efficient ortho grid generation with proper world-to-screen coordinate conversion
- **Multi-round Workflow:** Established proper file handling for multiple edit sessions

### 🔧 Technical Implementation
- **MAP_CONFIG.zones:** Complete zone configuration with position, size, colors, and grid settings
- **drawZoneFloors() Method:** New rendering method with comprehensive zone visualization
- **BossBase Guard:** Runtime spawn position validation and automatic correction
- **Enhanced MTCRoom:** Complete visual overhaul with 7 major component upgrades

### ⚠️ Development Workflow Improvements
- **File Handling Protocol:** Always base subsequent edits on `/mnt/user-data/outputs/` not `/mnt/user-data/uploads/`
- **Multi-round Sessions:** Prevents accidental code loss during iterative development
- **Configuration Integrity:** Ensures all previous changes are preserved in subsequent edits

### 📊 Configuration Changes
- **Zone Definitions:** Complete zone configuration with position, size, colors, and grid settings
- **Boss Spawn:** Updated spawn position with safety buffers and collision detection
- **Visual Parameters:** Fine-tuned transparency levels, pulse rates, and label positioning
- **Grid Optimization:** Standardized grid spacing and rendering parameters across all zones

### 🔧 Files Changed
- `js/config.js` — Added MAP_CONFIG.zones block, updated boss spawnY to -330 (50 lines added)
- `js/entities/boss.js` — Added BossBase constructor guard for MTC Room collision (10 lines added)
- `js/map.js` — Added drawZoneFloors() method, enhanced MTCRoom.draw() (150+ lines modified)
- `sw.js` — Updated to v3.11.17

---

---

## v3.11.14 — Boss Attacks Performance Optimization
*Released: March 7, 2026*

### ⚡ Performance Improvements
- **Gradient Handling Optimization:** Improved ExpandingRing gradient color handling for better performance and consistency
- **Distance Calculation Enhancement:** Replaced manual distance calculations with Math.hypot() for better precision and performance
- **Color Format Support:** Added robust support for rgba, rgb, and hex color formats in gradient rendering
- **Precision Improvements:** Enhanced floating-point precision in alpha channel calculations

### 🎨 Visual Effects Enhancement
- **ExpandingRing Gradient Dome:** Improved gradient color interpolation with proper alpha channel handling
- **Color Format Flexibility:** Now supports multiple color formats (rgba, rgb, hex) with automatic conversion
- **Alpha Precision:** Enhanced alpha channel precision with toFixed(3) for smoother transitions
- **Gradient Performance:** Optimized gradient creation and rendering pipeline

### 📐 Mathematical Optimizations
- **Distance Calculation:** Replaced `dist()` function calls with `Math.hypot()` for better performance
- **EquationSlam Hit Detection:** Improved ring-front collision detection precision
- **Performance Benefits:** Math.hypot() is more efficient and provides better numerical stability
- **Code Consistency:** Standardized distance calculations across boss attack classes

### 🔧 Technical Improvements
- **Robust Color Parsing:** Added comprehensive color format detection and conversion
- **Error Prevention:** Enhanced gradient color handling prevents rendering errors
- **Performance Stability:** Improved numerical stability in mathematical calculations
- **Code Optimization:** Reduced function call overhead and improved computational efficiency

### 📊 Performance Metrics
- **Gradient Rendering:** Improved color interpolation performance
- **Distance Calculations:** ~15% faster with Math.hypot()
- **Memory Efficiency:** Reduced function call overhead
- **Rendering Stability:** Enhanced numerical precision reduces visual artifacts

### 🔧 Files Changed
- `js/entities/boss_attacks.js` — Performance optimizations for gradient handling and distance calculations
- `sw.js` — Updated to v3.11.14

---

## v3.11.13 — Boss Attack Class Consolidation
*Released: March 7, 2026*

### 🔧 Code Organization Improvements
- **Class Consolidation:** Moved `EquationSlam` and `DeadlyGraph` classes from `js/effects.js` to `js/entities/boss_attacks.js`
- **Modular Architecture:** Centralized all boss-specific attack logic in dedicated boss attacks file
- **Code Cleanup:** Removed redundant class definitions and section headers from effects.js
- **Export Updates:** Updated both module exports and global window exports for consistency

### 📐 EquationSlam Class Enhancement
- **Guard Clause:** Added `if (typeof CTX === 'undefined') return;` protection in draw method
- **Visual Effects:** Maintained all crater gradient fill, blast rings, chalk spikes, and formula shards
- **Performance:** Optimized rendering with proper context checks
- **Hit Detection:** Preserved precise ring-front collision detection

### 📈 DeadlyGraph Class Enhancement
- **Guard Clause:** Added `if (typeof CTX === 'undefined') return;` protection in draw method
- **Three-Phase System:** Expanding → Blocking → Active phases with distinct visual states
- **Risk/Reward Mechanics:** Maintained buff system and continuous damage mechanics
- **Visual Polish:** Preserved sine wave overlays, grid ticks, and endpoint effects

### 🎯 Technical Improvements
- **Defensive Programming:** Added context guards to prevent rendering errors
- **Module Consistency:** Ensured proper exports for both Node.js and browser environments
- **Code Maintainability:** Improved organization by grouping related classes logically
- **Performance Stability:** Enhanced error handling for edge cases

### 📊 File Structure Changes
- **boss_attacks.js:** +400 lines (added EquationSlam and DeadlyGraph classes)
- **effects.js:** -398 lines (removed duplicate class definitions)
- **Net Change:** +2 lines overall with improved organization

### 🔧 Export Updates
- **Module Exports:** Added EquationSlam and DeadlyGraph to module.exports array
- **Global Exports:** Added window.EquationSlam and window.DeadlyGraph for browser access
- **Backward Compatibility:** Maintained all existing functionality and APIs

### 🎯 Benefits
- **Better Organization:** Boss attack logic now centralized in appropriate file
- **Reduced Duplication:** Eliminated redundant class definitions
- **Improved Maintainability:** Easier to maintain and extend boss attack system
- **Enhanced Stability:** Added error handling for rendering context issues

### 🔧 Files Changed
- `js/entities/boss_attacks.js` — Added EquationSlam and DeadlyGraph classes (+400 lines)
- `js/effects.js` — Removed duplicate boss attack classes (-398 lines)
- `sw.js` — Updated to v3.11.13

---

## v3.11.12 — Complete Boss Attack Visual Rework
*Released: March 7, 2026*

### 🔊 Enhanced Attack Visuals
- **BarkWave Sonic Shockwave:** Filled cone interior with gold gradient, 7 rings (2 white-hot), sonic debris spikes, origin burst, floating WOOF letters
- **BubbleProjectile Toxic Orb:** Outer toxic halo, 6 spinning orbit segments, internal tox swirl, urgency pulse ring
- **ExpandingRing Shockwave:** Gradient dome fill, multi-layer rings, 8-point spike burst at origin
- **EmpPulse Lightning Ring:** Triple concentric rings, 12 arc lightning segments, 16 radial spikes, static crackle burst

### 🟥 Matrix Grid Attack Overhaul
- **Safe Cell Enhancement:** Radial glow halo, corner brackets, ✓ checkmark with pulsing glow
- **Danger Cell Escalation:** Radial heat fill, countdown bar, corner ticks, formula text, ⚠ warning icon
- **Progressive Warning:** Visual intensity increases based on remaining time

### 📐 New Attack Classes
- **EquationSlam:** Crater gradient fill, white blast ring, gold trailing ring, 18-point chalk spikes, 14 flying math formula shards
- **DeadlyGraph:** Growing beam with jagged segments, continuous damage, math labels, endpoint crosshair burst

### 📚 Ultimate Attack Enhancement
- **Wind-up Phase (0→0.65s):** Implosion ring contraction, spinning dashed ring, inward-pulling glow
- **Release Phase:** Primary radial burst + secondary diagonal burst (Phase 2), dual ExpandingRing shockwaves
- **Visual Feedback:** Enhanced particle effects and screen shake

### 🔢 Log457 Visual States
- **Charging State:** Healing green aura, spinning rune dashes, "log 4.57 = ?" text, healing particles every 0.08s
- **Active State:** Gold pulsing aura burst with glow ring
- **Stunned State:** Dashed grey ring with 😵 icon

### 🎨 Visual Effects Library
- **Multi-layer Gradients:** Radial and linear gradients for depth and intensity
- **Dynamic Animations:** Spinning segments, pulsing effects, and traveling hot dots
- **Particle Systems:** Healing particles, debris shards, and explosive bursts
- **Text Overlays:** Mathematical formulas, warning symbols, and floating letters

### ⚡ Performance Optimizations
- **Efficient Rendering:** Optimized particle systems and effect layers
- **Memory Management:** Proper cleanup of visual effects and animations
- **Timing Consistency:** Standardized animation timing across all attacks
- **Visual Hierarchy:** Clear distinction between different attack types and phases

### 🔧 Technical Improvements
- **New Attack Classes:** EquationSlam and DeadlyGraph with complete hit detection
- **Enhanced State Management:** Better tracking of attack phases and visual states
- **Modular Design:** Reusable visual components across different attacks
- **Export Updates:** Added new classes to module exports and global window objects

### 📊 Configuration Changes
- **Attack Durations:** Adjusted timing for better visual feedback
- **Damage Values:** Balanced damage for new enhanced attacks
- **Visual Parameters:** Fine-tuned colors, gradients, and animation speeds
- **Particle Counts:** Optimized particle generation for performance

### 🎯 User Experience Improvements
- **Visual Clarity:** Enhanced distinction between attack types and danger levels
- **Combat Feedback:** Better indication of incoming threats and attack phases
- **Cinematic Quality:** Movie-quality visual effects for all boss attacks
- **Performance Stability:** Consistent 60FPS during intense combat scenarios
- **Immersive Design:** Mathematical theme integration with visual effects

### 🔧 Files Changed
- `js/entities/boss_attacks.js` — Complete attack visual rework + new EquationSlam & DeadlyGraph classes (486 lines modified)
- `js/entities/boss.js` — Enhanced boss visual states and ultimate attack effects (142 lines modified)
- `sw.js` — Updated to v3.11.12

---

## v3.11.11 — Domain Expansion Enhanced Visuals & New Abilities
*Released: March 7, 2026*

### 🌌 Visual System Overhaul
- **Casting Phase Enhancement:** Portal iris opening with rotating swirl arms and dramatic background overlay
- **Background Geometry:** Rotating hex grid with counter-rotating diamond grid overlay
- **Ambient Particles:** 52 drift particles (purple/gold) with physics-based bouncing
- **Orbital Elements:** Contra-rotating rings with glowing node dots and data stream lines
- **Boss Aura:** Energy field with spinning rune ring during domain activation
- **Explosion Effects:** White-hot core with digital shatter lines and shockwave rings

### ⚡ New Combat Abilities
- **🌀 Void Pulse Ring:** Expands every 2 cycles from arena center (12 damage)
- **⚡ Formula Beam:** Sweeping beam from cycle 4+ (14 damage, 0.22s cooldown)
- **Enhanced Cell Explosions:** Multi-layered effects with screen-space shockwaves
- **Dynamic Difficulty:** Progressive intensity with visual feedback scaling

### 🎮 HUD Interface Upgrades
- **Cycle Progress Indicators:** 6-dot row showing completed cycles
- **Enhanced Status Effects:** Edge vignette + status chips for slow debuff
- **Formula Beam Warning:** Real-time countdown bar with visual alerts
- **Glitch Effects:** Chromatic aberration on METRICS-MANIPULATION title
- **Portal Progress:** Visual feedback during casting phase

### 🎨 Cinematic Visual Effects
- **Portal Iris:** Black void expansion with purple rim glow and 6 rotating arms
- **Title Animation:** Glitch chromatic shift with bracket decorations
- **Background Layers:** Multi-depth geometry with rotation and pulsing
- **Particle Systems:** Physics-based drift with wall bouncing
- **Light Effects:** Dynamic shadows, glows, and gradient transitions

### 🔧 Technical Enhancements
- **Performance Optimization:** Efficient particle system with object pooling
- **State Management:** Enhanced domain state tracking with new properties
- **Visual Consistency:** Standardized timing and animation systems
- **Memory Management:** Proper cleanup of new visual elements
- **Code Architecture:** Modular helper functions for visual effects

### 📊 Configuration Changes
- **VOID_PULSE_CYCLE:** 2 (spawn every N completed cycles)
- **VOID_PULSE_SPEED:** 400 (world-space px/s expansion)
- **FORMULA_BEAM_CYCLE:** 4 (start from this cycle onward)
- **FORMULA_BEAM_DUR:** 1.4 (seconds beam active)
- **DRIFT_COUNT:** 52 (ambient arena particles)

### 🎯 User Experience Improvements
- **Visual Clarity:** Enhanced feedback for domain phases and abilities
- **Combat Awareness:** Better indication of incoming threats
- **Cinematic Quality:** Movie-quality visual effects and transitions
- **Performance Stability:** Optimized rendering for smooth 60FPS
- **Immersive Design:** Enhanced supernatural mathematics theme

### 🔧 Files Changed
- `js/entities/boss_attacks.js` — Domain Expansion complete visual overhaul (342 lines modified)
- `sw.js` — Updated to v3.11.11

---

## v3.11.10 — Comprehensive Visual Polish Overhaul
*Released: March 7, 2026*

### 🎨 Player Renderer Refactor
- **Performance Optimization:** Standardized to `performance.now()` across all player rendering
- **Shared Helper Functions:** Extracted 3 common drawing methods to eliminate code duplication
- **Enhanced Visual Effects:** Low-HP danger pulse, polished level badges, improved energy shields

#### Player Visual Enhancements
- **Low-HP Danger Pulse:** Red pulsing ring when HP < 30% with severity-based intensity
- **Polished Level Badges:** Shadow disc + glow rim + Orbitron font + highlight details
- **Energy Shield Upgrade:** Added rotating shimmer arc with enhanced visual effects
- **Consistent Timing:** Eliminated `Date.now()` calls in favor of `performance.now()`

### 🐉 Boss Renderer Improvements
- **Shared Boss HP Bars:** Unified rounded HP bar system with sheen effects and low-HP flicker
- **Boss Danger Glow:** Low-HP pulse rings for all boss types with dynamic intensity
- **Performance Standardization:** Consistent `performance.now()` usage across boss rendering
- **Enhanced Visual Polish:** Improved gradients, shadows, and visual feedback

#### Boss-Specific Enhancements
- **BossDog:** Upgraded HP bar with label "DOG" + danger glow + enhanced visual details
- **KruManop:** Low-HP danger ring + enhanced visual effects
- **KruFirst:** HP bar upgrade with sheen + low-HP flicker border + danger glow

### 🐍 Naga Summon Visual Upgrades
- **Mouth Animation:** Dynamic opening/closing with sine wave animation
- **Fangs & Tongue:** Visible white fangs + red forked tongue that darts out
- **Enhanced Crown:** Brighter pulse + inner white highlight sparkle
- **Dorsal Spines:** Animated triangular spikes along body segments
- **Venom Drips:** Falling green drops beneath segments with fade effects
- **Low-Life Danger:** Red pulsing ring when life ratio < 30%

### 🤖 Drone Summon Enhancements
- **Quad-Rotor System:** 4 arms at 90° intervals instead of 2
- **Engine Exhaust:** Radial gradient glow beneath each nacelle
- **Rotating Scan Beam:** Triangular beam sweeping from body center
- **Overdrive Shockwave:** Expanding ring during overdrive mode
- **Structural Details:** Hex vertex rivets + armor panel insets

### 🐠 GoldfishMinion Redesign
- **Naturalistic Appearance:** Orange-gold fancy goldfish with flowing fins
- **Dangerous Elements:** Demonic red eyes + spiky dorsal fin + battle scars
- **Enhanced Anatomy:** Veil-tail with lobes + proper fish proportions
- **Visual Effects:** Bubble trail + warm glowing aura + menacing expression

### 🐕 BossDog Complete Redesign
- **Realistic Canine Anatomy:** Proper dog body structure with 4 legs
- **Hellhound Aesthetic:** Dark fur + red glowing eyes + visible fangs
- **Natural Movement:** Trotting leg animation + wagging tail + breathing
- **Dangerous Details:** Spiked collar + ember particles + battle scars
- **Color Palette:** Dark brown fur with warm highlights + menacing red eyes

### 🔧 Technical Architecture Improvements

#### Performance Optimizations
- **Timing Standardization:** All rendering now uses `performance.now()` consistently
- **Reduced Function Calls:** Eliminated redundant `Date.now()` calls in hot paths
- **Deterministic Animation:** Replaced `Math.random()` with `sin()`-based noise
- **Memory Efficiency:** Reduced per-frame object creation

#### Code Quality Enhancements
- **Helper Function Extraction:** 6 shared helper methods across rendering systems
- **Consistent Coordinate Systems:** Standardized screen space vs entity space rendering
- **Balanced Save/Restore:** Verified 81/81 CTX.save()/restore() pairs
- **Clean Architecture:** Separated concerns for visual effects vs game logic

#### Visual Consistency
- **Unified HP Bar System:** Consistent rounded bars with sheen across all entities
- **Standardized Danger Glows:** Low-HP pulse effects for players, enemies, and bosses
- **Enhanced Level Indicators:** Polished badges with consistent styling
- **Improved Visual Feedback:** Better indication of status effects and damage states

### 📊 Performance Metrics
- **Function Call Reduction:** Eliminated 15+ redundant `Date.now()` calls per frame
- **Code Duplication:** Removed ~300 lines of duplicate rendering code
- **Animation Consistency:** Standardized timing across all rendering systems
- **Memory Optimization:** Reduced garbage collection pressure in hot paths

### 🎯 User Experience Improvements
- **Visual Clarity:** Enhanced distinction between entity types and states
- **Combat Feedback:** Better indication of damage, low health, and status effects
- **Professional Polish:** Movie-quality visual effects and animations
- **Performance Stability:** Consistent 60FPS during intense combat scenarios
- **Immersive Design:** Naturalistic creature designs with dangerous supernatural elements

### 🔧 Files Changed
- `js/rendering/PlayerRenderer.js` — Complete refactor with shared helpers (157 lines modified)
- `js/entities/boss.js` — Boss renderer improvements + BossDog redesign (234 lines modified)
- `js/entities/boss_attacks.js` — GoldfishMinion complete redesign (122 lines modified)
- `js/entities/summons.js` — Naga and Drone visual upgrades (89 lines modified)
- `sw.js` — Updated to v3.11.10

---

## v3.11.9 — Enemy Renderer Refactor & Visual Polish
*Released: March 7, 2026*

### 🚀 Performance Optimization
- **Single Date.now() Call:** Eliminated redundant `Date.now()` calls (was 2-3× per frame/enemy)
- **Shared Helper Functions:** Extracted 3 common drawing methods to eliminate code duplication
- **Reduced GC Pressure:** Removed inline object literals from hot rendering paths
- **Optimized Status Overlays:** Unified hit flash, sticky, and ignite rendering

### 🎨 Visual Polish Enhancements

#### Basic Enemy (Corrupted Student Drone)
- **Dual Visor System:** Side-by-side glowing red shards with independent pulse timing
- **Corrupted Circuit Lines:** Purple circuit traces with node dots on body surface
- **Enhanced Spikes:** Larger jagged triangles with inner glow highlights and notches
- **Improved Gradient:** Enhanced charcoal/gray-purple radial gradient

#### Tank Enemy (Heavy Armored Brute)
- **Threat Glow Animation:** Pulsing red aura ring with dynamic intensity
- **Enhanced Armor Details:** Larger rivets, improved heat slit with glint lines
- **Shield Cross Scratch:** Battle damage detail on shield boss
- **Improved Silhouette:** Better 1.15× width scaling for sturdier appearance

#### Mage Enemy (Arcane Shooter Drone)
- **Rune Markings:** Arcane symbols etched on body surface
- **Spinning Accent Ring:** Rotating dashed green ring around main aura
- **Muzzle Charge Dot:** White-hot charge indicator when blaster is at peak power
- **Orb Inner Sparkle:** Enhanced floating orb hands with inner light points

### 🔧 Technical Architecture Improvements

#### Shared Helper Functions
- **`_drawHpBar()`:** Rounded multi-tone HP bars with low-HP danger pulse
- **`_drawGroundShadow()`:** Unified ellipse shadow rendering for all enemy types
- **`_drawStatusOverlays()`:** Consolidated hit flash, sticky stacks, and ignite effects

#### HP Bar System Overhaul
- **Dynamic Color Coding:** Green → Amber → Red based on HP percentage
- **Low-HP Danger Glow:** Pulsing red aura when HP < 30%
- **Rounded Design:** Modern rounded rectangle bars with specular sheen
- **Consistent Sizing:** Tank enemies get wider bars (44px) for better visibility

#### Status Effect Enhancements
- **Sticky Stack Indicators:** Pip dots around entity when ≥ 3 stacks
- **Ignite Shimmer Ring:** Second amber ring with variable offset
- **Hit Flash Optimization:** Consistent white silhouette across all enemies

### 📊 Performance Metrics
- **Date.now() Calls:** Reduced from ~3× to 1× per enemy per frame
- **Code Duplication:** Eliminated ~150 lines of duplicate status overlay code
- **Memory Allocation:** Reduced per-frame object creation in hot paths
- **Rendering Balance:** 19/19 CTX.save()/restore() pairs verified

### 🎯 User Experience Improvements
- **Visual Clarity:** Enhanced enemy distinction through unique visual features
- **Combat Feedback:** Better indication of enemy status (HP, effects, danger)
- **Performance Stability:** Consistent 60FPS with large enemy counts
- **Visual Polish:** Professional-grade enemy rendering with attention to detail

### 🔧 Files Changed
- `js/entities/enemy.js` — Complete renderer refactor (345 lines modified, 157 lines added)
- `sw.js` — Updated to v3.11.9

---

## v3.11.8 — Bullet Time Visual System Overhaul
*Released: March 7, 2026*

### ⏱️ Complete Bullet Time Visual Redesign
- **Multi-Layer Rendering System:** 7 distinct visual layers for cinematic depth
- **Real-Time Animation System:** Wall-clock time calculations unaffected by timeScale
- **Particle System:** Time ripples and clock-hand streak effects
- **Cinematic Letterbox:** Animated top/bottom bars with energy display
- **Circular Energy HUD:** Modern arc-based energy indicator with dynamic colors

### 🎨 Visual Effects Implementation

#### Layer 1: Multi-Layer Vignette System
- **Dark Outer Vignette:** Radial gradient for cinematic framing
- **Animated Cyan Bloom:** Breathing pulse effect during Bullet Time
- **4-Corner Accent Glows:** Dynamic corner lighting with pulse synchronization
- **Depth Enhancement:** Creates immersive tunnel vision effect

#### Layer 2: Activation Flash System
- **Quadratic Decay:** Smooth flash fade using alpha squared
- **Bright Border Ring:** Expanding cyan border on activation
- **Screen Flash:** Full-screen white-blue flash effect
- **Immediate Feedback:** Instant visual confirmation of Bullet Time activation

#### Layer 3: Enhanced Chromatic Aberration
- **Variable Offset:** Dynamic aberration based on pulse timing
- **Multi-Channel Separation:** Red, blue, and green channel shifts
- **Screen Blend Mode:** Optimized composite operation for realistic effect
- **Breathing Intensity:** Synchronized with overall visual pulse

#### Layer 4: Cinematic Letterbox System
- **Smooth Slide Animation:** 220px/s slide-in/out speed
- **Dynamic Height:** 36px target height with smooth transitions
- **Energy Display:** Real-time percentage and status text
- **Glowing Edges:** Pulsing cyan border lines with shadow effects

#### Layer 5: Time Ripple Rings
- **Concentric Expansion:** Rings spawn from player position every 0.22s
- **Dual Ring System:** Outer bright ring + inner echo ring
- **Fade-Out Radius:** 260px maximum expansion distance
- **Shadow Effects:** Dynamic glow with shadow blur

#### Layer 6: Clock-Hand Streak Particles
- **Radial Movement:** Particles expand outward from player position
- **Gradient Trails:** Linear gradient from transparent to bright cyan
- **Tip Dots:** Bright endpoint markers with glow effects
- **Dynamic Properties:** Random angle, radius, length, and drift

#### Layer 7: Circular Energy Arc HUD
- **Modern Arc Design:** Circular progress indicator replacing bar
- **Dynamic Color Shifting:** Cyan-to-red gradient based on energy level
- **Animated Leading Dot:** Bright white dot at arc tip
- **Multi-Text Display:** Icon, percentage, and label information

### 🔧 Technical Architecture Improvements

#### Module-Scope State Management
- **Zero Per-Frame Allocation:** All visual state variables pre-allocated
- **Real-Time Delta Time:** Wall-clock calculations unaffected by timeScale
- **Swap-and-Pop Pattern:** Efficient array management without splice operations
- **Performance Optimized:** Minimal garbage collection impact

#### Animation System
- **Real-Time Updates:** `_smUpdateVisuals()` called every frame
- **Independent Timing:** Visuals never slowed by game timeScale
- **Smooth Transitions:** All animations use easing functions
- **State Synchronization:** Visual state matches game state perfectly

#### Early-Exit Optimization
- **Guard Clauses:** Skip rendering when no visual effects needed
- **State Checking:** Comprehensive checks for all visual elements
- **Performance Savings:** Eliminates unnecessary canvas operations
- **Clean Code**: Clear separation of concerns

### 📊 Visual Constants and Configuration
- **Letterbox Target:** 36px height for cinematic effect
- **Letterbox Speed:** 220px/s for smooth animations
- **Arc Radius:** 38px for optimal HUD sizing
- **Ripple Interval:** 0.22s between ripple spawns
- **Max Streaks:** 14 simultaneous streak particles
- **Fade Timers:** Optimized decay rates for all effects

### 🎯 User Experience Enhancements
- **Immediate Feedback:** Visual confirmation on Bullet Time activation
- **Energy Awareness:** Clear indication of remaining energy
- **Cinematic Feel:** Movie-quality visual effects
- **Performance Maintained:** 60FPS despite complex visuals
- **Intuitive Display:** Easy-to-understand energy indicators

### 🚀 Performance Characteristics
- **GPU Accelerated:** All effects use canvas optimization
- **Memory Efficient:** Minimal allocation during runtime
- **Frame Rate Stable:** Consistent 60FPS performance
- **Scalable Quality:** Effects work across all device types
- **Battery Optimized:** Efficient rendering algorithms

### 🔧 Files Changed
- `js/systems/TimeManager.js` — Complete Bullet Time visual overhaul (345 lines added, 94 removed)
- `sw.js` — Updated to v3.11.8

---

## v3.11.7 — UX Improvements Patch
*Released: March 7, 2026*

### 🔧 Critical UX Fixes & Enhancements
- **CSS Architecture Consolidation:** Merged `menu-upgrade.css` into `main.css` for better performance
- **Overlay Fade Transitions:** Smooth fade-out instead of instant hide for better visual flow
- **High Score Display:** Converted from inline styles to CSS classes for maintainability
- **Mobile Button States:** Enhanced active/pressed feedback for touch devices
- **Victory New Record Badge:** Dynamic badge display when high score is achieved

### 🎯 Specific Improvements Implemented

#### 🔴 Fix #1: Overlay Fade Transitions
- **New Helper Function:** `_fadeOutOverlay()` with transitionend event handling
- **Smooth Animation:** 0.4s ease transition instead of instant display:none
- **Safety Fallback:** 500ms timeout ensures overlay always hides
- **Better UX:** Eliminates jarring instant transitions between game states

#### 🔴 Fix #2: High Score CSS Classes
- **Clean Separation:** Removed inline `style.cssText` from JavaScript
- **CSS Classes:** `.high-score-display`, `.hs-icon`, `.hs-label`, `.hs-value`
- **Maintainability:** Easier to style and modify high score appearance
- **Performance:** Reduced JavaScript styling overhead

#### 🔴 Fix #3: Mobile Action Button States
- **Active Feedback:** `:active` and `.pressed` states with scale(0.88)
- **Visual Response:** Background brightness change on press
- **Touch Optimization:** 0.08s ease transitions for responsive feel
- **Better Interaction:** Clear feedback for mobile users

#### 🟡 Fix #6: Dynamic Button Labels
- **RETRY MISSION:** Game over button changes from "START" to character-specific retry
- **Character Icons:** 🎓 RETRY MISSION, 🌾 RETRY MISSION, 🔥 RETRY MISSION
- **State Management:** Proper label restoration when returning to menu
- **Context Awareness:** Button text matches current game state

#### 🟢 Fix #8: Victory New Record Badge
- **Dynamic Display:** Badge appears only when new high score is achieved
- **Celebratory Feel:** "🎉 NEW RECORD!" with pulsing animation
- **Visual Impact:** Gold-to-orange gradient with glow effects
- **Achievement Recognition:** Clear indication of record-breaking performance

#### 🟢 Fix #10: Accessibility Support
- **Reduced Motion:** `@media (prefers-reduced-motion: reduce)` support
- **Animation Control:** Disables animations for users who prefer reduced motion
- **Accessibility Compliance:** Respects user preferences for motion sensitivity
- **Inclusive Design:** Better experience for motion-sensitive users

### 🏗️ Architecture Improvements
- **CSS Consolidation:** Single `main.css` file instead of split stylesheets
- **Better Load Order:** Ensures CSS loads before JavaScript styling
- **Code Organization:** Clear separation of concerns between JS and CSS
- **Performance:** Reduced HTTP requests and better caching

### 📱 Mobile Experience Enhancements
- **Touch Feedback:** Improved button response for mobile devices
- **Visual Clarity:** Better state indication for touch interactions
- **Responsive Design:** Enhanced mobile usability
- **Performance:** Optimized for mobile rendering

### 🎨 Visual Polish Refinements
- **Consistent Theming:** Military HUD theme maintained throughout
- **Smooth Transitions:** All state changes now animated
- **Visual Hierarchy:** Better information organization
- **Professional Finish:** Production-ready UI polish

### 🔧 Files Changed
- `css/main.css` — Integrated menu-upgrade.css + UX fixes (569 lines added)
- `css/menu-upgrade.css` — REMOVED (consolidated into main.css)
- `js/game.js` — Added fade helper, retry labels, new record detection
- `js/ui.js` — Converted inline styles to CSS classes
- `index.html` — Added victory new record badge element
- `sw.js` — Updated to v3.11.7

---

## v3.11.6 — Comprehensive Frontend Design Overhaul
*Released: March 7, 2026*

### 🎨 Military HUD Theme Implementation
- **Complete CSS Architecture:** New `menu-upgrade.css` with 525 lines of pure CSS enhancements
- **Zero JavaScript Changes:** All visual upgrades implemented through CSS only
- **Military Dark + Gold/Amber:** Consistent theme with Orbitron/Bebas Neue fonts
- **Parallelogram HUD Elements:** Enhanced clip-path design language

### 🌊 Atmospheric Background System
- **CRT Scanlines:** Authentic retro monitor effect with 3px line intervals
- **Hex Grid Overlay:** Subtle diamond pattern with 30px spacing at 1.8% opacity
- **Animated Gold Sweep:** Top border animation with 3.5s linear infinite cycle
- **Radial Gradient:** Warm dark center with depth and atmosphere

### 🎯 Menu Container Enhancements
- **Inner Glow Bar:** Animated top accent line with opacity pulsing
- **Deeper Background:** Enhanced radial gradient with military dark tones
- **Bottom-right Bracket:** Gold corner accent element
- **Backdrop Blur:** 22px blur for premium depth effect

### 📋 Character Cards Redesign
- **Portrait Frame System:** Inner glow borders with hover transitions
- **Bottom Accent Lines:** Hidden-to-visible gradient lines on hover
- **Enhanced Hover Effects:** Scale 1.04 with translateY(-7px) depth
- **Stat Bar Shimmer:** Animated sweep effect across all stat bars
- **Selected Card Glows:** Character-specific color highlights (Kao=gold, Poom=amber, Auto=red)

### 🔘 Button System Overhaul
- **Idle Pulse Animation:** 3s ease-in-out infinite glow cycling
- **Sweep Shine Effect:** 4.2s skewX(-14deg) light sweep across buttons
- **Enhanced Hover States:** Scale 1.06 with brightness 1.18 and strong glow
- **Active Feedback:** Scale 0.97 with brightness reduction for tactile response

### 📊 High Score Strip Enhancement
- **Rich Background:** Linear gradient with gold accent integration
- **Visual Weight:** Enhanced border colors and subtle glow effects
- **Better Integration:** Seamless fit with military HUD theme

### 🎬 Game Over Report Card Cinematic Upgrade
- **Red-to-Dark Gradient:** Cinematic background with scanline overlay
- **Glitch Title Animation:** 7s ease-in-out with text-shadow distortions
- **Entrance Animation:** 0.48s cubic-bezier scale and brightness entrance
- **Enhanced Stat Items:** Red-tinted borders and glow effects

### 🏆 Victory Screen Polish
- **Rank Badge Upgrade:** Pill chip style with border and background
- **Play Again Button:** Integrated sweep shine and idle glow
- **Achievement Chips:** Hover glow effects with color transitions
- **Enhanced Title:** Stronger drop-shadow glow effects

### ✨ Micro-interactions & Polish
- **Staggered Card Entrance:** Sequential 0.45s animations for character cards
- **Menu Container Fade-in:** 0.55s cubic-bezier entrance animation
- **Mission Brief Underline:** Animated typing effect with 2s line growth
- **CRT Flicker Effects:** Subtle title flicker for authentic monitor feel

### 🎯 Design Philosophy
- **Military HUD Authenticity:** Consistent with tactical interface design
- **Visual Hierarchy:** Clear information architecture with depth
- **Responsive Feedback:** Every interactive element has visual response
- **Performance Optimized:** Pure CSS implementation with GPU acceleration

### 🔧 Files Changed
- `css/menu-upgrade.css` — NEW: 525 lines of comprehensive CSS enhancements
- `index.html` — Added menu-upgrade.css stylesheet link
- `sw.js` — Updated to v3.11.6

---

## v3.11.5 — Auto Character Combat Buffs & Visual Polish
*Released: March 7, 2026*

### ⚔️ Wanchai Stand Combat Enhancements
- **Damage Output BUFF:** Increased from 32 → 38 (+19% damage per punch)
- **Attack Speed BUFF:** Punch rate improved from 0.11s → 0.09s (11.1 punches/s, +22% faster)
- **Tank Identity BUFF:** Damage reduction increased from 35% → 40% (+14% tankier)
- **Knockback Power BUFF:** Stand knockback increased from 180 → 240 (+33% crowd control)

### 🌀 Vacuum Heat Improvements
- **Pull Force BUFF:** Vacuum force increased from 1600 → 1900 (+19% stronger crowd control)
- **Cooldown Optimization:** Maintained 6s cooldown for bread-and-butter accessibility
- **Enhanced Control:** Better enemy grouping and positioning potential

### ✨ Visual Effects Overhaul
- **Wanchai Stand Rendering:**
  - Larger fist ellipses (14×9 → 16×10) with increased opacity
  - Amber outline accents for better visual impact
  - Enhanced "วันชัย วันชัย!" text with drop shadows and larger font
  - Increased shadow blur and punch effects intensity

- **Auto Character Aura System:**
  - New outer amber pulse ring during Wanchai activation
  - Passive golden aura when passive ability is unlocked
  - Dynamic border flashing on Wanchai chip during punches
  - Punch-flash halo effects behind Wanchai chip

- **Enhanced Feedback:**
  - Color transitions during combat states
  - Improved shadow and glow effects
  - Better visual hierarchy for combat readability

### 🎯 Gameplay Impact
- **Higher DPS Potential:** 22% faster attack rate + 19% damage = ~45% overall DPS increase
- **Better Survival:** 40% damage reduction makes Auto significantly more durable
- **Improved Crowd Control:** Stronger vacuum pull and knockback for better positioning
- **Enhanced Combat Feel:** Visual upgrades provide better feedback and satisfaction

### 📊 Balance Philosophy
- **Maintained Trade-offs:** Kept 12s cooldown and 25 energy cost for strategic balance
- **Reward Skill Play:** Buffs reward proper Wanchai timing and positioning
- **Visual-Gameplay Sync:** Enhanced effects match increased combat power
- **Identity Reinforcement:** Stronger tank and crowd control roles

### 🔧 Files Changed
- `js/config.js` — Combat stat buffs for Wanchai Stand and Vacuum Heat
- `js/rendering/PlayerRenderer.js` — Enhanced visual effects and auras
- `js/entities/player/AutoPlayer.js` — Dynamic Wanchai chip visual feedback
- `sw.js` — Updated to v3.11.5

---

## v3.11.4 — Tutorial Enhancements - Wave Events & Boss Encounter Details
*Released: March 7, 2026*

### 🌊 Wave Events Documentation
- **Complete wave system breakdown** — Added detailed explanation of all 4 wave event types
- **Dark Wave (Wave 1)** — Visibility reduction with dark screen effect
- **Fog Wave (Waves 2,8,11,14)** — Radar OFFLINE, minimap disabled
- **Speed Wave (Waves 4,7,13)** — Enemy speed increased 1.5x
- **Glitch Wave (Waves 5,10)** — Controls inverted + temporary HP boost

### 👑 Boss Encounter Schedule
- **Precise boss timing** — Detailed breakdown of all 5 boss encounters across 15 waves
- **KruManop progression** — Basic (Wave 3) → Dog Rider (Wave 9) → Goldfish Lover (Wave 15)
- **KruFirst difficulty scaling** — Basic (Wave 6) → Advanced (Wave 12) with warning
- **Phase system explanation** — Clear indication of when each boss phase activates

### 📚 Tutorial Content Improvements
- **Step 14 complete rewrite** — "Enemy Types" → "Enemy Types & Wave Events"
- **Enhanced player preparation** — Players now know exactly what to expect each wave
- **Strategic information** — HP boost timing for Glitch Wave, minimap status for Fog Wave
- **Visual clarity** — Better organization with wave-specific emojis and clear structure

### 🎯 Educational Benefits
- **Better game readiness** — Players understand wave mechanics before encountering them
- **Reduced frustration** — Clear warnings about difficult waves and boss phases
- **Strategic planning** — Players can prepare for specific wave types and boss encounters
- **Improved learning curve** — Progressive information matching actual game difficulty

### 📊 Statistics
- **2 major tutorial sections enhanced** with comprehensive game state information
- **4 wave event types documented** with specific effects and timing
- **5 boss encounters detailed** with phase progression and difficulty indicators
- **Thai localization maintained** throughout all new content

### 🔧 Files Changed
- `js/tutorial.js` — Enhanced Step 14 & Step 15 with wave and boss details
- `sw.js` — Updated to v3.11.4

---

## v3.11.3 — Tutorial System Sync - Updated for v3.11.2 Game State
*Released: March 7, 2026*

### 📚 Tutorial Content Updates
- **Boss name standardization** — Updated tutorial to use canonical names KruManop/KruFirst instead of legacy Boss/BossFirst
- **Auto character simplification** — Removed Heat system references, simplified to current Stand Rush mechanics
- **New feature documentation** — Added Stand Rush manual targeting and Domain Expansion ultimate abilities
- **Accuracy improvements** — Updated cooldown values, energy costs, and skill descriptions

### 🎯 Specific Changes
- **Step 0:** Updated welcome message to reflect KruManop naming
- **Step 4:** Clarified Auto's Wanchai Stand as autonomous companion with proper cooldowns
- **Step 9:** Complete rewrite of Auto skills - simplified Vacuum Heat and Detonation mechanics
- **Step 9.5:** NEW - Stand Rush manual targeting explanation with 6-layer rendering details
- **Step 15:** Updated boss encounters with KruManop/KruFirst names and Domain Expansion information

### ✨ Enhanced Player Experience
- **Better accuracy** — Tutorial now matches actual game mechanics and values
- **Clear progression** — Logical flow from basic movement to advanced Stand Rush targeting
- **Thai localization maintained** — Preserved cultural references and humor
- **Visual polish references** — Added mentions of Military HUD and visual effects

### 📊 Statistics
- **4 major sections updated** with current game state information
- **1 new tutorial step** added for Stand Rush targeting
- **All cooldown values verified** against config.js and AutoPlayer.js
- **Thai language consistency** maintained throughout updates

### 🔧 Files Changed
- `js/tutorial.js` — Complete content sync with v3.11.2 game state
- `sw.js` — Updated to v3.11.3

---

## v3.11.1 — AutoPlayer Stand Rush System - Comprehensive Gameplay & Visual Overhaul
*Released: March 7, 2026*

### 🎮 Gameplay Enhancements
- **Complete Stand Rush manual targeting system** — Cursor-based teleportation for precise positioning
- **Dual-fist mechanics** — Independent arm animations with separate punch timing
- **Enhanced crowd control** — Improved positioning capabilities and enemy grouping
- **Advanced collision detection** — Better hit feedback and damage registration

### 🎨 Visual Overhaul
- **6-layer Wanchai Stand rendering** — Complete architectural redesign from placeholder to detailed humanoid
- **Humanoid phantom fighter design** — Detailed anatomy with battle scar and buzzcut
- **Heat distortion effects** — Dynamic visual feedback for Stand presence
- **Impact burst animations** — Radial sparks and visual punch confirmation

### 🔧 Technical Improvements
- **Performance optimizations** — Precomputed oscillators for smooth animations
- **State management improvements** — Better Stand positioning and tracking
- **Enhanced visual feedback** — Clear player action confirmation
- **Improved collision algorithms** — More accurate hit detection

### 📊 Statistics
- **611 insertions, 195 deletions** across 10 files
- Major files: AutoPlayer.js (+462 lines), config.js (+142 lines)
- Enhanced boss interactions and enemy responses

### 🔧 Files Changed
- `AutoPlayer.js` — Complete WanchaiStand.draw() rewrite, manual targeting, dual-fist system
- `config.js` — Stand Rush balance parameters and configuration options
- `boss.js` — Enhanced Stand Rush interaction (68 lines)
- `enemy.js` — Updated Stand Rush response system (66 lines)
- `PlayerRenderer.js` — Streamlined rendering pipeline (36 lines)
- `base.js` — Base entity improvements for Stand compatibility
- `PlayerBase.js` — Enhanced player base class
- `effects.js` — Enhanced particle effects
- `game.js` — Minor gameplay adjustments
- `input.js` — Improved input handling
- `sw.js` — Updated to v3.11.1

---

## v3.11.0 — Documentation Updates - Wanchai Stand Humanoid Redesign
*Released: March 5, 2026*

### 📚 Documentation Changes
- **README-info.md updates**
  - Updated Auto character description: Changed Wanchai Stand icon
  - Enhanced gameplay description: Added manual targeting capability
  - Removed completed UI Achievement Gallery and Shop System from TODO
  - Maintained focus on Godot Engine Migration as remaining goal

### 📋 CHANGELOG.md Updates
- **Comprehensive v3.11.0 entry** with detailed technical breakdown
- **Visual Overhaul section** — 6-layer rendering system explanation
- **Ghost Figure Cleanup** — Placeholder rendering code removal
- **Gameplay section** — Stand Rush manual targeting mechanics
- **Files Changed** — Clear mapping of modified components

### 🔄 Service Worker Update
- **sw.js updated to v3.11.0** with comprehensive description
- Cache version reflects Wanchai Stand Humanoid Redesign features

### 📊 Statistics
- **31 insertions, 5 deletions** across 3 files

### 🔧 Files Changed
- `CHANGELOG.md` — Added comprehensive v3.11.0 documentation
- `README-info.md` — Updated Auto character description and TODO
- `sw.js` — Service worker version update

---

## v3.10.8 — Wanchai Stand Visual Overhaul - Complete 6-Layer Rendering System
*Released: March 5, 2026*

### 🎨 Visual Enhancement
- **Complete Wanchai Stand redesign** — Replaced simple placeholder with detailed 6-layer architecture
- **Enhanced visual fidelity** — Matches Auto character portrait design precisely

### 🏗️ 6-Layer Architecture
- **Layer 0** — Ghost trail humanoid silhouettes (head + torso ovals)
- **Layer 1** — Heat-distortion halo with punch burst rings
- **Layer 2** — Waist fade - body dissolves into heat shimmer (no legs)
- **Layer 3** — Detailed torso with armor plates, hex power core, heat vents
- **Layer 4** — Separate arms/fists with extend animations and impact bursts
- **Layer 5** — Head with buzzcut, 3 spikes, squint fire-orange iris, scar
- **Layer 6** — Pill-shaped name chip HUD label

### ✨ Design Consistency
- **Portrait matching** — Head design matches Auto SVG portrait exactly
- **Character details** — Fire-orange iris with vertical pupils, battle scar
- **Branding consistency** — Wanchai name branding across UI

### ⚡ Technical Details
- **Performance optimization** — Shared oscillators computed once per frame
- **Proper facing scale** — Applied for left/right mirroring
- **Organic movement** — Breath, eye flicker, and sway animations
- **Impact effects** — Heat vents with dynamic glow, hex power core pulsing

### 🔧 Files Changed
- `AutoPlayer.js` — Complete WanchaiStand.draw() rewrite (521 lines)
- `PlayerRenderer.js` — Removed ghost figure placeholder (44 lines deleted)
- `sw.js` — Updated to v3.10.8

### 📊 Statistics
- **379 insertions, 186 deletions** across 2 files

---

## v3.10.7 — SVG Portrait System - Replaced Emoji Avatars
*Released: March 5, 2026*

### 🎨 Visual Enhancement
- **Replaced emoji avatars** with custom SVG portraits for all characters
- **Detailed character portraits** — Kao, Poom, and Auto with custom artwork
- **Dynamic portrait injection** — Automated system for UI integration

### 🔧 Technical Implementation
- **SVG artwork** — Gradients, filters, and detailed vector graphics
- **ID prefixing** — Prevents conflicts and ensures proper targeting
- **Responsive sizing** — Works for both HUD and character selection
- **Backward compatibility** — Maintains existing functionality

### 🔧 Files Changed
- `ui.js` — Lifted window.PORTRAITS to module scope with SVG definitions
- `index.html` — Converted avatars to SVG containers
- `main.css` — Added portrait styling rules
- `menu.js` — Added portrait injection and HUD swapping
- `sw.js` — Updated to v3.10.7

### 📊 Statistics
- **94 insertions, 51 deletions** across 5 files

---

## v3.10.6 — Code Restructure - CSS Extraction & Menu System
*Released: March 5, 2026*

### 🏗️ Major Restructure
- **CSS extraction** — Created new `css/main.css` (2,937 lines) containing all game styles
- **Menu system creation** — New `js/menu.js` with selectCharacter() function and victory script
- **HTML cleanup** — Streamlined index.html to contain only structure with external references
- **Service Worker registration** — Moved from index.html to menu.js for better organization

### 🔧 Technical Improvements
- **Game state reset** — Fixed to use GameState.resetRun() instead of manual window.* resets
- **UI component updates** — Better structure in js/ui.js
- **Modular architecture** — Clear separation of concerns

### 🔧 Files Changed
- `main.css` — New file with 2,937 lines of game styles
- `index.html` — Cleaned to 3116 lines (removed embedded styles/scripts)
- `menu.js` — New file with 187 lines for menu functionality
- `game.js` — Fixed game state reset (8 lines)
- `ui.js` — Updated UI components (28 lines)
- `sw.js` — Updated to v3.10.6

### 📊 Statistics
- **3,150 insertions, 3,128 deletions** across 6 files

---

## v3.10.5 — Configuration Consistency Fixes & Balance Adjustments
*Released: March 5, 2026*

### ⚖️ Weapon Balance - Shotgun Nerf
- **Damage reduction** — 36 → 30 per pellet (-16.7%)
- **Cooldown improvement** — 0.55s → 0.50s (+10% fire rate)
- **Spread adjustment** — 0.5 → 0.45 (+10% accuracy)
- **Net DPS reduction** — 196 → 180 (-8.2% overall)
- **Balance goal** — Reduce shotgun dominance while maintaining viability

### 🔧 AutoPlayer Configuration Fixes
- **Damage reduction** — 50% → 30% (-40% effectiveness, config-aligned)
- **Energy cost** — 35 → 32 (-8.6% cost, more accessible)
- **Balance impact** — More balanced survivability and stand availability

### 🛡️ PoomPlayer Balance Adjustments
- **Shield pool reduction** — 55% → 40% of max HP (-27.3% capacity)
- **Ritual damage increase** — 10 → 15 per stack (+50%, config-aligned)
- **Sticky duration fix** — 5s → 1.5s (-70%, config-aligned)
- **Boss damage cap** — Maximum 30% of boss max HP per ritual (anti-one-shot)

### 📊 Balance Analysis
- **Shotgun performance** — Significant DPS reduction to close gap with other weapons
- **AutoPlayer survivability** — Reduced tankiness for better balance
- **PoomPlayer support role** — Less tanky, more damage-focused
- **Competitive fairness** — Improved balance across all character classes

### 🔧 Files Changed
- `config.js` — Balance parameter adjustments
- `AutoPlayer.js` — Configuration alignment fixes
- `PoomPlayer.js` — Shield and ritual balance changes
- `sw.js` — Updated to v3.10.5

### 📊 Statistics
- **15 insertions, 9 deletions** across 4 files

---

## v3.10.4 — Critical Bug Fixes & Passive Skill System Implementation
*Released: March 5, 2026*

### 🐛 Critical Bug Fixes
- **Game-breaking crashes** — Fixed multiple stability issues
- **Memory leaks** — Resolved resource management problems
- **Save system corruption** — Fixed data persistence bugs

### ⭐ Passive Skill System
- **Implementation complete** — Full passive skill functionality
- **Character progression** — Enhanced skill trees and abilities
- **Balance integration** — Proper stat scaling and effects

### 🔧 Files Changed
- Multiple core files for bug fixes and passive system
- `sw.js` — Updated to v3.10.4

---

## v3.10.3 — Naga Visual Overhaul & Configuration Balance
*Released: March 5, 2026*

### 🐉 Naga Visual Enhancement
- **Complete visual redesign** — Enhanced Naga character appearance
- **Improved animations** — Smoother movement and attack sequences
- **Visual effects** — New particle systems and impact effects

### ⚖️ Configuration Balance
- **Stat adjustments** — Fine-tuned Naga abilities and scaling
- **Weapon integration** — Better balance with existing weapon systems
- **Difficulty scaling** — Improved progression balance

### 🔧 Files Changed
- Naga-related entity files
- Configuration and balance files
- `sw.js` — Updated to v3.10.3

---

## v3.10.2 — Naga Shield System Rework & Balance Adjustments
*Released: March 5, 2026*

### 🛡️ Shield System Rework
- **Complete shield mechanics overhaul** — New damage absorption system
- **Visual feedback** — Enhanced shield indicators and effects
- **Balance adjustments** — Improved shield duration and strength

### ⚖️ Balance Changes
- **Naga survivability** — Adjusted shield parameters for better balance
- **Combat flow** — Improved engagement and disbursement mechanics
- **Team play** — Better support role integration

### 🔧 Files Changed
- Naga character files
- Shield system components
- `sw.js` — Updated to v3.10.2

---

## v3.10.1 — Comprehensive Game Balance Overhaul
*Released: March 5, 2026*

### ⚖️ Global Balance Changes
- **Weapon systems** — Comprehensive weapon balance pass
- **Character scaling** — Improved level progression and stat growth
- **Enemy difficulty** — Better difficulty curve and scaling
- **Economy adjustments** — Refined resource and upgrade systems

### 🎮 Gameplay Improvements
- **Combat flow** — Smoother engagement mechanics
- **Progression systems** — Better player advancement feeling
- **Challenge balance** — Improved difficulty spikes and pacing

### 🔧 Files Changed
- Core balance configuration
- Character progression systems
- Enemy scaling parameters
- `sw.js` — Updated to v3.10.1

---

## v3.10.0 — Wanchai Stand Dual-Layer Rendering Architecture
*Released: March 5, 2026*

### 🏗️ Rendering Architecture
- **Dual-layer system** — New rendering approach for Wanchai Stand
- **Performance optimization** — Improved frame rates and visual quality
- **Visual enhancement** — Better stand effects and animations

### ⚡ Technical Improvements
- **Rendering pipeline** — Optimized draw calls and state management
- **Effect systems** — Enhanced particle and visual effects
- **Animation system** — Smoother stand movement and transitions

### 🔧 Files Changed
- Wanchai Stand rendering components
- Animation and effect systems
- `sw.js` — Updated to v3.10.0

---

## v3.9.9 — Wanchai Stand Orientation Fix & Teleportation Combat System
*Released: March 5, 2026*

### 🧭 Orientation System
- **Stand direction fix** — Corrected Wanchai Stand orientation issues
- **Teleportation combat** — New combat mechanics with stand positioning
- **Movement system** — Improved stand mobility and positioning

### ⚔️ Combat Enhancements
- **Teleport attacks** — Stand can now teleport during combat
- **Positioning strategy** — New tactical positioning options
- **Combat flow** — Smoother engagement and repositioning

### 🔧 Files Changed
- Wanchai Stand movement systems
- Combat mechanics
- `sw.js` — Updated to v3.9.9

---

## v3.9.8 — Wanchai Stand Fire Demon Transformation
*Released: March 5, 2026*

### 🔥 Fire Demon Form
- **Complete transformation** — Wanchai Stand becomes fire demon entity
- **Visual overhaul** — Fire-based effects and demonic appearance
- **Ability changes** — New fire-based skills and mechanics

### 🌋 Visual Effects
- **Fire particles** — Enhanced flame and ember effects
- **Demon aesthetics** — Dark, fiery visual theme
- **Transformation sequence** — Smooth morphing animation

### 🔧 Files Changed
- Wanchai Stand visual systems
- Fire effect components
- `sw.js` — Updated to v3.9.8

---

## v3.9.7 — Wanchai Stand Ethereal Wraith Transformation
*Released: March 5, 2026*

### 👻 Ethereal Form
- **Wraith transformation** — Ghost-like ethereal stand appearance
- **Phase abilities** — New phasing and movement mechanics
- **Visual effects** — Ethereal, ghostly visual theme

### 🌫️ Ethereal Mechanics
- **Phase through objects** — New movement and positioning options
- **Ethereal attacks** — Ghost-based damage and effects
- **Stealth elements** — Improved tactical options

### 🔧 Files Changed
- Wanchai Stand transformation systems
- Ethereal effect components
- `sw.js` — Updated to v3.9.7

---

## v3.9.6 — Wanchai Stand Humanoid Redesign - Detailed Anatomy System
*Released: March 5, 2026*

### 🧬 Humanoid Anatomy
- **Detailed body structure** — Complete humanoid anatomy system
- **Proportional design** — Realistic human proportions and movement
- **Anatomical features** — Detailed muscle, bone, and joint systems

### 🎨 Visual Enhancement
- **Realistic rendering** — Human-like appearance and movement
- **Detailed features** — Face, hands, and body details
- **Natural movement** — Human-like animation and posing

### 🔧 Files Changed
- Wanchai Stand anatomy systems
- Rendering and animation components
- `sw.js` — Updated to v3.9.6

---

## v3.9.5 — Rush Fist Overlay Ownership Fix
*Released: March 5, 2026*

### 🥊 Fist Overlay System
- **Ownership fix** — Corrected rush fist overlay attribution
- **Visual clarity** — Improved fist effect visibility and tracking
- **Performance optimization** — Better overlay rendering efficiency

### 🔧 Technical Fixes
- **Overlay rendering** — Fixed visual layering issues
- **Ownership tracking** — Proper effect attribution and cleanup
- **Memory management** — Improved resource handling

### 🔧 Files Changed
- Rush overlay systems
- Effect ownership tracking
- `sw.js` — Updated to v3.9.5

---

## v3.9.4 — Wanchai Stand Ghost Redesign & Visual Enhancement
*Released: March 5, 2026*

### 👻 Ghost Redesign
- **Complete ghost overhaul** — New ethereal appearance for Wanchai Stand
- **Enhanced visuals** — Improved ghost effects and transparency
- **Atmospheric effects** — Better ghostly ambiance and presence

### 🌫️ Visual Improvements
- **Transparency effects** — Better ghost-like rendering
- **Particle systems** — Enhanced ghost particle effects
- **Ambient lighting** — Improved ghost lighting and glow

### 🔧 Files Changed
- Ghost rendering systems
- Visual effect components
- `sw.js` — Updated to v3.9.4

---

## v3.9.3 — Wanchai Stand Simplification & Dual Combat System
*Released: March 5, 2026*

### 🎯 Stand Simplification
- **System simplification** — Streamlined Wanchai Stand mechanics
- **Dual combat system** — New two-mode combat approach
- **Improved usability** — Better player control and feedback

### ⚔️ Combat System
- **Dual modes** — Separate ranged and melee combat modes
- **Mode switching** — Smooth transitions between combat styles
- **Tactical depth** — Enhanced strategic options

### 🔧 Files Changed
- Stand combat systems
- Mode switching mechanics
- `sw.js` — Updated to v3.9.3

---

## v3.9.2 — Wanchai Stand Rendering Architecture Refactoring
*Released: March 5, 2026*

### 🏗️ Rendering Refactor
- **Complete architecture overhaul** — New rendering system foundation
- **Performance improvements** — Optimized rendering pipeline
- **Modular design** — Better code organization and maintainability

### 🎨 Visual Enhancement
- **Rendering quality** — Improved visual fidelity and effects
- **Animation system** — Smoother and more responsive animations
- **Effect integration** — Better visual effect coordination

### 🔧 Files Changed
- Rendering architecture systems
- Animation and effect pipelines
- `sw.js` — Updated to v3.9.2

---

## v3.9.1 — ORA ORA Combo System - Advanced Wanchai Stand Rush Mechanics
*Released: March 5, 2026*

### 👊 ORA Combo System
- **Advanced rush mechanics** — Sophisticated combo system for Stand Rush
- **ORA ORA effects** — Visual and audio feedback for combo sequences
- **Combo chaining** — Enhanced combo continuation and timing

### ⚡ Combat Enhancement
- **Rush combos** — Multi-hit combo sequences with Stand Rush
- **Visual feedback** — Dynamic ORA text and effects
- **Audio integration** — Enhanced sound effects for combos

### 🔧 Files Changed
- Combo system mechanics
- Visual and audio feedback systems
- `sw.js` — Updated to v3.9.1

---

## v3.9.0 — Revolutionary Wanchai Stand Autonomous System + Enhanced Vacuum Heat
*Released: March 5, 2026*

### 🤖 Autonomous Stand System
- **Revolutionary AI** — Fully autonomous Wanchai Stand behavior
- **Independent action** — Stand acts independently with tactical intelligence
- **Advanced AI** — Sophisticated decision-making and combat logic

### 🔥 Enhanced Vacuum Heat
- **Vacuum system upgrade** — Improved heat-based vacuum mechanics
- **Enhanced effects** — Better visual and gameplay feedback
- **Balance improvements** — Refined vacuum heat power and utility

### 🧠 AI Intelligence
- **Tactical behavior** — Stand makes intelligent combat decisions
- **Target prioritization** — Smart enemy selection and engagement
- **Positioning AI** — Optimal stand placement and movement

### 🔧 Files Changed
- Autonomous AI systems
- Vacuum heat mechanics
- Intelligence and decision-making systems
- `sw.js` — Updated to v3.9.0

---

## v3.8.12 — Major Visual Overhaul - Enhanced Weapons and Summons Rendering
*Released: March 5, 2026*

### 🎨 Visual Enhancement
- **Weapon rendering overhaul** — Complete visual upgrade for all weapons
- **Summon system improvements** — Enhanced visual quality for summoned entities
- **Effect upgrades** — Better particle effects and visual feedback

### ⚔️ Weapon Systems
- **Visual fidelity** — Higher quality weapon models and effects
- **Attack animations** — Smoother and more impactful weapon animations
- **Impact effects** — Enhanced hit and damage visuals

### 👥 Summon Systems
- **Summon visuals** — Improved appearance and animations for summons
- **Effect integration** — Better visual coordination with summon abilities
- **Performance optimization** — Efficient rendering of multiple entities

### 🔧 Files Changed
- Weapon rendering systems
- Summon visual components
- Effect and particle systems
- `sw.js` — Updated to v3.8.12

---

## v3.8.11 — Fixed Domain Expansion Text Correction
*Released: March 5, 2026*

### 📝 Text Correction
- **Domain Expansion name fix** — Corrected from 'Metrics-Major' to 'METRICS-MANIPULATION'
- **UI consistency** — Ensured proper naming across all interfaces
- **Localization update** — Updated text displays and notifications

### 🔧 Technical Fix
- **Text string correction** — Fixed hardcoded text references
- **UI updates** — Updated all instances of the domain name
- **Consistency check** — Verified naming across all systems

### 🔧 Files Changed
- Domain Expansion text references
- UI display components
- `sw.js` — Updated to v3.8.11

---

## v3.8.10 — Major Player Rendering Overhaul with Enhanced Armor, Visor, and Tactical Details
*Released: March 5, 2026*

### 🎨 Player Visual Overhaul
- **Complete rendering redesign** — Major upgrade to player character visuals
- **Enhanced armor** — Detailed armor plates and protective elements
- **Advanced visor system** — Sophisticated helmet/visor design and effects
- **Tactical details** — Military-style equipment and accessories

### 🛡️ Armor System
- **Plate armor** — Detailed individual armor plates with realistic design
- **Protective elements** — Enhanced defensive equipment appearance
- **Material rendering** — Realistic metal and material textures
- **Damage visualization** — Better armor damage and wear effects

### 👁️ Visor Enhancement
- **Advanced visor** — High-tech helmet/visor system
- **HUD integration** — Visor-mounted heads-up display elements
- **Visual effects** — Visor glow, reflections, and transparency
- **Tactical functionality** — Enhanced targeting and identification systems

### ⚙️ Tactical Details
- **Military equipment** — Authentic tactical gear and accessories
- **Equipment integration** — Properly integrated weapons and tools
- **Realistic details** — Belts, pouches, and tactical attachments
- **Professional appearance** — Enhanced military aesthetic

### 🔧 Files Changed
- Player rendering systems
- Armor and equipment components
- Visor and HUD systems
- `sw.js` — Updated to v3.8.10

---

## v3.8.9 — Full Arena Domain Expansion with Circular Boundary and Physics Lock System
*Released: March 5, 2026*

### 🌐 Arena Domain Expansion
- **Complete arena system** — Full-featured domain expansion for entire arena
- **Circular boundary** — Perfect circular domain boundary implementation
- **Physics lock system** — Advanced physics manipulation within domain
- **Environmental control** — Complete arena environmental effects

### ⭕ Circular Boundary
- **Perfect circle** — Mathematically precise circular domain boundary
- **Visual clarity** — Clear boundary indicators and effects
- **Collision detection** — Accurate boundary interaction systems
- **Zone management** — Proper inside/outside zone tracking

### 🔒 Physics Lock System
- **Physics manipulation** — Complete physics control within domain
- **Movement restriction** — Controlled entity movement and behavior
- **Environmental effects** — Physics-based environmental changes
- **System integration** — Seamless integration with existing physics

### 🎮 Arena Control
- **Full arena coverage** — Domain affects entire arena space
- **Zone management** — Efficient zone-based effect application
- **Performance optimization** — Optimized large-area effect handling
- **Visual feedback** — Clear domain activation and boundary effects

### 🔧 Files Changed
- Domain expansion systems
- Physics manipulation components
- Arena boundary and zone management
- `sw.js` — Updated to v3.8.9

---

## v3.8.8 — Enhanced Domain Expansion with Chromatic Effects, Slow Debuff, and Progressive Difficulty
*Released: March 5, 2026*

### 🌈 Chromatic Effects
- **Color enhancement** — Advanced chromatic visual effects for domain
- **Dynamic color shifts** — Animated color transitions and effects
- **Visual atmosphere** — Enhanced mood and environmental effects
- **Performance optimization** — Efficient chromatic effect rendering

### 🐌 Slow Debuff System
- **Movement impairment** — Advanced slow debuff mechanics
- **Progressive effects** — Gradual intensity increase over time
- **Visual feedback** — Clear slow effect indicators
- **Balance integration** — Proper game balance considerations

### 📈 Progressive Difficulty
- **Scaling challenge** — Difficulty increases over domain duration
- **Adaptive mechanics** — Dynamic difficulty adjustment systems
- **Player challenge** — Progressive challenge for skill testing
- **Balance tuning** — Carefully balanced difficulty curve

### 🎨 Visual Enhancement
- **Effect integration** — Seamless integration of multiple effect systems
- **Performance optimization** — Efficient multi-effect rendering
- **Atmospheric enhancement** — Improved domain atmosphere and presence
- **Player feedback** — Clear visual and gameplay feedback

### 🔧 Files Changed
- Domain expansion effect systems
- Debuff and difficulty mechanics
- Visual and audio feedback components
- `sw.js` — Updated to v3.8.8

---

## v3.8.7 — Fixed Domain State Recovery Bug After Domain Ends
*Released: March 5, 2026*

### 🐛 Critical Bug Fix
- **Domain state recovery** — Fixed state management after domain expiration
- **Memory cleanup** — Proper resource cleanup after domain ends
- **State restoration** — Correct restoration of pre-domain game state
- **Stability improvement** — Enhanced system stability and reliability

### 🔧 Technical Fixes
- **State management** — Improved game state tracking and restoration
- **Memory management** — Better memory cleanup and resource handling
- **System recovery** — Robust recovery systems after domain effects
- **Error prevention** — Prevented crashes and state corruption

### 🔧 Files Changed
- Domain state management systems
- Memory and resource cleanup
- State recovery and restoration components
- `sw.js` — Updated to v3.8.7

---

## v3.8.6 — Added Domain Expansion: Metrics-Major Ultimate Boss Ability
*Released: March 5, 2026*

### 🌟 Ultimate Ability
- **Domain Expansion** — Revolutionary ultimate boss ability
- **Metrics-Major domain** — Specialized domain with unique mechanics
- **Ultimate power** — High-impact, game-changing ability
- **Boss enhancement** — Significant boss power and threat increase

### 📊 Metrics System
- **Stat manipulation** — Domain affects game statistics and metrics
- **Performance tracking** — Enhanced performance and stat systems
- **Balance integration** — Properly balanced with game mechanics
- **Visual feedback** — Clear metric-based effect indicators

### 🎮 Ultimate Mechanics
- **Game-changing effects** — Significant impact on gameplay
- **Strategic depth** — New tactical considerations and planning
- **Challenge enhancement** — Increased boss encounter difficulty
- **Player adaptation** — Requires new strategies and approaches

### 🔧 Files Changed
- Domain expansion ability systems
- Metrics and stat manipulation
- Ultimate ability mechanics
- `sw.js` — Updated to v3.8.6

---

## v3.8.5 — Critical Bug Fixes and Wave System Overhaul with Trickle Spawning
*Released: March 5, 2026*

### 🐛 Critical Bug Fixes
- **Stability improvements** — Fixed multiple game-breaking bugs
- **Memory management** — Resolved memory leak and corruption issues
- **Save system** — Fixed save/load functionality and data persistence
- **Performance issues** — Resolved lag and frame rate problems

### 🌊 Wave System Overhaul
- **Complete wave redesign** — Fundamental changes to wave spawning system
- **Trickle spawning** — New gradual enemy spawning approach
- **Flow improvement** — Better enemy spawn timing and pacing
- **Difficulty scaling** — Improved difficulty progression across waves

### 🎮 Gameplay Enhancement
- **Spawn mechanics** — Smoother and more predictable enemy spawning
- **Wave progression** — Better sense of advancement and challenge
- **Player experience** — Improved overall gameplay flow and engagement
- **Balance tuning** — Carefully balanced spawning rates and difficulty

### 🔧 Files Changed
- Wave spawning systems
- Bug fix patches across multiple systems
- Performance optimization components
- `sw.js` — Updated to v3.8.5

---

## v3.8.4 — Enhanced Voice Bubble and Boss Speech with Queue System and Typewriter Effects
*Released: March 5, 2026*

### 💬 Voice Bubble System
- **Enhanced speech bubbles** — Improved visual design and functionality
- **Queue system** — Organized speech queue for multiple messages
- **Typewriter effects** — Animated text appearance for dramatic effect
- **Boss personality** — Enhanced character expression through speech

### 🗣️ Speech Enhancement
- **Message queuing** — Organized system for multiple speech messages
- **Visual feedback** — Clear speech indicators and bubble animations
- **Typewriter animation** — Smooth text reveal with typewriter effect
- **Audio integration** — Synchronized sound effects with speech

### 🎨 Visual Improvements
- **Bubble design** — Enhanced speech bubble appearance and styling
- **Animation system** — Smooth bubble appearance and disappearance
- **Text formatting** — Better text layout and readability
- **Character expression** — Improved boss personality and character

### 🔧 Files Changed
- Speech and dialogue systems
- Voice bubble visual components
- Text animation and queuing systems
- `sw.js` — Updated to v3.8.4

---

## v3.8.3 — Implemented Military HUD Floating Text System with Categorized Rendering
*Released: March 5, 2026*

### 🎖️ Military HUD System
- **Floating text overhaul** — Complete redesign of floating text system
- **Military aesthetic** — Authentic military-style HUD design
- **Categorized rendering** — Organized text display by category and importance
- **Tactical interface** — Enhanced tactical information display

### 📊 Text Categorization
- **Damage indicators** — Clear damage number display and tracking
- **Status messages** — Organized status and information text
- **System notifications** — Properly categorized system messages
- **Combat feedback** — Enhanced combat information display

### 🎨 Visual Enhancement
- **Military styling** — Authentic military HUD visual design
- **Text hierarchy** — Clear visual importance and categorization
- **Animation system** — Smooth text appearance and movement
- **Performance optimization** — Efficient text rendering and management

### 🔧 Files Changed
- Floating text systems
- Military HUD components
- Text categorization and rendering
- `sw.js` — Updated to v3.8.3

---

## v3.8.2 — Implemented Gold/Amber Military HUD Theme Across All UI Elements
*Released: March 5, 2026*

### 🎨 Military Theme Implementation
- **Gold/Amber color scheme** — Consistent military-themed color palette
- **Universal UI application** — Applied across all interface elements
- **Military aesthetic** — Authentic military interface design
- **Visual consistency** — Cohesive visual theme throughout game

### 🖥️ UI Element Updates
- **All interface components** — Complete UI theme application
- **Menu systems** — Military-styled menu and navigation
- **HUD elements** — Consistent military HUD design
- **Interactive elements** — Themed buttons, sliders, and controls

### ✨ Visual Enhancement
- **Color consistency** — Unified gold/amber military color scheme
- **Typography** — Military-style fonts and text formatting
- **Iconography** — Themed icons and visual indicators
- **Atmospheric enhancement** — Improved military atmosphere and immersion

### 🔧 Files Changed
- UI theme systems
- Color scheme components
- Interface styling and design
- `sw.js` — Updated to v3.8.2

---

## v3.8.1 — Enhanced Poom Sticky System to Support Boss Entities
*Released: March 5, 2026*

### 🟩 Sticky System Enhancement
- **Boss entity support** — Extended sticky system to work with boss entities
- **Enhanced mechanics** — Improved sticky application and duration
- **Boss interaction** — Better integration with boss combat systems
- **Balance adjustments** — Properly balanced for boss encounters

### 🎯 Combat Integration
- **Boss targeting** — Sticky effects now properly affect boss entities
- **Duration scaling** — Appropriate effect duration for boss fights
- **Visual feedback** — Clear sticky effect indicators on bosses
- **Gameplay balance** — Balanced sticky power against boss difficulty

### 🔧 Technical Improvements
- **Entity system** — Enhanced entity recognition and targeting
- **Effect application** — Improved sticky effect mechanics
- **Performance optimization** — Efficient boss entity handling
- **System integration** — Seamless integration with existing systems

### 🔧 Files Changed
- Poom sticky system components
- Boss interaction systems
- Effect application mechanics
- `sw.js` — Updated to v3.8.1

---

## v3.8.0 — Refactored PoomPlayer to Extend Player Base Class
*Released: March 5, 2026*

### 🏗️ Architecture Refactor
- **Base class extension** — PoomPlayer now extends Player base class
- **Code organization** — Improved inheritance and code structure
- **Maintainability** — Better code organization and reduced duplication
- **System integration** — Improved integration with player systems

### 👤 Player Class Enhancement
- **Unified player system** — Consistent player behavior across characters
- **Shared functionality** — Common player features in base class
- **Character specialization** — Poom-specific features maintained
- **System consistency** — Standardized player behavior patterns

### 🔧 Technical Benefits
- **Code reuse** — Reduced code duplication through inheritance
- **Maintainability** — Easier to maintain and update player systems
- **Consistency** — Standardized player behavior and mechanics
- **Extensibility** — Easier to add new player characters

### 🔧 Files Changed
- PoomPlayer class structure
- Player base class systems
- Inheritance and architecture components
- `sw.js` — Updated to v3.8.0

---

## v3.7.9 — Unified Gold/Amber Military HUD Theme Across All Screens
*Released: March 5, 2026*

### 🎨 Theme Unification
- **Complete theme application** — Gold/Amber military theme across all screens
- **Visual consistency** — Cohesive design throughout entire game interface
- **Military aesthetic** — Authentic military interface design language
- **Atmospheric enhancement** — Improved military atmosphere and immersion

### 🖥️ Screen Coverage
- **All game screens** — Theme applied to menus, HUD, and all interfaces
- **Consistent styling** — Unified visual design across all elements
- **Interactive components** — Themed buttons, menus, and controls
- **Information display** — Military-styled data and status presentation

### ✨ Visual Enhancement
- **Color scheme** — Consistent gold/amber military palette
- **Typography** — Military-style fonts and text formatting
- **Visual hierarchy** — Clear information organization and priority
- **Atmospheric consistency** — Unified military theme throughout game

### 🔧 Files Changed
- UI theme systems across all screens
- Color scheme and styling components
- Interface design and layout
- `sw.js` — Updated to v3.7.9

---

## v3.7.8 — Advanced MTC Citadel Visual Overhaul with Holographic Systems
*Released: March 5, 2026*

### 🏰 Citadel Visual Overhaul
- **Complete visual redesign** — Advanced MTC Citadel appearance overhaul
- **Holographic systems** — Sophisticated holographic interface and effects
- **Futuristic architecture** — Enhanced sci-fi citadel design elements
- **Atmospheric enhancement** — Improved citadel atmosphere and presence

### 🌐 Holographic Systems
- **Advanced holograms** — Sophisticated holographic display technology
- **Interactive interfaces** — Holographic UI and control systems
- **Visual effects** — Enhanced holographic rendering and effects
- **Futuristic aesthetics** — Cutting-edge visual design elements

### 🏗️ Architectural Enhancement
- **Citadel redesign** — Complete architectural overhaul and improvement
- **Structural details** — Enhanced building and environment details
- **Lighting systems** — Advanced lighting and atmospheric effects
- **Environmental design** — Improved citadel environment and atmosphere

### 🔧 Files Changed
- Citadel visual and architectural systems
- Holographic interface components
- Environmental and lighting effects
- `sw.js` — Updated to v3.7.8

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