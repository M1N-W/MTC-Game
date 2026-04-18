# HIGH #2 — `js/ui.js` Full Split (ALL PHASES SHIPPED)

*v3.44.3 shipped Phase 1; v3.44.4 shipped Phases 2-4. Phase 5 (ESM barrel)
deliberately deferred.  This file is kept as a historical reference.*

## Final status after v3.44.4

- ✅ Phase 1 — `js/ui/CooldownVisual.js` extracted
- ✅ Phase 1 — `js/ui/hud-config.js` declarative slot spec
- ✅ Phase 2 — `UIManager._applyHUDConfig()` generic updater, wired into
  `UIManager.updateSkillIcons()` as a lock + cooldown first-pass
- ✅ Phase 3 — `js/ui/ShopManager.js` extracted (99 lines)
- ✅ Phase 4 — `js/ui/CanvasHUD.js` extracted (577 lines + combo state)
- ⏸ Phase 5 — ESM barrel (`js/ui/index.js`) — NOT shipped, waiting for
  full module-system migration.  Would be pure noise while we are
  still global-script.

`js/ui.js` went from 2 757 → 2 083 lines (−24 %).  All 39 Playwright
smoke assertions still green.  Zero user-visible change.

## Status after v3.44.3 (Phase 1 DONE)

- ✅ `js/ui/CooldownVisual.js` extracted (cooldown arc + timer memoize).
  `UIManager._setCooldownVisual()` is a thin proxy — zero call-site churn.
- ✅ `js/ui/hud-config.js` — declarative per-character skill slot spec, ready
  to drive a generic updater.
- ✅ `window.SKILL` integrated with `HUD_CONFIG.lockKey` per slot.
- ✅ 39/39 smoke tests pass.

`js/ui.js` still contains `UIManager` + `ShopManager` + `CanvasHUD` at
~2 700 lines.  Further splits are deferred to keep v3.44.3 low-risk.

## Phase 2 — generic `_applyHUDConfig` updater

Goal: replace the duplicated `_updateIconsKao / Pat / Auto / Poom` simple
loops with one data-driven helper.

### Sketch

```js
// Inside UIManager:
static _applyHUDConfig(player) {
  const cfg = HUD_CONFIG[player.charId];
  if (!cfg) return;
  const setLockOverlay = UIManager._setLockOverlay; // the existing helper

  for (const slot of cfg) {
    const el = document.getElementById(slot.iconId);
    if (!el) continue;

    // Lock gate
    const locked = slot.lockKey !== null && !player.isUnlocked(slot.lockKey);
    setLockOverlay(el, locked);
    if (locked) continue;  // skip cooldown draw on locked slot

    // Cooldown arc
    if (slot.cdPath) {
      const cur = _hudResolvePath(player, slot.cdPath);
      const max = _hudResolvePath(player, slot.cdMaxPath);
      if (max > 0) {
        el.classList.toggle('active', cur <= 0);
        UIManager._setCooldownVisual(slot.iconId, Math.max(0, cur), max);
      }
    }
  }
}
```

Then each `_updateIconsXxx(player)` becomes:

```js
static _updateIconsKao(player, setLockOverlay) {
  UIManager._applyHUDConfig(player);       // simple slots
  // ... bespoke Kao logic: teleport charges arc, clone proximity, etc.
}
```

### Risk assessment

- **Scope:** ~40 lines shrunk per char updater (~120 total) + ~30-line helper.
- **Behaviour change:** zero if the config is accurate; every call
  currently routes through `_setCooldownVisual` + `setLockOverlay` already.
- **Testability:** already covered by smoke — expand with per-frame snapshot.

## Phase 3 — move `ShopManager` to its own file

`UIManager` and `ShopManager` are unrelated; `ShopManager` has its own
modal HTML, its own scroll logic, its own items registry.  Moving it out
of `js/ui.js` is a pure refactor (no call-site changes if we alias
`window.ShopManager`).

### Steps

1. `js/ui/ShopManager.js` — copy the class, keep `window.ShopManager = ShopManager`.
2. Delete the class from `js/ui.js`.
3. Verify `ShopSystem.js` continues to find `window.ShopManager`.

**Estimated gain:** ~350 lines out of `js/ui.js`.

## Phase 4 — move `CanvasHUD` to its own file

`CanvasHUD` already has clean boundaries (combo counter, minimap, ammo
pill, stand warning).  Extract similarly to Phase 3.

**Estimated gain:** ~850 lines out (biggest single chunk).

## Phase 5 — barrel export `js/ui/index.js`

Only useful if/when we move the whole module system to ESM.  Currently
everything is global-script, so a barrel would be noise.  Defer.

## Acceptance criteria for the eventual Phase 2 PR

1. `js/ui.js` reduced by ≥ 500 lines (currently 2 757 → target < 2 250).
2. `tests/ui_smoke.py` still 39/39.
3. Per-frame HUD profile unchanged (`_setCooldownVisual` call count).
4. `CHARACTER_CARD_CHECKLIST.md` updated to point to `HUD_CONFIG` as the
   canonical place to register a new character's skill slots.

## Why defer now

- v3.44.3 already shipped 6/7 roadmap items.  Phase 2 is a pure refactor
  with zero user-visible change — no urgency.
- The token + SkillRegistry work already covers the Pat-Zanzo-class
  correctness concerns.  File length itself does not cause bugs; it only
  slows merge resolution.
- Shipping Phase 1 on its own lets us verify the extraction pattern works
  (CooldownVisual proxy) before attempting the bigger 850-line `CanvasHUD`
  extraction.
