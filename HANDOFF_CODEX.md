# MTC Game v3.42.0 — Handoff Document for Codex
> Generated: Apr 10 2026 | Session ended mid-TASK 3b

---

## ✅ COMPLETED TASKS

### TASK 1a — CSS layout fix (`css/main.css`)
**Status: DONE**
Added to `.card-back-skills` (around line 4579):
```css
justify-content: space-between;
height: 100%;
```

### TASK 1b — English skill descriptions (`index.html`)
**Status: DONE**
Updated back-face card skill descriptions for POOM, AUTO, PAT to full English reflecting the AbilityUnlock system. Thai text replaced. Specifically:
- POOM: "Sticky Sap", "Naga Summon (unlock after 10 unique sticky targets)", "Garuda Summon (unlock after Ritual hits 4+ at once)", "Ritual Burst"
- AUTO: "Wanchai Stand", "Vacuum / Stand Pull", "Overheat Detonation", "Heat Tier System (unlocks Scorched Soul passive)"
- PAT: "Blade Guard (reflects progress Perfect Parry)", "Zanzo Flash (unlocks after 3 Iaido hits)", "Iaido Strike", "Dual-Mode Katana"

### TASK 2 — Balance overhaul (`js/config.js` + `js/entities/player/PlayerBase.js`)
**Status: DONE**

**Player HP (config.js):**
| Character | hp/maxHp (was → now) | maxHpPerLevel | passiveHpBonusPct |
|-----------|----------------------|---------------|-------------------|
| Kao       | 119 → **92**         | 6 → **4**     | 0.30 → **0.22**   |
| Auto      | 190 → **150**        | 16 → **10**   | 0.35 → **0.20**   |
| Poom      | 165 → **130**        | 10 → **7**    | 0.45 → **0.28**   |
| Pat       | 140 → **112**        | 7 → **5**     | 0.25 (no change)  |

**DPS multipliers (damageMultiplierPerLevel):**
| Character | was → now |
|-----------|-----------|
| Kao       | 0.09 → **0.065** |
| Auto      | 0.08 → **0.06**  |
| Poom      | 0.09 → **0.065** |
| Pat       | 0.09 → **0.065** |

**PlayerBase.js:** `this.COMBO_MAX_STACKS` changed from `50` → **`30`**

### TASK 3a — CSS split (`css/main.css` → 10 files)
**Status: DONE**

Created 10 files in `css/` folder (PowerShell line-range extraction from main.css):

| File | Content | Lines from original |
|------|---------|---------------------|
| `css/base.css` | BASE region (reset, fonts, body, canvas, layout) | 1–352 |
| `css/overlays.css` | INTERACTION PROMPTS + PAUSE SCREEN | 355–751 |
| `css/admin-console.css` | ADMIN CONSOLE (CRT, input, badges) | 754–1096 |
| `css/shop.css` | SHOP MODAL | 1099–1659 |
| `css/hud.css` | ACHIEVEMENTS HUD + BOSS HUD + SKILL BAR | 1662–2546 |
| `css/menus.css` | MAIN MENU OVERLAY | 2549–3154 |
| `css/screens.css` | VICTORY SCREEN | 3157–3561 |
| `css/char-select.css` | CHARACTER SELECT + FLIP CARD SYSTEM | 3564–4743 |
| `css/tutorial.css` | TUTORIAL OVERLAY | 4746–5121 |
| `css/ui-extras.css` | MOBILE UI + UX PATCHES + TOOLTIPS + LOADING + GAME OVER | 5124–6596 |

`index.html` updated: replaced `<link rel="stylesheet" href="css/main.css">` with 10 separate `<link>` tags (lines 34–46).

**⚠️ NOTE:** `css/main.css` still exists with all original content — it is no longer linked by index.html.
Codex should either delete it or convert it to an `@import` aggregator. Recommended: delete it.

---

## 🔴 REMAINING TASKS

---

### TASK 3b — Split `js/config.js` into 3 files + update `index.html`
**Status: IN PROGRESS (not started yet)**

**config.js structure** (2130 lines total):
| Lines | Constant | Target file |
|-------|----------|-------------|
| 1–1226 | `'use strict'`, JSDoc header, `API_KEY`, `WAVE_SCHEDULE` (+ `window.WAVE_SCHEDULE` at line 80), `BALANCE` | `js/balance.js` |
| 1228–1301 | `SHOP_ITEMS` | `js/shop-items.js` |
| 1302–1409 | `GAME_CONFIG` | `js/shop-items.js` |
| 1410–1446 | `VISUALS` | `js/shop-items.js` |
| 1447–1491 | `ACHIEVEMENT_DEFS` | `js/shop-items.js` |
| 1493–1859 | `GAME_TEXTS` (+ `window.GAME_TEXTS` at line 1860) | `js/game-texts.js` |
| 1862–2120 | `MAP_CONFIG` (+ `window.MAP_CONFIG` at line 2120) | `js/game-texts.js` |
| 2121–2126 | `window.BALANCE`, `window.SHOP_ITEMS`, `window.GAME_CONFIG`, `window.VISUALS`, `window.ACHIEVEMENT_DEFS` | distribute to each file |
| 2127–2130 | `module.exports` | `js/game-texts.js` |

**Steps to implement:**

**1. Create `js/balance.js`:**
```powershell
$cfg = Get-Content "js\config.js" -Encoding UTF8
$cfg[0..1225] | Set-Content "js\balance.js" -Encoding UTF8
# Then append window.BALANCE at end:
Add-Content "js\balance.js" "`nwindow.BALANCE = BALANCE;" -Encoding UTF8
```

**2. Create `js/shop-items.js`:**
```powershell
$lines = @("'use strict';") + $cfg[1227..1490]
$lines += ""
$lines += "window.SHOP_ITEMS = SHOP_ITEMS;"
$lines += "window.GAME_CONFIG = GAME_CONFIG;"
$lines += "window.VISUALS = VISUALS;"
$lines += "window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;"
$lines | Set-Content "js\shop-items.js" -Encoding UTF8
```

**3. Create `js/game-texts.js`:**
```powershell
$lines = @("'use strict';") + $cfg[1492..2119] + $cfg[2126..2129]
$lines | Set-Content "js\game-texts.js" -Encoding UTF8
```
> Lines 2121–2125 are the window assignments for BALANCE/SHOP_ITEMS/etc — these are already handled in their own files, so SKIP them in game-texts.js. Lines 2126 (blank) and 2127–2129 (module.exports) should be included.

**4. Update `index.html`:** Replace this line:
```html
<script defer src="js/config.js"></script>
```
With:
```html
<script defer src="js/balance.js"></script>
<script defer src="js/shop-items.js"></script>
<script defer src="js/game-texts.js"></script>
```
> Load order MUST be: balance.js → shop-items.js → game-texts.js (in that order). All other scripts come after.

**5. Handle old `js/config.js`:** Either delete it, or leave it as a dead file. It is no longer loaded by index.html after this change.

---

### TASK 3c — Extract `EnemyRenderer` from `js/entities/enemy.js` → `js/rendering/EnemyRenderer.js`
**Status: PENDING**

**What to do:**
1. Open `js/entities/enemy.js` and find the `EnemyRenderer` static class (search for `class EnemyRenderer` or `static draw`).
2. Extract the entire `EnemyRenderer` class to a new file: `js/rendering/EnemyRenderer.js`
3. The new file should start with `'use strict';` and end with `window.EnemyRenderer = EnemyRenderer;`
4. In `js/entities/enemy.js`: remove the EnemyRenderer class, keep all other classes intact (Enemy, TankEnemy, MageEnemy, and any others).
5. Update `index.html` to add:
```html
<script defer src="js/rendering/EnemyRenderer.js"></script>
```
   This line should be placed **after** `enemy.js` and before or alongside other renderer files (around line 1032 where `PlayerRenderer.js` and `BossRenderer.js` are loaded):
```html
<script defer src="js/rendering/PlayerRenderer.js"></script>
<script defer src="js/rendering/BossRenderer.js"></script>
<script defer src="js/rendering/EnemyRenderer.js"></script>   ← ADD THIS
```

---

### TASK 4 — Post-completion documentation + sw.js + commit
**Status: PENDING (do after 3b and 3c are done)**

**1. Update `sw.js`:**
- File: `c:\Mawin-Game\MTC-Game\sw.js` line 1
- Change: `const CACHE_NAME = 'mtc-cache-v3.42.0';` (already set from previous session)
- Also update the urlsToCache array:
  - Remove: `"./css/main.css"` and `"./js/config.js"`
  - Add all 10 CSS files and 3 JS config files:
    ```
    "./css/base.css", "./css/overlays.css", "./css/admin-console.css",
    "./css/shop.css", "./css/hud.css", "./css/menus.css",
    "./css/screens.css", "./css/char-select.css", "./css/tutorial.css",
    "./css/ui-extras.css",
    "./js/balance.js", "./js/shop-items.js", "./js/game-texts.js"
    ```

**2. Update `PROJECT_OVERVIEW.md`:**
- File Structure table → add all 10 css/* files and 3 js/*.js files, remove main.css and config.js entries
- Recent Changes → add v3.42.0 entry

**3. Update `CHANGELOG.md`:**
Add entry:
```
## v3.42.0 — Phase 7e: Balance Overhaul + File Modularization
- Balance: HP, DPS, COMBO_MAX_STACKS adjusted for all 4 characters
- CSS split: main.css → 10 modular CSS files
- JS split: config.js → balance.js / shop-items.js / game-texts.js
- Rendering: EnemyRenderer extracted to rendering/EnemyRenderer.js
- UI: All skill card descriptions updated to English (AbilityUnlock system)
- Fix: .card-back-skills flexbox layout
```

**4. Commit & push:**
```
git add -A
git commit -m "v3.42.0: Refactor + Balance Overhaul - Split CSS/JS, balance all characters, update skill descriptions"
git push
```

---

## 📁 File State Summary

| File | State |
|------|-------|
| `css/main.css` | ⚠️ Orphaned (no longer linked) — should be deleted |
| `css/base.css` through `css/ui-extras.css` | ✅ Created (10 files) |
| `js/config.js` | ⚠️ Will be orphaned after TASK 3b — delete after split |
| `js/balance.js` | ❌ Not yet created (TASK 3b) |
| `js/shop-items.js` | ❌ Not yet created (TASK 3b) |
| `js/game-texts.js` | ❌ Not yet created (TASK 3b) |
| `js/rendering/EnemyRenderer.js` | ❌ Not yet created (TASK 3c) |
| `js/entities/player/PlayerBase.js` | ✅ COMBO_MAX_STACKS = 30 |
| `js/config.js` (balance values) | ✅ All 4 characters updated |
| `index.html` | ✅ CSS links updated; script links still need updating (TASK 3b) |
| `sw.js` | ⚠️ Needs cache list updated (TASK 4) |

---

## ⚠️ Known Lint Warnings (NOT real bugs)
`PatPlayer.js` shows ~17 TypeScript "';' expected" and "Unexpected keyword or identifier" lints.
These are **TypeScript language service false positives** on valid JavaScript class method signatures (`update(dt, keys, mouse) {`, etc.).
The code runs correctly in-browser. Do NOT modify PatPlayer.js to fix these.

---

## 🔧 Environment Notes
- **Project root:** `c:\Mawin-Game\MTC-Game\`
- **Shell:** PowerShell (`pwsh`)
- **No build step** — plain HTML/CSS/JS served statically
- **Service worker** at `sw.js` manages cache — must be updated whenever files are added/removed
