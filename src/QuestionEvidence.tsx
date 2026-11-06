import {salaryContext} from './lib/salary-review.ts';
import {ChevronDown,FileText} from 'lucide-react';
import ContractSources from './ContractSources.tsx';
import {evidenceSources} from './lib/checklist.ts';
import type {Question} from './lib/checklist.ts';

export default function QuestionEvidence({question}:{question:Question}) {
  const evidence=question.evidence;
  if(!evidence)return null;
  if(evidence.kind==='salary')return <details className="question-evidence salary-question-evidence"><summary><FileText size={14}/><span>查看当时的工资核对金额</span><ChevronDown size={14}/></summary><div><strong>{evidence.title}</strong><p>{evidence.material} · {new Date(evidence.reviewedAt).toLocaleString('zh-CN')}</p><blockquote>{salaryContext(evidence.input)}</blockquote><p>这是加入清单时的金额快照，后续重新计算不会改变此记录。只核对算术，不证明扣款合规。</p>{question.text!==evidence.originalQuestion&&<p className="question-reworded">你已改写问题。原建议为“{evidence.originalQuestion}”</p>}</div></details>;
  return <details className="question-evidence">
    <summary><FileText size={14}/><span>查看这条问题的原文与依据</span><ChevronDown size={14}/></summary>
    <div>
      <strong>{evidence.title}</strong>
      <p>{evidence.material} · {new Date(evidence.reviewedAt).toLocaleString('zh-CN')}</p>
      {evidence.quote?<><small>原材料第 {evidence.offset!+1} 字符起 · 最多保留600字</small><blockquote>{evidence.quote}</blockquote></>:<p>本次材料未定位到原文，请补完整材料确认。</p>}
      <p>核对时确认的固定期限 {evidence.contractMonths??'未确认'} 个月，试用期 {evidence.probationMonths??'未确认'} 个月。</p>
      {question.text!==evidence.originalQuestion&&<p className="question-reworded">你已改写问题，关联依据仍来自原核对项。原建议为“{evidence.originalQuestion}”</p>}
      <ContractSources result={evidenceSources(evidence)}/>
    </div>
  </details>;
}
