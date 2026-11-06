import {randomUUID} from 'node:crypto';
import {createRequestPolicy} from './request-policy.mjs';
import {policyCity,reviewedCityPolicies,POLICY_DIRECTORY} from '../src/lib/city-policies.ts';
export const DIRECTORY_API='https://jsdxzj.ncss.cn/newsbyssdm?categoryId=2293373225&ssdm=&pageSize=1000&maxTitleLen=200';
const topicOf=value=>{if(!['support','stay'].includes(value))throw Error('请选择毕业补贴或求职住宿。');return value;};
function plain(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|li|h\d)>|<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();}
export function parsePolicyArticle(html){const match=html.match(/<div[^>]*class="detail"[^>]*>([\s\S]*?)<div id="dzz"/u);if(!match)throw Error('官方页面结构已变化，暂不解释。');const text=plain(match[1]);if(text.length<20)throw Error('正文未能读取。');return text.slice(0,2800);}
async function boundedText(response,max=1500000){if(!response.ok)throw Error('官方来源暂不可用。');if(Number(response.headers.get('content-length'))>max)throw Error('来源过大。');const reader=response.body.getReader(),parts=[];let size=0;try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max)throw Error('来源过大。');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(parts).toString('utf8');}
async function cancellable(promise,signal){if(!signal)return promise;signal.throwIfAborted();let cancel;try{return await Promise.race([promise,new Promise((_resolve,reject)=>{cancel=()=>reject(signal.reason);signal.addEventListener('abort',cancel,{once:true});})]);}finally{signal.removeEventListener('abort',cancel);}}
export function createCityPolicyService({fetcher=fetch,now=Date.now,ttlMs=21600000}={}){
 const cache=new Map();let indexCache=null,indexPending=null;
 const get=async(url,signal)=>boundedText(await fetcher(url,{redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),headers:{Accept:'application/json,text/html'}}));
 async function directory(signal){if(indexCache&&now()-indexCache.at<ttlMs)return indexCache.rows;if(indexPending)return cancellable(indexPending,signal);
  const loading=(async()=>{const rows=JSON.parse(await get(DIRECTORY_API));if(!Array.isArray(rows)||rows.length>1000)throw Error('官方目录未能读取。');indexCache={at:now(),rows};return rows;})();indexPending=loading;loading.finally(()=>{if(indexPending===loading)indexPending=null;}).catch(()=>{});return cancellable(loading,signal);
 }
 async function search(cityInput,topicInput,{signal,refresh=false}={}){
  signal?.throwIfAborted();
  const city=policyCity(cityInput),topic=topicOf(topicInput),key=city+':'+topic,stamp=()=>new Date(now()).toISOString();
  if(!refresh&&cache.has(key)){const saved=cache.get(key);if(now()-saved.at<ttlMs)return {...structuredClone(saved.value),cached:true};cache.delete(key);}
  const local=reviewedCityPolicies(city,topic);
  if(local.length)return {city,topic,status:'matched',sources:structuredClone(local),retrievedAt:stamp(),message:'以下为已核验并整理的官方资料；公开日期不等于当前申报窗口，办理前请核实现行条件。'};
  if(topic!=='stay')return {city,topic,status:'not-covered',sources:[],retrievedAt:stamp(),message:`尚未维护${city}的现金补贴。当前联网发现覆盖官方青年驿站目录，可另查求职住宿；本次不套用其他城市金额或资格。`};
  try{
   const rows=await directory(signal),row=rows.find(x=>typeof x?.title==='string'&&new RegExp(`【[^】]*${city}市?】`,'u').test(x.title));
   if(!row)return {city,topic,status:'not-found',sources:[],retrievedAt:stamp(),message:'本次官方目录中没有找到这个城市的独立条目，不代表当地一定没有政策。可到官方目录按省份继续核实。'};
   if(!/^\/ncss\/qnyz\/\d{6}\/\d{8}\/\d+\.html$/u.test(row.uri))throw Error('目录链接格式变化。');
   const url='https://www.chsi.com.cn'+row.uri,text=parsePolicyArticle(await get(url,signal));
   const date=row.uri.match(/\/(\d{4})(\d{2})(\d{2})\//u),checkedOn=stamp().slice(0,10);
   const source={id:'ncss-'+String(row.id).slice(0,30),city,title:plain(row.title).slice(0,200),scope:'官方目录城市条目；正文如有区县或驿站限制，以该限制为准，不自动认定个人资格',url,text,publishedOn:date?`${date[1]}-${date[2]}-${date[3]}`:null,checkedOn,mode:'live',authority:'国家大学生就业服务平台 · 青年驿站目录',applicationUrl:POLICY_DIRECTORY};
   const value={city,topic,status:'matched',sources:[source],retrievedAt:stamp(),message:'本次从官方目录发现并读取了城市介绍页；不是已审批结论。旧目录中的天数与条件，仍需向当期驿站核实。'};
   if(cache.size>=40)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),value});return structuredClone(value);
  }catch(error){if(signal?.aborted)throw error;return {city,topic,status:'unavailable',sources:[],retrievedAt:stamp(),message:'这次未能从官方来源完成读取，请稍后重试或打开官方目录；不使用模型记忆补造结果。'};}
 }
 return {search};
}
export const cityPolicyService=createCityPolicyService();
export function createCityPolicyMiddleware({service=cityPolicyService,policy=createRequestPolicy()}={}){let busy=0;const starts=[];return(req,res)=>{
 if(new URL(req.url,'http://localhost').pathname!=='/api/v1/policies/search')return false;
 const send=(status,data)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}};
 if(!policy.allows(req)){send(403,{error:'请在本站查询政策。'});return true;}if(req.method!=='POST'||!req.headers['content-type']?.startsWith('application/json')){send(405,{error:'请使用政策查询入口。'});return true;}
 const t=Date.now();while(starts.length&&starts[0]<t-60000)starts.shift();if(busy>=2||starts.length>=15){send(429,{error:'查询较多，请稍后再试。'});return true;}starts.push(t);busy++;
 const controller=new AbortController(),chunks=[];let size=0,released=false;
 const release=()=>{if(!released){released=true;busy--;}};
 const cancel=()=>{controller.abort();release();};
 res.on('close',()=>{if(!res.writableEnded)cancel();});req.on('aborted',cancel);req.on('error',cancel);
 req.on('data',chunk=>{size+=chunk.length;if(size<=2000)chunks.push(chunk);});
 req.on('end',()=>{void(async()=>{try{if(size>2000)throw Error('查询过长。');const body=JSON.parse(Buffer.concat(chunks).toString('utf8')),data=await service.search(body.city,body.topic,{signal:controller.signal,refresh:body.refresh===true});send(200,{requestId:randomUUID(),data});}catch{send(400,{error:'请检查城市名称和查询类型。'});}finally{release();}})();});return true;
 };}
