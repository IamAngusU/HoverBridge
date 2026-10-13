import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPreviewServer} from '../scripts/serve.mjs';
const {version}=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
let server,origin;
before(async()=>{server=createPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('preview serves the demo and the exact shipped script',async()=>{
 const html=await fetch(origin+'/demo/');assert.equal(html.status,200);assert.match(await html.text(),/components-trigger/);
 const js=await fetch(origin+'/dist/hoverbridge.browser.js');assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/javascript/);assert.ok((await js.text()).includes(`HoverBridge v${version}`));
});
test('preview rejects writes',async()=>{assert.equal((await fetch(origin+'/demo/',{method:'POST'})).status,405);});
test('preview does not expose package metadata or dependency directories',async()=>{
 for(const path of ['/package.json','/node_modules/typescript/package.json','/src/dom/controller.ts','/.env'])assert.equal((await fetch(origin+path)).status,404,path);
});
test('preview rejects traversal and malformed escapes',async()=>{
 for(const path of ['/demo/%2e%2e/%2e%2e/etc/passwd','/docs/%252e%252e/package.json','/demo/%ZZ'])assert.equal((await fetch(origin+path)).status,404,path);
});
test('preview uses no-store and restrictive script/connect directives',async()=>{
 const response=await fetch(origin+'/demo/');assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
});
test('preview supports HEAD without a response body',async()=>{const response=await fetch(origin+'/demo/',{method:'HEAD'});assert.equal(response.status,200);assert.equal(await response.text(),'');});
