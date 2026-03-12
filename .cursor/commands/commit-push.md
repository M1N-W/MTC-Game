# commit-push

Analyze all unstaged and changed files in the current workspace. Then, perform the following tasks sequentially:

STEP 1: UPDATE DOCUMENTATION (ONLY if relevant files changed)
Check changes against these rules. If no structural/architectural change occurred, skip updating SKILL.md.

PROJECT_OVERVIEW.md:
- File Structure table → if files were added or removed
- Wave Events table → if WaveManager.js wave schedule changed
- MTC Room section → if map.js room bounds or BossBase spawn guard changed
- Recent Changes → ALWAYS add a new [NEXT VERSION] entry describing the current updates.

SKILL.md (mtc-game-conventions):
- §2 Class Name Map → if constructor/alias names changed
- §3 Inheritance Chain → if extends chain changed
- §4 AI method names/load order → if UtilityAI, SquadAI, PlayerPatternAnalyzer API changed
- §5 Critical Property Rules → if vx/vy, stats.moveSpeed, or StatusEffect timing changed
- §8 Muzzle Offsets table → if shootSingle() offsets in weapons.js changed
- §10 Poom Special Cases → if Poom input routing or WeaponSystem bypass changed
- §11 AutoPlayer Heat Tier → if heat tier NAMES or Q/Wanchai BEHAVIOR changed (not numeric values)
- §13 New Content checklist → if a new file type or script load order was added

⚠️ STRICT RESTRICTIONS FOR DOCS:
DO NOT update or add any numeric stat values (HP, damage, cooldowns, ranges).
DO NOT update config key values (these live in config.js only).
DO NOT update Character Quick-Stats, Base Stats, or Heat Tier multipliers.
DO NOT update Muzzle offset px values unless shootSingle() pixel geometry actually changed.

STEP 2: BUMP VERSION (every commit/push — same version everywhere)

2.1 — Read current version from sw.js
- Open `sw.js` line 1: `const CACHE_NAME = "mtc-cache-vX.Y.Z"; // description"`
- Parse current version: X.Y.Z (e.g. 3.32.2).

2.2 — Choose next version (semver)
- Patch (+0.00.01): docs-only, small bugfixes, no new features → e.g. 3.32.2 → 3.32.3
- Minor (+0.01.00): new features, new files, architecture/refactor → e.g. 3.32.2 → 3.33.0
- Use patch unless the change clearly deserves minor.

2.3 — Update sw.js
- Replace only the version part in line 1. Keep the same comment or set a short one-line description of this release.
- Format: `const CACHE_NAME = "mtc-cache-vX.Y.Z"; // Short description of change"`
- Example: `const CACHE_NAME = "mtc-cache-v3.32.3"; // Version bump procedure documentation"`

2.4 — Update CHANGELOG.md
- Add a new entry at the top (after the doc warning block), same version as sw.js:
  - `## vX.Y.Z — One-line title`
  - `*Released: <today date>*`
  - Brief bullet list of what changed (from STEP 1 or from the commit scope).
  - Under "Files Modified" include: `✅ MODIFIED: sw.js (vX.Y.Z)` and any other files touched.

2.5 — Update PROJECT_OVERVIEW.md
- In the status line (near top): change `**Status:** Beta vX.Y.Z` to the new version so it matches sw.js.

2.6 — Optional
- README-info.md has been removed from the project; no longer update.

⚠️ All version numbers in sw.js, CHANGELOG.md, and PROJECT_OVERVIEW.md must be identical (e.g. v3.32.3 everywhere).

STEP 3: COMMIT AND PUSH
Generate a detailed and professional git commit message based on the changes.
Then, use the terminal to execute:
1. `git add .`
2. `git commit -m "[Your generated commit message]"`
3. `git push`
