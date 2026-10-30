import {useEffect,useRef,useState} from 'react';
import RhineMark from './RhineMark.tsx';

/** An editorial opening sequence; the real space is prepared underneath. */
export default function ExperienceEntry({ready,onComplete,staticMode=false,onMusicToggle,musicPlaying=false}:{ready:boolean;onComplete:()=>void;staticMode?:boolean;onMusicToggle:()=>void;musicPlaying?:boolean}){
  const [phase,setPhase]=useState(0),complete=useRef(onComplete),finished=useRef(false),skip=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  complete.current=onComplete;
  function finish(){if(!finished.current){finished.current=true;complete.current();}}
  useEffect(()=>{
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');skip.current?.focus();
    const timers=(reduced.matches||staticMode)?[setTimeout(finish,0)]:[setTimeout(()=>setPhase(1),200),setTimeout(()=>setPhase(2),1100),setTimeout(()=>setPhase(3),2350),setTimeout(()=>setPhase(4),3500),setTimeout(finish,6500)];
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();finish();}if(event.key==='Tab'){const controls=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button')??[]);const first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}};
    window.addEventListener('keydown',key,{capture:true});return()=>{timers.forEach(clearTimeout);window.removeEventListener('keydown',key,{capture:true});};
  },[]);
  useEffect(()=>{if(phase>=4){const timer=setTimeout(finish,ready?400:1000);return()=>clearTimeout(timer);}},[phase,ready]);
  return <div ref={panel} className={`experience-entry ee-phase-${phase}`} role="dialog" aria-modal="true" aria-labelledby="experience-entry-title">
    <div className="ee-curtain ee-curtain-left" aria-hidden="true"/><div className="ee-curtain ee-curtain-right" aria-hidden="true"/>
    <div className="ee-orbit" aria-hidden="true"><i/><i/><i/><span>＋</span><span>−</span></div>
    <header><span>莱茵生命 / RHINE LAB</span><span>FIRST STEP — LIFE IN PROGRESS</span></header>
    <div className="ee-message"><small>EVERY JOURNEY BEGINS SOMEWHERE.</small><h1 id="experience-entry-title">世界展开。<span>下一程，由此开始。</span></h1><div className="ee-signature" aria-hidden="true"><RhineMark/><span>FIRST STEP</span><i/></div></div>
    <div className="ee-task-sequence" aria-hidden="true"><span>01—02 / 看清约定</span><span>03—05 / 理解工作</span><span>06—08 / 安顿生活</span></div><div className="ee-register" aria-hidden="true"><span>01 / 08</span><i/><span>CHOICE — AGREEMENT — EARNINGS — LIFE</span></div>
    <footer><div><span><i/>{ready?'空间已就绪':'正在准备三维空间'}</span><small>界面入场 / 8 个模块 / 本地工具与办理导航</small></div><div className="ee-entry-actions"><button onClick={onMusicToggle} aria-pressed={musicPlaying}>{musicPlaying?'主题音乐已开启':'开启主题音乐'}<span>♪</span></button><button ref={skip} onClick={finish}>跳过入场<span>ESC ↗</span></button></div></footer>
  </div>;
}
