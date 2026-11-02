import {createAccountMiddleware} from './account-service.mjs';
import {createImageMiddleware} from './contract-image.mjs';
import http from 'node:http';
import {createReadStream,readFileSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute,extname,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createAssistantMiddleware} from './assistant-gateway.mjs';
import {audioMiddleware} from './audio-static.mjs';
import {musicMiddleware} from './music-source.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.ico':'image/x-icon'};
export function startPreview({directory=resolve(dirname(fileURLToPath(import.meta.url)),'..'),port=5186,snapshot}={}){
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port.');
 const root=resolve(directory,'dist'),version=JSON.parse(readFileSync(resolve(directory,'package.json'),'utf8')).version;
 statSync(resolve(root,'index.html'));
 const assistant=createAssistantMiddleware({directory}),account=createAccountMiddleware(),image=createImageMiddleware({directory});
 const server=http.createServer((req,res)=>{
  if(account(req,res)||image(req,res)||assistant(req,res)||audioMiddleware(root,req,res)||musicMiddleware(req,res))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/__first-step-version'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({version,snapshot:snapshot||null,mode:'local preview with server-side assistant'}));return;}
  const target=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':'')),subpath=relative(root,target);
  if(subpath.startsWith('..')||isAbsolute(subpath)){res.writeHead(403);res.end();return;}
  let stats;try{stats=statSync(target);}catch{res.writeHead(404);res.end('Not found');return;}
  if(!stats.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Content-Length':stats.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  if(req.method==='HEAD'){res.end();return;}
  const stream=createReadStream(target);stream.on('error',()=>res.destroy());stream.pipe(res);
 });
 server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is already occupied. The port will not change silently.`:'Local preview could not start.');process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`First Step ${version}: http://127.0.0.1:${port}/#/home\nAI uses server-side local configuration. No credential is sent to the browser.`));
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const flag=process.argv.find(value=>value.startsWith('--port='));const server=startPreview({port:flag?Number(flag.slice(7)):5186});process.on('SIGINT',()=>server.close());}
