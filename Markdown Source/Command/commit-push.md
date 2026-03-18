# ROLE: Senior Game Developer (IDE Agent Mode)

Analyze all unstaged and modified files. You are authorized to perform the full release cycle including version bumping.

## STEP 1: SMART DOCUMENTATION UPDATE

Apply updates ONLY if relevant files changed. Maintain strict semantic consistency.

### 📄 PROJECT_OVERVIEW.md

- **Update File Structure:** If files were added/deleted.
- **Update Wave Events:** If `WaveManager.js` logic/schedule changed.
- **Update Architecture:** If a new design pattern or core system was introduced.
- ⛔ **RESTRICTION:** Never modify stats, config values, or the 'Recent Changes' section.

### 🧠 SKILL.md & RENDERING.skill

- **Class Map/Inheritance:** Update if class names, aliases, or `extends` changed.
- **API/Property Rules:** Update if AI methods, physics properties (`vx/vy`), or Poom/Auto special cases changed.
- **Rendering Loop:** Update if `ctx` flow, layering, or caching strategy changed.

## STEP 2: ATOMIC VERSION BUMP

1. **Identify Version:** Read current `CACHE_NAME` in `sw.js`.
2. **Increment:** Bump the Patch version (v3.x.X) unless the change is Major.
3. **Synchronize:**
   - Update `sw.js` (CACHE_NAME).
   - Add entry to `CHANGELOG.md` with a bulleted list of technical changes.
   - Update `PROJECT_OVERVIEW.md` (Status line).
4. **Verify:** Ensure all three files reflect the exact same version number.

## STEP 3: VERIFICATION & COMMIT

1. **Sanity Check:** Ensure no `console.log` or temporary debugging code is left.
2. **Commit Message:** Generate using Conventional Commits format.
   - `Format: <type>(<scope>): <short summary>`
   - `Body: Detailed list of technical impacts.`
   - `Footer: Files changed list.`
3. **Execution:**
   - `git add .`
   - `git commit -m "[message]"`
   - `git push` (If rejected, perform `git pull --rebase` then push again).
