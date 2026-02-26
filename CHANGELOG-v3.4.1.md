# 🎮 MTC Game Changelog

## Version 3.4.1 - StatusEffect Framework Migration
*Released: February 26, 2026*

### 🎯 Major Features
- **StatusEffect Framework**: Complete architecture overhaul for enemy status management
- **Sticky Rice System**: Migrated from legacy Map-based system to modern StatusEffect framework
- **Ritual Burst**: Now consumes status effects directly from enemies

### 🔧 Technical Improvements
- **-178 lines** removed (legacy sticky system cleanup)
- **+45 lines** added (StatusEffect framework)
- **Net**: -133 lines cleaner, more maintainable code
- **Performance**: Optimized status tick management per enemy
- **Extensibility**: Framework ready for burn, poison, freeze effects

### 🐛 Bug Fixes
- Fixed projectile onHit callback not applying sticky status
- Resolved ritual burst not finding stacked enemies
- Eliminated legacy code memory leaks
- Removed debug console logs for production

### 🎮 Gameplay Changes
- **No gameplay changes** - All mechanics preserved
- Ritual burst now properly iterates all living enemies
- Sticky status expiration managed by enemy instances
- Improved visual feedback consistency

### 🏗️ Architecture
- Enemy classes now own their status effects
- Player uses adapter pattern for backward compatibility
- Service worker updated to v3.4.1 for cache invalidation
- Framework supports future status effect types

### 🧪 Testing
- All acceptance criteria passed (T1-T4)
- Console error-free gameplay
- Multi-wave compatibility verified
- Browser compatibility confirmed

---

## Previous Versions
### v3.4.0 - Critical Bug Fixes
- DOM access guards, RAF race condition fix, memory leak cleanup

### v3.3.3 - Kills Display Fix
- Fixed kills display on game over screen

### v3.3.2 - UI Bug Fixes
- Various UI and display improvements
