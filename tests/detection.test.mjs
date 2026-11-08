import test from 'node:test';
import assert from 'node:assert/strict';
import {harness, config, tick} from './harness.mjs';

function navigate(h, url) {
  const browser=h.w.gBrowser.selectedBrowser;
  browser.currentURI.spec=url;
  for(const listener of h.progress) listener.onLocationChange(browser);
}
function visible(h) { return h.roots()[0].style.display !== 'none'; }

test('repeated configured filter parameters retain their multiplicity in any order',async t=>{
  const custom=[{id:'custom-filtered',name:'Filtered',url:'https://search.example/search?q={searchTerms}&fq=type%3Abook&fq=language%3Aen'}];
  const h=await harness({prefs:{[config]:JSON.stringify({version:1,hidden:[],custom})}});t.after(()=>h.close());
  for(const url of [
    'https://search.example/search?q=cats&fq=type%3Abook&fq=language%3Aen',
    'https://search.example/search?fq=language%3Aen&q=cats&fq=type%3Abook',
  ]) {navigate(h,url);assert.equal(visible(h),true,url);}
  for(const url of [
    'https://search.example/search?q=cats&fq=type%3Abook',
    'https://search.example/search?q=cats&fq=type%3Abook&fq=type%3Abook',
    'https://search.example/search?q=cats&fq=type%3Abook&fq=language%3Aen&fq=extra',
  ]) {navigate(h,url);assert.equal(visible(h),false,url);}
});

test('unconfigured site searches and ordinary pages never activate the selector', async t=>{
  const h=await harness();t.after(()=>h.close());
  for(const url of [
    'https://www.goodreads.com/search?q=Hugh+McIlvanney',
    'https://wolt.com/en/isr/tel-aviv/venue/market?search=milk',
    'https://wolt.com/en/isr/tel-aviv/venue/market?p=2',
    'https://www.google.com.evil.example/?q=hello',
    'https://www.google.com/account?q=hello',
    'https://www.google.com/?q=%20%20',
    'https://www.google.com/',
    'about:preferences',
  ]) {
    navigate(h,url);
    assert.equal(visible(h),false,url);
  }
});

test('leaving results closes the menu and clears the old query on same-tab navigation',async t=>{
  const h=await harness();t.after(()=>h.close());
  h.document.querySelector('#ses-engine-select').click();
  const option=h.document.querySelector('.ses-engine-option');
  navigate(h,'https://wolt.com/en/isr/market');
  assert.equal(visible(h),false);
  assert.equal(h.document.querySelector('#ses-engine-options').style.display,'none');
  assert.equal(h.document.querySelector('#ses-engine-select').getAttribute('aria-expanded'),'false');
  option.click();await tick();assert.equal(h.navigations.length,0);
  navigate(h,'https://duckduckgo.com/?q=new+word');
  assert.equal(visible(h),true);
});

test('URL-bar Enter on an ordinary URL cannot manufacture a search or overwrite its query',async t=>{
  const h=await harness();t.after(()=>h.close());
  navigate(h,'https://wolt.com/');
  h.w.gURLBar.value='https://www.goodreads.com/';
  h.w.gURLBar.inputField.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter'}));
  await tick();assert.equal(visible(h),false);
  navigate(h,'https://duckduckgo.com/?q=actual+query');
  h.w.gURLBar.value='unsubmitted text';
  h.w.gURLBar.inputField.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter'}));
  await tick();
  [...h.document.querySelectorAll('.ses-engine-option')].find(x=>x.textContent.trim()==='Google').click();
  await tick();assert.equal(h.navigations.at(-1)[0],'https://www.google.com/?q=actual%20query');
});

test('native engine matching tolerates parameter order and missing attribution, not another path',async t=>{
  const native={id:'ddg',name:'DuckDuckGo',getSubmission:term=>({uri:{spec:`https://duckduckgo.com/?t=ffab&q=${encodeURIComponent(term)}`},postData:null})};
  const h=await harness({getEngines:async()=>[native]});t.after(()=>h.close());
  navigate(h,'https://duckduckgo.com/?ia=web&q=hello%26world#results');
  assert.equal(visible(h),true);
  h.document.querySelector('.ses-engine-option').click();await tick();
  assert.equal(h.navigations.at(-1)[0],'https://duckduckgo.com/?t=ffab&q=hello%26world');
  navigate(h,'https://duckduckgo.com/settings?q=hello');assert.equal(visible(h),false);
});

test('configured modes win over general engines on the same endpoint',async t=>{
  const custom=[
    {id:'custom-web',name:'Web',url:'https://search.example/search?q={searchTerms}'},
    {id:'custom-images',name:'Images',url:'https://search.example/search?tbm=isch&q={searchTerms}'},
  ];
  const h=await harness({prefs:{[config]:JSON.stringify({version:1,hidden:[],custom})}});t.after(()=>h.close());
  navigate(h,'https://search.example/search?q=cats&tbm=isch');
  assert.equal(h.document.querySelector('#ses-engine-select span').textContent,'Images');
  navigate(h,'https://search.example/search?q=cats');
  assert.equal(h.document.querySelector('#ses-engine-select span').textContent,'Web');
});

test('configured path searches decode the query without swallowing unrelated path segments',async t=>{
  const custom=[{id:'custom-path',name:'Path',url:'https://search.example/find/{searchTerms}/results?mode=words'}];
  const h=await harness({prefs:{[config]:JSON.stringify({version:1,hidden:[],custom})}});t.after(()=>h.close());
  navigate(h,'https://search.example/find/%D7%A9%D7%9C%D7%95%D7%9D%2Fworld/results?extra=1&mode=words');
  assert.equal(visible(h),true);
  [...h.document.querySelectorAll('.ses-engine-option')].find(x=>x.textContent.trim()==='Google').click();await tick();
  assert.equal(h.navigations.at(-1)[0],'https://www.google.com/?q=%D7%A9%D7%9C%D7%95%D7%9D%2Fworld');
  navigate(h,'https://search.example/find/hello/other/results?mode=words');assert.equal(visible(h),false);
  navigate(h,'https://search.example/find/hello/results?mode=other');assert.equal(visible(h),false);
});

test('multiline search terms remain recognized and preserved when switching engines', async t => {
  const h = await harness(); t.after(() => h.close());
  const sources = [
    ['DuckDuckGo', 'https://duckduckgo.com/?q=first%0Asecond'],
    ['Reddit via Google', 'https://www.google.com/search?q=site%3Areddit.com%20first%0Asecond'],
    ['PDFs via Google', 'https://www.google.com/search?q=first%0Asecond%20filetype%3Apdf']
  ];
  for (const [name, url] of sources) {
    navigate(h, url);
    assert.equal(visible(h), true, name);
    assert.equal(h.document.querySelector('#ses-engine-select span').textContent, name);
    [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.trim() === 'Google').click();
    await tick();
    assert.equal(h.navigations.at(-1)[0], 'https://www.google.com/?q=first%0Asecond');
  }
});

test('Google Images recognizes its observed redirect while ordinary Google searches stay general', async t => {
  const google = { id: 'google', name: 'Google', getSubmission: term => ({
    uri: { spec: 'https://www.google.com/search?q=' + encodeURIComponent(term) }, postData: null
  }) };
  const h = await harness({ getEngines: async () => [google] }); t.after(() => h.close());
  for (const url of [
    'https://www.google.com/search?q=computer&tbm=isch',
    'https://www.google.com/search?tbm=isch&source=lnms&q=computer',
    'https://www.google.com/search?udm=2&q=computer'
  ]) {
    navigate(h, url);
    assert.equal(visible(h), true, url);
    assert.equal(h.document.querySelector('#ses-engine-select span').textContent, 'Google Images', url);
    assert.equal(h.document.querySelector('#ses-engine-select img').src,
      [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.trim() === 'Google Images').querySelector('img').src);
    [...h.document.querySelectorAll('.ses-engine-option')].find(x => x.textContent.trim() === 'Google').click();
    await tick();
    assert.equal(h.navigations.at(-1)[0], 'https://www.google.com/search?q=computer');
  }
  for (const url of [
    'https://www.google.com/search?q=computer',
    'https://www.google.com/search?q=computer&tbm=vid',
    'https://www.google.com/search?q=computer&tbm=isch&tbm=vid'
  ]) {
    navigate(h, url);
    assert.equal(h.document.querySelector('#ses-engine-select span').textContent, 'Google', url);
  }
  navigate(h, 'https://unrelated.example/search?q=computer&tbm=isch');
  assert.equal(visible(h), false);
  assert.equal(h.options().filter(name => name === 'Google Images').length, 1, 'the redirect matcher must not become another menu row');
});

test('editing the Google Images search URL disables its default redirect alias', async t => {
  const google = { id: 'google', name: 'Google', getSubmission: term => ({
    uri: { spec: 'https://www.google.com/search?q=' + encodeURIComponent(term) }, postData: null
  }) };
  const saved = JSON.stringify({ version: 4, removed: [], hidden: [], order: [], overrides: [], custom: [{
    id: 'custom-preset-google-images', name: 'My images', url: 'https://images.example/find?q={searchTerms}'
  }] });
  const h = await harness({ getEngines: async () => [google], prefs: { [config]: saved } }); t.after(() => h.close());
  navigate(h, 'https://www.google.com/search?q=computer&tbm=isch');
  assert.equal(h.document.querySelector('#ses-engine-select span').textContent, 'Google');
  navigate(h, 'https://images.example/find?q=computer');
  assert.equal(h.document.querySelector('#ses-engine-select span').textContent, 'My images');
  assert.equal(h.prefs.get(config), saved);
});
