import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { createHash } from 'node:crypto';
const base=new URL('../',import.meta.url);
async function size(file) {
 const bytes=await readFile(new URL(file,base));
 return {file,bytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length,
  brotliBytes:brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:11}}).length,
  sha256:createHash('sha256').update(bytes).digest('hex'),
  integrity:'sha384-'+createHash('sha384').update(bytes).digest('base64')};
}
const bundle=await size('dist/hoverbridge.browser.js');
const core=[];
for(const name of await readdir(new URL('dist/core/',base))) if(name.endsWith('.js'))core.push(await size('dist/core/'+name));
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const report={version,measuredAt:new Date().toISOString(),bundle,core,
 coreTotals:core.reduce((s,f)=>({bytes:s.bytes+f.bytes,gzipBytes:s.gzipBytes+f.gzipBytes,brotliBytes:s.brotliBytes+f.brotliBytes}),{bytes:0,gzipBytes:0,brotliBytes:0}),
 notes:'Browser build is self-contained, without an external minifier. Core totals sum individual emitted ESM .js files with each file compressed separately. Source maps and declarations are excluded. Compression levels: gzip 9, Brotli 11. Actual transfer requires server compression.'};
await mkdir(new URL('docs/evidence/',base),{recursive:true});
await writeFile(new URL('docs/evidence/sizes.json',base),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
