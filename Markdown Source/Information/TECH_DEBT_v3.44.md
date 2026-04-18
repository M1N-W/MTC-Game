# Tech Debt Audit — post-v3.44.2

*Senior / full-stack review of every file touched in the v3.44.1 + v3.44.2 work.*

Findings are ranked **High / Medium / Low** on (impact × likelihood-of-causing-future-regression). Each item includes the **root cause**, **observed symptom**, and a **long-term remediation** — not a one-shot fix, but a direction that pays down the debt progressively.

---

## 🔴 HIGH — `skillsUnlocked` is a stringly-typed array used in 39 sites across 5 files

**Root cause.** `PlayerBase._abilityUnlock.skillsUnlocked` is a bare `string[]` that every character and the UI mutates and queries by raw string literal:

```js
player._abilityUnlock.skillsUnlocked.includes('teleport')     // KaoPlayer
player._abilityUnlock.skillsUnlocked.push('garuda')           // PoomPlayer
player._abilityUnlock.skillsUnlocked.includes('detonation')   // AutoPlayer
// ...39 total sites, 5 files
```

**Symptom this caused in v3.44.1.** Pat Zanzo lock overlay was missing entirely because the string key `'zanzo'` was never wired from the character file into the UI updater — no compiler/lint check possible. The Kao, Auto, Poom keys have the same risk; they just happened to be coincidentally correct.

**Why the existing mitigation is weak.** The `AbilityUnlock` comment block in `PlayerBase.js` describes the shape but there's no registry listing which keys each character uses. Cross-character key collision (e.g. if `'clone'` is added to another char with different semantics) is undetectable.

**Long-term remediation.**

1. Introduce a frozen registry at `js/systems/SkillRegistry.js`:

   ```js
   export const SKILL_KEYS = Object.freeze({
     KAO:  Object.freeze({ TELEPORT: 'kao.teleport', CLONE: 'kao.clone' }),
     POOM: Object.freeze({ NAGA: 'poom.naga', GARUDA: 'poom.garuda' }),
     AUTO: Object.freeze({ VACUUM: 'auto.vacuum', DETONATION: 'auto.detonation' }),
     PAT:  Object.freeze({ ZANZO: 'pat.zanzo', PERFECT_PARRY: 'pat.perfect_parry' }),
   });
   ```

2. Add helper on `PlayerBase`:

   ```js
   isUnlocked(key) { return this._abilityUnlock.skillsUnlocked.includes(key); }
   unlock(key)     { if (!this.isUnlocked(key)) this._abilityUnlock.skillsUnlocked.push(key); }
   ```

3. Character-scoped keys (`kao.teleport`) eliminate collision risk and make UI updaters self-documenting.

4. Migration can be incremental: both `'teleport'` and `'kao.teleport'` accepted during transition, emit a `console.warn` when the legacy form is used, remove the legacy codepath one release later.

**Effort.** 1 PR for registry + helper + deprecation, 1 PR per character migrating call sites. Low risk (pure rename with fallback).

---

## 🔴 HIGH — `js/ui.js` is a 2 757-line god-file housing 3 unrelated classes

**Observed.** `js/ui.js` contains `UIManager`, `ShopManager`, and `CanvasHUD` plus voice-bubble, boss-speech, cooldown visual, mission-brief legacy paths — all in one module.

**Symptoms.**

- Every v3.44.1 patch (C1–C4, E1, E2) touched this file. Merge conflicts would be brutal for a multi-developer team.
- The 4 `_updateIconsKao/Pat/Auto/Poom` methods each ~100 lines with ~60 % duplicate structure (fetch icon, toggle `.active`, call `_setCooldownVisual`, optionally write name label, optionally call `setLockOverlay`). When the lock-gate logic changed, all 4 needed identical-but-not-identical edits — an error vector that did produce the Pat Zanzo miss.
- Loading this file alone costs ~150 KB (uncompressed) at menu time.

**Remediation (progressive).**

1. **Split by domain** without changing public API:
   - `js/ui/UIManager.js` — HUD orchestration + skill-slot updates
   - `js/ui/CanvasHUD.js` — combo counter, ammo pill, minimap (already logically grouped)
   - `js/ui/ShopManager.js` — entirely unrelated shop modal
   - `js/ui/CooldownVisual.js` — the `_setCooldownVisual` + memo WeakMaps
   - `js/ui/index.js` — barrel re-export, preserves existing `window.UIManager` globals
2. Make the 4 per-character updaters consume a **declarative HUD config**:
   ```js
   // js/ui/hud-config.js
   export const HUD_CONFIG = {
     kao: [
       { iconId: 'teleport-icon', lockKey: SKILL_KEYS.KAO.TELEPORT, cd: 'cooldowns.teleport', cdMax: 'stats.teleportCooldown' },
       { iconId: 'clone-icon',    lockKey: SKILL_KEYS.KAO.CLONE,    cd: 'cooldowns.clone',    cdMax: 'stats.cloneCooldown' },
       // ...
     ],
   };
   ```
   Then `UIManager._updateIcons(player)` is **1 generic loop** instead of 4 bespoke methods. New character = 1 array block in `HUD_CONFIG`, no new code path.

**Effort.** 2–3 days for a careful split + config consolidation. Zero user-visible behaviour change if done right.

---

## 🟠 MEDIUM — Service worker `CACHE_NAME` is a hand-maintained 400-char comment string

**Observed.**

```js
const CACHE_NAME = "mtc-cache-v3.44.2"; // Character-select UI polish: SVG fit (104x121 aspect 96/112), design-token refactor (--frame/glow/corner/menu-* vars per char), unified charGlow replacing kao/poom/pat/wanchaiGlow, new framePulse + cornerPulse (1.8s master + 3.6s harmonic), 4 gold corner brackets per card (.card-corner--tl/tr/bl/br), themed .menu-container via tokens; CHARACTER_CARD_CHECKLIST.md (carries over all v3.44.1 fixes)
```

Plus `urlsToCache` is a hand-maintained list of every asset in the project (~50 entries across sw.js).

**Symptoms.**

- Every PR that ships a code change needs to remember to bump this string or players get stale JS — silent bug.
- Adding a new asset file requires editing `urlsToCache` manually or the SW doesn't cache it (offline/fast-boot regression).
- The trailing inline comment is the **only release-notes channel** inside `sw.js`; it keeps growing and conflicts with every merge.

**Remediation.**

1. **Single source of truth for version**: read from `package.json` (`"version": "3.44.2"`) via a build step, or write a tiny pre-commit hook that bumps both.
2. **Auto-generated `urlsToCache`**: a small build script (`node scripts/gen-sw-manifest.js`) scans the tree and writes the list. Runs in CI; commit the generated output.
3. **Strip inline changelog**: the SW file should read `CACHE_NAME = ${VERSION}`. Release notes belong in `CHANGELOG.md` only.

**Effort.** Half a day for the script + a pre-commit hook.

---

## 🟠 MEDIUM — Duplicated per-character CSS blocks beyond the v3.44.2 refactor

v3.44.2 collapsed `kaoGlow / poomGlow / patGlow / wanchaiGlow` to one `charGlow` + tokens. **But the same duplication pattern still exists elsewhere in `char-select.css`:**

| Block | Duplication | Note |
|-------|-------------|------|
| `.char-card[data-char="X"] .stat-bar-fill` | 4× (gradient + box-shadow) | Could consume `--glow-color` token |
| `.char-card[data-char="X"] .char-tag` | 3× (kao/poom/pat; auto has its own block) | Could unify with token |
| `.char-card[data-char="X"] .char-avatar` radial-gradient | 4× | Avatar bg could consume `--glow-color-soft` |
| `.char-card[data-char="X"] .char-title` colour | 3× inline (auto missing the base rule, uses a hover rule instead — inconsistent) | Could use `var(--frame-color)` |

**Symptom.** Any future restyle touches 4 places. New character = 4–6 more similar blocks.

**Remediation.** Continue the v3.44.2 token refactor to cover these three surfaces. They all have safe fallback chains (`var(--glow-color, <kao-default>)`). Can ship incrementally.

---

## 🟠 MEDIUM — `.char-card[data-char="auto"].selected` and `.char-card[data-char="pat"].selected .char-avatar` duplicate bg-tinting across base/selected/hover states

**Observed in `char-select.css`:**

```css
/* Base state */
.char-card[data-char="pat"] .char-avatar { filter: drop-shadow(0 0 12px rgba(96,165,250,0.55)); }

/* Hover + selected override */
.char-card[data-char="pat"].selected .char-avatar,
.char-card[data-char="pat"]:hover .char-avatar {
  filter: drop-shadow(0 0 18px rgba(96,165,250,0.85)) brightness(1.1);
  box-shadow: 0 0 0 1px rgba(96,165,250,0.35), 0 0 28px rgba(96,165,250,0.2) inset;
}
```

The same `filter: drop-shadow(...)` is written at 3 specificity tiers with slightly different values. It's impossible to audit "what is the actual drop-shadow on Pat hovered+selected?" without tracing cascade. The v3.44.2 unified `charGlow` handles the **animated** box-shadow, but the static `filter` path still duplicates.

**Remediation.** Move these filters into a single selector per state + one `--avatar-glow-radius` token per character. Keeps cascade linear.

---

## 🟡 LOW — Mission-brief regression (`2ec3094`) had **zero** detection layer

**Root cause.** Commit `2ec3094` ("docs audit") deleted `GAME_TEXTS.ai` + `initAI()` together. No test, no boot assertion, no TypeScript, no console-error — the game silently shipped with `#mission-brief` frozen on the placeholder.

**Symptom.** User-visible regression surviving multiple releases.

**Remediation layers (pick by budget).**

1. **Boot-time assertion** (10 lines): in `game.js initializeGame()`, loop over a `REQUIRED_TEXT_KEYS = ['ai', 'ui', 'skillNames', 'messages']` array and `console.error` on any missing key. Cheap insurance.
2. **Playwright smoke test in CI** (the `.tmp_smoke.py` we ran locally can live in `tests/` + CI workflow). 13 checks run in <5 s headless.
3. **Schema-first texts** (bigger): define `types/game-texts.d.ts` and run `tsc --noEmit` in CI even though the codebase is JS — catches missing nested keys at build time.

Layer 1 alone would have caught this specific regression. Layer 2 prevents **all** structural regressions including the Blade Guard one.

---

## 🟡 LOW — PlayerBase subclass state machines lack a documented orthogonality contract

**Observed.** `PatPlayer._tickBladeGuard` coupled Perfect Parry timing with Blade Guard activation on the single flag `_perfectParryArmed`. When SU2 wasn't met, the flag never flipped, and the pre-SU2 guard path became dead code without anyone noticing until a user reported R-Click didn't work in Wave 1.

Kao has similar risk: `_cloneActiveTimer`, `_teleportCharges`, `_stealthActive` share state transitions that aren't declared anywhere.

**Remediation.** For each subclass, add a `STATE MACHINE INVARIANTS` JSDoc block listing which flags are orthogonal and which are coupled. A comment-only contract is weak but still 100× better than nothing; it surfaces during review. Example header:

```js
/**
 * State machines (v3.44.1 audit):
 *   A. Blade Guard:    bladeGuardActive ↔ _bladeGuardCooldown
 *   B. Perfect Parry:  _perfectParryArmed (SU2-gated, orthogonal to A)
 *   C. Iaido:          _iaidoPhase 'none'|'charge'|'cinematic' (exclusive with A+B)
 *
 * ⚠️ A and B must remain ORTHOGONAL. Do not gate A on B.
 */
```

---

## 🟡 LOW — `sw.js` `urlsToCache` drift vs actual fetch requests

**Symptom observed while smoke-testing.** `[error] Failed to load resource: 404` appeared in browser console. Cause: some asset referenced by `index.html` isn't in `urlsToCache`, or vice versa. Unknown asset — SW silently serves 404 on offline.

**Remediation.** The auto-generated `urlsToCache` from item 3 above also solves this.

---

## 🟡 LOW — Plan artifacts live outside the repo

**Observed.** The plan file `C:\Users\User\.windsurf\plans\mtc-charselect-ui-polish-3a18e1.md` is in the user's home directory, not version control. If the user clears that folder, the design rationale for v3.44.2 is lost.

There's already a convention (`Markdown Source/Successed-Plan/E3-shadowblur-profiling-plan.md`) for persisted plans. The char-select plan should follow it.

**Remediation.** After any plan ships, copy the final plan file to `Markdown Source/Successed-Plan/` and commit. This is cheap to do and builds institutional memory.

---

## 🟢 GREEN — Things the v3.44 work did **well** (keep doing)

Not tech debt, but worth naming so the pattern gets reused:

- **Design-token system for char theming** (v3.44.2). CSS vars with fallbacks = graceful degradation. **Extend this pattern** to the other 4 duplicated blocks listed in the Medium section above.
- **`CHARACTER_CARD_CHECKLIST.md`**. Developer-facing, 4 concrete steps, with a "missing X → fallback Y" table. This is the right doc genre — direct, actionable, lives next to the code.
- **Comments that name the historical regression** (`FIX (v3.44.1): decouple...`). Future bisect is trivial when the fix comment names the version and the thing it decoupled.
- **Ad-hoc Playwright smoke test** (`.tmp_smoke.py`). Throwaway but concrete. Promote the pattern into a persistent `tests/ui-smoke.spec.js` run in CI.

---

## Suggested roadmap

| Sprint | Payoff item | Effort |
|--------|-------------|--------|
| Next   | HIGH #1: SkillRegistry + helpers + 1-file migration (start with Pat) | 1 day |
| Next   | LOW  #5: Boot assertion for `GAME_TEXTS` + promote smoke test to `tests/` | ½ day |
| +1     | MEDIUM #3: `urlsToCache` generator + CACHE_NAME from package.json | ½ day |
| +1     | MEDIUM #4: Extend token refactor to stat-bar / char-tag / char-avatar bg | 1 day |
| +2     | HIGH #2: Split `js/ui.js` + declarative `HUD_CONFIG` + generic updater | 2–3 days |
| +2     | MEDIUM #6: Unify filter cascade on `.char-avatar` per state | ½ day |
| +3     | LOW #7: JSDoc `STATE MACHINE INVARIANTS` blocks on all 4 player subclasses | ½ day |

Total: **~1 week of focused refactor** removes the top 4 debt items and leaves the codebase noticeably easier to extend with a 5th character or new menu theme.

No single item is urgent. All are additive/non-breaking; none require a gameplay freeze.
