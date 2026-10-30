import {ArrowRightLeft,ArrowUpRight,BriefcaseBusiness,Calculator,ChevronLeft,ChevronRight,FileCheck2,HandCoins,House,Info,ReceiptText,ShieldCheck} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';

const entries=[
 {icon:BriefcaseBusiness,hint:'几个工作机会，放在一起比'},
 {icon:FileCheck2,hint:'签字之前，核对关键约定'},
 {icon:ReceiptText,hint:'应发、扣款、到账逐项对齐'},
 {icon:Calculator,hint:'按全年工资薪金试算税额'},
 {icon:ShieldCheck,hint:'参保、就医和转移的办理路线'},
 {icon:House,hint:'看清押金、费用与退租约定'},
 {icon:HandCoins,hint:'广州政策样例，对照申领条件'},
 {icon:ArrowRightLeft,hint:'日期、交接与保障衔接台账'},
] as const;

export default function HomeTaskDirectory({selected,onOpen,onPreview}:{selected:number;onOpen:(index:number)=>void;onPreview:(index:number)=>void}){
 return <section className="home-directory" aria-labelledby="home-directory-title">
  <header className="home-directory-heading"><div><h2 id="home-directory-title">你现在想办什么？</h2><p>8 项工具，点击直接进入</p></div><p className="home-usage-tip"><Info size={14}/><span>本地工具体验<span> · 填写仅本次保留</span></span></p><div className="home-preview-control"><small>预览</small><button aria-label="上一个模块" onClick={()=>onPreview((selected+7)%8)}><ChevronLeft size={17}/></button><span>{EXPERIENCE_MODULES[selected]?.code??'01'}<small> / 08</small></span><button aria-label="下一个模块" onClick={()=>onPreview((selected+1)%8)}><ChevronRight size={17}/></button></div></header>
  <nav className="home-task-navigation" aria-label="八个事务模块">{EXPERIENCE_MODULES.map((module,index)=>{const Icon=entries[index].icon;return <button key={module.id} className="home-task-link" onClick={()=>onOpen(index)} aria-label={`打开${module.label}`} aria-current={selected===index?'true':undefined}><span className="home-task-number">{module.code}</span><Icon className="home-task-icon" size={20}/><span className="home-task-copy"><strong>{module.label}</strong><small>{entries[index].hint}</small></span><ArrowUpRight className="home-task-arrow" size={17}/></button>;})}</nav>
 </section>;
}

export function HomeBackdrop(){
 return <div className="home-backdrop" aria-hidden="true"><div className="home-backdrop-light"/><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none"><g className="home-survey-lines"><ellipse cx="1150" cy="370" rx="465" ry="252" transform="rotate(-12 1150 370)"/><ellipse cx="1150" cy="370" rx="515" ry="292" transform="rotate(-12 1150 370)"/><ellipse cx="1150" cy="370" rx="565" ry="332" transform="rotate(-12 1150 370)"/><path d="M620 258 1400 92M710 652l810-172M1114 90l155 565"/></g><g className="home-survey-ticks"><path d="M674 214h18m-9-9v18M1420 438h18m-9-9v18M1120 108h18m-9-9v18M750 594h18m-9-9v18"/><path d="M1427 185v92m-5-81h10m-10 16h10m-10 16h10m-10 16h10m-10 16h10"/></g></svg><span className="home-environment-caption">LIFE IN PROGRESS / CONNECTED TASKS</span></div>;
}
