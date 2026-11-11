import {useState} from 'react';
import {ArrowRight,ChevronDown,CornerDownLeft} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';
import type {AssistantGuide} from './services/assistant-types.ts';

const label=(id:string)=>EXPERIENCE_MODULES.find(module=>module.id===id)?.label??'';

export default function AssistantNextStep({guide,busy,onSend}:{guide:AssistantGuide;busy:boolean;onSend:(text:string)=>void}){
 const [values,setValues]=useState<string[]>(()=>guide.questions.map(()=>''));
 if(guide.status==='clarify')return null;
 if(guide.status!=='choose'&&!guide.questions.length)return null;

 function submit(){
  onSend(`补充${label(guide.activeModule??'')}的信息：\n`+guide.questions.map((question,index)=>`${question.label}：${values[index]?.trim()||'暂时不知道'}`).join('\n'));
 }

 return <section className="assistant-next-step" aria-label="可选的回复方式">
  {guide.status==='choose'&&<div className="assistant-topic-options" role="group" aria-label="也可以点选想先聊的事">
   {guide.tasks.map(task=><button type="button" key={task.module} disabled={busy} onClick={()=>onSend(`先处理${label(task.module)}，其他事情先放一边。`)}>
    先聊{label(task.module)}<ArrowRight size={13}/>
   </button>)}
  </div>}
  {!!guide.questions.length&&<details className="assistant-optional-input">
   <summary><span>按项补充 <small>可选</small></span><ChevronDown size={13}/></summary>
   <form onSubmit={event=>{event.preventDefault();submit();}}>
    <div className="assistant-needed-fields" data-money={guide.activeModule==='salary'} data-count={guide.questions.length}>
     {guide.questions.map((question,index)=><label key={question.label} data-wide={/原文|全文|合同文字/u.test(question.label)}>
      {question.label}
      {/原文|全文|合同文字/u.test(question.label)
       ?<textarea rows={3} value={values[index]??''} maxLength={5000} onChange={event=>setValues(previous=>previous.map((value,i)=>i===index?event.target.value:value))} placeholder={question.hint} disabled={busy}/>
       :<input value={values[index]??''} maxLength={1000} onChange={event=>setValues(previous=>previous.map((value,i)=>i===index?event.target.value:value))} placeholder={question.hint} disabled={busy}/>
      }
     </label>)}
    </div>
    <footer><button type="button" disabled={busy} onClick={()=>setValues(guide.questions.map(()=>'暂时不知道'))}>暂时都不清楚</button><button type="submit" disabled={busy||!values.some(value=>value.trim())}>发送补充<CornerDownLeft size={13}/></button></footer>
    <p>留空的项会说明“暂时不知道”。也可以直接在下方聊天。</p>
   </form>
  </details>}
 </section>;
}
