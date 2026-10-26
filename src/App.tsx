import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck,
  Copy, Download, ExternalLink, FileCheck2, FileText, FolderOpen,
  LayoutDashboard, ListChecks, MapPin, Plus, RotateCcw, ScanLine,
  Search, ShieldCheck, Sparkles, Trash2, Upload, Wallet, X,
} from 'lucide-react';
import { analyzeContract, DEMO_CONTRACT } from './lib/contracts.ts';
import type { Finding } from './lib/contracts.ts';
import { calculatePayslip } from './lib/wages.ts';
import { evaluateSubsidy } from './lib/policies.ts';
import type { PolicyInput, PolicyResult } from './lib/policies.ts';
import BioCore from './BioCore.tsx';

type Page = 'home' | 'contract' | 'salary' | 'subsidy' | 'list';
type Question = { id: string; text: string; done: boolean; category: string };
const STORE = 'first-step:questions:v1';
const LAW = 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html';
const SUBSIDY = 'https://rsj.gz.gov.cn/zmhd/cjwt/ldbz/content/post_10677608.html';
const CHECKED = '2026.10.26';
const NAV = [
  { id: 'home', label: '工作台', english: 'OVERVIEW', icon: LayoutDashboard },
  { id: 'contract', label: '劳动合同核对', english: 'CONTRACT', icon: FileCheck2 },
  { id: 'salary', label: '工资条拆解', english: 'PAYSLIP', icon: Wallet },
  { id: 'subsidy', label: '补贴导航', english: 'SUPPORT', icon: Search },
  { id: 'list', label: '我的询问清单', english: 'CHECKLIST', icon: ListChecks },
] as const;
const money = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function currentPage(): Page {
  const route = window.location.hash.replace(/^#\/?/, '');
  return NAV.some(item => item.id === route) ? route as Page : 'home';
}
function initialQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw || raw.length > 64000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Question => !!item && typeof item.id === 'string' && typeof item.text === 'string' && item.text.length <= 1500 && typeof item.done === 'boolean' && typeof item.category === 'string').slice(0, 50);
  } catch { return []; }
}
function saveText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Wordmark({ small = false }: { small?: boolean }) {
  return <div className={`wordmark ${small ? 'small' : ''}`}>
    <svg width="37" height="37" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 33V7h17l11 12-11 14H6Zm10-18v18m0-18h15M6 22h10" fill="none" stroke="currentColor" strokeWidth="2.6" /></svg>
    <div><strong>初程<span> / </span></strong><small>FIRST STEP</small></div>
  </div>;
}
function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'orange' }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function PageHeading({ number, english, title, description, right }: { number: string; english: string; title: string; description: string; right?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span>{number}</span> / {english}</div><h1>{title}</h1><p>{description}</p></div>{right}</div>;
}
function Atlas() {
  return <div className="atlas" aria-hidden="true">
    <div className="atlas-caption"><span>FIRST STEP / FIELD GUIDE</span><span>01 — 03</span></div>
    <svg viewBox="0 0 480 330" fill="none">
      <defs><pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="currentColor" strokeWidth=".45" opacity=".12" /></pattern></defs>
      <rect x="0" y="0" width="480" height="330" fill="url(#blueprint-grid)" />
      <circle cx="249" cy="170" r="125" stroke="currentColor" opacity=".12" />
      <circle cx="249" cy="170" r="99" stroke="currentColor" opacity=".13" strokeDasharray="3 6" />
      <path d="M64 236H130L166 200M336 94H387L412 69M324 245H391" stroke="currentColor" opacity=".4" />
      <path d="M249 20V42M249 297V317M95 170H117M382 170H404" stroke="currentColor" opacity=".4" />
      <g className="atlas-paper"><path d="M173 67H284L325 108V271H173V67Z" fill="#f8faf5" stroke="#729075" strokeWidth="1.3" /><path d="M284 67V108H325" stroke="#729075" strokeWidth="1.3" />
        <rect x="193" y="91" width="33" height="4" fill="#3e5f4c" /><text x="193" y="132" fill="#263c31" fontSize="15" fontFamily="sans-serif">劳动合同</text>
        <text x="193" y="149" fill="#80917f" fontSize="7" fontFamily="monospace" letterSpacing="1.2">EMPLOYMENT AGREEMENT</text>
        <path d="M193 171H303M193 184H287M193 197H303M193 210H266" stroke="#bbc7b5" strokeWidth="3" />
        <rect x="190" y="178" width="116" height="14" fill="#b8db83" fillOpacity=".36" />
        <path d="M193 236H239" stroke="#bbc7b5" /><path d="m266 239 7 7 17-20" stroke="#50724e" strokeWidth="2.3" />
      </g>
      <rect x="111" y="83" width="49" height="49" fill="#d9e9c7" stroke="#839a70" /><path d="m125 107 7 7 14-17" stroke="#4d6b40" strokeWidth="2" />
      <rect x="331" y="192" width="77" height="47" fill="#2f493b" /><text x="343" y="211" fill="#d4e8b9" fontFamily="monospace" fontSize="8" letterSpacing="1">NEXT STEP</text><path d="M343 224H388m-6-6 6 6-6 6" stroke="#d4e8b9" />
      <circle cx="121" cy="250" r="17" fill="#f8faf5" stroke="#a6b996" /><text x="115" y="254" fill="#586c50" fontFamily="monospace" fontSize="10">01</text>
      <text x="31" y="264" fill="#8a9883" fontFamily="monospace" fontSize="8">START HERE</text>
      <text x="360" y="62" fill="#8a9883" fontFamily="monospace" fontSize="8">CLEAR / CONFIRM</text>
    </svg>
    <div className="atlas-bottom"><span className="crosshair">+</span><span>从一份合同，走向清楚的下一步。</span><span className="crosshair">+</span></div>
  </div>;
}
function Home({ go, demo, count }: { go: (page: Page) => void; demo: () => void; count: number }) {
  return <>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow"><span className="status-dot" /> FOR YOUR FIRST CHAPTER</div>
        <div className="hero-index">入职第一站 <span>/ 01</span></div>
        <h1>第一份工作，<br />从<span>看懂</span>开始。</h1>
        <p>拿不准的合同条款、看不懂的工资扣款、<br className="desktop-break" />可能错过的补贴。陪你一件一件弄明白。</p>
        <div className="hero-actions"><button className="button primary" onClick={() => go('contract')}>核对一份劳动合同 <ArrowUpRight size={17} /></button><button className="button text-button" onClick={demo}>先用示例体验 <ArrowRight size={16} /></button></div>
        <div className="hero-footnote"><ShieldCheck size={14} /><span>无需注册 · 输入可更正 · 结果有依据</span></div>
      </div><BioCore />
    </section>
    <section className="tasks-section">
      <div className="section-heading"><div><span className="eyebrow">YOUR NEXT MOVE</span><h2>从你眼前的事开始</h2></div><span className="section-note">三个入口，各解决一件具体的事。</span></div>
      <div className="task-grid">
        <button className="task-card featured" onClick={() => go('contract')}><div className="card-top"><FileCheck2 size={25} strokeWidth={1.5} /><span className="mono">01 / CONTRACT</span></div><div className="task-title"><h3>准备签合同</h3><ArrowUpRight size={24} /></div><p>逐项看清关键约定，把需要问 HR 的问题整理出来。</p><div className="card-bottom"><span>条款核对</span><span>询问清单</span><span className="card-label">从这里开始</span></div></button>
        <button className="task-card" onClick={() => go('salary')}><div className="card-top"><Wallet size={25} strokeWidth={1.5} /><span className="mono">02 / PAYSLIP</span></div><div className="task-title"><h3>看懂第一份工资</h3><ArrowUpRight size={24} /></div><p>从应发到实发，拆开看看每一笔扣款和计算。</p><div className="card-bottom"><span>金额拆解</span><span>差额核对</span></div></button>
        <button className="task-card" onClick={() => go('subsidy')}><div className="card-top"><Search size={25} strokeWidth={1.5} /><span className="mono">03 / SUPPORT</span></div><div className="task-title"><h3>查查补贴条件</h3><ArrowUpRight size={24} /></div><p>对照自己的情况，看需要哪些材料、去哪里办。</p><div className="card-bottom"><span>条件初筛</span><span>官方入口</span></div></button>
      </div>
    </section>
    <section className="guide-strip"><div className="guide-icon"><ListChecks size={21} /></div><div><h3>把没弄清楚的问题，先记下来。</h3><p>核对时可以加入询问清单，整理好再去问 HR 或办理部门。</p></div><button className="button secondary" onClick={() => go('list')}>查看我的清单 {count > 0 && <span className="button-count">{count}</span>}<ArrowRight size={16} /></button></section>
    <div className="bottom-notes"><span><span className="status-dot muted" /> 信息解释与办理准备，最终以适用规定和实际审核为准。</span><span className="mono">RHINE LAB / FIRST STEP</span></div>
  </>;
}

function Contract({ demoSeed, addQuestions, notify }: { demoSeed: number; addQuestions: (questions: { text: string; category: string }[]) => void; notify: (text: string) => void }) {
  const [text, setText] = useState('');
  const [months, setMonths] = useState('');
  const [probation, setProbation] = useState('');
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [active, setActive] = useState('');
  const [filename, setFilename] = useState('');
  const [sample, setSample] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<{ url: string; image: boolean } | null>(null);
  const [scope, setScope] = useState('unknown');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  function loadDemo() { setText(DEMO_CONTRACT); setMonths('12'); setProbation('3'); setFindings(null); setError(''); setFilename('合成示例 · 劳动合同.txt'); setSample(true); setPreview(null); setScope('fulltime'); }
  useLayoutEffect(() => { if (demoSeed > 0) loadDemo(); }, [demoSeed]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  function editText(value: string) { setText(value); setFindings(null); setSample(false); setError(''); setMonths(''); setProbation(''); setScope('unknown'); setFilename('手动输入的合同文字'); }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    event.target.value = '';
    if (file.size > 8 * 1024 * 1024) { setError('文件超过 8 MB，请先选择较小的文件或粘贴合同文字。'); return; }
    setReading(true); setError(''); setFindings(null); setSample(false); setMonths(''); setProbation(''); setScope('unknown');
    try {
      if (/\.(txt|md)$/i.test(file.name)) { const content = await file.text(); if (!content.trim()) throw new Error('文件里没有可读取的文字。'); if (content.length > 60000) throw new Error('文字较多，请先选取本次要核对的合同内容（最多 60,000 字符）。'); setText(content); setFilename(file.name); setPreview(null); notify('已读取文件，请核对文字并确认合同期限。'); }
      else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || file.type.startsWith('image/')) { setPreview({ url: URL.createObjectURL(file), image: file.type.startsWith('image/') }); setFilename(file.name); setText(''); notify('已打开预览。此版请在下方粘贴对应文字，再进行规则核对。'); }
      else throw new Error('当前支持 TXT、Markdown、PDF 和图片。');
    } catch (e) { setError(e instanceof Error ? e.message : '读取失败，请重新选择文件或粘贴文字。'); }
    finally { setReading(false); }
  }
  function run() {
    if (!text.trim()) { setError('请先粘贴合同文字，或使用合成示例。'); return; }
    if (scope !== 'fulltime') { setError('请先确认用工类型。实习、劳务和非全日制协议需要其他适用规则，此版不自动套用。'); return; }
    if (text.length > 60000) { setError('本次最多核对 60,000 字符，请缩短内容后重试。'); return; }
    try { const result = analyzeContract({ text, contractMonths: months === '' ? null : Number(months), probationMonths: probation === '' ? null : Number(probation) }); setFindings(result); setActive(result[0]?.id ?? ''); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法核对，请检查确认值。'); }
  }
  function locate(quote: string) { const index = quote.trim() ? text.indexOf(quote) : -1; if (index < 0 || !textRef.current) { notify('这项未能在已提供文本中定位，请核对材料是否完整。'); return; } textRef.current.focus(); textRef.current.setSelectionRange(index, index + quote.length); textRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  const unresolved = findings?.filter(f => f.status !== 'noted') ?? [];
  return <>
    <PageHeading number="01" english="CONTRACT REVIEW" title="先把合同看明白" description="对照原文，确认关键约定，再把需要问的问题带走。" right={<button className="button secondary" onClick={loadDemo}><FileText size={15} />载入合成示例</button>} />
    <div className="process-line"><span className="current"><b>01</b>准备材料</span><ChevronRight size={14} /><span className={findings ? 'current' : ''}><b>02</b>核对约定</span><ChevronRight size={14} /><span><b>03</b>整理询问</span><Tag>本地文字规则体验</Tag></div>
    <div className="contract-grid">
      <section className="panel document-panel"><div className="panel-heading"><div><FileText size={17} /><h2>合同原文</h2></div><span className="mono">SOURCE / 01</span></div>
        <div className="document-inner">
          <button className="upload-zone" onClick={() => inputRef.current?.click()} disabled={reading}><Upload size={23} strokeWidth={1.4} /><strong>{reading ? '正在读取文件…' : '添加合同文件'}</strong><span>TXT / MD 可读取 · PDF / 照片可预览 · 最大 8 MB</span></button>
          <input ref={inputRef} type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp" className="visually-hidden" onChange={importFile} aria-label="选择合同文件" />
          {filename && <div className="document-name"><FileText size={14} /><span>{filename}</span>{sample && <Tag tone="green">合成示例</Tag>}</div>}
          {preview && <div className="file-preview">{preview.image ? <img src={preview.url} alt="你选择的合同图片预览" /> : <iframe src={preview.url} title="合同 PDF 预览" />}<p>当前仅预览文件。请粘贴其中的文字，在线识别将在后续接入。</p></div>}
          <label className="field-label" htmlFor="contract-text">合同文字 <span>可粘贴、修改和校对</span></label>
          <textarea id="contract-text" ref={textRef} value={text} onChange={e => editText(e.target.value)} placeholder={'把需要核对的合同文字粘贴在这里。\n\n还没有材料？可先点击“载入合成示例”。'} className="contract-text" spellCheck={false} maxLength={60000} />
          <div className="text-count"><span>请确认内容完整、数字无误</span><span className="mono">{text.length.toLocaleString()} 字符</span></div>
          <div className="confirm-fields"><label className="field-label">用工类型<select value={scope} onChange={e => { setScope(e.target.value); setFindings(null); }}><option value="fulltime">全日制劳动合同</option><option value="unknown">我还不能确认</option><option value="other">实习 / 劳务 / 非全日制</option></select></label><label className="field-label">确认合同期限（个月）<input type="number" min="0" max="1200" value={months} onChange={e => { setMonths(e.target.value); setFindings(null); }} placeholder="不明确可留空" /></label><label className="field-label">确认试用期（个月）<input type="number" min="0" max="120" value={probation} onChange={e => { setProbation(e.target.value); setFindings(null); }} placeholder="不明确可留空" /></label></div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button primary wide-button" onClick={run} disabled={reading}><ScanLine size={17} />{findings ? '按当前内容重新核对' : '开始核对'}<ArrowRight size={17} /></button>
          <p className="input-footnote">当前使用文本规则与确认值核对，尚未调用在线 AI。输入文件留在当前浏览器中。</p>
        </div>
      </section>
      <section className="panel review-panel"><div className="panel-heading"><div><ClipboardCheck size={17} /><h2>核对结果</h2></div>{findings ? <Tag tone="orange">{unresolved.length} 项待确认</Tag> : <span className="mono">REVIEW / 02</span>}</div>
        {!findings ? <div className="review-empty"><div className="empty-diagram"><div><FileCheck2 size={31} strokeWidth={1} /></div><span /><div><ListChecks size={31} strokeWidth={1} /></div></div><h3>清楚的下一步，从原文开始。</h3><p>添加文字并确认期限后，这里会显示需要核实的约定、依据和可以问 HR 的问题。</p><div className="empty-points"><span><Check size={14} />对应原文</span><span><Check size={14} />解释依据</span><span><Check size={14} />整理提问</span></div><button className="button text-button" onClick={loadDemo}>用合成示例走一遍 <ArrowRight size={15} /></button></div>
          : <div className="review-content"><div className="review-summary"><span className="eyebrow">NEXT ACTIONS</span><h3>{unresolved.length ? '先把这些约定问清楚' : '已完成这轮文字核对'}</h3><p>核对只覆盖当前文字与所选范围；“未找到”不等于合同一定没有。</p></div>
            <div className="finding-list">{findings.map((f, i) => <article key={f.id} className={`finding ${active === f.id ? 'open' : ''}`}><button className="finding-heading" onClick={() => setActive(active === f.id ? '' : f.id)} aria-expanded={active === f.id}><span className={`finding-number ${f.status}`}>{String(i + 1).padStart(2, '0')}</span><span><strong>{f.title}</strong><small>{f.category}</small></span><Tag tone={f.status === 'noted' ? 'green' : 'orange'}>{f.status === 'noted' ? '材料有说明' : f.status === 'missing' ? '信息待补充' : '需要确认'}</Tag><ChevronDown size={15} /></button>
              {active === f.id && <div className="finding-body">{f.quote && <blockquote>{f.quote}</blockquote>}<p>{f.summary}</p><a href={f.source} target="_blank" rel="noreferrer" className="source-link"><ShieldCheck size={13} />{f.article}<ExternalLink size={12} /></a><div className="question-preview"><span>可以这样问 HR</span><p>{f.question}</p></div><div className="finding-actions"><button className="button tiny secondary" onClick={() => locate(f.quote)}>查看原文</button><button className="button tiny primary" onClick={() => addQuestions([{ text: f.question, category: f.category }])}><Plus size={13} />加入询问清单</button></div></div>}
            </article>)}</div>
            {!!unresolved.length && <button className="button secondary wide-button" onClick={() => addQuestions(unresolved.map(f => ({ text: f.question, category: f.category })))}><ListChecks size={16} />整理全部待确认问题<ArrowRight size={16} /></button>}
            <p className="input-footnote">结果用于理解材料和准备沟通；具体争议请结合完整事实向人社部门或专业人员咨询。</p>
          </div>}
      </section>
    </div>
  </>;
}

const EMPTY_PAY = { gross: '', insurance: '', fund: '', tax: '', other: '', received: '' };
type PayForm = typeof EMPTY_PAY;
type PayResult = ReturnType<typeof calculatePayslip>;
function Salary({ addQuestions }: { addQuestions: (questions: { text: string; category: string }[]) => void }) {
  const [form, setForm] = useState<PayForm>(EMPTY_PAY);
  const [result, setResult] = useState<PayResult | null>(null);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const fields: { key: keyof PayForm; label: string; hint: string }[] = [
    { key: 'gross', label: '应发工资', hint: '工资条上的税前应发合计' },
    { key: 'insurance', label: '个人社保扣款', hint: '仅填个人承担部分' },
    { key: 'fund', label: '个人公积金扣款', hint: '仅填个人承担部分' },
    { key: 'tax', label: '已扣个人所得税', hint: '填写工资条上的本次已扣金额' },
    { key: 'other', label: '其他扣款', hint: '没有扣款请明确填 0' },
    { key: 'received', label: '实际到账（可选）', hint: '用于对照差额，不清楚可留空' },
  ];
  function calculate(values: PayForm) { setError(''); try { if (fields.slice(0, 5).some(field => values[field.key] === '')) throw new Error('请填写前五项金额；确认没有的扣款填 0。'); setResult(calculatePayslip({ gross: Number(values.gross), insurance: Number(values.insurance), fund: Number(values.fund), tax: Number(values.tax), other: Number(values.other), received: values.received === '' ? null : Number(values.received) })); } catch (e) { setResult(null); setError(e instanceof Error ? e.message : '请检查金额。'); } }
  function loadDemo() { const values = { gross: '8000', insurance: '800', fund: '600', tax: '66', other: '0', received: '6534' }; setForm(values); setDemo(true); calculate(values); }
  return <><PageHeading number="02" english="PAYSLIP EXPLAINER" title="每一笔钱，都看得清" description="输入工资条上的已知金额，展开应发到实发的计算。" right={<button className="button secondary" onClick={loadDemo}><FileText size={15} />载入示例金额</button>} />
    <div className="notice-band"><CircleHelp size={16} /><span>当前按你填写的金额拆解，不自动推算地方缴费比例或年度退税。没有的数据会保留为待确认。</span></div>
    <div className="two-column salary-grid"><section className="panel"><div className="panel-heading"><div><Wallet size={17} /><h2>核对工资明细</h2></div>{demo && <Tag tone="green">合成示例</Tag>}</div><form className="panel-body" onSubmit={e => { e.preventDefault(); calculate(form); }}><div className="form-grid">{fields.map(field => <label key={field.key} className="field-label">{field.label}<div className="currency-input"><span>¥</span><input type="number" min="0" step="0.01" placeholder="0.00" value={form[field.key]} onChange={e => { setForm({ ...form, [field.key]: e.target.value }); setResult(null); setDemo(false); }} aria-label={field.label} /></div><small>{field.hint}</small></label>)}</div>{error && <div className="form-error" role="alert">{error}</div>}<button className="button primary wide-button" type="submit">拆开看看 <ArrowRight size={17} /></button></form></section>
      <section className="panel salary-result"><div className="panel-heading"><div><ScanLine size={17} /><h2>从应发，到实发</h2></div><span className="mono">CALCULATION</span></div>{!result ? <div className="compact-empty"><Wallet size={37} strokeWidth={1} /><h3>金额确认后，计算过程在这里展开。</h3><p>每个输入都可修改，不清楚的扣款可以加入询问清单。</p></div> : <div className="salary-result-body"><span className="eyebrow">CALCULATED NET PAY</span><div className="net-pay"><small>¥</small>{money(result.net)}</div><p>根据当前已知扣款计算的实发金额</p><div className="salary-visual" aria-label="应发工资中实发与扣款的占比"><span style={{ width: `${Number(form.gross) ? result.net / Number(form.gross) * 100 : 0}%` }} /><i /></div><div className="salary-equation"><div><span>应发工资</span><strong>¥ {money(Number(form.gross))}</strong></div>{fields.slice(1, 5).map(field => <div key={field.key}><span><ArrowDown size={12} />{field.label}</span><strong>− ¥ {money(Number(form[field.key]))}</strong></div>)}<div className="equation-total"><span>计算实发</span><strong>¥ {money(result.net)}</strong></div></div>{result.difference !== null && <div className={`difference ${Math.abs(result.difference) < .005 ? 'matched' : ''}`}><CheckCircle2 size={17} /><span>{Math.abs(result.difference) < .005 ? '本次填写的到账金额与计算一致。' : `到账与计算相差 ¥${money(Math.abs(result.difference))}，请核对计薪期及其他扣项。`}</span></div>}<button className="button secondary wide-button" onClick={() => addQuestions([{ text: '请问本次工资中各项扣款的计算基数、个人承担比例，以及实际计薪期间分别是什么？能否提供对应明细？', category: '工资明细' }])}><Plus size={15} />把扣款问题加入询问清单</button></div>}</section></div>
  </>;
}

const EMPTY_POLICY: PolicyInput = { schoolCity: '', inGraduatingYear: 'unknown', supportCondition: 'unknown', claimedBefore: 'unknown' };
function Subsidy() {
  const [form, setForm] = useState<PolicyInput>(EMPTY_POLICY);
  const [result, setResult] = useState<PolicyResult | null>(null);
  function change<K extends keyof PolicyInput>(key: K, value: PolicyInput[K]) { setForm({ ...form, [key]: value }); setResult(null); }
  const statusText = { potential: '可以继续核对申请条件', 'not-matched': '当前条件有不匹配项', 'needs-info': '还有信息需要确认', unsupported: '这个地区尚未维护' };
  return <><PageHeading number="03" english="POLICY NAVIGATOR" title="把可能的支持，找到入口" description="按实际条件初步对照，再带着材料去官方平台确认。" right={<Tag>政策示例地区 · 广州</Tag>} />
    <div className="notice-band"><MapPin size={16} /><span>首版只维护下方一条广州政策示例。学校所在地、就业地和参保地不能混用，其他地区不会直接套用。</span></div>
    <div className="two-column"><section className="panel"><div className="panel-heading"><div><Search size={17} /><h2>先确认几件事</h2></div><span className="mono">PROFILE / 01</span></div><form className="panel-body policy-form" onSubmit={e => { e.preventDefault(); setResult(evaluateSubsidy(form)); }}>
      <label className="field-label">学校所在城市<select value={form.schoolCity} onChange={e => change('schoolCity', e.target.value)}><option value="">请选择</option><option value="广州">广州</option><option value="其他地区">其他地区（尚未维护）</option></select><small>这条政策依据学校所在地，不是你计划工作的城市。</small></label>
      <label className="field-label">是否为政策所指院校的毕业学年学生<select value={form.inGraduatingYear} onChange={e => change('inGraduatingYear', e.target.value as PolicyInput['inGraduatingYear'])}><option value="unknown">还需要确认</option><option value="yes">是，普通高校 / 中职 / 技工院校</option><option value="no">不是</option></select></label>
      <label className="field-label">是否具备下列政策条件<select value={form.supportCondition} onChange={e => change('supportCondition', e.target.value as PolicyInput['supportCondition'])}><option value="unknown">还需要确认</option><option value="loan">曾获得国家助学贷款</option><option value="low_income">符合原文所列困难家庭 / 特困情形</option><option value="disability">符合残疾人条件</option><option value="none">不符合官方列示的任何情形</option></select><small>困难情形需对照官方原文及证明材料，不以日常“收入较低”代替。</small></label>
      <label className="field-label">以前是否成功申领过这项补贴<select value={form.claimedBefore} onChange={e => change('claimedBefore', e.target.value as PolicyInput['claimedBefore'])}><option value="unknown">还需要确认</option><option value="no">没有</option><option value="yes">已经申领过</option></select></label>
      <button className="button primary wide-button" type="submit">对照这条政策 <ArrowRight size={17} /></button>
    </form></section><section className="panel policy-result"><div className="panel-heading"><div><FolderOpen size={17} /><h2>政策与条件</h2></div><span className="mono">POLICY / 02</span></div><div className="panel-body"><div className="policy-title"><Tag tone="green">个人申请 · 一次性</Tag><h3>广州市求职创业补贴</h3><span className="policy-amount">¥ 3,000<small> / 政策补贴标准</small></span><p>面向符合规定条件的毕业学年学生，已申领过不可重复申领。</p></div>{!result ? <div className="policy-placeholder"><ListChecks size={23} strokeWidth={1.3} /><p>填写左侧条件，查看每一项是否有依据。未知项会保留，不会替你猜。</p></div> : <div className="policy-evaluation" aria-live="polite"><h4>{statusText[result.status]}</h4>{result.requirements.map((req, i) => <div className="requirement" key={i}><span className={`requirement-status ${req.status}`}>{req.status === 'met' ? <Check size={13} /> : req.status === 'unmet' ? <X size={13} /> : '?'}</span><div><strong>{req.label}</strong><p>{req.detail}</p></div></div>)}<div className="small-note">{result.deadlineNote}</div></div>}<div className="policy-source"><span>资料核验 · {CHECKED}</span><a href={SUBSIDY} target="_blank" rel="noreferrer">打开官方原文 <ExternalLink size={13} /></a></div><a className="button secondary wide-button" href={result?.applicationUrl || 'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home'} target="_blank" rel="noreferrer">前往官方平台核实办理 <ArrowUpRight size={16} /></a><p className="input-footnote">这是条件初筛，不是获批结论。申报窗口、完整材料和实际审核以官方平台为准。</p></div></section></div>
  </>;
}

function Checklist({ questions, change, go, notify }: { questions: Question[]; change: (items: Question[]) => void; go: (page: Page) => void; notify: (text: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [removed, setRemoved] = useState<Question | null>(null);
  const visible = questions.filter(q => filter === 'all' || (filter === 'done' ? q.done : !q.done));
  const completed = questions.filter(q => q.done).length;
  const content = () => ['初程 · 我的询问清单', '请结合自己的材料与实际情况沟通。', '', ...questions.map((q, i) => `${q.done ? '[已确认]' : '[待确认]'} ${i + 1}. ${q.text}`)].join('\n\n');
  async function copy() { try { await navigator.clipboard.writeText(content()); notify('询问清单已复制。'); } catch { notify('浏览器未允许复制，可以使用导出按钮。'); } }
  return <><PageHeading number="04" english="YOUR CHECKLIST" title="带着清楚的问题去沟通" description="把没弄明白的约定记下来，逐项确认，也可以修改为自己的说法。" right={questions.length > 0 && <div className="inline-actions"><button className="button secondary" onClick={copy}><Copy size={15} />复制清单</button><button className="button primary" onClick={() => saveText(content(), '初程-我的询问清单.txt')}><Download size={15} />导出</button></div>} />
    <section className="panel checklist-panel"><div className="checklist-toolbar"><div className="filter-tabs" aria-label="清单状态">{(['all', 'todo', 'done'] as const).map(item => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? `全部 ${questions.length}` : item === 'todo' ? `待确认 ${questions.length - completed}` : `已确认 ${completed}`}</button>)}</div><span>只保存在当前浏览器 · 可导出留存</span></div>
      {questions.length === 0 ? <div className="list-empty"><div className="empty-icon"><ListChecks size={35} strokeWidth={1.2} /></div><h2>先整理一个真正想问的问题。</h2><p>完成合同核对后，可以把需要向 HR 确认的事项加入这里。</p><button className="button primary" onClick={() => go('contract')}>去核对合同 <ArrowRight size={16} /></button></div> : <div className="checklist-items">{visible.length === 0 && <div className="compact-empty"><CheckCheck size={28} /><p>这个状态下暂时没有问题。</p></div>}{visible.map((q, i) => <div className={`checklist-item ${q.done ? 'done' : ''}`} key={q.id}><input type="checkbox" checked={q.done} onChange={() => change(questions.map(item => item.id === q.id ? { ...item, done: !item.done } : item))} aria-label={`标记问题${i + 1}为${q.done ? '待确认' : '已确认'}`} /><div><span className="eyebrow">{q.category}</span><textarea aria-label={`编辑问题${i + 1}`} value={q.text} rows={2} maxLength={1500} onChange={e => change(questions.map(item => item.id === q.id ? { ...item, text: e.target.value } : item))} /><span className="question-state">{q.done ? '已确认' : '待确认 · 可直接修改文字'}</span></div><button className="icon-button" aria-label={`移除问题${i + 1}`} onClick={() => { setRemoved(q); change(questions.filter(item => item.id !== q.id)); }}><Trash2 size={15} /></button></div>)}</div>}
      {removed && <div className="undo-strip">已移除一个问题。<button className="button text-button" onClick={() => { change([...questions, removed]); setRemoved(null); }}><RotateCcw size={13} />撤销移除</button></div>}
    </section><div className="bottom-notes"><span>确认某个问题不代表所有条款都已核验；保留双方沟通的实际记录。</span><span className="mono">KEEP IT CLEAR.</span></div>
  </>;
}

function SourcesDialog({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return <dialog ref={ref} className="sources-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="sources-title"><div className="dialog-inner"><div className="panel-heading"><div><ShieldCheck size={18} /><h2 id="sources-title">资料与当前能力</h2></div><button className="icon-button" onClick={close} aria-label="关闭资料说明"><X size={19} /></button></div><div className="dialog-body"><Tag tone="green">首版交互原型</Tag><h3>每一步，先说明依据和边界。</h3><p>当前可以体验文字规则核对、已知工资金额拆解、广州政策条件初筛，以及询问清单的编辑与导出。在线大模型、图像文字识别和 RAG 尚未接入。</p><div className="source-entry"><span>01 / 合同</span><a href={LAW} target="_blank" rel="noreferrer">《中华人民共和国劳动合同法》<ArrowUpRight size={14} /></a><p>本次关注第 17、19、22、23、25 条。规则只核对已提供文本与确认值，不代替对完整事实的法律判断。</p></div><div className="source-entry"><span>02 / 补贴</span><a href={SUBSIDY} target="_blank" rel="noreferrer">广州市求职创业补贴常见问题<ArrowUpRight size={14} /></a><p>发布于 2026-02-11，资料核验于 2026-10-26。这里只维护此条示例，不默认你身处广州。</p></div><div className="source-entry"><span>03 / 数据</span><strong>文件在当前浏览器处理</strong><p>不会自动上传合同或工资信息。只有你加入的询问清单会保存在当前浏览器；可以逐项移除或导出。</p></div></div></div></dialog>;
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [demoSeed, setDemoSeed] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => { const handler = () => { setPage(currentPage()); window.scrollTo({ top: 0, behavior: 'instant' }); }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { document.title = `${NAV.find(item => item.id === page)?.label} · 初程`; }, [page]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  function go(next: Page) { if (currentPage() === next) { setPage(next); window.scrollTo({ top: 0, behavior: 'instant' }); } else { window.location.hash = `/${next}`; } }
  function changeQuestions(items: Question[]) { setQuestions(items); try { localStorage.setItem(STORE, JSON.stringify(items)); return true; } catch { setToast('浏览器暂时无法保存；清单仅本次可用，请导出留存。'); return false; } }
  function addQuestions(items: { text: string; category: string }[]) { const added = items.filter(item => item.text.trim() && !questions.some(q => q.text === item.text)); if (!added.length) { setToast('这些问题已经在询问清单里。'); return; } const room = 50 - questions.length; if (room <= 0) { setToast('当前最多保存 50 条问题，请先整理或导出已有清单。'); return; } const saved = changeQuestions([...questions, ...added.slice(0, room).map(item => ({ id: crypto.randomUUID(), text: item.text, category: item.category, done: false }))]); if (saved) setToast(`已加入 ${Math.min(room, added.length)} 个问题，可以到“我的询问清单”修改和导出。`); }
  function demo() { setDemoSeed(value => value + 1); go('contract'); }
  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>跳到主要内容</a>
    <aside className="sidebar"><a href="#/home" className="brand-link" aria-label="初程首页"><Wordmark /></a><div className="sidebar-project"><span>莱茵生命</span><span className="mono">GRADUATE SUPPORT</span></div><div className="nav-section-label">你的办事工作台</div><nav aria-label="主要导航">{NAV.map(item => <a key={item.id} href={`#/${item.id}`} className={`nav-item ${page === item.id ? 'active' : ''}`} aria-current={page === item.id ? 'page' : undefined}><item.icon size={19} strokeWidth={1.6} /><span>{item.label}<small>{item.english}</small></span>{item.id === 'list' && questions.length > 0 && <i className="nav-count">{questions.length}</i>}</a>)}</nav><div className="sidebar-bottom"><div className="support-note"><span className="mini-grid">✳</span><p>每个新开始，<br />都值得一份清楚的指引。</p></div><button className="sidebar-help" onClick={() => setSourcesOpen(true)}><CircleHelp size={16} /><span>资料与使用说明</span><ArrowUpRight size={14} /></button><div className="sidebar-version"><span className="status-dot" /> 首版体验<span className="mono">V0.1</span></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><span>工作台</span><ChevronRight size={13} /><strong>{page === 'home' ? '总览' : NAV.find(item => item.id === page)?.label}</strong></div><div className="topbar-meta"><span className="mono topbar-date">{CHECKED} / MON</span><span className="prototype-label"><span className="status-dot" />交互原型 · 规则体验</span><button className="icon-button" onClick={() => setSourcesOpen(true)} aria-label="查看资料与当前能力"><CircleHelp size={18} /></button></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}><div hidden={page !== 'home'}><Home go={go} demo={demo} count={questions.length} /></div><div hidden={page !== 'contract'}><Contract demoSeed={demoSeed} addQuestions={addQuestions} notify={setToast} /></div><div hidden={page !== 'salary'}><Salary addQuestions={addQuestions} /></div><div hidden={page !== 'subsidy'}><Subsidy /></div><div hidden={page !== 'list'}><Checklist questions={questions} change={changeQuestions} go={go} notify={setToast} /></div></main><footer className="app-footer"><span>初程 FIRST STEP <i /> 为第一次走入职场的你</span><button onClick={() => setSourcesOpen(true)}>资料与依据 <ArrowUpRight size={12} /></button></footer>
    </div><SourcesDialog open={sourcesOpen} close={() => setSourcesOpen(false)} />{toast && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="关闭提示"><X size={15} /></button></div>}
  </div>;
}
