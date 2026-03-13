Analyze all unstaged and modified files in the current workspace, then execute the following steps sequentially.

---

## STEP 1: UPDATE DOCUMENTATION (only if relevant files changed)

Apply only the rules below. Do not modify any other sections.

### PROJECT_OVERVIEW.md

| Condition | Section to update |
|---|---|
| New file added or existing file deleted | File Structure table |
| Wave schedule changed in `WaveManager.js` | Wave Events table |
| Room bounds or BossBase spawn guard changed in `map.js` | MTC Room section |
| New architectural pattern introduced | Architecture section |

⛔ Never touch:
- `Recent Changes` section — changelog lives in `CHANGELOG.md` only
- Any numeric stats: HP, damage, cooldowns, ranges
- Config key values — source of truth is `config.js`
- Character Quick-Stats, Base Stats, Heat Tier multipliers
- Muzzle offset px values unless `shootSingle()` pixel geometry actually changed

### SKILL.md (mtc-game-conventions)

| Condition | Section to update |
|---|---|
| New constructor or alias added | §2 Class Name Map |
| `extends` chain changed | §3 Inheritance Chain |
| `UtilityAI`, `SquadAI`, or `PlayerPatternAnalyzer` API changed | §4 AI method names / load order |
| `vx/vy`, `stats.moveSpeed`, or `StatusEffect` timing changed | §5 Critical Property Rules |
| `shootSingle()` offsets in `weapons.js` changed | §8 Muzzle Offsets table |
| Poom input routing or WeaponSystem bypass changed | §10 Poom Special Cases |
| Heat tier names or Q/Wanchai behavior changed (not numeric values) | §11 AutoPlayer Heat Tier |
| New file added or script load order changed | §13 New Content checklist |

### mtc-rendering.skill (Rendering Conventions)

| Condition | Section to update |
|---|---|
| Canvas context flow changed (`ctx.save()` / `ctx.restore()` blocks) | Core Rendering Loop |
| Layer order or draw sequence changed in `PlayerRenderer.js` / `BossRenderer.js` | Z-Index & Layering |
| Object pooling logic added or removed in `effects.js` | Performance & Particle GC |
| Caching strategy changed (e.g. `OffscreenCanvas` usage) | Rendering Decoupling / Cache |

---

## STEP 2: BUMP VERSION

1. Increment version in `sw.js` (CACHE_NAME) following the Version Increment Criteria in `PROJECT_OVERVIEW.md`
2. Add a new entry in `CHANGELOG.md` with full detail of all changes
3. Verify the version number in `sw.js` and `CHANGELOG.md` match exactly

⚠️ Version bump ownership:
- Claude / AI agents (code, analysis, chat) → ❌ never touch version numbers
  Reason: prevents desync between files when token/session limits are hit
- IDE at commit time (Windsurf / Cursor / Roo Code / Trae) → ✅ bump all files in one pass

---

## STEP 3: COMMIT AND PUSH

Generate a detailed, professional git commit message based on all changed files.

Format:
<type>(<scope>): <short summary>
<body — bullet list of key changes>
Files changed: <comma-separated list>

Then execute:
git add .
git commit -m "[generated commit message]"
git push