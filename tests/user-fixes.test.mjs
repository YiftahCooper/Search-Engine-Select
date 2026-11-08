import {defaultNames,defaultIds} from './harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, enabled, tick } from './harness.mjs';
import { readFile } from 'node:fs/promises';

const legacyRoot = document => {
  const root = document.createElement('div'); root.id = 'search-engine-switcher-container';
  root.innerHTML = '<div id="ses-engine-select"></div><div id="ses-engine-options"></div><div id="ses-drag-handle"></div>';
  document.documentElement.append(root); return root;
};
const row = (h, id) => h.document.querySelector(`[data-ses-engine="${id}"]`);
const act = async (h, id, action) => { const button = row(h,id)?.querySelector(`[data-ses-action="${action}"]`); assert.ok(button, `${id}: ${action} exists`); button.click(); await tick(); await tick(); };
const transfer = (initial = {}, files = []) => {
  const data = new Map(Object.entries(initial));
  return { files, get types() { return [...data.keys()]; }, setData(type,value) { data.set(type,value); }, getData(type) { return data.get(type) || ''; }, effectAllowed: 'uninitialized', dropEffect: 'none' };
};
const dragEvent = (h, target, type, dataTransfer, clientY = 0) => {
  const event = new h.w.Event(type, {bubbles:true,cancelable:true});
  Object.defineProperties(event,{dataTransfer:{value:dataTransfer},clientY:{value:clientY}});
  target.dispatchEvent(event);return event;
};
const beginDrag = (h,id,dataTransfer=transfer()) => {
  const handle=row(h,id)?.querySelector('.ses-reorder-handle');assert.ok(handle,`${id}: drag handle exists`);
  assert.equal(handle.draggable,true);dragEvent(h,handle,'dragstart',dataTransfer);return {handle,dataTransfer};
};
const targetRow = (h,id) => { const target=row(h,id);target.getBoundingClientRect=()=>({top:100,height:40,bottom:140});return target; };
const activeIds = h => [...h.document.querySelectorAll('.ses-manager-list [data-ses-engine]')].map(el=>el.dataset.sesEngine);

test('internal drop moves visible engines before or after a row and retains removed-engine restoration slots',async t=>{
  const raw=JSON.stringify({version:2,hidden:['native:Google'],custom:[{id:'custom-one',name:'One',url:'https://one.example/?q={searchTerms}'},{id:'custom-two',name:'Two',url:'https://two.example/?q={searchTerms}'}],order:[],overrides:[]});
  const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close());
  await act(h,'native:DuckDuckGo','edit');h.document.querySelector('[name="ses-url"]').value='https://draft.example/?q={searchTerms}';
  const {dataTransfer}=beginDrag(h,'custom-two');const target=targetRow(h,'native:DuckDuckGo');
  assert.equal(dragEvent(h,target,'dragover',dataTransfer,105).defaultPrevented,true);
  assert.equal(target.dataset.sesDrop,'before');assert.equal(h.prefs.get(config),raw,'hover does not save');
  dragEvent(h,target,'drop',dataTransfer,105);await tick();await tick();
  assert.deepEqual(activeIds(h),['custom-two','native:DuckDuckGo','custom-one',...defaultIds]);
  assert.deepEqual(JSON.parse(h.prefs.get(config)).order,['custom-two','native:Google','native:DuckDuckGo','custom-one',...defaultIds]);
  assert.deepEqual(JSON.parse(h.prefs.get(config)).hidden,['native:Google']);
  assert.equal(h.document.querySelector('[data-ses-drop]'),null);
  assert.equal(h.document.querySelector('[name="ses-url"]').value,'https://draft.example/?q={searchTerms}','drop retains the editable URL draft');
  assert.equal(h.document.querySelector('[data-ses-action="add"]').textContent,'Save engine');
  await act(h,'native:Google','restore-native');
  assert.deepEqual(activeIds(h),['custom-two','native:Google','native:DuckDuckGo','custom-one',...defaultIds]);
  const second=beginDrag(h,'custom-two'),last=targetRow(h,'custom-one');
  dragEvent(h,last,'dragover',second.dataTransfer,135);assert.equal(last.dataset.sesDrop,'after');
  dragEvent(h,last,'drop',second.dataTransfer,135);await tick();await tick();
  assert.deepEqual(activeIds(h),['native:Google','native:DuckDuckGo','custom-one','custom-two',...defaultIds]);
});

test('Escape, dragend, same-row and external drops do not write preferences or discard the edit draft',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());let writes=0;
  const save=h.w.Services.prefs.setStringPref;h.w.Services.prefs.setStringPref=(...args)=>{writes++;save(...args);};
  await act(h,'native:Google','edit');const input=h.document.querySelector('[name="ses-url"]');input.value='https://draft.example/?q={searchTerms}';
  for(const cancellation of ['escape','dragend','same-row','external-text','external-files','wrong-token']) {
    const {handle,dataTransfer}=beginDrag(h,'native:Google');const target=targetRow(h,'native:DuckDuckGo');
    dragEvent(h,target,'dragover',dataTransfer,105);assert.equal(target.dataset.sesDrop,'before');
    if(cancellation==='escape') h.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    if(cancellation==='dragend') dragEvent(h,handle,'dragend',dataTransfer);
    if(cancellation==='same-row') dragEvent(h,row(h,'native:Google'),'drop',dataTransfer);
    else if(cancellation==='external-text') dragEvent(h,target,'drop',transfer({'text/plain':'native:Google'}),105);
    else if(cancellation==='external-files') dragEvent(h,target,'drop',transfer(Object.fromEntries(dataTransfer.types.map(type=>[type,dataTransfer.getData(type)])),[{}]),105);
    else if(cancellation==='wrong-token') dragEvent(h,target,'drop',transfer(Object.fromEntries(dataTransfer.types.map(type=>[type,'unrelated-session']))),105);
    else dragEvent(h,target,'drop',dataTransfer,105);
    await tick();assert.equal(writes,0,cancellation);assert.equal(h.document.querySelector('[data-ses-drop]'),null,cancellation);
    assert.equal(input.value,'https://draft.example/?q={searchTerms}');
  }
  const external=transfer({'text/plain':'native:Google'});assert.equal(dragEvent(h,targetRow(h,'native:DuckDuckGo'),'dragover',external,105).defaultPrevented,false);
  assert.deepEqual(activeIds(h),['native:DuckDuckGo','native:Google',...defaultIds]);
});

test('drop rejects an externally changed preference and refresh cancels an in-flight drag',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());const drag=beginDrag(h,'native:Google');
  const incoming=JSON.stringify({version:2,hidden:[],custom:[],order:['native:Google','native:DuckDuckGo'],overrides:[]});h.put(config,incoming);
  dragEvent(h,targetRow(h,'native:DuckDuckGo'),'drop',drag.dataTransfer,105);await tick();
  assert.equal(h.prefs.get(config),incoming);assert.match(h.document.querySelector('[data-ses-error]').textContent,/another window/);
  const next=beginDrag(h,'native:Google');
  for(const observer of h.observers.get('browser-search-engine-modified')) observer.observe();await tick();await tick();
  dragEvent(h,targetRow(h,'native:DuckDuckGo'),'drop',next.dataTransfer,135);await tick();
  assert.equal(h.prefs.get(config),incoming);assert.equal(h.document.querySelector('[data-ses-drop]'),null);
});

test('orphan and late legacy selector roots are removed while unrelated mod elements survive', async t => {
  const h = await harness({beforeEvaluate(w) { legacyRoot(w.document); const other = w.document.createElement('div'); other.id='other-mod'; w.document.body.append(other); }}); t.after(()=>h.close());
  assert.equal(h.roots().length,1);
  const owned = h.roots()[0]; legacyRoot(h.document); await tick(); assert.equal(h.roots().length,1); assert.equal(h.roots()[0],owned);
  h.put(enabled,false); legacyRoot(h.document); await tick(); assert.equal(h.roots().length,0);
  assert.ok(h.document.querySelector('#other-mod'));
  h.unload(); legacyRoot(h.document); await tick(); assert.equal(h.roots().length,1,'ownership observer disconnected on unload');
});
test('floating engine menu contains no settings action', async t => {
  const h=await harness(); t.after(()=>h.close()); assert.equal(h.document.querySelector('[data-ses-action="manage"]'),null);
});
test('reorder migrates v1 only on edit and preserves hidden/custom settings', async t => {
  const raw=JSON.stringify({version:1,hidden:['native:Google'],custom:[{id:'custom-example',name:'Example',url:'https://example.org/?q={searchTerms}'}]});
  const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close()); assert.equal(h.prefs.get(config),raw);
  await act(h,'custom-example','up');
  const saved=JSON.parse(h.prefs.get(config)); assert.equal(saved.version,4); assert.deepEqual(saved.hidden,['native:Google']);assert.equal(saved.custom[0].name,'Example');
  assert.deepEqual(saved.order,['custom-example','native:Google','native:DuckDuckGo',...defaultIds]);
  assert.deepEqual([...h.document.querySelectorAll('.ses-manager-list [data-ses-engine]')].map(el=>el.dataset.sesEngine),['custom-example','native:DuckDuckGo',...defaultIds]);
});
test('native and custom engine edits and order refresh selector without touching native engines',async t=>{
  const browser=await harness();t.after(()=>browser.close());
  const h=await harness({settings:true,services:browser.w.Services});t.after(()=>h.close());
  await act(h,'native:Google','up');assert.deepEqual(browser.options(),['Google','DuckDuckGo',...defaultNames]);
  await act(h,'native:Google','edit');
  h.document.querySelector('[name="ses-name"]').value='My Google';h.document.querySelector('[name="ses-url"]').value='https://www.google.com/search?q={searchTerms}&udm=14';
  h.document.querySelector('[data-ses-action="add"]').click();await tick();await tick();
  assert.deepEqual(browser.options(),['My Google','DuckDuckGo',...defaultNames]);
  browser.document.querySelector('.ses-engine-option').click();await tick();assert.equal(browser.navigations[0][0],'https://www.google.com/search?q=hello&udm=14');
  assert.equal(browser.w.Services.search.getEngineByName('Google').name,'Google');
  assert.equal(browser.w.Services.search.getEngineByName('Google').getSubmission('x').uri.spec,'https://www.google.com/?q=x');
  await act(h,'native:DuckDuckGo','remove-native');assert.deepEqual(browser.options(),['My Google',...defaultNames]);
  assert.match(browser.document.querySelector('#ses-engine-select').textContent,/DuckDuckGo/,'removed current engine remains recognized');
});
test('engine section stays after asynchronously appended Sine preference controls',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());const container=h.document.querySelector('.sineItemPreferenceDialogContent');
  const control=h.document.createElement('div');control.textContent='Native pref';container.append(control);await tick();
  assert.equal(container.lastElementChild.id,'ses-engine-manager');assert.equal(container.querySelectorAll('#ses-engine-manager').length,1);
});

test('scoped layout contains wide buttons and inherited preference section spacing',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());
  const host=h.document.createElement('style');host.textContent='section { min-height: 400px; margin-block: 80px; } p { margin: 60px; } input { margin: 30px; min-width: 200px; } button { margin: 20px; }';h.document.head.append(host);
  const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
  const style=h.document.createElement('style');style.textContent=css.slice(css.indexOf('/* Isolate selector layout'),css.indexOf('@media -moz-pref("zen.tabs.vertical.right-side")'));h.document.head.append(style);
  const manager=h.document.querySelector('#ses-engine-manager');
  assert.equal(h.w.getComputedStyle(manager).minHeight,'0');
  assert.equal(h.w.getComputedStyle(manager.querySelector('p')).marginTop,'4px');
  assert.equal(h.w.getComputedStyle(manager.querySelector('input')).marginTop,'0px');
  const other=h.document.createElement('p');h.document.body.append(other);assert.equal(h.w.getComputedStyle(other).marginTop,'60px');
  const menu=h.document.createElement('div');menu.id='ses-engine-options';menu.innerHTML='<button class="ses-engine-option"><span>long label</span></button>';h.document.body.append(menu);
  assert.equal(h.w.getComputedStyle(menu).overflowX,'hidden');
  assert.equal(h.w.getComputedStyle(menu.firstElementChild).boxSizing,'border-box');
  assert.equal(h.w.getComputedStyle(menu.querySelector('span')).minWidth,'0');
});

test('editing a native URL permits switching from its original URL and preserves original detection',async t=>{
  const raw=JSON.stringify({version:2,hidden:[],custom:[],order:[],overrides:[{id:'native:DuckDuckGo',name:'Duck custom',url:'https://duckduckgo.com/?q={searchTerms}&ia=web'}]});
  const h=await harness({prefs:{[config]:raw}});t.after(()=>h.close());
  h.document.querySelector('.ses-engine-option').click();await tick();
  assert.equal(h.navigations[0]?.[0],'https://duckduckgo.com/?q=hello&ia=web');
});

test('custom editing retains its position and rejects a stale draft after engine refresh',async t=>{
  const raw=JSON.stringify({version:1,hidden:[],custom:[{id:'custom-first',name:'First',url:'https://first.example/?q={searchTerms}'},{id:'custom-second',name:'Second',url:'https://second.example/?q={searchTerms}'}]});
  const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close());
  await act(h,'custom-first','edit');h.document.querySelector('[name="ses-name"]').value='First renamed';
  h.document.querySelector('[data-ses-action="add"]').click();await tick();await tick();
  assert.deepEqual([...h.document.querySelectorAll('[data-ses-engine]')].map(el=>el.dataset.sesEngine),['native:DuckDuckGo','native:Google','custom-first','custom-second',...defaultIds]);
  await act(h,'custom-first','edit');
  const incoming=JSON.stringify({...JSON.parse(h.prefs.get(config)),hidden:['native:Google']});h.put(config,incoming);
  for(const observer of h.observers.get('browser-search-engine-modified')) observer.observe();await tick();
  h.document.querySelector('[name="ses-name"]').value='Stale name';h.document.querySelector('[data-ses-action="add"]').click();await tick();
  assert.equal(h.prefs.get(config),incoming);assert.match(h.document.querySelector('[data-ses-error]').textContent,/another window/);
});
test('malformed v2 override data is preserved and blocked rather than partially migrated',async t=>{
  for(const overrides of [[{id:'native:Google',name:'Bad',url:'javascript:{searchTerms}'}],[{id:'custom-bad',name:'Bad',url:'https://example.org/?q={searchTerms}'}]]){
    const raw=JSON.stringify({version:2,hidden:[],custom:[],order:[],overrides});
    const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close());
    assert.match(h.document.querySelector('[data-ses-error]').textContent,/invalid/);assert.equal(h.prefs.get(config),raw);assert.equal(h.document.querySelector('[data-ses-action="add"]').disabled,true);
  }
});

test('removing a default engine removes its active row and exposes only Restore in a collapsed section',async t=>{
  const browser=await harness();t.after(()=>browser.close());
  const h=await harness({settings:true,services:browser.w.Services});t.after(()=>h.close());
  await act(h,'native:DuckDuckGo','remove-native');
  assert.equal(h.document.querySelector('.ses-manager-list [data-ses-engine="native:DuckDuckGo"]'),null);
  const removed=h.document.querySelector('.ses-removed-engines');assert.ok(removed);assert.equal(removed.open,false);
  const removedRow=removed.querySelector('[data-ses-engine="native:DuckDuckGo"]');assert.ok(removedRow);
  assert.deepEqual([...removedRow.querySelectorAll('button')].map(button=>button.textContent),['Restore']);assert.equal(removedRow.querySelector('input'),null);
  assert.deepEqual(browser.options(),['Google',...defaultNames]);assert.equal(browser.w.Services.search.getDefault().name,'DuckDuckGo');
  removed.open=true;await act(h,'native:DuckDuckGo','restore-native');
  assert.deepEqual(browser.options(),['DuckDuckGo','Google',...defaultNames]);assert.equal(removed.hidden,true);
  assert.ok(h.document.querySelector('.ses-manager-list [data-ses-engine="native:DuckDuckGo"]'));
});
