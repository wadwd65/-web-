import type {PayslipInput} from '../lib/wages.ts';

export const ASSISTANT_MODULES=['offer','contract','salary','tax','social','rent','subsidy','leaving','list'] as const;
export type AssistantModule=(typeof ASSISTANT_MODULES)[number];
export type ContractAssistantInput={text:string;contractMonths:number|null;probationMonths:number|null;fullTimeConfirmed:true};
export type AssistantAction=
 | {kind:'open-tool';module:AssistantModule;label:string}
 | {kind:'apply-salary';input:PayslipInput;label:string}
 | {kind:'apply-contract';input:ContractAssistantInput;label:string}
 | {kind:'add-questions';items:{text:string;category:string}[];label:string};
export type AssistantMessage={role:'user'|'assistant';content:string};
export type AssistantProgress='planning'|'checking'|'responding';
export type AssistantStep={id:string;name:string;label:string;ok:boolean;summary:string};
export type AssistantGuide={intent?:'calculate'|'review'|'guidance'|'questions';status:'choose'|'needs-info'|'ready'|'clarify'|'out-of-scope';tasks:{module:Exclude<AssistantModule,'list'>;reason:string}[];activeModule:Exclude<AssistantModule,'list'>|null;questions:{label:string;hint:string}[]};
export type AssistantReply={reply:string;actions:AssistantAction[];steps:AssistantStep[];provider:'DeepSeek';model:string;replyOrigin?:'model'|'guide';guide?:AssistantGuide};
export type AssistantStatus={configured:boolean;provider:'DeepSeek';model:string};
export type AssistantApply<T>={id:number;input:T};
