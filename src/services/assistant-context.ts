import type {AssistantMessage} from './assistant-types.ts';

export const USER_CONTEXT_LIMIT=20000;
/** Preserve every user quote, in order. Only old assistant explanations are omitted.
 * No generated summary is promoted to a user-confirmed fact. Limits stay bounded. */
export function buildAssistantContext(turns:AssistantMessage[]){
 if(!turns.length||turns.at(-1)?.role!=='user')throw new Error('请先写下这次问题。');
 const users=turns.filter(turn=>turn.role==='user');
 if(users.some(turn=>!turn.content.trim()||turn.content.length>6000))throw new Error('每次问题最多6000字，请缩短后发送。');
 if(users.reduce((sum,turn)=>sum+turn.content.length+2,0)>USER_CONTEXT_LIMIT)throw new Error('本次材料已达到保留上限。请先复制对话留存，再新建对话；原记录没有删除。');
 const messages:AssistantMessage[]=[];
 // Keep only the two newest assistant messages as context for follow-up references.
 const recent=new Set(turns.map((turn,index)=>turn.role==='assistant'?index:-1).filter(index=>index>=0).slice(-2));
 for(let index=0;index<turns.length;index++){
  const turn=turns[index];
  if(turn.role==='assistant'){
   if(recent.has(index))messages.push({role:'assistant',content:turn.content.slice(0,1500)});
   continue;
  }
  const last=messages.at(-1);
  if(last?.role==='user'&&last.content.length+turn.content.length+2<=6000)last.content+='\n\n'+turn.content;
  else messages.push({role:'user',content:turn.content});
 }
 return {messages,folded:turns.filter(turn=>turn.role==='assistant').length>recent.size,userMessages:users.length};
}
