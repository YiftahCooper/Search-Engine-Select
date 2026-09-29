import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, tick } from './harness.mjs';

const saved = (hidden = [], custom = []) => JSON.stringify({ version: 1, hidden, custom });
const custom = { id: 'custom-example', name: 'Example Search', url: 'https://example.org/find?q={searchTerms}&source=zen' };
test('hidden native engines are excluded only from the selector menu', async t => {
  const h = await harness({ prefs: { [config]: saved(['native:Google']) } }); t.after(() => h.close());
  assert.deepEqual(h.options(), ['DuckDuckGo']);
  h.put(config, saved()); await tick(); await tick();
  assert.deepEqual(h.options(), ['DuckDuckGo', 'Google']); assert.equal(h.roots().length, 1);
});
test('custom engine searches preserve and encode Hebrew and reserved characters', async t => {
  const h = await harness({ prefs: { [config]: saved([], [custom]) } }); t.after(() => h.close());
  h.w.gBrowser.selectedBrowser.currentURI.spec = 'https://duckduckgo.com/?q=%D7%A9%D7%9C%D7%95%D7%9D%20%26%20tea';
  h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabSelect'));
  const option = [...h.document.querySelectorAll('.ses-engine-option')].find(el => el.textContent.includes('Example Search'));
  assert.ok(option, 'custom engine must appear');
  option.dispatchEvent(new h.w.MouseEvent('mousedown', { button: 0, bubbles: true })); await tick();
  assert.equal(h.navigations[0][0], 'https://example.org/find?q=%D7%A9%D7%9C%D7%95%D7%9D%20%26%20tea&source=zen');
  assert.equal(h.navigations[0][1], 'current');
});
test('malformed stored engine settings preserve data and offer recovery instead of destroying the list', async t => {
  const h = await harness({ settings:true, prefs: { [config]: '{broken' } }); t.after(() => h.close());

  assert.ok(h.document.querySelector('[data-ses-error]')?.textContent.includes('invalid'));
  assert.equal(h.prefs.get(config), '{broken');
});
test('engine manager adds, removes and persists custom engines without rewriting native search settings', async t => {
  const h = await harness({settings:true}); t.after(() => h.close());

  h.document.querySelector('[name="ses-name"]').value = custom.name;
  h.document.querySelector('[name="ses-url"]').value = custom.url;
  h.document.querySelector('[data-ses-action="add"]').click(); await tick(); await tick();
  assert.ok(h.document.querySelector('#ses-engine-manager').textContent.includes(custom.name));
  assert.equal(JSON.parse(h.prefs.get(config)).custom.length, 1);
  h.document.querySelector('[data-ses-action="remove-custom"]').click(); await tick(); await tick();
  assert.ok(!h.document.querySelector('#ses-engine-manager').textContent.includes(custom.name)); assert.equal(JSON.parse(h.prefs.get(config)).custom.length, 0);
  assert.ok([...h.prefs.keys()].every(key => key.startsWith('extension.search-engine-select.')));
});
test('engine manager rejects unsafe or ambiguous templates and leaves saved settings unchanged', async t => {
  const h = await harness({settings:true}); t.after(() => h.close());

  assert.ok(h.document.querySelector('[name="ses-url"]'), 'manager form exists');
  for (const url of ['javascript:alert("{searchTerms}")', 'https://{searchTerms}.example.org/', 'https://user:pass@example.org/?q={searchTerms}', 'https://example.org/', 'https://example.org/?a={searchTerms}&b={searchTerms}']) {
    h.document.querySelector('[name="ses-name"]').value = 'Unsafe';
    h.document.querySelector('[name="ses-url"]').value = url;
    h.document.querySelector('[data-ses-action="add"]').click(); await tick();
    assert.ok(h.document.querySelector('[data-ses-error]').textContent.length > 0, url);
    assert.equal(h.prefs.has(config), false, url);
  }
});
test('empty engine list retains a way to reopen the manager', async t => {
  const h = await harness({ prefs: { [config]: saved(['native:DuckDuckGo', 'native:Google']) } }); t.after(() => h.close());
  assert.deepEqual(h.options(), []); assert.ok(h.document.querySelector('[data-ses-action="manage"]'));
});
