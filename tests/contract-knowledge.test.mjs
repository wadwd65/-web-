import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT_KNOWLEDGE,CONTRACT_EXCERPTS,searchContractKnowledge,isContractRetrieval,contractSourcesForCopy} from '../src/lib/contract-knowledge.ts';
import {runAssistant,finalizeContractExplanation} from '../tools/assistant-gateway.mjs';
import {validateAssistantReply} from '../src/services/assistant-client.ts';

const today='2026-11-03';
const search=query=>searchContractKnowledge(query,{today});
const reply=message=>new Response(JSON.stringify({choices:[{message,finish_reason:'stop'}]}));
const plan={status:'ready',intent:'guidance',tasks:[{module:'contract',reason:'了解试用期规则'}],activeModule:'contract',questions:[]};
const call=args=>({id:'synthetic-plan',type:'function',function:{name:'plan_tasks',arguments:JSON.stringify(args)}});

test('lexical retrieval returns topic-specific official excerpts rather than a fixed list',()=>{
  assert.equal(search('同一单位调岗，能再次约定试用期吗？').excerpts[0].id,'LC19-2');
  assert.equal(search('合同只签试用期，不计入正式期限').excerpts[0].id,'LC19-4');
  assert.equal(search('合同期限一年，试用期几个月？').excerpts[0].id,'LC19-1');
  assert.equal(search('签合同必须写明哪些条款，工作地点在哪里？').excerpts[0].id,'LC17');
  assert.equal(search('普通离职要赔违约金吗？').excerpts[0].id,'LC25');
  assert.equal(search('专项培训费用和服务期').excerpts[0].id,'LC22');
  for(const query of ['试用期怎么算','合同地点','竞业限制']){
    const result=search(query);assert.equal(result.status,'matched');assert.ok(isContractRetrieval(result));
    assert.ok(result.excerpts.every(item=>CONTRACT_EXCERPTS.some(original=>original.id===item.id&&original.text===item.text)));
    assert.ok(contractSourcesForCopy(result).includes(CONTRACT_KNOWLEDGE.url));
  }
});

test('irrelevant, inapplicable and historical requests cannot borrow current excerpts',()=>{
  for(const query of ['火星旅行需要多少燃料','劳动仲裁时效多久','试用期最低工资是多少'])assert.equal(search(query).status,'no-match');
  for(const query of ['非全日制合同试用期','香港的合同试用期','劳务派遣合同试用期','实习协议签字前看什么']){
    const result=search(query);assert.equal(result.status,'out-of-scope');assert.equal(result.excerpts.length,0);
  }
  assert.equal(search('2007年版试用期原文').status,'unsupported-version');
  const correction=searchContractKnowledge('试用期多久',{today,context:'我签实习协议。\n更正，现在签的是全日制劳动合同。'});
  assert.equal(correction.status,'matched');
});

test('a review deadline expires the knowledge snapshot, without claiming the law has expired',()=>{
  const result=searchContractKnowledge('试用期多久',{today:'2027-02-02'});
  assert.equal(result.status,'needs-refresh');assert.deepEqual(result.excerpts,[]);assert.match(result.message,/不表示法律失效/);
  assert.equal(searchContractKnowledge('试用期多久',{today:'2026-11-02'}).status,'needs-refresh');
});

test('client source validation rejects invented, edited, duplicated and oversized evidence',()=>{
  const valid=search('合同期限一年，试用期几个月？');
  const base={reply:'合成模型解释',actions:[],steps:[],provider:'DeepSeek',model:'synthetic',references:valid};
  assert.ok(validateAssistantReply(base).references);
  for(const references of [
    {...valid,corpusId:'made-up'},
    {...valid,status:'no-match'},
    {...valid,excerpts:[{...valid.excerpts[0],text:'编造的法律原文'}]},
    {...valid,excerpts:[valid.excerpts[0],valid.excerpts[0]]},
    {...valid,query:'x'.repeat(201)},
  ])assert.throws(()=>validateAssistantReply({...base,references}));
});

test('actual retrieval is fed to the provider before an explanation and is returned separately',async()=>{
  const requests=[],stages=[];
  const result=await runAssistant({messages:[{role:'user',content:'合同期限一年，试用期几个月？'}]}, {
    config:{apiKey:'synthetic',model:'synthetic'},onProgress:stage=>stages.push(stage),
    fetcher:async(_url,options)=>{
      const request=JSON.parse(options.body);requests.push(request);
      return requests.length===1?reply({tool_calls:[call(plan)]}):reply({content:'根据这次检索的第十九条，满一年、不满三年的合同，试用期不得超过二个月。'});
    },
  });
  const tool=JSON.parse(requests[1].messages.at(-1).content);
  assert.equal(requests[1].tool_choice,'none');
  assert.deepEqual(requests[1].tools,[]);
  assert.equal(tool.contractKnowledge.excerpts[0].id,'LC19-1');
  assert.deepEqual(tool.contractKnowledge,result.references);
  assert.equal(tool.referenceNotes,undefined);
  assert.ok(stages.includes('retrieving'));
  assert.ok(result.actions.some(action=>action.kind==='open-tool'&&action.module==='contract'));
  assert.ok(result.steps.some(step=>step.name==='search_contract_knowledge'&&step.ok));
  assert.equal(validateAssistantReply(result).references.status,'matched');
});

test('no matching or applicable evidence ends safely before speculative model generation',async()=>{
  for(const content of ['香港的合同试用期多久','劳动仲裁时效多久','2007年版试用期原文']){
    let count=0;
    const result=await runAssistant({messages:[{role:'user',content}]},{config:{apiKey:'synthetic'},fetcher:async()=>{count++;return reply({tool_calls:[call(plan)]});}});
    assert.equal(count,1);assert.equal(result.replyOrigin,'guide');assert.equal(result.references.excerpts.length,0);assert.equal(result.actions.length,0);
  }
});

test('unrelated tasks and missing contract facts do not trigger retrieval',async()=>{
  for(const guide of [{...plan,activeModule:'salary',tasks:[{module:'salary',reason:'工资'}]},{...plan,status:'needs-info',intent:'review',questions:[{label:'用工类型',hint:'确认后再核对'}]}]){
    let count=0;
    const result=await runAssistant({messages:[{role:'user',content:'合成测试'}]},{config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call(guide)]}):reply({content:'合成解释'})});
    assert.equal(result.references,undefined);
  }
});

test('explicit unsupported contract scope still gets an explanation when the planner asks to clarify',async()=>{
  const guide={status:'clarify',intent:'guidance',tasks:[],activeModule:null,questions:[{label:'想问什么',hint:''}]};
  const result=await runAssistant({messages:[{role:'user',content:'香港的劳动合同试用期多久'}]},{config:{apiKey:'synthetic'},fetcher:async()=>reply({tool_calls:[call(guide)]})});
  assert.equal(result.guide.status,'out-of-scope');assert.equal(result.guide.questions.length,0);assert.equal(result.references.status,'out-of-scope');assert.match(result.reply,/地区或用工/);
});

test('contract explanation removes repeated upload invitations and never presents PDF OCR as available',()=>{
  const references=search('试用期多久');
  const result=finalizeContractExplanation('请按实际合同期限对照第十九条。\n\n想逐条核对，照片或PDF请走图片识别入口。',references);
  assert.equal(result.reply,'请按实际合同期限对照第十九条。');assert.equal(result.replyOrigin,'model');
  const fallback=finalizeContractExplanation('PDF可自动识别。',references);
  assert.equal(fallback.replyOrigin,'guide');assert.ok(fallback.reply.includes(references.excerpts[0].text));
});

test('PDF guidance uses a real entry and accurately states preview-only support',async()=>{
  const result=await runAssistant({messages:[{role:'user',content:'怎么导入PDF劳动合同？'}]},{config:{apiKey:'synthetic'},fetcher:async()=>reply({tool_calls:[call(plan)]})});
  assert.match(result.reply,/只能.*预览/);assert.equal(result.actions[0].kind,'open-tool');assert.equal(result.references,undefined);
});

test('unsupported assessment or pay advice falls back to exact source and keeps the missing fact explicit',()=>{
  const references=search('同一用人单位调岗后再次约定试用期');
  const result=finalizeContractExplanation('不能再试用。\n\n如果新岗位需要考察，可以约定考核目标或培训安排，也不应降低工资。',references);
  assert.equal(result.replyOrigin,'guide');assert.ok(!result.reply.includes('考核目标'));assert.ok(result.reply.includes(references.excerpts[0].text));assert.match(result.reply,/此前是否已约定过试用期/);
});
