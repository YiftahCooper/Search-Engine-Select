# Search Engine Select

Version **1.3.3**, maintained in [YiftahCooper/Search-Engine-Select](https://github.com/YiftahCooper/Search-Engine-Select). Switch search engines from a floating selector on a search-results page. Manage the selector in **Sine > Search Engine Select > Configure**.

This MIT-licensed fork is based on [Vertex-Mods/Search-Engine-Select](https://github.com/Vertex-Mods/Search-Engine-Select) version 1.1.32, commit `b58353d29d9cca5c431e3b3989a74f07eb4953ce`, by Bibek Bhusal. Original source is retained in Git history; provenance is in `UPSTREAM.json`.

## New in 1.3.3

Custom-image downloads reject redirects, preserving the direct-HTTPS-image contract. A failed load or refresh retains the saved cached image. Existing engine configuration and cached icons remain unchanged.

## New in 1.3.2

- Saving an engine edit after reordering or toggling another entry in the same Configure window now retains both changes. A truly stale window still cannot overwrite external changes.
- Multiline searches remain recognized and retain all search text when switching engines.
- Google Images remains recognized after Google's redirect from `udm=2` to `tbm=isch`; this alias is removed if its search URL is edited.


- **One engine list.** Google Images, YouTube, Google Maps, Google Scholar, Reddit, Reddit via Google, and PDFs via Google appear as ordinary entries alongside browser engines. There is no separate preset picker. Uncheck an engine to hide it from the selector while keeping its editable row, or remove it. Removed default/browser engines can be restored from **Removed engines**.
- **Distinct, bundled default icons.** All seven additions have local service-specific artwork. Google Images has an image badge, Reddit via Google has a Google badge, and PDFs via Google has a red PDF document with a Google badge. Default icons require no image-server request and work offline. Existing user-selected icons remain intact; use **Reset to default**, then save, to return an edited entry to its default artwork.
- Per-engine icons still offer default, a built-in symbol, or a direct HTTPS image URL.
- Custom images have a preview, refresh, and reset control. The downloaded image is converted to a small PNG and stored with the engine's settings. It remains available offline and after ordinary mod updates. **Save engine** commits an edit; loading a preview alone does not. Refreshing never replaces the saved image until the edit is saved.
- **Ctrl-click**, **Command-click** on macOS, or **middle-click** an engine to open the search in a background tab. The new mod setting enables these gestures by default; turn it off to ignore them. A normal click continues to use the current tab. Alt-click retains the existing Glance behavior.
- Switching away from Reddit via Google or PDFs via Google removes that preset's `site:reddit.com` or `filetype:pdf` wrapper before sending the original search to the next engine.

## Install and configure

Use Sine's custom GitHub-repository installation with **https://github.com/YiftahCooper/Search-Engine-Select**, branch `main`. This JavaScript mod requires Sine's custom JavaScript support. Its `sine.allow-unsafe-js` setting applies globally to custom mods.

The fork retains the original mod ID and replaces the upstream mod. Do not enable both copies together. Runtime files are `theme.json`, `preferences.json`, `style.css`, and `search-engine-select-runtime.uc.js`.

All settings are in **Sine > Search Engine Select > Configure**, even when the floating selector is disabled. Drag an engine's dotted handle, or use **Move up / Move down**. Edit and remove apply to browser engines, including the default, and to custom engines. Removed browser and default engines appear under **Removed engines**, with **Restore**. Removing a user-added custom engine deletes its selector entry. These operations do not change Zen's own search configuration.

Custom search URLs must use HTTPS and contain exactly one `{searchTerms}` placeholder in the path or query. For example: `https://example.com/search?q={searchTerms}`. Search terms are URL-encoded automatically. Names are displayed as text. A stale settings window cannot silently overwrite a newer change made in another window.

### Choosing an icon

Select **Edit** beside an engine, then choose:

| Choice | Behavior |
| --- | --- |
| Default — automatic | Uses the bundled service artwork for the default additions, otherwise the engine's automatic favicon. |
| Built-in symbol | Uses the selected local Picture, PDF, Discussion, Map, Book, or Search symbol. |
| Custom image URL | Paste a direct HTTPS image link, load the preview, then save the engine. The image is cached in the settings. |

Custom images may be PNG, JPEG, WebP, GIF, ICO, or SVG, up to 256 KB and 4096 pixels per dimension. They are reduced to a static 32×32 PNG; animation is not retained. Loading has an eight-second timeout. **Refresh icon** downloads the same URL again, and **Reset to default** removes the override when the engine is saved. A failed refresh preserves the previously saved image. Combined engine settings are limited to 512 KiB.

Custom-image downloads omit credentials and referrers and reject redirects. The configured image server receives a request when an image is loaded or refreshed; using a saved custom image makes no further image-server request. Image URLs and cached PNGs are stored locally in the engine preference. Avoid putting private access tokens in image URLs.

Default additions use bundled artwork. Other custom or edited engines try their configured origin's `/favicon.ico`, then a local generic search icon. There is no discovery of HTML icon links. Unedited browser engines first try their supplied icon, then their origin's favicon, then the existing Google favicon service for public-looking hostnames, then the local generic icon. That service receives only the hostname; recognized local/reserved names and IP literals are excluded. This check does not resolve DNS. Automatic icon requests carry no referrer or search terms.

## Settings and updates

Settings are stored in Zen preferences under `extension.search-engine-select.*`; engine configuration, order, overrides, and cached custom images are in `extension.search-engine-select.engines`. Ordinary mod updates preserve these preferences.

Version 1, 2, and 3 engine settings are read without changing the stored value. The first successful edit saves version 4, retaining existing entries, order, removals, and icon overrides while separating deselection from removal. Existing equivalent entries are not duplicated. Older editors do not support version 4; downgrading requires a compatible settings backup. Invalid stored data is preserved and blocked rather than silently replaced. The existing recovery control backs up malformed data to a preference before resetting it.

There is no settings export/import feature in this release.

## Detection and lifecycle

The selector matches installed or explicitly configured GET search URLs by origin, path, term field, and fixed mode parameters. Reordered and extra parameters are allowed. Native attribution parameters such as `t`, `client`, and `source` are not required; user-configured fixed values remain constraints. Specific configured modes take precedence over a general engine on the same endpoint. Ordinary websites do not become engines merely because they have a `q` or `search` parameter. Navigating away closes the selector and clears its query.

POST search submissions are unsupported. A service that redirects to a different origin or search path may require its final search URL to be configured explicitly. Google Maps uses the documented Maps search URL; subsequent application navigation can change that URL and hide the selector.

One controller owns the selector in each browser window. Reload and unload clean up its controls, observers, and callbacks. Orphan roots from older versions are reclaimed by exact mod ID. Historical anonymous callbacks from upstream cannot be unregistered; restarting the browser clears those callbacks. The runtime entry URL introduced in 1.2.1 remains unchanged.

## Verification status

Version 1.3.3 passes **75 automated tests**, generated-runtime equality and syntax checks. Additional modeled matrices covered 405 source/destination/query combinations and 28 settings lifecycle scenarios across schemas 1–4. Independent review checked current-window versus stale-window editing behavior.

A disposable Chromium run passed **17 production-runtime interaction/layout checks**: real drag ordering, Ctrl/middle/current-tab clicks, gesture disable, icon decoding and image caching/reset, normal-list changes, persistence, horizontal overflow, ordinary-page rejection and owner cleanup. Zen search/preferences services were simulated. These are browser-rendering/input results, not native Sine/Gecko proof.

Disposable headless Linux and Windows 11 Zen **1.23.2b / Gecko 157.0.1** with pinned real Sine verify native route recognition and rejection, trusted click gestures, exactly-one background tabs, query fidelity, bundled icon decoding, actual Configure list/draft behavior, owner cleanup and process-restart persistence. Native image decoding/rasterization tests use deterministic transport for redirects, malformed/oversized images, failure preservation and real eight-second header/body deadlines. The Windows native drag-service test also reordered an engine in actual Sine Configure using trusted Gecko dragstart/drop events. That service remains unavailable in the headless Linux backend; supplementary Chromium drag ordering is separately verified. Search navigation uses synthetic pages and does not prove live service availability. Controlled Windows normal-tab and Essential context searches preserved the same English DuckDuckGo request; this does not establish the behavior of ordinary-profile cookies or accounts. The everyday profile, desktop and personal account state were not accessed, and ordinary-profile acceptance remains separate.
