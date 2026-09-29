# Search Engine Select

Version **1.1.33**, maintained in [YiftahCooper/Search-Engine-Select](https://github.com/YiftahCooper/Search-Engine-Select). This fork adds engine management and repairs duplicate-control lifecycle issues in [Vertex-Mods/Search-Engine-Select](https://github.com/Vertex-Mods/Search-Engine-Select), based on version 1.1.32 at commit `b58353d29d9cca5c431e3b3989a74f07eb4953ce`. Original author: Bibek Bhusal. Original license: MIT. The original source remains available in Git history; provenance is in `UPSTREAM.json`.

## What changed

- One controller owns the floating selector in each browser window. Repeated initialization, script reload, and an enable/disable race cannot leave multiple controls or listener sets behind.
- Disable/unload removes controls, observers, pending timers, and startup callbacks. Late asynchronous work cannot recreate or overwrite a newer control.
- The selector menu now includes **Manage engines…**. Uncheck a browser engine to remove it from this selector, or check it to restore it. Zen's own search-engine configuration is unaffected.
- Add a custom engine with a name and an HTTPS search URL, such as `https://example.com/search?q={searchTerms}`. The URL must contain exactly one `{searchTerms}` placeholder in the path or query. Custom engines have a Remove button.
- Custom searches encode Hebrew and reserved URL characters correctly. Changes refresh the selector. A stale settings window cannot silently overwrite changes made in another window.
- Keyboard users can open the selector, activate engine buttons, and close the engine list with Escape. The manager uses a native HTML dialog.

## Install through Sine

Use Sine's custom GitHub-repository installation with this repository link:

**https://github.com/YiftahCooper/Search-Engine-Select**

Choose the `main` branch if Sine asks. This mod includes JavaScript; Sine must already be configured to permit custom JavaScript mods for it to run. Sine's `sine.allow-unsafe-js` setting is global to custom mods, not permission for just this repository.

The runtime files are `theme.json`, `preferences.json`, `style.css`, and generated `search-engine-select.uc.js`. This fork retains the original mod ID and is intended to **replace** the upstream mod. Do not load both copies together. Restart Zen once after installation to clear any old upstream script/listeners still in memory.

Once running, open the floating selector, choose **Manage engines…**, and make changes there. Settings save immediately. **Done** closes the manager. Custom engine configuration is stored in `extension.search-engine-select.engines`. Invalid existing data is retained; the manager offers an explicit backup-and-reset action instead of overwriting it silently.

For a first check, search in DuckDuckGo, confirm one floating selector appears, then use Manage engines to hide/restore an engine and add a custom one. The source has automated coverage, but native Zen/Sine UI behavior has not yet been verified. See `VERIFICATION.md` for exact evidence boundaries.

## Development and verification

Edit `src/switcher.js`, `src/engines.js`, or `src/manager.js`, then run:

```powershell
npm run build
npm test
npm run check
node --check search-engine-select.uc.js
```

Dependencies are pinned in `package-lock.json`; development tests use jsdom. See `VERIFICATION.md` for coverage and proof limits.

Install development dependencies with `npm ci --ignore-scripts`. `node_modules`, npm cache, local upstream snapshots, and publication receipts are excluded from the published source.

## Deliberately unchanged

The report of the selector appearing on unrelated websites remains deferred, as requested. Existing upstream search-page detection and click-destination rules remain in place. This work does not add support for engines that require POST submissions.

## Review checklist in an authorized disposable Zen profile

- [ ] One control after startup, repeated enable/disable, Sine reload, and a new window.
- [ ] DuckDuckGo and Google searches switch with the same query, including Hebrew.
- [ ] Hide/restore a browser engine without changing Zen's native engine list.
- [ ] Add, use, and remove a custom HTTPS engine.
- [ ] Manager is visible, readable, and keyboard accessible; Escape and Done restore focus.
- [ ] Dragged position, size, theme, split views, and existing click routing still work.
- [ ] Disabling/unloading removes all UI; no stale control returns after navigation.

Unchecked items are not proven by the Node test suite.
