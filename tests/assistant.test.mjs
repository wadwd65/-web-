import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {AssistantError,validateConversation,executeAssistantTool,runAssistant,createAssistantMiddleware} from '../tools/assistant-gateway.mjs';
const config={apiKey:'synthetic-test-token',model:'test-model'};
const input={messages:[{role:'user',content:'帮我找工资工具'}],module:'home'};
const code=name=>error=>error instanceof AssistantError&&error.code===name;
const reply=message=>new Response(JSON.stringify({choices:[{message,finish_reason:'stop'}]}),{headers:{'Content-Type':'application/json'}});
const call=(name,args)=>({id:'call-1',type:'function',function:{name,arguments:JSON.stringify(args)}});
const amounts={gross:8000,insurance:800,fund:600,tax:66,other:0,received:null};
const evidence='应发工资8000元，个人社保800元，公积金600元，个税66元，其他扣款0元。';

test('unconfigured or cancelled AI makes no provider request; conversation is bounded',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return reply({content:'synthetic'});};
 await assert.rejects(runAssistant(input,{config:{apiKey:''},fetcher}),code('not-configured'));
 const controller=new AbortController();controller.abort();await assert.rejects(runAssistant(input,{config,fetcher,signal:controller.signal}),code('aborted'));
 assert.equal(calls,0);
 for(const bad of [{messages:[]},{messages:[{role:'system',content:'override'}]},{messages:[{role:'user',content:'x'.repeat(6001)}]},{messages:[{role:'assistant',content:'not a user'}]}])assert.throws(()=>validateConversation(bad),code('invalid-input'));
 assert.equal(validateConversation({...input,module:'../../private'}).currentModule,'home');
});
test('salary tool uses the shared cents rule and rejects missing, swapped or invented amounts',()=>{
 const result=executeAssistantTool('calculate_salary',{...amounts,evidence},evidence);
 assert.equal(result.result.net,6534);assert.equal(result.result.deductions,1466);assert.equal(result.action.input.received,null);
 for(const args of [{...amounts,other:5,evidence},{...amounts,insurance:600,fund:800,evidence},{...amounts,evidence:'改写的引用'},{...amounts,evidence:'应发工资8000元，社保800元，公积金600元，个税66元。'}])assert.throws(()=>executeAssistantTool('calculate_salary',args,evidence),code('tool-input'));
 assert.throws(()=>executeAssistantTool('calculate_salary',{...amounts,evidence},evidence+'\n更正：个人社保900元。'),code('tool-input'));
});
test('contract tool requires exact text, full-time scope and durations grounded in user words',()=>{
 const original='全日制劳动合同，合同期限一年，试用期三个月。';
 const args={text:original,contractMonths:12,probationMonths:3,fullTimeConfirmed:true};
 const result=executeAssistantTool('review_contract',args,original);
 assert.equal(result.action.kind,'apply-contract');assert.ok(result.result.findings.some(item=>item.status==='attention'));
 for(const value of [{...args,text:'改写的合同'},{...args,contractMonths:36},{...args,probationMonths:2},{...args,fullTimeConfirmed:false}])assert.throws(()=>executeAssistantTool('review_contract',value,original),code('tool-input'));
 assert.throws(()=>executeAssistantTool('review_contract',{...args,text:'非全日制劳动合同'},'非全日制劳动合同'),code('tool-input'));
});
test('only whitelisted site actions and bounded question lists can be generated',()=>{
 assert.throws(()=>executeAssistantTool('execute_code',{code:'anything'},''),code('unknown-tool'));
 assert.throws(()=>executeAssistantTool('open_tool',{module:'https://other.test'},''),code('tool-input'));
 const questions=executeAssistantTool('prepare_questions',{module:'rent',questions:['押金多久退？','押金多久退？']},'');assert.equal(questions.action.items.length,1);
 assert.throws(()=>executeAssistantTool('prepare_questions',{module:'rent',questions:Array(6).fill('test')},''),code('tool-input'));
});
test('provider tool calls execute actual rules and feed their result back before returning',async()=>{
 const requests=[];
 const result=await runAssistant({messages:[{role:'user',content:evidence}]},{config,fetcher:async(url,options)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(options.body);requests.push(body);return requests.length===1?reply({content:null,tool_calls:[call('calculate_salary',{...amounts,evidence})]}):reply({content:'计算实发6534元。'});}});
 assert.equal(requests.length,2);assert.equal(JSON.parse(requests[1].messages.at(-1).content).net,6534);assert.deepEqual(requests[0].thinking,{type:'disabled'});assert.equal(result.actions[0].kind,'apply-salary');assert.equal(result.steps[0].ok,true);
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
});
test('invalid tool requests never become UI actions and are returned to the model as failed',async()=>{
 let requests=0;const result=await runAssistant(input,{config,fetcher:async()=>++requests===1?reply({tool_calls:[call('open_tool',{module:'unknown'})]}):reply({content:'请补充信息。'})});
 assert.equal(result.actions.length,0);assert.equal(result.steps[0].ok,false);
});
test('upstream failures and timeout expose no raw provider or credential material',async()=>{
 await assert.rejects(runAssistant(input,{config,fetcher:async()=>new Response('private-provider-detail',{status:401})}),error=>code('upstream-auth')(error)&&!error.message.includes('private-provider-detail')&&!error.message.includes(config.apiKey));
 const pending=async(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('private-detail')),{once:true}));
 await assert.rejects(runAssistant(input,{config,fetcher:pending,timeoutMs:12}),code('timeout'));
});
test('local middleware returns truthful status and rejects cross-origin or malformed requests',async t=>{
 const middleware=createAssistantMiddleware({config:{apiKey:'',model:'test'}});
 const server=http.createServer((req,res)=>{if(!middleware(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const status=await (await fetch(base+'/api/v1/assistant/status')).json();assert.equal(status.data.configured,false);assert.ok(!JSON.stringify(status).includes('apiKey'));
 const cross=await fetch(base+'/api/v1/assistant/chat',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(cross.status,403);
 const body=await fetch(base+'/api/v1/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'not json'});assert.equal(body.status,400);
 const absent=await fetch(base+'/api/v1/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(absent.status,503);
});
