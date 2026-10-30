export type MusicModePhase='closed'|'preparing'|'entering'|'open'|'leaving';
export type MusicModeState={phase:MusicModePhase;ready:boolean};
export type MusicModeEvent={type:'request';open:boolean}|{type:'ready'}|{type:'entered'}|{type:'left'};
export const MUSIC_MODE_MOTION={enter:820,leave:620,reduced:20} as const;

/** A late ready/timer event cannot resurrect a cancelled route or finish a reopened exit. */
export function musicModeReducer(state:MusicModeState,event:MusicModeEvent):MusicModeState{
 if(event.type==='request'){
  if(event.open){
   if(state.phase==='closed')return {phase:'preparing',ready:false};
   if(state.phase==='leaving')return {...state,phase:state.ready?'entering':'preparing'};
   return state;
  }
  return state.phase==='closed'||state.phase==='leaving'?state:{...state,phase:'leaving'};
 }
 if(event.type==='ready')return state.phase==='closed'?state:{ready:true,phase:state.phase==='preparing'?'entering':state.phase};
 if(event.type==='entered')return state.phase==='entering'?{...state,phase:'open'}:state;
 return state.phase==='leaving'?{phase:'closed',ready:false}:state;
}
