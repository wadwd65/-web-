import ContractSources from './ContractSources.tsx';
import {contractSourcesForCopy} from './lib/contract-knowledge.ts';
import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {buildAssistantContext} from './services/assistant-context.ts';
import AssistantNextStep from './AssistantNextStep.tsx';
import {ArrowUp,ArrowUpRight,Check,ChevronDown,Copy,Square,X} from 'lucide-react';
import RhineMark from './RhineMark.tsx';
import AssistantEvidence,{evidenceForCopy} from './AssistantEvidence.tsx';
import {assistantClient,AssistantClientError} from './services/assistant-client.ts';
import type {AssistantAction,AssistantMessage,AssistantReply,AssistantStatus,AssistantProgress} from './services/assistant-types.ts';

type Turn=AssistantMessage&{id:number;result?:AssistantReply};
export type AssistantSeed={id:number;text:string;send:boolean};
export default function AIAssistant({open,onClose,module,seed,onAction,onTools,modeSwitch,onResume}:{open:boolean;onClose:()=>void;module:string;seed:AssistantSeed|null;onAction:(action:AssistantAction)=>void;onTools:()=>void;modeSwitch?:ReactNode;onResume:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),field=useRef<HTMLTextAreaElement>(null),bottom=useRef<HTMLDivElement>(null),lastTurn=useRef<HTMLElement>(null),request=useRef<AbortController|null>(null),serial=useRef(0),usedSeed=useRef(0),turnsRef=useRef<Turn[]>([]);
 const [turns,setTurns]=useState<Turn[]>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState<AssistantStatus|null>(null),[applied,setApplied]=useState<string[]>([]);
 const [stage,setStage]=useState<AssistantProgress|null>(null),[freeReply,setFreeReply]=useState(false),[contextFolded,setContextFolded]=useState(false);
 const [copied,setCopied]=useState<number|null>(null),[copyError,setCopyError]=useState('');
 turnsRef.current=turns;
 function stop(){serial.current++;request.current?.abort();request.current=null;setBusy(false);setStage(null);setError('已停止回复。已发送的问题还在，可以重试或修改后再发。');}
 function close(){onClose();}
 async function send(text:string,retry=false){
  const value=text.trim();if(request.current||!value)return;
  if(value.length>6000){setError('问题最多6000字，请缩短后再发送。');return;}
  const previous=turnsRef.current;
  const next=retry?previous:[...previous,{id:Date.now(),role:'user' as const,content:value}];
  let context;try{context=buildAssistantContext(next);}catch(cause){setError(cause instanceof Error?cause.message:'请缩短材料后重试。');return;}
  setContextFolded(context.folded);setFreeReply(false);
  const controller=new AbortController(),id=++serial.current;request.current=controller;setTurns(next);setInput('');setError('');setBusy(true);setStage(null);
  try{
   const result=await assistantClient.chat(context.messages,module,controller.signal,value=>{if(serial.current===id)setStage(value);});
   if(serial.current!==id)return;
   setTurns([...next,{id:Date.now()+1,role:'assistant',content:result.reply,result}]);setStatus({configured:true,provider:'DeepSeek',model:result.model});
  }catch(cause){if(serial.current===id)setError(cause instanceof AssistantClientError?cause.message:'这次没有完成，请重试。');}
  finally{if(serial.current===id){request.current=null;setBusy(false);setStage(null);if(dialog.current?.open)field.current?.focus({preventScroll:true});}}
 }
 const sendRef=useRef(send);sendRef.current=send;
 useEffect(()=>{
  if(open){if(!dialog.current?.open)dialog.current?.showModal();field.current?.focus();const controller=new AbortController();void assistantClient.status(controller.signal).then(setStatus).catch(()=>setStatus(null));return()=>controller.abort();}
  if(dialog.current?.open)dialog.current.close();
 },[open]);
 useEffect(()=>{if(!open||!seed||seed.id===usedSeed.current)return;usedSeed.current=seed.id;if(seed.send&&!request.current)void sendRef.current(seed.text);else setInput(seed.text);},[open,seed]);
 useEffect(()=>{if(!open)return;if(!busy&&turns.at(-1)?.role==='assistant'&&!error)lastTurn.current?.scrollIntoView({block:'start',behavior:'instant'});else bottom.current?.scrollIntoView({block:'end',behavior:'instant'});},[turns,busy,error,open]);
 useEffect(()=>()=>{serial.current++;request.current?.abort();},[]);
 useEffect(()=>{if(copied===null)return;const timer=setTimeout(()=>setCopied(null),1800);return()=>clearTimeout(timer);},[copied]);
 async function copyReply(turn:Turn){try{const evidence=turn.result?evidenceForCopy(turn.result.actions):'';await navigator.clipboard.writeText([evidence,turn.content,turn.result?.references?.status==='matched'?contractSourcesForCopy(turn.result.references):''].filter(Boolean).join('\n\n'));setCopied(turn.id);setCopyError('');}catch{setCopyError('复制没有成功，可以选中文字复制。');}}
 function apply(action:AssistantAction,id:string){if(applied.includes(id))return;setApplied(values=>[...values,id]);onAction(action);if(action.kind!=='add-questions')close();}
 const last=turns.at(-1);
 const hasFields=Boolean(last?.result?.guide?.questions.length)&&!busy&&!error;
 useEffect(()=>{if(!open||busy)return;const target=hasFields&&!freeReply?dialog.current?.querySelector<HTMLInputElement>('.assistant-needed-fields input, .assistant-needed-fields textarea'):field.current;target?.focus({preventScroll:true});},[open,busy,hasFields,freeReply]);
 async function copyConversation(){try{await navigator.clipboard.writeText(turns.map(turn=>`${turn.role==='user'?'你':'初程助手'}：${turn.content}${turn.result?.references?.status==='matched'?'\n\n'+contractSourcesForCopy(turn.result.references):''}`).join('\n\n'));setCopyError('对话已复制。');}catch{setCopyError('复制没有成功，可以选中文字复制。');}}
 function correct(){setFreeReply(true);setInput('我想纠正一下，我要处理的是：');field.current?.focus();}
 return <><dialog ref={dialog} className="assistant-dialog" data-busy={busy} data-has-messages={turns.length>0} aria-labelledby="assistant-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
  <div className="assistant-dialog-inner">
   <header><div><span className="assistant-mark"><RhineMark/></span><span><h2 id="assistant-title">初程助手</h2><small><i/>{turns.some(turn=>turn.role==='assistant')?'DeepSeek · 已回应':status?.configured?'DeepSeek · 可以开始提问':status?.configured===false?'DeepSeek · 尚未配置':'DeepSeek · 连接状态待确认'}</small></span></div><div>{modeSwitch}<button onClick={()=>{stop();setTurns([]);setApplied([]);setInput('');setError('');setCopyError('');setFreeReply(false);setContextFolded(false);field.current?.focus();}} disabled={busy||(!turns.length&&!input)}>新对话<span aria-hidden="true">＋</span></button><button className="assistant-close" onClick={close} aria-label="收起AI助手" title="收起，正在处理的回复会继续"><X size={20}/></button></div></header>
   {contextFolded&&<div className="assistant-context-note">较早解释已折叠发送，用户原话与更正仍按顺序保留。<button onClick={()=>void copyConversation()}>复制对话</button></div>}
   <div className="assistant-messages" role="log" aria-label="对话记录" aria-busy={busy}>
    {!turns.length&&<section className="assistant-welcome"><span className="eyebrow">FIRST STEP / LET'S TALK</span><h3>先说说，<br/>遇到什么事了？</h3><p>不用先找工具。把情况告诉我，<br/>我们先弄清楚眼前这一件。</p><div>{['刚拿到 offer，签字前要看什么？','工资扣了好几项，我想核对一下。','第一次租房，该先问清楚什么？'].map((example,index)=><button key={example} onClick={()=>{setInput(example);field.current?.focus();}}><small>{String(index+1).padStart(2,'0')}</small><span>{example}</span><ArrowUpRight size={14}/></button>)}</div></section>}
    {turns.map(turn=><article key={turn.id} ref={turn===last?lastTurn:undefined} className={`assistant-turn is-${turn.role}`}><div className="assistant-turn-heading"><small>{turn.role==='user'?'你':'初程助手'}</small>{turn.role==='assistant'&&<button onClick={()=>void copyReply(turn)} aria-label={copied===turn.id?'回复已复制':'复制这条回复'} title="复制回复">{copied===turn.id?<Check size={13}/>:<Copy size={13}/>}<span>{copied===turn.id?'已复制':'复制'}</span></button>}</div>{turn.result&&<AssistantEvidence actions={turn.result.actions}/>}<p>{turn.content}</p>{turn.result&&<>
     {turn.result.references&&<ContractSources result={turn.result.references}/>}
     {!!turn.result.actions.length&&<div className="assistant-actions" data-current={turn===last}><small>{turn===last?'接下来可以':'较早的结果，操作已停用；以最新回复为准'}</small>{turn.result.actions.map((action,index)=>{const id=`${turn.id}:${index}`,done=applied.includes(id);return <button key={id} onClick={()=>apply(action,id)} disabled={busy||done||turn!==last}>{done?<Check size={15}/>:<ArrowUpRight size={15}/>}<span>{done?'已应用':action.label}{!done&&(action.kind==='apply-salary'||action.kind==='apply-contract')&&<small>替换该工具本次填写的内容</small>}</span></button>;})}</div>}
     {turn===last&&turn.result.guide&&<AssistantNextStep key={turn.id} guide={turn.result.guide} showLocalSource={!turn.result.references} busy={busy} onSend={text=>void send(text)} onCorrect={correct}/>}
     {!!turn.result.steps.length&&<details className="assistant-steps"><summary>处理依据 · {turn.result.steps.length} 步<ChevronDown size={13}/></summary><ol>{turn.result.steps.map(step=><li key={step.id} data-ok={step.ok}><span>{step.ok?'✓':'·'}</span><span>{step.label}<small>{step.summary}</small></span></li>)}</ol></details>}
    </>}</article>)}
    {busy&&<div className="assistant-thinking" role="status"><span className="assistant-thinking-dots" aria-hidden="true"><i/><i/><i/></span><span>{stage==='planning'?'正在确认你要处理的事…':stage==='retrieving'?'正在检索官方合同资料…':stage==='checking'?'正在用工具核对信息…':stage==='responding'?'正在整理回复…':'正在连接助手…'}</span></div>}
    {error&&<div className="assistant-error" role="alert"><p>{error}</p>{last?.role==='user'&&!busy&&<button onClick={()=>void send(last.content,true)}>重试这条问题<ArrowUpRight size={13}/></button>}{!!turns.length&&<button onClick={()=>void copyConversation()}>复制现有对话<Copy size={13}/></button>}</div>}
    <div ref={bottom}/>
   </div>
   {hasFields&&<div className="assistant-reply-choice"><span>先填上面的补充信息</span><button onClick={()=>{setFreeReply(value=>!value);requestAnimationFrame(()=>field.current?.focus());}} aria-expanded={freeReply}>{freeReply?'收起自由输入':'用自己的话补充'}<ChevronDown size={13}/></button></div>}
   <form hidden={hasFields&&!freeReply} className="assistant-composer" onSubmit={event=>{event.preventDefault();void send(input);}}>
    <label htmlFor="assistant-input" className="sr-only">向AI说明问题</label><textarea id="assistant-input" ref={field} rows={2} value={input} maxLength={6000} onChange={event=>setInput(event.target.value)} placeholder="用自己的话说就好…" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(!busy)void send(input);}}}/>
    {busy?<button className="assistant-stop" type="button" onClick={stop} aria-label="停止AI回复"><Square size={13}/><span>停止</span></button>:<button className="assistant-send" type="submit" disabled={!input.trim()} aria-label="发送问题"><ArrowUp size={21}/></button>}
   </form>
   <footer><p>仅发送对话文字，已有材料不会自动上传。<span>{copyError||(hasFields&&!freeReply?'填写后点“补充这些信息” · 对话仅本次保留':'Enter 发送 · Shift + Enter 换行 · 对话仅本次保留')}</span></p><button onClick={()=>{close();onTools();}}>自己使用工具<ArrowUpRight size={13}/></button></footer>
  </div>
 </dialog>
 {!open&&(busy||turns.length>0)&&<button className="assistant-return" onClick={onResume} aria-label={busy?'返回正在处理的对话':'返回上次对话'}><span className={busy?'is-busy':''}/><strong>{busy?'助手正在处理':'回到对话'}</strong><small>{busy?'可以继续使用工具':'本次记录还在'}</small><ArrowUpRight size={16}/></button>}
 </>;
}
