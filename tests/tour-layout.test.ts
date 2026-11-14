import test from 'node:test';
import assert from 'node:assert/strict';
import {placeTourCard} from '../src/tour-layout.ts';
import {stepsFor} from '../src/lib/usage-tour.ts';

test('optional work tours explain the actual input/result of every tool without whole-workspace targets',()=>{
 for(const page of ['offer','contract','salary','tax','social','rent','subsidy','leaving'] as const){
  const input=stepsFor(page,true,'material'),result=stepsFor(page,true,'result');
  assert.notEqual(input[0].title,result[0].title);assert.ok(input[0].selectors?.length);assert.ok(result[0].selectors?.length);
  assert.ok(!input.flatMap(s=>s.selectors??[]).includes('.experience-workspace'));
  assert.ok(input.some(s=>s.id==='action'));assert.ok(input.some(s=>s.id==='views'));
  assert.equal(new Set(input.map(s=>s.id)).size,input.length);
 }
 assert.equal(stepsFor('home',true).length,6);assert.equal(stepsFor('home',false).length,5);
 assert.equal(stepsFor('tools',false).length,5);assert.equal(stepsFor('list',false).length,5);
});

test('tour cards stay beside a highlighted 3D scene, above the question box and below header actions',()=>{
 const viewport={width:1366,height:768},card={width:352,height:310};
 for(const target of [{left:628,top:154,width:697,height:399},{left:60,top:610,width:1240,height:95},{left:950,top:20,width:300,height:46},{left:60,top:300,width:255,height:65}]){
  const result=placeTourCard(target,viewport,card);
  assert.ok(result.left>=16&&result.left+card.width<=viewport.width-16);
  assert.ok(result.top>=16&&result.top+card.height<=viewport.height-16);
  assert.ok(result.left+card.width<=target.left||result.left>=target.left+target.width||result.top+card.height<=target.top||result.top>=target.top+target.height,'do not cover the highlighted entry when there is room beside it');
 }
});
test('a missing or full-screen target still leaves all guide controls inside the desktop viewport',()=>{
 for(const viewport of [{width:835,height:811},{width:1280,height:720},{width:1920,height:1080}])for(const target of [null,{left:0,top:0,...viewport}]){
  const card={width:viewport.width<1024?320:352,height:350},p=placeTourCard(target,viewport,card);
  assert.ok(p.left>=16&&p.top>=16&&p.left+card.width<=viewport.width-16&&p.top+card.height<=viewport.height-16);
 }
});
