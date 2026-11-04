import {useCallback,useEffect,useRef,useState} from 'react';
import {createModeController,initialExperienceMode} from './runtime-mode.ts';
import type {ExperienceMode} from './runtime-mode.ts';
import {createPerformanceRecord} from './performance-record.ts';
import {version} from '../package.json';

export function useExperienceMode(){
 const [mode,setMode]=useState<ExperienceMode>(()=>initialExperienceMode(location.search)),[notice,setNotice]=useState('');
 const [record]=useState(()=>new URLSearchParams(location.search).get('perf')==='1'?createPerformanceRecord({version,initialMode:mode,browser:navigator.userAgent,logicalCores:navigator.hardwareConcurrency,memoryGB:(navigator as Navigator&{deviceMemory?:number}).deviceMemory??null,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio}):null);
 const controller=useRef<ReturnType<typeof createModeController>|null>(null);
 controller.current??=createModeController(mode,value=>{setMode(value.mode);setNotice(value.notice);},record??undefined);
 const change=useCallback((next:ExperienceMode)=>controller.current?.change(next),[]);
 const setActive=useCallback((source:string|null)=>controller.current?.setActive(source),[]);
 const frame=useCallback((source:string,now:number,eligible:boolean)=>controller.current?.frame(source,now,eligible&&!document.hidden),[]);
 const unavailable=useCallback(()=>controller.current?.unavailable(),[]);
 useEffect(()=>{const reset=()=>controller.current?.reset();document.addEventListener('visibilitychange',reset);return()=>document.removeEventListener('visibilitychange',reset);},[]);
 return {mode,notice,change,setActive,frame,unavailable,record,dismiss:()=>controller.current?.dismiss()};
}
