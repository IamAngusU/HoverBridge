import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this with npm run package:smoke.');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const temporary = await mkdtemp(join(tmpdir(), 'hoverbridge-consumer-'));
const temporaryParent = await realpath(tmpdir());

function run(args, cwd, env = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

try {
  let tarball = process.argv[2] && resolve(process.argv[2]);
  if (!tarball) {
    const packed = JSON.parse(run([npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root));
    assert.equal(packed.length, 1, 'Expected one package archive');
    tarball = join(temporary, basename(packed[0].filename));
  }
  const consumer = join(temporary, 'consumer');
  await mkdir(consumer);
  await writeFile(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  const config = join(temporary, 'npmrc');
  await writeFile(config, 'registry=https://registry.npmjs.org/\n');
  run([npmCli, 'install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--global=false'], consumer, {
    NPM_CONFIG_USERCONFIG: config,
    NPM_CONFIG_CACHE: join(temporary, 'cache'),
    NPM_CONFIG_LOGS_MAX: '0',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
  });
  await writeFile(join(consumer, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {IntentTracker,createHoverBridge,connectHoverBridge,autoHoverBridge} from '@iamangusu/hoverbridge';
import {safeCorridor,inPolygon} from '@iamangusu/hoverbridge/core';
import {createHoverBridgeGuard} from '@iamangusu/hoverbridge/guard';
import {start} from '@iamangusu/hoverbridge/auto';
const require=createRequire(import.meta.url);
const packagePath=require.resolve('@iamangusu/hoverbridge/package.json');
const installed=JSON.parse(await readFile(packagePath,'utf8'));
assert.equal(installed.name,${JSON.stringify(pkg.name)});
assert.equal(installed.version,${JSON.stringify(pkg.version)});
assert.equal(Object.keys(installed.dependencies??{}).length,0);
for(const value of Object.values(installed.exports)) {
  for(const path of typeof value==='string'?[value]:Object.values(value)) await access(resolve(dirname(packagePath),path));
}
await access(resolve(dirname(packagePath),'LICENSE'));
for(const fn of [createHoverBridge,connectHoverBridge,autoHoverBridge,createHoverBridgeGuard]) assert.equal(typeof fn,'function');
assert.deepEqual(start().controllers,[]);
const source={left:0,top:0,right:100,bottom:40},target={left:150,top:-40,right:300,bottom:240};
const tracker=new IntentTracker();
assert.equal(tracker.sample({point:{x:50,y:20},source,target,time:0}).reason,'source');
assert.equal(tracker.sample({point:{x:95,y:70},source,target,time:30}).reason,'corridor');
assert.equal(tracker.sample({point:{x:170,y:150},source,target,time:60}).reason,'target');
assert(inPolygon({x:95,y:70},safeCorridor({x:50,y:20},target,0)));
const bundle=await readFile(require.resolve('@iamangusu/hoverbridge/browser'),'utf8');
const context={};runInNewContext(bundle,context);
assert.equal(typeof context.HoverBridge.IntentTracker,'function');
const existing={};const existingContext={HoverBridge:existing};runInNewContext(bundle,existingContext);
assert.equal(existingContext.HoverBridge,existing);
console.log('Installed archive: ESM exports, SSR-safe auto entry, classic bundle and diagonal intent passed.');
`);
  process.stdout.write(run([join(consumer, 'smoke.mjs')], consumer));
  await writeFile(join(consumer, 'types.mts'), `
import {IntentTracker,createHoverBridge,type HoverBridgeOptions,type Point} from '@iamangusu/hoverbridge';
import {safeCorridor,type Rect} from '@iamangusu/hoverbridge/core';
import {createHoverBridgeGuard} from '@iamangusu/hoverbridge/guard';
import {start} from '@iamangusu/hoverbridge/auto';
const point:Point={x:1,y:2};
const rect:Rect={left:0,top:0,right:10,bottom:10};
const options:HoverBridgeOptions={buffer:8,restMs:100};
const tracker=new IntentTracker(options);
const polygon:Point[]=safeCorridor(point,rect,8);
void [tracker,polygon,createHoverBridge,createHoverBridgeGuard,start];
`);
  run([join(root, 'node_modules/typescript/bin/tsc'), '--strict', '--noEmit', '--module', 'NodeNext', '--target', 'ES2022', 'types.mts'], consumer);
  console.log(`Packed consumer passed: ${pkg.name}@${pkg.version}; offline installation and strict TypeScript.`);
} finally {
  const actual = await realpath(temporary);
  assert.equal(dirname(actual), temporaryParent, 'Refusing cleanup outside the temporary parent');
  assert(basename(actual).startsWith('hoverbridge-consumer-'), 'Refusing cleanup of an unrelated directory');
  await rm(actual, { recursive: true, force: true });
}
