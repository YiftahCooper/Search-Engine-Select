// Generated from src/switcher.js. Run node build.mjs to rebuild.
// ==UserScript==
// @name            Search Engine Select
// @description     Adds a floating UI to switch search engines on a search results page.
// @author          Bibek Bhusal
// @version         1.3.1
// @lastUpdated     2026-10-07
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

  // Default engines appear in the same editable list as browser/custom engines.
// Stable legacy IDs retain existing 1.3.0 edits, icons and order.
const SES_PRESETS = [
  {id:'google-images',name:'Google Images',url:'https://www.google.com/search?udm=2&q={searchTerms}'},
  {id:'youtube',name:'YouTube',url:'https://www.youtube.com/results?search_query={searchTerms}'},
  {id:'google-maps',name:'Google Maps',url:'https://www.google.com/maps/search/?api=1&query={searchTerms}'},
  {id:'google-scholar',name:'Google Scholar',url:'https://scholar.google.com/scholar?q={searchTerms}'},
  {id:'reddit',name:'Reddit',url:'https://www.reddit.com/search/?q={searchTerms}'},
  {id:'reddit-google',name:'Reddit via Google',url:'https://www.google.com/search?q=site%3Areddit.com%20{searchTerms}'},
  {id:'pdf-google',name:'PDFs via Google',url:'https://www.google.com/search?q={searchTerms}%20filetype%3Apdf'}
];
function presetForEngine(id) { return SES_PRESETS.find(preset => `custom-preset-${preset.id}` === id); }

  const SES_ICON_NAMES = {picture:'Picture',pdf:'PDF document',discussion:'Discussion',map:'Map',book:'Book',search:'Search'};
// Self-contained service marks: no favicon request can turn a default into a
// generic placeholder. Filtered Google searches carry an explicit visual badge.
function defaultEngineIcon(id) {
  const google='<path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6.2a5.3 5.3 0 0 1-2.3 3.5v2.8h3.7C21.8 18.6 23 15.7 23 12.3z"/><path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9A11.5 11.5 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.6 13.8a7 7 0 0 1 0-4.4V6.5H1.8a11.5 11.5 0 0 0 0 10.2z"/><path fill="#EA4335" d="M12 4.7c1.7 0 3.2.6 4.4 1.8l3.3-3.3A11 11 0 0 0 12 0 11.5 11.5 0 0 0 1.8 6.5l3.8 2.9C6.5 6.7 9 4.7 12 4.7z"/>';
  const reddit='<circle cx="16" cy="16" r="15" fill="#ff4500"/><g fill="white"><ellipse cx="16" cy="19" rx="10" ry="7"/><circle cx="6" cy="16" r="3"/><circle cx="26" cy="16" r="3"/><circle cx="23" cy="8" r="2.4"/></g><path d="m16 13 2-7 5 2" fill="none" stroke="white" stroke-width="2"/><g fill="#ff4500"><circle cx="12" cy="18" r="1.7"/><circle cx="20" cy="18" r="1.7"/></g><path d="M12 22q4 3 8 0" fill="none" stroke="#ff4500" stroke-width="1.5" stroke-linecap="round"/>';
  const drawings={
    'google-images':`<g transform="translate(1 1) scale(.95)">${google}</g><rect x="15" y="17" width="16" height="14" rx="3" fill="#4285f4" stroke="white"/><path d="m18 27 4-4 3 3 3-2" fill="none" stroke="white" stroke-width="1.7"/><circle cx="26" cy="21" r="1.5" fill="white"/>`,
    'youtube':'<rect x="1" y="5" width="30" height="22" rx="7" fill="#ff0033"/><path d="m13 10 9 6-9 6z" fill="white"/>',
    'google-maps':'<path d="M16 1C9 1 5 6 5 12c0 8 9 17 11 19 2-2 11-11 11-19C27 6 23 1 16 1z" fill="#34a853"/><path d="M16 1C9 1 5 6 5 12c0 3 1 6 3 9L23 4a11 11 0 0 0-7-3z" fill="#4285f4"/><path d="m8 21 5-6-7-7c-2 4-1 8 2 13z" fill="#fbbc04"/><path d="m13 15 10-11 3 4-9 10z" fill="#ea4335"/><circle cx="16" cy="12" r="4" fill="white"/>',
    'google-scholar':'<path d="m1 12 15-10 15 10-15 10z" fill="#4285f4"/><path d="m16 2 15 10-15 10z" fill="#1967d2"/><circle cx="16" cy="22" r="8" fill="#a1c2fa"/><path d="M8 22a8 8 0 0 1 16 0z" fill="#4285f4"/>',
    'reddit':reddit,
    'reddit-google':`<g transform="scale(.8)">${reddit}</g><circle cx="24" cy="24" r="8" fill="white"/><g transform="translate(18 18) scale(.52)">${google}</g>`,
    'pdf-google':`<path d="M4 1h16l8 8v22H4z" fill="#e94235"/><path d="M20 1v8h8" fill="#ffb3ad"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="10" font-weight="bold">PDF</text><circle cx="25" cy="7" r="7" fill="white"/><g transform="translate(20 2) scale(.44)">${google}</g>`
  };
  if (!Object.hasOwn(drawings,id)) return undefined;
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${drawings[id]}</svg>`);
}
function builtinIcon(name) {
  const drawings = {
    picture:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    pdf:'<path d="M6 3h8l4 4v14H6zM14 3v5h4"/><text x="12" y="17" text-anchor="middle" fill="white" stroke="none" font-family="sans-serif" font-size="7" font-weight="bold">PDF</text>',
    discussion:'<path d="M4 4h16v12H9l-5 4z"/><path d="M8 8h8M8 12h6"/>',
    map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
    book:'<path d="M12 5C9 3 6 3 3 4v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v16"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'
  };
  if (!Object.hasOwn(drawings,name)) throw new Error('Choose a supported built-in icon.');
  // A filled background keeps these icons legible in both light and dark themes.
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#536779"/><g transform="translate(2 2)" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${drawings[name]}</g></svg>`);
}
function iconUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a direct HTTPS image URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a direct HTTPS image URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS image URL without a username or password.');
  return url.href;
}
function validateIcon(icon) {
  if (icon == null) return undefined;
  if (icon.kind === 'builtin' && Object.hasOwn(SES_ICON_NAMES, icon.name)) return {kind:'builtin',name:icon.name};
  if (icon.kind === 'url' && typeof icon.data === 'string' && icon.data.length <= 8192 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(icon.data))
    return {kind:'url',url:iconUrl(icon.url),data:icon.data};
  throw new Error('The saved icon is invalid.');
}
async function fetchCustomIcon(value, signal) {
  const url = iconUrl(value), controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort',abort,{once:true});
  // The deadline covers body download and image decoding, not just headers.
  let timer, image, objectUrl;
  const deadline = new Promise((_,reject) => {
    const fail = () => reject(new Error(signal?.aborted ? 'Icon loading canceled.' : 'Icon loading timed out. Try another image URL.'));
    controller.signal.addEventListener('abort',fail,{once:true});
    if (controller.signal.aborted) fail();
    timer = setTimeout(abort,8000);
  });
  try {
    return await Promise.race([deadline,(async()=>{
      const response = await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      if (!response.ok || !response.url.startsWith('https:')) throw new Error('Could not download the icon. Use a direct HTTPS image link.');
      const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon','image/svg+xml'].includes(type)) throw new Error('That link does not return a supported image.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Could not read the image.');
      const chunks = []; let size = 0;
      try {
        while (true) {
          const {done,value:chunk} = await reader.read(); if (done) break;
          size += chunk.length;
          if (size > 262144) throw new Error('Choose an image smaller than 256 KB.');
          chunks.push(chunk);
        }
      } finally { void reader.cancel().catch(()=>{}); }
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      objectUrl = URL.createObjectURL(new Blob(chunks,{type})); image = new Image();
      await new Promise((resolve,reject)=> { image.onload=resolve; image.onerror=()=>reject(new Error('The image could not be decoded.')); image.src=objectUrl; });
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 4096 || image.naturalHeight > 4096) throw new Error('Choose an image no larger than 4096 pixels.');
      const canvas = document.createElementNS('http://www.w3.org/1999/xhtml','canvas'); canvas.width=32; canvas.height=32;
      const scale = Math.min(32/image.naturalWidth,32/image.naturalHeight), width=image.naturalWidth*scale, height=image.naturalHeight*scale;
      canvas.getContext('2d').drawImage(image,(32-width)/2,(32-height)/2,width,height);
      return validateIcon({kind:'url',url,data:canvas.toDataURL('image/png')});
    })()]);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',abort); controller.abort();
    if (image) { image.onload=image.onerror=null; image.src=''; }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

  // Selector-only configuration. Never writes to the browser search service.
const ENGINE_SETTINGS_PREF = 'extension.search-engine-select.engines';
const emptyEngineSettings = () => ({ version: 4, removed: [], hidden: [], custom: [], order: [], overrides: [] });
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
  const icon = validateIcon(value.icon);
  return { id: value.id, name, url: template, ...(icon ? {icon} : {}) };
}
function readEngineSettings() {
  const raw = Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '');
  if (!raw) return { raw, settings: emptyEngineSettings(), error: '' };
  try {
    const value = JSON.parse(raw);
    if (![1, 2, 3, 4].includes(value?.version) || !Array.isArray(value.hidden) || !Array.isArray(value.custom) || value.hidden.length > 200 || value.custom.length > 100 || value.hidden.some(id => typeof id !== 'string')) throw new Error();
    const ids = new Set(), names = new Set();
    const custom = value.custom.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !/^custom-[a-zA-Z0-9-]+$/.test(engine.id) || ids.has(engine.id) || names.has(engine.name.toLowerCase())) throw new Error();
      ids.add(engine.id); names.add(engine.name.toLowerCase()); return engine;
    });
    const order = value.version === 1 ? [] : value.order;
    const overrides = value.version === 1 ? [] : value.overrides;
    if (!Array.isArray(order) || order.length > 300 || order.some(id => typeof id !== 'string') || new Set(order).size !== order.length || !Array.isArray(overrides) || overrides.length > 200) throw new Error();
    const nativeIds = new Set();
    const checkedOverrides = overrides.map(item => {
      const engine = validateCustomEngine(item);
      if (typeof engine.id !== 'string' || !engine.id.startsWith('native:') || nativeIds.has(engine.id)) throw new Error();
      nativeIds.add(engine.id); return engine;
    });
    const removed = value.version < 4 ? value.hidden : value.removed;
    if (!Array.isArray(removed) || removed.length > 300 || removed.some(id => typeof id !== 'string')) throw new Error();
    return { raw, settings: { version: 4, removed: [...new Set(removed)], hidden: [...new Set(value.hidden)], custom, order, overrides: checkedOverrides }, error: '' };
  } catch {
    return { raw, settings: emptyEngineSettings(), error: 'Saved engine settings are invalid. They have been preserved. Reset them below to edit the list.' };
  }
}
function saveEngineSettings(settings, expectedRaw) {
  if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== expectedRaw) throw new Error('Engine settings changed in another window. Close and reopen Configure.');
  const encoded = JSON.stringify(settings);
  if (new TextEncoder().encode(encoded).length > 524288) throw new Error('The engine list is too large. Remove some custom icons or engines first.');
  Services.prefs.setStringPref(ENGINE_SETTINGS_PREF, encoded);
}
function configuredEngine(item) {
  const preset = presetForEngine(item.id);
  const icon = item.icon;
  const defaultIcon = preset && item.url === preset.url ? defaultEngineIcon(preset.id) : undefined;
  return {
    name: item.name, sesId: item.id,
    sesIcon: icon, sesDefaultIcon: defaultIcon,
    // Configured URLs use their own origin, never a third-party favicon lookup.
    sesIconOrigin: new URL(item.url.replace('{searchTerms}', '')).origin,
    getSubmission(term) { return { uri: { spec: item.url.replace('{searchTerms}', encodeURIComponent(term)) }, postData: null }; }
  };
}
function orderedEngines(installed, settings) {
  const overrides = new Map(settings.overrides.map(item => [item.id, item]));
  const engines = [...installed.map(engine => overrides.has(engineKey(engine)) ? configuredEngine(overrides.get(engineKey(engine))) : engine), ...settings.custom.map(configuredEngine)];
  for (const item of SES_PRESETS) {
    const id = `custom-preset-${item.id}`;
    // Keep existing edited entries and avoid duplicating a browser/custom engine.
    if (!engines.some(engine => engineKey(engine) === id || engine.name.toLowerCase() === item.name.toLowerCase() || engineTemplate(engine) === item.url))
      engines.push(configuredEngine({...item,id}));
  }
  const rank = new Map(settings.order.map((id, index) => [id, index]));
  return engines.sort((a, b) => (rank.get(engineKey(a)) ?? Infinity) - (rank.get(engineKey(b)) ?? Infinity));
}
async function allSearchEngines(forDetection = false) {
  const installed = await getVisibleEngines();
  const settings = readEngineSettings().settings;
  const configured = orderedEngines(installed, settings);
  // Native URLs still identify a search after an override or removal from this selector.
  return forDetection ? [...configured, ...installed.filter(engine => settings.overrides.some(item => item.id === engineKey(engine)))] : configured;
}
function engineTemplate(engine) {
  const marker = 'SES_EDIT_QUERY_MARKER';
  try {
    const submission = engine.getSubmission(marker);
    if (submission?.postData) return '';
    const url = submission?.uri?.spec || '';
    return url.includes(marker) ? url.replace(marker, '{searchTerms}') : '';
  } catch { return ''; }
}

  // A query parameter alone is not evidence of a search engine. Match an actual
// configured GET submission's origin, path, query field and fixed mode values.
function searchUrlMatcher(engine) {
  const marker = 'SEARCH_TERM_PLACEHOLDER_E6A8D';
  const submission = engine.getSubmission(marker);
  if (!submission?.uri?.spec || submission.postData) return null;
  const template = new URL(submission.uri.spec);
  if (!['https:', 'http:'].includes(template.protocol) || template.username || template.password) return null;
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = (value, capture) => new RegExp(`^${value.split(marker).map(escape).join(capture)}$`);
  const pathQuery = template.pathname.includes(marker);
  const queryFields = [...template.searchParams].filter(([,value]) => value.includes(marker));
  if (Number(pathQuery) + queryFields.length !== 1) return null;
  const queryField = queryFields[0];
  const pathPattern = pattern(template.pathname, '([^/]+)');
  const termPattern = queryField && pattern(queryField[1], '(.+)');
  // Native attribution/encoding values vary by entry point and may disappear
  // on redirect. User-configured fixed parameters remain exact constraints.
  const attribution = new Set(['t', 'client', 'source', 'sourceid', 'form', 'ie', 'oe', 'rlz']);
  const fixed = [...template.searchParams].filter(([key,value]) => !value.includes(marker) && (engine.sesId || !attribution.has(key.toLowerCase())));
  const fixedGroups = [...new Set(fixed.map(([key]) => key))].map(key => [key, fixed.filter(([name]) => name === key).map(([,value]) => value).sort()]);
  // A literal prefix/suffix around the term (site:reddit.com, filetype:pdf)
  // identifies a more specific mode than the same endpoint's general search.
  const wrappedTerm = queryField ? queryField[1].replace(marker,'').length : 0;
  return {engine, specificity: fixed.length + Number(wrappedTerm > 0), match(url) {
    if (url.origin !== template.origin || url.username || url.password) return null;
    const path = url.pathname.match(pathPattern);
    if (!path || fixedGroups.some(([key,expected]) => {
      const actual = url.searchParams.getAll(key).sort();
      return actual.length !== expected.length || actual.some((value,index) => value !== expected[index]);
    })) return null;
    let term;
    if (pathQuery) {
      try { term = decodeURIComponent(path[1]); } catch { return null; }
    } else {
      const values = url.searchParams.getAll(queryField[0]);
      if (values.length !== 1) return null;
      term = values[0].match(termPattern)?.[1];
    }
    return term?.trim() ? {engine, term: term.trim()} : null;
  }};
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
  const intro = element('p', 'Choose engines for this selector. Drag a handle to reorder, or use Move up / Move down. These choices do not change Zen’s search settings.');
  const error = element('p'); error.dataset.sesError = ''; error.setAttribute('role', 'alert');
  const list = element('div'); list.className = 'ses-manager-list';
  const removed = element('details'); removed.className = 'ses-removed-engines';
  const removedSummary = element('summary', 'Removed engines');
  const removedList = element('div'); removed.append(removedSummary, removedList);
  const form = element('form'); form.noValidate = true;
  const nameLabel = element('label', 'Engine name');
  const name = element('input'); name.name = 'ses-name'; name.maxLength = 80; nameLabel.append(name);
  const urlLabel = element('label', 'Search URL — use {searchTerms} for the query');
  const url = element('input'); url.name = 'ses-url'; url.type = 'url'; url.maxLength = 2048; url.placeholder = 'https://example.com/search?q={searchTerms}'; urlLabel.append(url);
  const add = element('button', 'Add engine'); add.type = 'submit'; add.dataset.sesAction = 'add';
  const cancel = element('button', 'Cancel edit'); cancel.type = 'button'; cancel.hidden = true;
  const iconLabel = element('label','Icon');
  const iconChoice = element('select'); iconChoice.name='ses-icon';iconLabel.append(iconChoice);
  for (const [value,text] of [['default','Default — automatic'],...Object.entries(SES_ICON_NAMES).map(([id,label])=>[`builtin:${id}`,label]),['url','Custom image URL']]) {
    const option=element('option',text);option.value=value;iconChoice.append(option);
  }
  const imageLabel = element('label','Direct image URL'); imageLabel.hidden=true;
  const imageUrl = element('input'); imageUrl.name='ses-icon-url'; imageUrl.type='url';imageUrl.maxLength=2048;
  imageUrl.placeholder='https://example.com/icon.png';imageLabel.append(imageUrl);
  const iconTools = element('div'); iconTools.className='ses-icon-tools';
  const preview = element('img'); preview.className='ses-icon-preview';preview.alt='Icon preview';preview.hidden=true;
  const load = element('button','Load preview'); load.type='button';load.dataset.sesAction='preview-icon';load.hidden=true;
  const resetIcon = element('button','Reset to default'); resetIcon.type='button';resetIcon.dataset.sesAction='reset-icon';
  const iconStatus = element('span');iconStatus.setAttribute('role','status');
  iconTools.append(preview,load,resetIcon,iconStatus);
  const iconHint = element('p','Custom images are saved locally. Paste a direct HTTPS image link (up to 256 KB).'); iconHint.hidden=true;
  const formActions = element('div');formActions.className='ses-manager-actions';formActions.append(add,cancel);
  form.append(nameLabel, urlLabel, iconLabel, imageLabel, iconTools, iconHint, formActions);
  const reset = element('button', 'Back up and reset invalid settings'); reset.type = 'button'; reset.hidden = true;
  let revision = 0, rendered, editing = null, editRaw, dragging = null, disposed = false;
  let iconDraft, previewController, draftRevision = 0, saving = false;
  function cancelPreview() { previewController?.abort();previewController=null;add.disabled=saving || !!rendered?.error; }
  function changeDraft() { ++draftRevision;cancelPreview(); }
  function updateIconPreview() {
    const custom = iconChoice.value === 'url';
    imageLabel.hidden=load.hidden=iconHint.hidden=!custom;
    load.textContent=iconDraft?.kind==='url' && iconDraft.url===imageUrl.value.trim()?'Refresh icon':'Load preview';
    preview.hidden=false; iconStatus.textContent='';
    if (iconChoice.value.startsWith('builtin:')) preview.src=builtinIcon(iconChoice.value.slice(8));
    else if(custom && iconDraft?.url===imageUrl.value.trim()) preview.src=iconDraft.data;
    else if(custom) { preview.hidden=true;preview.removeAttribute('src'); }
    else {
      const item = rendered && [...rendered.settings.custom,...rendered.settings.overrides].find(item=>item.id===editing);
      if(item) setSearchEngineIcon(preview,configuredEngine({...item,icon:undefined}));
      else {
        const original = presetForEngine(editing);
        setSearchEngineIcon(preview,original ? configuredEngine({...original,id:editing}) : editingNative);
      }
    }
  }
  let editingNative;
  function resetIconDraft() { changeDraft();iconDraft=undefined;imageUrl.value='';iconChoice.value='default';updateIconPreview(); }
  iconChoice.addEventListener('change',()=>{changeDraft();updateIconPreview();});
  imageUrl.addEventListener('input',()=>{changeDraft();updateIconPreview();});
  name.addEventListener('input',changeDraft);url.addEventListener('input',changeDraft);
  resetIcon.addEventListener('click',resetIconDraft);
  async function downloadPreview() {
    cancelPreview();
    const token=draftRevision, controller=new AbortController();previewController=controller;
    add.disabled=true;
    iconStatus.textContent='Loading icon…';
    try {
      const icon=await fetchCustomIcon(imageUrl.value,controller.signal);
      if(disposed || !dialog.isConnected || token!==draftRevision || controller.signal.aborted) return null;
      iconDraft=icon;imageUrl.value=icon.url;updateIconPreview();iconStatus.textContent='Preview ready. Save engine to keep it.';
      return icon;
    } catch(problem) {
      if(!disposed && token===draftRevision && !controller.signal.aborted) iconStatus.textContent=problem.message;
      throw problem;
    } finally { if(previewController===controller) {previewController=null;add.disabled=saving || !!rendered?.error;} }
  }
  load.addEventListener('click',()=>{void downloadPreview().catch(()=>{});});
  const dragType = 'application/x-ses-engine-reorder';
  function clearDropIndicator() {
    for (const row of list.querySelectorAll('[data-ses-drop]')) delete row.dataset.sesDrop;
  }
  function cancelDrag() {
    dragging = null; clearDropIndicator();
    for (const row of list.querySelectorAll('.ses-reordering')) row.classList.remove('ses-reordering');
  }
  const onDragKey = event => { if (event.key === 'Escape') cancelDrag(); };
  document.addEventListener('keydown', onDragKey, true);
  document.addEventListener('dragend', cancelDrag);
  document.addEventListener('drop', cancelDrag);
  list.addEventListener('dragleave', event => { if (!list.contains(event.relatedTarget)) clearDropIndicator(); });
  function clearEdit() { editing = null; editingNative=undefined;editRaw = undefined; name.value = ''; url.value = ''; add.textContent = 'Add engine'; cancel.hidden = true; resetIconDraft(); }
  cancel.addEventListener('click', clearEdit);
  async function render() {
    cancelDrag();
    const currentRevision = ++revision;
    const state = readEngineSettings();
    let engines;
    try { engines = await getVisibleEngines(); }
    catch { if (dialog.isConnected) error.textContent = 'Could not load Zen’s search engines. Close and try again.'; return; }
    if (!dialog.isConnected || currentRevision !== revision) return;
    rendered = state;
    error.textContent = state.error; reset.hidden = !state.error;
    add.disabled = !!state.error || saving || !!previewController;
    list.replaceChildren();
    removedList.replaceChildren();
    const { settings } = state;
    const mutate = change => {
      try {
        const next = JSON.parse(JSON.stringify(settings)); change(next);
        saveEngineSettings(next, state.raw); render();
      } catch (problem) { error.textContent = problem.message; }
    };
    const ordered = orderedEngines(engines, settings);
    const active = ordered.filter(engine => !settings.removed.includes(engineKey(engine)));
    const hiddenEngines = ordered.filter(engine => settings.removed.includes(engineKey(engine)));
    removed.hidden = !hiddenEngines.length;
    removedSummary.textContent = `Removed engines (${hiddenEngines.length})`;
    for (const engine of hiddenEngines) {
      const key = engineKey(engine);
      const row = element('div'); row.className = 'ses-manager-row'; row.dataset.sesEngine = key;
      const restore = element('button', 'Restore'); restore.type = 'button'; restore.disabled = !!state.error;
      restore.dataset.sesAction = 'restore-native'; restore.setAttribute('aria-label', `Restore ${engine.name}`);
      restore.addEventListener('click', () => mutate(next => { next.hidden = next.hidden.filter(id => id !== key); next.removed = next.removed.filter(id => id !== key); }));
      row.append(element('span', engine.name), restore); removedList.append(row);
    }
    for (const [index, engine] of active.entries()) {
      const row = element('div'); row.className = 'ses-manager-row';
      const key = engineKey(engine), native = key.startsWith('native:'); row.dataset.sesEngine = key;
      const handle = element('span', '⠿'); handle.className = 'ses-reorder-handle';
      handle.draggable = !state.error; handle.title = `Drag to reorder ${engine.name}`;
      handle.setAttribute('aria-hidden', 'true'); row.append(handle);
      handle.addEventListener('dragstart', event => {
        cancelDrag();
        if (state.error || !event.dataTransfer || !row.isConnected || currentRevision !== revision) { event.preventDefault(); return; }
        const token = crypto.randomUUID();
        event.dataTransfer.setData(dragType, token); event.dataTransfer.effectAllowed = 'move';
        dragging = { key, token, revision: currentRevision }; row.classList.add('ses-reordering');
      });
      const internalDrag = event => dragging?.revision === currentRevision && currentRevision === revision && row.isConnected &&
        event.dataTransfer && !event.dataTransfer.files?.length && Array.from(event.dataTransfer.types || []).includes(dragType);
      const dropSide = event => {
        const bounds = row.getBoundingClientRect();
        return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
      };
      row.addEventListener('dragover', event => {
        clearDropIndicator();
        if (!internalDrag(event) || dragging.key === key) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.dataset.sesDrop = dropSide(event);
      });
      row.addEventListener('drop', event => {
        const source = dragging?.key;
        const valid = internalDrag(event) && event.dataTransfer.getData(dragType) === dragging.token;
        const side = dropSide(event); cancelDrag();
        if (!valid || source === key) return;
        event.preventDefault();
        const activeIds = active.map(engineKey), reordered = activeIds.filter(id => id !== source);
        reordered.splice(reordered.indexOf(key) + (side === 'after' ? 1 : 0), 0, source);
        if (reordered.every((id, position) => id === activeIds[position])) return;
        mutate(next => {
          // Retain removed engines' slots so restoring one preserves its position.
          let position = 0;
          const ids = ordered.map(engineKey).map(id => settings.removed.includes(id) ? id : reordered[position++]);
          next.order = [...ids, ...next.order.filter(id => !ids.includes(id))];
        });
      });
      const label = element('label'); label.className = 'ses-manager-label';
      {
        const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.disabled = !!state.error;
        checkbox.checked = !settings.hidden.includes(key); checkbox.setAttribute('aria-label', `Show ${engine.name} in selector`);
        checkbox.addEventListener('change', () => mutate(next => {
          next.hidden = next.hidden.filter(id => id !== key);
          if (!checkbox.checked) next.hidden.push(key);
        }));
        label.append(checkbox);
      }
      label.append(element('span', engine.name)); row.append(label);
      const actions = element('div'); actions.className = 'ses-manager-actions'; row.append(actions);
      const button = (text, action, callback) => {
        const control = element('button', text); control.type = 'button'; control.dataset.sesAction = action;
        control.disabled = !!state.error; control.setAttribute('aria-label', `${text} ${engine.name}`);
        control.addEventListener('click', callback); actions.append(control); return control;
      };
      for (const [action, text, delta] of [['up', 'Move up', -1], ['down', 'Move down', 1]]) {
        const control = button(text, action, () => mutate(next => {
          const ids = ordered.map(engineKey), current = ids.indexOf(key), target = ids.indexOf(engineKey(active[index + delta]));
          [ids[current], ids[target]] = [ids[target], ids[current]];
          next.order = [...ids, ...next.order.filter(id => !ids.includes(id))];
        }));
        control.disabled ||= index + delta < 0 || index + delta >= active.length;
      }
      button('Edit', 'edit', () => {
        changeDraft();editingNative=engine;
        editing = key; editRaw = state.raw; name.value = engine.name; url.value = engineTemplate(engine);
        iconDraft=[...settings.custom,...settings.overrides].find(item=>item.id===key)?.icon;
        iconChoice.value=iconDraft?.kind==='builtin'?`builtin:${iconDraft.name}`:iconDraft?.kind==='url'?'url':'default';
        imageUrl.value=iconDraft?.kind==='url'?iconDraft.url:'';updateIconPreview();
        add.textContent = 'Save engine'; cancel.hidden = false; name.focus();
      });
      button('Remove', native ? 'remove-native' : 'remove-custom', () => mutate(next => {
        if (native || presetForEngine(key)) {
          next.removed = [...next.removed.filter(id => id !== key), key];
          next.hidden = next.hidden.filter(id => id !== key);
          next.hidden.push(key);
        } else {
          // A manually added equivalent may have suppressed a shipped default.
          // Removing it must not immediately make that default reappear.
          for (const item of SES_PRESETS) if (item.name.toLowerCase() === engine.name.toLowerCase() || item.url === engineTemplate(engine)) {
            const defaultId = `custom-preset-${item.id}`;
            if (!next.removed.includes(defaultId)) next.removed.push(defaultId);
            if (!next.hidden.includes(defaultId)) next.hidden.push(defaultId);
          }
          next.custom = next.custom.filter(item => item.id !== key);
          next.hidden = next.hidden.filter(id => id !== key);
          next.order = next.order.filter(id => id !== key);
        }
        if (editing === key) clearEdit();
      }));
      list.append(row);
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if(saving || previewController) return;
    const token=draftRevision;
    saving=true;add.disabled=true;
    try {
      if (!rendered || rendered.error) throw new Error('Reset the invalid settings before adding engines.');
      if (!editing && rendered.settings.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      // Capture the revision before a network wait; a late download must never
      // overwrite another window's changes or a newly opened editor.
      const expectedRaw=editing?editRaw:rendered.raw;
      const next = JSON.parse(JSON.stringify(rendered.settings));
      const engine = validateCustomEngine({ id: editing || `custom-${crypto.randomUUID()}`, name: name.value, url: url.value });
      if(iconChoice.value.startsWith('builtin:')) engine.icon={kind:'builtin',name:iconChoice.value.slice(8)};
      else if(iconChoice.value==='url') {
        engine.icon=iconDraft?.url===iconUrl(imageUrl.value)?iconDraft:await downloadPreview();
        if(disposed || token!==draftRevision || !engine.icon) return;
      }
      const native = engine.id.startsWith('native:');
      if (!native && rendered.settings.custom.some(item => item.id !== editing && item.name.toLowerCase() === engine.name.toLowerCase())) throw new Error('A custom engine with that name already exists.');
      const collection = native ? 'overrides' : 'custom';
      const existing = next[collection].findIndex(item => item.id === engine.id);
      if (collection === 'custom' && existing < 0 && next.custom.length >= 100) throw new Error('The selector supports up to 100 custom engines.');
      if (existing < 0) next[collection].push(engine);
      else next[collection][existing] = engine;
      saveEngineSettings(next, expectedRaw); clearEdit(); render();
    } catch (problem) { if(!disposed && token===draftRevision) error.textContent = problem.message; }
    finally {saving=false;add.disabled=!!rendered?.error;}
  });
  reset.addEventListener('click', () => {
    if (!rendered?.error) return;
    try {
      if (Services.prefs.getStringPref(ENGINE_SETTINGS_PREF, '') !== rendered.raw) throw new Error('Settings changed in another window. Close and reopen Configure.');
      Services.prefs.setStringPref(`${ENGINE_SETTINGS_PREF}-backup`, rendered.raw);
      saveEngineSettings(emptyEngineSettings(), rendered.raw); render();
    } catch (problem) { error.textContent = problem.message; }
  });
  dialog.append(heading, intro, list, removed, error, form, reset);
  container.append(dialog); render();
  return {element:dialog,refresh:render,reset(){clearEdit();removed.open=false;render();},destroy(){
    disposed=true;changeDraft();++revision;cancelDrag();document.removeEventListener('keydown',onDragKey,true);
    document.removeEventListener('dragend',cancelDrag);document.removeEventListener('drop',cancelDrag);dialog.remove();
  }};
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
    if (next === container && controls?.element.isConnected) {
      // Sine appends its own preferences asynchronously after building the card.
      if (container.lastElementChild !== controls.element) container.append(controls.element);
      return;
    }
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
      this._container.style.display = "flex", this.updateSelectedEngineDisplay(), this.handleSplitOrGlance();
    },
    _hide() {
      if (!this._container)
        return;
      if (this._container.style.display = "none", this._engineOptions)
        this.hideOptionsOnClickOutside();
    },
    updateSelectedEngineDisplay() {
      if (!this._currentSearchInfo || !this._engineSelect)
        return;
      let { engine, host } = this._currentSearchInfo, img = parseElement("<img>");
      setSearchEngineIcon(img, engine);
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
      }, this._boundListeners.handleTabSelect = this.handleTabSelect.bind(this), this._boundListeners.toggleOptions = this.toggleOptions.bind(this), this._boundListeners.hideOptionsOnClickOutside = this.hideOptionsOnClickOutside.bind(this), this._boundListeners.startDrag = this.startDrag.bind(this), this._boundListeners.doDrag = this.doDrag.bind(this), this._boundListeners.stopDrag = this.stopDrag.bind(this), this._boundListeners.onSplitViewActivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onSplitViewDeactivated = this.handleSplitOrGlance.bind(this), this._boundListeners.onCompactModeToggled = this.updatePosition.bind(this), this._boundListeners.onResize = this.updatePosition.bind(this), this._boundListeners.onTabClose = () => {
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
  // exact root ID; observe late injection as well as roots already in the DOM.
  let rootObserver;
  if (!isSettingsPage) {
    const removeOrphans = scope => {
      const roots = [...scope.querySelectorAll('#search-engine-switcher-container')];
      if (scope.id === 'search-engine-switcher-container') roots.unshift(scope);
      for (const root of roots) {
        if (root !== SearchEngineSwitcher._container) root.remove();
      }
    };
    rootObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) removeOrphans(node);
      }
    });
    rootObserver.observe(document.documentElement, {childList: true, subtree: true});
    removeOrphans(document);
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
