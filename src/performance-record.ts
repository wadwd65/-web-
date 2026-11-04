import type {ExperienceMode,FrameWindow} from './runtime-mode.ts';

/** Explicit diagnostic sessions contain measurements only. They never inspect form or chat content. */
export function createPerformanceRecord(device:Record<string,unknown>,now=()=>Date.now()){
 const started=now();
 const windows:(FrameWindow&{atMs:number;source:string|null})[]=[];
 const events:{elapsedMs:number;type:string;value:string|null}[]=[];
 let source:string|null=null;
 const event=(type:string,value:string|null)=>{events.push({elapsedMs:now()-started,type,value});if(events.length>200)events.shift();};
 return {
  window(sample:FrameWindow){windows.push({...sample,source,atMs:now()-started});if(windows.length>300)windows.shift();},
  mode(mode:ExperienceMode,reason:string){event(reason,mode);},
  active(next:string|null){source=next;event('sampling-source',next);},
  snapshot(){return {schemaVersion:1,scope:'opt-in browser measurements; hardware performance classification requires a real device test',startedAt:new Date(started).toISOString(),durationMs:now()-started,device,windows:windows.map(value=>({...value})),events:events.map(value=>({...value}))};},
 };
}
export type PerformanceRecord=ReturnType<typeof createPerformanceRecord>;
