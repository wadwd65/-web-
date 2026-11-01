import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameMonitor,createModeController,initialExperienceMode} from '../src/runtime-mode.ts';

function simulation(fps:number,seconds:number,monitor:ReturnType<typeof createFrameMonitor>,offset=0){for(let now=offset;now<offset+seconds*1000;now+=1000/fps)monitor.sample(now);}
test('complete is the default; only an explicit lightweight entry starts simple',()=>{assert.equal(initialExperienceMode(''),'full');assert.equal(initialExperienceMode('?mode=unknown'),'full');assert.equal(initialExperienceMode('?mode=simple'),'simple');});
test('persistent slow or severe foreground rendering falls back once after warm-up',()=>{for(const [fps,seconds] of [[24,8],[10,5]]){let falls=0;const m=createFrameMonitor(()=>falls++);simulation(fps,seconds,m);assert.equal(falls,1);simulation(fps,4,m,seconds*1000);assert.equal(falls,1);}});
test('short dips, stable frames and initial preparation never count as sustained slowness',()=>{let falls=0;const m=createFrameMonitor(()=>falls++);simulation(10,1.4,m);simulation(60,3,m,1400);simulation(24,3,m,4400);simulation(60,3,m,7400);assert.equal(falls,0);});
test('hidden, suspended or intentionally reduced rendering resets both streak and warm-up',()=>{let falls=0;const m=createFrameMonitor(()=>falls++);simulation(10,3,m);m.sample(3100,false);m.sample(10000,false);simulation(60,4,m,11000);assert.equal(falls,0);simulation(10,4,m,15000);assert.equal(falls,1);});
test('rates use actual elapsed time and do not confuse a 120Hz device with a timer estimate',()=>{const samples:number[]=[];const m=createFrameMonitor(()=>assert.fail('fast device'),s=>samples.push(s.fps));simulation(120,6,m);assert.ok(samples.length>=3);assert.ok(samples.every(fps=>Math.abs(fps-120)<.01));});
test('the production controller falls back then respects manual restore without bouncing or changing the route',()=>{
 const changes:string[]=[],c=createModeController('full',s=>changes.push(s.mode));c.setActive('task');
 for(let t=0;t<5000;t+=100)c.frame('task',t,true);
 assert.equal(c.state().mode,'simple');assert.match(c.state().notice,/运行较慢/);
 c.change('full');for(let t=5000;t<18000;t+=100)c.frame('task',t,true);
 assert.equal(c.state().mode,'full');assert.equal(c.state().manualOverride,true);assert.deepEqual(changes,['simple','full']);
});
test('only the selected scene can contribute, and changing scene discards earlier slow windows',()=>{
 const c=createModeController('full',()=>{});c.setActive('music');for(let t=0;t<10000;t+=100)c.frame('task',t,true);assert.equal(c.state().mode,'full');
 for(let t=10000;t<13000;t+=100)c.frame('music',t,true);c.setActive(null);c.setActive('task');for(let t=13000;t<16000;t+=100)c.frame('task',t,true);assert.equal(c.state().mode,'full');
 for(let t=16000;t<19000;t+=100)c.frame('task',t,true);assert.equal(c.state().mode,'simple');
});
