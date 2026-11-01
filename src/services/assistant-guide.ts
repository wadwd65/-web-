import {ASSISTANT_MODULES} from './assistant-types.ts';
import type {AssistantGuide} from './assistant-types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const moduleId=(v:unknown)=>typeof v==='string'&&v!=='list'&&ASSISTANT_MODULES.includes(v as typeof ASSISTANT_MODULES[number]);
/** Shared boundary for planner output; no arbitrary routes, fields or executable actions. */
export function validateAssistantGuide(value:unknown):AssistantGuide{
 if(!object(value)||!['choose','needs-info','ready','clarify','out-of-scope'].includes(String(value.status))||!Array.isArray(value.tasks)||value.tasks.length>3||!value.tasks.every(t=>object(t)&&moduleId(t.module)&&text(t.reason,120))||new Set(value.tasks.map(t=>t.module)).size!==value.tasks.length||!Array.isArray(value.questions)||value.questions.length>3||!value.questions.every(q=>object(q)&&text(q.label,80)&&typeof q.hint==='string'&&q.hint.length<=120))throw Error('Invalid task guide');
 if(value.intent!==undefined&&!['calculate','review','guidance','questions'].includes(String(value.intent)))throw Error('Invalid task intent');
 if(value.intent==='guidance'&&value.status==='needs-info')throw Error('Explain without requiring calculation fields');
 const ids=value.tasks.map(t=>t.module),focused=moduleId(value.activeModule)&&ids.includes(value.activeModule);
 if(value.status==='choose'&&(ids.length<2||value.activeModule!==null||value.questions.length))throw Error('Choose one task first');
 if(value.status==='ready'&&(!focused||value.questions.length))throw Error('Ready needs one focus');
 if(value.status==='needs-info'&&(!focused||!value.questions.length))throw Error('Missing questions');
 if(value.status==='clarify'&&(ids.length||value.activeModule!==null||!value.questions.length))throw Error('Clarify scope first');
 if(value.status==='out-of-scope'&&(ids.length||value.activeModule!==null||value.questions.length))throw Error('No actions outside scope');
 // Model-written hints must never suggest guessing/zero defaults for unknown facts.
 const guide=value as unknown as AssistantGuide;
 return {...guide,questions:guide.questions.map(q=>({...q,hint:guide.activeModule==='salary'?'填写已确认金额（元）；不清楚就写“不知道”。':'填写已确认的信息；不清楚就写“不知道”。'}))};
}
