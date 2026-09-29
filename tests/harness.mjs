import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

export const enabled = 'extension.search-engine-select.enabled';
export const config = 'extension.search-engine-select.engines';
export const tick = () => new Promise(resolve => setImmediate(resolve));
export function engine(name, origin, id = name) {
  return { id, name, iconURI: { spec: 'chrome://browser/skin/search-glass.svg' },
    getSubmission: term => ({ uri: { spec: `${origin}/?q=${encodeURIComponent(term)}` }, postData: null }) };
}
export async function harness({ prefs: initial = {}, getEngines, sourcePath, state = 'complete', settings = false, services } = {}) {
  const source = await readFile(new URL(sourcePath || '../search-engine-select.uc.js', import.meta.url), 'utf8');
  const dom = new JSDOM('<!doctype html><html><body><input id="urlbar"></body></html>', { runScripts: 'outside-only', url: 'https://browser.invalid/' });
  const w = dom.window, prefs = new Map(Object.entries(initial)), observers = new Map(), progress = new Set(), resize = new Set(), unloaders = new Set(), navigations = [];
  w.HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  Object.defineProperty(w.document, 'readyState', { configurable: true, value: state });
  const observerService = {
    addObserver(name, listener) { if (!observers.has(name)) observers.set(name, new Set()); observers.get(name).add(listener); },
    removeObserver(name, listener) { observers.get(name)?.delete(listener); }
  };
  function put(name, value) {
    prefs.set(name, value);
    for (const [prefix, listeners] of observers) if (name.startsWith(prefix)) for (const fn of [...listeners]) typeof fn === 'function' ? fn(null, 'nsPref:changed', name) : fn.observe(null, 'nsPref:changed', name);
  }
  const defaults = [engine('DuckDuckGo', 'https://duckduckgo.com'), engine('Google', 'https://www.google.com')];
  const search = { getVisibleEngines: getEngines || (async () => defaults), getEngineByName: name => defaults.find(e => e.name === name), getDefault: () => defaults[0] };
  w.Services = services || { prefs: {
    PREF_STRING: 32, PREF_INT: 64, PREF_BOOL: 128,
    getPrefType(name) { return { string: 32, number: 64, boolean: 128 }[typeof prefs.get(name)] || 0; },
    getStringPref: (n, d) => prefs.has(n) ? prefs.get(n) : d,
    getBoolPref: (n, d) => prefs.has(n) ? prefs.get(n) : d,
    getIntPref: (n, d) => prefs.has(n) ? prefs.get(n) : d,
    setStringPref: put, setBoolPref: put, setIntPref: put, ...observerService
  }, obs: {
    addObserver: (listener, topic) => observerService.addObserver(topic, listener),
    removeObserver: (listener, topic) => observerService.removeObserver(topic, listener)
  }, search };
  w.ChromeUtils = { importESModule: () => ({ SearchService: search }), generateQI: () => function() {} };
  w.ResizeObserver = class { constructor(fn) { this.fn = fn; } observe() { resize.add(this); } disconnect() { resize.delete(this); } };
  const tabContainer = new w.EventTarget();
  w.gBrowser = { selectedBrowser: { currentURI: { spec: 'https://duckduckgo.com/?q=hello' } }, selectedTab: w.document.createElement('tab'), tabContainer,
    addTabsProgressListener: p => progress.add(p), removeTabsProgressListener: p => progress.delete(p) };
  w.gURLBar = { inputField: w.document.querySelector('input'), value: '' };
  w.openTrustedLinkIn = (...args) => navigations.push(args);
  w.addUnloadListener = callback => unloaders.add(callback);
  function evaluate() { w.eval(source); }
  function unload() { for (const fn of [...unloaders]) fn(); unloaders.clear(); }
  if (settings) { dom.reconfigure({url:'about:preferences#sineMods'}); w.document.body.innerHTML='<section mod-id="search-engine-select"><button class="sineItemConfigureButton">Configure</button><dialog><div class="sineItemPreferenceDialogContent"></div></dialog></section>'; delete w.gBrowser; delete w.gURLBar; }
  evaluate(); await tick(); await tick();
  return { w, document: w.document, prefs, observers, progress, resize, navigations, put, evaluate, unload,
    close() { unload(); w.close(); }, roots: () => w.document.querySelectorAll('#search-engine-switcher-container'),
    options: () => [...w.document.querySelectorAll('.ses-engine-option span')].map(x => x.textContent),
    observerCount: () => [...observers.values()].reduce((n, set) => n + set.size, 0) };
}
