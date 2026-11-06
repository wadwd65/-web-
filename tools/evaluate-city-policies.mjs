import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readAssistantConfig,runAssistant} from './assistant-gateway.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),config=readAssistantConfig(root);
if(!config.apiKey)throw Error('Configure the server-side provider before evaluation.');
const cases=[
 {id:'gz-support',messages:['广州求职创业补贴有哪些条件？'],city:'广州',status:'matched',topic:'support'},
 {id:'sz-support',messages:['深圳刚毕业都能领3000吗？查一下官方补贴资料'],city:'深圳',status:'matched',topic:'support'},
 {id:'hz-scope',messages:['杭州余杭区求职也能按青年驿站的7天规则住吗？'],city:'杭州',status:'matched',topic:'stay'},
 {id:'sh-stay',messages:['上海青年驿站住宿有什么要求？'],city:'上海',status:'matched',topic:'stay'},
 {id:'chengdu-live',messages:['成都有没有给求职毕业生住的青年驿站？查官方要求'],city:'成都',status:'matched',topic:'stay',live:true},
 {id:'ningbo-live',messages:['我想去宁波找工作，查一下青年驿站住宿的官方说明'],city:'宁波',status:'matched',topic:'stay',live:true},
 {id:'wuhan-missing',messages:['武汉青年驿站住宿，查一下官方目录'],city:'武汉',status:'not-found',topic:'stay'},
 {id:'chengdu-cash',messages:['成都应届生现金补贴现在能领多少？'],city:'成都',status:'not-covered',topic:'support'},
 {id:'no-city',messages:['刚毕业可以领哪些补贴？还没想好去哪个城市。'],noCity:true},
 {id:'corrected-city',messages:['先查广州求职住宿','不是广州，我改查成都的青年驿站'],city:'成都',status:'matched',topic:'stay',live:true},
];
const out=resolve(root,'outputs/v048-review');await mkdir(out,{recursive:true});
const results=[];let next=0;
async function worker(){while(next<cases.length){const item=cases[next++],start=performance.now();let record;try{
 const result=await runAssistant({messages:item.messages.map(content=>({role:'user',content})),module:'home'},{config,timeoutMs:60000});
 const r=result.policyReferences,failures=[];
 if(item.noCity){if(r||result.actions.length)failures.push('unknown-city-must-not-execute');if(!/城市|地区/u.test(result.reply))failures.push('must-ask-city');}
 else{if(r?.city!==item.city||r?.topic!==item.topic||r?.status!==item.status)failures.push('source-city-topic-status');if(!result.steps.some(s=>s.name==='search_city_policies'&&s.ok))failures.push('missing-source-tool');if(item.live&&!r?.sources.some(s=>s.mode==='live'))failures.push('missing-live-discovery');if(result.actions.some(a=>a.kind==='open-city-policy'&&a.city!==item.city))failures.push('wrong-navigation-city');}
 record={id:item.id,passed:failures.length===0,failures,elapsedMs:Math.round(performance.now()-start),result};
 }catch(error){record={id:item.id,passed:false,failures:[error.code||'request-failed'],elapsedMs:Math.round(performance.now()-start)};}
 results.push(record);console.log(record.id+': '+(record.passed?'PASS':'FAIL '+record.failures.join(','))+' ('+record.elapsedMs+'ms)');}}
await Promise.all([worker(),worker()]);
// Same workflow and model, only the retrieval service is removed. This measures
// evidence availability, not independent policy accuracy or a causal quality score.
const ablations=[];
for(const id of ['chengdu-live','ningbo-live','hz-scope']){
 const item=cases.find(c=>c.id===id),start=performance.now();try{
 const result=await runAssistant({messages:item.messages.map(content=>({role:'user',content})),module:'home'},{config,timeoutMs:60000,policySearch:async(city,topic)=>({city,topic,status:'unavailable',sources:[],message:'本次对照关闭检索，没有可核对来源，不从模型记忆补造。',retrievedAt:new Date().toISOString()})});
 ablations.push({id,elapsedMs:Math.round(performance.now()-start),result});
 }catch(error){ablations.push({id,error:error.code||'request-failed'});}
 console.log('no-retrieval '+id+': recorded');
}
const report={date:new Date().toISOString(),model:config.model,syntheticOnly:true,notes:'Developer-authored synthetic city cases. Ablation measures source availability in the same workflow, not independent accuracy, real-user success, whole-web coverage or an official score.',total:results.length,passed:results.filter(r=>r.passed).length,results:results.sort((a,b)=>a.id.localeCompare(b.id)),ablations};
const filename='city-policy-online-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'.json';await writeFile(resolve(out,filename),JSON.stringify(report,null,2)+'\n');console.log('Report: '+filename+'; '+report.passed+'/'+report.total);if(report.passed!==report.total)process.exitCode=1;
