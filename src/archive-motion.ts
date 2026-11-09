export const ARCHIVE_MOTION_MS=920;
export const ARCHIVE_SPACE={detail:[0,.28,3.2],incoming:[10,.28,1.2],outgoing:[-1,.2,-16],radius:4.2} as const;
/** Preserve intermediate poses after a suspension, without changing FPS data. */
export function advanceArchiveTime(elapsed:number,deltaMs:number){return Math.min(ARCHIVE_MOTION_MS,elapsed+Math.min(50,Math.max(0,deltaMs)));}
export type ArchiveTransition='enter'|'return'|'browse';
export function archiveNeedsRetarget(state:{busy:boolean;kind:ArchiveTransition;detail:boolean;active:number},request:{detail:boolean;selected:number}){
 // Finish the whole assembly, including its cover, before consuming the latest
 // request. Restarting an incoming half-open case discards its outgoing actor.
 if(state.busy)return false;
 return state.detail!==request.detail||(request.detail&&state.active!==request.selected);
}
const interval=(t:number,a:number,b:number)=>archiveEase((t-a)/(b-a),1);
/** Non-selected cases disappear before travel and return only after docking. */
export function archiveStages(kind:ArchiveTransition,t:number){
 const move=kind==='browse'?interval(t,.28,.76):kind==='enter'?interval(t,.14,.74):interval(t,.22,.82);
 return {move,open:kind==='browse'?interval(t,.76,1):kind==='enter'?interval(t,.74,1):interval(t,0,.22),
  fadeOut:1-interval(t,0,.12),reveal:interval(t,.84,1),shadow:1-interval(t,0,.12)};
}
/** The departing case closes before travel; the arriving case opens only after
 * docking. The old case recedes into the archive instead of crossing the text. */
export function archiveBrowse(t:number){
 return {outMove:interval(t,.18,.52),outClose:interval(t,0,.18),outVisible:t<.84,inVisible:t>=.28};
}
/** The cover retreats before the disc advances; closing follows the reverse path. */
export function archiveLayers(open:number){
 return {discZ:.27+.51*interval(open,.45,1),lidZ:.18+.48*interval(open,0,.45),lidOpacity:.13*(1-interval(open,0,.40)),lidVisible:open<.40};
}
/** Finite-duration ease: no exponentially small tail or waiting to change actor. */
export function archiveEase(elapsed:number,duration=ARCHIVE_MOTION_MS){
 const t=Math.max(0,Math.min(1,elapsed/duration));return t*t*t*(t*(t*6-15)+10);
}
export function spectrumBands(data:Uint8Array,count=40){
 const values=new Float32Array(count);if(!data.length)return values;
 for(let n=0;n<count;n++){const from=Math.floor(Math.pow(n/count,2)*data.length*.78),to=Math.max(from+1,Math.floor(Math.pow((n+1)/count,2)*data.length*.78));let sum=0;for(let k=from;k<Math.min(to,data.length);k++)sum+=data[k];values[n]=sum/Math.max(1,Math.min(to,data.length)-from)/255;}return values;
}
