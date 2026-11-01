import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readAssistantConfig,runAssistant} from './assistant-gateway.mjs';
import {assistantEvaluationCases,evaluateAssistantCase} from './assistant-evaluation-cases.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),config=readAssistantConfig(root);
if(!config.apiKey)throw Error('Configure the server-side provider before running the online evaluation.');
const flag=process.argv.find(a=>a.startsWith('--cases=')),ids=flag?.slice(8).split(','),cases=ids?assistantEvaluationCases.filter(c=>ids.includes(c.id)):assistantEvaluationCases;
const directory=resolve(root,'outputs/v032-review');await mkdir(directory,{recursive:true});
const results=[];let next=0;
async function worker(){while(next<cases.length){const item=cases[next++],start=performance.now();let record;try{const result=await runAssistant({messages:item.messages,module:'home'},{config});record={id:item.id,...evaluateAssistantCase(item,result),elapsedMs:Math.round(performance.now()-start),result};}catch(error){record={id:item.id,passed:false,failures:[error.code||'request failed'],elapsedMs:Math.round(performance.now()-start)};}results.push(record);console.log(`${record.id}: ${record.passed?'PASS':'FAIL '+record.failures.join(', ')} (${record.elapsedMs} ms)`);}}
await Promise.all([worker(),worker()]);results.sort((a,b)=>a.id.localeCompare(b.id));
const report={model:config.model,date:new Date().toISOString(),syntheticOnly:true,provider:'DeepSeek',total:results.length,passed:results.filter(r=>r.passed).length,results};
await writeFile(resolve(directory,ids?'online-evaluation-recheck.json':'online-evaluation.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Online synthetic evaluation: ${report.passed}/${report.total}. Criteria cover bounded routing/actions; prose still needs human review.`);
if(report.passed!==report.total)process.exitCode=1;
