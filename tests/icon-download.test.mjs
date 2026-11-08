import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {harness,config,tick} from './harness.mjs';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
const code=await readFile(new URL('../src/icons.js',import.meta.url),'utf8');
function environment(overrides={}) {
  const calls=[], urls=[], draws=[];
  const ctx={URL:class extends URL {static createObjectURL(){return 'blob:test'} static revokeObjectURL(u){urls.push(u)}},Blob,AbortController,
    setTimeout,clearTimeout,fetch:async(url,options)=>{calls.push({url,options});return {ok:true,url,headers:new Headers({'content-type':'image/png'}),body:new Blob(['synthetic image bytes']).stream()}},
    Image:class {naturalWidth=64;naturalHeight=32;set src(v){if(v)queueMicrotask(()=>this.onload?.());}},
    document:{createElementNS:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args.slice(1))}),toDataURL:()=>png})}, ...overrides};
  vm.createContext(ctx);vm.runInContext(code+';globalThis.load=fetchCustomIcon;',ctx);return {...ctx,calls,urls,draws};
}
test('icon fetch omits credentials/referrer, rasterizes to a small PNG, and releases its object URL',async()=>{
  const env=environment();const icon=await env.load('https://images.example/icon.svg');
  assert.equal(icon.data,png);assert.equal(env.calls[0].options.credentials,'omit');assert.equal(env.calls[0].options.referrerPolicy,'no-referrer');
  assert.deepEqual(env.draws[0],[0,8,32,16]);assert.deepEqual(env.urls,['blob:test']);
});
test('icon downloads reject unsafe URLs, HTML pages, oversized bodies and insecure redirects',async()=>{
  const env=environment();
  for(const u of ['http://example.com/a.png','javascript:alert(1)','file:///tmp/a.png','https://user:secret@example.com/a.png']) await assert.rejects(env.load(u));
  assert.equal(env.calls.length,0);
  for(const reply of [
    {type:'text/html',url:'https://example.com/a'},
    {type:'image/png',url:'http://example.com/a'},
    {type:'image/png',url:'https://example.com/a',size:262145},
  ]) {
    const e=environment({fetch:async()=>({ok:true,url:reply.url,headers:new Headers({'content-type':reply.type}),body:new Blob([new Uint8Array(reply.size||1)]).stream()})});
    await assert.rejects(e.load('https://example.com/a'));
  }
});
test('icon deadline covers hung headers, hung bodies, and hung image decoding; caller can cancel',async()=>{
  const fast=(fn)=>setTimeout(fn,15);
  const hanging={setTimeout:fast,fetch:()=>new Promise(()=>{})};
  await assert.rejects(environment(hanging).load('https://example.com/a'),/timed out/);
  await assert.rejects(environment({setTimeout:fast,fetch:async url=>({ok:true,url,headers:new Headers({'content-type':'image/png'}),body:{getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{}})}})}).load('https://example.com/a'),/timed out/);
  const decode=environment({setTimeout:fast,Image:class {set src(v){}}});
  await assert.rejects(decode.load('https://example.com/a'),/timed out/);assert.deepEqual(decode.urls,['blob:test']);
  const controller=new AbortController(),pending=environment(hanging).load('https://example.com/a',controller.signal);controller.abort();await assert.rejects(pending,/canceled/);
});
function imageMocks(w,{fetch}={}) {
  w.fetch=fetch|| (async url=>({ok:true,url,headers:new Headers({'content-type':'image/png'}),body:new Blob(['fixture']).stream()}));
  w.URL.createObjectURL=()=> 'blob:preview';w.URL.revokeObjectURL=()=>{};
  w.Image=class {naturalWidth=32;naturalHeight=32;set src(v){if(v)queueMicrotask(()=>this.onload?.());}};
  w.HTMLCanvasElement.prototype.getContext=()=>({drawImage(){}});w.HTMLCanvasElement.prototype.toDataURL=()=>png;
}
const settle=async()=>{await tick();await tick();};
function editCustom(h) {
  h.document.querySelector('[data-ses-engine="native:Google"] [data-ses-action="edit"]').click();
  const choice=h.document.querySelector('[name="ses-icon"]');choice.value='url';choice.dispatchEvent(new h.w.Event('change'));
  h.document.querySelector('[name="ses-icon-url"]').value='https://images.example/icon.png';
}
test('preview is not saved until Save; saved icon survives reopened settings, failed refresh retains it',async t=>{
  let fail=false,calls=0;
  const h=await harness({settings:true,beforeEvaluate(w){imageMocks(w,{fetch:async url=>{calls++;if(fail)throw Error('offline');return {ok:true,url,headers:new Headers({'content-type':'image/png'}),body:new Blob(['fixture']).stream()}}});}});t.after(()=>h.close());
  editCustom(h);h.document.querySelector('[data-ses-action="preview-icon"]').click();await settle();
  assert.equal(h.prefs.has(config),false);assert.equal(h.document.querySelector('.ses-icon-preview').src,png);
  h.document.querySelector('[data-ses-action="add"]').click();await settle();
  const saved=h.prefs.get(config);assert.equal(JSON.parse(saved).overrides[0].icon.data,png);assert.equal(calls,1);
  editCustom(h);assert.equal(h.document.querySelector('.ses-icon-preview').src,png);
  fail=true;h.document.querySelector('[data-ses-action="preview-icon"]').click();await settle();
  assert.equal(h.prefs.get(config),saved);assert.equal(h.document.querySelector('.ses-icon-preview').src,png);
  assert.match(h.document.querySelector('[role="status"]').textContent,/offline/);
});
test('closing settings during a custom-icon download cannot save a late result',async t=>{
  let resolve;
  const h=await harness({settings:true,beforeEvaluate(w){imageMocks(w,{fetch:()=>new Promise(r=>resolve=r)})}});t.after(()=>h.close());
  editCustom(h);h.document.querySelector('[data-ses-action="add"]').click();await tick();
  h.document.querySelector('dialog').dispatchEvent(new h.w.Event('close'));
  resolve({ok:true,url:'https://images.example/icon.png',headers:new Headers({'content-type':'image/png'}),body:new Blob(['fixture']).stream()});await settle();
  assert.equal(h.prefs.has(config),false);assert.equal(h.document.querySelector('[name="ses-name"]').value,'');
});
test('Save cannot silently cancel an in-progress refresh of a cached icon',async t=>{
  let resolve;
  const initial=JSON.stringify({version:3,hidden:[],custom:[],order:[],overrides:[{id:'native:Google',name:'Google',url:'https://www.google.com/?q={searchTerms}',icon:{kind:'url',url:'https://images.example/icon.png',data:png}}]});
  const h=await harness({settings:true,prefs:{[config]:initial},beforeEvaluate(w){imageMocks(w,{fetch:()=>new Promise(r=>resolve=r)})}});t.after(()=>h.close());
  editCustom(h);h.document.querySelector('[data-ses-action="preview-icon"]').click();await tick();
  h.document.querySelector('[data-ses-action="add"]').click();await settle();
  assert.equal(h.document.querySelector('[name="ses-name"]').value,'Google','editor must stay open while refresh is running');
  assert.equal(h.prefs.get(config),initial);
  resolve({ok:true,url:'https://images.example/icon.png',headers:new Headers({'content-type':'image/png'}),body:new Blob(['fixture']).stream()});await settle();
  assert.equal(h.document.querySelector('[data-ses-action="add"]').disabled,false);
});
test('another window changing preferences during download is never overwritten',async t=>{
  let resolve;
  const h=await harness({settings:true,beforeEvaluate(w){imageMocks(w,{fetch:()=>new Promise(r=>resolve=r)})}});t.after(()=>h.close());
  editCustom(h);h.document.querySelector('[data-ses-action="add"]').click();await tick();
  const newer=JSON.stringify({version:2,hidden:['native:Google'],custom:[],overrides:[],order:[]});h.put(config,newer);
  resolve({ok:true,url:'https://images.example/icon.png',headers:new Headers({'content-type':'image/png'}),body:new Blob(['fixture']).stream()});await settle();
  assert.equal(h.prefs.get(config),newer);assert.match(h.document.querySelector('[data-ses-error]').textContent,/another window/);
});

test('custom image transport refuses HTTPS redirects before following a replacement destination',async()=>{
  const env=environment({fetch:async(url,options)=>{
    // Standard Fetch follows this redirect unless the request explicitly rejects it.
    if(options.redirect==='error')throw new TypeError('Redirect refused');
    return {ok:true,url:'https://replacement.example/redirected.png',redirected:true,headers:new Headers({'content-type':'image/png'}),body:new Blob(['synthetic image bytes']).stream()};
  }});
  await assert.rejects(env.load('https://images.example/redirect.png'),/Redirect refused/);
  assert.equal(env.urls.length,0,'a redirect must be refused before decoding/rasterization');
});
