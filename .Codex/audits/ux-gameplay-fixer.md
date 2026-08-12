# UX Gameplay Fixer — Delivery Record

## Delivered

- Enemy collision recovery aggregates simultaneous contact normals and retains a deterministic tangent/escape window, preventing two-prop pinches from repeatedly overwriting intent.
- Map presentation now selects one focused sector label, removes repeated landmark name text, and uses a two-row deduplicating Event Rail instead of a persistent terminal stack.
- Gameplay uses a 1.25 camera render scale with shared world/screen transforms and normalized pointer mapping. Browser zoom remains available for accessibility.
- Kao has a blue, asymmetric canvas reticle; the native cursor is hidden only while the active pointer is over the gameplay canvas.
- Portal lifecycle is `idle -> activeGate -> rewardPending -> advancing`, so collection and upgrade pauses cannot create a second gate. The new Anomaly Relay uses a broken containment hex, fixed amber pylons, teal ribbons, and one `WAVE N // ENTER` cue.
- Data Hijack now has an 8-second, 30-energy, stronger temporary conversion and a contextual F prompt. Time Fracture presents a rate-limited T prompt only for a close four-enemy threat with adequate energy. Both remain manual; no energy is spent by automatic casting.
- Glitch-wave world-text/timer spam is replaced by the single high-hierarchy wave treatment plus one Event Rail notice.

## Risk and rollback

- Camera scale affects every world render path; the shared `camera.zoom` / `worldToScreen` helpers are the rollback boundary.
- Enemy escape tuning is isolated to primitive fields in `Entity` and `MapObject.resolveCollision`; no pathfinding or collision-grid scans were added.
- Portal state remains behind the existing `PortalSystem` API and can be reverted without map or save migration.
- One tracked Python bytecode cache was refreshed by Python verification; it is generated test output, not a source change.

## Verification

- `PYTHONIOENCODING=utf-8 npm run test:smoke` — 50/50 passed.
- Targeted JavaScript syntax checks passed for map, game, entities, camera/input, all changed systems, and effects.
- `python -m compileall -q tests` passed.
- `git diff --check` passed.
