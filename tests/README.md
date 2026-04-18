# MTC Game — Tests

Lightweight headless-browser smoke tests.  Not a full test suite; they cover
structural regressions that escaped review in the past (mission-brief, HUD
lock states, boot-time globals, etc).

## Setup (one time)

```bash
pip install playwright
python -m playwright install chromium
```

## Running

1. Start a local static server from the repo root:
   ```bash
   python -m http.server 8765
   ```
2. In a second terminal, run the smoke suite:
   ```bash
   python tests/ui_smoke.py
   ```
3. Exit code `0` = all green, `1` = at least one assertion failed.

## What the suite covers

- **Boot invariants** — `window.__bootAssertErrors` stays empty.
- **v3.44.1** — mission-brief populated, `initAI()` exposed, E1/E2 perf plumbing loaded, Pat Blade Guard fix present, HUD lock gates read `_abilityUnlock`.
- **v3.44.2** — 16 gold corner spans, design-token vars declared per char, unified `charGlow` keyframe present, per-char legacy keyframes deleted, menu-container tint changes on theme switch, `.char-avatar` aspect-ratio correct.
- **v3.44.3** — `SKILL` registry frozen with correct keys, `PlayerBase.isUnlocked()`/`unlock()` helpers work + idempotent, unknown key is non-fatal.

## Adding checks

Append to `ui_smoke.py`. Keep each `ck(...)` line atomic so the summary line
lists one pass/fail per semantic assertion.

## CI integration (future)

The smoke suite is designed to run in a GitHub Actions job. The pending
task is to commit a `.github/workflows/smoke.yml` that:

1. Boots `python -m http.server` in the background.
2. Runs `python tests/ui_smoke.py`.
3. Fails the PR if exit code is non-zero.
