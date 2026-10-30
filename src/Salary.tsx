import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowRight, CheckCircle2, CircleHelp, Download, FileText, Plus, Wallet } from 'lucide-react';
import { calculatePayslip } from './lib/wages.ts';
import type { SalarySignal } from './terminal-state.ts';
import { saveText, recordTime } from './lib/download.ts';

const EMPTY = { gross: '', insurance: '', fund: '', tax: '', other: '', received: '' };
type PayForm = typeof EMPTY;
type PayResult = ReturnType<typeof calculatePayslip>;
const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FIELDS: { key: keyof PayForm; label: string; hint: string; code: string }[] = [
  { key: 'gross', label: '应发工资', hint: '税前应发合计', code: 'GROSS' },
  { key: 'insurance', label: '个人社保扣款', hint: '仅填个人承担部分', code: 'INSURANCE' },
  { key: 'fund', label: '个人公积金扣款', hint: '仅填个人承担部分', code: 'HOUSING' },
  { key: 'tax', label: '已扣个人所得税', hint: '工资条上本次已扣金额', code: 'TAX' },
  { key: 'other', label: '其他扣款', hint: '确认没有请填 0', code: 'OTHER' },
  { key: 'received', label: '实际到账（可选）', hint: '不清楚可留空', code: 'RECEIVED' },
];
function SalaryControl({label,icon,code}:{label:string;icon:ReactNode;code:string}) {
  return <><span className="control-label">{label}</span><span className="control-action" aria-hidden="true"><small>{code}</small>{icon}</span></>;
}

/** A transparent data display, using confirmed amounts rather than decorative progress. */
function PayDisplay({ result, gross }: { result: PayResult | null; gross: number }) {
  const ratio = result && gross > 0 ? result.net / gross : null;
  const formatted = result ? money(result.net) : '— —';
  return <div className={`pay-display ${result ? 'has-data' : ''}`}>
    <div className="pay-display-meta"><span>CALCULATED NET PAY</span><span className="pay-result-state">{result?'计算已完成':'等待已知金额'}</span></div>
    <div className="pay-display-label">计算实发金额 <span>CNY</span></div>
    <div className="pay-display-amount"><small>¥</small><strong style={formatted.length > 13 ? { fontSize: `${360 / formatted.length}px` } : undefined}>{formatted}</strong></div>
    <div className="pay-display-caption">{ratio === null ? result ? '应发为 0，不计算占比' : '确认金额后，呈现清楚的计算结果' : `占应发工资 ${(ratio * 100).toFixed(1)}%`}</div>
    <div className="pay-allocation" aria-label={ratio === null ? '暂无工资占比数据' : `实发占${(ratio * 100).toFixed(1)}%，其余为个人扣款`}>
      <div className="allocation-scale" aria-hidden="true"><span>0</span><i /><span>100%</span></div>
      <div className={`allocation-track ${ratio === null ? 'empty' : ''}`}>{ratio !== null && <><span className="allocation-net" style={{ width: `${ratio * 100}%` }} /><span className="allocation-deductions" style={{ width: `${(1 - ratio) * 100}%` }} /></>}</div>
      <div className="allocation-legend"><span><i />计算实发</span><span><i />个人扣款</span><b>{ratio === null ? '等待数据' : '按已填金额拆算'}</b></div>
    </div>
  </div>;
}

export default function Salary({ addQuestions, onSignal }: { addQuestions: (questions: { text: string; category: string }[]) => void; onSignal:(signal:SalarySignal)=>void }) {
  const [form, setForm] = useState<PayForm>(EMPTY);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const resultPanel = useRef<HTMLElement>(null);
  const amountInputs=useRef<Partial<Record<keyof PayForm,HTMLInputElement|null>>>({});
  useEffect(()=>onSignal({gross:result?Number(form.gross):null,net:result?.net??null,deductions:result?.deductions??null}),[result,form.gross,onSignal]);
  useEffect(() => {
    if (result) resultPanel.current?.scrollIntoView({ block:'start', behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth' });
  }, [result]);
  function calculate(values: PayForm) {
    setError('');
    try {
      if (FIELDS.slice(0, 5).some(field => values[field.key] === '')) throw new Error('请填写前五项金额；确认没有的扣款填 0。');
      setResult(calculatePayslip({ gross: Number(values.gross), insurance: Number(values.insurance), fund: Number(values.fund), tax: Number(values.tax), other: Number(values.other), received: values.received === '' ? null : Number(values.received) }));
    } catch (e) { setResult(null); setError(e instanceof Error ? e.message : '请检查金额。');
      const missing=FIELDS.slice(0,5).find(field=>values[field.key]==='');
      if(missing){const field=amountInputs.current[missing.key];field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    }
  }
  function loadDemo() {
    const values = { gross: '8000', insurance: '800', fund: '600', tax: '66', other: '0', received: '6534' };
    setForm(values); setDemo(true); calculate(values);
  }
  function exportPay(){
    if(!result)return;
    saveText(['初程 · 工资明细核对记录',`生成时间：${recordTime()}`,demo?'材料：合成示例金额':'材料：本次填写的已知金额','',
      ...FIELDS.slice(0,5).map(field=>`${field.label}：¥ ${money(Number(form[field.key]))}`),
      `个人扣款合计：¥ ${money(result.deductions)}`,`计算实发：¥ ${money(result.net)}`,
      `实际到账：${form.received===''?'未填写':`¥ ${money(Number(form.received))}`}`,
      result.difference===null?'到账差额：待填写实际到账后核对':`到账与计算差额绝对值：¥ ${money(Math.abs(result.difference))}`,'',
      `计算过程：${money(Number(form.gross))} − ${money(Number(form.insurance))} − ${money(Number(form.fund))} − ${money(Number(form.tax))} − ${money(Number(form.other))} = ${money(result.net)}`,
      '本记录只核对填写金额的算术关系，不证明缴费基数、个人承担比例或已扣税额符合当地规定，不推算年度退税。',
      '可以向 HR 确认：本次各项扣款的计算基数、个人承担比例和实际计薪期间分别是什么？能否提供对应明细？'].join('\n'),'初程-工资明细核对记录.txt');
  }
  return <div className="salary-workbench">
    <header className="page-heading terminal-page-heading"><div className="page-heading-stamp" aria-hidden="true"><strong>03</strong><i/><small>MODULE</small></div><div className="page-heading-copy"><div className="eyebrow">PAYSLIP EXPLAINER</div><h1>工资明细核对</h1><p>按工资条填写已知金额，核对扣款和实际到账。</p></div><div className="page-heading-actions"><button className="button secondary" onClick={loadDemo}><SalaryControl label="载入示例金额" icon={<FileText size={16}/>} code="DEMO"/></button></div></header>
    <div className="machine-bridge business-bridge"><span><Wallet size={15}/>工资明细核对</span><span className="mono">INPUT <ArrowRight size={11}/> CALCULATE <ArrowRight size={11}/> EXPLAIN</span><span className="bridge-status"><i/>{result?'已按填写金额计算':'本地计算'}</span></div>
    <div className="task-action-strip"><div><strong>{result?'核对结果与到账，带走这份记录':'先填应发工资与个人扣款'}</strong><span>确认没有的扣款填 0，实际到账可以留空。</span></div>{result?<button className="button primary machine-submit" onClick={exportPay}><SalaryControl label="导出工资记录" icon={<Download size={18}/>} code="TXT"/></button>:<button className="button primary machine-submit" type="submit" form="salary-form"><SalaryControl label="核对并展开计算" icon={<ArrowRight size={18}/>} code="CALC"/></button>}{error&&<p className="task-action-message" role="alert">{error}</p>}</div>
    <div className="salary-machine">
      <section className="panel input-machine"><div className="panel-heading"><div><span className="module-number">01</span><h2>确认工资明细</h2></div><span className="mono">AMOUNT INPUT</span></div>
        <form id="salary-form" className="panel-body" onSubmit={e => { e.preventDefault(); calculate(form); }}>
          <div className="input-status"><span className="mono">CNY / 人民币</span>{demo ? <span className="tag green">合成示例</span> : <span>按工资条填写</span>}</div>
          <div className="form-grid">{FIELDS.map((field,i)=><label key={field.key} className={`field-label pay-field ${field.key==='gross'?'gross-field':''}`}><span className="pay-field-title"><span>{field.label}</span><i aria-hidden="true">{String(i+1).padStart(2,'0')}</i></span><div className="currency-input"><span>¥</span><input ref={node=>{amountInputs.current[field.key]=node;}} type="number" min="0" step="0.01" placeholder="0.00" value={form[field.key]} onChange={e=>{setForm({...form,[field.key]:e.target.value});setResult(null);setDemo(false);setError('');}} aria-label={field.label}/><b aria-hidden="true"/></div><small>{field.hint}</small><span className="pay-field-code" aria-hidden="true">{field.code}</span></label>)}</div>
          <p className="input-footnote">只填写个人承担的扣款，不含单位缴费。</p>
        </form>
      </section>
      <section className="panel output-machine" ref={resultPanel}><div className="panel-heading"><div><span className="module-number">02</span><h2>从应发，到实发</h2></div><span className={`output-status ${result ? 'ready' : ''}`}><i />{result ? '已计算' : '等待输入'}</span></div>
        <div className="instrument-glass" aria-live="polite"><PayDisplay result={result} gross={Number(form.gross)} /><div className="instrument-totals"><div><span>应发工资</span><strong>{result ? `¥ ${money(Number(form.gross))}` : '—'}</strong></div><div><span>扣款合计</span><strong>{result ? `¥ ${money(result.deductions)}` : '—'}</strong></div></div></div>
        <div className="deduction-deck">{result ? <><div className="deduction-heading"><span>扣款拆解</span><span className="mono">DEDUCTIONS</span></div><div className="salary-equation">{FIELDS.slice(1, 5).map(field => <div key={field.key}><span><ArrowDown size={12} />{field.label}</span><strong>− ¥ {money(Number(form[field.key]))}</strong></div>)}</div>{result.difference !== null && <div className={`difference ${Math.abs(result.difference) < .005 ? 'matched' : ''}`}><CheckCircle2 size={16} /><span>{Math.abs(result.difference) < .005 ? '填写的到账金额与计算一致' : `到账与计算相差 ¥${money(Math.abs(result.difference))}，请核对计薪期及其他扣项。`}</span></div>}<button className="button secondary wide-button" onClick={() => addQuestions([{ text: '请问本次工资中各项扣款的计算基数、个人承担比例，以及实际计薪期间分别是什么？能否提供对应明细？', category: '工资明细' }])}><SalaryControl label="把扣款问题加入询问清单" icon={<Plus size={15}/>} code="ADD"/></button></> : <div className="instrument-empty"><span className="empty-bracket" aria-hidden="true">[ ]</span><div><h3>填好金额，再点击上方核对</h3><p>也可载入合成示例，先看看怎么核对。</p></div></div>}</div>
        
      </section>
    </div>
    <div className="notice-band salary-boundary"><CircleHelp size={16} /><span>按已知金额核对，不自动推算地方缴费比例或年度退税。资料不足的项目仍需向 HR 确认。</span><span className="mono">RULE-BASED</span></div>
  </div>;
}
