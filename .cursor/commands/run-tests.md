# run-tests

Run the project's test suite (if any). If no tests exist, report that and suggest how to add them.

## Steps

1. **Check for test setup**:
   - If `package.json` exists: look for `scripts.test` or `scripts.test:e2e`. Run `npm test` or the script (e.g. `npm run test:e2e`).
   - If no `package.json` or no test script: there is no automated test suite. Say so and optionally suggest:
     - **Unit / module**: add a test runner (e.g. Vitest, Jest) and tests under `js/` or a `test/` folder.
     - **E2E / gameplay**: add Playwright or similar, with specs that load `index.html` or `Debug.html` and assert on canvas/DOM.

2. **If tests exist**: run them in the project root and report pass/fail and any failures.

3. **If user asked to "add tests"**: follow the project rules (Vanilla JS only, no frameworks for game code). Add a minimal test runner config and one example test; do not change game code except to expose any required test hooks.

## Notes

- MTC-Game is Vanilla JS + Canvas. Test runner (Vitest/Jest/Playwright) is tooling only — game code stays framework-free.
- `Debug.html` may expose admin/cheat commands useful for E2E (e.g. spawn boss, set wave).
