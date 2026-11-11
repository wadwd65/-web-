import {createHash,randomBytes} from 'node:crypto';
import {readAssistantConfig} from './assistant-gateway.mjs';
import {requestCookie,appendCookie} from './usage-service.mjs';
const COOKIE='first_step_ai',TTL=3600000;
class SettingsError extends Error{}
const hash=value=>createHash('sha256').update(value).digest('hex');
function expired(){return Object.assign(Error('自备接口已失效或账号已切换。请重新连接，或在API设置中选择比赛提供的接口。'),{code:'settings-expired',status:503});}
export function createAISettings({directory,usage,policy,config,fetcher=fetch,now=Date.now}={}){
 const sessions=new Map(),attempts=[],inFlight=new Set();
 const cleanup=setInterval(()=>{for(const [id,item] of sessions)if(item.expires<=now())sessions.delete(id);},60000);cleanup.unref();
 const base=()=>config??readAssistantConfig(directory||process.cwd());
 function personal(req,res){const owner=usage.identity(req,res,policy.secure),token=requestCookie(req,COOKIE);if(!token)return null;const session=/^[a-f0-9]{64}$/.test(token)?sessions.get(hash(token)):null;if(!session||session.owner!==owner||session.expires<=now())throw expired();return session;}
 function configuration(req,res,fallback=base()){const selected=personal(req,res);return selected?{...selected.config,usageMode:'personal'}:{...fallback,usageMode:'provided'};}
 function describe(req,res){try{const selected=personal(req,res);return {mode:selected?'personal':'provided',configured:Boolean((selected?.config||base()).apiKey),provider:'DeepSeek',model:(selected?.config||base()).model||'deepseek-flash',expiresAt:selected?new Date(selected.expires).toISOString():null};}catch(error){if(error.code!=='settings-expired')throw error;return {mode:'expired',configured:false,provider:'DeepSeek',model:'',expiresAt:null};}}
 function middleware(req,res){if(new URL(req.url,'http://localhost').pathname!=='/api/v1/ai/settings')return false;
  const send=(status,body)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}};
  try{
   if(!policy.allows(req)){send(403,{error:'请在本站设置接口。'});return true;}
   if(req.method==='GET'){send(200,{data:describe(req,res)});return true;}
   const owner=usage.identity(req,res,policy.secure);
   if(req.method==='DELETE'){const token=requestCookie(req,COOKIE),saved=sessions.get(hash(token));if(saved?.owner===owner)sessions.delete(hash(token));appendCookie(res,`${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0${policy.secure||req.socket?.encrypted?'; Secure':''}`);send(200,{data:describe({...req,headers:{...req.headers,cookie:(req.headers.cookie||'').split(';').filter(c=>!c.trim().startsWith(COOKIE+'=')).join(';')}},res)});return true;}
   if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){send(405,{error:'请使用API设置入口。'});return true;}
   while(attempts.length&&attempts[0].at<now()-60000)attempts.shift();
   if(inFlight.size>=2||inFlight.has(owner)||attempts.filter(a=>a.owner===owner).length>=5||attempts.length>=20){res.setHeader('Retry-After','60');send(429,{error:'连接测试较频繁，请稍后再试。'});return true;}
   attempts.push({owner,at:now()});inFlight.add(owner);
   const controller=new AbortController(),chunks=[];let size=0,finished=false;
   const done=()=>{if(!finished){finished=true;inFlight.delete(owner);}};
   req.on('aborted',()=>{controller.abort();done();});req.on('error',()=>{controller.abort();done();});res.on('close',()=>{if(!res.writableEnded){controller.abort();done();}});
   req.on('data',chunk=>{size+=chunk.length;if(size<=4096)chunks.push(chunk);});
   req.on('end',()=>{void(async()=>{try{
    if(size>4096)throw new SettingsError('设置内容过长。');let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new SettingsError('接口设置格式不正确。');}
    if(typeof body?.apiKey!=='string'||! /^[A-Za-z0-9_-]{16,240}$/.test(body.apiKey)||typeof body.model!=='string'||! /^[A-Za-z0-9_.:-]{1,80}$/.test(body.model)||body.baseUrl&&body.baseUrl!=='https://api.deepseek.com')throw new SettingsError('请填写有效DeepSeek密钥和模型名；此版本仅连接官方DeepSeek地址。');
    controller.signal.throwIfAborted();const response=await fetcher('https://api.deepseek.com/models',{headers:{Authorization:'Bearer '+body.apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
    if(!response.ok)throw new SettingsError(response.status===401||response.status===403?'密钥未通过验证，请检查后重试。':'DeepSeek暂时无法验证，请稍后重试。');
    const reader=response.body.getReader(),parts=[];let length=0;try{while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>65536)throw new SettingsError('接口验证响应异常，请稍后重试。');parts.push(item.value);}}finally{await reader.cancel().catch(()=>{});}
    let models;try{models=JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new SettingsError('接口验证响应不完整，请稍后重试。');}
    if(!Array.isArray(models.data)||!models.data.some(item=>item?.id===body.model))throw new SettingsError('密钥已响应，但没有找到这个模型。请填写该账号可用的模型名。');
    controller.signal.throwIfAborted();for(const [id,item] of sessions)if(item.expires<=now())sessions.delete(id);
    if(sessions.size>=50)throw new SettingsError('当前接口会话较多，请稍后重试。');
    const token=randomBytes(32).toString('hex'),old=requestCookie(req,COOKIE);const oldSession=sessions.get(hash(old));if(oldSession?.owner===owner)sessions.delete(hash(old));
    sessions.set(hash(token),{owner,config:{apiKey:body.apiKey,model:body.model,visionSupported:models.data.find(item=>item.id===body.model)?.input_modalities?.includes('image')},expires:now()+TTL});appendCookie(res,`${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=86400${policy.secure||req.socket?.encrypted?'; Secure':''}`);
    send(200,{data:{mode:'personal',configured:true,provider:'DeepSeek',model:body.model,expiresAt:new Date(now()+TTL).toISOString()}});
   }catch(error){send(400,{error:error instanceof SettingsError?error.message:'连接未成功，请稍后重试；原接口设置保持。'});}finally{done();}})();});
  }catch{send(503,{error:'接口设置暂不可用，请稍后重试。'});}return true;
 }
 return {configuration,describe,middleware,close(){clearInterval(cleanup);sessions.clear();}};
}
