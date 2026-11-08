import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, tick, engine } from './harness.mjs';

const settle = async () => { await tick(); await tick(); };
const row = (h, id) => h.document.querySelector(`[data-ses-engine="${id}"]`);

test('an engine draft can be saved after reordering in the same Configure window', async t => {
  const h = await harness({ settings: true }); t.after(() => h.close());
  row(h, 'native:Google').querySelector('[data-ses-action="edit"]').click();
  h.document.querySelector('[name="ses-name"]').value = 'My Google';
  row(h, 'native:Google').querySelector('[data-ses-action="up"]').click(); await settle();
  h.document.querySelector('[data-ses-action="add"]').click(); await settle();

  const saved = JSON.parse(h.prefs.get(config));
  assert.equal(saved.overrides[0]?.name, 'My Google');
  assert.equal(saved.order[0], 'native:Google');
  assert.equal(h.document.querySelector('[data-ses-error]').textContent, '');
});

test('an engine draft can be saved after deselecting another engine in the same window', async t => {
  const h = await harness({ settings: true }); t.after(() => h.close());
  row(h, 'custom-preset-youtube').querySelector('[data-ses-action="edit"]').click();
  h.document.querySelector('[name="ses-name"]').value = 'Videos';
  const checkbox = row(h, 'custom-preset-reddit').querySelector('input[type="checkbox"]');
  checkbox.checked = false; checkbox.dispatchEvent(new h.w.Event('change')); await settle();
  h.document.querySelector('[data-ses-action="add"]').click(); await settle();

  const saved = JSON.parse(h.prefs.get(config));
  assert.equal(saved.custom[0]?.name, 'Videos');
  assert.deepEqual(saved.hidden, ['custom-preset-reddit']);
  assert.equal(h.document.querySelector('[data-ses-error]').textContent, '');
});

test('saving before a list refresh finishes retains this window\'s own selection change', async t => {
  const engines = [engine('DuckDuckGo', 'https://duckduckgo.com'), engine('Google', 'https://www.google.com')];
  let delay = false, resolve;
  const pending = new Promise(done => { resolve = done; });
  const h = await harness({ settings: true, getEngines: () => delay ? pending : Promise.resolve(engines) });
  t.after(() => { resolve(engines); h.close(); });
  row(h, 'custom-preset-youtube').querySelector('[data-ses-action="edit"]').click();
  h.document.querySelector('[name="ses-name"]').value = 'Videos';
  delay = true;
  const checkbox = row(h, 'custom-preset-reddit').querySelector('input[type="checkbox"]');
  checkbox.checked = false; checkbox.dispatchEvent(new h.w.Event('change'));
  h.document.querySelector('[data-ses-action="add"]').click(); await settle();

  const saved = JSON.parse(h.prefs.get(config));
  assert.equal(saved.custom[0]?.name, 'Videos');
  assert.deepEqual(saved.hidden, ['custom-preset-reddit']);
});

test('a stale draft is still rejected after a refreshed window changes its own list', async t => {
  const h = await harness({ settings: true }); t.after(() => h.close());
  row(h, 'native:Google').querySelector('[data-ses-action="edit"]').click();
  h.document.querySelector('[name="ses-name"]').value = 'Stale Google';
  const incoming = JSON.stringify({ version: 4, removed: [], hidden: [], custom: [],
    order: [], overrides: [{ id: 'native:Google', name: 'New Google', url: 'https://www.google.com/?q={searchTerms}' }] });
  h.put(config, incoming);
  for (const observer of h.observers.get('browser-search-engine-modified')) observer.observe();
  await settle();
  const checkbox = row(h, 'custom-preset-reddit').querySelector('input[type="checkbox"]');
  checkbox.checked = false; checkbox.dispatchEvent(new h.w.Event('change')); await settle();
  const current = h.prefs.get(config);
  h.document.querySelector('[data-ses-action="add"]').click(); await settle();

  assert.equal(h.prefs.get(config), current);
  assert.equal(JSON.parse(current).overrides[0].name, 'New Google');
  assert.match(h.document.querySelector('[data-ses-error]').textContent, /another window/);
});
