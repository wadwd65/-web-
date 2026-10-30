import {useEffect,useRef} from 'react';
import {countAudit} from './performance-audit.ts';
/** Small compositor layers: no viewport-sized canvas, no idle animation loop. */
export default function PointerFeedback({enabled}:{enabled:boolean}){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const el=host.current;if(!el)return;const ring=el.querySelector<HTMLElement>('.pointer-reticle')!,sparks=[...el.querySelectorAll<HTMLElement>('.pointer-spark')],echoes=[...el.querySelectorAll<HTMLElement>('.pointer-echo')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(pointer:fine)'),events=new AbortController();
  let frame=0,lastSpark=0,sparkIndex=0,echoIndex=0,clicks=0,x=-100,y=-100,lastX=-100,lastY=-100,mode='off';const animations=new Map<HTMLElement,Animation>();
  function animate(node:HTMLElement,frames:Keyframe[],duration:number){animations.get(node)?.cancel();const animation=node.animate(frames,{duration,easing:'cubic-bezier(.16,.7,.3,1)'});animations.set(node,animation);animation.onfinish=()=>{if(animations.get(node)===animation)animations.delete(node);};}
  function hide(){mode='off';el!.dataset.mode='off';ring.style.opacity='0';cancelAnimationFrame(frame);frame=0;for(const animation of animations.values())animation.cancel();animations.clear();lastX=lastY=-100;}
  function draw(){frame=0;if(document.hidden)return hide();ring.style.transform=`translate3d(${x-12}px,${y-12}px,0) scale(${mode==='action'?1:.65})`;ring.style.opacity=mode==='action'?'.65':mode==='scene'?'.3':'0';el!.dataset.mode=mode;countAudit('pointerUpdates');
   const now=performance.now(),distance=Math.hypot(x-lastX,y-lastY);if(mode==='scene'&&lastX!==-100&&distance>5&&now-lastSpark>45){const node=sparks[sparkIndex++%sparks.length],dx=Math.max(-12,Math.min(12,(lastX-x)*.18)),dy=Math.max(-12,Math.min(12,(lastY-y)*.18));node.style.left=`${x}px`;node.style.top=`${y}px`;animate(node,[{transform:'translate3d(0,0,0) scale(1)',opacity:.45},{transform:`translate3d(${dx}px,${dy-9}px,0) scale(.3)`,opacity:0}],380);lastSpark=now;}lastX=x;lastY=y;
  }
  function move(e:PointerEvent){const target=e.target instanceof Element?e.target:null;if(!enabled||reduced.matches||!fine.matches||!target||document.querySelector('dialog[open]'))return hide();const action=target.closest<HTMLElement>('button,a,input,textarea,select');if(action?.matches('input,textarea,select,:disabled,[aria-disabled=true]'))return hide();mode=action?'action':target.closest('.experience-world')?'scene':'none';x=e.clientX;y=e.clientY;if(mode==='none')return hide();if(!frame)frame=requestAnimationFrame(draw);}
  window.addEventListener('pointermove',move,{passive:true,signal:events.signal});
  window.addEventListener('pointerdown',e=>{if(e.button||!enabled||mode==='off'||mode==='none'||document.querySelector('dialog[open]'))return;const target=e.target instanceof Element?e.target:null;if(target?.closest('input,textarea,select,:disabled,[aria-disabled=true]'))return;const node=echoes[echoIndex++%echoes.length];node.style.left=`${e.clientX-8}px`;node.style.top=`${e.clientY-8}px`;animate(node,[{transform:'scale(.45)',opacity:.55},{transform:'scale(2.8)',opacity:0}],360);el.dataset.clicks=String(++clicks);},{passive:true,signal:events.signal});
  window.addEventListener('blur',hide,{signal:events.signal});document.addEventListener('pointerleave',hide,{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},{signal:events.signal});window.addEventListener('keydown',e=>{if(e.key==='Tab')hide();},{signal:events.signal});reduced.addEventListener('change',hide,{signal:events.signal});fine.addEventListener('change',hide,{signal:events.signal});hide();return()=>{events.abort();hide();};
 },[enabled]);
 return <div className="pointer-feedback" ref={host} aria-hidden="true" data-mode="off"><i className="pointer-reticle"/>{Array.from({length:6},(_,i)=><i className="pointer-spark" key={i}/>)}{Array.from({length:2},(_,i)=><i className="pointer-echo" key={i}/>)}</div>;
}
