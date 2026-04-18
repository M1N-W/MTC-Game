"""
MTC Game — consolidated UI smoke test.

Covers structural invariants from v3.44.1 → v3.44.3.  Run headless against a
local static server (see tests/README.md).

Exit code 0 = all green, 1 = at least one assertion failed.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent
URL = "http://localhost:8765/"

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        console_errs = []
        page.on("pageerror", lambda e: console_errs.append(f"[pageerror] {e}"))
        page.on("console", lambda m: console_errs.append(f"[{m.type}] {m.text}")
                if m.type == "error" else None)

        page.goto(URL, wait_until="domcontentloaded")
        page.wait_for_function(
            "() => window.SKILL && window.GAME_TEXTS && typeof window.initAI === 'function'",
            timeout=10000,
        )
        page.wait_for_timeout(1500)  # Let initAI() + LoadingState.finish() settle

        # ── 0. Boot invariants (v3.44.3) ────────────────────────────────
        boot_errs = page.evaluate("() => window.__bootAssertErrors || []")
        check("No boot invariants violated", len(boot_errs) == 0,
              f"errors: {boot_errs}")

        # ── 1. v3.44.1 regressions ──────────────────────────────────────
        brief = page.locator("#mission-brief").inner_text()
        check("#mission-brief populated by initAI()", brief.startswith("Mission \""),
              f'got: "{brief}"')
        check("window.initAI exposed",
              page.evaluate("() => typeof window.initAI === 'function'"))
        check("UIManager._cdLastBg WeakMap (E1 cooldown memoize)",
              page.evaluate("() => !!(window.UIManager && UIManager._cdLastBg)"))
        check("CanvasHUD._minimapRender (E2 minimap offscreen throttle)",
              page.evaluate("() => typeof CanvasHUD?._minimapRender === 'function'"))

        # ── 2. v3.44.2 character-select UI ──────────────────────────────
        total_corners = page.evaluate(
            "() => document.querySelectorAll('.card-corner').length")
        check("16 .card-corner elements total (4 chars × 4 corners)",
              total_corners == 16, f"got {total_corners}")

        per_card = page.evaluate("""() => Array.from(document.querySelectorAll('.char-card'))
            .map(c => ({ id: c.dataset.char, n: c.querySelectorAll('.card-corner').length }))""")
        for card in per_card:
            check(f"char-card[{card['id']}] has 4 corners", card['n'] == 4,
                  f"got {card['n']}")

        kao_tokens = page.evaluate("""() => {
            const el = document.querySelector('.char-card[data-char="kao"]');
            if (!el) return null;
            const cs = getComputedStyle(el);
            return {
                frame: cs.getPropertyValue('--frame-color').trim(),
                frameBright: cs.getPropertyValue('--frame-color-bright').trim(),
                glow: cs.getPropertyValue('--glow-color').trim(),
                corner: cs.getPropertyValue('--corner-color').trim(),
            };
        }""")
        for key in ("frame", "frameBright", "glow", "corner"):
            check(f"Kao --{key.replace('frame','frame-color').replace('Bright','-bright').replace('glow','glow-color').replace('corner','corner-color')} token set",
                  bool(kao_tokens and kao_tokens[key]))

        css_src = (REPO / "css" / "char-select.css").read_text(encoding="utf-8")
        check("@keyframes charGlow present",   "@keyframes charGlow"   in css_src)
        check("@keyframes framePulse present", "@keyframes framePulse" in css_src)
        check("@keyframes cornerPulse present","@keyframes cornerPulse" in css_src)
        check("Old kaoGlow keyframe deleted",    "@keyframes kaoGlow"    not in css_src)
        check("Old poomGlow keyframe deleted",   "@keyframes poomGlow"   not in css_src)
        check("Old patGlow keyframe deleted",    "@keyframes patGlow"    not in css_src)
        check("Old wanchaiGlow keyframe deleted","@keyframes wanchaiGlow" not in css_src)

        avatar = page.evaluate("""() => {
            const a = document.querySelector('.char-card[data-char="kao"] .char-avatar');
            if (!a) return null;
            const cs = getComputedStyle(a);
            return { w: cs.width, ar: cs.aspectRatio };
        }""")
        check("char-avatar width = 104px",
              avatar and avatar['w'].startswith('104'),
              f"width={avatar['w'] if avatar else 'n/a'}")
        check("char-avatar aspect-ratio 96/112",
              avatar and ("96" in avatar['ar'] or "0.857" in avatar['ar']),
              f"ar={avatar['ar'] if avatar else 'n/a'}")

        # theme switch changes --menu-bg-start
        theme_change = page.evaluate("""() => {
            const overlay = document.getElementById('overlay');
            if (!overlay) return null;
            const read = () => getComputedStyle(overlay).getPropertyValue('--menu-bg-start').trim();
            const orig = overlay.className;
            overlay.classList.remove('theme-kao','theme-poom','theme-auto','theme-pat');
            overlay.classList.add('theme-kao');   const kao = read();
            overlay.classList.remove('theme-kao');
            overlay.classList.add('theme-poom');  const poom = read();
            overlay.className = orig;
            return { kao, poom };
        }""")
        check("theme-kao != theme-poom --menu-bg-start",
              theme_change and theme_change['kao'] != theme_change['poom'],
              str(theme_change))

        # ── 3. v3.44.3 SkillRegistry + helpers ──────────────────────────
        skill_meta = page.evaluate("""() => ({
            kao: Object.keys(SKILL.KAO),
            poom: Object.keys(SKILL.POOM),
            auto: Object.keys(SKILL.AUTO),
            pat: Object.keys(SKILL.PAT),
            frozen: Object.isFrozen(SKILL),
        })""")
        check("SKILL.KAO = TELEPORT, CLONE",
              set(skill_meta["kao"]) == {"TELEPORT", "CLONE"})
        check("SKILL.POOM = NAGA, GARUDA",
              set(skill_meta["poom"]) == {"NAGA", "GARUDA"})
        check("SKILL.AUTO = VACUUM, DETONATION",
              set(skill_meta["auto"]) == {"VACUUM", "DETONATION"})
        check("SKILL.PAT = ZANZO, PERFECT_PARRY",
              set(skill_meta["pat"]) == {"ZANZO", "PERFECT_PARRY"})
        check("SKILL root object is frozen", skill_meta["frozen"])

        helpers = page.evaluate("""() => {
            const k = new KaoPlayer(0, 0);
            const pre = k.isUnlocked(SKILL.KAO.TELEPORT);
            const r1 = k.unlock(SKILL.KAO.TELEPORT);
            const post = k.isUnlocked(SKILL.KAO.TELEPORT);
            const r2 = k.unlock(SKILL.KAO.TELEPORT);
            return { pre, r1, post, r2 };
        }""")
        check("isUnlocked pre-unlock = false", helpers["pre"] is False)
        check("unlock() returns true on first call", helpers["r1"] is True)
        check("isUnlocked post-unlock = true", helpers["post"] is True)
        check("unlock() idempotent (returns false the 2nd time)",
              helpers["r2"] is False)

        # Unknown key must not throw (DEBUG_MODE off in prod)
        unknown = page.evaluate("""() => {
            const k = new KaoPlayer(0, 0);
            try { return { threw: false, val: k.isUnlocked('bogus_xyz') }; }
            catch (e) { return { threw: true, msg: String(e) }; }
        }""")
        check("Unknown skill key is non-fatal (returns false, no throw)",
              unknown["threw"] is False and unknown.get("val") is False,
              str(unknown))

        # ── 3b. v3.44.3 Phase-1 UI split ────────────────────────────────
        check("window.CooldownVisual.set exposed",
              page.evaluate("() => typeof window.CooldownVisual?.set === 'function'"))
        check("UIManager._setCooldownVisual proxies to CooldownVisual",
              page.evaluate("() => typeof UIManager._setCooldownVisual === 'function'"))
        check("window.HUD_CONFIG exposes kao/poom/auto/pat keys",
              page.evaluate("() => !!window.HUD_CONFIG && ['kao','poom','auto','pat'].every(k => Array.isArray(HUD_CONFIG[k]))"))
        check("HUD_CONFIG.pat contains zanzo-icon entry",
              page.evaluate("() => (HUD_CONFIG.pat || []).some(e => e.iconId === 'zanzo-icon' && e.lockKey === SKILL.PAT.ZANZO)"))

        # ── 4. No uncaught browser errors ──────────────────────────────
        check("No [pageerror] or [console error] during boot",
              len(console_errs) == 0,
              "\n    ".join(console_errs[:5]))

        browser.close()

    print("─" * 72)
    fails = 0
    for name, ok, detail in RESULTS:
        sym = "PASS" if ok else "FAIL"
        extra = f"  ({detail})" if detail and not ok else ""
        print(f"  [{sym}] {name}{extra}")
        if not ok:
            fails += 1
    print("─" * 72)
    print(f"  {len(RESULTS)} checks  |  {len(RESULTS) - fails} pass  |  {fails} fail")
    return 1 if fails else 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
