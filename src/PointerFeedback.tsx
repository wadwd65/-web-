import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {countAudit} from './performance-audit.ts';

/** One pooled layer. React owns its children; the stable portal host can move
 * into native dialogs and popovers without duplicating listeners or renderers. */
export default function PointerFeedback({enabled}:{enabled:boolean}){
 const [host]=useState(()=>{const node=document.createElement('div');node.className='pointer-feedback';node.setAttribute('aria-hidden','true');node.dataset.mode='off';return node;});
 useEffect(()=>{
  if(!enabled)return;
  document.body.append(host);
  const ring=host.querySelector<HTMLElement>('.pointer-reticle')!,sparks=[...host.querySelectorAll<HTMLElement>('.pointer-spark')],echoes=[...host.querySelectorAll<HTMLElement>('.pointer-echo')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController(),animations=new Map<HTMLElement,Animation>();
  let frame=0,lastSpark=0,sparkIndex=0,echoIndex=0,x=-100,y=-100,lastX=-100,lastY=-100,mode='off';
  function animate(node:HTMLElement,frames:Keyframe[],duration:number){animations.get(node)?.cancel();node.dataset.active='true';const animation=node.animate(frames,{duration,easing:'cubic-bezier(.16,.7,.3,1)'});animations.set(node,animation);animation.onfinish=()=>{if(animations.get(node)===animation){animations.delete(node);delete node.dataset.active;}};}
  function hide(){mode='off';host.dataset.mode='off';ring.style.opacity='0';cancelAnimationFrame(frame);frame=0;for(const [node,animation] of animations){animation.cancel();delete node.dataset.active;}animations.clear();lastX=lastY=-100;}
  function eligible(event:PointerEvent){const target=event.target instanceof Element?event.target:null;return !reduced.matches&&event.pointerType!=='touch'&&target&&!target.closest('input,textarea,select,[contenteditable=true],[role=textbox],:disabled,[aria-disabled=true]')?target:null;}
  function surface(target:Element){const layer=target.closest('dialog[open],[popover]:popover-open')??document.body;if(host.parentElement!==layer){hide();layer.append(host);}host.dataset.surface=layer.classList.contains('music-console')?'music':layer===document.body?'page':'popup';mode=target.closest('button,a,summary,[role=button],[role=menuitemradio]')?'action':target.closest('.experience-world')?'scene':'ambient';}
  function local(clientX:number,clientY:number){const rect=host.getBoundingClientRect();return {x:clientX-rect.left,y:clientY-rect.top};}
  function draw(){frame=0;if(document.hidden)return hide();const point=local(x,y);ring.style.transform=`translate3d(${point.x-12}px,${point.y-12}px,0) scale(${mode==='action'?1.15:mode==='scene'?.85:.6})`;ring.style.opacity=mode==='action'?'.8':'.48';host.dataset.mode=mode;countAudit('pointerUpdates');
   const now=performance.now(),distance=Math.hypot(x-lastX,y-lastY);if(lastX!==-100&&distance>5&&now-lastSpark>45){const node=sparks[sparkIndex++%sparks.length],dx=Math.max(-15,Math.min(15,(lastX-x)*.2)),dy=Math.max(-15,Math.min(15,(lastY-y)*.2));node.style.left=`${point.x}px`;node.style.top=`${point.y}px`;animate(node,[{transform:'translate3d(0,0,0) scale(1)',opacity:.65},{transform:`translate3d(${dx}px,${dy-10}px,0) scale(.2)`,opacity:0}],450);lastSpark=now;}lastX=x;lastY=y;
  }
  window.addEventListener('pointermove',event=>{const target=eligible(event);if(!target)return hide();surface(target);x=event.clientX;y=event.clientY;if(!frame)frame=requestAnimationFrame(draw);},{passive:true,signal:events.signal});
  window.addEventListener('pointerdown',event=>{if(event.button)return;const target=eligible(event);if(!target)return hide();surface(target);host.dataset.mode=mode;const point=local(event.clientX,event.clientY),echo=echoes[echoIndex++%echoes.length];echo.style.left=`${point.x-14}px`;echo.style.top=`${point.y-14}px`;animate(echo,[{transform:'scale(.3)',opacity:.95},{transform:'scale(1.25)',opacity:.65,offset:.35},{transform:'scale(2.7)',opacity:0}],650);host.dataset.clicks=String(Number(host.dataset.clicks??0)+1);for(let i=0;i<4;i++){const node=sparks[sparkIndex++%sparks.length],angle=i*Math.PI/2+Math.PI/4;node.style.left=`${point.x}px`;node.style.top=`${point.y}px`;animate(node,[{transform:'translate3d(0,0,0) scale(1.3)',opacity:.9},{transform:`translate3d(${Math.cos(angle)*26}px,${Math.sin(angle)*26}px,0) scale(.3)`,opacity:0}],500);}},{passive:true,signal:events.signal});
  window.addEventListener('scroll',hide,{capture:true,passive:true,signal:events.signal});window.addEventListener('blur',hide,{signal:events.signal});document.addEventListener('pointerleave',hide,{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},{signal:events.signal});window.addEventListener('keydown',event=>{if(event.key==='Tab')hide();},{signal:events.signal});reduced.addEventListener('change',hide,{signal:events.signal});
  return()=>{events.abort();reduced.removeEventListener('change',hide);hide();host.remove();};
 },[enabled,host]);
 return createPortal(<><i className="pointer-reticle"/>{Array.from({length:6},(_,index)=><i className="pointer-spark" key={`spark-${index}`}/>)}{Array.from({length:4},(_,index)=><i className="pointer-echo" key={`echo-${index}`}/>)}</>,host);
}
