import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, config, tick, engine } from './harness.mjs';

const settle = async () => { await tick(); await tick(); };
const byName = (h, name) => [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.trim() === name);
const row = (h, id) => h.document.querySelector(`[data-ses-engine="${id}"]`);
const submit = async h => { h.document.querySelector('[data-ses-action="add"]').click(); await settle(); };
const choose = (h, selector, value) => { const el = h.document.querySelector(selector); assert.ok(el, selector); el.value = value; el.dispatchEvent(new h.w.Event('change', {bubbles:true})); return el; };

test('filtered Google presets strip only their own query wrapper when switching engines', async t => {
  const custom = [
    {id:'custom-preset-reddit-google',name:'Reddit via Google',url:'https://www.google.com/search?q=site%3Areddit.com%20{searchTerms}'},
    {id:'custom-preset-pdf-google',name:'PDFs via Google',url:'https://www.google.com/search?q={searchTerms}%20filetype%3Apdf'}
  ];
  const google={...engine('Google','https://www.google.com'),getSubmission:term=>({uri:{spec:'https://www.google.com/search?q='+encodeURIComponent(term)}})};
  const h = await harness({getEngines:async()=>[google],prefs:{[config]:JSON.stringify({version:2,hidden:[],custom,order:[],overrides:[]})}}); t.after(()=>h.close());
  for (const [query,label] of [['site:reddit.com tea & שלום','Reddit via Google'],['tea & שלום filetype:pdf','PDFs via Google']]) {
    h.w.gBrowser.selectedBrowser.currentURI.spec='https://www.google.com/search?q='+encodeURIComponent(query);
    h.w.gBrowser.tabContainer.dispatchEvent(new h.w.Event('TabSelect'));
    assert.match(h.document.querySelector('#ses-engine-select').textContent,new RegExp(label));
    byName(h,'Google').click(); await settle();
    assert.equal(new URL(h.navigations.at(-1)[0]).searchParams.get('q'),'tea & שלום');
  }
});

test('Ctrl-click and middle-click open once in a background tab; the live toggle disables both gestures', async t => {
  const h=await harness();t.after(()=>h.close());
  const google=byName(h,'Google');
  for(const input of [{button:0,ctrlKey:true},{button:1}]) {
    google.dispatchEvent(new h.w.MouseEvent('mousedown',{...input,bubbles:true}));
    google.dispatchEvent(new h.w.MouseEvent(input.button?'auxclick':'click',{...input,detail:1,bubbles:true})); await settle();
    assert.equal(h.navigations.at(-1)[1],'tab');assert.equal(h.navigations.at(-1)[2].inBackground,true);
  }
  assert.equal(h.navigations.length,2);
  h.put('extension.search-engine-select.open-in-new-tab',false);
  google.dispatchEvent(new h.w.MouseEvent('mousedown',{button:0,ctrlKey:true,bubbles:true}));
  google.dispatchEvent(new h.w.MouseEvent('mousedown',{button:1,bubbles:true}));await settle();
  assert.equal(h.navigations.length,2);
  google.click();await settle();assert.equal(h.navigations.at(-1)[1],'current');
});

test('modified click can duplicate the current search in a new tab', async t=>{
  const h=await harness();t.after(()=>h.close());
  byName(h,'DuckDuckGo').dispatchEvent(new h.w.MouseEvent('mousedown',{button:0,ctrlKey:true,bubbles:true}));await settle();
  assert.equal(h.navigations.length,1);assert.equal(h.navigations[0][1],'tab');
});

test('builtin icon overrides survive edit and reopening, and default reset removes the override',async t=>{
  const h=await harness({settings:true});t.after(()=>h.close());
  row(h,'native:Google').querySelector('[data-ses-action="edit"]').click();
  choose(h,'[name="ses-icon"]','builtin:picture');await submit(h);
  const saved=h.prefs.get(config);assert.equal(JSON.parse(saved).overrides[0].icon.name,'picture');
  const browser=await harness({prefs:{[config]:saved}});t.after(()=>browser.close());
  assert.match(byName(browser,'Google').querySelector('img').src,/data:image\/svg\+xml/);
  row(h,'native:Google').querySelector('[data-ses-action="edit"]').click();
  assert.equal(h.document.querySelector('[name="ses-icon"]').value,'builtin:picture');
  choose(h,'[name="ses-icon"]','default');await submit(h);
  assert.equal(JSON.parse(h.prefs.get(config)).overrides[0].icon,undefined);
});

test('cached custom icon is used offline and unsafe saved icon values cannot execute',async t=>{
  const base={id:'custom-a',name:'Custom',url:'https://example.com/?q={searchTerms}'};
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
  const raw=JSON.stringify({version:3,hidden:[],order:[],overrides:[],custom:[{...base,icon:{kind:'url',url:'https://icons.example/icon.png',data:png}}]});
  const h=await harness({prefs:{[config]:raw},beforeEvaluate(w){w.fetch=()=>{throw Error('offline')};}});t.after(()=>h.close());
  assert.equal(byName(h,'Custom')?.querySelector('img').src,png);
  const bad=raw.replace(png,'javascript:alert(1)');h.put(config,bad);await settle();
  assert.equal(h.prefs.get(config),bad);assert.ok(!byName(h,'Custom'));
});
