// Local release audit; never included in the installable package.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const names=['.gitignore','LICENSE','README.md','UPSTREAM.json','preferences.json','search-engine-select-runtime.uc.js','style.css','theme.json'];
const root=new URL('../',import.meta.url), release=new URL('artifacts/release-1.3.1/',root);
await mkdir(new URL('package/',release),{recursive:true});
const entries=[];
for(const path of names){
  const data=await readFile(new URL(path,root)),content=data.toString('utf8');
  if(!Buffer.from(content).equals(data))throw Error('Non-UTF8 file: '+path);
  if(/C:\\Users\\|AppData\\|@gmail\.com|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN .*PRIVATE KEY-----/i.test(content))throw Error('Private-data marker: '+path);
  const sha=createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  await copyFile(new URL(path,root),new URL('package/'+path,release));
  entries.push({path,bytes:data.length,sha,sha256:createHash('sha256').update(data).digest('hex')});
}
const theme=JSON.parse(await readFile(new URL('theme.json',root)));
if(theme.version!=='1.3.1')throw Error('Wrong version');
JSON.parse(await readFile(new URL('preferences.json',root)));
await writeFile(new URL('manifest.json',release),JSON.stringify({repository:'YiftahCooper/Search-Engine-Select',branch:'main',version:theme.version,baseline:'08dad3043d5a1ded7b5fe39decc764fb67da3cce',entries},null,2)+'\n');
console.log(JSON.stringify({version:theme.version,files:entries.map(({path,bytes,sha})=>({path,bytes,sha}))},null,2));
