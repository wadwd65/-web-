import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';
import {createAccountStore,createAccountMiddleware,validateMemory} from '../tools/account-service.mjs';
import {validateImage,validateExtraction,extractContractImage} from '../tools/contract-image.mjs';
import {runAssistant} from '../tools/assistant-gateway.mjs';
import {salaryQuestion,contractQuestion,isQuestion,isQuestionEvidence,sameQuestion,questionExport,evidenceSources} from '../src/lib/checklist.ts';
import {analyzeContract,DEMO_CONTRACT} from '../src/lib/contracts.ts';

const reviewed={id:'synthetic-review',text:DEMO_CONTRACT,material:'合成材料',at:'2026-11-04T02:00:00.000Z',contractMonths:12,probationMonths:3};
const finding=analyzeContract({text:DEMO_CONTRACT,contractMonths:12,probationMonths:3})[0];

test('contract questions retain exact reviewed quotation, confirmed values and bounded official sources',()=>{
 const draft=contractQuestion(finding,reviewed),e=draft.evidence;
 assert.ok(isQuestionEvidence(e));assert.equal(reviewed.text.slice(e.offset,e.offset+e.quote.length),e.quote);
 assert.equal(e.contractMonths,12);assert.equal(e.probationMonths,3);assert.ok(e.excerptIds.includes('LC19-1'));
 assert.ok(evidenceSources(e).excerpts.every(item=>e.excerptIds.includes(item.id)));
 const missing=contractQuestion({...finding,quote:'not in source'},reviewed).evidence;
 assert.equal(missing.quote,'');assert.equal(missing.offset,null);
 const long='试用期'+ '文'.repeat(2000);const capped=contractQuestion({...finding,quote:long},{...reviewed,text:long}).evidence;
 assert.equal(capped.quote.length,600);assert.equal(capped.offset,0);
});

test('checklist accepts old records and rejects malformed metadata and arbitrary references',()=>{
 const q={id:'old',text:'旧问题',category:'合同',done:false};assert.ok(isQuestion(q));
 const e=contractQuestion(finding,reviewed).evidence;
 assert.equal(isQuestion({...q,evidence:{...e,excerptIds:['https://wrong.example']}}),false);
 assert.equal(isQuestion({...q,evidence:{...e,quote:'',offset:0}}),false);
 assert.equal(isQuestion({...q,answer:'a'.repeat(1501)}),false);
 assert.equal(isQuestionEvidence({...e,contractMonths:Infinity}),false);
 assert.equal(evidenceSources({...e,corpusId:'old-version'}).excerpts.length,0);
});

test('deduplication preserves a rewritten question and separate material reviews',()=>{
 const a=contractQuestion(finding,reviewed);
 assert.equal(sameQuestion(a,{...a,text:'我自己改写的问题'}),true);
 assert.equal(sameQuestion(a,contractQuestion(finding,{...reviewed,id:'another-review'})),false);
 assert.equal(sameQuestion({text:'问题',category:'x'},{text:' 问题 ',category:'x'}),true);
});

test('account saving and export preserve evidence and user answers',async()=>{
 const store=createAccountStore({file:':memory:'});
 try{
  const account=await store.register('evidence_case','synthetic-password-36');
  const draft=contractQuestion(finding,reviewed),q={...draft,id:'q',done:true,text:'我改写的提问',answer:'合成答复记录'};
  store.save(account.token,{city:'',stage:'',notes:'',questions:[q]});
  const restored=store.current(account.token).memory.questions[0];assert.deepEqual(restored,q);
  const output=questionExport([restored]);
  for(const part of ['合成答复记录','原核对建议','合成材料',draft.evidence.quote,'第十九条','https://fgk.chinatax.gov.cn/'])assert.ok(output.includes(part),part);
  assert.equal(output.includes('undefined'),false);
 }finally{store.close();}
});

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

test('unreadable markers always carry a correction warning without guessing text',()=>{
 const result=validateExtraction({text:'月薪 [无法辨认]',warnings:[]});
 assert.equal(result.text,'月薪 [无法辨认]');assert.equal(result.warnings.length,1);assert.match(result.warnings[0],/对照原图/);
});

test('image service recovers safely from blank, truncated, malformed and unavailable responses',async()=>{
 const run=choice=>extractContractImage(png(),{config:{apiKey:'synthetic'},fetcher:async()=>new Response(JSON.stringify({choices:[choice]}))});
 await assert.rejects(run({finish_reason:'stop',message:{content:JSON.stringify({text:' ',warnings:['空白页']})}}),/没有读到/);
 await assert.rejects(run({finish_reason:'length',message:{content:'{}'}}),/文字过多/);
 await assert.rejects(run({finish_reason:'stop',message:{content:'invalid JSON'}}),/结果不完整/);
 await assert.rejects(extractContractImage(png(),{config:{apiKey:'synthetic'},fetcher:async()=>new Response('',{status:429})}),/暂不可用/);
 assert.equal((await run({finish_reason:'stop',message:{content:JSON.stringify({text:'合成合同原文',warnings:[]})}})).text,'合成合同原文');
});

test('image timeout aborts the provider request and releases the timer',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let providerSignal;
 const pending=extractContractImage(png(),{config:{apiKey:'synthetic'},fetcher:async(_url,init)=>{
  providerSignal=init.signal;
  return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
 }});
 t.mock.timers.tick(50000);
 await assert.rejects(pending,/等待较久/);assert.equal(providerSignal.aborted,true);
});


test('an optional account preserves a salary snapshot even after the question is reworded',async()=>{
 const store=createAccountStore({file:':memory:'});
 try{
  const {token}=await store.register('synthetic_salary','synthetic-pass-123');
  const draft=salaryQuestion({gross:9000,insurance:800,fund:600,tax:100,other:0,received:7450},{id:'synthetic-pay-review',at:'2026-11-06T08:00:00Z',demo:false});
  const question={...draft,id:'synthetic-question',done:false,text:'请核对这笔50元的差额',answer:'等工资明细'};
  const memory=validateMemory({city:'',stage:'',notes:'',questions:[question]});
  store.save(token,memory);
  const saved=store.current(token).memory.questions[0];
  assert.deepEqual(saved.evidence,question.evidence);assert.equal(saved.answer,'等工资明细');
  assert.match(questionExport([saved]),/7,450.00/);
 }finally{store.close();}
});
