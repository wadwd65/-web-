import test from 'node:test';
import assert from 'node:assert/strict';
import {musicModeReducer as step} from '../src/music-mode.ts';
import type {MusicModeState} from '../src/music-mode.ts';
const closed:MusicModeState={phase:'closed',ready:false};
test('the music route waits for its scene and retains it for the whole exit',()=>{
 let s=step(closed,{type:'request',open:true});assert.equal(s.phase,'preparing');
 s=step(s,{type:'entered'});assert.equal(s.phase,'preparing');
 s=step(s,{type:'ready'});assert.equal(s.phase,'entering');
 s=step(s,{type:'entered'});assert.equal(s.phase,'open');
 s=step(s,{type:'request',open:false});assert.deepEqual(s,{phase:'leaving',ready:true});
 s=step(s,{type:'left'});assert.deepEqual(s,closed);
});
test('closing during preparation and a late load cannot reopen the player',()=>{
 let s=step(closed,{type:'request',open:true});s=step(s,{type:'request',open:false});
 s=step(s,{type:'ready'});assert.equal(s.phase,'leaving');s=step(s,{type:'left'});
 assert.deepEqual(step(s,{type:'ready'}),closed);assert.deepEqual(step(s,{type:'entered'}),closed);
});
test('reopening reverses an exit and ignores a stale exit timer',()=>{
 let s:MusicModeState={phase:'open',ready:true};s=step(s,{type:'request',open:false});
 s=step(s,{type:'request',open:true});assert.equal(s.phase,'entering');
 s=step(s,{type:'left'});assert.equal(s.phase,'entering');
 s=step(s,{type:'entered'});assert.equal(s.phase,'open');
 const loading=step({phase:'leaving',ready:false},{type:'request',open:true});assert.equal(loading.phase,'preparing');
});
