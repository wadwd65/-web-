import {isConversationalTurn} from '../src/lib/conversation-tone.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAssistantGuide} from '../src/services/assistant-guide.ts';
import {validateAssistantReply} from '../src/services/assistant-client.ts';
import {executeAssistantTool,runAssistant} from '../tools/assistant-gateway.mjs';
const ready={status:'ready',tasks:[{module:'salary',reason:'核对用户明确提供的工资'}],activeModule:'salary',questions:[]};
const call=(name,args)=>({id:'synthetic',type:'function',function:{name,arguments:JSON.stringify(args)}});
const response=message=>new Response(JSON.stringify({choices:[{message,finish_reason:'stop'}]}));
const config={apiKey:'synthetic-token',model:'synthetic'};
test('plans are bounded to real tasks and distinguish choose, missing information and unavailable scope',()=>{
 assert.equal(validateAssistantGuide(ready).activeModule,'salary');
 const choose={...ready,status:'choose',activeModule:null,tasks:[...ready.tasks,{module:'rent',reason:'押金问题'}]};assert.equal(validateAssistantGuide(choose).tasks.length,2);
 for(const bad of [{...ready,activeModule:'rent'},{...ready,questions:[{label:'多余问题',hint:''}]},{...choose,activeModule:'salary'},{...ready,status:'needs-info'},{...ready,tasks:[{module:'music',reason:'越界'}]},{...ready,status:'out-of-scope'}])assert.throws(()=>validateAssistantGuide(bad));
 assert.throws(()=>validateAssistantReply({reply:'test',provider:'DeepSeek',model:'test',actions:[],steps:[],guide:{...ready,activeModule:'external'}}));
});
test('multiple tasks cannot execute before the user chooses, even if the model emits an extra call',async()=>{
 let count=0;const guide={...ready,status:'choose',activeModule:null,tasks:[...ready.tasks,{module:'rent',reason:'押金问题'}]};
 const result=await runAssistant({messages:[{role:'user',content:'工资和租房两件事'}]},{config,fetcher:async()=>++count===1?response({tool_calls:[call('plan_tasks',guide),call('open_tool',{module:'salary'})]}):response({content:'请选择先办哪一件。'})});
 assert.equal(result.guide.status,'choose');assert.equal(result.actions.length,0);assert.equal(result.steps[1].ok,false);
});
test('correcting the active task blocks an old topic action and all plans are non-executing',async()=>{
 let count=0;const guide={...ready,activeModule:'rent',tasks:[{module:'rent',reason:'用户更正为租房'}]};
 const result=await runAssistant({messages:[{role:'user',content:'不是工资，我要租房'}]},{config,fetcher:async()=>++count===1?response({tool_calls:[call('plan_tasks',guide)]}):count===2?response({tool_calls:[call('open_tool',{module:'salary'})]}):response({content:'先核对押金约定。'})});
 assert.equal(result.actions.length,0);assert.equal(result.guide.activeModule,'rent');
 assert.equal(executeAssistantTool('plan_tasks',ready,'').action,undefined);
});
test('uncertain or retracted amounts and contract scope cannot reuse earlier confirmed facts',()=>{
 const evidence='应发工资8000元，个人社保800元，公积金600元，个税66元，其他扣款0元。';
 const args={gross:8000,insurance:800,fund:600,tax:66,other:0,received:null,evidence};
 for(const correction of ['个人社保800元不对。','个人社保不知道。','个人社保不是800元。'])assert.throws(()=>executeAssistantTool('calculate_salary',args,evidence+'\n'+correction));
 const original='全日制劳动合同，合同期限一年，试用期三个月。',contract={text:original,contractMonths:12,probationMonths:3,fullTimeConfirmed:true};
 for(const correction of ['不是全日制。','我不确定是不是全日制。','合同期限我现在不知道。'])assert.throws(()=>executeAssistantTool('review_contract',contract,original+'\n'+correction));
});
test('salary facts can be grounded in separate user messages and corrected without rewriting evidence',()=>{
 const first='应发工资8000元，个人社保800元。',second='公积金600元，个税66元，其他扣款0元。',correction='更正：个人社保900元。';
 const args={gross:8000,insurance:800,fund:600,tax:66,other:0,received:null,evidence:[first,second]};
 assert.equal(executeAssistantTool('calculate_salary',args,first+'\n'+second).result.net,6534);
 assert.equal(executeAssistantTool('calculate_salary',{...args,insurance:900,evidence:[first,second,correction]},first+'\n'+second+'\n'+correction).result.net,6434);
 assert.throws(()=>executeAssistantTool('calculate_salary',{...args,evidence:[first,'公积金改写为999元。']},first+'\n'+second));
});
test('unknown facts never receive a zero default from a model-written hint',()=>{
 const guide=validateAssistantGuide({...ready,status:'needs-info',intent:'calculate',questions:[{label:'个税',hint:'不确定先填0'}]});
 assert.ok(!guide.questions[0].hint.includes('填0'));assert.match(guide.questions[0].hint,/不知道/);
 assert.throws(()=>validateAssistantGuide({...guide,intent:'guidance'}));
});

test('explicitly deferring salary calculation does not repeat unknown fields, and a later request can resume',async()=>{
 const missing={...ready,status:'needs-info',intent:'calculate',questions:[{label:'个人社保',hint:''}]};
 let calls=0;
 const result=await runAssistant({messages:[{role:'user',content:'应发7200元，个人社保、公积金、个税不知道，其他扣款没有。先别算，也不要再问我数字，只说要去哪里查。'}]},{config,fetcher:async()=>++calls===1?response({tool_calls:[call('plan_tasks',missing)]}):response({content:'可以先向HR索取本期工资条，再核对三项个人扣款。'})});
 assert.equal(result.guide.status,'ready');assert.equal(result.guide.intent,'guidance');assert.deepEqual(result.guide.questions,[]);assert.deepEqual(result.actions,[]);
 calls=0;
 const resumed=await runAssistant({messages:[{role:'user',content:'先别算。现在算工资，应发7200元，其他扣款没有，社保还不知道。'}]},{config,fetcher:async()=>{calls++;return response({tool_calls:[call('plan_tasks',missing)]});}});
 assert.equal(resumed.guide.status,'needs-info');assert.equal(resumed.guide.intent,'calculate');
});
test('missing-information replies use the verified plan without asking the model for speculative prose',async()=>{
 let calls=0;const guide={...ready,status:'needs-info',intent:'calculate',questions:[{label:'个税',hint:'填0'}]};
 const result=await runAssistant({messages:[{role:'user',content:'个税不知道，不猜'}]},{config,fetcher:async()=>{calls++;return response({tool_calls:[call('plan_tasks',guide)]});}});
 assert.equal(calls,1);assert.equal(result.replyOrigin,'guide');assert.equal(result.actions.length,0);assert.match(result.reply,/不确定|还没确认/);
});
test('a vague rent deposit question does not presume a landlord has refused a refund',()=>{
 const guide={...ready,status:'needs-info',intent:'review',activeModule:'rent',tasks:[{module:'rent',reason:'核对押金'}],questions:[{label:'房东不退的理由',hint:''}]};
 assert.throws(()=>executeAssistantTool('plan_tasks',guide,'想先处理租房押金'));
 assert.equal(executeAssistantTool('plan_tasks',guide,'房东说押金不退').guide.activeModule,'rent');
});

test('an invalid guidance follow-up gives a specific correction and can recover to the new topic',async()=>{
 const guide={intent:'guidance',status:'needs-info',activeModule:'rent',tasks:[{module:'rent',reason:'一般退押金流程'}],questions:[{label:'租房阶段',hint:''}]};
 assert.throws(()=>executeAssistantTool('plan_tasks',guide,'想了解退押金流程'),/guidance.*ready/);
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content:'试用期怎么算？'},{role:'user',content:'先不聊这个，我想了解租房押金怎么退'}]},{config,fetcher:async(_url,init)=>{
  count++;
  if(count===1)return response({tool_calls:[call('plan_tasks',guide)]});
  if(count===2){assert.match(JSON.parse(init.body).messages.at(-1).content,/guidance.*ready/);return response({tool_calls:[call('plan_tasks',{...guide,status:'ready',questions:[]})]});}
  return response({content:'可以先查看合同里的押金退还约定，再核对交接记录。'});
 }});
 assert.equal(result.guide.activeModule,'rent');assert.equal(result.references,undefined);assert.equal(result.actions.length,0);
});

test('问候/致谢/不会用不进入办事规划；带业务的问候仍核对必要事实',()=>{
 for(const text of ['你好','你好呀！','在吗','谢谢你','你能做什么？','我不知道怎么说','我不想填表','你的回答太死板了','你好，我第一次用，想知道你能帮我做什么？','您好，我刚毕业，不太会用这个网站，可以先告诉我怎么开始吗？','我不想填表，我就想直接说。你能帮我吗？'])assert.equal(isConversationalTurn(text),true,text);
 for(const text of ['你好，我工资好像少了','谢谢，那我的个税怎么算','社保不交怎么办','你好，我应发8000元','未知的一段话','我不想填表，应发8.5k，社保700，公积金500，个税80，其他扣款没有','第一次用，合同试用期三个月可以吗','你好，我刚毕业，想了解上海求职补贴'])assert.equal(isConversationalTurn(text),false,text);
});
test('普通交流真实调用模型自然回应，不返回任务补问/表单或旧动作',async()=>{
 let calls=0;const result=await runAssistant({module:'salary',messages:[{role:'user',content:'工资还没收到'},{role:'assistant',content:'请补充实际到账'},{role:'user',content:'你好'}]},{config,fetcher:async(_url,init)=>{calls++;const payload=JSON.parse(init.body);assert.equal(payload.tool_choice,'none');assert.deepEqual(payload.tools,[]);assert.match(payload.messages[0].content,/普通交流/);return response({content:'你好，我在。慢慢说就好。'});}});
 assert.equal(calls,1);assert.equal(result.reply,'你好，我在。慢慢说就好。');assert.equal(result.replyOrigin,'model');assert.equal(result.guide,undefined);assert.deepEqual(result.actions,[]);assert.deepEqual(result.steps,[]);
});
