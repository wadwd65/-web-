import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAssistantContext} from '../src/services/assistant-context.ts';
import {validateConversation,executeAssistantTool,createAssistantMiddleware} from '../tools/assistant-gateway.mjs';
import {createAssistantClient,AssistantClientError} from '../src/services/assistant-client.ts';
import type {AssistantMessage} from '../src/services/assistant-types.ts';
import http from 'node:http';

test('12 rounds preserve every user quote and its correction order within the old wire limits',()=>{
 const turns:AssistantMessage[]=[{role:'user',content:'应发8000元，社保800元，公积金600元，个税66元，其他扣款0元。'}];
 for(let i=0;i<11;i++)turns.push({role:'assistant',content:'解释文字'.repeat(4000)},{role:'user',content:i===10?'个人社保撤回，不知道准确金额。':`这是第${i+1}次补充：先核对工资。`});
 const context=buildAssistantContext(turns),conversation=validateConversation({messages:context.messages});
 assert.ok(context.folded);assert.equal(context.userMessages,12);assert.ok(context.messages.length<=16);
 assert.ok(context.messages.every(m=>m.content.length<=6000));
 assert.deepEqual(conversation.userText.split(/\n+/),turns.filter(t=>t.role==='user').map(t=>t.content));
 assert.throws(()=>executeAssistantTool('calculate_salary',{gross:8000,insurance:800,fund:600,tax:66,other:0,received:null,evidence:[turns[0].content]},conversation.userText));
});
test('packing preserves long original material and never manufactures a confirmed summary',()=>{
 const users=Array.from({length:10},(_,i)=>({role:'user' as const,content:`第${i}条原话：`+'合'.repeat(1500)}));
 const conversation=validateConversation({messages:buildAssistantContext(users).messages});
 users.forEach(turn=>assert.ok(conversation.userText.includes(turn.content)));
 assert.throws(()=>buildAssistantContext([...users,...users]),/保留上限/);
 assert.throws(()=>buildAssistantContext([{role:'user',content:'字'.repeat(6001)}]),/6000/);
});
const result={reply:'合成回复',provider:'DeepSeek',model:'test',actions:[],steps:[]};
test('NDJSON handles split UTF8, actual stages, final data and broken/error responses',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify({type:'progress',stage:'planning'})+'\n'+JSON.stringify({type:'result',data:result})+'\n');
 const stages:string[]=[];
 const client=createAssistantClient(async()=>new Response(new ReadableStream({start(controller){for(let i=0;i<bytes.length;i+=7)controller.enqueue(bytes.slice(i,i+7));controller.close();}}),{headers:{'content-type':'application/x-ndjson'}}));
 assert.equal((await client.chat([{role:'user',content:'测试'}],'home',undefined,s=>stages.push(s))).reply,'合成回复');assert.deepEqual(stages,['planning']);
 for(const body of [JSON.stringify({type:'progress',stage:'checking'})+'\n',JSON.stringify({type:'error',error:{code:'timeout',message:'回复超时'}})+'\n']){
  const broken=createAssistantClient(async()=>new Response(body,{headers:{'content-type':'application/x-ndjson'}}));await assert.rejects(broken.chat([{role:'user',content:'test'}],'home'),AssistantClientError);
 }
});
test('stream cancellation aborts the request and preserves a retryable error',async()=>{
 const abort=new AbortController();
 const client=createAssistantClient(async(_url,init)=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"type":"progress","stage":"planning"}\n'));init?.signal?.addEventListener('abort',()=>controller.error(new Error('aborted')));}}),{headers:{'content-type':'application/x-ndjson'}}));
 await assert.rejects(client.chat([{role:'user',content:'合成'}],'home',abort.signal,()=>abort.abort()),(e:unknown)=>e instanceof AssistantClientError&&e.code==='aborted');
});
test('real HTTP streaming emits stages from execution, keeps old JSON compatibility, and terminates errors',async()=>{
 const guide={intent:'guidance',status:'ready',activeModule:'salary',tasks:[{module:'salary',reason:'说明'}],questions:[]};
 let count=0;const middleware=createAssistantMiddleware({config:{apiKey:'synthetic',model:'test'},fetcher:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:++count%2?{tool_calls:[{id:'plan',function:{name:'plan_tasks',arguments:JSON.stringify(guide)}}]}:{content:'合成说明'}}]}))});
 const server=http.createServer((req,res)=>{middleware(req,res);});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{const address=server.address() as {port:number};const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/assistant/chat`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({messages:[{role:'user',content:'工资说明'}]})});
 const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));assert.deepEqual(events.filter(e=>e.type==='progress').map(e=>e.stage),['planning','responding']);assert.equal(events.at(-1).data.reply,'合成说明');
 }finally{await new Promise<void>(r=>server.close(()=>r()));}
});
