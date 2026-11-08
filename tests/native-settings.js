const [expectedProfile,sources,styleUrl]=arguments,done=arguments[arguments.length-1];
(async()=>{
  if(Services.dirsvc.get('ProfD',Ci.nsIFile).path.toLowerCase()!==expectedProfile.toLowerCase())throw Error('Wrong profile; refused');
  const w=Services.wm.getMostRecentWindow('navigator:browser'),doc=w.document;
  const html=(tag)=>doc.createElementNS('http://www.w3.org/1999/xhtml',tag);
  const card=html('section');card.setAttribute('mod-id','search-engine-select');
  card.style.cssText='position:fixed;inset:80px 100px;z-index:99999;background:#1c1b22;color:white;overflow:auto;padding:20px;font:14px sans-serif;';
  const link=html('link');link.rel='stylesheet';link.href=styleUrl;
  doc.documentElement.append(link,card);
  const fixtureHelpers=`
    const getVisibleEngines=async()=>[{id:'fixture',name:'Fixture search',getSubmission:term=>({uri:{spec:'https://example.org/?q='+encodeURIComponent(term)}})}];
    const setSearchEngineIcon=(img,engine)=>{img.src=engine?.sesIcon?.kind==='url'?engine.sesIcon.data:builtinIcon(engine?.sesIcon?.name||'search');};
  `;
  const api=new w.Function('Services',sources+fixtureHelpers+';return {createEngineSettings,fetchCustomIcon,builtinIcon};')(Services);
  const pause=ms=>new Promise(r=>w.setTimeout(r,ms)),checks={},details={};
  let manager;
  try{
    manager=api.createEngineSettings(card);await pause(250);
    const find=s=>card.querySelector(s);
    checks.normalDefaults=!find('[name="ses-preset"]') && !!find('[data-ses-engine="custom-preset-google-images"]');
    find('[data-ses-engine="custom-preset-google-images"] [data-ses-action="edit"]').click();
    const choice=find('[name="ses-icon"]');choice.value='builtin:pdf';choice.dispatchEvent(new w.Event('change'));
    await pause(100);
    checks.builtinDecodes=find('.ses-icon-preview').naturalWidth>0;
    checks.noHorizontalOverflow=card.scrollWidth<=card.clientWidth;
    find('[data-ses-action="add"]').click();await pause(100);
    const pref='extension.search-engine-select.engines';
    checks.iconSaved=JSON.parse(Services.prefs.getStringPref(pref)).custom[0].icon.name==='pdf';
    // Native fetch, image decoding, canvas and preference storage with a public icon.
    try{
      const icon=await api.fetchCustomIcon('https://www.google.com/favicon.ico');
      details.remoteIcon={url:icon.url,bytes:icon.data.length};
      const image=html('img');image.src=icon.data;card.append(image);await pause(100);
      checks.remoteIconRasterized=image.naturalWidth===32&&image.naturalHeight===32;
    }catch(error){details.remoteIcon={error:String(error)};checks.remoteIconRasterized=false;}
    manager.destroy();manager=api.createEngineSettings(card);await pause(100);
    find('[data-ses-engine="custom-preset-google-images"] [data-ses-action="edit"]').click();
    checks.reopenedIcon=find('[name="ses-icon"]').value==='builtin:pdf';
    const r=card.getBoundingClientRect();details.card={width:r.width,height:r.height,scrollWidth:card.scrollWidth,clientWidth:card.clientWidth};
    return {ok:true,checks,details};
  }finally{manager?.destroy();card.remove();link.remove();}
})().then(done,error=>done({ok:false,error:String(error),stack:error.stack}));
