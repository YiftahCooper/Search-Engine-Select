// ==UserScript==
// @name            Search Engine Select
// @description     Adds a floating UI to switch search engines on a search results page.
// @author          Bibek Bhusal
// @version         1.3.4
// @lastUpdated     2026-11-07
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
  const genericSearchIcon = 'chrome://global/skin/icons/search-glass.svg';
  function searchEngineIcons(engine) {
    if (engine?.sesIcon?.kind === 'builtin') return [builtinIcon(engine.sesIcon.name),genericSearchIcon];
    if (engine?.sesIcon?.kind === 'url') return [engine.sesIcon.data,genericSearchIcon];
    if (engine?.sesDefaultIcon) return [engine.sesDefaultIcon,genericSearchIcon];
    const candidates = [];
    if (engine?.iconURI?.spec === genericSearchIcon) return [genericSearchIcon];
    if (engine?.iconURI?.spec) candidates.push(engine.iconURI.spec);
    try {
      const url = new URL(engine?.sesIconOrigin || engine?.getSubmission('')?.uri?.spec);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        candidates.push(`${url.origin}/favicon.ico`);
        // Retain the native fallback only for public-looking DNS names. Never
        // disclose configured engines, IP literals or local names to Google.
        const host = url.hostname.toLowerCase().replace(/\.$/, '');
        const publicName = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) &&
          !/(^|\.)(localhost|local|internal|intranet|lan|home|home\.arpa|test|invalid|example|onion)$/.test(host);
        if (!engine.sesId && publicName)
          candidates.push(`https://s2.googleusercontent.com/s2/favicons?domain_url=https://${host}&sz=32`);
      }
    } catch {}
    return [...new Set([...candidates, genericSearchIcon])];
  }
  function setSearchEngineIcon(img, engine) {
    const candidates = searchEngineIcons(engine);
    let index = 0;
    img.alt = '';
    img.setAttribute('referrerpolicy', 'no-referrer');
    const advance = () => {
      // Install the handler before src, and remove it at the terminal fallback.
      // Each candidate is attempted at most once per rendered image.
      img.onerror = index < candidates.length - 1 ? advance : null;
      img.src = candidates[index++];
    };
    advance();
  }

  // utils/startup-finish.js
  function startupFinish(callback) {
    if (document.readyState === "complete")
      callback();
    else
      window.addEventListener("load", callback, { once: !0 });
  }

  // utils/parse.js
  var parseElement = (elementString) => {
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
    static get rememberPosition() {
      return this.getPref(this.REMEMBER_POSITION);
    }
    static get yCoor() {
      return this.getPref(this.Y_COOR);
    }
    static set yCoor(value) {
      this.setPref(this.Y_COOR, value);
    }
  }
  var PREFS2 = SearchEngineSelectPREFS;
  // Saved positions are "<n>px" (drag) or "<n>%" (default). Anything else,
  // including hand-edited values, falls back to the default.
  function sanitizeTop(value) {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(px|%)?\s*$/.exec(String(value ?? ''));
    if (!match || !Number.isFinite(Number(match[1]))) return SearchEngineSelectPREFS.defaultValues[SearchEngineSelectPREFS.Y_COOR];
    return match[2] === '%' ? `${Math.min(Number(match[1]), 100)}%` : `${Number(match[1])}px`;
  }

  // @include presets.js
  // @include icons.js
  // @include engines.js
  // @include detection.js
  // @include manager.js
  // @include sine-settings.js

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

  // utils/open-link.js
  // Only the destinations handleEngineClick passes; anything else (or a failed
  // Glance) falls back to a foreground tab.
  async function openLink(url, where) {
    if (!url)
      return !1;
    switch (where) {
      case "current tab":
        return openTrustedLinkIn(url, "current"), !0;
      case "background tab":
        return openTrustedLinkIn(url, "tab", { inBackground: !0, relatedToCurrent: !0 }), !0;
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
    _positionTimer: null,
    _engineRevision: 0,
    _retryCount: 0,
    _preferredTop: '60%',
    // A failed start (search service not ready, module import failure) is
    // retried a bounded number of times with increasing delays. A later
    // engine-modified notification or re-enabling also restarts it.
    _retryDelays: [1000, 2000, 4000, 8000, 16000],
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
        this._retryCount = 0;
      })().catch(error => {
        PREFS2.debugError('Initialization failed', error);
        if (generation !== this._generation) return;
        this.destroy();
        this.scheduleRetry();
      }).finally(() => {
        if (this._initializing === pending) this._initializing = null;
      });
      this._initializing = pending;
      return pending;
    },
    scheduleRetry() {
      if (this._disposed || !PREFS2.enabled || this._retryCount >= this._retryDelays.length) return;
      const timer = setTimeout(() => {
        this._timers.delete(timer);
        if (!this._disposed && PREFS2.enabled) this.init();
      }, this._retryDelays[this._retryCount++]);
      this._timers.add(timer);
    },
    destroy() {
      ++this._generation;
      this._initializing = null;
      for (const timer of this._timers) clearTimeout(timer);
      this._timers.clear();
      this._positionTimer = null;
      this._isDragging = false;
      this._container?.remove(), this.removeEventListeners(), this._container = null, this._engineSelect = null, this._engineOptions = null, this._dragHandle = null, PREFS2.debugLog("Destroyed successfully.");
    },
    // Coalesce delayed repositioning: a burst of tab closes leaves one timer.
    schedulePosition() {
      if (this._positionTimer) {
        clearTimeout(this._positionTimer);
        this._timers.delete(this._positionTimer);
      }
      const timer = this._positionTimer = setTimeout(() => {
        this._timers.delete(timer);
        if (this._positionTimer === timer) this._positionTimer = null;
        if (!this._disposed && this._container) this.updatePosition();
      }, 500);
      this._timers.add(timer);
    },
    isVisible() {
      return this._container?.style.display === "flex";
    },
    async buildEngineRegexCache(generation = this._generation) {
      const revision = ++this._engineRevision;
      const engines = await allSearchEngines(true);
      if (generation !== this._generation || revision !== this._engineRevision) return;
      const cache = [];
      for (const engine of engines) {
        try {
          const matcher = searchUrlMatcher(engine);
          if (matcher) cache.push(matcher);
        } catch (error) { PREFS2.debugError(`Failed to process engine ${engine.name}`, error); }
      }
      // Prefer specific modes (for example Images) over a general search at the
      // same endpoint, independently of the user's display order.
      this._engineCache = cache.sort((a,b) => b.specificity - a.specificity);
    },
    matchUrl(value) {
      let url;
      try { url = new URL(value); } catch { return null; }
      for (const matcher of this._engineCache) {
        const result = matcher.match(url);
        if (result) return result;
      }
      return null;
    },
    updateSwitcherVisibility() {
      this._currentSearchInfo = this.matchUrl(gBrowser.selectedBrowser.currentURI.spec);
      if (this._currentSearchInfo) this._show();
      else this._hide();
    },
    _show() {
      if (!this._container)
        return;
      const appearing = !this.isVisible();
      if (appearing) this._container.style.display = "flex";
      this.updateSelectedEngineDisplay();
      // Layout reads happen only while visible; re-check the saved position
      // whenever the selector reappears, since the window may have changed.
      if (appearing) this.applyPosition();
      this.handleSplitOrGlance();
    },
    _hide() {
      if (!this._container)
        return;
      this.hideOptionsOnClickOutside();
      if (this._container.style.display !== "none") this._container.style.display = "none";
    },
    updateSelectedEngineDisplay() {
      if (!this._currentSearchInfo || !this._engineSelect)
        return;
      // matchUrl results always carry an engine.
      let { engine } = this._currentSearchInfo, img = parseElement("<img>");
      setSearchEngineIcon(img, engine);
      let label = engine.name, nameSpan = parseElement(`<span>${escapeXmlAttribute(label)}</span>`);
      this._engineSelect.replaceChildren(img, nameSpan);
      this._engineSelect.setAttribute('aria-label', `Search engine: ${label}. Choose another engine`);
    },
    handleEnabledChange(pref) {
      if (pref.value)
        this._retryCount = 0, this.init();
      else
        this.destroy();
    },
    handleTabSelect() {
      // A tab switch always closes the engine menu; _show positions the
      // selector (split/glance included) only when the new tab is a search.
      this.hideOptionsOnClickOutside();
      this.updateSwitcherVisibility();
      this.observeSelectedBrowser();
      if (this.isVisible() && gBrowser.selectedTab?.hasAttribute("zen-glance-tab"))
        this.schedulePosition();
    },
    onLocationChange(browser) {
      if (browser === gBrowser.selectedBrowser)
        this.updateSwitcherVisibility();
    },
    handleSplitOrGlance() {
      // Hidden: nothing to place. _show re-runs this when the selector appears.
      if (!this._container || !this.isVisible())
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
      if (!this._container || !this.isVisible()) return;
      if (!activeBrowser || !this._container.classList.contains("in-split-view")) {
        this._container.style.removeProperty("--ses-pane-x"), this._container.style.removeProperty("--ses-pane-width");
        return;
      }
      let rect = activeBrowser.getBoundingClientRect();
      if (!rect.width)
        return;
      this._container.style.setProperty("--ses-pane-x", `${rect.x}px`), this._container.style.setProperty("--ses-pane-width", `${rect.width}px`);
    },
    async handleEngineClick(event, newEngine) {
      const generation = this._generation;
      event.preventDefault(); event.stopPropagation();
      if (!this._currentSearchInfo?.term)
        return;
      let term = this._currentSearchInfo.term, submission = newEngine.getSubmission(term), newUrl = submission?.uri?.spec, where = null;
      if (!newUrl) return;
      const newTabGesture = event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey));
      if (newTabGesture && !Services.prefs.getBoolPref('extension.search-engine-select.open-in-new-tab',true)) return;
      if (!newTabGesture && engineKey(newEngine) === engineKey(this._currentSearchInfo?.engine) && newUrl === gBrowser.selectedBrowser.currentURI.spec) {
        this.hideOptionsOnClickOutside(); return;
      }
      if (newTabGesture)
        where = "background tab";
      else if (event.button === 0 && event.altKey)
        where = "glance";
      else if (event.button === 0)
        where = "current tab";
      if (!where) {
        this.hideOptionsOnClickOutside();
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
      // Runs for every chrome click: skip the writes when the menu is closed.
      if (this._engineOptions.style.display !== "block" && !this._container.classList.contains("options-visible") && this._engineSelect?.getAttribute('aria-expanded') !== 'true') return;
      this._engineOptions.style.display = "none", this._container.classList.remove("options-visible");
      this._engineSelect?.setAttribute('aria-expanded', 'false');
    },
    async refreshEngines() {
      if (this._disposed) return;
      // Not running while enabled means startup failed: engines changing is a
      // sign the search service is ready, so start again (init is idempotent).
      if (!this._container) return PREFS2.enabled ? this.init() : undefined;
      const generation = this._generation;
      try {
        await this.buildEngineRegexCache(generation);
        if (generation !== this._generation || !this._container) return;
        await this.populateEngineList();
        this.updateSwitcherVisibility();
      } catch (error) { PREFS2.debugError('Engine refresh failed', error); }
    },
    // Apply the remembered vertical position, clamped to the same bounds a
    // drag allows in the current window. Needs layout, so only while visible.
    applyPosition() {
      const container = this._container;
      if (!container || !this.isVisible() || this._isDragging) return;
      let top = this._preferredTop;
      const px = /^(\d+(?:\.\d+)?)px$/.exec(top);
      if (px) {
        const max = Math.max(10, window.innerHeight - container.offsetHeight - 10);
        top = `${Math.min(Math.max(Number(px[1]), 10), max)}px`;
      }
      if (container.style.top !== top) container.style.top = top;
    },
    createUI() {
      this._preferredTop = sanitizeTop(PREFS2.yCoor);
      let container = parseElement(`
      <div id="search-engine-switcher-container">
        <button type="button" id="ses-engine-select" aria-expanded="false" aria-controls="ses-engine-options" aria-label="Choose a search engine"></button>
        <div id="ses-drag-handle"></div>
        <div id="ses-engine-options"></div>
      </div>
    `);
      // Set as a property: the preference is never interpolated into markup.
      container.style.top = this._preferredTop;
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
      const settings = readEngineSettings().settings;
      const hidden = new Set([...settings.hidden,...settings.removed]);
      engines.filter(engine => !hidden.has(engineKey(engine))).forEach((engine) => {
        let option = parseElement(`
        <button type="button" class="ses-engine-option" title="Search with ${escapeXmlAttribute(engine.name)}">
          <span>${escapeXmlAttribute(engine.name)}</span>
        </button>
      `), img = parseElement("<img>");
        setSearchEngineIcon(img, engine), option.prepend(img), option.addEventListener("mousedown", (e) => this.handleEngineClick(e, engine)), this._engineOptions.append(option);
        option.addEventListener('click', event => {
          if (event.detail === 0) this.handleEngineClick(event, engine);
        });
        option.addEventListener('auxclick', event => { if (event.button === 1) event.preventDefault(); });
      });
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
      if (this._isDragging = !1, this._container.classList.remove("is-dragging"), this._dragHandle.style.cursor = "grab", this._preferredTop = this._container.style.top, PREFS2.rememberPosition)
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
      }, this._boundListeners.handleTabSelect = this.handleTabSelect.bind(this), this._boundListeners.toggleOptions = this.toggleOptions.bind(this), this._boundListeners.hideOptionsOnClickOutside = this.hideOptionsOnClickOutside.bind(this), this._boundListeners.startDrag = this.startDrag.bind(this), this._boundListeners.doDrag = this.doDrag.bind(this), this._boundListeners.stopDrag = this.stopDrag.bind(this), this._boundListeners.onSplitViewActivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onSplitViewDeactivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onCompactModeToggled = this.updatePosition.bind(this), this._boundListeners.onResize = () => {
        this.applyPosition(), this.updatePosition();
      }, this._boundListeners.onTabClose = () => {
        this.updatePosition(), this.schedulePosition();
      }, this._resizeObserver = new ResizeObserver(() => this.updatePosition()), this.observeSelectedBrowser(), gBrowser.tabContainer.addEventListener("TabSelect", this._boundListeners.handleTabSelect), gBrowser.addTabsProgressListener(this._progressListener), this._engineSelect.addEventListener("click", this._boundListeners.toggleOptions), document.addEventListener("click", this._boundListeners.hideOptionsOnClickOutside), this._dragHandle.addEventListener("mousedown", this._boundListeners.startDrag), gBrowser.tabContainer.addEventListener("TabClose", this._boundListeners.onTabClose), window.addEventListener("ZenViewSplitter:SplitViewActivated", this._boundListeners.onSplitViewActivated), window.addEventListener("ZenViewSplitter:SplitViewDeactivated", this._boundListeners.onSplitViewDeactivated), window.addEventListener("ZenCompactMode:Toggled", this._boundListeners.onCompactModeToggled), window.addEventListener("resize", this._boundListeners.onResize);
    },
    removeEventListeners() {
      if (gBrowser.tabContainer.removeEventListener("TabSelect", this._boundListeners.handleTabSelect), this._progressListener)
        gBrowser.removeTabsProgressListener(this._progressListener), this._progressListener = null;
      this._engineSelect?.removeEventListener("click", this._boundListeners.toggleOptions), document.removeEventListener("click", this._boundListeners.hideOptionsOnClickOutside), this._dragHandle?.removeEventListener("mousedown", this._boundListeners.startDrag), document.removeEventListener("mousemove", this._boundListeners.doDrag), document.removeEventListener("mouseup", this._boundListeners.stopDrag), gBrowser.tabContainer.removeEventListener("TabClose", this._boundListeners.onTabClose), window.removeEventListener("ZenViewSplitter:SplitViewActivated", this._boundListeners.onSplitViewActivated), window.removeEventListener("ZenViewSplitter:SplitViewDeactivated", this._boundListeners.onSplitViewDeactivated), window.removeEventListener("ZenCompactMode:Toggled", this._boundListeners.onCompactModeToggled), window.removeEventListener("resize", this._boundListeners.onResize);
      try {
        this._resizeObserver?.disconnect();
      } catch {}
      this._resizeObserver = null, this._boundListeners = {};
    }
  };
  const removers = [];
  const isSettingsPage = /^about:(preferences|settings)(?:[?#]|$)/.test(window.location.href);
  // Legacy releases had no registered owner to unload. Reclaim only this mod's
  // exact root ID: sweep the whole document once, then watch only direct
  // children of <html>, where every release (upstream included) appends its
  // root. A subtree observer would see all chrome DOM churn.
  let rootObserver;
  if (!isSettingsPage) {
    const rootId = 'search-engine-switcher-container';
    const isOrphan = node => node.id === rootId && node !== SearchEngineSwitcher._container;
    for (const root of document.querySelectorAll(`#${rootId}`)) {
      if (isOrphan(root)) root.remove();
    }
    rootObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && isOrphan(node)) node.remove();
      }
    });
    rootObserver.observe(document.documentElement, {childList: true});
  }
  let settingsBridge;
  const owner = { unload() {
    if (SearchEngineSwitcher._disposed) return;
    SearchEngineSwitcher._disposed = true;
    rootObserver?.disconnect();
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
