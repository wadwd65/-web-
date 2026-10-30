import {useEffect,useId,useRef,useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Check,ChevronDown,Pause,Play,SkipForward,X} from 'lucide-react';
import type {SoundtrackState} from './Soundtrack.tsx';
import tracks from '../public/audio/catalog.json';

const duration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;

/** A small non-modal song menu. It reuses the existing audio and never navigates
 * or warms the three-dimensional player. Native popover supplies light-dismiss. */
export default function MusicQuickPicker({state,contextKey}:{state:SoundtrackState;contextKey:string}){
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),popupId=useId(),titleId=useId();
 const [open,setOpen]=useState(false),current=useRef(state.index);current.current=state.index;
 function position(){const anchor=trigger.current,el=panel.current;if(!anchor||!el)return;const r=anchor.getBoundingClientRect(),width=Math.min(330,innerWidth-32);el.style.setProperty('--picker-left',`${Math.max(16,Math.min(innerWidth-width-16,r.right-width+10))}px`);el.style.setProperty('--picker-top',`${Math.max(16,r.bottom+12)}px`);}
 function hide(restore=false){const el=panel.current;if(el?.matches(':popover-open'))el.hidePopover();if(restore)trigger.current?.focus({preventScroll:true});}
 function toggle(){const el=panel.current;if(!el)return;if(el.matches(':popover-open'))hide();else{position();el.showPopover();}}
 useEffect(()=>{const el=panel.current;if(!el)return;const update=(event:Event)=>{const shown=(event as ToggleEvent).newState==='open';setOpen(shown);if(shown){position();el.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')[current.current]?.focus({preventScroll:true});}};el.addEventListener('toggle',update);return()=>el.removeEventListener('toggle',update);},[]);
 useEffect(()=>{hide();},[contextKey]);
 useEffect(()=>{if(!open)return;window.addEventListener('resize',position);window.addEventListener('scroll',position,true);return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};},[open]);
 function pick(index:number){state.playTrack(index);hide(true);}
 function key(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide(true);return;}
  if(!['ArrowDown','ArrowUp','Home','End','ArrowLeft','ArrowRight'].includes(event.key))return;
  event.stopPropagation();if(event.key==='ArrowLeft'||event.key==='ArrowRight')return;event.preventDefault();const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);let next=event.key==='Home'?0:event.key==='End'?buttons.length-1:index<0?(event.key==='ArrowUp'?buttons.length-1:0):(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();
 }
 return <div className="music-quick-picker">
  <button ref={trigger} className="music-entry-next" popoverTarget={popupId} popoverTargetAction="toggle" onClick={position} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();event.stopPropagation();if(!open)toggle();}else if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();hide(true);}}} aria-label="在当前页面选择音乐" aria-haspopup="menu" aria-controls={popupId} aria-expanded={open} title="切歌 · 就地选曲"><SkipForward size={15}/><span>切歌</span><ChevronDown className="music-picker-chevron" size={11}/></button>
  <div ref={panel} id={popupId} popover="auto" className="music-picker" aria-labelledby={titleId} onKeyDown={key} onBlur={event=>{const next=event.relatedTarget;if(next instanceof Node&&!event.currentTarget.contains(next)&&!trigger.current?.contains(next))hide();}}>
   <header><div><small>SOUND / QUICK SELECT</small><h2 id={titleId}>切换音乐<span>05</span></h2></div><button className="music-picker-close" onClick={()=>hide(true)} aria-label="关闭选曲菜单"><X size={15}/></button></header>
   <div className="music-picker-list" role="menu" aria-label="选择背景音乐">{tracks.map((track,index)=><button key={track.cid} role="menuitemradio" aria-checked={state.index===index} onClick={()=>pick(index)}><span className="music-picker-number">{String(index+1).padStart(2,'0')}</span><span className="music-picker-copy"><strong>{track.name}</strong><small>{track.note}</small></span><time>{duration(track.duration)}</time><span className="music-picker-mark">{state.index===index?<Check size={13}/>:<Play size={11}/>}</span></button>)}</div>
   <footer><span>点选即播 · 停留当前页面</span><button onClick={state.toggle} aria-label={state.playing||state.loading?'暂停当前音乐':'播放当前音乐'}>{state.playing||state.loading?<Pause size={13}/>:<Play size={13}/>}<span>{state.loading?'取消加载':state.playing?'暂停':'播放'}</span></button></footer>
   <p className={`music-picker-status ${state.error?'has-error':''}`} role="status">{state.error||`${state.playing?'正在播放':state.loading?'正在加载':'当前曲目'} · ${state.track.name}`}{state.error&&<button onClick={state.reload}>重试</button>}</p>
  </div>
 </div>;
}
