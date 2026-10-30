export const ARCHIVE_MOTION_MS=920;
/** Finite-duration ease: no exponentially small tail or waiting to change actor. */
export function archiveEase(elapsed:number,duration=ARCHIVE_MOTION_MS){
 const t=Math.max(0,Math.min(1,elapsed/duration));return t*t*t*(t*(t*6-15)+10);
}
export function spectrumBands(data:Uint8Array,count=40){
 const values=new Float32Array(count);if(!data.length)return values;
 for(let n=0;n<count;n++){const from=Math.floor(Math.pow(n/count,2)*data.length*.78),to=Math.max(from+1,Math.floor(Math.pow((n+1)/count,2)*data.length*.78));let sum=0;for(let k=from;k<Math.min(to,data.length);k++)sum+=data[k];values[n]=sum/Math.max(1,Math.min(to,data.length)-from)/255;}return values;
}
