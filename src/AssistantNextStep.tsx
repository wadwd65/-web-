import {useState} from 'react';
import {ArrowRight,CornerDownLeft,PencilLine} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';
import {CONTRACT_REFERENCE} from './lib/contracts.ts';
import type {AssistantGuide} from './services/assistant-types.ts';
const label=(id:string)=>EXPERIENCE_MODULES.find(m=>m.id===id)?.label??'';
export default function AssistantNextStep({guide,busy,onSend,onCorrect}:{guide:AssistantGuide;busy:boolean;onSend:(text:string)=>void;onCorrect:()=>void}){
 const [values,setValues]=useState<string[]>(()=>guide.questions.map(()=>''));
 const title=guide.status==='choose'?'选一件先处理':guide.status==='needs-info'?'还差这几项信息':guide.status==='clarify'?'先确认一下':guide.status==='out-of-scope'?'这件事暂不在工具范围内':`当前这件事 · ${label(guide.activeModule??'')}`;
 function submit(){onSend(`补充${label(guide.activeModule??'')}的信息：\n`+guide.questions.map((q,i)=>`${q.label}：${values[i]?.trim()||'暂时不知道'}`).join('\n'));}
 return <section className="assistant-next-step" aria-label="当前事项与补充信息"><header><strong>{title}</strong><button type="button" onClick={onCorrect} disabled={busy}><PencilLine size={12}/>纠正事项</button></header>
  {!!guide.tasks.length&&<div className="assistant-task-path">{guide.tasks.map((task,index)=><button type="button" key={task.module} aria-label={`先处理${label(task.module)}`} aria-pressed={guide.activeModule===task.module} disabled={busy||guide.activeModule===task.module} onClick={()=>onSend(`先处理${label(task.module)}，其他事情先放一边。`)}><small>{String(index+1).padStart(2,'0')}</small><span><strong>{label(task.module)}</strong><small>{task.reason}</small></span>{guide.activeModule!==task.module&&<ArrowRight size={13}/>}</button>)}</div>}
  {!!guide.questions.length&&<form onSubmit={event=>{event.preventDefault();submit();}}><div className="assistant-needed-fields" data-money={guide.activeModule==='salary'} data-count={guide.questions.length}>{guide.questions.map((question,index)=><label key={question.label} data-wide={/原文|全文|合同文字/.test(question.label)}>{question.label}{/原文|全文|合同文字/.test(question.label)?<textarea rows={3} value={values[index]??''} maxLength={5000} onChange={event=>setValues(previous=>previous.map((value,i)=>i===index?event.target.value:value))} placeholder={question.hint} disabled={busy}/>:<input value={values[index]??''} maxLength={1000} onChange={event=>setValues(previous=>previous.map((value,i)=>i===index?event.target.value:value))} placeholder={question.hint} disabled={busy}/>}</label>)}</div><footer><button type="button" disabled={busy} onClick={()=>setValues(guide.questions.map(()=>'暂时不知道'))}>暂时都不清楚</button><button type="submit" disabled={busy||!values.some(value=>value.trim())}>补充这些信息<CornerDownLeft size={13}/></button></footer><p>留空的项会说明“暂时不知道”，不会当作 0。也可以在下方直接回复。</p></form>}
 {guide.activeModule==='contract'&&<a className="assistant-local-source" href={CONTRACT_REFERENCE.source} target="_blank" rel="noreferrer">本地规则来源：劳动合同法 · 核验 {CONTRACT_REFERENCE.checked} ↗</a>}
 </section>;
}
