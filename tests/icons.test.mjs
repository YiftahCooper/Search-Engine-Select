import {defaultNames,defaultIds} from './harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, engine, tick } from './harness.mjs';

const generic = 'chrome://global/skin/icons/search-glass.svg';
const item = { id: 'custom-example', name: 'Example', url: 'https://example.org/private/search?q={searchTerms}&token=secret#fragment' };
const saved = (custom = [item], overrides = []) => JSON.stringify({ version: 2, hidden: [], custom, order: [], overrides });
const optionImage = (h, name) => [...h.document.querySelectorAll('.ses-engine-option')].find(el => el.textContent.trim() === name)?.querySelector('img');
const fail = (h, img) => img.dispatchEvent(new h.w.Event('error'));

test('custom icons use only their origin in list and selected button, with bounded generic fallback', async t => {
  const h = await harness({ prefs: { [config]: saved() } }); t.after(() => h.close());
  h.w.gBrowser.selectedBrowser.currentURI.spec = 'https://example.org/private/search?q=private-query&token=secret#fragment';
  h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabSelect'));
  for (const img of [optionImage(h, 'Example'), h.document.querySelector('#ses-engine-select img')]) {
    assert.equal(img.src, 'https://example.org/favicon.ico');
    assert.equal(img.getAttribute('referrerpolicy'), 'no-referrer');
    fail(h, img); assert.equal(img.src, generic);
    for (let n = 0; n < 5; n++) fail(h, img);
    assert.equal(img.src, generic); assert.equal(img.onerror, null);
  }
});

test('native icons take precedence and errors walk a finite host-only fallback chain', async t => {
  const native = engine('Native', 'https://search.public-domain.com/private?token=secret');
  native.iconURI = { spec: 'https://cdn.public-domain.com/icon.png' };
  const h = await harness({ getEngines: async () => [native] }); t.after(() => h.close());
  const img = optionImage(h, 'Native');
  assert.equal(img.src, native.iconURI.spec); assert.equal(img.getAttribute('referrerpolicy'), 'no-referrer');
  fail(h, img); assert.equal(img.src, 'https://search.public-domain.com/favicon.ico');
  fail(h, img); assert.equal(img.src, 'https://s2.googleusercontent.com/s2/favicons?domain_url=https://search.public-domain.com&sz=32');
  fail(h, img); assert.equal(img.src, generic);
  fail(h, img); assert.equal(img.src, generic); assert.equal(img.onerror, null);
});

test('a supplied native generic icon remains terminal and malformed submissions cannot become remote requests', async t => {
  const natives = [engine('Supplied', 'https://public-domain.com'), { name: 'Broken', getSubmission() { return { uri: { spec: 'not-a-url?secret=value' } }; } }];
  const h = await harness({ getEngines: async () => natives }); t.after(() => h.close());
  for (const name of ['Supplied', 'Broken']) {
    const img = optionImage(h, name);
    assert.equal(img.src, generic); assert.equal(img.onerror, null);
    fail(h, img); assert.equal(img.src, generic);
  }
});

test('custom and edited native URLs refresh icons and same-host entries retain distinct labels', async t => {
  const google = { id: 'custom-google', name: 'Google', url: 'https://www.google.com/search?q={searchTerms}' };
  const images = { id: 'custom-images', name: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q={searchTerms}' };
  const h = await harness({ getEngines: async () => [engine('DuckDuckGo', 'https://duckduckgo.com')], prefs: { [config]: saved([google, images]) } }); t.after(() => h.close());
  assert.deepEqual(h.options(), ['DuckDuckGo', 'Google', ...defaultNames]);
  assert.equal(optionImage(h, 'Google').src, 'https://www.google.com/favicon.ico');
  assert.equal(optionImage(h, 'Google Images').src, 'https://www.google.com/favicon.ico');
  h.put(config, saved([{ ...google, url: 'https://new.example.org/search?q={searchTerms}' }, images], [{ ...item, id: 'native:DuckDuckGo', name: 'Edited native' }]));
  await tick(); await tick();
  assert.equal(optionImage(h, 'Google').src, 'https://new.example.org/favicon.ico');
  const edited = optionImage(h, 'Edited native');
  assert.equal(edited.src, 'https://example.org/favicon.ico');
  fail(h, edited); assert.equal(edited.src, generic);
});

test('private and local native origins never fall back to a third-party favicon service', async t => {
  for (const host of ['localhost', 'router', 'router.local', 'router.internal', '127.0.0.1', '192.168.1.1', '[::1]']) {
    const native = engine(host, `https://${host}`); delete native.iconURI;
    const h = await harness({ getEngines: async () => [native] });
    try {
      const img = optionImage(h, host);
      assert.equal(img.src, `https://${host}/favicon.ico`);
      fail(h, img); assert.equal(img.src, generic, host);
      fail(h, img); assert.equal(img.src, generic); assert.equal(img.onerror, null);
    } finally { h.close(); }
  }
});
