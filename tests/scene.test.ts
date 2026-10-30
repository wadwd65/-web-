import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArchitecture} from '../src/scene/architecture.ts';
import {COUNT,prepareSpace} from '../src/scene/surface.ts';

function release(group:THREE.Group){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());o.customDepthMaterial?.dispose();}});}
test('every module has a finite, solid scene and a camera outside its near target',()=>{
 for(let i=0;i<8;i++){
  const {group,camera,focus}=createArchitecture(i),box=new THREE.Box3().setFromObject(group),size=box.getSize(new THREE.Vector3());
  assert.ok(size.x>6&&size.y>4&&size.z>3,`scene ${i} needs real spatial volume`);
  assert.ok(camera.distanceTo(focus)>5);
  let meshes=0;group.traverse(o=>{if(!(o instanceof THREE.Mesh))return;meshes++;const p=o.geometry.getAttribute('position');assert.ok(p.count>0);for(let n=0;n<p.array.length;n++)assert.ok(Number.isFinite(p.array[n]));assert.equal(o.userData.dissolve,true);});
  assert.ok(meshes>8);release(group);
 }
});
test('mesh sampling is deterministic, full-depth and stays in actual world-space bounds',()=>{
 const a=prepareSpace(0),again=prepareSpace(0),b=prepareSpace(1);
 assert.equal(a.points.length,COUNT*3);assert.deepEqual(a.points,again.points);assert.notDeepEqual(a.points,b.points);
 for(const space of [a,b]){const box=new THREE.Box3().setFromObject(space.group).expandByScalar(.001),sampleBox=new THREE.Box3();for(let n=0;n<space.points.length;n+=3){const p=new THREE.Vector3().fromArray(space.points,n);assert.ok(box.containsPoint(p),'point escaped baked mesh bounds');sampleBox.expandByPoint(p);}assert.ok(sampleBox.getSize(new THREE.Vector3()).z>3);assert.equal(space.colours.length,space.points.length);release(space.group);}
});
