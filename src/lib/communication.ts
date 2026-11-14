import type {AssistantMessage} from '../services/assistant-types.ts';

export type AssistantAskOptions={send?:boolean;isolated?:boolean};
export type CommunicationItem={title:string;quote:string;observation:string;question:string;recipient:'HR'|'房东'};
/** Select a fresh context boundary without changing the visible conversation. */
export function isolatedContext<T extends AssistantMessage & {contextStart?:boolean}>(turns:T[]):AssistantMessage[]{
 let start=0;for(let i=0;i<turns.length;i++)if(turns[i].role==='user'&&turns[i].contextStart)start=i;
 return turns.slice(start).map(({role,content})=>({role,content}));
}
export function communicationPrompt(item:CommunicationItem):string{
 const clean=(value:string,max:number)=>value.trim().slice(0,max);
 return ['请只根据下面这一项，帮我拟一段可以发给'+item.recipient+'的沟通文字，语气礼貌、明确，先核实再提出修改或说明请求。不要把待确认事项说成已确定违法，不编造金额、期限或对方承诺；不需要我先填完整表单。',
 `事项：${clean(item.title,120)}`,`我确认带入的片段：${clean(item.quote,1800)||'未提供原文，只讨论下面的待确认问题。'}`,
 `本地核对提示（待核实）：${clean(item.observation,800)}`,`我想问：${clean(item.question,800)}`].join('\n\n');
}
