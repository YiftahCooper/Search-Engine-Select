# Search Engine Select

Version **1.3.0**, maintained in [YiftahCooper/Search-Engine-Select](https://github.com/YiftahCooper/Search-Engine-Select). Switch search engines from a floating selector on a search-results page. Manage the selector in **Sine > Search Engine Select > Configure**.

This MIT-licensed fork is based on [Vertex-Mods/Search-Engine-Select](https://github.com/Vertex-Mods/Search-Engine-Select) version 1.1.32, commit `b58353d29d9cca5c431e3b3989a74f07eb4953ce`, by Bibek Bhusal. Original source is retained in Git history; provenance is in `UPSTREAM.json`.

## New in 1.3.0

- Seven optional presets: **Google Images, YouTube, Google Maps, Google Scholar, Reddit, Reddit via Google, and PDFs via Google**. Choose one under **Add from presets**, then **Add preset**. Existing engines and choices stay as they are; presets are not automatically added. Added presets can be edited, reordered, or removed like other custom engines.
- Per-engine icons: use the default, choose a built-in Picture, PDF document, Discussion, Map, Book, or Search icon, or paste a direct HTTPS image URL. Google Images and PDFs have distinct default symbols; Reddit via Google uses Reddit's icon. Names remain visible when multiple entries share an icon.
- Custom images have a preview, refresh, and reset control. The downloaded image is converted to a small PNG and stored with the engine's settings. It remains available offline and after ordinary mod updates. **Save engine** commits an edit; loading a preview alone does not. Refreshing never replaces the saved image until the edit is saved.
- **Ctrl-click**, **Command-click** on macOS, or **middle-click** an engine to open the search in a background tab. The new mod setting enables these gestures by default; turn it off to ignore them. A normal click continues to use the current tab. Alt-click retains the existing Glance behavior.
- Switching away from Reddit via Google or PDFs via Google removes that preset's `site:reddit.com` or `filetype:pdf` wrapper before sending the original search to the next engine.

## Install and configure

Use Sine's custom GitHub-repository installation with **https://github.com/YiftahCooper/Search-Engine-Select**, branch `main`. This JavaScript mod requires Sine's custom JavaScript support. Its `sine.allow-unsafe-js` setting applies globally to custom mods.

The fork retains the original mod ID and replaces the upstream mod. Do not enable both copies together. Runtime files are `theme.json`, `preferences.json`, `style.css`, and `search-engine-select-runtime.uc.js`.

All settings are in **Sine > Search Engine Select > Configure**, even when the floating selector is disabled. Drag an engine's dotted handle, or use **Move up / Move down**. Edit and remove apply to browser engines, including the default, and to custom engines. Removed browser engines appear under **Removed engines**, with **Restore**. Removing a custom engine deletes its selector entry. These operations do not change Zen's own search configuration.

Custom search URLs must use HTTPS and contain exactly one `{searchTerms}` placeholder in the path or query. For example: `https://example.com/search?q={searchTerms}`. Search terms are URL-encoded automatically. Names are displayed as text. A stale settings window cannot silently overwrite a newer change made in another window.

### Choosing an icon

Select **Edit** beside an engine, then choose:

| Choice | Behavior |
| --- | --- |
| Default — automatic | Uses the preset's symbol where available, otherwise the engine's automatic favicon. |
| Built-in symbol | Uses the selected local Picture, PDF, Discussion, Map, Book, or Search symbol. |
| Custom image URL | Paste a direct HTTPS image link, load the preview, then save the engine. The image is cached in the settings. |

Custom images may be PNG, JPEG, WebP, GIF, ICO, or SVG, up to 256 KB and 4096 pixels per dimension. They are reduced to a static 32×32 PNG; animation is not retained. Loading has an eight-second timeout. **Refresh icon** downloads the same URL again, and **Reset to default** removes the override when the engine is saved. A failed refresh preserves the previously saved image. Combined engine settings are limited to 512 KiB.

Custom-image downloads omit credentials and referrers. The configured image server receives a request when an image is loaded or refreshed; using a saved custom image makes no further image-server request. Image URLs and cached PNGs are stored locally in the engine preference. Avoid putting private access tokens in image URLs.

Automatic icons for custom or edited engines try only their configured origin's `/favicon.ico`, then a local generic search icon. Reddit via Google uses Reddit's origin for its default icon. There is no discovery of HTML icon links. Unedited browser engines first try their supplied icon, then their origin's favicon, then the existing Google favicon service for public-looking hostnames, then the local generic icon. That service receives only the hostname; recognized local/reserved names and IP literals are excluded. This check does not resolve DNS. Automatic icon requests carry no referrer or search terms.

## Settings and updates

Settings are stored in Zen preferences under `extension.search-engine-select.*`; engine configuration, order, overrides, and cached custom images are in `extension.search-engine-select.engines`. Ordinary mod updates preserve these preferences.

Version 1 and 2 engine settings are read without changing the stored value. The first successful edit saves version 3, retaining existing entries, order, removals, and overrides while adding icon support. Older editors do not support version 3; downgrading requires a compatible settings backup. Invalid stored data is preserved and blocked rather than silently replaced. The existing recovery control backs up malformed data to a preference before resetting it.

There is no settings export/import feature in this release.

## Detection and lifecycle

The selector matches installed or explicitly configured GET search URLs by origin, path, term field, and fixed mode parameters. Reordered and extra parameters are allowed. Native attribution parameters such as `t`, `client`, and `source` are not required; user-configured fixed values remain constraints. Specific configured modes take precedence over a general engine on the same endpoint. Ordinary websites do not become engines merely because they have a `q` or `search` parameter. Navigating away closes the selector and clears its query.

POST search submissions are unsupported. A service that redirects to a different origin or search path may require its final search URL to be configured explicitly. Google Maps uses the documented Maps search URL; subsequent application navigation can change that URL and hide the selector.

One controller owns the selector in each browser window. Reload and unload clean up its controls, observers, and callbacks. Orphan roots from older versions are reclaimed by exact mod ID. Historical anonymous callbacks from upstream cannot be unregistered; restarting the browser clears those callbacks. The runtime entry URL introduced in 1.2.1 remains unchanged.

## Verification status

Version 1.3.0 passes **62 automated tests** covering engine configuration and migration, presets, filtered searches, new-tab gestures, icon download limits and deadlines, cached images, canceled and stale edits, refresh/save races, keyboard use, reordering, detection, and lifecycle cleanup. The generated runtime is checked against the source. An independent review verified the refresh/save race fix.

An isolated native Zen test was attempted with a disposable profile, but Zen exited with a Windows access violation during startup, before SES loaded, including with software rendering. Native image decoding, current Zen/Sine rendering, and live external-service redirects are therefore not verified for this release. Automated tests are not proof of everyday-profile acceptance. Development tests and diagnostic reports are retained separately from this installable repository.
