import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const tag = `v${pkg.version}`;
const out = resolve(root, 'release', tag);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run this as npm run release:bundle.');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}`);
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout.trim();
}
function requireClean() {
  if (output('git', ['status', '--porcelain']) !== '') {
    throw new Error('Commit source and generated files before packaging a release.');
  }
}
async function digest(path) {
  const data = await readFile(path);
  return { bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}

requireClean();
const commit = output('git', ['rev-parse', 'HEAD']);
await mkdir(out, { recursive: true });
run(process.execPath, [npmCli, 'run', 'build']);
run(process.execPath, [npmCli, 'test']);
requireClean();

const script = 'hoverbridge.browser.js';
const html = `hoverbridge-playground-${tag}.html`;
const archive = `HoverBridge-${tag}.zip`;
const tarball = `iamangusu-hoverbridge-${pkg.version}.tgz`;
await copyFile(resolve(root, 'dist', script), resolve(out, script));
run(process.execPath, [npmCli, 'run', 'demo:export', '--', resolve(out, html)]);
run(process.execPath, [npmCli, 'run', 'demo:smoke', '--', resolve(out, html)]);
run(process.execPath, [npmCli, 'pack', '--pack-destination', out]);
run('git', ['archive', '--format=zip', '--prefix=HoverBridge/', '-o', resolve(out, archive), 'HEAD']);
requireClean();

const files = [script, html, archive, tarball];
const assets = Object.fromEntries(await Promise.all(files.map(async name => [name, await digest(resolve(out, name))])));
await writeFile(resolve(out, `${script}.sha256`), `${assets[script].sha256}  ${script}\n`);
const manifest = {
  version: pkg.version,
  tag,
  commit,
  createdAt: new Date().toISOString(),
  assets,
  note: 'Hashes identify these exact local files. Hosted CI status is shown by the GitHub workflow, not inferred here.',
};
await writeFile(resolve(out, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const all = [...files, `${script}.sha256`, 'release-manifest.json'];
const lines = await Promise.all(all.map(async name => `${(await digest(resolve(out, name))).sha256}  ${name}`));
await writeFile(resolve(out, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(`Release bundle: ${out}\nCommit: ${commit}\nChecksummed assets: ${all.length}; checksum index: SHA256SUMS.txt`);
