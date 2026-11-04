import {useEffect,useRef,useState} from 'react';
import RhineMark from './RhineMark.tsx';
import {createEntrySequence} from './entry-sequence.ts';

/** A persistent title screen. Only an explicit start consumes the opening sequence. */
export default function ExperienceEntry({ready,onComplete,onReveal,staticMode=false,onMusicToggle,musicPlaying=false}:{ready:boolean;onComplete:()=>void;onReveal:()=>void;staticMode?:boolean;onMusicToggle:()=>void;musicPlaying?:boolean}){
 const [sequence]=useState(()=>createEntrySequence(staticMode||matchMedia('(prefers-reduced-motion: reduce)').matches));
 const [view,setView]=useState(sequence.state),[started,setStarted]=useState(false);
 const callbacks=useRef({onComplete,onReveal,ready}),finished=useRef(false),revealed=useRef(false),startButton=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 callbacks.current={onComplete,onReveal,ready};
 function finish(){if(finished.current)return;finished.current=true;if(!revealed.current){revealed.current=true;callbacks.current.onReveal();}callbacks.current.onComplete();}
 function start(){if(sequence.state().requested)return;setView(sequence.start());setStarted(true);panel.current?.focus();}
 function skip(){sequence.skip();finish();}
 useEffect(()=>{
  startButton.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();skip();return;}
   if(event.key==='Enter'&&!event.repeat&&event.target===panel.current){event.preventDefault();start();return;}
   if(event.key==='Tab'){
    const controls=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([hidden])')??[]).filter(el=>el.getClientRects().length>0&&!el.closest('[inert]'));
    if(!controls.length){event.preventDefault();return;}
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  window.addEventListener('keydown',key,{capture:true});return()=>window.removeEventListener('keydown',key,{capture:true});
 },[]);
 useEffect(()=>{
  if(!started)return;
  // CSS and Three animate themselves; the discrete phase clock needs only 20Hz.
  let timer=0,last=performance.now();
  function tick(){
   const now=performance.now();
   const next=sequence.advance(now-last,callbacks.current.ready,!document.hidden);last=now;
   setView(previous=>previous.phase===next.phase&&previous.reveal===next.reveal&&previous.completed===next.completed?previous:next);
   if(next.reveal&&!revealed.current){revealed.current=true;callbacks.current.onReveal();}
   if(next.completed){finish();return;}
   timer=window.setTimeout(tick,50);
  }
  function visibility(){clearTimeout(timer);last=performance.now();if(!document.hidden)timer=window.setTimeout(tick,0);}
  if(!document.hidden)timer=window.setTimeout(tick,0);document.addEventListener('visibilitychange',visibility);
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);};
 },[started,sequence]);
 return <div ref={panel} className={`experience-entry ee-phase-${view.phase} ${started?'ee-started':'ee-waiting'}`} data-entry-state={started?(ready?'playing':'preparing'):'waiting'} role="dialog" aria-modal="true" aria-labelledby="experience-entry-title" tabIndex={-1}>
  <div className="ee-curtain ee-curtain-left" aria-hidden="true"/><div className="ee-curtain ee-curtain-right" aria-hidden="true"/>
  <div className="ee-orbit" aria-hidden="true"><i/><i/><i/><span>＋</span><span>−</span></div>
  <header><span>莱茵生命 / RHINE LAB</span><span>FIRST STEP — LIFE IN PROGRESS</span></header>
  <div className="ee-message"><small>EVERY JOURNEY BEGINS SOMEWHERE.</small><h1 id="experience-entry-title">世界展开。<span>下一程，由此开始。</span></h1><div className="ee-signature" aria-hidden="true"><RhineMark/><span>FIRST STEP</span><i/></div>
   <div className="ee-start-control"><button ref={startButton} className="ee-start-button" onClick={start} disabled={started}><span>点击进入<small>ENTER FIRST STEP</small></span><i aria-hidden="true">↗</i></button><p role="status">{started?(ready?'正在展开界面…':'正在准备空间，请稍候…'):'准备好时，点击或按 Enter 开始'}</p></div>
  </div>
  <div className="ee-task-sequence" aria-hidden="true"><span>01—02 / 看清约定</span><span>03—05 / 理解工作</span><span>06—08 / 安顿生活</span></div><div className="ee-register" aria-hidden="true"><span>01 / 08</span><i/><span>CHOICE — AGREEMENT — EARNINGS — LIFE</span></div>
  <footer inert={view.phase>=3} aria-hidden={view.phase>=3||undefined}><div><span><i/>{ready?'空间已就绪':'正在准备三维空间'}</span><small>8 个模块 / 本地工具与办理导航</small></div><div className="ee-entry-actions"><button onClick={onMusicToggle} aria-pressed={musicPlaying}>{musicPlaying?'主题音乐已开启':'开启主题音乐'}<span>♪</span></button><button onClick={skip}>{started?'跳过动画':'直接进入'}<span>ESC ↗</span></button></div></footer>
 </div>;
}
