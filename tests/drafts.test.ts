import test from 'node:test';
import assert from 'node:assert/strict';

test('route drafts retain the generated case separately from unsaved case changes',()=>{
 const form={scenario:'medical',city:'广州',target:'上海',insured:'employee'},recordForm={...form,scenario:'first',target:''};
 const data={form,recordForm,generated:true,done:{verify:true},notes:{verify:'合成记录'}};
 assert.deepEqual(decodeDraft('social',encodeDraft('social',data)).data,data);
 assert.throws(()=>encodeDraft('social',{...data,recordForm:{...recordForm,scenario:'invented'}}));
 assert.throws(()=>encodeDraft('social',{...data,recordForm:{...recordForm,privateKey:'forbidden'}}));
});
import {decodeDraft,draftKey,encodeDraft,writeDraft} from '../src/lib/drafts.ts';
import type {DraftModule} from '../src/lib/drafts.ts';

const offer={id:'a',name:'合成机会',monthly:'8000',months:'12',rent:'',commute:'0',hours:'',probation:'不清楚',employer:'待确认'};
const fixtures:Record<DraftModule,unknown>={
 contract:{text:'合成合同片段',months:'12',probation:'',scope:'unknown',filename:'合成.txt',sample:false},
 salary:{form:{gross:'8000',insurance:'',fund:'0',tax:'',other:'0',received:''},demo:false},
 subsidy:{schoolCity:'',inGraduatingYear:'unknown',supportCondition:'unknown',claimedBefore:'unknown'},
 offer:{form:[offer,{...offer,id:'b'}],sample:true},
 tax:{form:{income:'120000',insurance:'',additional:'0',other:'0',prepaid:'',resident:false,salaryOnly:false,year:'2026'},sample:false},
 social:{form:{scenario:'medical',city:'合成城市',target:'',insured:'unknown'},generated:true,done:{'step-a':true},notes:{'step-a':'已打电话核实，合成记录'}},
 rent:{text:'合成租房条款',fees:{monthly:'1000',period:'',deposit:'1000',fee:'0'},sample:false},
 leaving:{form:{lastDay:'2026-11-10',mode:'unknown',probation:'unknown',move:'unknown',relation:'unknown',note:'合成备注'},generated:false,done:{},notes:{}},
 chat:{input:'未发送的合成问题',turns:[{role:'user',content:'工资项不清楚'},{role:'assistant',content:'先核实扣款明细。'}]},
};
test('all eight tool drafts and chat round-trip unknowns, zero, notes and unsent input',()=>{
 for(const [module,data] of Object.entries(fixtures)){
  const raw=encodeDraft(module as DraftModule,data,'2026-11-04T01:00:00.000Z');
  assert.deepEqual(decodeDraft(module as DraftModule,raw).data,data,module);
 }
});
test('draft slots isolate owners and pages, and reject wrong module/version and invalid fields',()=>{
 assert.notEqual(draftKey('guest','salary'),draftKey('account-a','salary'));
 assert.notEqual(draftKey('account-a','salary'),draftKey('account-b','salary'));
 assert.notEqual(draftKey('account-a','salary'),draftKey('account-a','contract'));
 const raw=encodeDraft('contract',fixtures.contract);
 assert.throws(()=>decodeDraft('salary',raw));
 assert.throws(()=>decodeDraft('contract',raw.replace('"schema":1','"schema":0')));
 assert.throws(()=>encodeDraft('contract',{...fixtures.contract as object,scope:'assume-fulltime'}));
 assert.throws(()=>decodeDraft('contract','bad json'));
 assert.throws(()=>decodeDraft('contract','x'.repeat(200001)));
});
test('restored chat contains readable text only, never saved executable actions or tool results',()=>{
 const chat=fixtures.chat as {input:string;turns:{role:string;content:string}[]};
 assert.throws(()=>encodeDraft('chat',{...chat,turns:[{...chat.turns[1],actions:[{kind:'apply-salary'}]}]}));
 assert.throws(()=>encodeDraft('chat',{...chat,input:'x'.repeat(6001)}));
 assert.throws(()=>encodeDraft('chat',{...chat,turns:[{role:'system',content:'untrusted'}]}));
});
test('stale operations and quota failures preserve the saved draft and other slots',()=>{
 const data=new Map<string,string>();
 const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{if(value==='quota-error')throw Error('quota');data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
 const key=draftKey('guest','contract'),other=draftKey('account-a','contract');
 const first=encodeDraft('contract',fixtures.contract),second=encodeDraft('contract',{...fixtures.contract as object,text:'更新材料'});
 writeDraft(storage,key,null,first);writeDraft(storage,other,null,first);
 assert.throws(()=>writeDraft(storage,key,null,second));assert.equal(data.get(key),first);
 assert.throws(()=>writeDraft(storage,key,first,'quota-error'));assert.equal(data.get(key),first);
 writeDraft(storage,key,first,second);assert.throws(()=>writeDraft(storage,key,first,null));
 writeDraft(storage,key,second,null);assert.equal(data.has(key),false);assert.equal(data.get(other),first);
 writeDraft(storage,key,null,second);assert.equal(data.get(key),second);
});

test('新福利字段可往返，旧Offer草稿不缺字段，未知枚举和多余键仍拒绝',()=>{
 const form=[{...offer,socialInsurance:'none',housingFund:'after-probation',benefitNotes:'合成福利说明'},{...offer,id:'b'}];
 const data={form,sample:false};assert.deepEqual(decodeDraft('offer',encodeDraft('offer',data)).data,data);
 assert.deepEqual(decodeDraft('offer',encodeDraft('offer',fixtures.offer)).data,fixtures.offer);
 assert.throws(()=>encodeDraft('offer',{...data,form:[{...form[0],housingFund:'yes'},form[1]]}));
 assert.throws(()=>encodeDraft('offer',{...data,form:[{...form[0],benefitNotes:'x'.repeat(1001)},form[1]]}));
 assert.throws(()=>encodeDraft('offer',{...data,form:[{...form[0],unknownField:'bad'},form[1]]}));
});
