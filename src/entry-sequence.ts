/** Visible-time entry clock: neither loading nor an idle title screen can consume it. */
export function createEntrySequence(reduced=false){
 let requested=false,elapsed=0,completed=false;
 function state(){
  return {requested,elapsed,completed,phase:completed?4:!requested?0:elapsed>=3300?4:elapsed>=2100?3:elapsed>=650?2:1,reveal:requested&&(reduced||elapsed>=1750)};
 }
 return {
  state,
  start(){requested=true;return state();},
  advance(delta:number,ready:boolean,visible=true){
   if(!requested||!ready||!visible||completed)return state();
   // Preserve timing on a slower desktop without jumping across the whole reveal.
   elapsed+=Math.max(0,Math.min(Number.isFinite(delta)?delta:0,250));
   if(reduced||elapsed>=3750)completed=true;
   return state();
  },
  skip(){requested=true;completed=true;return state();}
 };
}
