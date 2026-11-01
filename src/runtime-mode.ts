export type ExperienceMode='full'|'simple';
export const FRAME_POLICY={warmupMs:1500,windowMs:1000,slowFps:30,slowWindows:5,severeFps:15,severeWindows:2} as const;
export type FrameWindow={fps:number;elapsedMs:number;slowWindows:number;severeWindows:number};
/** Only sample an actively drawing foreground scene; pauses start a fresh warm-up. */
export function createFrameMonitor(onSlow:(sample:FrameWindow)=>void,onWindow?:(sample:FrameWindow)=>void){
 let warmUntil:number|null=null,start=0,frames=0,slow=0,severe=0,fired=false,last=0;
 function reset(){warmUntil=null;start=frames=slow=severe=last=0;fired=false;}
 function sample(now:number,eligible=true){
  if(!eligible||!Number.isFinite(now)){reset();return;}
  if(fired)return;
  if(warmUntil===null||now<last){reset();warmUntil=now+FRAME_POLICY.warmupMs;last=now;return;}
  last=now;if(now<warmUntil)return;
  if(!start){start=now;frames=0;return;}
  frames++;const elapsedMs=now-start;if(elapsedMs<FRAME_POLICY.windowMs)return;
  const fps=frames*1000/elapsedMs;slow=fps<FRAME_POLICY.slowFps?slow+1:0;severe=fps<FRAME_POLICY.severeFps?severe+1:0;
  const value={fps,elapsedMs,slowWindows:slow,severeWindows:severe};onWindow?.(value);start=now;frames=0;
  if(slow>=FRAME_POLICY.slowWindows||severe>=FRAME_POLICY.severeWindows){fired=true;onSlow(value);}
 }
 return {sample,reset};
}
export function initialExperienceMode(search:string):ExperienceMode{return new URLSearchParams(search).get('mode')==='simple'?'simple':'full';}
export function createModeController(initial:ExperienceMode,onChange:(value:{mode:ExperienceMode;notice:string})=>void){
 let mode=initial,notice='',manual=initial==='simple',active:string|null=null,lastSample:FrameWindow|null=null;
 const emit=()=>onChange({mode,notice});
 const monitor=createFrameMonitor(value=>{if(mode!=='full'||manual)return;mode='simple';notice='当前运行较慢，已切换简易模式。填写和音乐都保留。';lastSample=value;emit();},value=>{lastSample=value;});
 return {
  change(next:ExperienceMode){manual=true;mode=next;notice=next==='full'?'已切回完整模式。本次会保留你的选择。':'已切换简易模式，填写和播放保持不变。';monitor.reset();emit();},
  setActive(source:string|null){if(source!==active){active=source;monitor.reset();}},
  frame(source:string,now:number,eligible:boolean){if(source!==active)return;monitor.sample(now,eligible&&mode==='full'&&!manual);},
  unavailable(){mode='simple';notice='三维暂不可用，已切换简易模式。工具仍可使用。';monitor.reset();emit();},
  dismiss(){notice='';emit();},reset:monitor.reset,
  state:()=>({mode,notice,manualOverride:manual,lastSample}),
 };
}
