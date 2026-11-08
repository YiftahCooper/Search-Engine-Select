// Render the actual shipped SVGs for a local visual review in both themes.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp'); // optional dev tool: npm install --no-save sharp
const source=await readFile(new URL('../src/icons.js',import.meta.url),'utf8');
const icon=vm.runInNewContext(source+';defaultEngineIcon');
const engines=[['google-images','Google Images'],['youtube','YouTube'],['google-maps','Google Maps'],['google-scholar','Google Scholar'],['reddit','Reddit'],['reddit-google','Reddit via Google'],['pdf-google','PDFs via Google']];
let body='';
for(const [col,bg,fg] of [[0,'#1c1b22','#fff'],[1,'#fafafa','#222']]){
 body+=`<rect x="${col*330}" width="330" height="380" fill="${bg}"/>`;
 for(const [i,[id,name]] of engines.entries()){
  const svg=decodeURIComponent(icon(id).split(',')[1]);
  const rendered=await sharp(Buffer.from(svg)).png().toBuffer();
  if(!rendered.length)throw Error('Icon failed to render: '+id);
  body+=`<g transform="translate(${col*330+20} ${16+i*52})">${svg.replace('viewBox=', 'width="32" height="32" viewBox=')}<text x="48" y="23" fill="${fg}" font-family="Arial,sans-serif" font-size="19">${name}</text></g>`;
 }
}
const out=new URL('../artifacts/release-1.3.1/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('default-icons.png',out),await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="380">${body}</svg>`)).png().toBuffer());
console.log('Rendered all seven production icons in light and dark themes.');
