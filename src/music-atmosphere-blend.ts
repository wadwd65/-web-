export const MUSIC_ATMOSPHERE_FADE_MS=850;
const mode=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(4,Math.trunc(value))):0;

/** Discrete effects crossfade directly. Interpolating their numeric IDs would
 * accidentally play unrelated intermediate effects. Only the latest skip waits. */
export function createAtmosphereBlend(initial:number){
 const state={from:mode(initial),to:mode(initial),mix:1,elapsed:MUSIC_ATMOSPHERE_FADE_MS,
  update(dt:number,requested:number,reduced=false){
   const target=mode(requested);
   if(reduced){state.from=state.to=target;state.mix=1;state.elapsed=MUSIC_ATMOSPHERE_FADE_MS;return;}
   if(state.mix===1&&target!==state.to){state.from=state.to;state.to=target;state.elapsed=0;}
   const step=Number.isFinite(dt)?Math.max(0,dt)*1000:0;
   state.elapsed=Math.min(MUSIC_ATMOSPHERE_FADE_MS,state.elapsed+step);
   const progress=state.elapsed/MUSIC_ATMOSPHERE_FADE_MS;
   state.mix=progress*progress*(3-2*progress);
   if(progress===1)state.from=state.to;
  },
 };
 return state;
}
