import {useId,useRef,useState} from 'react';
import {ArrowUpRight,MessageCircle,X} from 'lucide-react';
import {communicationPrompt} from './lib/communication.ts';
import type {AssistantAskOptions,CommunicationItem} from './lib/communication.ts';

export default function CommunicationDraft({item,onAsk}:{item:CommunicationItem;onAsk?:(text:string,options?:AssistantAskOptions)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),id=useId();
 const [quote,setQuote]=useState(item.quote),[question,setQuestion]=useState(item.question),[observation,setObservation]=useState(item.observation);
 if(!onAsk)return null;
 return <><button className="button tiny communication-open" type="button" onClick={()=>{setQuote(item.quote);setQuestion(item.question);setObservation(item.observation);dialog.current?.showModal();}}><MessageCircle size={14}/>让 AI 拟沟通话术<ArrowUpRight size={13}/></button>
 <dialog ref={dialog} className="communication-dialog" aria-labelledby={id} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
  <button className="communication-close" aria-label="关闭话术确认" onClick={()=>dialog.current?.close()}><X size={18}/></button>
  <small className="eyebrow">只带入这一项</small><h2 id={id}>先看看要交给 AI 的内容</h2><p>可删去姓名、公司名等信息。确认后会放入对话输入框，点击发送才会交给 DeepSeek。</p>
  <strong>{item.title}</strong><label>相关片段 <small>选填，最多 1800 字</small><textarea aria-label="带入AI的相关片段" rows={4} maxLength={1800} value={quote} onChange={event=>setQuote(event.target.value)}/></label>
  <label>本地核对提示 <small>可修改或删除</small><textarea aria-label="带入AI的核对提示" rows={3} maxLength={800} value={observation} onChange={event=>setObservation(event.target.value)}/></label><label>想向{item.recipient}确认什么<textarea aria-label="想沟通的问题" rows={3} maxLength={800} value={question} onChange={event=>setQuestion(event.target.value)}/></label>
  <footer><button className="button secondary" onClick={()=>dialog.current?.close()}>先不带入</button><button className="button primary" disabled={!question.trim()} onClick={()=>{dialog.current?.close();onAsk(communicationPrompt({...item,quote,question,observation}),{send:false,isolated:true});}}>确认带入对话<ArrowUpRight size={15}/></button></footer>
 </dialog></>;
}
