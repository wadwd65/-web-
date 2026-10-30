import type {ApiEnvelope,Capabilities,DocumentReview,DocumentReviewRequest,UploadConsent} from './api-types.ts';

type ErrorCode='not-configured'|'invalid-input'|'http'|'network'|'timeout'|'aborted'|'invalid-response';
export class FirstStepApiError extends Error{
 readonly code:ErrorCode;readonly status:number|undefined;readonly requestId:string|undefined;
 constructor(code:ErrorCode,message:string,status?:number,requestId?:string){super(message);this.name='FirstStepApiError';this.code=code;this.status=status;this.requestId=requestId;}
}
const modules=new Set(['offer','contract','salary','tax','social','rent','subsidy','leaving']);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max=1500):value is string=>typeof value==='string'&&value.length>0&&value.length<=max;
const strings=(value:unknown,max:number)=>Array.isArray(value)&&value.length<=max&&value.every(item=>text(item));
function capabilities(value:unknown):value is Capabilities{return record(value)&&value.schemaVersion===1&&Array.isArray(value.supportedModules)&&value.supportedModules.length<=8&&new Set(value.supportedModules).size===value.supportedModules.length&&value.supportedModules.every(item=>typeof item==='string'&&modules.has(item))&&['documentReview','ocr','rag','agent'].every(key=>typeof value[key]==='boolean');}
function review(value:unknown,original:string):value is DocumentReview{
 if(!record(value)||value.schemaVersion!==1||!Array.isArray(value.citations)||value.citations.length>100||!Array.isArray(value.findings)||value.findings.length>100||!strings(value.questions,50)||!strings(value.limitations,20))return false;
 const ids=new Set<string>(),findingIds=new Set<string>();
 for(const citation of value.citations){if(!record(citation)||!text(citation.id,80)||ids.has(citation.id)||!text(citation.title,300)||!text(citation.url,2048)||!(citation.region===null||text(citation.region,80))||typeof citation.verifiedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(citation.verifiedAt))return false;try{const url=new URL(citation.url);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return false;}catch{return false;}ids.add(citation.id);}
 for(const finding of value.findings){if(!record(finding)||!text(finding.id,80)||findingIds.has(finding.id)||!text(finding.title,300)||!['noted','needs-confirmation','missing-information'].includes(String(finding.status))||!Array.isArray(finding.sourceIds)||finding.sourceIds.length>100||!finding.sourceIds.every(id=>typeof id==='string'&&ids.has(id)))return false;findingIds.add(finding.id);if(finding.evidence!==null){const span=finding.evidence;if(!record(span)||!Number.isInteger(span.start)||!Number.isInteger(span.end)||typeof span.start!=='number'||typeof span.end!=='number'||span.start<0||span.end<=span.start||span.end>original.length||typeof span.text!=='string'||original.slice(span.start,span.end)!==span.text)return false;}}
 return true;
}

/** This client is dormant until configured and explicitly called. No key belongs
 * in the browser. Document uploads additionally require an explicit consent flag. */
export function createFirstStepApi({baseUrl='',fetcher=globalThis.fetch,timeoutMs=20000}:{baseUrl?:string;fetcher?:typeof fetch;timeoutMs?:number}={}){
 const base=baseUrl.trim().replace(/\/+$/,'');
 if(base){let valid=base.startsWith('/')&&!base.startsWith('//')&&!/[?#]/.test(base);if(!valid){try{const url=new URL(base);valid=['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!url.search&&!url.hash;}catch{valid=false;}}if(!valid)throw new FirstStepApiError('invalid-input','API服务地址格式不正确。');}
 const timeout=Number.isFinite(timeoutMs)?Math.max(1,Math.min(60000,timeoutMs)):20000;
 async function request<T>(path:string,body:unknown,validate:(value:unknown)=>value is T,signal?:AbortSignal):Promise<ApiEnvelope<T>>{
  if(!base)throw new FirstStepApiError('not-configured','在线接口尚未配置，当前使用本地工具。');
  if(signal?.aborted)throw new FirstStepApiError('aborted','请求已取消。');
  const controller=new AbortController();let expired=false;const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{expired=true;controller.abort();},timeout);
  try{
   const response=await fetcher(`${base}${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json','Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',signal:controller.signal,...(body===undefined?{}:{body:JSON.stringify(body)})});
   const rawId=response.headers.get('X-Request-ID'),requestId=rawId&&/^[\w.-]{1,80}$/.test(rawId)?rawId:undefined;
   if(!response.ok)throw new FirstStepApiError('http',`服务暂不可用（HTTP ${response.status}）。`,response.status,requestId);
   let result:unknown;try{result=await response.json();}catch{throw new FirstStepApiError('invalid-response','服务返回的内容无法读取。',undefined,requestId);}
   if(controller.signal.aborted)throw new FirstStepApiError(expired?'timeout':'aborted',expired?'请求超时，请稍后重试。':'请求已取消。');
   if(!record(result)||!text(result.requestId,80)||!validate(result.data))throw new FirstStepApiError('invalid-response','服务结果未通过结构或原文引用校验。',undefined,requestId);
   return {requestId:result.requestId,data:result.data};
  }catch(error){if(error instanceof FirstStepApiError)throw error;if(controller.signal.aborted)throw new FirstStepApiError(expired?'timeout':'aborted',expired?'请求超时，请稍后重试。':'请求已取消。');throw new FirstStepApiError('network','暂时无法连接服务，请稍后重试。');}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 return {
  configured:!!base,
  getCapabilities:(signal?:AbortSignal)=>request('/capabilities',undefined,capabilities,signal),
  reviewDocument:(input:DocumentReviewRequest,consent:UploadConsent)=>{
   if(consent?.transmitConfirmed!==true||!record(input)||!['contract','rent'].includes(input.module)||!text(input.text,60000)||!input.text.trim()||!(input.region===null||text(input.region,80))||(input.confirmed!==undefined&&(!record(input.confirmed)||Object.keys(input.confirmed).length>30||!Object.entries(input.confirmed).every(([key,value])=>text(key,80)&&(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=1500||typeof value==='number'&&Number.isFinite(value))))))return Promise.reject(new FirstStepApiError('invalid-input','请确认材料发送意愿，并核对文本、地区及已知参数。'));
   return request('/documents/review',input,(value):value is DocumentReview=>review(value,input.text),consent.signal);
  },
 };
}
