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

test('the tool-page question is forwarded through the real shared conversation entry',()=>{
 const directory=readFileSync(new URL('../src/ToolDirectory.tsx',import.meta.url),'utf8');
 const workspace=readFileSync(new URL('../src/ExperienceWorkspace.tsx',import.meta.url),'utf8');
 assert.ok(directory.includes('onAsk(question.trim())'));
 assert.ok(workspace.includes('<ToolDirectory go={go} onAsk={text=>ask(text)}/>'));
 assert.ok(directory.includes('maxLength={6000}'));
 assert.ok(!directory.includes('tool-directory-number'));
});


test('a mistaken missing-other plan proceeds to a real grounded tool call after explicit absence',async()=>{
 const config={apiKey:'synthetic',model:'synthetic'};
 const original='应发9000元，社保800元，公积金600元，个税100元，其他扣款没有，到账7450元。';
 const args={gross:9000,insurance:800,fund:600,tax:100,other:0,received:7450,evidence:[original]};
 const wrongPlan={...missing,questions:[{label:'其他扣款',hint:''}]};
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content:original}]},{config,fetcher:async(_url,init)=>{
  count++;const body=JSON.parse(init.body);
  if(count===1)return response({tool_calls:[call('plan_tasks',wrongPlan)]});
  if(count===2){assert.equal(body.tool_choice.function.name,'calculate_salary');return response({tool_calls:[call('calculate_salary',args)]});}
  return response({content:'按已知金额计算实发7500元，到账少50元，先确认明细。'});
 }});
 assert.equal(result.guide.status,'ready');assert.equal(result.actions[0].input.other,0);assert.equal(result.actions[0].input.gross,9000);
 assert.ok(result.steps.some(step=>step.name==='calculate_salary'&&step.ok));
});

test('a request for the first step becomes guidance instead of an amount questionnaire',async()=>{
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content:'我刚入职，只知道应发9000，社保公积金不清楚，我应该从哪一步开始？'}]},{config:{apiKey:'synthetic'},fetcher:async(_url,init)=>{
  count++;if(count===1)return response({tool_calls:[call('plan_tasks',missing)]});
  assert.equal(JSON.parse(init.body).tool_choice,'none');
  return response({content:'先向HR要一份本期工资明细，对照银行到账记录，未知扣款不要猜。'});
 }});
 assert.equal(result.guide.intent,'guidance');assert.equal(result.guide.questions.length,0);assert.equal(result.actions.length,0);
 assert.match(result.reply,/先向HR/);assert.equal(result.replyOrigin,'model');
});


test('a question request selects its tool once and then disables further tools',async()=>{
 let count=0;const guide={status:'ready',intent:'questions',activeModule:'leaving',tasks:[{module:'leaving',reason:'离职交接问题'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'帮我列个和HR确认交接事项的问题清单，不计算日期。'}]},{config:{apiKey:'synthetic'},fetcher:async(_url,init)=>{
  count++;const body=JSON.parse(init.body);
  if(count===1)return response({tool_calls:[call('plan_tasks',guide)]});
  if(count===2){assert.equal(body.tool_choice.function.name,'prepare_questions');assert.ok(!body.tools.some(t=>t.function.name==='plan_tasks'));return response({tool_calls:[call('prepare_questions',{module:'leaving',questions:['设备交给谁，能否留一份确认记录？']})]});}
  assert.equal(body.tool_choice,'none');assert.deepEqual(body.tools,[]);return response({content:'可以先确认设备交接对象，问题已经整理在下方。'});
 }});
 assert.equal(count,3);assert.equal(result.actions.length,1);assert.equal(result.replyOrigin,'model');
});

test('an upstream repeated tool call cannot discard a valid completed action or loop',async()=>{
 let count=0;const guide={status:'ready',intent:'questions',activeModule:'leaving',tasks:[{module:'leaving',reason:'交接'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'帮我整理离职要问HR的问题。'}]},{config:{apiKey:'synthetic'},fetcher:async()=>{
  count++;return response({tool_calls:[call(count===1?'plan_tasks':'prepare_questions',count===1?guide:{module:'leaving',questions:['交接由谁确认？']})]});
 }});
 assert.equal(count,3);assert.equal(result.actions.length,1);assert.equal(result.steps.filter(s=>s.name==='prepare_questions').length,1);assert.equal(result.replyOrigin,'guide');
});


test('an entry-only action cannot claim a review was completed during fallback',async()=>{
 let count=0;const guide={status:'ready',intent:'review',activeModule:'leaving',tasks:[{module:'leaving',reason:'需要交接工具'}],questions:[]};
 const result=await runAssistant({messages:[{role:'user',content:'我想处理离职交接。'}]},{config:{apiKey:'synthetic'},fetcher:async()=>{
  count++;return response({tool_calls:[call(count===1?'plan_tasks':'open_tool',count===1?guide:{module:'leaving'})]});
 }});
 assert.equal(result.actions[0].kind,'open-tool');assert.match(result.reply,/入口/);assert.ok(!result.reply.includes('核对已完成'));assert.equal(result.replyOrigin,'guide');
});
