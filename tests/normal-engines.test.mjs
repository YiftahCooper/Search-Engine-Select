import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,config,tick} from './harness.mjs';
const settle=async()=>{await tick();await tick();};
const row=(h,id)=>h.document.querySelector(`[data-ses-engine="${id}"]`);
test('removing an older equivalent custom entry cannot resurrect the shipped default',async t=>{
 const raw=JSON.stringify({version:3,hidden:[],order:[],overrides:[],custom:[{id:'custom-old-video',name:'YouTube',url:'https://www.youtube.com/results?search_query={searchTerms}'}]});
 const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close());
 row(h,'custom-old-video').querySelector('[data-ses-action="remove-custom"]').click();await settle();
 const b=await harness({prefs:{[config]:h.prefs.get(config)}});t.after(()=>b.close());
 assert.ok(!b.options().includes('YouTube'));
});
test('editing a default at the custom-engine capacity does not corrupt preferences',async t=>{
 const custom=Array.from({length:100},(_,i)=>({id:`custom-${i}`,name:`Engine ${i}`,url:`https://e${i}.example/?q={searchTerms}`}));
 const raw=JSON.stringify({version:3,hidden:[],order:[],overrides:[],custom});
 const h=await harness({settings:true,prefs:{[config]:raw}});t.after(()=>h.close());
 row(h,'custom-preset-youtube').querySelector('[data-ses-action="edit"]').click();
 h.document.querySelector('[name="ses-name"]').value='Videos';h.document.querySelector('[data-ses-action="add"]').click();await settle();
 assert.equal(h.prefs.get(config),raw);
 assert.match(h.document.querySelector('[data-ses-error]').textContent,/100 custom engines/);
});
test('default engines are normal rows; deselection stays editable and survives reopen',async t=>{
 const h=await harness({settings:true});t.after(()=>h.close());
 assert.equal(h.document.querySelector('[name="ses-preset"]'),null);
 for(const id of ['google-images','youtube','google-maps','google-scholar','reddit','reddit-google','pdf-google']) assert.ok(row(h,'custom-preset-'+id));
 const id='custom-preset-google-images',box=row(h,id).querySelector('input[type="checkbox"]');
 assert.ok(box);box.checked=false;box.dispatchEvent(new h.w.Event('change'));await settle();
 assert.ok(row(h,id).querySelector('[data-ses-action="edit"]'));
 assert.equal(row(h,id).querySelector('input').checked,false);
 const browser=await harness({prefs:{[config]:h.prefs.get(config)}});t.after(()=>browser.close());
 assert.ok(!browser.options().includes('Google Images'));assert.ok(browser.options().includes('YouTube'));
});
test('removing a default engine persists through reopen and editing another engine',async t=>{
 const h=await harness({settings:true});t.after(()=>h.close());
 row(h,'custom-preset-reddit-google').querySelector('[data-ses-action="remove-custom"]').click();await settle();
 const h2=await harness({settings:true,prefs:{[config]:h.prefs.get(config)}});t.after(()=>h2.close());
 assert.equal(row(h2,'custom-preset-reddit-google')?.querySelector('[data-ses-action="edit"]'),null);
 row(h2,'custom-preset-youtube').querySelector('[data-ses-action="edit"]').click();
 h2.document.querySelector('[name="ses-name"]').value='Videos';h2.document.querySelector('[data-ses-action="add"]').click();await settle();
 const b=await harness({prefs:{[config]:h2.prefs.get(config)}});t.after(()=>b.close());
 assert.ok(!b.options().includes('Reddit via Google'));assert.ok(b.options().includes('Videos'));
});
test('upgrading preserves existing additions, custom icons and removals without duplicate rows',async t=>{
 const old={version:3,hidden:['native:Google'],order:['custom-preset-reddit'],overrides:[],custom:[{id:'custom-preset-reddit',name:'My Reddit',url:'https://www.reddit.com/search/?q={searchTerms}',icon:{kind:'builtin',name:'book'}}]};
 const h=await harness({prefs:{[config]:JSON.stringify(old)}});t.after(()=>h.close());
 assert.equal(h.options().filter(n=>/Reddit/.test(n)&&n!=='Reddit via Google').length,1);
 assert.ok(!h.options().includes('Google'));assert.ok(h.options().includes('YouTube'));
 assert.equal(h.prefs.get(config),JSON.stringify(old),'reading must not rewrite preferences');
});
test('default icon identities are local, distinct, and preserved across selector rebuild',async t=>{
 const h=await harness();t.after(()=>h.close());
 const icons=()=>[...h.document.querySelectorAll('.ses-engine-option')].filter(el=>!['Google','DuckDuckGo'].includes(el.textContent.trim())).map(el=>el.querySelector('img').src);
 const first=icons();assert.equal(first.length,7);assert.equal(new Set(first).size,7);
 assert.ok(first.every(src=>src.startsWith('data:image/svg+xml,')),'defaults do not depend on external icon requests');
 h.evaluate();await settle();assert.deepEqual(icons(),first);
});
