import {useCallback,useEffect,useRef,useState} from 'react';
import {createModeController,initialExperienceMode} from './runtime-mode.ts';
import type {ExperienceMode} from './runtime-mode.ts';

export function useExperienceMode(){
 const [mode,setMode]=useState<ExperienceMode>(()=>initialExperienceMode(location.search)),[notice,setNotice]=useState('');
 const controller=useRef<ReturnType<typeof createModeController>|null>(null);
 controller.current??=createModeController(mode,value=>{setMode(value.mode);setNotice(value.notice);});
 const change=useCallback((next:ExperienceMode)=>controller.current?.change(next),[]);
 const setActive=useCallback((source:string|null)=>controller.current?.setActive(source),[]);
 const frame=useCallback((source:string,now:number,eligible:boolean)=>controller.current?.frame(source,now,eligible&&!document.hidden),[]);
 const unavailable=useCallback(()=>controller.current?.unavailable(),[]);
 useEffect(()=>{const reset=()=>controller.current?.reset();document.addEventListener('visibilitychange',reset);return()=>document.removeEventListener('visibilitychange',reset);},[]);
 return {mode,notice,change,setActive,frame,unavailable,dismiss:()=>controller.current?.dismiss()};
}
