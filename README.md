# Search Engine Select

Version **1.2.0**, maintained in [YiftahCooper/Search-Engine-Select](https://github.com/YiftahCooper/Search-Engine-Select). This fork adds engine management and repairs duplicate-control lifecycle issues in [Vertex-Mods/Search-Engine-Select](https://github.com/Vertex-Mods/Search-Engine-Select), based on version 1.1.32 at commit `b58353d29d9cca5c431e3b3989a74f07eb4953ce`. Original author: Bibek Bhusal. Original license: MIT. The original source remains available in Git history; provenance is in `UPSTREAM.json`.

## What changed

- One controller owns the floating selector in each browser window. Repeated initialization, script reload, and an enable/disable race cannot leave multiple controls or listener sets behind.
- The owner also removes orphan selector roots left by older releases and late duplicate roots. Cleanup targets only this mod's exact root ID. Historical anonymous callbacks cannot be unregistered, but their additional roots are removed while the new owner is active.
- Disable/unload removes controls, observers, pending timers, and startup callbacks. Late asynchronous work cannot recreate or overwrite a newer control.
- All settings are in **Sine > Search Engine Select > Configure**: enable/disable, position memory, size, theme, debug mode, and the engine list. Drag an engine's dotted handle and drop above or below another row, or use **Move up / Move down** with the keyboard. **Edit** and **Remove** apply to browser engines (including the default) and custom engines. Removed browser engines leave the active list and move into the collapsed **Removed engines** section, which exposes **Restore** only. Reordering skips removed engines and preserves their restoration positions. Removal and edits affect this selector only; Zen's native search configuration is unaffected.
- Dragging shows an insertion line and saves only on a valid drop within this engine list. Escape, a canceled drag, and external text or files do not save a new order. An unfinished URL edit stays in the form; the existing stale-draft protection still applies if settings changed after the edit began.
- Edit any engine's name and HTTPS search URL, or add a custom engine with a URL such as `https://example.com/search?q={searchTerms}`. The URL must contain exactly one `{searchTerms}` placeholder in the path or query. **Cancel edit** discards an unfinished edit. Removing a custom engine deletes its selector entry.
- Custom searches encode Hebrew and reserved URL characters correctly. Changes refresh the selector. A stale settings window cannot silently overwrite changes made in another window.
- New custom engines and browser engines edited in Configure automatically request their configured origin's `/favicon.ico` in both the selected button and engine list. Unavailable icons fall back to the generic search icon. Engines sharing an icon, such as Google and Google Images, remain separate choices with their own visible names.
- Keyboard users can open the selector, activate engine buttons, and close the engine list with Escape. Engine management lives inside Sine's Configure dialog; the floating menu contains engine choices only.
- Long engine names wrap within the menu, and Configure uses compact spacing scoped to this mod's card. Its engine section follows Sine's own settings without adding another divider.

## Install through Sine

Use Sine's custom GitHub-repository installation with this repository link:

**https://github.com/YiftahCooper/Search-Engine-Select**

Choose the `main` branch if Sine asks. This mod includes JavaScript; Sine must already be configured to permit custom JavaScript mods for it to run. Sine's `sine.allow-unsafe-js` setting is global to custom mods, not permission for just this repository.

The runtime files are `theme.json`, `preferences.json`, `style.css`, and generated `search-engine-select.uc.js`. This fork retains the original mod ID and is intended to **replace** the upstream mod. Do not load both copies together. The fork registers an unload handler for Sine updates and reclaims leftover selector roots while active. It cannot unregister callbacks from an older script that never exposed cleanup.

Open **Sine > Search Engine Select > Configure** to manage engines alongside the other settings. No search-results page is needed, and the settings remain available when the floating selector is turned off. Changes save immediately and refresh active selector windows. Close Sine's dialog when finished. Custom configuration uses `extension.search-engine-select.engines`; invalid data is preserved until you explicitly back it up and reset it.

Version 1 settings (`hidden` and `custom`) are read without changing the stored preference. The first successful edit saves version 2, adding `order` and native-engine `overrides` while retaining existing entries. Stale edits are rejected, including drafts kept open during a refresh. Native engines removed from this selector remain available for recognizing the current search page. Version 2 is not compatible with an older release's settings editor; back up this preference before downgrading.

For a first check, search in DuckDuckGo, confirm one floating selector appears, then use Configure to hide/restore an engine and add a custom one. The source has automated coverage, but native Zen/Sine UI behavior still needs testing.

## Supported behavior and limitations

Search-page detection and click destinations follow the upstream implementation. Engines requiring POST submissions are not supported.

Custom and edited engines request only `/favicon.ico` at the configured URL's origin, then use the generic search icon if loading fails. These icon requests contain no search path, query parameters, fragment, or search terms, and send no referrer. This makes a network request to that origin (including private or local origins you configure); it does not send custom or edited engine hosts to a third-party favicon service. There is no HTML scraping or discovery of `rel="icon"` links, so sites that publish icons only at other paths use the generic fallback.

Unedited browser engines retain their supplied icon first. If absent or unavailable, they try the search origin's `/favicon.ico`, then the existing Google favicon service for public-looking DNS names, then the generic icon. The Google request contains only the hostname; IP literals, single-label hosts and recognized local/reserved suffixes are excluded. This hostname check does not resolve DNS and cannot identify every privately routed domain. Supplied browser icon URLs are used as provided, with no referrer. Each candidate is attempted at most once per rendered image, and the terminal generic icon has no error retry handler. A later UI rebuild may try the icon again. Icon delivery and appearance still require native Zen testing.

## Testing status

The source and generated package pass automated configuration, lifecycle, icon-fallback and simulated UI checks. Native Zen/Sine drag behavior, popup geometry, cross-mod interaction and actual remote icon availability still need testing.
