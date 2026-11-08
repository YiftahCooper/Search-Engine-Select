const SES_ICON_NAMES = {picture:'Picture',pdf:'PDF document',discussion:'Discussion',map:'Map',book:'Book',search:'Search'};
// Self-contained service marks: no favicon request can turn a default into a
// generic placeholder. Filtered Google searches carry an explicit visual badge.
function defaultEngineIcon(id) {
  const google='<path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h6.2a5.3 5.3 0 0 1-2.3 3.5v2.8h3.7C21.8 18.6 23 15.7 23 12.3z"/><path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.8c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v2.9A11.5 11.5 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.6 13.8a7 7 0 0 1 0-4.4V6.5H1.8a11.5 11.5 0 0 0 0 10.2z"/><path fill="#EA4335" d="M12 4.7c1.7 0 3.2.6 4.4 1.8l3.3-3.3A11 11 0 0 0 12 0 11.5 11.5 0 0 0 1.8 6.5l3.8 2.9C6.5 6.7 9 4.7 12 4.7z"/>';
  const reddit='<circle cx="16" cy="16" r="15" fill="#ff4500"/><g fill="white"><ellipse cx="16" cy="19" rx="10" ry="7"/><circle cx="6" cy="16" r="3"/><circle cx="26" cy="16" r="3"/><circle cx="23" cy="8" r="2.4"/></g><path d="m16 13 2-7 5 2" fill="none" stroke="white" stroke-width="2"/><g fill="#ff4500"><circle cx="12" cy="18" r="1.7"/><circle cx="20" cy="18" r="1.7"/></g><path d="M12 22q4 3 8 0" fill="none" stroke="#ff4500" stroke-width="1.5" stroke-linecap="round"/>';
  const drawings={
    'google-images':`<g transform="translate(1 1) scale(.95)">${google}</g><rect x="15" y="17" width="16" height="14" rx="3" fill="#4285f4" stroke="white"/><path d="m18 27 4-4 3 3 3-2" fill="none" stroke="white" stroke-width="1.7"/><circle cx="26" cy="21" r="1.5" fill="white"/>`,
    'youtube':'<rect x="1" y="5" width="30" height="22" rx="7" fill="#ff0033"/><path d="m13 10 9 6-9 6z" fill="white"/>',
    'google-maps':'<path d="M16 1C9 1 5 6 5 12c0 8 9 17 11 19 2-2 11-11 11-19C27 6 23 1 16 1z" fill="#34a853"/><path d="M16 1C9 1 5 6 5 12c0 3 1 6 3 9L23 4a11 11 0 0 0-7-3z" fill="#4285f4"/><path d="m8 21 5-6-7-7c-2 4-1 8 2 13z" fill="#fbbc04"/><path d="m13 15 10-11 3 4-9 10z" fill="#ea4335"/><circle cx="16" cy="12" r="4" fill="white"/>',
    'google-scholar':'<path d="m1 12 15-10 15 10-15 10z" fill="#4285f4"/><path d="m16 2 15 10-15 10z" fill="#1967d2"/><circle cx="16" cy="22" r="8" fill="#a1c2fa"/><path d="M8 22a8 8 0 0 1 16 0z" fill="#4285f4"/>',
    'reddit':reddit,
    'reddit-google':`<g transform="scale(.8)">${reddit}</g><circle cx="24" cy="24" r="8" fill="white"/><g transform="translate(18 18) scale(.52)">${google}</g>`,
    'pdf-google':`<path d="M4 1h16l8 8v22H4z" fill="#e94235"/><path d="M20 1v8h8" fill="#ffb3ad"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="10" font-weight="bold">PDF</text><circle cx="25" cy="7" r="7" fill="white"/><g transform="translate(20 2) scale(.44)">${google}</g>`
  };
  if (!Object.hasOwn(drawings,id)) return undefined;
  return 'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${drawings[id]}</svg>`);
}
function builtinIcon(name) {
  const drawings = {
    picture:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    pdf:'<path d="M6 3h8l4 4v14H6zM14 3v5h4"/><text x="12" y="17" text-anchor="middle" fill="white" stroke="none" font-family="sans-serif" font-size="7" font-weight="bold">PDF</text>',
    discussion:'<path d="M4 4h16v12H9l-5 4z"/><path d="M8 8h8M8 12h6"/>',
    map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
    book:'<path d="M12 5C9 3 6 3 3 4v16c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zm0 0v16"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>'
  };
  if (!Object.hasOwn(drawings,name)) throw new Error('Choose a supported built-in icon.');
  // A filled background keeps these icons legible in both light and dark themes.
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#536779"/><g transform="translate(2 2)" fill="none" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${drawings[name]}</g></svg>`);
}
function iconUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a direct HTTPS image URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a direct HTTPS image URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS image URL without a username or password.');
  return url.href;
}
function validateIcon(icon) {
  if (icon == null) return undefined;
  if (icon.kind === 'builtin' && Object.hasOwn(SES_ICON_NAMES, icon.name)) return {kind:'builtin',name:icon.name};
  if (icon.kind === 'url' && typeof icon.data === 'string' && icon.data.length <= 8192 && /^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(icon.data))
    return {kind:'url',url:iconUrl(icon.url),data:icon.data};
  throw new Error('The saved icon is invalid.');
}
async function fetchCustomIcon(value, signal) {
  const url = iconUrl(value), controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort',abort,{once:true});
  // The deadline covers body download and image decoding, not just headers.
  let timer, image, objectUrl;
  const deadline = new Promise((_,reject) => {
    const fail = () => reject(new Error(signal?.aborted ? 'Icon loading canceled.' : 'Icon loading timed out. Try another image URL.'));
    controller.signal.addEventListener('abort',fail,{once:true});
    if (controller.signal.aborted) fail();
    timer = setTimeout(abort,8000);
  });
  try {
    return await Promise.race([deadline,(async()=>{
      const response = await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      if (!response.ok || !response.url.startsWith('https:')) throw new Error('Could not download the icon. Use a direct HTTPS image link.');
      const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (!['image/png','image/jpeg','image/webp','image/gif','image/x-icon','image/vnd.microsoft.icon','image/svg+xml'].includes(type)) throw new Error('That link does not return a supported image.');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Could not read the image.');
      const chunks = []; let size = 0;
      try {
        while (true) {
          const {done,value:chunk} = await reader.read(); if (done) break;
          size += chunk.length;
          if (size > 262144) throw new Error('Choose an image smaller than 256 KB.');
          chunks.push(chunk);
        }
      } finally { void reader.cancel().catch(()=>{}); }
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      objectUrl = URL.createObjectURL(new Blob(chunks,{type})); image = new Image();
      await new Promise((resolve,reject)=> { image.onload=resolve; image.onerror=()=>reject(new Error('The image could not be decoded.')); image.src=objectUrl; });
      if (controller.signal.aborted) throw new Error('Icon loading canceled.');
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 4096 || image.naturalHeight > 4096) throw new Error('Choose an image no larger than 4096 pixels.');
      const canvas = document.createElementNS('http://www.w3.org/1999/xhtml','canvas'); canvas.width=32; canvas.height=32;
      const scale = Math.min(32/image.naturalWidth,32/image.naturalHeight), width=image.naturalWidth*scale, height=image.naturalHeight*scale;
      canvas.getContext('2d').drawImage(image,(32-width)/2,(32-height)/2,width,height);
      return validateIcon({kind:'url',url,data:canvas.toDataURL('image/png')});
    })()]);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort',abort); controller.abort();
    if (image) { image.onload=image.onerror=null; image.src=''; }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
