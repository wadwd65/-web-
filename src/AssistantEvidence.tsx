import {memo,useMemo} from 'react';
import {calculatePayslip} from './lib/wages.ts';
import {analyzeContract} from './lib/contracts.ts';
import type {AssistantAction} from './services/assistant-types.ts';

const money=(value:number)=>value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
export function evidenceForCopy(actions:AssistantAction[]){
 return actions.flatMap(action=>{
  if(action.kind==='apply-salary'){const value=calculatePayslip(action.input);return [`计算实发：${money(value.net)}元；个人扣款：${money(value.deductions)}元。`];}
  if(action.kind==='apply-contract'){const values=analyzeContract(action.input);return [`合同文字对照${values.length}项，${values.filter(value=>value.status!=='noted').length}项待确认；仅限已提供的文字。`];}
  if(action.kind==='add-questions')return action.items.map((item,index)=>`${index+1}. ${item.text}`);
  return [];
 }).join('\n');
}
/** These highlights come from the actual rule inputs, not numbers extracted from model prose. */
export default memo(function AssistantEvidence({actions}:{actions:AssistantAction[]}){
 const summary=useMemo(()=>{
  const salary=actions.find(action=>action.kind==='apply-salary');
  if(salary?.kind==='apply-salary'){const result=calculatePayslip(salary.input);return {kind:'salary',label:'按你提供的金额计算',value:money(result.net),unit:'元',note:`应发 ${money(salary.input.gross)} − 个人扣款 ${money(result.deductions)}`};}
  const contract=actions.find(action=>action.kind==='apply-contract');
  if(contract?.kind==='apply-contract'){const findings=analyzeContract(contract.input),pending=findings.filter(item=>item.status!=='noted');return {kind:'contract',label:'合同文字核对',value:String(pending.length),unit:'项待确认',note:`对照 ${findings.length} 项 · 仅限已提供的文字与确认值`};}
  return null;
 },[actions]);
 const questions=actions.flatMap(action=>action.kind==='add-questions'?action.items:[]);
 return <>{summary&&<section className="assistant-evidence" aria-label={summary.kind==='salary'?'工资核对关键结果':'合同核对概览'}><small>{summary.label}</small><div><strong>{summary.value}</strong><span>{summary.unit}</span>{summary.kind==='salary'&&<em>计算实发</em>}</div><p>{summary.note}</p></section>}{!!questions.length&&<section className="assistant-question-preview" aria-label="将加入清单的问题"><small>准备问清楚的事</small><ol>{questions.map((item,index)=><li key={`${index}:${item.text}`}><span>{String(index+1).padStart(2,'0')}</span><p>{item.text}</p></li>)}</ol></section>}</>;
});
