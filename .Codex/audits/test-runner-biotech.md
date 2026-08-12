# Biotech Data Commons validation

Date: 2026-08-12

## Scope inspected

- `js/balance.js`, `js/entities/base.js`, `js/map.js`, and `tests/ui_smoke.py` contain the planned map, collision, visual, and regression-test changes.
- `js/game.js` contains the known barrel-removal integration change only: it delegates exploded-object removal to `MapSystem.removeObjectsByFlag()` instead of replacing the whole object array.
- No unrelated tracked file changes were present. Existing audit files and the Python bytecode cache were left untouched.

## Results

- PASS — `PYTHONIOENCODING=utf-8 npm run test:smoke`: 48/48 checks passed, including layout, decorative collision exclusion, destruction-cache refresh, and anti-stuck recovery coverage.
- PASS — `node --check js/map.js js/entities/base.js js/balance.js js/game.js`.
- PASS — `python -m py_compile tests/ui_smoke.py`.
- PASS — `git diff --check` (only informational CRLF conversion warnings).

## Environment note

The unprefixed smoke command is not portable in this Windows CP874 terminal because the pre-existing smoke report prints box-drawing characters; it exits with `UnicodeEncodeError` after test execution. Running it with `PYTHONIOENCODING=utf-8` is clean and produced the passing result above. A separate first attempt encountered Playwright's transient navigation-context race before assertions; the UTF-8 rerun booted and completed normally.
