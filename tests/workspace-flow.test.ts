import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isolatedContext,communicationPrompt} from '../src/lib/communication.ts';
import {decodeDraft,encodeDraft} from '../src/lib/drafts.ts';
import {pdfPageText,PDF_LIMITS} from '../src/lib/pdf-text-layout.ts';
import {POLICY_CITIES,reviewedCityPolicies,isCityPolicyResult} from '../src/lib/city-policies.ts';

test('selected communication transmits only its own context, including after follow-up, retry and draft restore',()=>{
 const turns=[{role:'user' as const,content:'旧工资，不能带入'},{role:'assistant' as const,content:'旧答复'},
  {role:'user' as const,content:'选中的合成条款',contextStart:true},{role:'assistant' as const,content:'本项草稿'},
  {role:'user' as const,content:'请语气再缓和一些'}];
 assert.deepEqual(isolatedContext(turns),turns.slice(2).map(({role,content})=>({role,content})));
 const saved=decodeDraft('chat',encodeDraft('chat',{input:'未发片段',inputIsolated:true,turns})).data as {turns:typeof turns;inputIsolated:boolean};
 assert.equal(saved.inputIsolated,true);assert.deepEqual(isolatedContext(saved.turns),isolatedContext(turns));
 assert.deepEqual(isolatedContext(turns.slice(0,2)),turns.slice(0,2));
 assert.deepEqual(isolatedContext([...turns,{role:'user',content:'另一独立条款',contextStart:true}]),[{role:'user',content:'另一独立条款'}]);
 assert.throws(()=>encodeDraft('chat',{input:'',turns:[],inputIsolated:'yes'}));
});
test('communication prompt is bounded and distinguishes observation from a legal determination',()=>{
 const text=communicationPrompt({title:'试用期',quote:'合成条款'.repeat(1000),observation:'本轮需要核对',question:'怎样确认期限',recipient:'HR'});
 assert.ok(text.length<6000);assert.match(text,/待确认事项说成已确定违法/);assert.match(text,/本地核对提示（待核实）/);
 assert.match(communicationPrompt({title:'条款缺项',quote:'',observation:'未定位',question:'请提供完整约定',recipient:'房东'}),/未提供原文/);
});
test('PDF text assembly preserves line boundaries without inventing content or parsing operators as text',()=>{
 assert.equal(pdfPageText([{str:'合同期限12个月',hasEOL:true},{str:'试用期3个月',hasEOL:true},{type:'beginMarkedContent',id:'not text'},{str:'工资8000元'}]),'合同期限12个月\n试用期3个月\n工资8000元');
 assert.equal(pdfPageText([{type:'image'},null]),'');assert.equal(PDF_LIMITS.pages,30);assert.equal(PDF_LIMITS.characters,60000);
});
test('local PDF worker and CMaps are byte-identical to the pinned PDF.js distribution',()=>{
 const hash=(url:URL)=>createHash('sha256').update(readFileSync(url)).digest('hex');
 for(const name of ['pdf.worker.min.mjs','cmaps/UniGB-UCS2-H.bcmap']){
  assert.equal(hash(new URL('../public/pdfjs/'+name,import.meta.url)),hash(new URL('../node_modules/pdfjs-dist/'+(name.startsWith('cmaps')?name:'build/'+name),import.meta.url)));
 }
});
test('each maintained city has three distinct sourced categories; cash and accommodation stay separate',()=>{
 for(const city of POLICY_CITIES){const all=reviewedCityPolicies(city,'overview');assert.equal(all.length,3);assert.deepEqual(new Set(all.map(s=>s.category)),new Set(['graduate','settlement','stay']));
  assert.equal(reviewedCityPolicies(city,'stay').length,1);assert.equal(reviewedCityPolicies(city,'support').length,2);
  assert.equal(isCityPolicyResult({city,topic:'overview',status:'matched',sources:all,message:'资料待核实',retrievedAt:new Date().toISOString()}),true);
 }
 assert.equal(reviewedCityPolicies('成都','overview').length,0);
 const sh=reviewedCityPolicies('上海','stay')[0];assert.match(sh.text,/15天/);assert.ok(!sh.text.includes('不超过3天'));assert.equal(sh.publishedOn,'2026-07-12');
 const gz=reviewedCityPolicies('广州','support').find(s=>s.category==='settlement')!;assert.match(gz.scope,/黄埔/);assert.match(gz.text,/已过/);
});
