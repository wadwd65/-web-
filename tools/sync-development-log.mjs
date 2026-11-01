import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const argument=process.argv.find(value=>value.startsWith('--contest-dir='));
if(!argument){console.error('Usage: npm run log:sync -- --contest-dir="ABSOLUTE_CONTEST_PATH" [--check]');process.exit(1);}
const supplied=argument.slice('--contest-dir='.length);
if(!isAbsolute(supplied)){console.error('The contest directory must be an absolute path.');process.exit(1);}
const contest=resolve(supplied);
if(contest===root||!existsSync(resolve(contest,'当前版本.json'))||!existsSync(resolve(contest,'06-作品仓库快照'))){console.error('The target must be the existing contest package, with its version marker and snapshot directory.');process.exit(1);}
const files=[['docs/DEVELOPMENT_LOG.md','开发总日志.md'],['docs/VERSION_HISTORY.md','03-开发日志/历史版本说明.md']];
const digest=value=>createHash('sha256').update(value).digest('hex');
for(const [source,name] of files){
 const content=readFileSync(resolve(root,source)),target=resolve(contest,name);
 if(process.argv.includes('--check')){
  if(!existsSync(target)||digest(content)!==digest(readFileSync(target))){console.error(`Log copy is missing or outdated: ${name}`);process.exit(1);}
 }else{mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);}
}
console.log(`${process.argv.includes('--check')?'Verified':'Synced'} ${files.length} development/history documents. No snapshots were removed.`);
