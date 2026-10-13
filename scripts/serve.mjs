import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.md':'text/plain; charset=utf-8', '.json':'application/json; charset=utf-8', '.map':'application/json; charset=utf-8' };

/** Loopback-only preview. Exposes demo/docs/dist assets, never arbitrary files. */
export function createPreviewServer() {
  return createServer(async (req,res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405,{Allow:'GET, HEAD'}); res.end(); return; }
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
      if (!/^\/(demo|dist|docs)\//.test(path) && !['/','/README.md','/README.de.md','/LICENSE'].includes(path)) throw new Error('not found');
      const requested=path==='/' ? '/demo/index.html' : path.endsWith('/') ? path+'index.html' : path;
      const file = await realpath(resolve(root, '.'+requested));
      if (!file.startsWith(root+sep) || file.includes(sep+'node_modules'+sep)) throw new Error('not found');
      const extension=extname(file);
      if (!mime[extension] && !file.endsWith(sep+'LICENSE')) throw new Error('not found');
      if (!(await stat(file)).isFile()) throw new Error('not found');
      res.writeHead(200,{'Content-Type':mime[extension]??'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
      if (req.method==='HEAD') res.end(); else res.end(await readFile(file));
    } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found.');}
  });
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const input=process.argv[2] ?? '4173';
  if (!/^\d+$/.test(input) || Number(input)>65535) { console.error('Usage: node scripts/serve.mjs [port 0..65535]');process.exitCode=1; }
  else {
    const server=createPreviewServer();
    server.on('error',error=>{console.error(`Preview failed: ${error.message}`);process.exitCode=1;});
    server.listen(Number(input),'127.0.0.1',()=>console.log(`HoverBridge playground: http://127.0.0.1:${server.address().port}/demo/\nPress Ctrl+C to stop. Bound to loopback, not your network.`));
  }
}
