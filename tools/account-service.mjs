import {isQuestion} from '../src/lib/checklist.ts';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
const scrypt=promisify(derive),ttl=7*86400000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const blank=()=>({city:'',stage:'',notes:'',questions:[]});
export function validateMemory(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('资料格式不完整。');
 const text=(key,max)=>{if(typeof value[key]!=='string'||value[key].length>max)throw Error('资料内容过长或格式不正确。');return value[key].trim();};
 const questions=value.questions??[];
 if(!Array.isArray(questions)||questions.length>50||questions.some(q=>!isQuestion(q)))throw Error('清单格式不完整或超过50项。');
 return {city:text('city',60),stage:text('stage',60),notes:text('notes',2000),questions:questions.map(({id,text,category,done,evidence,answer})=>({id,text,category,done,...(evidence?{evidence}:{}),...(answer!==undefined?{answer}:{})}))};
}
export function createAccountStore({file=resolve(process.env.FIRST_STEP_DATA_DIR||resolve(homedir(),'.config/first-step/private-data'),'accounts.sqlite'),now=Date.now}={}){
 if(file!==':memory:')mkdirSync(dirname(file),{recursive:true,mode:0o700});
 const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,memory TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL);');
 const key=(password,salt)=>scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 function identity(username,password){if(typeof username!=='string'||! /^[a-zA-Z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)throw Error('账号用3–24位字母、数字或下划线；密码用8–128位。');return username.toLowerCase();}
 function user(row){return {id:row.id,username:row.username,memory:JSON.parse(row.memory),updatedAt:row.updated};}
 function session(id){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires < ?').run(now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,now()+ttl);return token;}
 return {
  async register(username,password){username=identity(username,password);const salt=randomBytes(16).toString('hex'),derived=await key(password,salt);const id=randomUUID();try{db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run(id,username,salt,derived.toString('hex'),JSON.stringify(blank()),now());}catch(error){if(error.code==='ERR_SQLITE_ERROR'&&db.prepare('SELECT id FROM accounts WHERE username=?').get(username))throw Error('这个账号已使用，请换一个或直接登录。');throw error;}return {token:session(id),user:user(db.prepare('SELECT * FROM accounts WHERE id=?').get(id))};},
  async login(username,password){username=identity(username,password);const row=db.prepare('SELECT * FROM accounts WHERE username=?').get(username),derived=await key(password,row?.salt||'dummy-user-salt');if(!row||!timingSafeEqual(derived,Buffer.from(row.password_hash,'hex')))throw Error('账号或密码不正确。');return {token:session(row.id),user:user(row)};},
  current(token){if(typeof token!=='string'||! /^[a-f0-9]{64}$/.test(token))return null;const row=db.prepare('SELECT a.* FROM accounts a JOIN sessions s ON s.user_id=a.id WHERE s.token_hash=? AND s.expires>?').get(hash(token),now());return row?user(row):null;},
  save(token,value){const current=this.current(token);if(!current)throw Error('登录已过期，请重新登录。');const memory=validateMemory(value);db.prepare('UPDATE accounts SET memory=?,updated=? WHERE id=?').run(JSON.stringify(memory),now(),current.id);return this.current(token);},
  logout(token){if(typeof token==='string')db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));},
  close(){db.close();},
 };
}
export function createAccountMiddleware({store:provided}={}){
 let store=provided,busy=0;const attempts=[];
 return (req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;if(!path.startsWith('/api/v1/account/'))return false;
  const respond=(status,data)=>{if(!res.destroyed) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}};
  const cookie=value=>res.setHeader('Set-Cookie',`first_step_session=${value}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=${value?604800:0}${req.socket.encrypted?'; Secure':''}`);
  try{
   const host=req.headers.host||'';if(!['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+host).hostname)||req.headers.origin&&req.headers.origin!==`http://${host}`&&req.headers.origin!==`https://${host}`){respond(403,{error:'请在本站使用账号。'});return true;}
   store??=createAccountStore();const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('first_step_session='))?.slice('first_step_session='.length);
   if(path==='/api/v1/account/me'&&req.method==='GET'){respond(200,{user:store.current(token)});return true;}
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){respond(405,{error:'请使用账号界面操作。'});return true;}
   if(!['register','login','logout','memory'].some(action=>path===`/api/v1/account/${action}`)){respond(404,{error:'没有找到这个账号操作。'});return true;}
   const now=Date.now();while(attempts.length&&attempts[0]<now-600000)attempts.shift();
   if(busy>=2||(/\/(login|register)$/.test(path)&&attempts.length>=20)){respond(429,{error:'操作过于频繁，请稍后再试。'});return true;}
   if(/\/(login|register)$/.test(path))attempts.push(now);busy++;
   let size=0,chunks=[];req.on('data',chunk=>{size+=chunk.length;if(size<=1048576)chunks.push(chunk);});
   let ended=false;const release=()=>{if(!ended){ended=true;busy--;}};req.on('error',()=>{release();respond(400,{error:'请求中断，请重试。'});});req.on('aborted',release);
   req.on('end',()=>{void(async()=>{try{
    if(size>1048576){respond(413,{error:'资料过大，请精简内容。'});return;}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{respond(400,{error:'请求格式不正确。'});return;}
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('请求格式不正确。');
    if(path.endsWith('/logout')){store.logout(token);cookie('');respond(200,{user:null});}
    else if(path.endsWith('/memory')){if(!store.current(token)){respond(401,{error:'请先登录再保存资料。'});return;}respond(200,{user:store.save(token,body)});}
    else{const result=path.endsWith('/register')?await store.register(body.username,body.password):await store.login(body.username,body.password);cookie(result.token);respond(200,{user:result.user});}
   }catch(error){respond(400,{error:/SQLITE|database|ENOENT|EACCES/i.test(error.message)?'账号服务暂不可用，请稍后重试。':error.message});}finally{release();}})();});
  }catch{respond(503,{error:'账号服务暂不可用，游客功能仍可使用。'});}
  return true;
 };
}
