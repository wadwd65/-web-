import {calculatePayslip} from './wages.ts';
import type {PayslipInput} from './wages.ts';
import {salaryContext,salaryQuestionText} from './salary-review.ts';
import {CONTRACT_EXCERPTS,CONTRACT_KNOWLEDGE,searchContractKnowledge,contractSourcesForCopy} from './contract-knowledge.ts';
import type {ContractRetrieval} from './contract-knowledge.ts';
import type {Finding} from './contracts.ts';

export type ContractQuestionEvidence = {
  kind:'contract'; reviewId:string; findingId:string; title:string; material:string;
  originalQuestion:string; quote:string; offset:number|null; reviewedAt:string;
  contractMonths:number|null; probationMonths:number|null;
  corpusId:string; checkedOn:string; excerptIds:string[];
};
export type SalaryQuestionEvidence = {kind:'salary';reviewId:string;findingId:'payslip';title:string;material:string;originalQuestion:string;reviewedAt:string;input:PayslipInput};
export type QuestionEvidence=ContractQuestionEvidence|SalaryQuestionEvidence;
export type QuestionDraft = {text:string;category:string;evidence?:QuestionEvidence};
export type Question = QuestionDraft & {id:string;done:boolean;answer?:string};

function shortText(value:unknown,max:number):value is string {
  return typeof value==='string'&&value.length<=max;
}

/** Validate persisted records without accepting arbitrary source URLs or markup. */
export function isQuestionEvidence(value:unknown):value is QuestionEvidence {
  if(!value||typeof value!=='object')return false;
  const e=value as QuestionEvidence;
  if(e.kind==='salary'){
    if(!shortText(e.reviewId,100)||!e.reviewId||e.findingId!=='payslip'||!shortText(e.title,200)||!shortText(e.material,200)||!shortText(e.originalQuestion,1500)||!shortText(e.reviewedAt,30)||!Number.isFinite(Date.parse(e.reviewedAt))||!e.input)return false;
    try{calculatePayslip(e.input);return true;}catch{return false;}
  }
  const months=(v:unknown)=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1200;
  return e.kind==='contract'&&shortText(e.reviewId,100)&&Boolean(e.reviewId)&&shortText(e.findingId,80)&&
    shortText(e.title,200)&&shortText(e.material,200)&&shortText(e.originalQuestion,1500)&&shortText(e.quote,600)&&
    (e.offset===null||Number.isSafeInteger(e.offset)&&e.offset>=0&&e.offset<60000)&&
    (e.quote.length>0?e.offset!==null:e.offset===null)&&
    shortText(e.reviewedAt,30)&&Number.isFinite(Date.parse(e.reviewedAt))&&months(e.contractMonths)&&months(e.probationMonths)&&
    shortText(e.corpusId,100)&&/^\d{4}-\d{2}-\d{2}$/.test(e.checkedOn)&&
    Array.isArray(e.excerptIds)&&e.excerptIds.length<=3&&new Set(e.excerptIds).size===e.excerptIds.length&&
    e.excerptIds.every(id=>CONTRACT_EXCERPTS.some(item=>item.id===id));
}

export function isQuestion(value:unknown):value is Question {
  if(!value||typeof value!=='object')return false;
  const q=value as Question;
  return shortText(q.id,100)&&shortText(q.text,1500)&&shortText(q.category,50)&&typeof q.done==='boolean'&&
    (q.answer===undefined||shortText(q.answer,1500))&&(q.evidence===undefined||isQuestionEvidence(q.evidence));
}

/** A quotation is always an exact substring of the reviewed material, capped for explicit saving. */
export function contractQuestion(finding:Finding,review:{id:string;text:string;material:string;at:string;contractMonths:number|null;probationMonths:number|null}):QuestionDraft {
  const offset=finding.quote?review.text.indexOf(finding.quote):-1;
  const sources=searchContractKnowledge(`${finding.category} ${finding.article} ${finding.quote}`,{fullTimeConfirmed:true});
  return {text:finding.question,category:finding.category,evidence:{
    kind:'contract',reviewId:review.id,findingId:finding.id,title:finding.title,
    material:review.material.slice(0,200),originalQuestion:finding.question,
    quote:offset<0?'':finding.quote.slice(0,600),offset:offset<0?null:offset,reviewedAt:review.at,
    contractMonths:review.contractMonths,probationMonths:review.probationMonths,
    corpusId:CONTRACT_KNOWLEDGE.id,checkedOn:CONTRACT_KNOWLEDGE.checkedOn,excerptIds:sources.excerpts.map(item=>item.id),
  }};
}

export function evidenceSources(evidence:ContractQuestionEvidence):ContractRetrieval {
  const available=evidence.corpusId===CONTRACT_KNOWLEDGE.id&&evidence.checkedOn===CONTRACT_KNOWLEDGE.checkedOn;
  const excerpts=available?CONTRACT_EXCERPTS.filter(item=>evidence.excerptIds.includes(item.id)).map(item=>({...item,matchedTerms:['核对时关联的条文']})):[];
  return {corpusId:CONTRACT_KNOWLEDGE.id,status:excerpts.length?'matched':'no-match',query:'',excerpts,
    message:!available?'保存依据的版本已变化，请重新核实。':excerpts.length?'以下为本次核对时关联的官方摘录。':'这项没有保存可用摘录，请对照官方全文核实。'};
}

export function sameQuestion(a:QuestionDraft,b:QuestionDraft):boolean {
  if(a.evidence||b.evidence)return Boolean(a.evidence&&b.evidence&&a.evidence.kind===b.evidence.kind&&a.evidence.reviewId===b.evidence.reviewId&&a.evidence.findingId===b.evidence.findingId);
  return a.text.trim()===b.text.trim();
}

export function salaryQuestion(input:PayslipInput,review:{id:string;at:string;demo:boolean}):QuestionDraft {
  const text=salaryQuestionText(input);
  return {text,category:'工资明细',evidence:{kind:'salary',reviewId:review.id,findingId:'payslip',title:'本次工资金额核对',material:review.demo?'合成示例金额':'本次填写的已知金额',originalQuestion:text,reviewedAt:review.at,input:{...input}}};
}

export function questionExport(questions:Question[]):string {
  return ['初程 · 我的询问清单','请结合自己的材料与实际情况沟通。',...questions.map((q,i)=>[
    `${q.done?'[已确认]':'[待确认]'} [${q.category}] ${i+1}. ${q.text}`,
    q.answer&&`确认记录（自行填写）：${q.answer}`,
    q.evidence&&[
      `关联核对项：${q.evidence.title}`,`材料：${q.evidence.material}；核对时间：${q.evidence.reviewedAt}`,
      q.evidence.kind==='salary'?salaryContext(q.evidence.input):[
        `固定期限：${q.evidence.contractMonths??'未确认'}个月；试用期：${q.evidence.probationMonths??'未确认'}个月`,
        q.evidence.quote?`保存的原文片段（第${q.evidence.offset!+1}字符起）：${q.evidence.quote}`:'本次材料未定位到原文，请补完整材料确认。',
        contractSourcesForCopy(evidenceSources(q.evidence)),
      ].join('\n'),
      q.text!==q.evidence.originalQuestion?`问题已改写。原核对建议：${q.evidence.originalQuestion}`:'',
    ].filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n'))].join('\n\n');
}
