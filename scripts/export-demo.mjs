import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=new URL('../',import.meta.url);
const version=JSON.parse(await readFile(new URL('package.json',root),'utf8')).version;
let html=await readFile(new URL('demo/index.html',root),'utf8');
const css=await readFile(new URL('demo/demo.css',root),'utf8');
const library=await readFile(new URL('dist/hoverbridge.browser.js',root),'utf8');
const demo=await readFile(new URL('demo/demo.js',root),'utf8');
if (/<\/script/i.test(library+demo) || /<\/style/i.test(css)) throw new Error('An inline closing tag must be escaped before exporting.');
html=html.replace('<link rel="stylesheet" href="demo.css">',`<style>\n${css}\n</style>`)
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g,'')
  .replace('href="index.html"','href="#"')
  .replace('href="../README.md">Documentation','href="#integration-title">Integration')
  .replace('href="../docs/limits.md"','href="#standalone-note"')
  .replace('</main>',`<details id="standalone-note" style="margin:0 0 30px;color:var(--muted);font-size:12px"><summary>Integration boundaries</summary><p>Near-zero setup applies to explicitly owned scopes with known trigger/panel relationships. Use the supplied state attributes for CSS highlights. This does not override arbitrary framework state, implement a complete ARIA menu, or manage native OS menus. Full source, API, limits and test evidence are in the repository archive. This is ${version}, not a published npm release.</p></details></main>`)
  .replace('</body>',`<script>\n${library}\n${demo}\n</script>\n</body>`);
const output=process.argv[2]?resolve(process.argv[2]):fileURLToPath(new URL(`hoverbridge-playground-v${version}.html`,root));
await writeFile(output,html);
console.log(output);
