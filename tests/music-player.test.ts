import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtmosphereBlend} from '../src/music-atmosphere-blend.ts';
import {readFileSync} from 'node:fs';
import {nextTrackIndex,playbackProgress,validPeaks,waveformPath} from '../src/audio-visual.ts';
import {parseExperiencePage,EXPERIENCE_MODULES} from '../src/experience-modules.ts';
test('music is a real route without removing existing task routes',()=>{
 assert.equal(parseExperiencePage('#/music'),'music');assert.equal(parseExperiencePage('#/home'),'home');assert.equal(parseExperiencePage('#/list'),'list');for(const task of EXPERIENCE_MODULES)assert.equal(parseExperiencePage('#/'+task.id),task.id);assert.equal(parseExperiencePage('#/not-a-task'),'home');
});
test('next and previous wrap; six rapid next actions use the latest index',()=>{
 assert.equal(nextTrackIndex(4,1,5),0);assert.equal(nextTrackIndex(0,-1,5),4);let index=0;const visited=[];for(let n=0;n<6;n++){index=nextTrackIndex(index,1,5);visited.push(index);}assert.deepEqual(visited,[1,2,3,4,0,1]);assert.throws(()=>nextTrackIndex(0,1,0),RangeError);
});
test('waveform geometry and progress remain finite and inside the plot for missing or invalid values',()=>{
 assert.equal(waveformPath([0,1],100,40),'M25.00,20.00V20.00M75.00,2.00V38.00');assert.equal(waveformPath([]),'');const path=waveformPath([NaN,Infinity,-2,3]);assert.ok(!/NaN|Infinity/.test(path));assert.equal(playbackProgress(50,100),.5);assert.equal(playbackProgress(-10,100),0);assert.equal(playbackProgress(150,100),1);assert.equal(playbackProgress(10,0),0);assert.equal(playbackProgress(NaN,100),0);
});
test('every waveform packet comes from the matching audio checksum and cannot be applied to another track',()=>{
 const catalog=JSON.parse(readFileSync(new URL('../public/audio/catalog.json',import.meta.url),'utf8'));
 for(const track of catalog){const value=JSON.parse(readFileSync(new URL('../public/audio/peaks/'+track.cid+'.json',import.meta.url),'utf8'));assert.ok(validPeaks(value,track.cid,track.sha256));assert.equal(value.peaks.length,384);assert.ok(new Set(value.peaks).size>30);assert.ok(Math.abs(value.duration-track.duration)<.1);assert.equal(validPeaks(value,'different-song',track.sha256),false);assert.equal(validPeaks(value,track.cid,'wrong-checksum'),false);assert.equal(validPeaks({...value,peaks:[NaN]},track.cid,track.sha256),false);}
});

test('effect IDs crossfade directly without visiting unrelated middle effects',()=>{
 const state=createAtmosphereBlend(0);state.update(.425,4);
 assert.equal(state.from,0);assert.equal(state.to,4);assert.ok(Math.abs(state.mix-.5)<1e-8);
 const weights=Array.from({length:5},(_,mode)=>(mode===state.from?1-state.mix:0)+(mode===state.to?state.mix:0));
 assert.deepEqual(weights,[.5,0,0,0,.5]);state.update(.425,4);assert.equal(state.mix,1);assert.equal(state.from,4);
});

test('rapid skips finish the current pair then take the latest effect, keeping intermediate requests out',()=>{
 const state=createAtmosphereBlend(0);state.update(.2,4);state.update(.2,2);assert.equal(state.to,4);
 state.update(.5,3);assert.equal(state.mix,1);assert.equal(state.to,4);
 state.update(.1,3);assert.equal(state.from,4);assert.equal(state.to,3);assert.ok(state.mix>0&&state.mix<1);
 state.update(1,3);assert.equal(state.from,3);assert.equal(state.to,3);assert.equal(state.mix,1);
});

test('opening on an existing song and reducing motion do not replay another theme',()=>{
 const state=createAtmosphereBlend(3);assert.equal(state.from,3);assert.equal(state.to,3);assert.equal(state.mix,1);
 state.update(.2,0);state.update(.01,4,true);assert.equal(state.from,4);assert.equal(state.to,4);assert.equal(state.mix,1);
 state.update(.01,4);assert.equal(state.mix,1);
});

test('all discrete effect pairs keep a normalized blend of at most two modes',()=>{
 for(let from=0;from<5;from++)for(let to=0;to<5;to++){
  const state=createAtmosphereBlend(from);
  for(let n=0;n<20;n++){
   state.update(.05,to);const weights=Array.from({length:5},(_,mode)=>(mode===state.from?1-state.mix:0)+(mode===state.to?state.mix:0));
   assert.ok(weights.every(w=>w>=0&&w<=1));assert.ok(weights.filter(w=>w>0).length<=2);assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-8);
  }
  assert.equal(state.to,to);assert.equal(state.mix,1);
 }
});
