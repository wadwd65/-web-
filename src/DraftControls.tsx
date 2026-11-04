import {useEffect,useMemo,useRef,useState} from 'react';
import {FileClock,RotateCcw,Save,Trash2} from 'lucide-react';
import {useAccount} from './Account.tsx';
import {decodeDraft,draftKey,encodeDraft,writeDraft} from './lib/drafts.ts';
import type {DraftModule} from './lib/drafts.ts';

export default function DraftControls<T>({module,value,onRestore,disabled=false}:{module:DraftModule;value:T;onRestore:(data:T)=>void;disabled?:boolean}){
  const {user,ready}=useAccount();
  const key=ready?draftKey(user?.id??'guest',module):null;
  const [slot,setSlot]=useState<{key:string;raw:string|null}|null>(null),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
  const [undo,setUndo]=useState<{key:string;raw:string|null;expected:string|null}|null>(null);
  const before=useRef<{key:string;value:T}|null>(null);
  const raw=slot?.key===key?slot.raw:null;
  const savedAt=useMemo(()=>{try{return raw?new Date(decodeDraft(module,raw).savedAt).toLocaleString('zh-CN'):'';}catch{return '';}},[module,raw]);
  function read(){
    if(!key)return;
    try{setSlot({key,raw:localStorage.getItem(key)});}catch{setFailed(true);setMessage('浏览器暂时无法访问草稿，请导出重要内容。');}
  }
  useEffect(()=>{setMessage('');setFailed(false);setUndo(null);before.current=null;read();const handler=(event:StorageEvent)=>{if(event.key===key)read();};window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);},[key]);
  useEffect(()=>{if(!message||failed)return;const timer=setTimeout(()=>setMessage(''),6000);return()=>clearTimeout(timer);},[message,failed]);
  function update(next:string|null,expected=raw){
    if(!key)return false;
    try{writeDraft(localStorage,key,expected,next);setSlot({key,raw:next});setFailed(false);return true;}
    catch(cause){read();setFailed(true);setMessage(cause instanceof Error?cause.message:'草稿保存失败，请导出重要内容。');return false;}
  }
  function save(){
    if(!key)return;
    try{const next=encodeDraft(module,value);if(update(next)){setUndo({key,raw,expected:next});setMessage('已保存到当前浏览器。');}}
    catch(cause){setFailed(true);setMessage(cause instanceof Error?cause.message:'草稿保存失败。');}
  }
  function restore(){
    if(!key||!raw)return;
    try{
      if(localStorage.getItem(key)!==raw){read();throw Error('草稿已被其他页面更新，请再次点击恢复。');}
      const saved=decodeDraft(module,raw);before.current={key,value:structuredClone(value)};onRestore(saved.data as T);setFailed(false);setMessage(module==='chat'?'已恢复历史文字，可继续提问重新核对。':module==='contract'?'已恢复文字与填写，图片和PDF需重新选择。请重新核对。':'已恢复填写，请检查后重新处理。');
    }catch(cause){setFailed(true);setMessage(cause instanceof Error?cause.message:'草稿未能恢复。');}
  }
  return <div className="draft-controls" data-module={module}>
    <div className="draft-caption"><FileClock size={15}/><span>本页草稿<small>{!ready?'正在确认保存空间…':savedAt?`保存于 ${savedAt}`:raw?'已有草稿，需重新核实':'只存在当前浏览器 · 点击后保存'}</small></span></div>
    <div className="draft-actions">
      <button disabled={disabled||!key||slot?.key!==key} aria-label="保存本页草稿" onClick={save}><Save size={13}/>保存</button>
      <button disabled={disabled||!raw} aria-label="恢复本页草稿" onClick={restore}><RotateCcw size={13}/>恢复</button>
      {raw&&<button aria-label="清除本页草稿" disabled={disabled||!key} onClick={()=>{if(key&&update(null)){setUndo({key,raw,expected:null});setMessage('已清除保存的草稿，本页填写还在。');}}}><Trash2 size={13}/>清除</button>}
    </div>
    {undo?.key===key&&<button className="draft-undo" disabled={disabled} onClick={()=>{if(update(undo.raw,undo.expected)){setUndo(null);setMessage('已撤销上次保存或清除。');}}}>撤销保存操作</button>}
    {before.current?.key===key&&<button className="draft-undo" disabled={disabled} onClick={()=>{if(before.current){onRestore(before.current.value);before.current=null;setMessage('已撤销恢复，回到刚才的填写。');}}}>撤销恢复</button>}
    {message&&<p className="draft-message" role={failed?'alert':'status'}>{message}</p>}
  </div>;
}
