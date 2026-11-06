import {createLocalServices} from './local-services.mjs';
import http from 'node:http';
import {createReadStream,readFileSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute,extname,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {audioMiddleware} from './audio-static.mjs';
import {musicMiddleware} from './music-source.mjs';
import {createRequestPolicy} from './request-policy.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.ico':'image/x-icon'};
export function startPreview({directory=resolve(dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.PORT||5186),host=process.env.FIRST_STEP_HOST||'127.0.0.1',snapshot}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port.');
 if(!['127.0.0.1','0.0.0.0','::1'].includes(host))throw new Error('FIRST_STEP_HOST must be 127.0.0.1, 0.0.0.0 or ::1.');
 const root=resolve(directory,'dist'),version=JSON.parse(readFileSync(resolve(directory,'package.json'),'utf8')).version;
 statSync(resolve(root,'index.html'));
 const policy=createRequestPolicy();
 if(host==='0.0.0.0'&&!policy.secure)throw new Error('Set FIRST_STEP_PUBLIC_ORIGIN before exposing the server.');
 const services=createLocalServices({directory,policy});
 const server=http.createServer((req,res)=>{
  if(services.handle(req,res)||audioMiddleware(root,req,res)||musicMiddleware(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/__first-step-version'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({version,snapshot:snapshot||null,mode:'local preview with server-side assistant'}));return;}
  const target=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':'')),subpath=relative(root,target);
  if(subpath.startsWith('..')||isAbsolute(subpath)){res.writeHead(403);res.end();return;}
  let stats;try{stats=statSync(target);}catch{res.writeHead(404);res.end('Not found');return;}
  if(!stats.isFile()){res.writeHead(404);res.end();return;}
  const fingerprinted=policy.secure&&/^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css)$/u.test(pathname);
  res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Content-Length':stats.size,'Cache-Control':fingerprinted?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
 server.requestTimeout=30000;server.headersTimeout=15000;
 server.on('close',()=>services.close());
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already occupied. The port will not change silently.`:'Local preview could not start.');process.exitCode=1;});
 server.listen(port,host,()=>console.log(`First Step ${version}: http://${host==='::1'?'[::1]':host}:${port}/#/home\nAI uses server-side local configuration. No credential is sent to the browser.`));
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const flag=process.argv.find(value=>value.startsWith('--port='));const server=startPreview({port:flag?Number(flag.slice(7)):Number(process.env.PORT||5186)});process.on('SIGINT',()=>server.close());}
