import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createAccountStore} from '../tools/account-service.mjs';
import {createUsageGuard,usageLimits,networkAddress} from '../tools/usage-service.mjs';
import {createLocalServices} from '../tools/local-services.mjs';
import {createRequestPolicy} from '../tools/request-policy.mjs';
import {validConnection,validUsage} from '../src/services/ai-settings-client.ts';
const fixed=Date.parse('2026-11-06T08:00:00Z');
const req=(cookie='',ip='203.0.113.7')=>({headers:{cookie},socket:{remoteAddress:ip}});
const res=()=>{const headers={};return {headers,getHeader:k=>headers[k],setHeader:(k,v)=>headers[k]=v};};
const jar=response=>[].concat(response.headers['Set-Cookie']||[]).map(c=>c.split(';')[0]).join('; ');
function guard(options={}){const accounts=createAccountStore({file:':memory:',now:()=>fixed});return {accounts,usage:createUsageGuard({file:':memory:',accounts,now:()=>fixed,...options})};}
test('signed guests are separate, forged visitor cookies cannot reuse a bucket, while a network cannot evade its cap',()=>{
 const {accounts,usage}=guard({limits:{...usageLimits({}),networkChat:2}});
 try{const a=req(),ar=res();assert.equal(usage.snapshot(a,ar).chat.used,0);const secure=res();usage.snapshot(req('', '203.0.113.99'),secure,true);assert.match(String(secure.headers['Set-Cookie']),/HttpOnly; SameSite=Strict/);assert.match(String(secure.headers['Set-Cookie']),/; Secure/);const cookie=jar(ar);assert.match(cookie,/first_step_visitor=v1\./);assert.ok(!JSON.stringify(usage.snapshot(a,ar)).includes('owner'));
  usage.reserve(req(cookie),res(),'chat').release();const b=req(),br=res();usage.reserve(b,br,'chat').release();assert.notEqual(jar(br),cookie);assert.equal(usage.snapshot(req(cookie),res()).chat.used,1);assert.equal(usage.snapshot(req(jar(br)),res()).chat.used,1);
  assert.throws(()=>usage.reserve(req(cookie.replace(/.$/,'x')),res(),'chat'),e=>e.code==='usage-network');assert.equal(usage.snapshot(req(cookie),res()).chat.used,1);
 }finally{usage.close();accounts.close();}
});
test('account sessions share the same account budget and cannot read another account budget; logout keeps guest usage',async()=>{
 const {accounts,usage}=guard();try{const a=await accounts.register('usage_a','synthetic-password-49'),b=await accounts.register('usage_b','synthetic-password-49');
  const visitor=req(),vr=res();usage.reserve(visitor,vr,'chat').release();const guest=jar(vr);
  const cookie=guest+'; first_step_session='+a.token;usage.reserve(req(cookie),res(),'chat').release();const again=await accounts.login('usage_a','synthetic-password-49');assert.equal(usage.snapshot(req('first_step_session='+again.token),res()).chat.used,1);assert.equal(usage.snapshot(req('first_step_session='+b.token),res()).chat.used,0);
  accounts.logout(a.token);assert.equal(usage.snapshot(req(cookie),res()).identity,'guest');assert.equal(usage.snapshot(req(cookie),res()).chat.used,1);
 }finally{usage.close();accounts.close();}
});
test('quota and signed identity survive a restart; Beijing midnight resets usage; files contain no raw network address',()=>{
 const dir=mkdtempSync(join(tmpdir(),'first-step-usage-')),file=join(dir,'usage.sqlite'),accounts=createAccountStore({file:':memory:'});let now=Date.parse('2026-11-06T15:59:59Z'),usage=createUsageGuard({file,accounts,now:()=>now});
 try{const r=req(),s=res();usage.reserve(r,s,'chat').release();const cookie=jar(s);usage.close();usage=createUsageGuard({file,accounts,now:()=>now});assert.equal(usage.snapshot(req(cookie),res()).chat.used,1);now+=2000;const after=usage.snapshot(req(cookie),res());assert.equal(after.chat.used,0);assert.equal(after.day,'2026-11-07');assert.equal(after.resetAt,'2026-11-07T16:00:00.000Z');usage.close();usage=null;assert.equal(readFileSync(file).includes(Buffer.from('203.0.113.7')),false);assert.equal(readFileSync(file).includes(Buffer.from(cookie)),false);
 }finally{usage?.close();accounts.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+'\\')||resolve(dir).startsWith(resolve(tmpdir())+'/'));rmSync(dir,{recursive:true,force:true});}
});
test('leases and counters enforce the global cap across independent guard instances and release exactly once',()=>{
 const dir=mkdtempSync(join(tmpdir(),'first-step-quota-')),file=join(dir,'usage.sqlite'),accounts=createAccountStore({file:':memory:'}),limits={...usageLimits({}),siteChat:2};const a=createUsageGuard({file,accounts,limits}),b=createUsageGuard({file,accounts,limits});
 try{const r=req(),s=res(),lease=a.reserve(r,s,'chat');assert.throws(()=>b.reserve(req(jar(s)),res(),'chat'),e=>e.code==='usage-busy');lease.release();lease.release();b.reserve(req('', '203.0.113.8'),res(),'chat').release();assert.throws(()=>a.reserve(req('','203.0.113.9'),res(),'chat'),e=>e.code==='usage-site');assert.equal(a.snapshot(req(jar(s)),res()).chat.used,1);
 }finally{a.close();b.close();accounts.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+'\\')||resolve(dir).startsWith(resolve(tmpdir())+'/'));rmSync(dir,{recursive:true,force:true});}
});
test('proxy headers are ignored by default and trusted only from an explicitly allowed loopback proxy',()=>{
 assert.equal(networkAddress({...req('', '203.0.113.7'),headers:{'x-real-ip':'198.51.100.9'}},true),'203.0.113.7');assert.equal(networkAddress({...req('','127.0.0.1'),headers:{'x-real-ip':'198.51.100.9'}}),'127.0.0.1');assert.equal(networkAddress({...req('','::ffff:127.0.0.1'),headers:{'x-real-ip':'198.51.100.9'}},true),'198.51.100.9');assert.equal(networkAddress({...req('','127.0.0.1'),headers:{'x-real-ip':'198.51.100.9,1.1.1.1'}},true),'127.0.0.1');
 for(const v of ['-1','NaN','999999',''])assert.throws(()=>usageLimits({FIRST_STEP_LIMIT_GUEST_CHAT:v}));assert.equal(usageLimits({FIRST_STEP_LIMIT_GUEST_CHAT:'0'}).guestChat,0);
});
const call=(name,args)=>({id:'test-call',function:{name,arguments:JSON.stringify(args)}});
const modelReply=()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{tool_calls:[call('plan_tasks',{intent:'guidance',status:'clarify',tasks:[],activeModule:null,questions:[{label:'你遇到了什么事',hint:''}]})]}}]}));
const png=()=>{const b=Buffer.alloc(32);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(100,16);b.writeUInt32BE(100,20);return 'data:image/png;base64,'+b.toString('base64');};
async function app(options={}){
 const accounts=createAccountStore({file:':memory:'}),usage=createUsageGuard({file:':memory:',accounts,limits:options.limits||usageLimits({}),now:options.now||Date.now});let providerCalls=0,settingsCalls=0,seen=[];
 const service=createLocalServices({accounts,usage,config:{apiKey:'synthetic-provided-key',model:'deepseek-flash'},policy:options.policy||createRequestPolicy(),now:options.now,fetcher:async(_url,init)=>{providerCalls++;seen.push(init.headers.Authorization);if(options.provider)return options.provider(init);if(JSON.parse(init.body).tool_choice==='none')return options.fail?new Response('',{status:503}):new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'你好，可以直接和我说。'}}]}));return options.fail?new Response('',{status:503}):modelReply();},settingsFetcher:async(url,init)=>{settingsCalls++;assert.equal(url,'https://api.deepseek.com/models');assert.equal(init.redirect,'error');return new Response(JSON.stringify({data:[{id:'deepseek-flash',input_modalities:['text','image']},{id:'deepseek-v4-pro',input_modalities:['text']}]}));}});
 const server=http.createServer((req,res)=>{if(!service.handle(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;let cookies='';
 const send=async(path,body,method=body?'POST':'GET',extra={})=>{const response=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookies?{Cookie:cookies}:{}),...extra},body:body?JSON.stringify(body):undefined});const set=response.headers.getSetCookie();if(set.length){const jar=new Map(cookies.split('; ').filter(Boolean).map(c=>c.split('=')));for(const s of set){const pair=s.split(';')[0],at=pair.indexOf('=');jar.set(pair.slice(0,at),pair.slice(at+1));}cookies=[...jar].map(([k,v])=>k+'='+v).join('; ');}return {status:response.status,headers:response.headers,body:await response.json()};};
 return {base,send,accounts,get cookies(){return cookies;},set cookies(value){cookies=value;},get providerCalls(){return providerCalls;},get settingsCalls(){return settingsCalls;},seen,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));service.close();usage.close();accounts.close();}};
}
const question={messages:[{role:'user',content:'你好'}]};
test('HTTP quotas charge only validated configured provider attempts; rejected requests never call the provider',async()=>{
 const a=await app({limits:{...usageLimits({}),guestChat:1}});try{assert.equal((await a.send('/api/v1/assistant/chat',{})).status,400);assert.equal((await a.send('/api/v1/usage')).body.data.chat.used,0);assert.equal((await a.send('/api/v1/assistant/chat',question)).status,200);const blocked=await a.send('/api/v1/assistant/chat',question);assert.equal(blocked.status,429);assert.equal(blocked.body.error.code,'usage-personal');assert.ok(Number(blocked.headers.get('retry-after'))>0);assert.equal(a.providerCalls,1);assert.equal((await a.send('/api/v1/usage')).body.data.chat.used,1);}finally{await a.close();}
});
test('provider failure consumes an attempt, releases concurrency and leaves the next attempt usable',async()=>{
 const a=await app({fail:true});try{for(let i=0;i<2;i++)assert.equal((await a.send('/api/v1/assistant/chat',question)).status,502);assert.equal(a.providerCalls,2);assert.equal((await a.send('/api/v1/usage')).body.data.chat.used,2);}finally{await a.close();}
});
test('optional user API tests and selects the personal credential without exposing it; another visitor stays on provided API',async()=>{
 const a=await app();try{const selected=await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});assert.equal(selected.status,200);assert.equal(selected.body.data.mode,'personal');assert.equal(JSON.stringify(selected.body).includes('synthetic-personal-api-key'),false);assert.equal(a.settingsCalls,1);const personal=a.cookies;await a.send('/api/v1/assistant/chat',question);assert.equal(a.seen.at(-1),'Bearer synthetic-personal-api-key');a.cookies='';assert.equal((await a.send('/api/v1/ai/settings')).body.data.mode,'provided');await a.send('/api/v1/assistant/chat',question);assert.equal(a.seen.at(-1),'Bearer synthetic-provided-key');a.cookies=personal;await a.send('/api/v1/ai/settings',undefined,'DELETE');assert.equal((await a.send('/api/v1/ai/settings')).body.data.mode,'provided');assert.equal((await a.send('/api/v1/usage')).body.data.chat.used,0);}finally{await a.close();}
});
test('arbitrary API hosts, foreign origins and invalid models cannot replace the previous working user API',async()=>{
 const a=await app();try{await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});for(const baseUrl of ['http://127.0.0.1','https://evil.test'])assert.equal((await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash',baseUrl})).status,400);assert.equal(a.settingsCalls,1);assert.equal((await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'not-a-model'})).status,400);assert.equal((await a.send('/api/v1/ai/settings')).body.data.mode,'personal');assert.equal((await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'},'POST',{Origin:'https://evil.test'})).status,403);}finally{await a.close();}
});
test('an account switch invalidates the previous user API and a text-only model does not spend an image attempt',async()=>{
 const a=await app();try{await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-v4-pro'});assert.equal((await a.send('/api/v1/contract/extract-image',{image:png()})).status,400);assert.equal(a.providerCalls,0);assert.equal((await a.send('/api/v1/usage')).body.data.image.used,null);const user=await a.accounts.register('settings_a','synthetic-password-49');a.cookies+='; first_step_session='+user.token;assert.equal((await a.send('/api/v1/ai/settings')).body.data.mode,'expired');assert.equal((await a.send('/api/v1/assistant/chat',question)).status,503);assert.equal(a.providerCalls,0);}finally{await a.close();}
});
test('expired temporary keys require an explicit choice, preserve counters and never silently fall back',async()=>{
 let time=fixed;const a=await app({now:()=>time});try{await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});time+=3600001;assert.equal((await a.send('/api/v1/ai/settings')).body.data.mode,'expired');assert.equal((await a.send('/api/v1/assistant/status')).body.data.connection,'expired');assert.equal((await a.send('/api/v1/assistant/chat',question)).status,503);assert.equal(a.providerCalls,0);await a.send('/api/v1/ai/settings',undefined,'DELETE');assert.equal((await a.send('/api/v1/assistant/chat',question)).status,200);assert.equal(a.seen.at(-1),'Bearer synthetic-provided-key');}finally{await a.close();}
});
test('quota rejection before streaming remains a structured HTTP error with no upstream request',async()=>{
 const a=await app({limits:{...usageLimits({}),guestChat:0}});try{const response=await a.send('/api/v1/assistant/chat',question,'POST',{Accept:'application/x-ndjson'});assert.equal(response.status,429);assert.ok(response.headers.get('content-type').includes('application/json'));assert.equal(a.providerCalls,0);}finally{await a.close();}
});
test('disconnecting a streamed request aborts the provider and releases its lease without refunding started usage',async()=>{
 let calls=0,started,aborted;const start=new Promise(r=>started=r),abort=new Promise(r=>aborted=r);const a=await app({provider:async init=>{if(++calls>1)return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'你好，可以直接说。'}}]}));started();return new Promise((_r,reject)=>init.signal.addEventListener('abort',()=>{aborted();reject(Error('aborted'));},{once:true}));}});
 try{await a.send('/api/v1/usage');const controller=new AbortController();const pending=fetch(a.base+'/api/v1/assistant/chat',{method:'POST',headers:{Cookie:a.cookies,'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify(question),signal:controller.signal}).catch(()=>null);await start;controller.abort();await Promise.race([abort,new Promise((_r,reject)=>setTimeout(()=>reject(Error('provider was not aborted')),2000).unref())]);await pending;await new Promise(r=>setImmediate(r));assert.equal((await a.send('/api/v1/assistant/chat',question)).status,200);assert.equal((await a.send('/api/v1/usage')).body.data.chat.used,2);}finally{await a.close();}
});
test('safe client schemas reject malformed counts and secret-bearing API state is never required',()=>{
 assert.equal(validConnection({mode:'personal',configured:true,provider:'DeepSeek',model:'deepseek-flash',expiresAt:'2026-11-06T16:00:00Z'}),true);assert.equal(validConnection({mode:'personal',configured:true,provider:'DeepSeek',model:'x',expiresAt:'invalid'}),false);const v={identity:'guest',day:'2026-11-06',resetAt:'2026-11-06T16:00:00Z',chat:{used:2,limit:20,remaining:18,available:true},image:{used:0,limit:3,remaining:3,available:true},counting:'started-attempts'};assert.equal(validUsage(v),true);assert.equal(validUsage({...v,chat:{...v.chat,remaining:20}}),false);
});

test('自备API不占个人/网络/站点日额；默认额度耗尽仍能用，切回保持原计数',async()=>{
 const a=await app({limits:{...usageLimits({}),guestChat:1,networkChat:1,siteChat:1}});
 try{
  assert.equal((await a.send('/api/v1/assistant/chat',question)).status,200);
  assert.equal((await a.send('/api/v1/assistant/chat',question)).status,429);
  const connected=await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});assert.equal(connected.status,200);
  for(let i=0;i<3;i++)assert.equal((await a.send('/api/v1/assistant/chat',question)).status,200);
  const usage=(await a.send('/api/v1/usage')).body.data;assert.equal(validUsage(usage),true);assert.equal(usage.mode,'personal');assert.equal(usage.chat.limit,null);assert.equal(usage.image.limit,null);assert.equal(usage.counting,'provider-billed');assert.equal(a.seen.at(-1),'Bearer synthetic-personal-api-key');
  await a.send('/api/v1/ai/settings',undefined,'DELETE');const back=(await a.send('/api/v1/usage')).body.data;assert.equal(back.mode,'provided');assert.equal(back.chat.used,1);assert.equal((await a.send('/api/v1/assistant/chat',question)).status,429);
 }finally{await a.close();}
});

test('自备API仍限制同一用户并发和短时频率，不能靠请求体伪造免额度身份',async()=>{
 const {usage,accounts}=guard({limits:{...usageLimits({}),guestChat:0,siteChat:0,networkChat:0,networkMinute:2}});
 try{const request=req(),response=res();const lease=usage.reserve(request,response,'chat',false,'personal');assert.throws(()=>usage.reserve(request,response,'chat',false,'personal'),e=>e.code==='usage-busy');lease.release();usage.reserve(request,response,'chat',false,'personal').release();assert.throws(()=>usage.reserve(request,response,'chat',false,'personal'),e=>e.code==='usage-frequency');assert.equal(usage.snapshot(request,response).chat.used,0);}finally{usage.close();accounts.close();}
 const a=await app({limits:{...usageLimits({}),guestChat:0}});try{const fake=await a.send('/api/v1/assistant/chat',{...question,usageMode:'personal',mode:'personal'});assert.equal(fake.status,429);assert.equal(a.providerCalls,0);}finally{await a.close();}
});

test('每日不限额状态不能被伪装为默认API，过期接口不静默回退',async()=>{
 const resource={used:null,limit:null,remaining:null,available:true},value={mode:'personal',identity:'guest',day:'2026-11-11',resetAt:'2026-11-11T16:00:00Z',chat:resource,image:resource,counting:'provider-billed'};
 assert.equal(validUsage(value),true);assert.equal(validUsage({...value,mode:'provided'}),false);assert.equal(validUsage({...value,chat:{...resource,limit:100}}),false);
 let time=fixed;const a=await app({now:()=>time});try{await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});time+=3600001;const expired=(await a.send('/api/v1/usage')).body.data;assert.equal(expired.mode,'expired');assert.equal(expired.chat.available,false);assert.equal((await a.send('/api/v1/assistant/chat',question)).status,503);assert.equal(a.providerCalls,0);}finally{await a.close();}
});

test('识图共用可信自备身份：默认日额为0仍能识别，切回后恢复原上限',async()=>{
 const a=await app({limits:{...usageLimits({}),guestImage:0,siteImage:0,networkImage:0},provider:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({text:'合成合同原文：工作地点待双方书面确认。',warnings:[]})}}]}))});
 try{
  assert.equal((await a.send('/api/v1/contract/extract-image',{image:png()})).status,429);assert.equal(a.providerCalls,0);
  await a.send('/api/v1/ai/settings',{apiKey:'synthetic-personal-api-key',model:'deepseek-flash'});
  for(let i=0;i<2;i++){const r=await a.send('/api/v1/contract/extract-image',{image:png()});assert.equal(r.status,200);assert.match(r.body.data.text,/合成合同原文/);}
  assert.equal(a.providerCalls,2);assert.equal(a.seen.at(-1),'Bearer synthetic-personal-api-key');
  await a.send('/api/v1/ai/settings',undefined,'DELETE');assert.equal((await a.send('/api/v1/usage')).body.data.image.used,0);assert.equal((await a.send('/api/v1/contract/extract-image',{image:png()})).status,429);assert.equal(a.providerCalls,2);
 }finally{await a.close();}
});
