# Local verification

Run `npm test`, `node build.mjs --check` and `node --check search-engine-select-runtime.uc.js` from the SES directory. These use the checked-in fixtures and source.

`node tests/browser-qualification.mjs` exercises the production runtime, icons and stylesheet with real Chromium pointer/keyboard events. It simulates Zen search/preferences services and therefore cannot establish native Sine/Gecko behavior. The qualification was run with Playwright 1.62.1 and Chromium revision 1234. Provide Playwright through normal module resolution, or set `BROWSER_TEST_NODE_MODULES` to an existing node_modules directory. Set `BROWSER_TEST_EXECUTABLE` when the browser is outside Playwright's default cache. These are per-command tool parameters; no global environment or browser configuration change is needed.

The browser script creates a fresh profile and regenerable screenshots/report under `.backup-scratch/browser-qualification/`, blocks external requests except its controlled test routes, and closes its own context. Do not point it at an existing browser profile. This scratch scope's backup exclusion is unverified; no backup configuration has been changed.

The automated regression suite retains the meaningful cases. Routine run logs, copied packages, browser profiles and intermediate renders belong in scratch; release behavior and qualification limits are summarized in the main README.
