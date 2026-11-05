import {useState} from 'react';
import {ArrowRightLeft,ArrowUp,ArrowUpRight,BriefcaseBusiness,Calculator,FileCheck2,HandCoins,House,ReceiptText,ShieldCheck} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';
import type {ExperiencePage} from './experience-modules.ts';

const icons=[BriefcaseBusiness,FileCheck2,ReceiptText,Calculator,ShieldCheck,House,HandCoins,ArrowRightLeft];
const copy={
 offer:{title:'比较几份 offer',description:'把薪资、周期和生活预算放在一起看'},
 contract:{title:'看看劳动合同',description:'找到要确认的条款和对应原文'},
 salary:{title:'算到手工资',description:'减去个人扣款，看看实发对不对'},
 tax:{title:'试算工资个税',description:'按已知全年金额做限定试算'},
 social:{title:'弄清社保怎么办',description:'按当前情况找办理路线'},
 rent:{title:'看看租房约定',description:'核对押金、费用与合同文字'},
 subsidy:{title:'看看补贴条件',description:'广州求职创业补贴样例'},
 leaving:{title:'整理离职交接',description:'记好交接事项与办理进度'},
};

export default function ToolDirectory({go,onAsk}:{go:(page:ExperiencePage)=>void;onAsk:(text?:string)=>void}){
 const [question,setQuestion]=useState('');
 return <div className="tool-directory-page">
  <header><h1>想弄清哪件事？</h1><p>选一个工具直接用，也可以把事情写下来。</p></header>
  <form className="tool-directory-question" onSubmit={event=>{event.preventDefault();if(!question.trim())return;onAsk(question.trim());setQuestion('');}}>
   <label className="sr-only" htmlFor="tool-question">从工具页直接提问</label>
   <textarea id="tool-question" rows={1} maxLength={6000} value={question} onChange={event=>setQuestion(event.target.value)} placeholder="还不知道从哪开始？说说你遇到的事…" onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}}/>
   <button type="submit" disabled={!question.trim()} aria-label="发送工具页问题"><span>问一问</span><ArrowUp size={17}/></button>
  </form>
  <nav className="tool-directory-list" aria-label="八项办事工具">
   {EXPERIENCE_MODULES.map((item,index)=>{const Icon=icons[index];const entry=copy[item.id];return <button key={item.id} onClick={()=>go(item.id)} aria-label={`打开${item.label}`}>
    <span className="tool-directory-icon"><Icon size={21}/></span><span className="tool-directory-copy"><strong>{entry.title}</strong><span>{entry.description}</span></span><span className="tool-directory-open">开始<ArrowUpRight size={15}/></span>
   </button>;})}
  </nav>
 </div>;
}
