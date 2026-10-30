import {useCallback,useEffect,useReducer,useState} from 'react';
import {MUSIC_MODE_MOTION,musicModeReducer} from './music-mode.ts';
export function useMusicMode(requested:boolean,reduced:boolean){
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [state,dispatch]=useReducer(musicModeReducer,{phase:requested?'preparing':'closed',ready:false});
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setSystemReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 useEffect(()=>{dispatch({type:'request',open:requested});},[requested]);
 useEffect(()=>{
  if(state.phase!=='entering'&&state.phase!=='leaving')return;
  const event=state.phase==='entering'?'entered':'left';
  const timer=setTimeout(()=>dispatch({type:event}),reduced||systemReduced?MUSIC_MODE_MOTION.reduced:state.phase==='entering'?MUSIC_MODE_MOTION.enter:MUSIC_MODE_MOTION.leave);
  return()=>clearTimeout(timer);
 },[state.phase,reduced,systemReduced]);
 const markReady=useCallback(()=>dispatch({type:'ready'}),[]);
 return {phase:state.phase,present:state.phase!=='closed',interactive:state.phase==='open',reduced:reduced||systemReduced,markReady};
}
