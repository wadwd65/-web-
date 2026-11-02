import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createAccountStore,createAccountMiddleware,validateMemory} from '../tools/account-service.mjs';
import {validateImage,validateExtraction,extractContractImage} from '../tools/contract-image.mjs';
import {runAssistant} from '../tools/assistant-gateway.mjs';

test('real account persistence, salted password, isolated memories, session revocation and expiry',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'first-step-account-'));const file=join(dir,'test.sqlite');let now=1000;let store=createAccountStore({file,now:()=>now});
 try{const a=await store.register('case_a','synthetic-password-34'),b=await store.register('case_b','synthetic-password-34');
  store.save(a.token,{city:'广州',stage:'试用期中',notes:'合成情况',questions:[]});assert.equal(store.current(b.token).memory.notes,'');
  await assert.rejects(store.login('case_a','wrong-password'));await assert.rejects(store.register('CASE_A','synthetic-password-34'));
  assert.equal(store.current('bad'),null);assert.throws(()=>store.save('bad',{city:'x'}));assert.throws(()=>validateMemory({city:'',stage:'',notes:'a'.repeat(2001)}));
  store.close();store=createAccountStore({file,now:()=>now});assert.equal(store.current(a.token).memory.notes,'合成情况');assert.equal(readFileSync(file).includes(Buffer.from('synthetic-password-34')),false);
  store.logout(a.token);assert.equal(store.current(a.token),null);const fresh=await store.login('case_a','synthetic-password-34');assert.equal(fresh.user.memory.city,'广州');now+=8*86400000;assert.equal(store.current(fresh.token),null);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
test('account HTTP uses opaque HttpOnly cookies, rejects cross origin and saves only authenticated profile',async()=>{
 const store=createAccountStore({file:':memory:'}),handler=createAccountMiddleware({store});const server=http.createServer((req,res)=>handler(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/api/v1/account/`;
 const post=(path,body,cookie='',origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
 try{assert.equal((await post('memory',{city:'',stage:'',notes:'',questions:[]})).status,401);assert.equal((await post('register',{},'','https://wrong.example')).status,403);
  const registered=await post('register',{username:'http_test',password:'synthetic-password-34'});assert.equal(registered.status,200);const cookie=registered.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.doesNotMatch(JSON.stringify(await registered.json()),/password|token/);
  const saved=await post('memory',{city:'广州',stage:'',notes:'test',questions:[]},cookie);assert.equal((await saved.json()).user.memory.city,'广州');assert.equal((await (await fetch(base+'me')).json()).user,null);
  await post('logout',{},cookie);assert.equal((await (await fetch(base+'me',{headers:{Cookie:cookie}})).json()).user,null);
 }finally{await new Promise(r=>server.close(r));store.close();}
});
const png=()=>{const bytes=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(100,16);bytes.writeUInt32BE(100,20);return 'data:image/png;base64,'+bytes.toString('base64');};
test('photo guidance after actual task planning always has a real contract entry',async()=>{
 const guide={intent:'guidance',status:'ready',activeModule:'contract',tasks:[{module:'contract',reason:'照片入口'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'合同照片在哪里识别？'}]},{config:{apiKey:'synthetic'},fetcher:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{tool_calls:[{id:'plan',function:{name:'plan_tasks',arguments:JSON.stringify(guide)}}]}}]}))});
 assert.equal(result.replyOrigin,'guide');assert.equal(result.actions[0].module,'contract');assert.equal(result.actions[0].kind,'open-tool');
});
test('image input forbids remote URLs, mismatched formats and oversized dimensions; extraction does not invent fields',()=>{
 assert.equal(validateImage(png()),png());assert.throws(()=>validateImage('https://external.example/image.png'));assert.throws(()=>validateImage(png().replace('image/png','image/jpeg')));
 assert.throws(()=>validateExtraction({text:'',warnings:[]}));assert.deepEqual(validateExtraction({text:'[无法辨认]',warnings:['金额模糊']}),{text:'[无法辨认]',warnings:['金额模糊'],provider:'DeepSeek',page:1});
});
test('image request sends only explicitly selected image and unknown text remains editable data',async()=>{
 let body;const data=await extractContractImage(png(),{config:{apiKey:'synthetic',model:'test'},fetcher:async(_url,init)=>{body=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'工资：[无法辨认]',warnings:['请核对金额']})}}]}));}});
 assert.equal(body.messages[1].content[1].image_url.url,png());assert.equal(data.text,'工资：[无法辨认]');assert.equal(data.confidence,undefined);
 const abort=new AbortController();abort.abort();await assert.rejects(extractContractImage(png(),{config:{apiKey:'synthetic'},signal:abort.signal,fetcher:async(_url,init)=>{assert.equal(init.signal.aborted,true);throw Error('abort');}}),/已停止/);
 await assert.rejects(extractContractImage(png(),{config:{apiKey:'synthetic'},fetcher:async()=>new Response('',{status:401})}),/配置/);
});
