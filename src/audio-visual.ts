/** Track navigation and audio-derived overview geometry, shared with verification. */
export function nextTrackIndex(index:number,direction:number,length:number){
 if(!Number.isInteger(length)||length<1)throw new RangeError('Empty soundtrack list');
 return ((Math.trunc(index)+Math.trunc(direction))%length+length)%length;
}
export function waveformPath(peaks:readonly number[],width=1000,height=84){
 if(!peaks.length||width<=0||height<=0)return '';
 const center=height/2,step=width/peaks.length;
 return peaks.map((value,index)=>{const amplitude=(Number.isFinite(value)?Math.min(1,Math.max(0,value)):0)*(center-2),x=(index+.5)*step;return `M${x.toFixed(2)},${(center-amplitude).toFixed(2)}V${(center+amplitude).toFixed(2)}`;}).join('');
}
export type AudioPeaks={version:number;cid:string;audioSha256:string;duration:number;sampleRate:number;method:string;peaks:number[]};
export function validPeaks(value:unknown,cid:string,sha256:string):value is AudioPeaks{
 if(!value||typeof value!=='object')return false;const p=value as AudioPeaks;
 return p.version===1&&p.cid===cid&&p.audioSha256===sha256&&p.duration>0&&Array.isArray(p.peaks)&&p.peaks.length>=128&&p.peaks.length<=1024&&p.peaks.every(n=>Number.isFinite(n)&&n>=0&&n<=1);
}
export function playbackProgress(position:number,duration:number){return Number.isFinite(position)&&Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(1,position/duration)):0;}
