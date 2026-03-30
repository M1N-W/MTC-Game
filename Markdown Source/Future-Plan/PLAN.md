# Finish Expanded Enemy Roster Stabilization

## Summary
The repo is currently mid-milestone, not ready to release yet. The core stabilization code is already in place in `js/config.js`, `js/entities/enemy.js`, `js/systems/WaveManager.js`, and `js/systems/AdminSystem.js`, and Playwright smoke checks already proved these facts:
- Start flow works and enters gameplay without new console errors.
- `window.ENEMY_REGISTRY`, `window.applyWaveModifiersToEnemy`, `window.AdminConsole`, and `window.SquadAI` are present at runtime.
- `enemy report` works from the in-game admin console.
- `spawn pack supportpressure` successfully spawns `buffer`, `hunter`, and `fatality_bomber`.

The next work is to turn this from “implemented and partially verified” into a decision-complete playtest/release candidate.

## Ordered Work Plan
### 1. Clean and freeze the current branch state
- Remove the untracked `.playwright-cli/` artifact directory before any commit or versioning.
- Keep the four modified files as the only intended gameplay diff:
  - `js/config.js`
  - `js/entities/enemy.js`
  - `js/systems/WaveManager.js`
  - `js/systems/AdminSystem.js`
- Do not touch `sw.js`, changelog, or docs yet; versioning is deferred until gameplay verification passes.

### 2. Complete runtime verification of the new roster behaviors
- Run a headed Playwright pass, not just headless, because the current open question is behavior cadence, not page boot.
- Validate these scenarios from actual gameplay state, in this order:
  1. `spawn enemy sniper 1`
  2. `spawn enemy shield_bravo 1`
  3. `spawn enemy poison_spitter 1`
  4. `spawn enemy charger 1`
  5. `spawn enemy hunter 1`
  6. `spawn enemy fatality_bomber 1`
  7. `spawn enemy healer 1`
  8. `spawn enemy summoner 1`
  9. `spawn enemy buffer 1`
  10. `spawn pack anchor`
  11. `spawn pack pressure`
  12. `spawn pack support`
  13. `spawn pack supportpressure`
- For each run, record:
  - whether the enemy expresses its role clearly
  - whether the telegraph is readable without code knowledge
  - whether `window.specialEffects` remains bounded
  - whether the enemy dies, despawns, and cleans up correctly

### 3. Investigate the one unresolved runtime gap before release
- Reproduce the `summoner + charger + poison_spitter` scenario again in headed mode.
- Check these runtime truths in-browser before changing code:
  - `window.gameState` is actually playing
  - enemy positions update over time
  - cooldown timers decrease
  - summoner `_activeMinions` changes
  - `window.specialEffects.length` changes
  - player/enemy distance and map geometry do not block actions unintentionally
- Default decision:
  - If headed/manual play shows summon and poison behaviors working, treat the earlier headless result as a tooling limitation and do not change code.
  - If headed/manual play still shows no summon or hazard behavior, patch only the failing trigger path in `js/entities/enemy.js`, not the renderer or wave system.

### 4. Lock balancing and pacing only after runtime truth is clear
- If support or hazard density still feels oppressive, adjust only config-level weights and caps in `BALANCE.waves.enemyPools` and `BALANCE.waves.expandedRosterRules`.
- If a single enemy feels unfair in isolation, adjust only that enemy’s config block unless the issue is clearly logic-related.
- Keep the architecture stable:
  - `window.ENEMY_REGISTRY` remains the only runtime spawn registry
  - `window.applyWaveModifiersToEnemy(enemy)` remains the shared modifier entrypoint
  - `SquadAI.tagOnSpawn(enemy)` remains mandatory after insertion into `window.enemies`
  - `_tickShared(dt, player)` stays the first gameplay call in enemy `update()`
  - render code remains read-only

### 5. Finish the playtest package
- After gameplay verification is clean, run:
  - `node --check js/config.js`
  - `node --check js/entities/enemy.js`
  - `node --check js/systems/WaveManager.js`
  - `node --check js/systems/AdminSystem.js`
- Then bump release metadata together:
  - patch bump `sw.js` cache version
  - add a changelog entry
  - update any status/version line that must match the service worker version
- Only after that, stage and commit the gameplay stabilization work.

## Public APIs / Contracts To Preserve
- `window.ENEMY_REGISTRY` stays canonical for runtime enemy creation.
- `window.applyWaveModifiersToEnemy(enemy)` stays public and reusable for admin spawns and summons.
- `enemy report` and `spawn pack <preset>` stay in `AdminSystem` as the primary playtest/debug interface.
- No new public globals should be introduced for this milestone.
- No state mutation is allowed inside draw paths or renderer helpers.

## Test Plan
- Functional:
  - all 9 new enemies spawn individually and express intended role
  - anchor, pressure, support, and support-backed pressure packs all work
  - support enemies prefer backline behavior and do not endlessly chain buffs/heals
  - summoner minions inherit wave modifiers and clean up on owner death or lifetime expiry
  - poison pools and bomber warnings appear, cap correctly, and remove safely
- Regression:
  - existing `basic`, `tank`, and `mage` still spawn from waves
  - speed-wave modifier still applies to admin spawns and summons through the shared hook
  - no new console errors during menu, gameplay start, and admin console use
- Acceptance:
  - live support and hazard counts respect `expandedRosterRules`
  - no runaway growth in `window.specialEffects` or minion count
  - telegraphs are readable in motion, not just in static screenshots

## Assumptions and Defaults
- The current four modified gameplay files are the intended scope of this milestone.
- The three deferred enemies remain out of scope: `teleport mage`, `boomerang drone`, `stealth assassin`.
- Headed runtime truth takes precedence over headless ambiguity when evaluating summon/hazard cadence.
- Version bumping and release packaging happen only after the unresolved summon/hazard scenario is settled.
