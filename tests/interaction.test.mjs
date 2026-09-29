import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, enabled, tick, engine } from './harness.mjs';

test('selector and engine options support keyboard activation and Escape restores focus', async t => {
  const h = await harness(); t.after(() => h.close());
  const select = h.document.querySelector('#ses-engine-select');
  assert.equal(select.tagName, 'BUTTON'); select.focus(); select.click();
  assert.equal(select.getAttribute('aria-expanded'), 'true');
  const options = h.document.querySelector('#ses-engine-options');
  options.dispatchEvent(new h.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(options.style.display, 'none'); assert.equal(h.document.activeElement, select);
  select.click();
  const google = [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.includes('Google'));
  assert.equal(google.tagName, 'BUTTON'); google.click(); await tick();
  assert.equal(h.navigations[0][0], 'https://www.google.com/?q=hello');
});
test('stale engine-manager edits do not overwrite changes made in another window', async t => {
  const h = await harness({settings:true}); t.after(() => h.close());
  const incoming = JSON.stringify({ version: 1, hidden: ['native:Google'], custom: [] });
  h.put(config, incoming); await tick();
  h.document.querySelector('[name="ses-name"]').value = 'Example';
  h.document.querySelector('[name="ses-url"]').value = 'https://example.org/?q={searchTerms}';
  h.document.querySelector('[data-ses-action="add"]').click(); await tick();
  assert.equal(h.prefs.get(config), incoming);
  assert.match(h.document.querySelector('[data-ses-error]').textContent, /another window/);
});
test('custom engine label is rendered as text, never markup', async t => {
  const custom = [{ id: 'custom-test', name: '<img src=x onerror=alert(1)>', url: 'https://example.org/?q={searchTerms}' }];
  const h = await harness({ prefs: { [config]: JSON.stringify({ version: 1, hidden: [], custom }) } }); t.after(() => h.close());
  assert.ok(h.options().includes(custom[0].name)); assert.equal(h.document.querySelectorAll('[onerror]').length, 0);
});
test('disabling during an engine-list refresh drops the delayed result', async t => {
  let resolve, delay = false;
  const h = await harness({ getEngines: () => delay ? new Promise(r => resolve = r) : Promise.resolve([engine('DuckDuckGo', 'https://duckduckgo.com')]) }); t.after(() => h.close());
  delay = true; h.put(config, JSON.stringify({ version: 1, hidden: [], custom: [] }));
  await tick(); h.put(enabled, false); resolve([]); await tick(); await tick();
  assert.equal(h.roots().length, 0); assert.equal(h.progress.size, 0);
});
test('malformed settings reset preserves original raw data in a backup preference', async t => {
  const h = await harness({ settings:true, prefs: { [config]: '{broken' } }); t.after(() => h.close());

  [...h.document.querySelectorAll('#ses-engine-manager button')].find(x => x.textContent === 'Back up and reset invalid settings').click();
  await tick(); await tick();
  assert.equal(h.prefs.get(`${config}-backup`), '{broken');
  assert.deepEqual(JSON.parse(h.prefs.get(config)), { version: 1, hidden: [], custom: [] });
});
