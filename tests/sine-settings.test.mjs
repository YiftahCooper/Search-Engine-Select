import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,config,enabled,tick} from './harness.mjs';

test('engine controls are available in Sine Configure without a search page, including when the selector is off',async t=>{
  const h=await harness({settings:true,prefs:{[enabled]:false}});t.after(()=>h.close());
  const root=h.document.querySelector('.sineItemPreferenceDialogContent #ses-engine-manager');assert(root);
  assert.equal(root.tagName,'SECTION');assert.equal(h.roots().length,0);assert.equal(h.progress.size,0);
  assert.equal(root.querySelectorAll('input[type=checkbox]').length,2);
  root.querySelector('[name=ses-name]').value='Example';root.querySelector('[name=ses-url]').value='https://example.org/?q={searchTerms}';root.querySelector('[data-ses-action=add]').click();await tick();
  assert.equal(JSON.parse(h.prefs.get(config)).custom[0].name,'Example');
  h.evaluate();await tick();assert.equal(h.document.querySelectorAll('#ses-engine-manager').length,1);
  h.unload();assert.equal(h.document.querySelectorAll('#ses-engine-manager').length,0);assert.equal(h.observerCount(),0);
});

test('floating menu settings opens Sine instead of constructing a second settings dialog',async t=>{
  const h=await harness();t.after(()=>h.close());h.document.querySelector('[data-ses-action=manage]').click();
  assert.equal(h.document.querySelector('#ses-engine-manager'),null);
  assert.deepEqual(h.navigations[0],['about:preferences?searchEngineSelectSettings=1#sineMods','tab']);
});

test('Sine card rebuilding remounts controls and closing Configure clears unfinished entries',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());
  const card=h.document.querySelector('[mod-id]');card.innerHTML='<button class="sineItemConfigureButton">Configure</button><dialog><div class="sineItemPreferenceDialogContent"></div></dialog>';await tick();await tick();
  assert.equal(h.document.querySelectorAll('#ses-engine-manager').length,1);
  h.document.querySelector('[name=ses-name]').value='unfinished';h.document.querySelector('dialog').dispatchEvent(new h.w.Event('close'));await tick();
  assert.equal(h.document.querySelector('[name=ses-name]').value,'');
});

test('Configure edits refresh the active browser selector through shared preferences',async t=>{
  const browser=await harness();t.after(()=>browser.close());
  const settings=await harness({settings:true,services:browser.w.Services});t.after(()=>settings.close());
  const root=settings.document.querySelector('#ses-engine-manager');
  const google=[...root.querySelectorAll('label')].find(n=>n.textContent==='Google');google.querySelector('input').click();await tick();await tick();
  assert.deepEqual(browser.options(),['DuckDuckGo']);
  root.querySelector('[name=ses-name]').value='Example';root.querySelector('[name=ses-url]').value='https://example.org/?q={searchTerms}';root.querySelector('[data-ses-action=add]').click();await tick();await tick();
  assert.deepEqual(browser.options(),['DuckDuckGo','Example']);
  root.querySelector('[data-ses-action=remove-custom]').click();await tick();await tick();assert.deepEqual(browser.options(),['DuckDuckGo']);
  assert.equal(browser.roots().length,1);
});

test('reopening Configure refreshes changes made while its dialog was closed',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());
  h.document.querySelector('dialog').dispatchEvent(new h.w.Event('close'));await tick();
  h.put(config,JSON.stringify({version:1,hidden:['native:Google'],custom:[]}));
  h.document.querySelector('.sineItemConfigureButton').click();await tick();await tick();
  const google=[...h.document.querySelectorAll('#ses-engine-manager label')].find(n=>n.textContent==='Google');assert.equal(google.querySelector('input').checked,false);
});
