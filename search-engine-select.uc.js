// Generated from src/switcher.js. Run node build.mjs to rebuild.
// ==UserScript==
// @name            Search Engine Select
// @description     Adds a floating UI to switch search engines on a search results page.
// @author          Bibek Bhusal
// @version         1.1.34
// @lastUpdated     2026-09-29
// @ignorecache
// @homepage        https://github.com/YiftahCooper/Search-Engine-Select
// ==/UserScript==

// Local source based on Vertex-Mods/Search-Engine-Select v1.1.32.
// Build the installable script with node build.mjs.

(() => {
  // Re-evaluation must release the old owner before registering new callbacks.
  const ownerKey = '__searchEngineSelect';
  window[ownerKey]?.unload();

  // utils/favicon.js
  function googleFaviconAPI(domainOrUrl, size = 32) {
    let domain;
    try {
      domain = new URL(domainOrUrl).hostname;
    } catch {
      domain = domainOrUrl;
    }
    return `https://s2.googleusercontent.com/s2/favicons?domain_url=https://${domain}&sz=${size}`;
  }
  function getSearchEngineFavicon(engine) {
    if (engine?.iconURI?.spec)
      return engine.iconURI.spec;
    try {
      let submissionUrl = engine.getSubmission("test_query")?.uri.spec;
      if (submissionUrl)
        return googleFaviconAPI(submissionUrl);
    } catch {
      return "chrome://browser/skin/search-glass.svg";
    }
    return "chrome://browser/skin/search-glass.svg";
  }

  // utils/startup-finish.js
  function startupFinish(callback) {
    if (document.readyState === "complete")
      callback();
    else
      window.addEventListener("load", callback, { once: !0 });
  }

  // utils/parse.js
  var parseElement = (elementString, type = "html") => {
    if (type === "xul")
      return window.MozXULElement.parseXULToFragment(elementString).firstChild;
    let element = new DOMParser().parseFromString(elementString, "text/html");
    if (element.body.children.length)
      element = element.body.firstChild;
    else
      element = element.head.firstChild;
    return element;
  }, escapeXmlAttribute = (str) => {
    if (typeof str !== "string")
      return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  };

  // utils/pref.js
  function setPref(key, value) {
    try {
      let prefService = Services.prefs;
      if (typeof value === "boolean")
        prefService.setBoolPref(key, value);
      else if (typeof value === "number")
        prefService.setIntPref(key, value);
      else
        prefService.setStringPref(key, value);
    } catch {}
  }
  var getPref = (key, defaultValue) => {
    try {
      let prefService = Services.prefs, type = prefService.getPrefType(key);
      if (type === prefService.PREF_STRING)
        return prefService.getStringPref(key);
      else if (type === prefService.PREF_INT)
        return prefService.getIntPref(key);
      else if (type === prefService.PREF_BOOL)
        return prefService.getBoolPref(key);
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }, setPrefIfUnset = (key, value) => {
    if (Services.prefs.getPrefType(key) === 0)
      setPref(key, value);
  };
  function addPrefListener(name, callback) {
    let modified_callback = () => {
      callback({ value: getPref(name) });
    };
    Services.prefs.addObserver(name, modified_callback);
    return () => Services.prefs.removeObserver(name, modified_callback);
  }
  class PREFS {
    static MOD_NAME = "BasePrefs";
    static DEBUG_MODE = "";
    static defaultValues = {};
    static getPref(key, defaultValue = void 0) {
      let defaultVal = defaultValue !== void 0 ? defaultValue : this.defaultValues[key];
      return getPref(key, defaultVal);
    }
    static setPref(prefKey, value) {
      setPref(prefKey, value);
    }
    static setInitialPrefs() {
      for (let [key, value] of Object.entries(this.defaultValues))
        setPrefIfUnset(key, value);
    }
    static get debugMode() {
      if (!this.DEBUG_MODE)
        return !1;
      return this.getPref(this.DEBUG_MODE);
    }
    static set debugMode(value) {
      if (!this.DEBUG_MODE)
        return;
      this.setPref(this.DEBUG_MODE, value);
    }
    static debugLog(...args) {
      if (this.debugMode)
        console.log(`${this.MOD_NAME}:`, ...args);
    }
    static debugError(...args) {
      if (this.debugMode)
        console.error(`${this.MOD_NAME}:`, ...args);
    }
  }

  // search-engine-select/utils/prefs.js
  class SearchEngineSelectPREFS extends PREFS {
    static MOD_NAME = "SearchEngineSelect";
    static DEBUG_MODE = "extension.search-engine-select.debug-mode";
    static ENABLED = "extension.search-engine-select.enabled";
    static REMEMBER_POSITION = "extension.search-engine-select.remember-position";
    static Y_COOR = "extension.search-engine-select.y-coor";
    static defaultValues = {
      [SearchEngineSelectPREFS.DEBUG_MODE]: !1,
      [SearchEngineSelectPREFS.ENABLED]: !0,
      [SearchEngineSelectPREFS.REMEMBER_POSITION]: !0,
      [SearchEngineSelectPREFS.Y_COOR]: "60%"
    };
    static get enabled() {
      return this.getPref(this.ENABLED);
    }
    static set enabled(value) {
      this.setPref(this.ENABLED, value);
    }
    static get rememberPosition() {
      return this.getPref(this.REMEMBER_POSITION);
    }
    static set rememberPosition(value) {
      this.setPref(this.REMEMBER_POSITION, value);
    }
    static get yCoor() {
      return this.getPref(this.Y_COOR);
    }
    static set yCoor(value) {
      this.setPref(this.Y_COOR, value);
    }
  }
  var PREFS2 = SearchEngineSelectPREFS;

  // Selector-only configuration. Never writes to the browser search service.
const ENGINE_SETTINGS_PREF = 'extension.search-engine-select.engines';
const emptyEngineSettings = () => ({ version: 1, hidden: [], custom: [] });
function engineKey(engine) {
  return engine ? (engine.sesId || `native:${engine.id || engine.name}`) : null;
}
function validateCustomEngine(value) {
  const name = typeof value?.name === 'string' ? value.name.trim() : '';
  const template = typeof value?.url === 'string' ? value.url.trim() : '';
  if (!name || name.length > 80) throw new Error('Enter an engine name of 1–80 characters.');
  if (template.length > 2048 || template.split('{searchTerms}').length !== 2) throw new Error('The search URL must contain {searchTerms} exactly once.');
  let url;
  try { url = new URL(template.replace('{searchTerms}', 'SES_QUERY_MARKER')); }
  catch { throw new Error('Enter a valid HTTPS search URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname || !/^https:\/\//i.test(template)) throw new Error('Use an HTTPS URL without a username or password.');
  if (url.host.includes('ses_query_marker') || url.hash.includes('SES_QUERY_MARKER') || !(url.pathname + url.search).includes('SES_QUERY_MARKER')) throw new Error('Place {searchTerms} in the URL path or query, not the host or fragment.');
  return { id: value.id, name, url: template };
}
function readEngineSettings() {
  const raw = Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '');
  if (!raw) return { raw, settings: emptyEngineSettings(), error: '' };
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Array.isArray(value.hidden) || !Array.isArray(value.custom) || value.hidden.length > 200 || value.custom.length > 100 || value.hidden.some(id => typeof id !== 'string')) throw new Error();
    const ids = new Set(), names = new Set();
    const custom = value.custom.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !/^custom-[a-zA-Z0-9-]+$/.test(engine.id) || ids.has(engine.id) || names.has(engine.name.toLowerCase())) throw new Error();
      ids.add(engine.id); names.add(engine.name.toLowerCase()); return engine;
    });
    return { raw, settings: { version: 1, hidden: [...new Set(value.hidden)], custom }, error: '' };
  } catch {
    return { raw, settings: emptyEngineSettings(), error: 'Saved engine settings are invalid. They have been preserved. Reset them below to edit the list.' };
  }
}
function saveEngineSettings(settings, expectedRaw) {
  if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== expectedRaw) throw new Error('Engine settings changed in another window. Close and reopen Configure.');
  Services.prefs.setStringPref(ENGINE_SETTINGS_PREF, JSON.stringify(settings));
}
async function allSearchEngines() {
  const installed = await getVisibleEngines();
  const custom = readEngineSettings().settings.custom.map(item => ({
    name: item.name, sesId: item.id,
    iconURI: { spec: 'chrome://browser/skin/search-glass.svg' },
    getSubmission(term) { return { uri: { spec: item.url.replace('{searchTerms}', encodeURIComponent(term)) }, postData: null }; }
  }));
  return [...installed, ...custom];
}

  function createEngineSettings(container) {
  const element = (tag, text) => {
    const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const dialog = element('section'); dialog.id = 'ses-engine-manager';
  dialog.setAttribute('aria-labelledby', 'ses-manager-heading');
  const heading = element('h2', 'Search engines'); heading.id = 'ses-manager-heading';
  const intro = element('p', 'Choose engines for this selector. These choices do not change Zen’s search settings.');
  const error = element('p'); error.dataset.sesError = ''; error.setAttribute('role', 'alert');
  const list = element('div'); list.className = 'ses-manager-list';
  const form = element('form'); form.noValidate = true;
  const nameLabel = element('label', 'Engine name');
  const name = element('input'); name.name = 'ses-name'; name.maxLength = 80; nameLabel.append(name);
  const urlLabel = element('label', 'Search URL — use {searchTerms} for the query');
  const url = element('input'); url.name = 'ses-url'; url.type = 'url'; url.maxLength = 2048; url.placeholder = 'https://example.com/search?q={searchTerms}'; urlLabel.append(url);
  const add = element('button', 'Add engine'); add.type = 'submit'; add.dataset.sesAction = 'add';
  form.append(nameLabel, urlLabel, add);
  const reset = element('button', 'Back up and reset invalid settings'); reset.type = 'button'; reset.hidden = true;
  let revision = 0, rendered;
  async function render() {
    const currentRevision = ++revision;
    const state = readEngineSettings();
    let engines;
    try { engines = await getVisibleEngines(); }
    catch { if (dialog.isConnected) error.textContent = 'Could not load Zen’s search engines. Close and try again.'; return; }
    if (!dialog.isConnected || currentRevision !== revision) return;
    rendered = state;
    error.textContent = state.error; reset.hidden = !state.error;
    add.disabled = !!state.error;
    list.replaceChildren();
    const { settings } = state;
    const mutate = change => {
      try {
        const next = JSON.parse(JSON.stringify(settings)); change(next);
        saveEngineSettings(next, state.raw); render();
      } catch (problem) { error.textContent = problem.message; }
    };
    for (const engine of engines) {
      const row = element('label'); row.className = 'ses-manager-row';
      const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.disabled = !!state.error;
      const key = engineKey(engine); checkbox.checked = !settings.hidden.includes(key);
      checkbox.addEventListener('change', () => mutate(next => {
        next.hidden = next.hidden.filter(id => id !== key);
        if (!checkbox.checked) next.hidden.push(key);
      }));
      row.append(checkbox, element('span', engine.name)); list.append(row);
    }
    for (const engine of settings.custom) {
      const row = element('div'); row.className = 'ses-manager-row';
      const remove = element('button', 'Remove'); remove.type = 'button'; remove.dataset.sesAction = 'remove-custom';
      remove.setAttribute('aria-label', `Remove ${engine.name}`);
      remove.addEventListener('click', () => mutate(next => { next.custom = next.custom.filter(item => item.id !== engine.id); next.hidden = next.hidden.filter(id => id !== engine.id); }));
      row.append(element('span', engine.name), remove); list.append(row);
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      if (!rendered || rendered.error) throw new Error('Reset the invalid settings before adding engines.');
      if (rendered.settings.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      const engine = validateCustomEngine({ id: `custom-${crypto.randomUUID()}`, name: name.value, url: url.value });
      if (rendered.settings.custom.some(item => item.name.toLowerCase() === engine.name.toLowerCase())) throw new Error('A custom engine with that name already exists.');
      const next = { ...rendered.settings, custom: [...rendered.settings.custom, engine] };
      saveEngineSettings(next, rendered.raw); name.value = ''; url.value = ''; render();
    } catch (problem) { error.textContent = problem.message; }
  });
  reset.addEventListener('click', () => {
    if (!rendered?.error) return;
    try {
      if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== rendered.raw) throw new Error('Settings changed in another window. Close and reopen Configure.');
      Services.prefs.setStringPref(`${ENGINE_SETTINGS_PREF}-backup`, rendered.raw);
      saveEngineSettings(emptyEngineSettings(), rendered.raw); render();
    } catch (problem) { error.textContent = problem.message; }
  });
  dialog.append(heading, intro, list, error, form, reset);
  container.append(dialog); render();
  return {element:dialog,refresh:render,reset(){name.value='';url.value='';render();},destroy(){++revision;dialog.remove();}};
}

  // Mount dynamic engine controls in Sine's existing Configure dialog.
function mountSineSettings() {
  let controls, container, dialog, configureButton, disposed = false;
  const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'link');
  style.rel = 'stylesheet'; style.href = 'chrome://sine/content/search-engine-select/style.css';
  document.documentElement.append(style);
  const reset = () => controls?.reset();
  function unmount() {
    dialog?.removeEventListener('close', reset);
    configureButton?.removeEventListener('click', reset);
    controls?.destroy(); controls = container = dialog = configureButton = null;
  }
  function mount() {
    if (disposed) return;
    const next = document.querySelector('[mod-id="search-engine-select"] .sineItemPreferenceDialogContent');
    if (next === container && controls?.element.isConnected) return;
    unmount(); if (!next) return;
    container = next; controls = createEngineSettings(container);
    dialog = container.closest('dialog'); dialog?.addEventListener('close', reset);
    configureButton = container.closest('[mod-id]')?.querySelector('.sineItemConfigureButton');
    configureButton?.addEventListener('click', reset);
    if (new URL(window.location.href).searchParams.get('searchEngineSelectSettings') === '1' && !document.documentElement.hasAttribute('data-ses-settings-shown')) {
      document.documentElement.setAttribute('data-ses-settings-shown', '');
      configureButton?.click();
    }
  }
  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, {childList: true, subtree: true});
  const engineObserver = {observe() { controls?.refresh(); }};
  Services.obs.addObserver(engineObserver, 'browser-search-engine-modified');
  mount();
  return {destroy() {
    if (disposed) return; disposed = true; observer.disconnect();
    Services.obs.removeObserver(engineObserver, 'browser-search-engine-modified');
    unmount(); style.remove();
  }};
}


  // utils/search-service.js
  var _searchService;
  async function getSearchService() {
    if (_searchService)
      return _searchService;
    let { SearchService } = ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs");
    return _searchService = SearchService, _searchService;
  }
  async function getVisibleEngines() {
    return (await getSearchService()).getVisibleEngines();
  }
  async function getEngineByName(name) {
    return (await getSearchService()).getEngineByName(name);
  }
  async function getDefaultEngine() {
    return (await getSearchService()).getDefault();
  }

  // utils/open-link.js
  async function openLink(url, where = "new tab") {
    if (!url)
      return !1;
    let destination = where?.toLowerCase()?.trim();
    switch (destination) {
      case "current tab":
        return openTrustedLinkIn(url, "current"), !0;
      case "new tab":
        return openTrustedLinkIn(url, "tab"), !0;
      case "background tab":
        return openTrustedLinkIn(url, "tab", { inBackground: !0, relatedToCurrent: !0 }), !0;
      case "new window":
        return openTrustedLinkIn(url, "window"), !0;
      case "incognito":
      case "private":
        return window.openTrustedLinkIn(url, "window", { private: !0 }), !0;
      case "glance": {
        let manager = window.gZenGlanceManager;
        if (manager?.openGlance)
          try {
            let tabboxRect = gBrowser.tabbox?.getBoundingClientRect(), clickPosition = window.gZenUIManager?._lastClickPosition ?? {
              clientX: tabboxRect ? tabboxRect.width / 2 : window.innerWidth / 2,
              clientY: tabboxRect ? tabboxRect.height / 2 : window.innerHeight / 2
            };
            return manager.openGlance({
              url,
              ...clickPosition,
              width: 0,
              height: 0,
              triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
            }), !0;
          } catch {
            break;
          }
        break;
      }
      case "vsplit":
      case "hsplit":
        if (window.gZenViewSplitter) {
          let sep = destination === "vsplit" ? "vsep" : "hsep", tab1 = gBrowser.selectedTab;
          await openTrustedLinkIn(url, "tab");
          let tab2 = gBrowser.selectedTab;
          return gZenViewSplitter.splitTabs([tab1, tab2], sep, 1), !0;
        }
        break;
      default:
        break;
    }
    return openTrustedLinkIn(url, "tab"), !1;
  }

  // search-engine-select/index.js
  var SearchEngineSwitcher = {
    _container: null,
    _engineSelect: null,
    _engineOptions: null,
    _dragHandle: null,
    _engineCache: [],
    _currentSearchInfo: null,
    _isDragging: !1,
    _startY: 0,
    _initialTop: 0,
    _boundListeners: {},
    _progressListener: null,
    _resizeObserver: null,
    _generation: 0,
    _initializing: null,
    _disposed: false,
    _timers: new Set(),
    _engineRevision: 0,
    init() {
      if (this._disposed || !PREFS2.enabled || this._container) return;
      if (this._initializing) return this._initializing;
      const generation = ++this._generation;
      const pending = (async () => {
        await this.buildEngineRegexCache(generation);
        if (generation !== this._generation || this._disposed || !PREFS2.enabled) return;
        this.createUI();
        this.attachEventListeners();
        this.updateSwitcherVisibility();
      })().catch(error => {
        if (generation === this._generation) this.destroy();
        PREFS2.debugError('Initialization failed', error);
      }).finally(() => {
        if (this._initializing === pending) this._initializing = null;
      });
      this._initializing = pending;
      return pending;
    },
    destroy() {
      ++this._generation;
      this._initializing = null;
      for (const timer of this._timers) clearTimeout(timer);
      this._timers.clear();
      this._isDragging = false;
      this._container?.remove(), this.removeEventListeners(), this._container = null, this._engineSelect = null, this._engineOptions = null, this._dragHandle = null, PREFS2.debugLog("Destroyed successfully.");
    },
    schedulePosition() {
      const timer = setTimeout(() => {
        this._timers.delete(timer);
        if (!this._disposed && this._container) this.updatePosition();
      }, 500);
      this._timers.add(timer);
    },
    async buildEngineRegexCache(generation = this._generation) {
      const revision = ++this._engineRevision;
      PREFS2.debugLog("Building engine regex cache..."), this._engineCache = [];
      let engines = await allSearchEngines(), PLACEHOLDER = "SEARCH_TERM_PLACEHOLDER_E6A8D";
      if (generation !== this._generation || revision !== this._engineRevision) return;
      for (let engine of engines)
        try {
          let submission = engine.getSubmission(PLACEHOLDER);
          if (!submission)
            continue;
          let regexString = submission.uri.spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), placeholderRegex = PLACEHOLDER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          regexString = regexString.replace(placeholderRegex, "([^&]*)"), this._engineCache.push({
            engine,
            regex: new RegExp(`^${regexString}`)
          });
        } catch (e) {
          PREFS2.debugError(`Failed to process engine ${engine.name}`, e);
        }
    },
    matchUrl(url) {
      if (!url)
        return null;
      for (let item of this._engineCache) {
        let match = url.match(item.regex);
        if (match && match[1])
          try {
            let term = decodeURIComponent(match[1].replace(/\+/g, " "));
            return PREFS2.debugLog(`Matched: Engine='${item.engine.name}', Term='${term}'`), { engine: item.engine, term };
          } catch {
            continue;
          }
      }
      return this.matchGenericSearchUrl(url);
    },
    matchGenericSearchUrl(url) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      let term = null, searchParams = ["q", "query", "search", "text", "p", "wd"];
      for (let key of searchParams) {
        let value = parsed.searchParams.get(key);
        if (value && value.trim()) {
          term = value.trim();
          break;
        }
      }
      if (!term)
        return null;
      let host = parsed.hostname.toLowerCase().replace(/[^a-z0-9]/g, ""), engine = null;
      for (let { engine: candidate } of this._engineCache) {
        let nameKey = candidate.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (nameKey && host.includes(nameKey)) {
          engine = candidate;
          break;
        }
      }
      return PREFS2.debugLog(`Generic match: Engine='${engine?.name ?? "unknown"}', Term='${term}'`), { engine, term, host: parsed.hostname };
    },
    updateSwitcherVisibility() {
      let url = gBrowser.selectedBrowser.currentURI.spec, newSearchInfo = this.matchUrl(url);
      if (newSearchInfo)
        this._currentSearchInfo = newSearchInfo, this._show();
    },
    _show() {
      if (!this._container)
        return;
      this._container.style.display = "flex", this.updateSelectedEngineDisplay(), this.handleSplitOrGlance();
    },
    _hide() {
      if (!this._container)
        return;
      if (this._container.style.display = "none", this._engineOptions)
        this._engineOptions.style.display = "none", this._container.classList.remove("options-visible");
    },
    updateSelectedEngineDisplay() {
      if (!this._currentSearchInfo || !this._engineSelect)
        return;
      let { engine, host } = this._currentSearchInfo, img = parseElement("<img>");
      img.alt = '';
      img.src = engine ? getSearchEngineFavicon(engine) : "chrome://browser/skin/zen-icons/search-glass.svg";
      let label = engine ? engine.name : host || "Unknown search", nameSpan = parseElement(`<span>${escapeXmlAttribute(label)}</span>`);
      this._engineSelect.replaceChildren(img, nameSpan);
      this._engineSelect.setAttribute('aria-label', `Search engine: ${label}. Choose another engine`);
    },
    handleEnabledChange(pref) {
      if (pref.value)
        this.init();
      else
        this.destroy();
    },
    handleTabSelect() {
      if (this._hide(), this.updateSwitcherVisibility(), this.handleSplitOrGlance(), this.observeSelectedBrowser(), gBrowser.selectedTab?.hasAttribute("zen-glance-tab"))
        this.schedulePosition();
    },
    onLocationChange(browser) {
      if (browser === gBrowser.selectedBrowser)
        this.updateSwitcherVisibility();
    },
    handleSplitOrGlance() {
      if (!this._container)
        return;
      let isVerticalSplit = window.gZenViewSplitter?.currentView >= 0 && window.gZenViewSplitter._data[window.gZenViewSplitter.currentView]?.gridType === "vsep", isGlance = gBrowser.selectedTab?.hasAttribute("zen-glance-tab");
      if (!isVerticalSplit && !isGlance) {
        this._container.style.removeProperty("--ses-pane-x"), this._container.style.removeProperty("--ses-pane-width"), this._container.classList.remove("in-split-view");
        return;
      }
      this._container.classList.add("in-split-view"), this.updatePosition();
    },
    observeSelectedBrowser() {
      try {
        this._resizeObserver?.disconnect();
      } catch {}
      let browser = typeof gBrowser < "u" ? gBrowser.selectedBrowser : null;
      if (!browser || !this._resizeObserver)
        return;
      try {
        this._resizeObserver.observe(browser);
      } catch (e) {
        PREFS2.debugError("Failed to observe selected browser for repositioning.", e);
      }
    },
    updatePosition() {
      let activeBrowser = gBrowser.selectedBrowser;
      if (!this._container) return;
      if (!activeBrowser || !this._container || !this._container.classList.contains("in-split-view")) {
        this._container.style.removeProperty("--ses-pane-x"), this._container.style.removeProperty("--ses-pane-width");
        return;
      }
      let rect = activeBrowser.getBoundingClientRect();
      if (!rect.width)
        return;
      this._container.style.setProperty("--ses-pane-x", `${rect.x}px`), this._container.style.setProperty("--ses-pane-width", `${rect.width}px`);
    },
    async handleURLBarKey(event) {
      if (event.key !== "Enter")
        return;
      const generation = this._generation;
      let engine, term = gURLBar.value.trim();
      if (!term)
        return;
      try {
        let engineName = document.getElementById("urlbar-search-mode-indicator-title").innerText.trim();
        engine = await getEngineByName(engineName);
      } catch {
        PREFS2.debugLog("Search indicator not found. Using default engine."), engine = await getDefaultEngine();
      }
      if (generation !== this._generation || this._disposed || !this._container) return;
      if (engine && term)
        PREFS2.debugLog(`URL bar search detected. Engine: ${engine.name}, Term: ${term}`), this._currentSearchInfo = { engine, term }, this._show();
    },
    async handleEngineClick(event, newEngine) {
      const generation = this._generation;
      if (event.preventDefault(), event.stopPropagation(), engineKey(newEngine) === engineKey(this._currentSearchInfo?.engine)) {
        this.hideOptionsOnClickOutside();
        return;
      }
      if (!this._currentSearchInfo?.term)
        return;
      let term = this._currentSearchInfo.term, submission = newEngine.getSubmission(term), newUrl = submission?.uri?.spec, where = null;
      if (!newUrl) return;
      if (event.button === 0 && event.ctrlKey && !event.altKey && !event.shiftKey)
        where = "vsplit";
      else if (event.button === 0 && event.altKey)
        where = "glance";
      else if (event.button === 1)
        where = "background tab";
      else if (event.button === 0)
        where = "current tab";
      if (!where) {
        this._engineOptions.style.display = "none", this._container.classList.remove("options-visible");
        return;
      }
      const opened = await openLink(newUrl, where);
      if (generation !== this._generation || !this._container) return;
      if (opened)
        this.updateSelectedEngineDisplay();
      this.hideOptionsOnClickOutside();
    },
    toggleOptions(event) {
      if (event.stopPropagation(), this._engineOptions.style.display !== "block") {
        let containerRect = this._container.getBoundingClientRect();
        this._engineOptions.classList.toggle("popup-below", containerRect.top < 220), this._engineOptions.classList.toggle("popup-above", containerRect.top >= 220), this._engineOptions.style.display = "block", this._container.classList.add("options-visible");
      } else
        this._engineOptions.style.display = "none", this._container.classList.remove("options-visible");
      this._engineSelect.setAttribute('aria-expanded', String(this._engineOptions.style.display === 'block'));
    },
    hideOptionsOnClickOutside() {
      if (!this._engineOptions || !this._container) return;
      this._engineOptions.style.display = "none", this._container.classList.remove("options-visible");
      this._engineSelect?.setAttribute('aria-expanded', 'false');
    },
    async refreshEngines() {
      if (!this._container || this._disposed) return;
      const generation = this._generation;
      try {
        await this.buildEngineRegexCache(generation);
        if (generation !== this._generation || !this._container) return;
        await this.populateEngineList();
        this.updateSwitcherVisibility();
      } catch (error) { PREFS2.debugError('Engine refresh failed', error); }
    },
    createUI() {
      let container = parseElement(`
      <div id="search-engine-switcher-container" style="top: ${PREFS2.yCoor};">
        <button type="button" id="ses-engine-select" aria-expanded="false" aria-controls="ses-engine-options" aria-label="Choose a search engine"></button>
        <div id="ses-drag-handle"></div>
        <div id="ses-engine-options"></div>
      </div>
    `);
      this._container = container, this._engineSelect = container.querySelector("#ses-engine-select"), this._dragHandle = container.querySelector("#ses-drag-handle"), this._engineOptions = container.querySelector("#ses-engine-options"), document.documentElement.append(this._container), this.populateEngineList();
      this._engineOptions.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.preventDefault(); event.stopPropagation();
        this.hideOptionsOnClickOutside(); this._engineSelect.focus();
      });
    },
    async populateEngineList() {
      const options = this._engineOptions, generation = this._generation, revision = this._engineRevision;
      const engines = await allSearchEngines();
      if (generation !== this._generation || revision !== this._engineRevision || options !== this._engineOptions || !options) return;
      options.replaceChildren();
      const hidden = new Set(readEngineSettings().settings.hidden);
      engines.filter(engine => !hidden.has(engineKey(engine))).forEach((engine) => {
        let option = parseElement(`
        <button type="button" class="ses-engine-option" title="Search with ${escapeXmlAttribute(engine.name)}">
          <span>${escapeXmlAttribute(engine.name)}</span>
        </button>
      `), img = parseElement("<img>");
        img.src = getSearchEngineFavicon(engine), option.prepend(img), option.addEventListener("mousedown", (e) => this.handleEngineClick(e, engine)), this._engineOptions.append(option);
        img.alt = '';
        option.addEventListener('click', event => {
          if (event.detail === 0) this.handleEngineClick(event, engine);
        });
      });
      const manage = document.createElementNS('http://www.w3.org/1999/xhtml', 'button');
      manage.type = 'button'; manage.dataset.sesAction = 'manage'; manage.textContent = 'Mod settings...';
      manage.addEventListener('click', event => {
        event.stopPropagation();
        this.hideOptionsOnClickOutside();
        window.openTrustedLinkIn('about:preferences?searchEngineSelectSettings=1#sineMods', 'tab');
      });
      options.append(manage);
    },
    startDrag(e) {
      if (e.button !== 0)
        return;
      e.preventDefault(), this._isDragging = !0, this._container.classList.add("is-dragging"), this._dragHandle.style.cursor = "grabbing", this._startY = e.clientY, this._initialTop = this._container.offsetTop, document.addEventListener("mousemove", this._boundListeners.doDrag), document.addEventListener("mouseup", this._boundListeners.stopDrag);
    },
    doDrag(e) {
      if (!this._isDragging)
        return;
      e.preventDefault();
      let newTop = this._initialTop + (e.clientY - this._startY), maxTop = window.innerHeight - this._container.offsetHeight - 10;
      newTop = Math.max(10, Math.min(newTop, maxTop)), this._container.style.top = `${newTop}px`;
    },
    stopDrag() {
      if (!this._isDragging)
        return;
      if (this._isDragging = !1, this._container.classList.remove("is-dragging"), this._dragHandle.style.cursor = "grab", PREFS2.rememberPosition)
        PREFS2.yCoor = this._container.style.top;
      document.removeEventListener("mousemove", this._boundListeners.doDrag), document.removeEventListener("mouseup", this._boundListeners.stopDrag);
    },
    attachEventListeners() {
      this._progressListener = {
        onLocationChange: this.onLocationChange.bind(this),
        QueryInterface: ChromeUtils.generateQI([
          "nsIWebProgressListener",
          "nsISupportsWeakReference"
        ])
      }, this._boundListeners.handleTabSelect = this.handleTabSelect.bind(this), this._boundListeners.handleURLBarKey = this.handleURLBarKey.bind(this), this._boundListeners.toggleOptions = this.toggleOptions.bind(this), this._boundListeners.hideOptionsOnClickOutside = this.hideOptionsOnClickOutside.bind(this), this._boundListeners.startDrag = this.startDrag.bind(this), this._boundListeners.doDrag = this.doDrag.bind(this), this._boundListeners.stopDrag = this.stopDrag.bind(this), this._boundListeners.onSplitViewActivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onSplitViewDeactivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onCompactModeToggled = this.updatePosition.bind(this), this._boundListeners.onResize = this.updatePosition.bind(this), this._boundListeners.onTabClose = () => {
        this.updatePosition(), this.schedulePosition();
      }, this._resizeObserver = new ResizeObserver(() => this.updatePosition()), this.observeSelectedBrowser(), gBrowser.tabContainer.addEventListener("TabSelect", this._boundListeners.handleTabSelect), gBrowser.addTabsProgressListener(this._progressListener), gURLBar.inputField.addEventListener("keydown", this._boundListeners.handleURLBarKey), this._engineSelect.addEventListener("click", this._boundListeners.toggleOptions), document.addEventListener("click", this._boundListeners.hideOptionsOnClickOutside), this._dragHandle.addEventListener("mousedown", this._boundListeners.startDrag), gBrowser.tabContainer.addEventListener("TabClose", this._boundListeners.onTabClose), window.addEventListener("ZenViewSplitter:SplitViewActivated", this._boundListeners.onSplitViewActivated), window.addEventListener("ZenViewSplitter:SplitViewDeactivated", this._boundListeners.onSplitViewDeactivated), window.addEventListener("ZenCompactMode:Toggled", this._boundListeners.onCompactModeToggled), window.addEventListener("resize", this._boundListeners.onResize);
    },
    removeEventListeners() {
      if (gBrowser.tabContainer.removeEventListener("TabSelect", this._boundListeners.handleTabSelect), this._progressListener)
        gBrowser.removeTabsProgressListener(this._progressListener), this._progressListener = null;
      gURLBar.inputField.removeEventListener("keydown", this._boundListeners.handleURLBarKey), this._engineSelect?.removeEventListener("click", this._boundListeners.toggleOptions), document.removeEventListener("click", this._boundListeners.hideOptionsOnClickOutside), this._dragHandle?.removeEventListener("mousedown", this._boundListeners.startDrag), document.removeEventListener("mousemove", this._boundListeners.doDrag), document.removeEventListener("mouseup", this._boundListeners.stopDrag), gBrowser.tabContainer.removeEventListener("TabClose", this._boundListeners.onTabClose), window.removeEventListener("ZenViewSplitter:SplitViewActivated", this._boundListeners.onSplitViewActivated), window.removeEventListener("ZenViewSplitter:SplitViewDeactivated", this._boundListeners.onSplitViewDeactivated), window.removeEventListener("ZenCompactMode:Toggled", this._boundListeners.onCompactModeToggled), window.removeEventListener("resize", this._boundListeners.onResize);
      try {
        this._resizeObserver?.disconnect();
      } catch {}
      this._resizeObserver = null, this._boundListeners = {};
    }
  };
  const removers = [];
  const isSettingsPage = /^about:(preferences|settings)(?:[?#]|$)/.test(window.location.href);
  let settingsBridge;
  const owner = { unload() {
    if (SearchEngineSwitcher._disposed) return;
    SearchEngineSwitcher._disposed = true;
    window.removeEventListener('load', init);
    window.removeEventListener('unload', owner.unload);
    if (isSettingsPage) settingsBridge?.destroy();
    else SearchEngineSwitcher.destroy();
    for (const remove of removers.splice(0)) remove();
    if (window[ownerKey] === owner) delete window[ownerKey];
  } };
  window[ownerKey] = owner;
  if (typeof window.addUnloadListener === 'function') window.addUnloadListener(owner.unload);
  window.addEventListener('unload', owner.unload, { once: true });
  function init() {
    if (SearchEngineSwitcher._disposed) return;
    if (isSettingsPage) { settingsBridge = mountSineSettings(); return; }
    let handleEnabledChange = (pref) => {
      SearchEngineSwitcher.handleEnabledChange(pref);
    };
    if (PREFS2.setInitialPrefs(), PREFS2.enabled)
      SearchEngineSwitcher.init();
    removers.push(addPrefListener(PREFS2.ENABLED, handleEnabledChange));
    removers.push(addPrefListener(ENGINE_SETTINGS_PREF, () => SearchEngineSwitcher.refreshEngines()));
    const engineObserver = { observe() { SearchEngineSwitcher.refreshEngines(); } };
    Services.obs.addObserver(engineObserver, 'browser-search-engine-modified');
    removers.push(() => Services.obs.removeObserver(engineObserver, 'browser-search-engine-modified'));
  }
  startupFinish(init);
})();
