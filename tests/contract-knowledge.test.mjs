import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTRACT_KNOWLEDGE,CONTRACT_EXCERPTS,searchContractKnowledge,contractQueryFromMessages,isContractRetrieval,contractSourcesForCopy} from '../src/lib/contract-knowledge.ts';
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

test('colloquial contract questions prioritize the matching paragraph without overriding explicit articles',()=>{
  for(const [query,id] of [
    ['同一家公司换岗后又要重新约试用期','LC19-2'],
    ['离职后回原公司，又让我试用三个月','LC19-2'],
    ['试用期三个月另加一年合同期','LC19-4'],
    ['劳动合同的保密和商业秘密条款','LC23'],
    ['合同说辞职就交八千违约费','LC25'],
  ])assert.equal(search(query).excerpts[0].id,id,query);
  const evidence=search('试用期 第十九条 合同期限一年以上三年以下，试用期包含在劳动合同期限内');
  assert.equal(evidence.excerpts[0].id,'LC19-1');
});

test('specific follow-ups reuse one recent user topic and never assistant assertions or stale mixed topics',()=>{
  const user=content=>({role:'user',content});
  const query=history=>contractQueryFromMessages(history.map(user));
  assert.equal(search(query(['试用期有次数限制吗','那第二次呢？'])).excerpts[0].id,'LC19-2');
  assert.equal(search(query(['试用期怎么算','那一年呢？'])).excerpts[0].id,'LC19-1');
  for(const history of [
    ['试用期怎么算','这个呢'],
    ['试用期怎么算','先聊工资条','哪条依据？'],
    ['竞业限制和违约金怎么约定','哪条？'],
    ['试用期怎么算','新问题','另一个事情','工资','哪条'],
    ['试用期怎么算','租房合同退押金'],
    ['试用期怎么算','那一年保修呢？'],
    ['试用期怎么算','换个话题','那第二次呢？'],
  ])assert.equal(query(history),history.at(-1));
  assert.equal(contractQueryFromMessages([{role:'assistant',content:'试用期怎么算'},user('那第二次呢？')]),'那第二次呢？');
});

test('gateway feeds follow-up retrieval to the provider without inventing user facts',async()=>{
  const requests=[];
  const result=await runAssistant({messages:[{role:'user',content:'同一单位试用期有次数限制吗'},{role:'assistant',content:'合成历史解释'},{role:'user',content:'那第二次呢？'}]}, {
    config:{apiKey:'synthetic',model:'synthetic'},
    fetcher:async(_url,options)=>{
      const request=JSON.parse(options.body);requests.push(request);
      return requests.length===1?reply({tool_calls:[call(plan)]}):reply({content:'第十九条规定同一用人单位与同一劳动者只能约定一次试用期。'});
    },
  });
  assert.equal(result.references.excerpts[0].id,'LC19-2');
  assert.ok(result.references.query.includes('试用期'));
  assert.equal(requests[0].messages.at(-1).content,'那第二次呢？');
  assert.deepEqual(JSON.parse(requests[1].messages.at(-1).content).contractKnowledge,result.references);
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

test('source guard fallback answers the one-year/six-month question instead of merely pasting law',async()=>{
 const content='换个问题：我这里只核对普通全日制劳动合同的这两句原文：“合同期限一年。试用期六个月。”请解释需要核实什么，并给出能对照的官方依据，不要沿用前面的工资信息。';
 const references=search(content);
 const fallback=finalizeContractExplanation('公司可以另设培训期。整份合同有效。',references);
 assert.equal(fallback.replyOrigin,'guide');assert.match(fallback.reply,/一年以上不满三年/);assert.match(fallback.reply,/六个月超过/);assert.match(fallback.reply,/问 HR/);
 assert.ok(fallback.reply.includes(references.excerpts[0].text));assert.doesNotMatch(fallback.reply,/另设培训期|整份合同有效|已审核通过/);
 const unknown=finalizeContractExplanation('可以另设考察期。',search('合同期限不知道，试用期六个月'));
 assert.doesNotMatch(unknown.reply,/六个月超过|一年属于/);assert.match(unknown.reply,/未知/);
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content}]},{config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call(plan)]}):reply({content:'可以约定考核期。'})});
 assert.equal(result.replyOrigin,'guide');assert.match(result.reply,/六个月超过/);assert.ok(result.steps.some(s=>s.name==='search_contract_knowledge'));
});

test('unsupported assessment or pay advice falls back to exact source and keeps the missing fact explicit',()=>{
  const references=search('同一用人单位调岗后再次约定试用期');
  const result=finalizeContractExplanation('不能再试用。\n\n如果新岗位需要考察，可以约定考核目标或培训安排，也不应降低工资。',references);
  assert.equal(result.replyOrigin,'guide');assert.ok(!result.reply.includes('考核目标'));assert.ok(result.reply.includes(references.excerpts[0].text));assert.match(result.reply,/此前是否已约定过试用期/);
  const qualification=finalizeContractExplanation('如果此前实际履行过一次试用期，第二次就不能再约定。',references);
  assert.equal(qualification.replyOrigin,'guide');assert.ok(!qualification.reply.includes('实际履行'));
  assert.equal(finalizeContractExplanation('试用期包含在劳动合同期限内。',references).replyOrigin,'guide');
  assert.equal(finalizeContractExplanation('核实到底是12个月还是15个月，这决定试用期是否合法。',search('试用期三个月另加一年合同期')).replyOrigin,'guide');
});


test('a full-time scope question is not a declaration of unsupported employment',()=>{
 for(const query of ['我不知道是不是全日制，原文只有试用期三个月。','不确定是否非全日制，想问试用期。','可能是实习协议，暂时不清楚。'])assert.notEqual(searchContractKnowledge(query).status,'out-of-scope',query);
 for(const query of ['这是非全日制合同，试用期怎么约定','我签的是实习协议，想问试用期'])assert.equal(searchContractKnowledge(query).status,'out-of-scope',query);
});

test('short weeks in a contract retrieve the short-term rule without treating every week count as short',()=>{
 for(const query of ['劳动合同只管七个星期，先留十天试用。','劳动合同只有8周，试用期可以约吗？'])assert.equal(search(query).excerpts[0]?.id,'LC19-3');
 assert.notEqual(search('劳动合同期限104周，试用期怎么定').excerpts[0]?.id,'LC19-3');
});

test('an explicit probation-only follow-up inherits one user topic, without borrowing vague or conflicting history',()=>{
 const user=content=>({role:'user',content});
 const query=contractQueryFromMessages([user('劳动合同只写了一段试用期，之后另签正式合同。'),{role:'assistant',content:'合成中性回复'},user('那就后一个，单独写那段算数吗？不用再问月份。')]);
 assert.equal(search(query).excerpts[0]?.id,'LC19-4');
 for(const earlier of ['试用期和竞业限制两件事','试用期说明。先改聊租房','新问题']){
  const latest='那就后一个，单独写那段算数吗？';
  assert.equal(contractQueryFromMessages([user(earlier),user(latest)]),latest);
 }
 const outside=search('只有住宅租赁押金问题，劳动合同摘录能作为房东扣押金的依据吗？');
 assert.equal(outside.status,'out-of-scope');assert.deepEqual(outside.excerpts,[]);
});

test('explanation-only requests respect a declined tool entry',async()=>{
 const content='专项技术培训服务期不知道，只解释依据，不要替我填表。';
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content}]},{config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call(plan)]}):reply({content:'具体数额还不能确定，先核实实际培训费、服务期和未履行部分。'})});
 assert.equal(result.references.status,'matched');assert.deepEqual(result.actions,[]);
});

test('a review-labelled explanation cannot bypass source support checks',async()=>{
 const content='劳动合同仅约定试用期，我只想知道这段期限是否算合同期限，不要代填。';
 const references=search('劳动合同仅约定试用期');
 assert.equal(finalizeContractExplanation('这段期限是劳动合同期限。另外同一单位只能约定一次试用期。',references).replyOrigin,'guide');
 let count=0;
 const result=await runAssistant({messages:[{role:'user',content}]},{config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call({...plan,intent:'review'})]}):reply({content:'试用期不成立，该期限为劳动合同期限。另外同一单位只能约定一次试用期。'})});
 assert.equal(result.replyOrigin,'guide');assert.ok(!result.reply.includes('只能约定一次'));
 assert.ok(result.reply.includes(references.excerpts[0].text));
 assert.equal(finalizeContractExplanation('试用名义会带来试用期工资、解除条件等规则。',search('劳动合同只管八周，试用期')).replyOrigin,'guide');
 assert.equal(finalizeContractExplanation('如果合同里只写了十天试用，没有别的期限，试用期不成立，视为合同期限。',search('劳动合同只管八周，试用期')).replyOrigin,'guide');
 assert.equal(finalizeContractExplanation('试用期不成立，合同本身仍然成立。',references).replyOrigin,'guide');
 assert.equal(finalizeContractExplanation('公司不能拿试用期名义降低这段期间的待遇或随时让你走。',references).replyOrigin,'guide');
 const training=finalizeContractExplanation('培训安排需要考察。',search('专项培训费用与服务期'));
 assert.equal(training.replyOrigin,'guide');assert.match(training.reply,/不能.*计算|不能.*算出/);assert.match(training.reply,/违约金约定|协议约定/);assert.match(training.reply,/计算依据/);
});

test('training service fee guidance cannot bypass contract evidence through the leaving route',async()=>{
 let count=0;
 const wrongRoute={...plan,activeModule:'leaving',tasks:[{module:'leaving',reason:'离职时退还培训费'}]};
 const result=await runAssistant({messages:[{role:'user',content:'专项技术培训服务期离开时要退多少钱？费用和协议都未知，只解释不要填表。'}]}, {config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call(wrongRoute)]}):reply({content:'不能计算具体金额，需要实际培训费凭证、服务期和违约金约定，以及公司计算依据。'})});
 assert.equal(result.guide.activeModule,'contract');assert.equal(result.references.excerpts[0].id,'LC22');assert.deepEqual(result.actions,[]);
 count=0;
 const processOnly=await runAssistant({messages:[{role:'user',content:'培训费服务期问题先放下，现在先看离职流程，不算费用。'}]}, {config:{apiKey:'synthetic'},fetcher:async()=>++count===1?reply({tool_calls:[call(wrongRoute)]}):reply({content:'先确认离职通知、交接事项和资料归还。'})});
 assert.equal(processOnly.guide.activeModule,'leaving');assert.equal(processOnly.references,undefined);
});
