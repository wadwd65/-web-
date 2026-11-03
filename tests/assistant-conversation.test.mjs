import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guideReply,runAssistant} from '../tools/assistant-gateway.mjs';

const missing={status:'needs-info',intent:'calculate',activeModule:'salary',tasks:[{module:'salary',reason:'核对工资'}],questions:[{label:'个人社保',hint:''},{label:'公积金',hint:''},{label:'个税',hint:''}]};
const response=message=>new Response(JSON.stringify({choices:[{message,finish_reason:'stop'}]}));
const call=(name,args)=>({id:'synthetic-call',type:'function',function:{name,arguments:JSON.stringify(args)}});

test('missing facts are visible in conversational text and allow an ordinary reply',()=>{
 const reply=guideReply(missing);
 for(const question of missing.questions)assert.ok(reply.includes(question.label));
 assert.match(reply,/直接回复/);assert.match(reply,/不确定/);assert.ok(!/下面|先填|表单/u.test(reply));
 const choice=guideReply({...missing,status:'choose',activeModule:null,tasks:[...missing.tasks,{module:'rent',reason:'租房'}],questions:[]});
 assert.match(choice,/工资明细/);assert.match(choice,/租房核对/);assert.match(choice,/继续把情况讲完/);
});

test('chat input is unconditional and optional structured replies cannot replace it',()=>{
 const chat=readFileSync(new URL('../src/AIAssistant.tsx',import.meta.url),'utf8');
 const options=readFileSync(new URL('../src/AssistantNextStep.tsx',import.meta.url),'utf8');
 assert.match(chat,/<form className="assistant-composer"/);
 assert.ok(!chat.includes('freeReply')&&!chat.includes('hasFields'));
 assert.ok(!chat.includes('assistant-needed-fields input'));
 assert.ok(chat.includes("setInput(current=>current.trim()===value?'':current)"));
 assert.match(options,/<details className="assistant-optional-input">/);
 assert.ok(options.includes("if(guide.status!=='choose'&&!guide.questions.length)return null"));
});

test('free-text correction can change subject before supplying old calculation fields',async()=>{
 const config={apiKey:'synthetic',model:'synthetic'};
 const original='应发工资8000元，我想核对实发。';
 const first=await runAssistant({messages:[{role:'user',content:original}]},{config,fetcher:async()=>response({tool_calls:[call('plan_tasks',missing)]})});
 const correction='先不算工资了。我还没签租房合同，想问签之前押金应该问清什么。';
 const rent={status:'ready',intent:'guidance',activeModule:'rent',tasks:[{module:'rent',reason:'最新问题是签约前的押金约定'}],questions:[]};
 let requests=0;
 const result=await runAssistant({messages:[{role:'user',content:original},{role:'assistant',content:first.reply},{role:'user',content:correction}]},{config,fetcher:async()=>++requests===1?response({tool_calls:[call('plan_tasks',rent)]}):response({content:'先问清押金退还的条件和期限，并写进合同。'})});
 assert.equal(result.guide.activeModule,'rent');assert.equal(result.guide.questions.length,0);
 assert.ok(!result.steps.some(step=>step.name==='calculate_salary'));
 assert.ok(!result.actions.some(action=>action.kind==='apply-salary'));
});

test('already unknown salary fields get a lookup suggestion instead of the same question again',()=>{
 const reply=guideReply({...missing,questions:missing.questions.slice(1)},'公积金：暂时不知道\n个税：暂时不知道');
 assert.ok(!reply.includes('分别是多少'));assert.match(reply,/还没确认/);assert.match(reply,/工资明细/);
 const corrected=guideReply(missing,'公积金不知道。\n公积金600元，个税66元。');
 assert.ok(!corrected.includes('公积金还没确认'));
});

test('ordinary guidance answers directly without an unnecessary navigation call',async()=>{
 const requests=[];
 const guide={status:'ready',intent:'guidance',activeModule:'rent',tasks:[{module:'rent',reason:'签字前的问题'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'我还没签租房合同，签字前要确认什么？'}]},{config:{apiKey:'synthetic'},fetcher:async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  return requests.length===1?response({tool_calls:[call('plan_tasks',guide)]}):response({content:'先把押金退还条件和期限写明。'});
 }});
 assert.equal(requests[1].tool_choice,'none');assert.deepEqual(requests[1].tools,[]);assert.equal(result.actions.length,0);
});

test('explicit navigation still provides the original real tool action',async()=>{
 let requests=0;
 const guide={status:'ready',intent:'guidance',activeModule:'rent',tasks:[{module:'rent',reason:'打开工具'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'打开租房核对工具'}]},{config:{apiKey:'synthetic'},fetcher:async()=>{
  requests++;return requests===1?response({tool_calls:[call('plan_tasks',guide)]}):requests===2?response({tool_calls:[call('open_tool',{module:'rent'})]}):response({content:'可以点入口打开。'});
 }});
 assert.equal(result.actions[0].kind,'open-tool');assert.equal(result.actions[0].module,'rent');
});

test('describing an opened payslip is a question rather than a tool-navigation request',async()=>{
 const requests=[];
 const guide={status:'ready',intent:'guidance',activeModule:'salary',tasks:[{module:'salary',reason:'解释工资条项目'}],questions:[]};
 await runAssistant({messages:[{role:'user',content:'我打开工资条发现扣了几项，想问这些是什么？'}]},{config:{apiKey:'synthetic'},fetcher:async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push(body);
  return requests.length===1?response({tool_calls:[call('plan_tasks',guide)]}):response({content:'可以把扣款项目名称发来。'});
 }});
 assert.equal(requests[1].tool_choice,'none');
});
