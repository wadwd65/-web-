import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {DISPLAY,FASTENER} from '../src/scene-clearance.ts';
// @ts-ignore Node test imports the preview's native JavaScript helper.
import {audioRange,audioMiddleware} from '../tools/audio-static.mjs';
test('four fasteners have a real gap from the display surface and sit outside its visible extent',()=>{
 assert.ok(DISPLAY.z-(FASTENER.z+FASTENER.depth/2)>.02);
 assert.ok(FASTENER.x-FASTENER.radius>DISPLAY.width/2);
 assert.ok(FASTENER.y-FASTENER.radius>DISPLAY.height/2);
});
test('audio range handles open, suffix, clamped and unsatisfiable requests',()=>{
 assert.deepEqual(audioRange('bytes=20-39',100),{start:20,end:39});assert.deepEqual(audioRange('bytes=50-',100),{start:50,end:99});assert.deepEqual(audioRange('bytes=-12',100),{start:88,end:99});assert.deepEqual(audioRange('bytes=0-999',100),{start:0,end:99});
 for(const value of ['bytes=100-','bytes=50-20','bytes=-0','bytes=0-1,4-5','bytes=-','bytes=9007199254740993-'])assert.equal(audioRange(value,100),false);
});
test('local audio server supports seeking, HEAD, caching and invalid ranges without returning whole files',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'first-step-audio-')),folder=path.join(root,'audio');mkdirSync(folder);const name='779491-1234567890.mp3',file=path.join(folder,name);writeFileSync(file,Buffer.from(Array.from({length:100},(_,i)=>i)));
 const server=createServer((req,res)=>{if(!audioMiddleware(root,req,res)){res.writeHead(404);res.end();}});server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address==='object');const url=`http://127.0.0.1:${address.port}/audio/${name}`;
 try{const range=await fetch(url,{headers:{Range:'bytes=20-39'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-type'),'audio/mpeg');assert.equal(range.headers.get('content-range'),'bytes 20-39/100');assert.deepEqual([...new Uint8Array(await range.arrayBuffer())],Array.from({length:20},(_,i)=>20+i));const etag=range.headers.get('etag')!;
 const head=await fetch(url,{method:'HEAD'});assert.equal(head.headers.get('content-length'),'100');assert.equal((await head.arrayBuffer()).byteLength,0);assert.equal((await fetch(url,{headers:{'If-None-Match':etag}})).status,304);assert.equal((await fetch(url,{headers:{Range:'bytes=100-'}})).status,416);assert.equal((await fetch(url,{headers:{Range:'bytes=20-39','If-Range':'"old"'}})).status,200);
 }finally{server.close();server.closeAllConnections();await once(server,'close');unlinkSync(file);rmdirSync(folder);rmdirSync(root);}
});
test('all five downloaded tracks match recorded checksums, sizes and durations',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../public/audio/catalog.json',import.meta.url),'utf8'));assert.equal(catalog.length,5);assert.equal(new Set(catalog.map((t:{cid:string})=>t.cid)).size,5);
 for(const track of catalog){const bytes=readFileSync(new URL('../public'+track.file,import.meta.url));assert.equal(bytes.length,track.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),track.sha256);assert.ok(track.duration>60);assert.ok(track.bytes<track.originalBytes/10);}
});
