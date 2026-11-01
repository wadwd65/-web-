import {calculatePayslip} from '../lib/wages.ts';
import {ASSISTANT_MODULES} from './assistant-types.ts';
import {validateAssistantGuide} from './assistant-guide.ts';
import type {AssistantAction,AssistantMessage,AssistantReply,AssistantStatus} from './assistant-types.ts';

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
 async function request(path:string,body:unknown,signal?:AbortSignal){
  if(signal?.aborted)throw new AssistantClientError('aborted','已停止回复。');
  const controller=new AbortController(),cancel=()=>controller.abort();let timedOut=false;
  signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},55000);
  try{
   const response=await fetcher('/api/v1/assistant/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
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
  async status(signal?:AbortSignal):Promise<AssistantStatus>{const data=await request('status',undefined,signal);if(typeof data.configured!=='boolean'||data.provider!=='DeepSeek'||!text(data.model,100))throw new AssistantClientError('invalid-response','AI连接状态暂不可用。');return data as unknown as AssistantStatus;},
  async chat(messages:AssistantMessage[],module:string,signal?:AbortSignal){return validateAssistantReply(await request('chat',{messages,module},signal));},
 };
}
export const assistantClient=createAssistantClient();
