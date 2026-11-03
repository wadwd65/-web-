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
