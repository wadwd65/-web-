import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {isIP} from 'node:net';
import {mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {createAccountStore} from './account-service.mjs';
import {createRequestPolicy} from './request-policy.mjs';
const DAY=86400000,OFFSET=8*3600000;
const defaults={guestChat:20,accountChat:40,guestImage:3,accountImage:6,siteChat:100,siteImage:20,networkChat:60,networkImage:10,networkMinute:15};
export function usageLimits(env=process.env){const result={};for(const [key,value] of Object.entries(defaults)){const name='FIRST_STEP_LIMIT_'+key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()).toUpperCase(),raw=env[name];result[key]=raw===undefined?value:Number(raw);if(raw!==undefined&&!/^\d{1,5}$/.test(raw)||!Number.isInteger(result[key])||result[key]<0||result[key]>10000)throw Error('试用限额配置不正确：'+name);}return result;}
export class UsageError extends Error{constructor(code,message,retryAfter=60){super(message);this.code=code;this.status=429;this.retryAfter=Math.max(1,Math.ceil(retryAfter));}}
export function requestCookie(req,name){const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));return values.length===1?values[0].slice(name.length+1):'';}
export function appendCookie(res,value){const old=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',old?[...Array.isArray(old)?old:[old],value]:value);}
function normalizedIP(value){if(typeof value!=='string')return null;const ip=value.startsWith('::ffff:')&&isIP(value.slice(7))===4?value.slice(7):value;if(!isIP(ip))return null;return isIP(ip)===6?new URL('http://['+ip+']/').hostname:ip;}
export function networkAddress(req,trustProxy=false){const peer=normalizedIP(req.socket?.remoteAddress)||'unknown';if(trustProxy&&['127.0.0.1','[::1]'].includes(peer)){const real=req.headers['x-real-ip'];return normalizedIP(real)||peer;}return peer;}
export function createUsageGuard({file=resolve(process.env.FIRST_STEP_DATA_DIR||resolve(homedir(),'.config/first-step/private-data'),'usage.sqlite'),accounts:provided,limits=usageLimits(),now=Date.now,trustProxy=process.env.FIRST_STEP_TRUST_PROXY==='loopback'}={}){
 let db,signingKey,accounts=provided;const context=new WeakMap();
 if(Object.keys(defaults).some(key=>!Number.isInteger(limits[key])||limits[key]<0||limits[key]>10000))throw Error('Invalid usage limits');
 function store(){if(db)return db;if(file!==':memory:')mkdirSync(dirname(file),{recursive:true,mode:0o700});db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=2500; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS usage_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS usage_counts(key TEXT NOT NULL,slot INTEGER NOT NULL,kind TEXT NOT NULL,used INTEGER NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(key,slot,kind)); CREATE TABLE IF NOT EXISTS usage_leases(id TEXT PRIMARY KEY,owner TEXT NOT NULL,kind TEXT NOT NULL,expires INTEGER NOT NULL);');db.prepare('INSERT OR IGNORE INTO usage_settings VALUES(?,?)').run('cookie-key',randomBytes(32).toString('hex'));return db;}
 const secret=()=>signingKey??=store().prepare('SELECT value FROM usage_settings WHERE key=?').get('cookie-key').value;
 const hmac=value=>createHmac('sha256',secret()).update(value).digest('hex');
 function resolveIdentity(req,res,secure=false){if(context.has(req))return context.get(req);accounts??=createAccountStore();const account=accounts.identity(requestCookie(req,'first_step_session'));let subject;
  if(account)subject={owner:hmac('account:'+account),identity:'account'};
  else{let token=requestCookie(req,'first_step_visitor'),valid=false;if(/^v1\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)){const [,id,signature]=token.split('.');valid=timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(hmac('visitor:'+id),'hex'));}
   if(!valid){const id=randomBytes(32).toString('hex');token='v1.'+id+'.'+hmac('visitor:'+id);appendCookie(res,`first_step_visitor=${token}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=2592000${secure||req.socket?.encrypted?'; Secure':''}`);}
   subject={owner:hmac('guest:'+token.split('.')[1]),identity:'guest'};
  }
  const value={...subject,network:networkAddress(req,trustProxy)};context.set(req,value);return value;
 }
 const used=(key,slot,kind)=>store().prepare('SELECT used FROM usage_counts WHERE key=? AND slot=? AND kind=?').get(key,slot,kind)?.used||0;
 function slots(){const time=now(),day=Math.floor((time+OFFSET)/DAY),reset=(day+1)*DAY-OFFSET;return {time,day,reset,minute:Math.floor(time/60000)};}
 function groups(subject,kind,s,personal=false){const suffix=kind==='chat'?'Chat':'Image',minute={key:hmac('minute:'+s.day+':'+subject.network),slot:s.minute,limit:limits.networkMinute,expires:s.time+120000,reason:'frequency'};if(personal)return [minute];return [
  {key:subject.owner,slot:s.day,limit:limits[subject.identity+suffix],expires:s.reset+2*DAY,reason:'personal'},
  {key:hmac('network:'+s.day+':'+subject.network),slot:s.day,limit:limits['network'+suffix],expires:s.reset+2*DAY,reason:'network'},
  {key:'site',slot:s.day,limit:limits['site'+suffix],expires:s.reset+2*DAY,reason:'site'},
  minute,
 ];}
 function snapshot(req,res,secure=false,mode='provided'){const personal=mode==='personal',subject=resolveIdentity(req,res,secure),s=slots(),resource=kind=>{const entries=groups(subject,kind,s,personal),available=mode!=='expired'&&entries.every(g=>used(g.key,g.slot,kind)<g.limit);if(personal)return {used:null,limit:null,remaining:null,available};const own=entries[0],count=used(own.key,own.slot,kind);return {used:count,limit:own.limit,remaining:Math.max(0,own.limit-count),available};};return {mode,identity:subject.identity,day:new Date(s.day*DAY).toISOString().slice(0,10),resetAt:new Date(s.reset).toISOString(),chat:resource('chat'),image:resource('image'),counting:personal?'provider-billed':'started-attempts'};}
 function reserve(req,res,kind,secure=false,mode='provided'){if(!['chat','image'].includes(kind))throw Error('Unknown usage resource');const subject=resolveIdentity(req,res,secure),s=slots(),connection=store();connection.exec('BEGIN IMMEDIATE');try{
  connection.prepare('DELETE FROM usage_counts WHERE expires<?').run(s.time);connection.prepare('DELETE FROM usage_leases WHERE expires<?').run(s.time);
  const active=connection.prepare('SELECT COUNT(*) AS n FROM usage_leases WHERE kind=?').get(kind).n,owned=connection.prepare('SELECT COUNT(*) AS n FROM usage_leases WHERE kind=? AND owner=?').get(kind,subject.owner).n;
  if(owned||active>=(kind==='chat'?2:1))throw new UsageError('usage-busy',owned?'你还有一条请求正在处理，请等它结束后再发。':'现在使用的人较多，请稍后再试。',5);
  for(const group of groups(subject,kind,s,mode==='personal'))if(used(group.key,group.slot,kind)>=group.limit){const next=group.reason==='frequency'?(s.minute+1)*60000:s.reset;throw new UsageError('usage-'+group.reason,group.reason==='personal'?'今天的试用次数已用完，可在API设置里连接自己的接口，或明天继续。八项工具仍可使用。':group.reason==='site'?'本站今天的AI试用额度已用完，可连接自己的接口。工具列表仍可使用。':group.reason==='frequency'?'当前网络发送较频繁，请稍等一分钟。':'当前网络今天的AI试用次数已达到上限，可连接自己的接口。工具列表仍可使用。',(next-s.time)/1000);}
  for(const group of groups(subject,kind,s,mode==='personal'))connection.prepare('INSERT INTO usage_counts VALUES(?,?,?,?,?) ON CONFLICT(key,slot,kind) DO UPDATE SET used=used+1').run(group.key,group.slot,kind,1,group.expires);
  const id=randomUUID();connection.prepare('INSERT INTO usage_leases VALUES(?,?,?,?)').run(id,subject.owner,kind,s.time+90000);connection.exec('COMMIT');let ended=false;return {release(){if(!ended){ended=true;connection.prepare('DELETE FROM usage_leases WHERE id=?').run(id);}}};
 }catch(error){connection.exec('ROLLBACK');throw error;}}
 return {snapshot,reserve,identity:(req,res,secure=false)=>resolveIdentity(req,res,secure).owner,close(){if(db)db.close();if(!provided&&accounts)accounts.close();}};
}
export function createUsageMiddleware({usage,credentials,policy=createRequestPolicy()}={}){return(req,res)=>{if(new URL(req.url,'http://localhost').pathname!=='/api/v1/usage')return false;const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};if(!policy.allows(req)){send(403,{error:'请在本站查看试用次数。'});return true;}if(req.method!=='GET'){send(405,{error:'请使用试用次数入口。'});return true;}try{const mode=credentials?.describe(req,res).mode??'provided';send(200,{data:usage.snapshot(req,res,policy.secure,mode)});}catch{send(503,{error:'试用计数暂不可用，八项工具仍可使用。'});}return true;};}
