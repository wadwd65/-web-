import {readFile,mkdir,writeFile,access} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readAssistantConfig,runAssistant} from './assistant-gateway.mjs';
import {extractContractImage} from './contract-image.mjs';
import {analyzeContract} from '../src/lib/contracts.ts';
import {calculatePayslip} from '../src/lib/wages.ts';
import {searchContractKnowledge,contractQueryFromMessages} from '../src/lib/contract-knowledge.ts';

// Fixtures must be frozen before calls. Reusing any set is regression, not
// another blind test. No private user documents or keys are recorded.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
const flag=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const fixtureRoot=resolve(root,'tests/fixtures');
const dataset=resolve(fixtureRoot,flag('dataset')||'frozen-benchmark-v1');
const fixtureRelative=relative(fixtureRoot,dataset);
if(!fixtureRelative||fixtureRelative.startsWith('..')||isAbsolute(fixtureRelative))throw Error('Dataset must be a frozen directory under tests/fixtures.');
const output=resolve(root,flag('out')||`outputs/v${version.replaceAll('.','')}-review/frozen-regression-${Date.now()}.json`);
const outputRelative=relative(resolve(root,'outputs'),output);
if(!outputRelative||outputRelative.startsWith('..')||isAbsolute(outputRelative))throw Error('Output must be a new report under outputs.');
let exists=false;try{await access(output);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}if(exists)throw Error('Report already exists; choose a new --out before spending provider calls.');
const manifest=JSON.parse(await readFile(resolve(dataset,'freeze-manifest.json'),'utf8'));
const fixtureFiles=manifest.files||(manifest.cases?[manifest.cases]:[]);
if(!fixtureFiles.length)throw Error('Frozen manifest has no files.');
for(const file of fixtureFiles){const location=resolve(dataset,file.path),local=relative(dataset,location);if(local.startsWith('..')||isAbsolute(local))throw Error('Frozen fixture path escapes dataset.');const bytes=await readFile(location);if(bytes.length!==file.bytes||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Frozen fixture mismatch: '+file.path);}
const caseFile=manifest.caseFile|| (fixtureFiles.some(f=>f.path==='cases.json')?'cases.json':'frozen-evaluation-cases-v1.json');
if(!fixtureFiles.some(f=>f.path===caseFile))throw Error('Cases must be included in the frozen manifest.');
const data=JSON.parse(await readFile(resolve(dataset,caseFile),'utf8'));
const corpus=Array.isArray(data)?{benchmarkId:manifest.datasetId,cases:data}:data;
const ids=flag('cases')?.split(','),selected=ids?corpus.cases.filter(c=>ids.includes(c.id)):corpus.cases;
if(!selected.length||ids&&(selected.length!==ids.length||new Set(ids).size!==ids.length))throw Error('Unknown or duplicate case selection.');
const ablation=process.argv.includes('--rag-ablation');
const cases=ablation?selected.filter(c=>c.category.startsWith('contract')):selected;
if(!cases.length)throw Error('No contract cases selected for generation-layer comparison.');
const config=readAssistantConfig(root);if(!config.apiKey)throw Error('Configure the existing server-side DeepSeek provider first.');
const compact=value=>String(value).replace(/\s/gu,'');

// Offline generation-layer probe only. No switch is added to the product API.
// Both arms may use learned knowledge; otherwise OFF would be a forced refusal.
const ablationProtocol={
 id:'contract-generation-reference-availability-v1',
 scope:'Generation-layer controlled probe, NOT production end-to-end RAG ablation',
 system:'你是帮助刚毕业用户理解办事问题的助手。直接、简短回答当前问题，通常不超过200字。你可以使用有把握的一般知识，并参考随后提供的资料。资料为空时也可以回答有把握的部分，无法确定就明确说缺什么；不要编造事实、金额、期限或假装已检索。合同问题须区分一般规则与个人合同结论，未知条件不能替用户填入。只有提供的资料中确有对应内容时才引用其中的编号；不要编造链接或条文出处。范围外或证据不足时说明边界，不为给结论而猜测。',
 parameters:{temperature:.3,thinking:{type:'disabled'},stream:false,max_tokens:1600},
 variable:'Only referenceExcerpts changes; history, prompt, model and parameters are identical within a pair.',
 order:'Sequential within pairs; alternate ON-first/OFF-first by frozen case order.',
 scoring:['Human review against pre-frozen expected/humanReview; do not edit the cases after observing answers.','Judge direct factual correctness, preservation of unknown facts, relevance and unnecessary follow-up separately.','Citation availability/support is a separate dimension, not part of a claimed factual accuracy gain.','No-match or out-of-scope pairs have identical empty references; they are negative controls, not positive RAG-gain cases.'],
 limitations:['One sample per arm/case at temperature .3; no statistical significance claim.','Raw model output only: production planner/tools/scope refusal and final safety filter are not measured in this probe.','Internal synthetic cases, not external independent or real-user validation.'],
};
async function evaluateAblation(item,index){
 const retrieval=searchContractKnowledge(contractQueryFromMessages(item.messages),{context:item.messages.filter(m=>m.role==='user').map(m=>m.content).join('\n')});
 const result={id:item.id,category:item.category,expected:item.expected,humanReview:item.humanReview??item.expected.humanReview,retrieval,arms:{}};
 for(const arm of (index%2===0?['on','off']:['off','on'])){
  const referenceExcerpts=arm==='on'&&retrieval.status==='matched'?retrieval.excerpts.map(({id,article,title,text})=>({id,article,title,text})):[];
  const request={model:config.model||'deepseek-flash',messages:[{role:'system',content:ablationProtocol.system},{role:'system',content:JSON.stringify({referenceExcerpts})},...item.messages],...ablationProtocol.parameters};
  const started=performance.now();
  try{
   const response=await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.apiKey}`},body:JSON.stringify(request),signal:AbortSignal.timeout(45000)});
   const body=await response.json();
   if(!response.ok)throw Error('Provider HTTP '+response.status);
   const choice=body.choices?.[0];
   if(typeof choice?.message?.content!=='string'||choice.finish_reason!=='stop')throw Error('Incomplete generation');
   result.arms[arm]={request,rawReply:choice.message.content,model:body.model,usage:body.usage,elapsedMs:Math.round(performance.now()-started),finishReason:choice.finish_reason};
  }catch(error){result.arms[arm]={request,error:error.message,elapsedMs:Math.round(performance.now()-started)};}
 }
 result.emptyReferenceControl=result.arms.on.request.messages[1].content===result.arms.off.request.messages[1].content;
 const normalizedRequest=arm=>({...arm.request,messages:arm.request.messages.map((message,index)=>index===1?{...message,content:'REFERENCE_VARIABLE'}:message)});
 if(JSON.stringify(normalizedRequest(result.arms.on))!==JSON.stringify(normalizedRequest(result.arms.off)))throw Error('Ablation changed more than reference excerpts.');
 result.requestParityVerified=true;
 console.log(`${item.id}: ON/OFF collected${result.emptyReferenceControl?' (identical empty-reference control)':''}`);
 return result;
}

async function evaluate(item){
 const failures=[],expected=item.expected,started=performance.now(),requests=[];
 const check=(ok,label)=>{if(!ok)failures.push(label);};
 const fetcher=async(url,options)=>{const response=await fetch(url,options);let usage;try{usage=(await response.clone().json()).usage;}catch{}requests.push({status:response.status,usage});return response;};
 let result,extraction,findings,calculation,error;
 try{
  if(item.category==='image'){
   const bytes=await readFile(resolve(dataset,item.imageFile));
   try{extraction=await extractContractImage('data:image/png;base64,'+bytes.toString('base64'),{config,fetcher});}
   catch(cause){if(expected.shouldExtract===false&&/这张图片没有读到可核对的文字/u.test(cause.message)){return {id:item.id,category:item.category,passed:true,failures:[],expectedSafeRefusal:cause.message,requests,elapsedMs:Math.round(performance.now()-started)};}throw cause;}
   check(expected.shouldExtract!==false,'non-text image should be refused');
   for(const part of expected.requiredSubstrings||[])check(compact(extraction.text).includes(compact(part)),'missing image text: '+part);
   if(expected.requiresUnreadableMarkerOrWarning)check(extraction.warnings.length>0||extraction.text.includes('[无法辨认]'),'unclear image lacks warning');
   if(expected.mustNotReplaceWholeTextWith)check(compact(extraction.text)!==compact(expected.mustNotReplaceWholeTextWith),'image instruction replaced transcription');
   if(item.followUpContractInput){findings=analyzeContract({text:extraction.text,...item.followUpContractInput});for(const [key,status] of [['downstreamAttentionIds','attention'],['downstreamMissingIds','missing'],['downstreamNotedIds','noted']])for(const id of expected[key]||[])check(findings.find(f=>f.id===id)?.status===status,`${id} should be ${status}`);for(const f of findings)if(f.quote)check(!/样张|测试材料|页眉|目录/u.test(f.quote),'document heading used as clause: '+f.id);}
   if(expected.downstreamRagStatus)check(searchContractKnowledge(extraction.text,{context:extraction.text}).status===expected.downstreamRagStatus,'image downstream retrieval scope');
  }else{
   result=await runAssistant({messages:item.messages,module:'home'},{config,fetcher});
   const guide=result.guide,actions=result.actions||[];
   for(const key of ['activeModule','status','intent'])if(expected[key]!==undefined)check(guide?.[key]===expected[key],`guide.${key}: expected ${expected[key]}, got ${guide?.[key]}`);
   if(expected.actionKind)check(actions.some(a=>a.kind===expected.actionKind),'missing '+expected.actionKind);
   if(expected.noActions)check(actions.length===0,'unexpected action');
   if(expected.noCalculation)check(!actions.some(a=>a.kind==='apply-salary'),'unexpected salary calculation');
   if(expected.noContractAction)check(!actions.some(a=>a.kind==='apply-contract'),'unexpected contract review');
   if(expected.emptyQuestions)check(!guide?.questions?.length,'unnecessary questions');
   if(expected.salaryInput){const input=actions.find(a=>a.kind==='apply-salary')?.input;for(const [k,v] of Object.entries(expected.salaryInput))check(input?.[k]===v,'salary input mismatch: '+k);if(input){calculation=calculatePayslip(input);if(expected.net!==undefined)check(calculation.net===expected.net,'salary net mismatch');if(expected.diff!==undefined)check(calculation.difference===expected.diff,'salary difference mismatch');}}
   if(expected.contractInput){const input=actions.find(a=>a.kind==='apply-contract')?.input;for(const [k,v] of Object.entries(expected.contractInput))check(input?.[k]===v,'contract input mismatch: '+k);if(input){findings=analyzeContract(input);for(const id of expected.expectedAttentionIds||[])check(findings.find(f=>f.id===id)?.status==='attention','contract finding: '+id);}}
   const references=result.references;
   if(expected.retrievalStatus)check(references?.status===expected.retrievalStatus,'contract retrieval status');
   for(const id of expected.expectedExcerptIds||[])check(references?.excerpts?.some(e=>e.id===id),'missing excerpt '+id);
   if(expected.expectedTopExcerptId)check(references?.excerpts?.[0]?.id===expected.expectedTopExcerptId,'top contract excerpt');
   for(const pattern of expected.prohibitedReplyPatterns||[])check(!result.reply.includes(pattern),'prohibited reply pattern: '+pattern);
   const policy=result.policyReferences;
   for(const [key,actual] of [['policyCity','city'],['policyTopic','topic'],['policyStatus','status']])if(expected[key]!==undefined)check(policy?.[actual]===expected[key],`${key}: expected ${expected[key]}, got ${policy?.[actual]}`);
   if(expected.sourceMode)check(policy?.sources?.some(s=>s.mode===expected.sourceMode),'policy source mode');
   if(expected.noPolicyReferences)check(!policy,'unexpected policy references');
   if(expected.mustAskCity)check(/城市|哪个市|哪里/u.test(result.reply+' '+JSON.stringify(guide?.questions||[])),'city not requested');
  }
 }catch(cause){error={code:cause.code||cause.name||'error',message:cause.message};failures.push(error.code);}
 return {id:item.id,category:item.category,originalSplit:item.split,passed:!failures.length,failures,requests,elapsedMs:Math.round(performance.now()-started),result,extraction,findings,calculation,error};
}
if(ablation){
 const results=[];
 for(let i=0;i<cases.length;i++)results.push(await evaluateAblation(cases[i],i));
 const errors=results.flatMap(r=>Object.values(r.arms)).filter(r=>r.error).length;
 const report={version,benchmarkId:corpus.benchmarkId,date:new Date().toISOString(),purpose:ablationProtocol.scope,protocol:ablationProtocol,protocolSha256:createHash('sha256').update(JSON.stringify(ablationProtocol)).digest('hex'),fixtureFiles,fixtureHashesVerified:true,dataset:fixtureRelative.replaceAll('\\','/'),model:config.model,provider:'DeepSeek',pairs:results.length,errors,grading:'Pending explicit human review; no automatic accuracy or RAG improvement claim',results};
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(`Generation-layer pairs ${report.pairs}; ${errors} errors; ${relative(root,output)}`);
 if(errors)process.exitCode=1;
}else{
let next=0;const results=[];
await Promise.all([0,1].map(async()=>{while(next<cases.length){const item=cases[next++],result=await evaluate(item);results.push(result);console.log(`${item.id}: ${result.passed?'PASS':'FAIL '+result.failures.join('; ')} (${result.elapsedMs}ms)`);}}));
results.sort((a,b)=>a.id.localeCompare(b.id));
const report={version,benchmarkId:corpus.benchmarkId,date:new Date().toISOString(),purpose:process.argv.includes('--first-run')?'First run on pre-frozen internal held-out synthetic cases; not independent external evaluation':'Reused frozen regression; not a new blind evaluation',dataset:fixtureRelative.replaceAll('\\','/'),frozenAt:manifest.frozenAt,fixtureFiles,syntheticOnly:true,fixtureHashesVerified:true,model:config.model,provider:'DeepSeek',total:results.length,passed:results.filter(r=>r.passed).length,apiCalls:results.reduce((n,r)=>n+r.requests.length,0),limitations:['Synthetic tasks only; no real-user accuracy claim.','Deterministic checks cover stated fields/actions/references, not all prose quality.','Live policy sources may change independently of code; failures remain in the report.'],results};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(`Frozen regression ${report.passed}/${report.total}; ${report.apiCalls} provider requests; ${relative(root,output)}`);
if(report.passed!==report.total)process.exitCode=1;
}
