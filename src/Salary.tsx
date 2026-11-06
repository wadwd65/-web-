import DraftControls from './DraftControls.tsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, CircleHelp, Download, FileText, Plus } from 'lucide-react';
import { calculatePayslip } from './lib/wages.ts';
import {salaryOutcome,salaryContext,salaryQuestionText} from './lib/salary-review.ts';
import {salaryQuestion} from './lib/checklist.ts';
import type {QuestionDraft} from './lib/checklist.ts';
import type { SalarySignal } from './terminal-state.ts';
import { saveText, recordTime } from './lib/download.ts';
import type {PayslipInput} from './lib/wages.ts';
import type {AssistantApply} from './services/assistant-types.ts';

const EMPTY = { gross: '', insurance: '', fund: '', tax: '', other: '', received: '' };
type PayForm = typeof EMPTY;
type PayResult = ReturnType<typeof calculatePayslip>;
const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FIELDS: { key: keyof PayForm; label: string; hint: string }[] = [
  { key: 'gross', label: '应发工资', hint: '工资条上扣款前的合计' },
  { key: 'insurance', label: '个人社保扣款', hint: '只填自己缴的部分' },
  { key: 'fund', label: '个人公积金扣款', hint: '只填自己缴的部分' },
  { key: 'tax', label: '已扣个人所得税', hint: '工资条上本次扣掉的税' },
  { key: 'other', label: '其他扣款', hint: '例如其他已确认的扣款' },
  { key: 'received', label: '实际到账（可选）', hint: '银行收到的钱，不清楚可不填' },
];
function SalaryControl({label,icon,code}:{label:string;icon:ReactNode;code:string}) {
  return <><span className="control-label">{label}</span><span className="control-action" aria-hidden="true"><small>{code}</small>{icon}</span></>;
}

/** A verdict first, followed by the amounts that produced it. */
function PayDisplay({input}:{input:PayslipInput|null}) {
  if(!input)return <div className="pay-display"><div className="pay-display-amount"><strong>— —</strong></div></div>;
  const {status,result,headline,next}=salaryOutcome(input);
  const ratio=input.gross>0?result.net/input.gross:null;
  return <div className="pay-display salary-verdict" data-status={status} aria-label="本次工资核对结论">
    <div className="pay-display-meta"><span>按本次填写核对</span><span>{status==='unchecked'?'待核对到账':status==='matched'?'金额一致':'有差额待确认'}</span></div>
    <h2>{headline}</h2><p className="salary-verdict-next">{next}</p>
    <div className="salary-comparison"><div><span>计算实发</span><div className="pay-display-amount"><small>¥</small><strong>{money(result.net)}</strong></div></div><div><span>你填的实际到账</span><strong>{input.received===null?'尚未填写':`¥ ${money(input.received)}`}</strong></div><div><span>到账与计算的差额</span><strong>{result.difference===null?'待核对':result.difference===0?'¥ 0.00':`${result.difference<0?'少':'多'} ¥ ${money(Math.abs(result.difference))}`}</strong></div></div>
    <div className="salary-equation-line"><span>应发 ¥{money(input.gross)}</span><span>− 个人扣款 ¥{money(result.deductions)}</span><span>= 实发 ¥{money(result.net)}</span></div>
    {ratio!==null&&<div className="salary-allocation" aria-label={`实发占应发${(ratio*100).toFixed(1)}%`}><i><b style={{width:`${ratio*100}%`}}/></i><span>实发 {(ratio*100).toFixed(1)}% · 其余为个人扣款</span></div>}
  </div>;
}

export default function Salary({ addQuestions, onSignal,applyRequest }: { addQuestions: (questions: QuestionDraft[]) => void; onSignal:(signal:SalarySignal)=>void;applyRequest:AssistantApply<PayslipInput>|null }) {
  const [form, setForm] = useState<PayForm>(EMPTY);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const resultPanel = useRef<HTMLElement>(null);
  const review=useRef({id:'',at:''});
  const confirmedInput:PayslipInput|null=result?{gross:Number(form.gross),insurance:Number(form.insurance),fund:Number(form.fund),tax:Number(form.tax),other:Number(form.other),received:form.received===''?null:Number(form.received)}:null;
  const amountInputs=useRef<Partial<Record<keyof PayForm,HTMLInputElement|null>>>({});
  useEffect(()=>{if(!applyRequest)return;const values=Object.fromEntries(Object.entries(applyRequest.input).map(([key,value])=>[key,value===null?'':String(value)])) as PayForm;setForm(values);setDemo(false);calculate(values);},[applyRequest]);
  useLayoutEffect(()=>onSignal({gross:result?Number(form.gross):null,net:result?.net??null,deductions:result?.deductions??null}),[result,form.gross,onSignal]);
  useEffect(() => {
    if (result) resultPanel.current?.scrollIntoView({ block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth' });
  }, [result]);
  function calculate(values: PayForm) {
    setError('');
    try {
      const missing = FIELDS.slice(0, 5).find(field => values[field.key] === '');
      if (missing) throw new Error(`还没填「${missing.label}」。${missing.key === 'gross' ? '请按工资条填写扣款前的合计。' : '有这项就填金额，确认没有可点「填 0」。'}`);
      review.current={id:crypto.randomUUID(),at:new Date().toISOString()};
      setResult(calculatePayslip({ gross: Number(values.gross), insurance: Number(values.insurance), fund: Number(values.fund), tax: Number(values.tax), other: Number(values.other), received: values.received === '' ? null : Number(values.received) }));
    } catch (e) { setResult(null); setError(e instanceof Error ? e.message : '请检查金额。');
      const missing=FIELDS.slice(0,5).find(field=>values[field.key]==='');
      if(missing){const field=amountInputs.current[missing.key];field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    }
  }
  function loadDemo() {
    const values = { gross: '8000', insurance: '800', fund: '600', tax: '66', other: '0', received: '6534' };
    setForm(values); setDemo(true); setResult(null); setError('');
  }
  function updateAmount(key: keyof PayForm, value: string) {
    setForm(previous => ({...previous, [key]: value}));
    setResult(null); setDemo(false); setError('');
  }
  function exportPay(){
    if(!result)return;
    saveText(['初程 · 工资明细核对记录',`生成时间：${recordTime()}`,demo?'材料：合成示例金额':'材料：本次填写的已知金额','',
      ...FIELDS.slice(0,5).map(field=>`${field.label}：¥ ${money(Number(form[field.key]))}`),
      `个人扣款合计：¥ ${money(result.deductions)}`,`计算实发：¥ ${money(result.net)}`,
      `实际到账：${form.received===''?'未填写':`¥ ${money(Number(form.received))}`}`,
      confirmedInput?salaryContext(confirmedInput):'', '',
      `计算过程：${money(Number(form.gross))} − ${money(Number(form.insurance))} − ${money(Number(form.fund))} − ${money(Number(form.tax))} − ${money(Number(form.other))} = ${money(result.net)}`,
      '本记录只核对填写金额的算术关系，不证明缴费基数、个人承担比例或已扣税额符合当地规定，不推算年度退税。',
      confirmedInput?`可以向 HR 确认：${salaryQuestionText(confirmedInput)}`:''].join('\n'),'初程-工资明细核对记录.txt');
  }
  return <div className="salary-workbench">
    <header className="page-heading terminal-page-heading"><div className="page-heading-stamp" aria-hidden="true"><strong>03</strong><i/><small>MODULE</small></div><div className="page-heading-copy"><div className="eyebrow">PAYSLIP EXPLAINER</div><h1>算清到手工资</h1><p>按工资条填写已知金额，核对扣款和实际到账。</p></div><div className="page-heading-actions"><button className="button secondary" onClick={loadDemo}><SalaryControl label="用示例填一遍" icon={<FileText size={16}/>} code="DEMO"/></button></div></header>
    <DraftControls module="salary" value={{form,demo}} onRestore={saved=>{setForm(saved.form);setDemo(saved.demo);setResult(null);setError('');}}/>
    <div className="task-action-strip"><div><strong>{result?'算好了，可修改金额重算，也可下载结果':'按工资条填金额，填完点蓝色按钮'}</strong><span>不清楚的先留空，确认没有的扣款再填 0。</span></div><button className="button primary machine-submit salary-calculate-top" type="submit" form="salary-form"><SalaryControl label="算到手工资" icon={<ArrowRight size={18}/>} code="CALC"/></button>{result&&<button className="button primary machine-submit salary-export" onClick={exportPay}><SalaryControl label="下载工资计算结果" icon={<Download size={18}/>} code="TXT"/></button>}{error&&<p className="task-action-message" role="alert">{error}</p>}</div>
    <div className="salary-machine">
      <section className="panel input-machine" aria-label="工资条金额">
        <form id="salary-form" className="panel-body" onSubmit={e => { e.preventDefault(); calculate(form); }}>
          <div className="input-status" hidden={!demo}><span className="tag green">合成示例</span><span>换成自己的金额后，再核对实际工资。</span></div>
          <div className="form-grid">{FIELDS.map((field,i)=><div key={field.key} className={`field-label pay-field ${field.key==='gross'?'gross-field':''}`}>
            <label htmlFor={`salary-${field.key}`}>
              <span className="pay-field-title"><span>{field.label}</span><i aria-hidden="true">{String(i+1).padStart(2,'0')}</i></span>
              <div className="currency-input"><span>¥</span><input id={`salary-${field.key}`} ref={node=>{amountInputs.current[field.key]=node;}} type="number" min="0" step="0.01" placeholder={field.key==='received'?'可不填':'请输入金额'} value={form[field.key]} onChange={e=>updateAmount(field.key,e.target.value)} aria-label={field.label}/><b aria-hidden="true"/></div>
            </label>
            <div className="pay-field-help"><small>{field.hint}</small>{i>0&&i<5&&form[field.key]===''&&<button type="button" aria-label={`${field.label}确认没有，填0`} onClick={()=>{updateAmount(field.key,'0');amountInputs.current[field.key]?.focus();}}>没有？填 0</button>}</div>
          </div>)}</div>
          <p className="input-footnote">社保和公积金只填自己缴的部分。填完后，点下面的按钮看结果。</p>
          <button type="submit" className="button primary salary-calculate"><SalaryControl label="算到手工资" icon={<ArrowRight size={18}/>} code="CALC"/></button>
        </form>
      </section>
      <section className="panel output-machine" ref={resultPanel}>
        <div className="instrument-glass" aria-live="polite"><PayDisplay input={confirmedInput}/></div>
        {confirmedInput&&<button className="button secondary wide-button salary-save-question" onClick={()=>addQuestions([salaryQuestion(confirmedInput,{...review.current,demo})])}><SalaryControl label={result?.difference?'把这笔差额记到询问清单':'把扣款问题加入询问清单'} icon={<Plus size={15}/>} code="ADD"/></button>}
        <div className="deduction-deck">{result ? <><div className="deduction-heading"><span>每项扣了多少</span><span className="mono">DEDUCTIONS</span></div><div className="salary-equation">{FIELDS.slice(1,5).map(field=><div key={field.key}><span><ArrowDown size={12}/>{field.label}</span><strong>− ¥ {money(Number(form[field.key]))}</strong></div>)}</div></> : <div className="instrument-empty"><span className="empty-bracket" aria-hidden="true">[ ]</span><div><h3>先填金额，再点「算到手工资」</h3><p>可以先点「用示例填一遍」，看看这些数字怎么填。</p></div></div>}</div>
      </section>
    </div>
    <div className="notice-band salary-boundary"><CircleHelp size={16} /><span>按已知金额核对，不自动推算地方缴费比例或年度退税。资料不足的项目仍需向 HR 确认。</span><span className="mono">RULE-BASED</span></div>
  </div>;
}
