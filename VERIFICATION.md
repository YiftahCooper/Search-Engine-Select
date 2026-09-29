# Verification for fork version 1.1.34 — 2026-09-29

## Settings integration in 1.1.34

Engine visibility and custom-engine controls now mount inside Sine's existing Configure dialog. The floating menu opens that same dialog rather than owning a second settings surface. Existing stored configuration is reused without migration.

The updated suite has 23 passing tests, including real DOM controls in a simulated preferences window with no gBrowser, settings access while the selector is off, clean reload/unload, card rebuilding, clearing unfinished form entries, cross-window engine updates through shared preferences, and refreshing on Configure reopen after an external settings change. Existing lifecycle, URL validation, invalid-data recovery and stale-write tests remain passing. The generated entry matches source and passes syntax checking.

These are source and DOM harness checks. Actual Sine dialog geometry, navigation, theme rendering and live update behavior have not been exercised in native Zen.

Independent source review found no Critical or Important defect. Its Minor stale-list-on-reopen finding received a failing regression and a fix that refreshes on Configure opening while retaining stale-write protection.

## Previous lifecycle evidence

The upstream source allows repeated initialization to append another control. It also leaves asynchronous initialization and listeners able to outlive disable/reload. Lifecycle regressions were observed failing against the preserved upstream script before the repair. This is a reproduced source-level explanation for duplicate controls; the user's everyday Zen session was not inspected, so it does not exclude two separately installed copies as an additional cause.

The previous 1.1.33 Node/jsdom suite contained 18 behavior tests, retained or adapted to the new settings location:

- Seven lifecycle cases: repeated enable, repeated script evaluation, disable during pending initialization, disable/re-enable during pending initialization, full unload cleanup, reload before window load, and a delayed URL-bar lookup after re-enable.
- Six configuration cases: hide/restore native engines, custom Hebrew/reserved-character URL encoding, malformed settings preservation, manager add/remove, unsafe/invalid URL rejection, and access to management with an empty engine list.
- Five interaction cases: keyboard opening/activation/Escape, cross-window stale-write refusal, text-safe labels, late refresh after disable, and explicit invalid-settings backup/reset.

Independent source review identified a delayed URL-bar lookup that could replace a newer search after re-enable. A new regression failed before the fix and passed after the generation guard was added. The reviewer independently reran that focused regression and the generated-output check and confirmed the finding resolved.

Previous 1.1.33 verification: `node build.mjs` succeeded; `npm test` passed all 18 tests with no skips; `node build.mjs --check` passed; `node --check search-engine-select.uc.js` passed. The build check verifies the installable script matches editable source; syntax checks verify parsing, not browser compatibility.

## Limits

The harness uses real jsdom elements with test doubles for Gecko services, navigation, resize observers, and dialog show/close. It does not prove native XUL/chrome geometry, remote content behavior, Sine hot reload in Zen, split-view positioning, cross-mod coexistence, or the user's original session.

No native Zen process was started for this candidate. No everyday profile was changed. Repository publication is a separate delivery step authorized by the fork owner; it does not establish installation, activation, or acceptance. The checklist in README.md remains unverified until exercised in native Zen.
