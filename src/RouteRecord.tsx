import {useEffect,useReducer,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Download,X} from 'lucide-react';
import {hasRouteRecords,newRouteRecord,routeRecordReducer,sameRouteForm} from './lib/route-record.ts';
import type {RouteDraft} from './lib/route-record.ts';

export function useRouteRecord<F>(initial:F){
  const [state,dispatch]=useReducer(routeRecordReducer<F>,initial,newRouteRecord<F>);
  return {state,dispatch,dirty:state.recordForm!==null&&!sameRouteForm(state.recordForm,state.form),
    draft:{form:state.form,generated:state.recordForm!==null,recordForm:state.recordForm,done:state.done,notes:state.notes} satisfies RouteDraft<F>};
}

export function RouteRecordGuard({dirty,confirming,hasRecords,onExport,onUndo,onCancel,onReplace}:{dirty:boolean;confirming:boolean;hasRecords:boolean;onExport:()=>void;onUndo:()=>void;onCancel:()=>void;onReplace:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!confirming)return;const el=dialog.current!,previous=document.activeElement as HTMLElement|null;el.showModal();cancel.current?.focus();return()=>{el.close();previous?.focus({preventScroll:true});};},[confirming]);
  return <>{dirty&&<div className="route-record-preserved" role="status"><span>情况已修改，上一份清单{hasRecords?'和办理记录':''}仍保留。生成新清单前，可以先下载。</span><button className="button tiny" onClick={onExport}>下载上一份<Download size={14}/></button><button className="button tiny" onClick={onUndo}>撤销情况修改</button></div>}
    {confirming&&createPortal(<dialog ref={dialog} className="route-replace-dialog" aria-labelledby="route-replace-title" onCancel={event=>{event.preventDefault();onCancel();}} onClick={event=>{if(event.target===event.currentTarget)onCancel();}}>
      <button className="route-dialog-close" aria-label="关闭新建清单确认" onClick={onCancel}><X size={19}/></button><span className="eyebrow">KEEP YOUR RECORDS</span><h2 id="route-replace-title">要为新情况另建清单吗？</h2><p>上一份清单已有勾选或备注。新建会清空这些办理记录，请先下载留存；取消后，它们仍会保留。</p><div className="route-replace-actions"><button className="button secondary" onClick={onExport}>下载上一份记录<Download size={16}/></button><button ref={cancel} className="button secondary" onClick={onCancel}>取消，继续修改</button><button className="button primary" onClick={onReplace}>确认新建，清空旧记录</button></div>
    </dialog>,document.body)}</>;
}

export {hasRouteRecords};
