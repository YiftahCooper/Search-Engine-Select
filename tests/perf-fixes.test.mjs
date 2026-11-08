// 1.3.4 targeted fixes (audit P1-P5). Each case fails on the 1.3.3 runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { harness, enabled, tick, engine } from './harness.mjs';

const yCoor = 'extension.search-engine-select.y-coor';
const settle = async () => { await tick(); await tick(); };
const engines = () => [engine('DuckDuckGo', 'https://duckduckgo.com'), engine('Google', 'https://www.google.com')];
const container = h => h.document.querySelector('#search-engine-switcher-container');
// Deterministic timers: the runtime resolves setTimeout from the window at call time.
function fakeTimers(w) {
  const timers = new Map(); let id = 0;
  w.setTimeout = (fn, ms) => { timers.set(++id, {fn, ms}); return id; };
  w.clearTimeout = handle => { timers.delete(handle); };
  return timers;
}
async function runNext(timers) {
  const [[id, {fn, ms}]] = timers; timers.delete(id); fn(); await settle(); return ms;
}
const selectTab = (h, spec) => { h.w.gBrowser.selectedBrowser.currentURI.spec = spec; h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabSelect')); };
const setHeight = (w, value) => Object.defineProperty(w, 'innerHeight', {value, configurable: true, writable: true});
function stubGeometry(w) {
  // jsdom has no layout: give the selector a height and a top that follows style.top.
  Object.defineProperty(w.HTMLElement.prototype, 'offsetHeight', {configurable: true, get() { return this.id === 'search-engine-switcher-container' ? 40 : 0; }});
  Object.defineProperty(w.HTMLElement.prototype, 'offsetTop', {configurable: true, get() { return this.id === 'search-engine-switcher-container' ? parseFloat(this.style.top) || 0 : 0; }});
}

// P1
test('legacy-root observer watches only direct children of <html>, never the whole chrome subtree', async t => {
  const options = []; let callbacks = 0;
  const h = await harness({beforeEvaluate(w) {
    w.MutationObserver = class extends w.MutationObserver {
      constructor(fn) { super((records, observer) => { callbacks++; fn(records, observer); }); }
      observe(target, init) { options.push(init); return super.observe(target, init); }
    };
  }}); t.after(() => h.close());
  assert.ok(options.length >= 1);
  for (const init of options) assert.notEqual(init.subtree, true);
  // Ordinary chrome DOM churn (tab strip, urlbar rows, other mods) is not observed.
  // (The selector's own append to <html> during startup is.)
  await tick(); callbacks = 0;
  for (let i = 0; i < 20; i++) { const row = h.document.createElement('div'); h.document.body.append(row); row.append(h.document.createElement('span')); }
  await tick();
  assert.equal(callbacks, 0);
  // Late legacy roots at the upstream insertion point are still reclaimed.
  const owned = container(h), legacy = h.document.createElement('div'); legacy.id = 'search-engine-switcher-container';
  h.document.documentElement.append(legacy); await tick();
  assert.equal(h.roots().length, 1); assert.equal(h.roots()[0], owned);
});

// P2
test('failed startup (search service not ready or import failure) is retried after a delay and recovers', async t => {
  for (const failure of ['engines', 'import']) {
    let timers, calls = 0;
    const h = await harness({
      getEngines: async () => { if (failure === 'engines' && calls++ === 0) throw new Error('not ready'); return engines(); },
      beforeEvaluate(w) {
        timers = fakeTimers(w);
        if (failure === 'import') { const load = w.ChromeUtils.importESModule; let first = true; w.ChromeUtils.importESModule = (...args) => { if (first) { first = false; throw new Error('moved'); } return load(...args); }; }
      }
    }); t.after(() => h.close());
    assert.equal(h.roots().length, 0, failure); assert.equal(h.progress.size, 0, failure);
    assert.equal(timers.size, 1, `${failure}: one pending retry, no busy loop`);
    assert.ok([...timers.values()][0].ms >= 1000, `${failure}: retry is delayed`);
    await runNext(timers);
    assert.equal(h.roots().length, 1, failure); assert.equal(h.progress.size, 1, failure);
    assert.match(h.document.querySelector('#ses-engine-select').textContent, /DuckDuckGo/);
  }
});
test('permanent startup failure stops after a bounded backoff; an engine change still recovers it', async t => {
  let timers, ready = false, attempts = 0;
  const h = await harness({getEngines: async () => { attempts++; if (!ready) throw new Error('not ready'); return engines(); }, beforeEvaluate(w) { timers = fakeTimers(w); }});
  t.after(() => h.close());
  const delays = [];
  while (timers.size && delays.length < 50) delays.push(await runNext(timers));
  assert.ok(delays.length >= 1 && delays.length <= 6, `bounded retries: ${delays.length}`);
  for (let i = 1; i < delays.length; i++) assert.ok(delays[i] > delays[i - 1], 'backoff grows');
  assert.equal(attempts, delays.length + 1); assert.equal(timers.size, 0); assert.equal(h.roots().length, 0);
  ready = true;
  for (const observer of h.observers.get('browser-search-engine-modified')) observer.observe();
  await settle();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1);
});
test('disabling cancels a pending startup retry and re-enabling starts fresh', async t => {
  let timers, calls = 0;
  const h = await harness({getEngines: async () => { if (calls++ === 0) throw new Error('not ready'); return engines(); }, beforeEvaluate(w) { timers = fakeTimers(w); }});
  t.after(() => h.close());
  assert.equal(timers.size, 1);
  h.put(enabled, false); assert.equal(timers.size, 0); await settle(); assert.equal(h.roots().length, 0);
  h.put(enabled, true); await settle();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1); assert.equal(timers.size, 0);
});

// P3
test('hidden selector does no split-view layout reads on tab switch, resize, observers or tab close', async t => {
  let reads = 0;
  const h = await harness({beforeEvaluate(w) {
    w.gZenViewSplitter = {currentView: 0, _data: [{gridType: 'vsep'}]};
    w.gBrowser.selectedBrowser.getBoundingClientRect = () => { reads++; return {x: 300, width: 500}; };
  }}); t.after(() => h.close());
  const root = container(h);
  assert.equal(root.style.display, 'flex'); assert.ok(root.classList.contains('in-split-view'));
  assert.equal(root.style.getPropertyValue('--ses-pane-x'), '300px');
  reads = 0;
  selectTab(h, 'https://example.org/');
  assert.equal(root.style.display, 'none');
  h.w.dispatchEvent(new h.w.Event('resize'));
  for (const observer of h.resize) observer.fn();
  h.w.dispatchEvent(new h.w.Event('ZenViewSplitter:SplitViewActivated'));
  h.w.dispatchEvent(new h.w.Event('ZenCompactMode:Toggled'));
  h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabClose'));
  assert.equal(reads, 0, 'no getBoundingClientRect while hidden');
  selectTab(h, 'https://www.google.com/?q=back');
  assert.equal(root.style.display, 'flex'); assert.equal(reads, 1, 'one layout read when a search tab is selected');
  assert.equal(root.style.getPropertyValue('--ses-pane-x'), '300px');
});
test('document clicks while the engine menu is closed write nothing; an open menu still closes', async t => {
  const h = await harness(); t.after(() => h.close());
  const root = container(h), select = h.document.querySelector('#ses-engine-select'), options = h.document.querySelector('#ses-engine-options');
  const records = []; const observer = new h.w.MutationObserver(list => records.push(...list));
  observer.observe(root, {attributes: true, subtree: true});
  for (let i = 0; i < 5; i++) h.document.body.click();
  await tick(); assert.deepEqual(records.map(r => r.attributeName), []);
  select.click(); assert.equal(options.style.display, 'block'); assert.equal(select.getAttribute('aria-expanded'), 'true');
  h.document.body.click();
  assert.equal(options.style.display, 'none'); assert.equal(select.getAttribute('aria-expanded'), 'false'); assert.ok(!root.classList.contains('options-visible'));
  observer.disconnect();
});
test('switching tabs closes an open engine menu and keeps the selector on search tabs', async t => {
  const h = await harness(); t.after(() => h.close());
  const select = h.document.querySelector('#ses-engine-select'), options = h.document.querySelector('#ses-engine-options');
  select.click(); assert.equal(options.style.display, 'block');
  selectTab(h, 'https://www.google.com/?q=next');
  assert.equal(options.style.display, 'none'); assert.equal(select.getAttribute('aria-expanded'), 'false');
  assert.equal(container(h).style.display, 'flex'); assert.match(select.textContent, /Google/);
});
test('a burst of tab closes leaves a single delayed reposition timer', async t => {
  let timers, reads = 0;
  const h = await harness({beforeEvaluate(w) {
    timers = fakeTimers(w);
    w.gZenViewSplitter = {currentView: 0, _data: [{gridType: 'vsep'}]};
    w.gBrowser.selectedBrowser.getBoundingClientRect = () => { reads++; return {x: 120, width: 400}; };
  }}); t.after(() => h.close());
  assert.equal(timers.size, 0);
  for (let i = 0; i < 50; i++) h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabClose'));
  assert.equal(timers.size, 1); assert.equal([...timers.values()][0].ms, 500);
  reads = 0; await runNext(timers);
  assert.equal(reads, 1); assert.equal(container(h).style.getPropertyValue('--ses-pane-x'), '120px');
  h.unload(); assert.equal(timers.size, 0);
});

// P4
test('Configure is not auto-opened from the retired deep-link parameter', async t => {
  let clicks = 0;
  const h = await harness({settings: true, settingsUrl: 'about:preferences?searchEngineSelectSettings=1#sineMods', beforeEvaluate(w) {
    w.document.querySelector('.sineItemConfigureButton').addEventListener('click', () => clicks++);
  }}); t.after(() => h.close());
  assert.ok(h.document.querySelector('#ses-engine-manager'));
  assert.equal(clicks, 0); assert.equal(h.document.documentElement.hasAttribute('data-ses-settings-shown'), false);
});
test('unreachable upstream utilities are absent from the runtime', async () => {
  const source = await readFile(new URL('../search-engine-select-runtime.uc.js', import.meta.url), 'utf8');
  for (const dead of ['parseXULToFragment', 'splitTabs', '"incognito"', '"new window"', 'Unknown search', 'searchEngineSelectSettings', 'data-ses-settings-shown', 'static set debugMode', 'static set enabled', 'static set rememberPosition'])
    assert.ok(!source.includes(dead), dead);
});
test('Alt-click opens Glance; without a Glance manager it falls back to a foreground tab', async t => {
  const h = await harness(); t.after(() => h.close());
  const google = () => [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.includes('Google'));
  const altClick = async () => { google().dispatchEvent(new h.w.MouseEvent('mousedown', {button: 0, altKey: true, bubbles: true})); await settle(); };
  const glances = [];
  h.w.Services.scriptSecurityManager = {getSystemPrincipal: () => 'system'};
  h.w.gZenGlanceManager = {openGlance: args => glances.push(args)};
  await altClick();
  assert.equal(glances.length, 1); assert.equal(glances[0].url, 'https://www.google.com/?q=hello'); assert.equal(h.navigations.length, 0);
  delete h.w.gZenGlanceManager;
  await altClick();
  assert.deepEqual(h.navigations.at(-1), ['https://www.google.com/?q=hello', 'tab']);
});

// P5
test('saved position is applied as a style value, never interpolated into markup', async t => {
  const h = await harness({prefs: {[yCoor]: '60%;" onmouseover="alert(1)'}}); t.after(() => h.close());
  assert.equal(h.document.querySelectorAll('[onmouseover]').length, 0);
  assert.equal(container(h).style.top, '60%');
});
test('saved position is clamped to the visible window on restore, resize and reappearance', async t => {
  const h = await harness({prefs: {[yCoor]: '5000px'}, beforeEvaluate: stubGeometry}); t.after(() => h.close());
  const root = container(h);
  assert.equal(h.w.innerHeight, 768); assert.equal(root.style.top, '718px');
  setHeight(h.w, 400); h.w.dispatchEvent(new h.w.Event('resize')); assert.equal(root.style.top, '350px');
  setHeight(h.w, 2000); h.w.dispatchEvent(new h.w.Event('resize')); assert.equal(root.style.top, '1950px', 'returns toward the saved position');
  assert.equal(h.prefs.get(yCoor), '5000px', 'clamping never rewrites the saved preference');
  selectTab(h, 'https://example.org/');
  setHeight(h.w, 400); h.w.dispatchEvent(new h.w.Event('resize')); assert.equal(root.style.top, '1950px', 'no writes while hidden');
  selectTab(h, 'https://duckduckgo.com/?q=again'); assert.equal(root.style.top, '350px');
});
test('a drag becomes the session position used by later clamps and is saved', async t => {
  const h = await harness({prefs: {[yCoor]: '200px'}, beforeEvaluate: stubGeometry}); t.after(() => h.close());
  const root = container(h), handle = h.document.querySelector('#ses-drag-handle');
  assert.equal(root.style.top, '200px');
  handle.dispatchEvent(new h.w.MouseEvent('mousedown', {button: 0, clientY: 100, bubbles: true}));
  h.document.dispatchEvent(new h.w.MouseEvent('mousemove', {clientY: 150, bubbles: true}));
  h.document.dispatchEvent(new h.w.MouseEvent('mouseup', {clientY: 150, bubbles: true}));
  assert.equal(root.style.top, '250px'); assert.equal(h.prefs.get(yCoor), '250px');
  h.w.dispatchEvent(new h.w.Event('resize')); assert.equal(root.style.top, '250px');
});
