import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssistantClient,validateAssistantReply,AssistantClientError} from '../src/services/assistant-client.ts';
const data={reply:'合成测试回复',actions:[{kind:'open-tool',module:'salary',label:'打开工资工具'}],steps:[],provider:'DeepSeek',model:'test-model'};
const response=(value:unknown)=>new Response(JSON.stringify({requestId:'fixture',data:value}));
test('assistant client sends only explicit conversation and module to the same-origin endpoint',async()=>{
 let body='',url='';const client=createAssistantClient(async(address,init)=>{url=String(address);body=String(init?.body);assert.equal(init?.credentials,'same-origin');return response(data);});
 await client.chat([{role:'user',content:'合成问题'}],'home');assert.equal(url,'/api/v1/assistant/chat');assert.deepEqual(JSON.parse(body),{messages:[{role:'user',content:'合成问题'}],module:'home'});
});
test('client rejects external destinations, invalid values and unsupported actions',()=>{
 assert.throws(()=>validateAssistantReply({...data,actions:[{kind:'open-tool',module:'https://external.test',label:'invalid'}]}),AssistantClientError);
 assert.throws(()=>validateAssistantReply({...data,actions:[{kind:'apply-salary',label:'invalid',input:{gross:8000,insurance:NaN,fund:0,tax:0,other:0,received:null}}]}),AssistantClientError);
 assert.throws(()=>validateAssistantReply({...data,actions:[{kind:'run-code',label:'invalid'}]}),AssistantClientError);
});
test('configured status does not invent a successful conversation',async()=>{
 const client=createAssistantClient(async()=>response({configured:false,provider:'DeepSeek',model:'test'}));assert.equal((await client.status()).configured,false);
});
test('cancelled requests are stopped and HTTP failures keep safe server errors',async()=>{
 let calls=0;const controller=new AbortController();controller.abort();const client=createAssistantClient(async()=>{calls++;return response(data);});await assert.rejects(client.chat([{role:'user',content:'test'}],'home',controller.signal),error=>error instanceof AssistantClientError&&error.code==='aborted');assert.equal(calls,0);
 const unavailable=createAssistantClient(async()=>new Response(JSON.stringify({error:{code:'not-configured',message:'请配置本机服务'}}),{status:503}));await assert.rejects(unavailable.status(),error=>error instanceof AssistantClientError&&error.code==='not-configured');
});
