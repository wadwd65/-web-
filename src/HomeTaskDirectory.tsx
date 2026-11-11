import {ArrowUpRight,FolderOpen,ListChecks,MessageCircle} from 'lucide-react';

export default function HomeTaskDirectory({onAsk,onTools,onList,questionCount}:{onAsk:()=>void;onTools:()=>void;onList:()=>void;questionCount:number}){
 return <section className="home-directory" aria-labelledby="home-directory-title">
  <h2 id="home-directory-title" className="sr-only">选择使用方式</h2>
  <nav className="home-primary-navigation" aria-label="主要入口">
   <button className="home-ai-entry" onClick={onAsk}><span className="home-route-number">01</span><MessageCircle size={22}/><span><strong>直接问 AI</strong><small>不用先选工具，直接说问题</small></span><ArrowUpRight size={18}/></button>
   <button onClick={onTools}><span className="home-route-number">02</span><FolderOpen size={22}/><span><strong>工具列表 <em>08</em></strong><small>不用 AI，也能自己核对和计算</small></span><ArrowUpRight size={18}/></button>
   <button onClick={onList}><span className="home-route-number">03</span><ListChecks size={22}/><span><strong>询问清单 <em>{questionCount}</em></strong><small>留好要问的问题，带着清单去办</small></span><ArrowUpRight size={18}/></button>
  </nav>
 </section>;
}

export function HomeBackdrop(){
 return <div className="home-backdrop" aria-hidden="true"><div className="home-backdrop-light"/><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none"><g className="home-survey-lines"><ellipse cx="1150" cy="370" rx="465" ry="252" transform="rotate(-12 1150 370)"/><ellipse cx="1150" cy="370" rx="515" ry="292" transform="rotate(-12 1150 370)"/><ellipse cx="1150" cy="370" rx="565" ry="332" transform="rotate(-12 1150 370)"/><path d="M620 258 1400 92M710 652l810-172M1114 90l155 565"/></g><g className="home-survey-ticks"><path d="M674 214h18m-9-9v18M1420 438h18m-9-9v18M1120 108h18m-9-9v18M750 594h18m-9-9v18"/><path d="M1427 185v92m-5-81h10m-10 16h10m-10 16h10m-10 16h10m-10 16h10"/></g></svg><span className="home-environment-caption">LIFE IN PROGRESS / CONNECTED TASKS</span></div>;
}
