import {ArrowRightLeft,ArrowUpRight,BriefcaseBusiness,Calculator,FileCheck2,HandCoins,House,ReceiptText,ShieldCheck} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';
import type {ExperiencePage} from './experience-modules.ts';

const icons=[BriefcaseBusiness,FileCheck2,ReceiptText,Calculator,ShieldCheck,House,HandCoins,ArrowRightLeft];
export default function ToolDirectory({go,onAsk}:{go:(page:ExperiencePage)=>void;onAsk:()=>void}){
 return <div className="tool-directory-page">
  <header><div className="eyebrow">TOOLS / 08</div><h1>选择要办的事</h1><p>不用和 AI 对话，直接填入已知信息，也能核对和计算。</p></header>
  <nav className="tool-directory-list" aria-label="八项办事工具">{EXPERIENCE_MODULES.map((item,index)=>{const Icon=icons[index];return <button key={item.id} onClick={()=>go(item.id)} aria-label={`打开${item.label}`}><span className="tool-directory-number">{item.code}</span><Icon size={23}/><span className="tool-directory-copy"><strong>{item.label}<small>{item.phase}</small></strong><span>{item.description}</span><small>准备：{item.input}</small></span><ArrowUpRight size={20}/></button>;})}</nav>
  <footer><span>不知道该选哪一项？把情况说给助手听。</span><button onClick={onAsk}>直接问 AI<ArrowUpRight size={15}/></button></footer>
 </div>;
}
