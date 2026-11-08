import {defaultNames,defaultIds} from './harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { harness, config, enabled, engine, tick } from './harness.mjs';

// Sine's manager records (script URL, window) -> unload callback. A null
// callback means already loaded and cannot unload, so that URL is skipped.
// This models the boundary in the installed Sine manager, not native execution.
const legacyEntry = 'search-engine-select.uc.js';
async function legacySession(t) {
  let executing = legacyEntry;
  const callbacks = new Map([[legacyEntry, null]]);
  const h = await harness({
    sourcePath: './fixtures/upstream-1.1.32.js',
    getEngines: async () => [engine('DuckDuckGo', 'https://duckduckgo.com'), engine('Perplexity', 'https://www.perplexity.ai')],
    beforeEvaluate(w) { w.addUnloadListener = callback => callbacks.set(executing, callback); }
  });
  // Legacy startup followed by its first Sine rebuild can leave two roots.
  h.evaluate(); await tick(); await tick();
  assert.equal(h.roots().length, 2, 'real upstream created the two stale controls');
  const unrelated = h.document.createElement('div'); unrelated.id = 'unrelated-mod'; h.document.body.append(unrelated);
  async function update() {
    const manifest = JSON.parse(await readFile(new URL('../theme.json', import.meta.url), 'utf8'));
    for (const entry of Object.keys(manifest.scripts)) {
      if (callbacks.has(entry)) {
        const callback = callbacks.get(entry);
        if (!callback) continue;
        await callback(); callbacks.delete(entry);
      }
      executing = entry; callbacks.set(entry, null);
      h.w.eval(await readFile(new URL(`../${entry}`, import.meta.url), 'utf8'));
    }
    await tick(); await tick();
  }
  t.after(() => { for (const callback of callbacks.values()) callback?.(); h.close(); });
  return {h, update};
}

test('Sine update from non-unloadable upstream replaces stale panels and applies Configure edits in the same window', async t => {
  const {h, update} = await legacySession(t);
  const hidden = JSON.stringify({version:2, hidden:['native:Perplexity'], custom:[], order:[], overrides:[]});
  h.put(config, hidden);
  await update();
  assert.equal(h.roots().length, 1, 'new runtime must actually execute despite the legacy URL being blocked');
  assert.deepEqual(h.options(), ['DuckDuckGo',...defaultNames]);
  assert.ok(h.document.getElementById('unrelated-mod'));
  h.put(config, JSON.stringify({version:2, hidden:[], custom:[], order:[], overrides:[]}));
  await tick(); await tick();
  assert.deepEqual(h.options(), ['DuckDuckGo', 'Perplexity',...defaultNames]);
  h.put(config, hidden); await tick(); await tick();
  assert.deepEqual(h.options(), ['DuckDuckGo',...defaultNames]);
  await update();
  assert.equal(h.roots().length, 1, 'subsequent same-entry updates replace the registered owner');
  assert.deepEqual(h.options(), ['DuckDuckGo',...defaultNames]);
  h.put(enabled, false); await tick(); assert.equal(h.roots().length, 0);
  h.put(enabled, true); await tick(); await tick();
  assert.equal(h.roots().length, 1, 'late legacy recreation is reclaimed');
  assert.deepEqual(h.options(), ['DuckDuckGo',...defaultNames]);
});
