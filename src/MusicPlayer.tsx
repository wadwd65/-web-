import {lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {CSSProperties,KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowLeft,ArrowUpRight,ChevronLeft,ChevronRight,Disc3,Headphones,ListMusic,Pause,Play,Repeat,Repeat1,SkipBack,SkipForward,Volume2,VolumeX} from 'lucide-react';
import RhineMark from './RhineMark.tsx';
import {SOUNDTRACKS} from './Soundtrack.tsx';
import type {SoundtrackState} from './Soundtrack.tsx';
import {nextTrackIndex,playbackProgress} from './audio-visual.ts';
import {loadMusicScene} from './music-scene-loader.ts';
import {useMusicMode} from './useMusicMode.ts';
import type {MusicModePhase} from './music-mode.ts';
import {MUSIC_MODE_MOTION} from './music-mode.ts';
import {editionArtwork,musicEdition,warmArtworkAssets,MUSIC_ATMOSPHERES} from './music-artwork.ts';
import MusicSpectrum from './MusicSpectrum.tsx';
const ArchiveScene=lazy(loadMusicScene);
const time=(seconds:number)=>Number.isFinite(seconds)?`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`:'0:00';

function useMediaClock(state:SoundtrackState,open:boolean){
 const [clock,setClock]=useState({cid:state.track.cid,position:0,duration:state.track.duration});
 useEffect(()=>{
  if(!open)return;const audio=state.audio.current;
  const update=()=>setClock(previous=>{const position=state.position(),duration=audio?.getAttribute('src')&&Number.isFinite(audio.duration)?audio.duration:state.track.duration;return previous.cid===state.track.cid&&Math.abs(previous.position-position)<.02&&previous.duration===duration?previous:{cid:state.track.cid,position,duration};});
  update();const events=['timeupdate','durationchange','loadedmetadata','seeked','emptied'] as const;events.forEach(event=>audio?.addEventListener(event,update));return()=>events.forEach(event=>audio?.removeEventListener(event,update));
 },[open,state.audio,state.track]);
 const current=clock.cid===state.track.cid?clock:{cid:state.track.cid,position:state.position(),duration:state.track.duration};
 return {...current,seek:(position:number)=>{state.seek(position);setClock(value=>({...value,position}));}};
}

export default function MusicPlayer({state,open,onClose,returnLabel,returnPage,reduced,entryDetail=false,onModeChange}:{state:SoundtrackState;open:boolean;onClose:()=>void;returnLabel:string;returnPage:string;reduced:boolean;entryDetail?:boolean;onModeChange:(phase:MusicModePhase)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),heading=useRef<HTMLHeadingElement>(null),returnFocus=useRef<HTMLElement|null>(null),previous=useRef(state.index),lastVolume=useRef(state.volume||.28);
 const [candidate,setCandidate]=useState(state.index),[view,setView]=useState<'collection'|'detail'>('collection'),[hovered,setHovered]=useState(-1),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[sceneMounted,setSceneMounted]=useState(open);
 const mode=useMusicMode(open,reduced),clock=useMediaClock(state,mode.present),selected=SOUNDTRACKS[candidate],pending=candidate!==state.index,progress=playbackProgress(clock.position,clock.duration);
 const [artReady,setArtReady]=useState(false);
 useEffect(()=>{let alive=true;if(mode.present)void warmArtworkAssets().then(()=>{if(alive)setArtReady(true);});return()=>{alive=false;};},[mode.present]);
 useEffect(()=>onModeChange(mode.phase),[mode.phase,onModeChange]);
 useEffect(()=>{const warm=()=>setSceneMounted(true);window.addEventListener('first-step:music-warm',warm);return()=>window.removeEventListener('first-step:music-warm',warm);},[]);
 useEffect(()=>{if(mode.present)setSceneMounted(true);if(mode.phase==='preparing'&&ready)mode.markReady();},[mode.present,mode.phase,ready,mode.markReady]);
 const status=state.error?'音源暂不可用':state.loading?'正在加载':state.playing?'正在播放':state.started?'已暂停':'等待播放';
 useLayoutEffect(()=>{const prior=previous.current;previous.current=state.index;setCandidate(value=>value===prior?state.index:value);},[state.index]);
 useLayoutEffect(()=>{
  const el=dialog.current;if(!el)return;
  if(mode.present&&!el.open){returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCandidate(state.index);setView(entryDetail?'detail':'collection');setHovered(-1);el.showModal();heading.current?.focus({preventScroll:true});}
  else if(!mode.present&&el.open){el.close();requestAnimationFrame(()=>{const target=returnFocus.current?.closest('[inert]')?document.querySelector<HTMLElement>('.music-entry-open'):returnFocus.current;target?.focus({preventScroll:true});});}
 },[mode.present]);
 function exit(){if(open&&mode.phase!=='leaving')onClose();}
 function reveal(index:number){setCandidate(index);setView('detail');setHovered(-1);}
 function browse(direction:number){reveal(nextTrackIndex(candidate,direction,SOUNDTRACKS.length));}
 function step(direction:number){reveal(state.step(direction));}
 function playSelected(){if(!pending&&(state.playing||state.loading))state.toggle();else state.playTrack(candidate);}
 function listKey(event:ReactKeyboardEvent<HTMLButtonElement>,index:number){if(event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;event.preventDefault();const next=nextTrackIndex(index,event.key==='ArrowDown'?1:-1,SOUNDTRACKS.length);setCandidate(next);event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();}
 function mute(){if(state.volume){lastVolume.current=state.volume;state.setVolume(0);}else state.setVolume(lastVolume.current||.28);}
 function back(){if(mode.phase==='leaving')return;if(view==='detail'&&mode.interactive){setView('collection');setHovered(-1);}else exit();}
 useEffect(()=>{
  if(!mode.interactive)return;
  const key=(event:KeyboardEvent)=>{
   if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.target instanceof Element&&event.target.closest('input,button,a,select,textarea'))return;
   if(event.code==='Space'){event.preventDefault();state.toggle();}
   if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();const next=nextTrackIndex(candidate,event.key==='ArrowDown'?1:-1,SOUNDTRACKS.length);setCandidate(next);}
   if(event.key==='Enter'){event.preventDefault();view==='collection'?reveal(candidate):playSelected();}
   if(view==='detail'&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();clock.seek(Math.max(0,Math.min(clock.duration,clock.position+(event.key==='ArrowRight'?5:-5))));}
  };
  const el=dialog.current;el?.addEventListener('keydown',key);return()=>el?.removeEventListener('keydown',key);
 },[mode.interactive,candidate,view,state,clock]);
 const edition=musicEdition(candidate),previewIndex=hovered>=0?hovered:candidate,previewTrack=SOUNDTRACKS[previewIndex];
 return <dialog className="music-console" ref={dialog} aria-labelledby="music-console-title" onCancel={event=>{event.preventDefault();back();}} data-art-ready={artReady} data-view={view} data-mode-phase={mode.phase} data-reduced={mode.reduced} data-playing={state.playing} data-track={state.track.cid} data-selected={selected.cid} style={{'--music-enter':`${MUSIC_MODE_MOTION.enter}ms`,'--music-leave':`${MUSIC_MODE_MOTION.leave}ms`,'--edition-accent':edition.accent} as CSSProperties}>
  <div className="ma-environment" aria-hidden="true"><div className="ma-horizon"/><div className="ma-light-column"/></div>
  <header className="mc-header">
   <a className="mc-brand" href={`#/${returnPage}`} onClick={event=>{event.preventDefault();exit();}} aria-label={`返回${returnLabel}`}><RhineMark/><span>初程<small>FIRST STEP</small></span></a>
   <div className="ma-header-title"><h1 id="music-console-title" tabIndex={-1} ref={heading}>声音档案</h1><small>RHINE LAB / SOUND COLLECTION</small></div>
   <nav className="ma-view-nav" aria-label="音乐视图"><button onClick={()=>setView('collection')} aria-current={view==='collection'?'page':undefined}><small>01</small>曲目阵列</button><span>/</span><button onClick={()=>reveal(candidate)} aria-current={view==='detail'?'page':undefined}><small>02</small>聆听唱片</button></nav>
   <button className="mc-back" onClick={exit}><ArrowLeft size={15}/><span>返回{returnLabel}</span></button>
  </header>
  <main className="ma-world" inert={!mode.interactive}>
   <div className={`ma-spatial ${ready?'is-ready':''}`}>
    {sceneMounted&&!failed&&<Suspense fallback={null}><ArchiveScene selected={candidate} detail={view==='detail'} current={state.index} playing={state.playing} reduced={mode.reduced} enabled={mode.present} revealed={mode.phase==='entering'||mode.phase==='open'} preview={hovered} onPick={reveal} onHover={setHovered} onReady={()=>{setReady(true);mode.markReady();}} onFailure={()=>{setFailed(true);setReady(true);mode.markReady();}}/></Suspense>}
    {!ready&&<div className="ma-loading" role="status"><i/><span>正在装载声音档案</span><small>LOADING COLLECTION</small></div>}
    {failed&&<div className="ma-fallback"><Disc3 size={64}/><span>三维视图暂不可用</span><small>仍可通过曲目目录选歌与播放</small><button onClick={()=>{setFailed(false);setReady(false);}}>重试三维视图<ArrowUpRight size={13}/></button></div>}
    <div className="ma-scene-heading" aria-hidden="true"><i/><span>{view==='detail'?'OPTICAL RECORD / OPEN EDITION':'PHYSICAL COLLECTION / 05 EDITIONS'}</span><span>RHINE LAB</span></div>
    <div className="ma-scene-index" aria-hidden="true"><span>{String(previewIndex+1).padStart(2,'0')}<i> / 05</i></span><div><small>{musicEdition(previewIndex).word}</small><p>{previewTrack.name}</p></div></div>
    <div className="ma-spatial-tools"><span><i/>{view==='detail'?'拖动查看光学反射 · 滚轮缩放':'悬停唤起 · 点击抽取'}</span><span className="ma-atmosphere-name">SCENE / {MUSIC_ATMOSPHERES[candidate]}</span></div>
   </div>
   <aside className="ma-information">
    <section className="ma-collection" aria-hidden={view!=='collection'} inert={view!=='collection'} aria-label="曲目目录">
     <div className="ma-eyebrow"><span>SOUND COLLECTION</span><span>VOL. 01</span></div>
     <h2>让声音，<br/>有迹可循。</h2><p className="ma-collection-note">五张唱片，五种向远方的回响。</p>
     <div className="ma-list-head"><span>选择一张档案</span><span>01—05</span></div>
     <div className="ma-record-list">{SOUNDTRACKS.map((track,index)=><button key={track.cid} className="ma-record-row" aria-label={`展开曲目档案：${track.name}`} aria-pressed={candidate===index} data-hover={hovered===index} style={{'--row-accent':musicEdition(index).accent} as CSSProperties} onMouseEnter={()=>setHovered(index)} onMouseLeave={()=>setHovered(-1)} onFocus={()=>setHovered(index)} onBlur={()=>setHovered(-1)} onKeyDown={event=>listKey(event,index)} onClick={()=>reveal(index)}><span className="ma-row-number">{String(index+1).padStart(2,'0')}</span><img src={editionArtwork(index)} alt=""/><span className="ma-row-copy"><strong>{track.name}</strong><small>{track.note}</small></span>{state.index===index?<Headphones className="ma-playing-mark" size={13}/>:<ArrowUpRight className="ma-row-arrow" size={14}/>}<time>{time(track.duration)}</time></button>)}</div>
     <p className="ma-help"><span>浏览档案</span>不会打断当前音乐<ArrowUpRight size={12}/></p>
    </section>
    <section className="ma-detail" aria-hidden={view!=='detail'} inert={view!=='detail'} aria-label="所选唱片详情">
     <button className="ma-return-library" onClick={()=>setView('collection')}><ArrowLeft size={14}/>收回曲目阵列<span>ESC</span></button>
     <div className="ma-detail-copy" key={selected.cid}>
      <div className="ma-edition-heading"><img className="ma-cover" src={editionArtwork(candidate)} alt={`${selected.name}的场景主题盘面`}/><div><small>R / {String(candidate+1).padStart(2,'0')} — {edition.word}</small><span>{edition.mood}</span><em>明日方舟场景 / 主题重排</em></div></div>
      <h2>{selected.name}</h2><p className="ma-detail-note">{selected.note}</p>
      <div className="ma-facts"><span>{selected.artist}</span><i/><span>{time(selected.duration)}</span><i/><span>MSR / {selected.cid}</span></div>
      <p className="ma-mood-line">{edition.subtitle}</p>
      <button className="ma-play-selected" onClick={playSelected}><span className="ma-play-circle">{!pending&&(state.playing||state.loading)?<Pause size={20}/>:<Play size={20}/>}</span><span>{pending?'播放这张唱片':state.loading?'取消加载':state.playing?'暂停聆听':'开始聆听'}<small>{pending?'LOAD THIS EDITION':state.playing?'PAUSE RECORD':'PLAY RECORD'}</small></span><ArrowUpRight size={17}/></button>
      <div className="ma-selection-status" role="status"><i className={!pending&&state.playing?'is-live':''}/><span>{pending?`正在浏览 · 当前${state.playing?'播放':'曲目'}：${state.track.name}`:status}</span></div>
      <a className="ma-source" href={selected.page} target="_blank" rel="noreferrer">官方曲目来源<ArrowUpRight size={12}/></a>
     </div>
     <div className="ma-browse-records"><button onClick={()=>browse(-1)} aria-label="查看上一张唱片"><ChevronLeft size={17}/><span>上一张</span></button><span>{String(candidate+1).padStart(2,'0')}<i> / 05</i></span><button onClick={()=>browse(1)} aria-label="查看下一张唱片"><span>下一张</span><ChevronRight size={17}/></button></div>
    </section>
   </aside>
  </main>
  <section className="mc-transport" aria-label="音乐播放控制" inert={!mode.interactive}>
   <div className="mc-current-mini"><img src={editionArtwork(state.index)} alt=""/><div><small><i/>{state.playing?'NOW PLAYING':'READY TO LISTEN'} / {String(state.index+1).padStart(2,'0')}</small><strong>{state.track.name}</strong><span>{musicEdition(state.index).mood}</span></div></div>
   <div className="mc-player-core"><div className="mc-buttons"><button onClick={()=>state.setLoop(state.loop==='single'?'list':'single')} aria-label="切换音乐循环方式" title={state.loop==='single'?'单曲循环':'列表循环'}>{state.loop==='single'?<Repeat1 size={17}/>:<Repeat size={17}/>}</button><button onClick={()=>step(-1)} aria-label="上一首主题音乐"><SkipBack size={19}/></button><button className="mc-play" onClick={state.toggle} aria-label={state.loading?'取消音乐加载':state.playing?'暂停背景音乐':'播放背景音乐'}>{state.playing||state.loading?<Pause size={20}/>:<Play size={20}/>}</button><button onClick={()=>step(1)} aria-label="下一首主题音乐"><SkipForward size={19}/></button><button className="ma-queue" onClick={()=>setView('collection')} aria-label="返回音乐目录"><ListMusic size={18}/></button></div><div className="ma-seek-row"><time>{time(clock.position)}</time><div className="ma-progress" style={{'--played':`${progress*100}%`} as CSSProperties}><i/><input type="range" aria-label="音乐播放进度" aria-valuetext={`${time(clock.position)} / ${time(clock.duration)}`} min="0" max={clock.duration} step="0.1" value={Math.min(clock.position,clock.duration)} onChange={event=>clock.seek(Number(event.target.value))}/></div><time>{time(clock.duration)}</time></div></div>
   <MusicSpectrum state={state} active={mode.present} reduced={mode.reduced}/>
   <div className="mc-volume"><button onClick={mute} aria-label={state.volume===0?'取消静音':'静音'}>{state.volume===0?<VolumeX size={17}/>:<Volume2 size={17}/>}</button><input aria-label="背景音乐音量" type="range" min="0" max="1" step="0.01" value={state.volume} onChange={event=>state.setVolume(Number(event.target.value))}/><span>{Math.round(state.volume*100)}%</span></div>
  </section>
  <footer className="mc-system"><span><i/>{state.error||`${status} · ${state.source==='local'?'本地音源':'官方在线备用'}`}</span>{state.error?<button onClick={state.reload}>重试播放 ↗</button>:<span>R / {String(state.index+1).padStart(2,'0')} · {musicEdition(state.index).word}</span>}<a href="/credits/models.html" target="_blank" rel="noreferrer" aria-label="查看素材来源与鸣谢">素材鸣谢 ↗</a></footer>
 </dialog>;
}
