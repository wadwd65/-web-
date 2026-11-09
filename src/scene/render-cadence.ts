/** Follow the display's real callbacks. Native 60Hz and GPU-limited callbacks
 * must never lose another frame to a software divisor. Refresh estimates are
 * diagnostic only; they do not manufacture frames or advance animation time. */
export function createRenderCadence(){
 let last=0,refreshHz=60;const intervals:number[]=[];
 return {due(now:number){
  const delta=now-last;last=now;
  if(delta>100||delta<=0){intervals.length=0;return true;}
  if(delta>=2&&delta<=40){intervals.push(delta);if(intervals.length===32){const sorted=[...intervals].sort((a,b)=>a-b);refreshHz=1000/sorted[16];intervals.length=0;}}
  return true;
 },reset(){last=0;refreshHz=60;intervals.length=0;},state:()=>({stride:1,refreshHz,targetFps:refreshHz})};
}
