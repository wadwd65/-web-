// Explicit ?perf=1 audit surface. No HUD, observer or reporting timer in normal use.
type Sample={time:number;cpu:number;calls:number;triangles:number;geometries:number;textures:number};
type Counters=Record<string,number>;
let active:Counters|null=null;
export function countAudit(name:string,amount=1){if(active)active[name]=(active[name]??0)+amount;}
export function createAudit(label:string){
 if(new URLSearchParams(location.search).get('perf')!=='1')return {frame:(_s:Omit<Sample,'time'>)=>{},count:(_name:string,_amount=1)=>{},begin:(_label:string)=>{},end:()=>{},dispose:()=>{}};
 const counters:Counters={},samples:Sample[]=[],longTasks:{time:number;duration:number}[]=[];active=counters;
 const output=document.createElement('output');output.className='performance-audit';output.setAttribute('aria-label','内部性能诊断');output.style.cssText='position:fixed;right:8px;bottom:100px;z-index:2000;pointer-events:none;white-space:pre;background:#142f46ed;color:#e4f4ff;font:10px/1.65 Consolas,monospace;padding:10px 14px;border-left:2px solid #61b9e4';document.body.appendChild(output);
 const began=performance.now();let last=began,observer:PerformanceObserver|undefined;
 let transition:{label:string;start:number;frames:Sample[];longTasks:number[]}|null=null;
 const transitions:unknown[]=[];
 if(PerformanceObserver.supportedEntryTypes?.includes('longtask')){observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){longTasks.push({time:entry.startTime,duration:entry.duration});if(transition&&entry.startTime>=transition.start)transition.longTasks.push(entry.duration);}});observer.observe({type:'longtask',buffered:false});}
 const timer=setInterval(()=>{
  const now=performance.now(),seconds=Math.max(.1,(now-last)/1000);last=now;
  while(samples.length&&samples[0].time<now-2000)samples.shift();while(longTasks.length&&longTasks[0].time<now-2000)longTasks.shift();
  const intervals=samples.slice(1).map((v,i)=>v.time-samples[i].time).sort((a,b)=>a-b),cpu=samples.map(s=>s.cpu).sort((a,b)=>a-b),lastSample=samples.at(-1),p95=(values:number[])=>values.length?values[Math.min(values.length-1,Math.floor(values.length*.95))]:0;
  const metrics={label,elapsedSeconds:+((now-began)/1000).toFixed(1),hidden:document.hidden,renderFps:+(samples.length/2).toFixed(1),frameP95Ms:+p95(intervals).toFixed(2),cpuFrameP95Ms:+p95(cpu).toFixed(2),drawCalls:lastSample?.calls??0,triangles:lastSample?.triangles??0,geometries:lastSample?.geometries??0,textures:lastSample?.textures??0,domWritesPerSecond:Math.round((counters.domWrites??0)/seconds),pointerCanvasPaintsPerSecond:Math.round((counters.pointerPaints??0)/seconds),pointerCompositeUpdatesPerSecond:Math.round((counters.pointerUpdates??0)/seconds),shadowRefreshesPerSecond:Math.round((counters.shadowRefreshes??0)/seconds),longTasksLast2s:longTasks.length,audioElements:document.querySelectorAll('audio').length};
  output.dataset.metrics=JSON.stringify(metrics);output.textContent=`PERF AUDIT / ${label}\n${metrics.renderFps} render fps · p95 ${metrics.frameP95Ms} ms\nCPU p95 ${metrics.cpuFrameP95Ms} ms\n${metrics.drawCalls} draw calls · ${metrics.geometries} geometries\nDOM writes/s ${metrics.domWritesPerSecond}\nPointer canvas paints/s ${metrics.pointerCanvasPaintsPerSecond}\nShadow refresh/s ${metrics.shadowRefreshesPerSecond}\nLong tasks/2s ${metrics.longTasksLast2s}\n${metrics.hidden?'HIDDEN':'VISIBLE'} · elapsed ${metrics.elapsedSeconds}s`;
  for(const key of Object.keys(counters))counters[key]=0;
 },1000);
 return {frame:(sample:Omit<Sample,'time'>)=>{const value={...sample,time:performance.now()};samples.push(value);transition?.frames.push(value);if(samples.length>600)samples.shift();},count:(name:string,amount=1)=>{counters[name]=(counters[name]??0)+amount;},begin:(name:string)=>{transition={label:name,start:performance.now(),frames:[],longTasks:[]};},end:()=>{if(!transition)return;const t=transition,intervals=t.frames.slice(1).map((f,i)=>f.time-t.frames[i].time).sort((a,b)=>a-b);transitions.push({label:t.label,durationMs:Math.round(performance.now()-t.start),frames:t.frames.length,frameP95Ms:+(intervals[Math.floor(intervals.length*.95)]??0).toFixed(2),maxFrameMs:+Math.max(0,...intervals).toFixed(2),cpuFrameMaxMs:+Math.max(0,...t.frames.map(f=>f.cpu)).toFixed(2),longTasks:t.longTasks});if(transitions.length>16)transitions.shift();output.dataset.transitions=JSON.stringify(transitions);transition=null;},dispose:()=>{clearInterval(timer);observer?.disconnect();output.remove();if(active===counters)active=null;}};
}
