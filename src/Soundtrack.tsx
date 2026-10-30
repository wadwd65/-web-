import {useEffect,useRef,useState} from 'react';
import {ListMusic} from 'lucide-react';
import {nextTrackIndex} from './audio-visual.ts';
import {warmMusicScene} from './music-scene-loader.ts';
import catalog from '../public/audio/catalog.json';
import MusicQuickPicker from './MusicQuickPicker.tsx';
export const SOUNDTRACKS=catalog;
type AudioGraph={context:AudioContext;source:MediaElementAudioSourceNode;analyser:AnalyserNode};
const STORE='first-step:music:v1';
function preferences(){try{const value=JSON.parse(localStorage.getItem(STORE)??'{}');return {index:Math.max(0,SOUNDTRACKS.findIndex(t=>t.cid===value.cid)),volume:typeof value.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):.28,loop:value.loop==='list'?'list' as const:'single' as const};}catch{return {index:0,volume:.28,loop:'single' as const};}}
/** One persistent audio element. Selecting a paused track does not fetch or decode it. */
export function useSoundtrack({working}:{working:boolean;entering:boolean}){
 const [initial]=useState(preferences),[index,setIndex]=useState(initial.index),[volume,setVolume]=useState(initial.volume),[loop,setLoop]=useState<'single'|'list'>(initial.loop),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[source,setSource]=useState<'local'|'online'>('local'),[started,setStarted]=useState(false);
 const graph=useRef<AudioGraph|null>(null),analyser=useRef<AnalyserNode|null>(null);
 const [analysisStatus,setAnalysisStatus]=useState<'idle'|'ready'|'unavailable'>('idle');
 const audio=useRef<HTMLAudioElement>(null),engine=useRef({index:initial.index,requested:false,generation:0,loadedCid:'',online:false,suspended:false,controller:null as AbortController|null,times:new Map<string,number>()}),fade=useRef(0),mode=useRef({working,volume});mode.current={working,volume};const track=SOUNDTRACKS[index];
 function ensureGraph(){
  if(graph.current)return graph.current;
  if(typeof AudioContext==='undefined'){setAnalysisStatus('unavailable');return null;}
  let context:AudioContext|null=null,source:MediaElementAudioSourceNode|null=null;
  try{context=new AudioContext();const scope=context.createAnalyser();scope.fftSize=1024;scope.smoothingTimeConstant=.65;source=context.createMediaElementSource(audio.current!);source.connect(scope);scope.connect(context.destination);graph.current={context,source,analyser:scope};analyser.current=scope;setAnalysisStatus('ready');return graph.current;}
  catch{if(source&&context){source.connect(context.destination);graph.current={context,source,analyser:context.createAnalyser()};}else void context?.close().catch(()=>{});setAnalysisStatus('unavailable');return graph.current;}
 }
 function targetVolume(){return mode.current.volume*(mode.current.working?.62:1);}
 function fadeVolume(){cancelAnimationFrame(fade.current);const el=audio.current;if(!el)return;const target=targetVolume();if(el.paused||document.hidden){el.volume=target;return;}const from=el.volume,began=performance.now();const step=(now:number)=>{if(el.paused||document.hidden)return;const t=Math.min(1,(now-began)/300);el.volume=from+(target-from)*t*(2-t);if(t<1)fade.current=requestAnimationFrame(step);};fade.current=requestAnimationFrame(step);}
 function remember(){const el=audio.current,e=engine.current;if(el&&e.loadedCid&&Number.isFinite(el.currentTime)&&el.currentTime>0)e.times.set(e.loadedCid,el.currentTime);}
 async function play(generation=engine.current.generation){const el=audio.current,e=engine.current;if(!el||!e.requested||document.hidden||generation!==e.generation)return;try{el.volume=targetVolume();const sound=ensureGraph();await Promise.all([el.play(),sound?.context.resume()]);if(generation!==e.generation)return;if(!e.requested){el.pause();return;}setError('');fadeVolume();}catch(cause){if(generation!==e.generation||!e.requested||(cause instanceof DOMException&&cause.name==='AbortError'))return;if(cause instanceof DOMException&&cause.name==='NotAllowedError'){e.requested=false;el.pause();setLoading(false);setError('请点击播放，允许浏览器开启音乐。');}else if(!el.error){e.requested=false;el.pause();setLoading(false);setPlaying(false);setError('播放未能开始，请重试或选择其他曲目。');}/* Decode/network errors are handled by the media error event. */}}
 function loadSource(online=false){const el=audio.current,e=engine.current;if(!el)return;remember();e.controller?.abort();e.controller=null;const generation=++e.generation,selected=SOUNDTRACKS[e.index];cancelAnimationFrame(fade.current);el.pause();el.removeAttribute('src');el.load();e.loadedCid=selected.cid;e.online=online;setSource(online?'online':'local');setError('');setLoading(true);setStarted(true);
  const attach=(src:string)=>{if(generation!==e.generation)return;el.src=src;el.load();if(e.requested)void play(generation);};
  if(!online){attach(selected.file);return;}
  const controller=new AbortController();e.controller=controller;fetch(`/__first-step-music/${selected.cid}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Source unavailable');return response.json();}).then(data=>{if(generation!==e.generation||controller.signal.aborted)return;if(data.cid!==selected.cid||typeof data.source!=='string')throw Error('Invalid source');attach(data.source);}).catch(()=>{if(generation!==e.generation||controller.signal.aborted)return;e.requested=false;setLoading(false);setPlaying(false);setError('本地音频和官方备用音源均暂不可用，请重试或切换曲目。');});
 }
 function toggle(){const e=engine.current,el=audio.current;if(e.requested){e.requested=false;e.suspended=false;cancelAnimationFrame(fade.current);el?.pause();setPlaying(false);setLoading(false);return;}e.requested=true;setError('');if(!el?.getAttribute('src')||el.error)loadSource();else void play();}
 function select(next:number){const e=engine.current,normalized=nextTrackIndex(next,0,SOUNDTRACKS.length);if(e.index===normalized)return;remember();e.controller?.abort();e.controller=null;++e.generation;cancelAnimationFrame(fade.current);const el=audio.current;el?.pause();el?.removeAttribute('src');el?.load();e.loadedCid='';e.online=false;e.index=normalized;setIndex(normalized);setError('');setPlaying(false);setLoading(false);setStarted(false);setSource('local');if(e.requested)loadSource();}
 function position(){const e=engine.current,el=audio.current;return e.loadedCid===SOUNDTRACKS[e.index].cid&&el&&el.readyState>=1?el.currentTime:e.times.get(SOUNDTRACKS[e.index].cid)??0;}
 function seek(time:number){if(!Number.isFinite(time))return;const e=engine.current,track=SOUNDTRACKS[e.index],value=Math.max(0,Math.min(track.duration,time));e.times.set(track.cid,value);const el=audio.current;if(el&&e.loadedCid===track.cid&&el.readyState>=1)el.currentTime=Math.min(value,el.duration);}
 function step(direction:number){const next=nextTrackIndex(engine.current.index,direction,SOUNDTRACKS.length);select(next);return next;}
 function playTrack(next:number){const e=engine.current;e.requested=true;setError('');if(next!==e.index)select(next);else if(!audio.current?.getAttribute('src')||audio.current.error)loadSource();else void play();}
 function reload(){engine.current.requested=true;loadSource();}
 const actions=useRef({loadSource,play,select});actions.current={loadSource,play,select};
 useEffect(()=>{const el=audio.current;if(!el)return;const e=engine.current;
  const metadata=()=>{const time=e.times.get(e.loadedCid)??0;if(Number.isFinite(el.duration)&&time<el.duration&&time>0)el.currentTime=time;if(!e.requested)setLoading(false);};
  const active=()=>{if(!e.requested||document.hidden){el.pause();return;}setPlaying(true);setLoading(false);setError('');};
  const paused=()=>{setPlaying(false);if(!e.requested||document.hidden)void graph.current?.context.suspend().catch(()=>{});},waiting=()=>{if(e.requested&&!document.hidden)setLoading(true);};
  const failed=()=>{if(!el.getAttribute('src')||!e.loadedCid)return;if(!e.online){actions.current.loadSource(true);return;}e.requested=false;setLoading(false);setPlaying(false);setError('音频无法播放，请重试或选择其他曲目。');};
  const ended=()=>{if(!el.loop&&e.requested)actions.current.select(e.index+1);};
  const visible=()=>{if(document.hidden){e.suspended=e.requested;remember();cancelAnimationFrame(fade.current);el.pause();setLoading(false);}else if(e.suspended&&e.requested){e.suspended=false;void actions.current.play();}};
  el.addEventListener('loadedmetadata',metadata);el.addEventListener('playing',active);el.addEventListener('pause',paused);el.addEventListener('waiting',waiting);el.addEventListener('error',failed);el.addEventListener('ended',ended);document.addEventListener('visibilitychange',visible);
  return()=>{e.requested=false;e.controller?.abort();cancelAnimationFrame(fade.current);el.pause();const sound=graph.current;if(sound){sound.source.disconnect();sound.analyser.disconnect();void sound.context.close().catch(()=>{});graph.current=null;analyser.current=null;}el.removeEventListener('loadedmetadata',metadata);el.removeEventListener('playing',active);el.removeEventListener('pause',paused);el.removeEventListener('waiting',waiting);el.removeEventListener('error',failed);el.removeEventListener('ended',ended);document.removeEventListener('visibilitychange',visible);};
 },[]);
 useEffect(()=>{fadeVolume();},[volume,working]);
 useEffect(()=>{if(audio.current)audio.current.loop=loop==='single';},[loop]);
 useEffect(()=>{try{localStorage.setItem(STORE,JSON.stringify({cid:track.cid,volume,loop}));}catch{}},[track.cid,volume,loop]);
 return {audio,index,track,volume,setVolume,loop,setLoop,playing,loading,error,source,started,toggle,select,step,playTrack,reload,position,seek,analyser,analysisStatus};
}
export type SoundtrackState=ReturnType<typeof useSoundtrack>;
/** Quick selection stays in the task; only the player entrance opens its route. */
export function MusicEntry({state,onOpen,contextKey}:{state:SoundtrackState;onOpen:(detail:boolean)=>void;contextKey:string}){
 return <div className="music-entry"><MusicQuickPicker state={state} contextKey={contextKey}/><button className={`music-entry-open ${state.playing?'is-playing':''}`} onPointerEnter={warmMusicScene} onFocus={warmMusicScene} onClick={()=>onOpen(false)} aria-label="打开音乐播放器" title={state.track.name}><ListMusic size={17}/><span>播放器</span><i/><i/><i/></button></div>;
}
