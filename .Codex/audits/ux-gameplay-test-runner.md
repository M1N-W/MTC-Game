# UX / Gameplay Independent Verification

## Result: passed after targeted lighting repair

Fresh static verification passed:

- `PYTHONIOENCODING=utf-8 npm run test:smoke`: 50/50 checks pass.
- Node syntax check passed for 14 changed JavaScript files.
- `python -m compileall -q tests`: pass.
- `git diff --check`: pass (CRLF warnings only).

Targeted live-browser assertions passed:

- In `PLAYING`, `CrosshairSystem` adds `gameplay-cursor-hidden`; computed canvas cursor is `none`.
- Kao resolves to `kao-sight` with `#38bdf8` and `#e0f2fe` palette.
- Camera zoom is `1.25`; `worldToScreen` and `screenToWorld` round-trip to floating-point precision, and pointer event normalization stayed within 0.32 screen pixels / 0.26 world units (the browser event client coordinates are integer-rounded).
- Portal state machine rejects duplicate spawns, blocks a second spawn in `rewardPending`, consumes one transition, then returns to idle after completion.
- TerminalLog collapses a duplicate gate event into one line with `x2`, and keeps at most two lines.
- Map label draw pass emitted exactly one visible sector label.
- AbilityCoach rendered the Hijack prompt and cleared it while paused.

Initial browser error and repair:

```
ReferenceError: sizeChanged is not defined
  at MapSystem.drawLighting (js/map.js:1956:9)
  at drawGame (js/game.js:948:19)
  at gameLoop (js/game.js:174:13)
```

The current `drawLighting()` diff had removed its local declarations for `lc`, `lctx`, and `sizeChanged`, while the throttle and rendering body still referenced them. The targeted repair restored the declarations and resize check at the start of `drawLighting()`.

Post-repair verification:

- Fresh `npm run test:smoke`: 50/50 pass.
- Fresh syntax, `compileall`, and `git diff --check`: pass.
- A service-worker cache clear and fresh local-page load pulled the repaired `map.js`; the loaded `MapSystem.drawLighting` contains the restored setup and a direct live call returns `ok`.
- The Playwright console tool retains the earlier page error across navigation. The fresh navigation reports `0 errors`; the direct live call is the decisive post-repair check.

Generated artifacts: Playwright snapshot and console logs under `.playwright-mcp/`; `tests/__pycache__/ui_smoke.cpython-312.pyc` was refreshed by compileall.
