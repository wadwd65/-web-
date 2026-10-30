import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, ChangeEvent } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCheck,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck,
  Copy, Download, ExternalLink, FileCheck2, FileText, FolderOpen,
  LayoutDashboard, ListChecks, MapPin, Plus, RotateCcw, ScanLine,
  Search, ShieldCheck, Sparkles, Trash2, Upload, Wallet, X,
} from 'lucide-react';
import { analyzeContract, DEMO_CONTRACT } from './lib/contracts.ts';
import type { Finding } from './lib/contracts.ts';
import Salary from './Salary.tsx';
import { evaluateSubsidy } from './lib/policies.ts';
import type { PolicyInput, PolicyResult } from './lib/policies.ts';
import SpatialTerminal from './ExperienceWorkspace.tsx';
import { EXPERIENCE_MODULES,parseExperiencePage } from './experience-modules.ts';
import type { ExperiencePage,WorkspacePage } from './experience-modules.ts';
import { EMPTY_SIGNALS } from './terminal-state.ts';
import type { ContractSignal, SalarySignal, SubsidySignal } from './terminal-state.ts';
import { saveText, recordTime } from './lib/download.ts';
import NewModules from './NewModules.tsx';
import {SOURCES,VERIFIED} from './lib/eight-tools.ts';
import type {ToolId,ToolSignal} from './terminal-state.ts';

type Page = ExperiencePage;
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

function currentPage(): Page {return parseExperiencePage(window.location.hash);}

function initialQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw || raw.length > 64000) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is Question => !!item && typeof item.id === 'string' && typeof item.text === 'string' && item.text.length <= 1500 && typeof item.done === 'boolean' && typeof item.category === 'string').slice(0, 50);
  } catch { return []; }
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
  return <header className="page-heading terminal-page-heading"><div className="page-heading-stamp" aria-hidden="true"><strong>{number}</strong><i /><small>MODULE</small></div><div className="page-heading-copy"><div className="eyebrow">{english}</div><h1>{title}</h1><p>{description}</p></div>{right&&<div className="page-heading-actions">{right}</div>}</header>;
}
function ControlFace({ label, icon, code }: { label:ReactNode;icon:ReactNode;code:string }) {
  return <><span className="control-label">{label}</span><span className="control-action" aria-hidden="true"><small>{code}</small>{icon}</span></>;
}
function Contract({ demoSeed, addQuestions, notify, onSignal }: { demoSeed: number; addQuestions: (questions: { text: string; category: string }[]) => void; notify: (text: string) => void; onSignal:(signal:ContractSignal)=>void }) {
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
  const scopeRef = useRef<HTMLSelectElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  function loadDemo() { setText(DEMO_CONTRACT); setMonths('12'); setProbation('3'); setFindings(null); setError(''); setFilename('合成示例 · 劳动合同.txt'); setSample(true); setPreview(null); setScope('fulltime'); }
  useLayoutEffect(() => { if (demoSeed > 0) loadDemo(); }, [demoSeed]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  useEffect(() => { if (findings) reviewRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); }, [findings]);
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
    const showField=(field:HTMLElement|null)=>{field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
    if (!text.trim()) { setError('请先粘贴合同文字，或使用合成示例。'); showField(textRef.current); return; }
    if (scope !== 'fulltime') { setError('请先确认用工类型。实习、劳务和非全日制协议需要其他适用规则，此版不自动套用。'); showField(scopeRef.current); return; }
    if (text.length > 60000) { setError('本次最多核对 60,000 字符，请缩短内容后重试。'); return; }
    try { const result = analyzeContract({ text, contractMonths: months === '' ? null : Number(months), probationMonths: probation === '' ? null : Number(probation) }); setFindings(result); setActive(result[0]?.id ?? ''); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : '暂时无法核对，请检查确认值。'); }
  }
  function locate(quote: string) { const index = quote.trim() ? text.indexOf(quote) : -1; if (index < 0 || !textRef.current) { notify('这项未能在已提供文本中定位，请核对材料是否完整。'); return; } textRef.current.focus(); textRef.current.setSelectionRange(index, index + quote.length); textRef.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth', block: 'center' }); }
  const unresolved = findings?.filter(f => f.status !== 'noted') ?? [];
  const unresolvedCount=findings?unresolved.length:null;
  function exportReview(){
    if(!findings)return;
    const status={noted:'材料有说明',missing:'信息待补充',attention:'需要确认'};
    const content=['初程 · 合同文字核对记录',`生成时间：${recordTime()}`,
      `材料：${filename||'粘贴的合同文字'}${sample?'（合成示例）':''}`,
      `原文字数：${text.length}；已确认用工类型：全日制劳动合同`,
      `已确认合同期限：${months===''?'未确认':months+'个月'}；试用期：${probation===''?'未确认':probation+'个月'}`,
      `本轮对照 ${findings.length} 项；${unresolved.length} 项待确认`,
      '以下记录来自已提供文字和确认值的本地规则核对。未定位不等于条款不存在，不代表对完整合同的法律结论。','',
      ...findings.flatMap((finding,index)=>[`${String(index+1).padStart(2,'0')} / ${finding.title} · ${status[finding.status]}`,
        finding.quote?`对应原文：${finding.quote}`:'对应原文：本轮未定位，请核对完整材料。',
        finding.summary,`依据：${finding.article}`,finding.source,`可以问 HR：${finding.question}`,''])].join('\n');
    saveText(content,'初程-合同文字核对记录.txt');
  }
  useEffect(()=>onSignal({characters:text.length,reviewed:findings!==null,unresolved:unresolvedCount,items:findings?.length??0}),[text.length,findings,unresolvedCount,onSignal]);
  return <>
    <PageHeading number="02" english="CONTRACT REVIEW" title="劳动合同核对" description="粘贴原文，确认用工类型与期限，再核对约定、整理询问。" right={<button className="button secondary" onClick={loadDemo}><ControlFace label="载入合成示例" icon={<FileText size={16}/>} code="DEMO"/></button>} />
    <div className="process-line workflow-stations"><span className={text.trim()?'current ready':'current'}><b>01</b><span><strong>准备材料</strong><small>{text.trim()?'已载入文字':'导入或粘贴'}</small></span></span><ChevronRight size={14}/><span className={findings?'current ready':''}><b>02</b><span><strong>核对约定</strong><small>{findings?'已有核对结果':'确认类型与期限'}</small></span></span><ChevronRight size={14}/><span className={unresolved.length?'available':''}><b>03</b><span><strong>整理询问</strong><small>{unresolved.length?`${unresolved.length}项可继续确认`:'带走自己的问题'}</small></span></span><Tag>本地文字规则体验</Tag></div>
    <div className="task-action-strip"><div><strong>{findings?'查看结果，带走这次核对记录':'先准备合同文字并确认期限'}</strong><span>{findings?'修改原文或确认值后，需要重新核对。':text.trim()?'原文已载入，请确认下方用工类型与期限。':'没有材料也可先载入合成示例。'}</span></div><button className="button primary" onClick={findings?exportReview:run} disabled={reading}><ControlFace label={findings?'导出核对记录':'开始核对'} icon={findings?<Download size={18}/>:<ArrowRight size={19}/>} code={findings?'TXT':'RUN'}/></button>{error&&<p className="task-action-message" role="alert">{error}</p>}</div>
    <div className="contract-grid">
      <section className="panel document-panel"><div className="panel-heading"><div><FileText size={17} /><h2>合同原文</h2></div><span className="mono">SOURCE / 01</span></div>
        <div className="document-inner">
          <button className="upload-zone" onClick={() => inputRef.current?.click()} disabled={reading}><span className="upload-port" aria-hidden="true"><Upload size={23} strokeWidth={1.4}/><i>IN</i></span><span className="upload-copy"><strong>{reading?'正在读取文件…':'添加合同文件'}</strong><small>TXT / MD 可读取 · PDF / 照片可预览 · 最大 8 MB</small></span><span className="upload-open" aria-hidden="true"><ArrowUpRight size={19}/></span></button>
          <input ref={inputRef} type="file" accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp" className="visually-hidden" tabIndex={-1} onChange={importFile} aria-label="选择合同文件" />
          {filename && <div className="document-name"><FileText size={14} /><span>{filename}</span>{sample && <Tag tone="green">合成示例</Tag>}</div>}
          {preview && <div className="file-preview">{preview.image ? <img src={preview.url} alt="你选择的合同图片预览" /> : <iframe src={preview.url} title="合同 PDF 预览" />}<p>当前仅预览文件。请粘贴其中的文字，在线识别将在后续接入。</p></div>}
          <label className="field-label" htmlFor="contract-text">合同文字 <span>可粘贴、修改和校对</span></label>
          <textarea id="contract-text" ref={textRef} value={text} onChange={e => editText(e.target.value)} placeholder={'把需要核对的合同文字粘贴在这里。\n\n还没有材料？可先点击“载入合成示例”。'} className="contract-text" spellCheck={false} maxLength={60000} />
          <div className="text-count"><span>请确认内容完整、数字无误</span><span className="mono">{text.length.toLocaleString()} 字符</span></div>
          <div className="confirm-fields"><label className="field-label">用工类型<select ref={scopeRef} value={scope} onChange={e => { setScope(e.target.value); setFindings(null); }}><option value="fulltime">全日制劳动合同</option><option value="unknown">我还不能确认</option><option value="other">实习 / 劳务 / 非全日制</option></select></label><label className="field-label">确认合同期限（个月）<input type="number" min="0" max="1200" value={months} onChange={e => { setMonths(e.target.value); setFindings(null); }} placeholder="不明确可留空" /></label><label className="field-label">确认试用期（个月）<input type="number" min="0" max="120" value={probation} onChange={e => { setProbation(e.target.value); setFindings(null); }} placeholder="不明确可留空" /></label></div>
          <p className="input-footnote">当前使用文本规则与确认值核对，尚未调用在线 AI。输入文件留在当前浏览器中。</p>
        </div>
      </section>
      <section ref={reviewRef} className="panel review-panel"><div className="panel-heading"><div><ClipboardCheck size={17} /><h2>核对结果</h2></div>{findings ? <Tag tone="orange">{unresolved.length} 项待确认</Tag> : <span className="mono">REVIEW / 02</span>}</div>
        {!findings ? <div className="review-empty"><div className="empty-optic" aria-hidden="true"><i/><i/><i/><FileCheck2 size={38} strokeWidth={1.1}/></div><span className="eyebrow">WAITING FOR SOURCE</span><h3>清楚的下一步，从原文开始。</h3><p>添加文字并确认期限后，这里会显示需要核实的约定、依据和可以问 HR 的问题。</p><div className="empty-points"><span><Check size={14}/>对应原文</span><span><Check size={14}/>解释依据</span><span><Check size={14}/>整理提问</span></div><button className="button text-button" onClick={loadDemo}><ControlFace label="用合成示例走一遍" icon={<ArrowRight size={16}/>} code="DEMO"/></button></div>
          : <div className="review-content"><div className="review-summary"><div><span className="eyebrow">NEXT ACTIONS</span><h3>{unresolved.length?'先把这些约定问清楚':'已完成这轮文字核对'}</h3><p>核对只覆盖当前文字与所选范围；“未找到”不等于合同一定没有。</p></div><div className="review-count"><strong>{String(unresolved.length).padStart(2,'0')}</strong><small>项待确认</small></div></div>
            <div className="finding-list">{findings.map((f, i) => <article key={f.id} className={`finding ${active === f.id ? 'open' : ''}`}><button className="finding-heading" onClick={() => setActive(active === f.id ? '' : f.id)} aria-expanded={active === f.id}><span className={`finding-number ${f.status}`}>{String(i + 1).padStart(2, '0')}</span><span><strong>{f.title}</strong><small>{f.category}</small></span><Tag tone={f.status === 'noted' ? 'green' : 'orange'}>{f.status === 'noted' ? '材料有说明' : f.status === 'missing' ? '信息待补充' : '需要确认'}</Tag><ChevronDown size={15} /></button>
              {active === f.id && <div className="finding-body">{f.quote&&<blockquote>{f.quote}</blockquote>}<p>{f.summary}</p><a href={f.source} target="_blank" rel="noreferrer" className="source-link"><ShieldCheck size={13}/>{f.article}<ExternalLink size={12}/></a><div className="question-preview"><span>可以这样问 HR</span><p>{f.question}</p></div><div className="finding-actions"><button className="button tiny secondary" onClick={()=>locate(f.quote)}><ControlFace label="查看原文" icon={<ArrowUpRight size={14}/>} code="QUOTE"/></button><button className="button tiny primary" onClick={()=>addQuestions([{text:f.question,category:f.category}])}><ControlFace label="加入询问清单" icon={<Plus size={14}/>} code="ADD"/></button></div></div>}
            </article>)}</div>
            {!!unresolved.length&&<button className="button primary wide-button" onClick={()=>addQuestions(unresolved.map(f=>({text:f.question,category:f.category})))}><ControlFace label={`整理 ${unresolved.length} 项待确认问题`} icon={<ListChecks size={17}/>} code="COLLECT"/></button>}
            <p className="input-footnote">结果用于理解材料和准备沟通；具体争议请结合完整事实向人社部门或专业人员咨询。</p>
          </div>}
      </section>
    </div>
  </>;
}

const EMPTY_POLICY: PolicyInput = { schoolCity: '', inGraduatingYear: 'unknown', supportCondition: 'unknown', claimedBefore: 'unknown' };
function Subsidy({onSignal,addQuestions}:{onSignal:(signal:SubsidySignal)=>void;addQuestions:(items:{text:string;category:string}[])=>void}) {
  const [form, setForm] = useState<PolicyInput>(EMPTY_POLICY);
  const [result, setResult] = useState<PolicyResult | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  useEffect(()=>onSignal({checked:result!==null,status:result?.status??null,states:result?.requirements.map(item=>item.status)??[]}),[result,onSignal]);
  useEffect(()=>{if(result)resultRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},[result]);
  function change<K extends keyof PolicyInput>(key: K, value: PolicyInput[K]) { setForm(previous=>({ ...previous, [key]: value })); setResult(null); }
  const statusText = { potential: '可以继续核对申请条件', 'not-matched': '当前条件有不匹配项', 'needs-info': '还有信息需要确认', unsupported: '这个地区尚未维护' };
  function exportPolicy(){
    if(!result)return;
    const names={met:'自述匹配',unmet:'自述不匹配',unknown:'待确认'};
    saveText(['初程 · 补贴条件对照记录',`生成时间：${recordTime()}`,
      `学校所在城市：${form.schoolCity||'未填写'}`,`本轮状态：${statusText[result.status]}`,
      '这是一条广州政策示例的自述条件初筛，不是获批结论；未维护地区不套用广州规则。','',
      ...result.requirements.flatMap((item,index)=>[`${String(index+1).padStart(2,'0')} / ${item.label} · ${names[item.status]}`,item.detail,'']),
      result.deadlineNote,`资料核验日期：${CHECKED}`,`官方原文：${SUBSIDY}`,
      `办理核实入口：${result.applicationUrl||'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home'}`,
      '申报窗口、完整材料和实际审核以官方平台为准。'].join('\n'),'初程-补贴条件对照记录.txt');
  }
  return <><PageHeading number="07" english="POLICY NAVIGATOR" title="补贴条件初筛" description="先填写实际情况，再查看待确认条件与官方办理入口。" right={<Tag>政策示例地区 · 广州</Tag>} />
    <div className="notice-band"><MapPin size={16} /><span>首版只维护下方一条广州政策示例。学校所在地、就业地和参保地不能混用，其他地区不会直接套用。</span></div>
    <div className="task-action-strip"><div><strong>{result?'保留这次条件对照，再核实办理':'填写自己的情况，再对照条件'}</strong><span>不清楚的项目可以保留“还需要确认”。</span></div>{result?<button className="button primary" onClick={exportPolicy}><ControlFace label="导出条件对照" icon={<Download size={18}/>} code="TXT"/></button>:<button className="button primary" type="submit" form="subsidy-form"><ControlFace label="对照这条政策" icon={<ArrowRight size={18}/>} code="MATCH"/></button>}</div>
    <div className="two-column"><section className="panel"><div className="panel-heading"><div><Search size={17} /><h2>先确认几件事</h2></div><span className="mono">PROFILE / 01</span></div><form id="subsidy-form" className="panel-body policy-form" onSubmit={e => { e.preventDefault(); setResult(evaluateSubsidy(form)); }}>
      <label className="field-label">学校所在城市<select required value={form.schoolCity} onChange={e => change('schoolCity', e.target.value)}><option value="">请选择</option><option value="广州">广州</option><option value="其他地区">其他地区（尚未维护）</option></select><small>这条政策依据学校所在地，不是你计划工作的城市。</small></label>
      <label className="field-label">是否为政策所指院校的毕业学年学生<select value={form.inGraduatingYear} onChange={e => change('inGraduatingYear', e.target.value as PolicyInput['inGraduatingYear'])}><option value="unknown">还需要确认</option><option value="yes">是，普通高校 / 中职 / 技工院校</option><option value="no">不是</option></select></label>
      <label className="field-label">是否具备下列政策条件<select value={form.supportCondition} onChange={e => change('supportCondition', e.target.value as PolicyInput['supportCondition'])}><option value="unknown">还需要确认</option><option value="loan">曾获得国家助学贷款</option><option value="low_income">符合原文所列困难家庭 / 特困情形</option><option value="disability">符合残疾人条件</option><option value="none">不符合官方列示的任何情形</option></select><small>困难情形需对照官方原文及证明材料，不以日常“收入较低”代替。</small></label>
      <label className="field-label">以前是否成功申领过这项补贴<select value={form.claimedBefore} onChange={e => change('claimedBefore', e.target.value as PolicyInput['claimedBefore'])}><option value="unknown">还需要确认</option><option value="no">没有</option><option value="yes">已经申领过</option></select></label>
    </form></section><section ref={resultRef} className="panel policy-result"><div className="panel-heading"><div><FolderOpen size={17} /><h2>政策与条件</h2></div><span className="mono">POLICY / 02</span></div><div className="panel-body"><div className="policy-title"><Tag tone="green">个人申请 · 一次性</Tag><h3>广州市求职创业补贴</h3><span className="policy-amount">¥ 3,000<small> / 政策补贴标准</small></span><p>面向符合规定条件的毕业学年学生，已申领过不可重复申领。</p></div>{!result ? <div className="policy-placeholder"><ListChecks size={23} strokeWidth={1.3} /><p>填写自己的条件后，点击“对照这条政策”。不清楚的项目会保留待确认。</p></div> : <div className="policy-evaluation" aria-live="polite"><h4>{statusText[result.status]}</h4>{result.requirements.map((req, i) => <div className="requirement" key={i}><span className={`requirement-status ${req.status}`}>{req.status === 'met' ? <Check size={13} /> : req.status === 'unmet' ? <X size={13} /> : '?'}</span><div><strong>{req.label}</strong><p>{req.detail}</p></div></div>)}<div className="small-note">{result.deadlineNote}</div></div>}{result&&<button className="button secondary wide-button" onClick={()=>addQuestions(result.requirements.filter(item=>item.status!=='met').map(item=>({category:'补贴匹配',text:`关于${item.label}，我需要向办理部门核实：${item.detail}`})))} disabled={result.requirements.every(item=>item.status==='met')}>把未确认条件加入询问清单<Plus size={14}/></button>}<div className="policy-source"><span>资料核验 · {CHECKED}</span><a href={SUBSIDY} target="_blank" rel="noreferrer">打开官方原文 <ExternalLink size={13} /></a></div><a className="button secondary wide-button" href={result?.applicationUrl || 'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home'} target="_blank" rel="noreferrer"><ControlFace label="前往官方平台核实办理" icon={<ArrowUpRight size={16}/>} code="OPEN"/></a><p className="input-footnote">这是条件初筛，不是获批结论。申报窗口、完整材料和实际审核以官方平台为准。</p></div></section></div>
  </>;
}

function QuestionEditor({label,value,change}:{label:string;value:string;change:(text:string)=>void}) {
  const ref=useRef<HTMLTextAreaElement>(null);
  function fit(){const field=ref.current;if(!field||field.offsetParent===null)return;field.style.height='auto';field.style.height=`${Math.min(300,Math.max(83,field.scrollHeight))}px`;}
  useLayoutEffect(fit);
  useEffect(()=>{window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit);},[]);
  return <textarea ref={ref} aria-label={label} value={value} rows={3} maxLength={1500} onChange={event=>change(event.target.value)}/>;
}
function Checklist({ questions, change, go, notify }: { questions: Question[]; change: (items: Question[]) => void; go: (page: Page) => void; notify: (text: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [removed, setRemoved] = useState<Question | null>(null);
  const visible = questions.filter(q => filter === 'all' || (filter === 'done' ? q.done : !q.done));
  const completed = questions.filter(q => q.done).length;
  const content = () => ['初程 · 我的询问清单', '请结合自己的材料与实际情况沟通。', '', ...questions.map((q, i) => `${q.done ? '[已确认]' : '[待确认]'} ${i + 1}. ${q.text}`)].join('\n\n');
  async function copy() { try { await navigator.clipboard.writeText(content()); notify('询问清单已复制。'); } catch { notify('浏览器未允许复制，可以使用导出按钮。'); } }
  return <><PageHeading number="—" english="YOUR CHECKLIST" title="带着清楚的问题去沟通" description="把没弄明白的约定记下来，逐项确认，也可以修改为自己的说法。" right={questions.length > 0 && <div className="inline-actions"><button className="button secondary" onClick={copy}><ControlFace label="复制清单" icon={<Copy size={16}/>} code="COPY"/></button><button className="button primary" onClick={() => saveText(content(), '初程-我的询问清单.txt')}><ControlFace label="导出" icon={<Download size={16}/>} code="TXT"/></button></div>} />
    <section className="panel checklist-panel"><div className="checklist-toolbar"><div className="filter-tabs" aria-label="清单状态">{(['all', 'todo', 'done'] as const).map(item => <button key={item} className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'all' ? `全部 ${questions.length}` : item === 'todo' ? `待确认 ${questions.length - completed}` : `已确认 ${completed}`}</button>)}</div><span>只保存在当前浏览器 · 可导出留存</span></div>
      {questions.length === 0 ? <div className="list-empty"><div className="empty-icon"><ListChecks size={35} strokeWidth={1.2} /></div><h2>先整理一个真正想问的问题。</h2><p>完成合同核对后，可以把需要向 HR 确认的事项加入这里。</p><button className="button primary" onClick={() => go('contract')}><ControlFace label="去核对合同" icon={<ArrowRight size={17}/>} code="OPEN"/></button></div> : <div className="checklist-items">{visible.length === 0 && <div className="compact-empty"><CheckCheck size={28} /><p>这个状态下暂时没有问题。</p></div>}{visible.map((q, i) => <div className={`checklist-item ${q.done ? 'done' : ''}`} key={q.id}><span className="checklist-order" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><input type="checkbox" checked={q.done} onChange={() => change(questions.map(item => item.id === q.id ? { ...item, done: !item.done } : item))} aria-label={`标记问题${i + 1}为${q.done ? '待确认' : '已确认'}`} /><div><span className="eyebrow">{q.category}</span><QuestionEditor label={`编辑问题${i + 1}`} value={q.text} change={text=>change(questions.map(item=>item.id===q.id?{...item,text}:item))}/><span className="question-state">{q.done ? '已确认' : '待确认 · 可直接修改文字'}</span></div><button className="icon-button" aria-label={`移除问题${i + 1}`} onClick={() => { setRemoved(q); change(questions.filter(item => item.id !== q.id)); }}><Trash2 size={15} /></button></div>)}</div>}
      {removed && <div className="undo-strip">已移除一个问题。<button className="button text-button" onClick={() => { change([...questions, removed]); setRemoved(null); }}><ControlFace label="撤销移除" icon={<RotateCcw size={14}/>} code="UNDO"/></button></div>}
    </section><div className="bottom-notes"><span>确认某个问题不代表所有条款都已核验；保留双方沟通的实际记录。</span><span className="mono">KEEP IT CLEAR.</span></div>
  </>;
}

function SourcesDialog({ open, close }: { open: boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); else if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return <dialog ref={ref} className="sources-dialog" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="sources-title"><div className="dialog-inner"><div className="panel-heading"><div><ShieldCheck size={18} /><h2 id="sources-title">资料与当前能力</h2></div><button className="icon-button" onClick={close} aria-label="关闭资料说明"><X size={19} /></button></div><div className="dialog-body"><Tag tone="green">首版交互原型</Tag><h3>每一步，先说明依据和边界。</h3><p>当前有八项本地工具：条件对齐、文本规则核对、金额公式试算、办理路线和交接台账。补贴仍仅维护广州样例。在线大模型、图像文字识别、RAG 和 Agent 尚未接入。</p><div className="source-entry"><span>02 / 合同</span><a href={LAW} target="_blank" rel="noreferrer">《中华人民共和国劳动合同法》<ArrowUpRight size={14} /></a><p>本次关注第 17、19、22、23、25 条。规则只核对已提供文本与确认值，不代替对完整事实的法律判断。</p></div><div className="source-entry"><span>07 / 补贴</span><a href={SUBSIDY} target="_blank" rel="noreferrer">广州市求职创业补贴常见问题<ArrowUpRight size={14} /></a><p>发布于 2026-02-11，资料核验于 2026-10-26。这里只维护此条示例，不默认你身处广州。</p></div>{[SOURCES.tax,SOURCES.rates,SOURCES.rent,SOURCES.medical,SOURCES.transfer,SOURCES.card].map(source=><div className="source-entry" key={source.url}><span>扩展依据 · 核验 {VERIFIED}</span><a href={source.url} target="_blank" rel="noreferrer">{source.name}<ArrowUpRight size={14}/></a><p>{source.scope}</p></div>)}<div className="source-entry"><span>数据与保存</span><strong>文件在当前浏览器处理</strong><p>不会自动上传合同或工资信息。只有你加入的询问清单会保存在当前浏览器；可以逐项移除或导出。</p></div></div></div></dialog>;
}

export default function App() {
  const [signals,setSignals]=useState(EMPTY_SIGNALS);
  const contractSignal=useCallback((value:ContractSignal)=>setSignals(previous=>({...previous,contract:value})),[]);
  const salarySignal=useCallback((value:SalarySignal)=>setSignals(previous=>({...previous,salary:value})),[]);
  const subsidySignal=useCallback((value:SubsidySignal)=>setSignals(previous=>({...previous,subsidy:value})),[]);
  const toolSignal=useCallback((id:ToolId,value:ToolSignal)=>setSignals(previous=>({...previous,tools:{...previous.tools,[id]:value}})),[]);
  const [page, setPage] = useState<Page>(currentPage);
  const remembered=typeof window.history.state?.firstStepMusicReturn==='string'?parseExperiencePage('#/'+window.history.state.firstStepMusicReturn):'home';
  const retainedPage=useRef<WorkspacePage>(page==='music'?(remembered==='music'?'home':remembered):page);if(page!=='music')retainedPage.current=page;const workspacePage=retainedPage.current;
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [demoSeed, setDemoSeed] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => { const handler = () => { setPage(currentPage()); window.scrollTo({ top: 0, behavior: 'instant' }); }; window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler); }, []);
  useEffect(() => { document.title = `${page==='music'?'音乐播放器':EXPERIENCE_MODULES.find(item => item.id === page)?.label ?? NAV.find(item => item.id === page)?.label ?? '工作台'} · 初程`; }, [page]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timer); }, [toast]);
  function go(next: Page) { setPage(next); if (currentPage() !== next) window.location.hash = `/${next}`; else window.scrollTo({ top: 0, behavior: 'instant' }); }
  function openMusic(){
    if(page==='music')return;
    window.history.pushState({...window.history.state,firstStepMusicReturn:workspacePage},'', '#/music');setPage('music');
  }
  function closeMusic(){
    if(window.history.state?.firstStepMusicReturn===workspacePage){window.history.back();return;}
    window.history.replaceState(window.history.state,'', '#/'+workspacePage);setPage(workspacePage);
  }
  function changeQuestions(items: Question[]) { setQuestions(items); try { localStorage.setItem(STORE, JSON.stringify(items)); return true; } catch { setToast('浏览器暂时无法保存；清单仅本次可用，请导出留存。'); return false; } }
  function addQuestions(items: { text: string; category: string }[]) { const added = items.filter(item => item.text.trim() && !questions.some(q => q.text === item.text)); if (!added.length) { setToast('这些问题已经在询问清单里。'); return; } const room = 50 - questions.length; if (room <= 0) { setToast('当前最多保存 50 条问题，请先整理或导出已有清单。'); return; } const saved = changeQuestions([...questions, ...added.slice(0, room).map(item => ({ id: crypto.randomUUID(), text: item.text, category: item.category, done: false }))]); if (saved) setToast(`已加入 ${Math.min(room, added.length)} 个问题，可以到“我的询问清单”修改和导出。`); }
  function demo() { setDemoSeed(value => value + 1); go('contract'); }
  return <><SpatialTerminal page={workspacePage} musicOpen={page==='music'} openMusic={openMusic} closeMusic={closeMusic} go={go} questionCount={questions.length} signals={signals} covered={sourcesOpen} openSources={() => setSourcesOpen(true)} demo={demo}>
    <div className="business-module module-contract" hidden={workspacePage !== 'contract'}><Contract demoSeed={demoSeed} addQuestions={addQuestions} notify={setToast} onSignal={contractSignal} /></div>
    <div className="business-module module-salary" hidden={workspacePage !== 'salary'}><Salary addQuestions={addQuestions} onSignal={salarySignal} /></div>
    <div className="business-module module-subsidy" hidden={workspacePage !== 'subsidy'}><Subsidy onSignal={subsidySignal} addQuestions={addQuestions}/></div>
    <NewModules page={workspacePage} onProgress={toolSignal} addQuestions={addQuestions} notify={setToast}/>
    <div className="business-module module-list" hidden={workspacePage !== 'list'}><Checklist questions={questions} change={changeQuestions} go={go} notify={setToast} /></div>
  </SpatialTerminal><SourcesDialog open={sourcesOpen} close={() => setSourcesOpen(false)} />{toast && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{toast}</span><button className="icon-button" onClick={() => setToast('')} aria-label="关闭提示"><X size={15} /></button></div>}
  </>;
}
