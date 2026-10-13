import { readdir, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--project', join(root, 'tsconfig.json'), '--noEmit'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(join(root, 'dist'), { recursive: true });
const emit = spawnSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--project', join(root, 'tsconfig.json')], { stdio: 'inherit' });
if (emit.status !== 0) process.exit(emit.status ?? 1);

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]));
  return files.flat().sort();
}

// A closed, relative-only module graph becomes static function wrappers.
// No eval/new Function, remote modules or runtime compiler. ESM output above
// stays unbundled and tree-shakeable; this single-file build is for script tags.
const modules = [];
for (const file of await walk(join(root, 'src'))) {
  if (!file.endsWith('.ts')) continue;
  const source = await readFile(file, 'utf8');
  const id = relative(join(root, 'src'), file).replaceAll('\\', '/').replace(/\.ts$/, '.js');
  for (const imported of ts.preProcessFile(source).importedFiles) {
    if (!imported.fileName.startsWith('.')) throw new Error(`External browser dependency in ${id}: ${imported.fileName}`);
  }
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, removeComments: true,
  }, fileName: file }).outputText;
  modules.push(`${JSON.stringify(id)}:function(module,exports,require){\n${output}\n}`);
}
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const bundle = `/*! HoverBridge v${version} | MIT | Angus Uelsmann | angusu.de */
(function(global){'use strict';
const modules={${modules.join(',\n')}};
const cache=Object.create(null);
function load(id){
 if(cache[id])return cache[id].exports;
 if(!Object.prototype.hasOwnProperty.call(modules,id))throw new Error('Unknown HoverBridge module: '+id);
 const module=cache[id]={exports:{}};
 function require(request){
  const parts=id.split('/');parts.pop();
  for(const part of request.split('/')){if(part==='..')parts.pop();else if(part!=='.'&&part)parts.push(part);}
  return load(parts.join('/'));
 }
 modules[id](module,module.exports,require);return module.exports;
}
if(!global.HoverBridge)global.HoverBridge=load('browser.js');
})(globalThis);
`;
await writeFile(join(root, 'dist/hoverbridge.browser.js'), bundle);
console.log(`Built HoverBridge ${version}: ESM, declarations and one self-contained browser script.`);
