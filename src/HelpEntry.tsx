import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,ArrowRight,Check,ChevronDown,CircleHelp,Compass,ShieldCheck,X} from 'lucide-react';
import type {WorkspacePage} from './experience-modules.ts';
import {stepsFor} from './lib/usage-tour.ts';
import {placeTourCard} from './tour-layout.ts';
import type {TourRect} from './tour-layout.ts';


function GuidedTour({page,hasScene,view,onClose}:{page:WorkspacePage;hasScene:boolean;view:'material'|'result';onClose:()=>void}){
 const steps=useRef(stepsFor(page,hasScene,view)).current,[index,setIndex]=useState(0),[target,setTarget]=useState<TourRect|null>(null),[viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight}),[cardSize,setCardSize]=useState({width:352,height:280});
 const dialog=useRef<HTMLDialogElement>(null),card=useRef<HTMLElement>(null),id=useId(),step=steps[index];
 function close(){dialog.current?.close();onClose();}
 useLayoutEffect(()=>{const d=dialog.current!,workspace=document.querySelector<HTMLElement>('.experience-workspace'),saved=workspace?{top:workspace.scrollTop,left:workspace.scrollLeft}:null;d.showModal();return()=>{d.close();if(workspace&&saved)workspace.scrollTo({...saved,behavior:'instant'});};},[]);
 useLayoutEffect(()=>{
  const events=new AbortController();let frame=0;const ro=new ResizeObserver(schedule);
  function measure(){
   frame=0;const width=window.innerWidth,height=window.innerHeight;setViewport(old=>old.width===width&&old.height===height?old:{width,height});
   let nodes=(step.selectors??[]).flatMap(selector=>[...document.querySelectorAll<HTMLElement>(selector)]).filter(e=>!e.closest('[inert],[aria-hidden="true"]')&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden');
   if(step.firstTarget)nodes=nodes.slice(0,1);
   let next:TourRect|null=null;
   if(nodes.length){
    const rects=nodes.map(e=>e.getBoundingClientRect()),left=Math.max(8,Math.min(...rects.map(r=>r.left))-8),top=Math.max(8,Math.min(...rects.map(r=>r.top))-8),right=Math.min(width-8,Math.max(...rects.map(r=>r.right))+8),bottom=Math.min(height-8,Math.max(...rects.map(r=>r.bottom))+8);
    if(right>left&&bottom>top)next=step.scene?{left:width*.46,top:height*.2,width:width*.51,height:height*.52}:{left,top,width:right-left,height:bottom-top};
   }
   setTarget(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
   const r=card.current?.getBoundingClientRect();if(r)setCardSize(old=>old.width===r.width&&old.height===r.height?old:{width:r.width,height:r.height});
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(measure);}
  if(step.scrollTarget){const targets=(step.selectors??[]).flatMap(selector=>[...document.querySelectorAll<HTMLElement>(selector)]).filter(e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden');targets[0]?.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});}
  measure();for(const selector of step.selectors??[])document.querySelectorAll(selector).forEach(e=>ro.observe(e));if(card.current)ro.observe(card.current);
  const settle=setTimeout(schedule,600);
  window.addEventListener('resize',schedule,{signal:events.signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal:events.signal});window.addEventListener('animationend',schedule,{capture:true,signal:events.signal});window.addEventListener('transitionend',schedule,{capture:true,signal:events.signal});card.current?.focus({preventScroll:true});
  return()=>{events.abort();ro.disconnect();clearTimeout(settle);cancelAnimationFrame(frame);};
 },[step]);
 const position=placeTourCard(target,viewport,cardSize),spot=target??{left:0,top:0,width:0,height:0};
 return createPortal(<dialog ref={dialog} className="guided-tour" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();setIndex(value=>Math.max(0,Math.min(steps.length-1,value+(e.key==='ArrowRight'?1:-1))));}}}>
  {target?<><div className="tour-shade" style={{left:0,top:0,width:'100%',height:spot.top}} onClick={close}/><div className="tour-shade" style={{left:0,top:spot.top,width:spot.left,height:spot.height}} onClick={close}/><div className="tour-shade" style={{left:spot.left+spot.width,top:spot.top,right:0,height:spot.height}} onClick={close}/><div className="tour-shade" style={{left:0,top:spot.top+spot.height,bottom:0,width:'100%'}} onClick={close}/><div className="tour-highlight" aria-hidden="true" style={{left:spot.left,top:spot.top,width:spot.width,height:spot.height}}><i/><i/><i/><i/></div></>:<div className="tour-shade tour-shade-all" onClick={close}/>}
  <article className="tour-card" ref={card} tabIndex={-1} style={position}>
   <header><span><Compass size={14}/>使用引导</span><button onClick={close} aria-label="关闭使用引导"><X size={17}/></button></header>
   <div className="tour-copy" key={step.id}><small>{String(index+1).padStart(2,'0')} / {String(steps.length).padStart(2,'0')}</small><h2 id={`${id}-title`}>{step.title}</h2><p id={`${id}-text`}>{step.text}</p><div className="tour-hint"><i/>{step.hint}</div></div>
   <footer><div className="tour-progress" aria-label={`第${index+1}步，共${steps.length}步`}>{steps.map((item,n)=><i key={item.id} data-current={n===index} data-done={n<index}/>)}</div><div>{index>0&&<button className="tour-back" onClick={()=>setIndex(value=>value-1)}><ArrowLeft size={14}/>上一步</button>}<button className="tour-next" onClick={()=>index===steps.length-1?close():setIndex(value=>value+1)}>{index===steps.length-1?'完成引导':'下一步'}{index===steps.length-1?<Check size={15}/>:<ArrowRight size={15}/>}</button></div></footer>
   <p className="tour-exit-note">随时按 Esc 退出，问号里可以重新打开</p>
  </article>
 </dialog>,document.body);
}

export default function HelpEntry({page,hasScene,view='material',openSources,onTourVisibility}:{page:WorkspacePage;hasScene:boolean;view?:'material'|'result';openSources:()=>void;onTourVisibility:(open:boolean)=>void}){
 const [open,setOpen]=useState(false),[tour,setTour]=useState(false),host=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{setOpen(false);setTour(false);},[page]);
 useEffect(()=>{onTourVisibility(tour);return()=>onTourVisibility(false);},[tour,onTourVisibility]);
 useEffect(()=>{if(!open)return;const events=new AbortController();document.addEventListener('pointerdown',e=>{if(!host.current?.contains(e.target as Node))setOpen(false);},{signal:events.signal});host.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();return()=>events.abort();},[open]);
 function finish(){setTour(false);trigger.current?.focus({preventScroll:true});}
 return <><div ref={host} className="help-entry" onBlur={e=>{if(open&&!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(!open&&e.target===trigger.current&&e.key==='ArrowDown'){e.preventDefault();setOpen(true);return;}if(open&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.stopPropagation();return;}if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}else if(open&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...host.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]')],current=items.indexOf(document.activeElement as HTMLButtonElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(current+(e.key==='ArrowDown'?1:items.length-1))%items.length;items[next]?.focus();}}}>
  <button ref={trigger} className="home-help-entry" aria-label="使用说明" title="使用说明" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><CircleHelp size={17}/><span>使用说明</span><ChevronDown size={11}/></button>
  {open&&<div id={id} className="help-menu" role="menu" aria-label="使用说明选项"><small>第一次来？从这里看看</small><button role="menuitem" onClick={()=>{setOpen(false);setTour(true);}}><Compass size={20}/><span><strong>查看引导</strong><small>看一遍界面与操作</small></span><ArrowRight size={15}/></button><button role="menuitem" onClick={()=>{setOpen(false);openSources();}}><ShieldCheck size={20}/><span><strong>你能做什么</strong><small>功能范围、来源与使用限制</small></span><ArrowRight size={15}/></button></div>}
 </div>{tour&&<GuidedTour page={page} hasScene={hasScene} view={view} onClose={finish}/>}</>;
}
