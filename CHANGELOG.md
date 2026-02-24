# MTC Game Changelog

## v3.1.0 - Phase 2 Faculty Update (Detailed)

**Previous commit:** `e878753` - "Phase 2: Faculty Update - white theme for bosses and summons"

### 🎨 Visual Enhancements
- **Complete boss visual overhaul** - Implemented white theme for all faculty-themed enemies
  - Boss entity redesigned with white color scheme
  - BossFirst (first phase) updated to match aesthetic
  - BossDog (phase 2 summon) redesigned with white theme
  - GoldfishMinion (phase 3 summon) visual effects enhanced

### ✨ Visual Effects
- **Enhanced particle systems** for faculty enemies
- **Improved visual feedback** during boss encounters
- **Consistent visual identity** across all faculty-themed entities
- **Optimized rendering** to maintain performance

### 🚀 Performance
- **Maintained 60 FPS** during intense combat scenarios
- **Optimized sprite batching** for boss rendering
- **Efficient particle management** during boss death sequences

### 🎯 Gameplay Impact
- **Visual clarity** improved for boss phase transitions
- **Better visual cues** for player feedback
- **Consistent theme** enhances game atmosphere
- **Professional polish** to boss encounters

---

## v3.0.1 - Auto/Kao Restore + Orbital Effects (Detailed)

**Previous commits:** `c3890a0`, `ae99745`, `97d8cc6`

### 🎮 Character Restoration
- **AutoPlayer model completely restored** from previous version
- **KaoPlayer model enhanced** with improved visual design
- **Both characters** reintegrated into current game version

### 🌟 Orbital Particle Effects
- **New orbital particle system** for Auto and Kao abilities
- **Dynamic particle trails** following character movement
- **Enhanced visual feedback** for special abilities
- **Performance-optimized** particle rendering

### 🔧 Technical Improvements
- **Fixed model loading** issues that caused character disappearance
- **Improved animation systems** for smoother character movement
- **Enhanced collision detection** for restored characters
- **Optimized memory usage** for character models

---

## v3.0.0 - Students Update (Detailed)

**Previous commit:** `377d3e6` - "Students Update v3.0.0: Restyle all 3 characters to fit dark sci-fi theme + fix SW cache"

### 🎨 Complete Character Redesign
- **All 3 player characters** restyled with dark sci-fi aesthetic
- **Thai High School Anime** theme implemented across character designs
- **Consistent visual direction** for all playable characters
- **Enhanced character silhouettes** for better gameplay visibility

### 🎭 Theme Implementation
- **Dark sci-fi elements** integrated with school uniform designs
- **Anime-inspired visual style** for character expressions and poses
- **Cultural fusion** of Thai school setting with sci-fi elements
- **Cohesive art direction** across entire character roster

### ⚙️ Technical Updates
- **Service Worker cache** updated to v3.0.0 for new character assets
- **Asset optimization** for faster loading of redesigned characters
- **Memory management** improved for new character models
- **Rendering pipeline** optimized for new visual style

---

## v2.7.0 - The Great Rebalancing (Detailed)

**Previous commits:** `a9aa7f3`, `d9d8a3a`, `b160e63`, `c225938`

### ⚖️ Game Balance Overhaul
- **Enemy/Boss HP scaling formulas** completely rebalanced
- **Config-driven balance values** implemented for easier tuning
- **Difficulty curve** smoothed across all game phases
- **Player progression** better balanced with enemy challenges

### 🔫 Weapon System Rebalancing
- **Kao Weapon Master ability** nerfed for game balance:
  - Shotgun damage reduced to 1.5x (from previous higher value)
  - Sniper charge time increased, max damage capped at 2.5x
  - Clone damage reduced to 60% of original value
- **All other weapons** rebalanced to maintain game fairness
- **Weapon progression** better tuned for player experience

### 🐛 Critical Bug Fixes
- **14 critical bugs** resolved across multiple systems
- **Enemy AI** behavior fixes for better game flow
- **Collision detection** improvements for accurate gameplay
- **Performance optimizations** to maintain stable 60 FPS
- **Memory leaks** fixed for longer play sessions

### 📊 Configuration System
- **Centralized balance values** in config files
- **Easier balance tuning** for future updates
- **Transparent game mechanics** for community feedback
- **Data-driven design** for scalable game balance
