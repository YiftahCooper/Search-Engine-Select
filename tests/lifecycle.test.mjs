import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, enabled, tick, engine } from './harness.mjs';

test('repeated enabled notifications keep one control and listener set', async t => {
  const h = await harness(); t.after(() => h.close());
  h.put(enabled, true); h.put(enabled, true); await tick(); await tick();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1); assert.equal(h.resize.size, 1);
});
test('evaluating the script twice replaces the previous owner cleanly', async t => {
  const h = await harness(); t.after(() => h.close()); const count = h.observerCount();
  h.evaluate(); await tick(); await tick();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1); assert.equal(h.observerCount(), count);
});
test('disable during search service startup cannot resurrect the control', async t => {
  let resolve; const wait = new Promise(r => resolve = r);
  const h = await harness({ getEngines: () => wait }); t.after(() => h.close());
  h.put(enabled, false); resolve([engine('DuckDuckGo', 'https://duckduckgo.com')]); await tick(); await tick();
  assert.equal(h.roots().length, 0); assert.equal(h.progress.size, 0);
});
test('disable then re-enable while startup is pending creates only one control', async t => {
  let resolve; const wait = new Promise(r => resolve = r);
  const h = await harness({ getEngines: () => wait }); t.after(() => h.close());
  h.put(enabled, false); h.put(enabled, true); resolve([engine('DuckDuckGo', 'https://duckduckgo.com')]); await tick(); await tick();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1);
});
test('unload releases controls, preferences, navigation and resize observers', async t => {
  const h = await harness(); t.after(() => h.close()); h.unload();
  assert.equal(h.roots().length, 0); assert.equal(h.progress.size, 0); assert.equal(h.resize.size, 0); assert.equal(h.observerCount(), 0);
  h.put(enabled, true); await tick(); assert.equal(h.roots().length, 0);
});
test('reload before window load leaves only one startup callback', async t => {
  const h = await harness({ state: 'loading' }); t.after(() => h.close());
  h.evaluate(); h.w.dispatchEvent(new h.w.Event('load')); await tick(); await tick();
  assert.equal(h.roots().length, 1); assert.equal(h.progress.size, 1);
});
test('a delayed URL-bar engine lookup cannot overwrite the re-enabled selector search', async t => {
  const h = await harness(); t.after(() => h.close());
  let resolve;
  h.w.Services.search.getDefault = () => new Promise(r => resolve = r);
  h.w.gURLBar.value = 'OLD SEARCH';
  h.w.gURLBar.inputField.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Enter' }));
  await tick();
  h.put(enabled, false);
  h.w.gBrowser.selectedBrowser.currentURI.spec = 'https://www.google.com/?q=NEW%20SEARCH';
  h.put(enabled, true); await tick(); await tick();
  resolve(engine('DuckDuckGo', 'https://duckduckgo.com')); await tick(); await tick();
  assert.match(h.document.querySelector('#ses-engine-select').textContent, /Google/);
  const duck = [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.includes('DuckDuckGo'));
  duck.click(); await tick();
  assert.equal(h.navigations[0][0], 'https://duckduckgo.com/?q=NEW%20SEARCH');
});
