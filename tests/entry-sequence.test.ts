import test from 'node:test';
import assert from 'node:assert/strict';
import {createEntrySequence} from '../src/entry-sequence.ts';

function frames(clock:ReturnType<typeof createEntrySequence>,count:number,ready=true,visible=true){for(let i=0;i<count;i++)clock.advance(16,ready,visible);return clock.state();}
test('a loaded or long-idle title screen never consumes the entry before a user starts',()=>{
 const clock=createEntrySequence();frames(clock,10000);assert.equal(clock.state().phase,0);assert.equal(clock.state().completed,false);assert.equal(clock.state().reveal,false);
 clock.start();assert.equal(clock.state().phase,1);assert.equal(clock.state().elapsed,0);
});
test('loading and hidden tabs cannot consume the requested opening',()=>{
 const clock=createEntrySequence();clock.start();frames(clock,1000,false);frames(clock,1000,true,false);assert.equal(clock.state().elapsed,0);
 clock.advance(60000,true);assert.equal(clock.state().elapsed,250);assert.equal(clock.state().completed,false);
});
test('the real scene starts before curtain opening and completes only after the reveal',()=>{
 const clock=createEntrySequence();clock.start();frames(clock,175);assert.equal(clock.state().phase,2);assert.equal(clock.state().reveal,true);assert.equal(clock.state().completed,false);
 frames(clock,24);assert.equal(clock.state().phase,3);frames(clock,82);assert.equal(clock.state().phase,4);assert.equal(clock.state().completed,false);
 frames(clock,30);assert.equal(clock.state().completed,true);
});
test('reduced motion still waits for explicit start; skip is immediate and completion is stable',()=>{
 const reduced=createEntrySequence(true);frames(reduced,1000);assert.equal(reduced.state().completed,false);reduced.start();reduced.advance(16,true);assert.equal(reduced.state().completed,true);
 const normal=createEntrySequence();normal.skip();frames(normal,1000);assert.equal(normal.state().completed,true);assert.equal(normal.state().elapsed,0);
});
