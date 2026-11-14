import {readFileSync,existsSync,createReadStream} from 'node:fs';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function verify(){
 const manifest=JSON.parse(readFileSync(resolve(root,'runtime-manifest.json'),'utf8'));
 for(const item of manifest.files){
  const path=resolve(root,item.path),local=relative(root,path);
  if(local.startsWith('..')||isAbsolute(local))throw Error('Invalid package manifest.');
  const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
  if(hash.digest('hex')!==item.sha256)throw Error('File incomplete or changed: '+item.path);
 }
 return manifest.version;
}
async function freePort(){
 for(let port=5380;port<5400;port++){
  const available=await new Promise(resolve=>{const probe=createServer();probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)));});
  if(available)return port;
 }
 throw Error('Ports 5380-5399 are occupied. Close an earlier preview and retry.');
}
try{
 if(!existsSync(resolve(root,'runtime-manifest.json')))throw Error('Extract the entire Windows package before starting.');
 console.log('First Step / checking local package...');
 const version=await verify();
 if(process.argv.includes('--verify-only')){console.log('Package verified: '+version);}
 else{
  // This launcher is deliberately local; it never opens an external listener.
  delete process.env.FIRST_STEP_PUBLIC_ORIGIN;delete process.env.FIRST_STEP_TRUST_PROXY;
  const {startPreview}=await import('./serve.mjs');
  const port=await freePort(),server=startPreview({directory:root,port,host:'127.0.0.1',snapshot:'Windows portable '+version});
  server.once('listening',()=>{
   const url=`http://127.0.0.1:${port}/?v=${version}#/home`;
   console.log('Keep this window open. Ctrl+C stops the local service.');
   if(process.platform==='win32'&&process.env.FIRST_STEP_NO_BROWSER!=='1'){
    const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});child.on('error',()=>console.log('Open the URL above in your browser.'));child.unref();
   }
  });
  process.once('SIGINT',()=>server.close());process.once('SIGTERM',()=>server.close());
 }
}catch(error){console.error('Could not start: '+error.message);process.exitCode=1;}
