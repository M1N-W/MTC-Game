---
description: How to commit changes according to MTC Game Development Rules
---
# Commit Changes Workflow

When you are ready to commit and push, use this command structure:

Analyze all unstaged and changed files in the current workspace. Then, perform the following tasks sequentially:

### STEP 1: UPDATE DOCUMENTATION (ONLY if relevant files changed)
Check changes against these rules. If no structural/architectural change occurred, skip updating `SKILL.md`.

**PROJECT_OVERVIEW.md**:
- **File Structure table** → if files were added or removed
- **Wave Events table** → if `WaveManager.js` wave schedule changed
- **MTC Room section** → if `map.js` room bounds or `BossBase` spawn guard changed
- **Recent Changes** → ALWAYS add a new `[NEXT VERSION]` entry describing the current updates.

**SKILL.md** (mtc-game-conventions):
- **§2 Class Name Map** → if constructor/alias names changed
- **§3 Inheritance Chain** → if extends chain changed
- **§4 AI method names/load order** → if `UtilityAI`, `SquadAI`, `PlayerPatternAnalyzer` API changed
- **§5 Critical Property Rules** → if `vx`/`vy`, `stats.moveSpeed`, or `StatusEffect` timing changed
- **§8 Muzzle Offsets table** → if `shootSingle()` offsets in `weapons.js` changed
- **§10 Poom Special Cases** → if Poom input routing or `WeaponSystem` bypass changed
- **§11 AutoPlayer Heat Tier** → if heat tier NAMES or Q/Wanchai BEHAVIOR changed (not numeric values)
- **§13 New Content checklist** → if a new file type or script load order was added

⚠️ **STRICT RESTRICTIONS FOR DOCS:**
- DO NOT update or add any numeric stat values (HP, damage, cooldowns, ranges).
- DO NOT update config key values (these live in `config.js` only).
- DO NOT update Character Quick-Stats, Base Stats, or Heat Tier multipliers.
- DO NOT update Muzzle offset px values unless `shootSingle()` pixel geometry actually changed.

### STEP 2: BUMP VERSION
Update the version number in `sw.js` (CACHE_NAME) and document the changes in `CHANGELOG.md`. Make sure the versions match.

### STEP 3: COMMIT AND PUSH
// turbo
Generate a detailed and professional git commit message based on the changes. Then, use the terminal to execute:
1. `git add .`
2. `git commit -m "[Your generated commit message]"`
3. `git push`
