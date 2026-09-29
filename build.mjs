import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
let source = await readFile(new URL('src/switcher.js', root), 'utf8');
for (const name of ['engines', 'manager']) source = source.replace(`// @include ${name}.js`, await readFile(new URL(`src/${name}.js`, root), 'utf8'));
const target = new URL('search-engine-select.uc.js', root);
const output = '// Generated from src/switcher.js. Run node build.mjs to rebuild.\n' + source;
if (process.argv.includes('--check')) {
  if (await readFile(target, 'utf8') !== output) throw new Error('Generated script is out of date.');
  console.log('Generated script matches source.');
} else {
  await writeFile(target, output);
  console.log('Built search-engine-select.uc.js');
}
