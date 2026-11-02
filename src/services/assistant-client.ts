import {calculatePayslip} from '../lib/wages.ts';
import {ASSISTANT_MODULES} from './assistant-types.ts';
import {validateAssistantGuide} from './assistant-guide.ts';
import type {AssistantAction,AssistantMessage,AssistantReply,AssistantStatus,AssistantProgress} from './assistant-types.ts';

const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const moduleId=(value:unknown)=>typeof value==='string'&&ASSISTANT_MODULES.includes(value as typeof ASSISTANT_MODULES[number]);
export class AssistantClientError extends Error{
 code:string;
 constructor(code:string,message:string){super(message);this.name='AssistantClientError';this.code=code;}
}
function validAction(value:unknown):value is AssistantAction{
 if(!object(value)||!text(value.label,100))return false;
 if(value.kind==='open-tool')return moduleId(value.module);
 if(value.kind==='add-questions')return Array.isArray(value.items)&&value.items.length>0&&value.items.length<=5&&value.items.every(item=>object(item)&&text(item.text,500)&&text(item.category,50));
 if(!object(value.input))return false;
 const input=value.input;
 if(value.kind==='apply-salary'){
  if(!['gross','insurance','fund','tax','other'].every(key=>typeof input[key]==='number')||(input.received!==null&&typeof input.received!=='number'))return false;
  try{calculatePayslip(input as unknown as Parameters<typeof calculatePayslip>[0]);return true;}catch{return false;}
 }
 if(value.kind==='apply-contract')return text(input.text,12000)&&input.fullTimeConfirmed===true&&['contractMonths','probationMonths'].every(key=>input[key]===null||(typeof input[key]==='number'&&Number.isFinite(input[key])&&input[key]>=0&&input[key]<=1200));
 return false;
}
export function validateAssistantReply(value:unknown):AssistantReply{
 if(!object(value)||value.provider!=='DeepSeek'||!text(value.model,100)||!text(value.reply,16000)||!Array.isArray(value.actions)||value.actions.length>6||!value.actions.every(validAction)||!Array.isArray(value.steps)||value.steps.length>6||!value.steps.every(step=>object(step)&&text(step.id,30)&&text(step.name,100)&&text(step.label,100)&&typeof step.ok==='boolean'&&text(step.summary,300)))throw new AssistantClientError('invalid-response','回复格式不完整，请重试。');
 if(value.replyOrigin!==undefined&&!['model','guide'].includes(String(value.replyOrigin)))throw new AssistantClientError('invalid-response','回复来源不完整，请重试。');
 if(value.guide!==undefined){try{value.guide=validateAssistantGuide(value.guide);}catch{throw new AssistantClientError('invalid-response','事项与补问信息不完整，请重试。');}}
 return value as unknown as AssistantReply;
}
export function createAssistantClient(fetcher:typeof fetch=fetch){
 async function request(path:string,body:unknown,signal?:AbortSignal,onProgress?:(stage:AssistantProgress)=>void){
  if(signal?.aborted)throw new AssistantClientError('aborted','已停止回复。');
  const controller=new AbortController(),cancel=()=>controller.abort();let timedOut=false;
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},55000);
  try{
   const response=await fetcher('/api/v1/assistant/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   if(response.ok&&response.headers.get('content-type')?.includes('application/x-ndjson')){
    if(!response.body)throw new AssistantClientError('invalid-response','回复中断了，请重试。');
    const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',size=0,result:unknown,done=false;
    try{while(!done){const chunk=await reader.read();done=chunk.done;pending+=decoder.decode(chunk.value,{stream:!done});size+=chunk.value?.byteLength??0;if(size>262144||pending.length>131072)throw new AssistantClientError('invalid-response','回复过长，请缩小问题范围。');
     const lines=pending.split('\n');pending=lines.pop()??'';if(done&&pending.trim()){lines.push(pending);pending='';}
     for(const line of lines){if(!line.trim())continue;let event:unknown;try{event=JSON.parse(line);}catch{throw new AssistantClientError('invalid-response','回复中断了，请重试。');}
      if(!object(event))throw new AssistantClientError('invalid-response','回复格式不完整，请重试。');
      if(event.type==='progress'&&['planning','checking','responding'].includes(String(event.stage)))onProgress?.(event.stage as AssistantProgress);
      else if(event.type==='result'){if(result!==undefined)throw new AssistantClientError('invalid-response','回复重复，请重试。');result=event.data;}
      else if(event.type==='error'&&object(event.error))throw new AssistantClientError(text(event.error.code,50)?event.error.code:'http',text(event.error.message,300)?event.error.message:'回复没有完成，请重试。');
      else throw new AssistantClientError('invalid-response','回复格式不完整，请重试。');
     }
    }}finally{if(!done)await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(result===undefined)throw new AssistantClientError('invalid-response','回复中断了，可以重试原问题。');return result;
   }
   let envelope:unknown;try{envelope=await response.json();}catch{throw new AssistantClientError('invalid-response','AI服务没有返回有效内容，请检查本地服务是否启动。');}
   if(!response.ok){const error=object(envelope)&&object(envelope.error)?envelope.error:null;throw new AssistantClientError(error&&text(error.code,50)?error.code:'http',error&&text(error.message,300)?error.message:'这次请求没有完成，请稍后重试。');}
   if(!object(envelope)||!object(envelope.data))throw new AssistantClientError('invalid-response','回复格式不完整，请重试。');
   return envelope.data;
  }catch(error){
   if(controller.signal.aborted)throw new AssistantClientError(timedOut?'timeout':'aborted',timedOut?'回复有些慢，请稍后重试。':'已停止回复。');
   if(error instanceof AssistantClientError)throw error;
   throw new AssistantClientError('network','暂时联系不上AI服务。你也可以先打开工具列表。');
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 return {
  async status(signal?:AbortSignal):Promise<AssistantStatus>{const data=await request('status',undefined,signal);if(!object(data)||typeof data.configured!=='boolean'||data.provider!=='DeepSeek'||!text(data.model,100))throw new AssistantClientError('invalid-response','AI连接状态暂不可用。');return data as unknown as AssistantStatus;},
  async chat(messages:AssistantMessage[],module:string,signal?:AbortSignal,onProgress?:(stage:AssistantProgress)=>void){return validateAssistantReply(await request('chat',{messages,module},signal,onProgress));},
 };
}
export const assistantClient=createAssistantClient();
