import {readFileSync,writeFileSync,readdirSync,existsSync,renameSync} from 'node:fs';
import {resolve,relative,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const memory=resolve(root,'docs/memory');
const textExtensions=new Set(['.ts','.tsx','.mjs','.py','.json','.md','.html','.css','.svg','.txt','.example']);
function digest(path){const bytes=readFileSync(path);return createHash('sha256').update(textExtensions.has(extname(path))?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes).digest('hex');}
const state=JSON.parse(readFileSync(resolve(memory,'progress.json'),'utf8'));
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const problems=[];
if(state.schemaVersion!==1)problems.push('Unsupported memory schema.');
if(state.workingVersion!==pkg.version)problems.push(`Memory ${state.workingVersion} and package ${pkg.version} differ.`);
for(const name of ['README.md','DECISIONS.md','BACKLOG.md','ARCHITECTURE.md','SESSIONS.md'])if(!existsSync(resolve(memory,name)))problems.push(`Missing memory file: ${name}`);
if(state.modules?.length!==8||new Set(state.modules.map(m=>m.id)).size!==8)problems.push('Eight distinct module records are required.');
if(!Array.isArray(state.missingCapabilities))problems.push('Capability gaps must be an explicit reviewed list.');
if(!Array.isArray(state.nextActions)||!state.nextActions.length)problems.push('Next actions are missing.');
if(state.workState==='reviewed_internally'&&state.validation.version!==pkg.version)problems.push('Validation is from an older version.');
if(problems.length){console.error(problems.join('\n'));process.exit(1);}

if(!process.argv.includes('--stamp')&&existsSync(resolve(memory,'checkpoint.json'))){
 const checkpoint=JSON.parse(readFileSync(resolve(memory,'checkpoint.json'),'utf8'));
 const changed=checkpoint.files.filter(file=>!existsSync(resolve(root,file.path))||digest(resolve(root,file.path))!==file.sha256);
 if(changed.length)console.warn(`Source changed since the last handoff: ${changed.length} files. Prior QA does not validate these edits.\n${changed.slice(0,8).map(file=>'- '+file.path).join('\n')}`);
}

if(process.argv.includes('--stamp')){
 const files=[];
 function walk(directory){for(const item of readdirSync(directory,{withFileTypes:true})){const path=resolve(directory,item.name);if(item.isDirectory())walk(path);else if(item.name!=='checkpoint.json')files.push(path);}}
 for(const name of ['src','tools','tests','public'])walk(resolve(root,name));
 for(const name of ['package.json','package-lock.json','tsconfig.json','AGENTS.md','.env.example'])files.push(resolve(root,name));
 for(const name of ['progress.json','DECISIONS.md','BACKLOG.md','ARCHITECTURE.md','SESSIONS.md'])files.push(resolve(memory,name));
 const records=files.sort().map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:digest(path)}));
 const checkpoint={version:pkg.version,recordedAt:new Date().toISOString(),workState:state.workState,validationVersion:state.validation.version,textNormalisation:'LF',sourceDigest:createHash('sha256').update(JSON.stringify(records)).digest('hex'),files:records,note:'A source fingerprint, not an assertion that visual or functional QA passed.'};
 const temporary=resolve(memory,'checkpoint.tmp');writeFileSync(temporary,JSON.stringify(checkpoint,null,2)+'\n');renameSync(temporary,resolve(memory,'checkpoint.json'));
 console.log(`Recorded ${records.length} files for ${pkg.version}; validation remains ${state.validation.version}.`);
}else if(process.argv.includes('--check'))console.log(`Memory structure and package agree: ${pkg.version}. Full product gaps remain explicit.`);
else{
 console.log(`FIRST STEP / ${state.workingVersion} / ${state.workState}\nPublished: ${state.releasedVersion}\n${state.objective}\n`);
 console.log('CURRENT PLAN');for(const item of state.currentPlan)console.log(`- ${item.id}: ${item.status} / ${item.acceptance}`);
 console.log('\nNEXT');for(const action of state.nextActions)console.log(`- ${action}`);
 console.log(`\nNOT IMPLEMENTED: ${state.missingCapabilities.join(' / ')}`);
 console.log('\nRead docs/memory/DECISIONS.md and BACKLOG.md before choosing a new direction.');
}
