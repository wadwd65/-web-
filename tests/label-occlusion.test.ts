import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createLabelOcclusion} from '../src/scene/label-occlusion.ts';
import type {ScreenPanel} from '../src/scene/label-occlusion.ts';

const square=(index:number,z:number):ScreenPanel=>({index,points:[{x:100,y:100,z},{x:300,y:100,z},{x:300,y:300,z},{x:100,y:300,z}]});
test('rear labels are occluded by a nearer board, while foreground, exposed and own labels remain available',()=>{
 const check=createLabelOcclusion(),panels=[square(7,.3)],inside={left:150,right:180,top:150,bottom:180};
 assert.equal(check.rectangle(inside,.6,0,panels),true);
 assert.equal(check.rectangle(inside,.2,0,panels),false);
 assert.equal(check.rectangle(inside,.6,7,panels),false);
 assert.equal(check.rectangle({left:320,right:350,top:150,bottom:180},.6,0,panels),false);
 assert.equal(check.rectangle({left:295,right:330,top:150,bottom:180},.6,0,panels),true);
});

test('a tilted board only hides the part that is actually nearer, not everything within its bounding rectangle',()=>{
 const check=createLabelOcclusion(),panel=square(2,.2);panel.points[1].z=panel.points[2].z=.8;
 assert.equal(check.rectangle({left:120,right:140,top:150,bottom:180},.5,1,[panel]),true);
 assert.equal(check.rectangle({left:240,right:280,top:150,bottom:180},.5,1,[panel]),false);
 assert.equal(check.rectangle({left:190,right:240,top:150,bottom:180},.5,1,[panel]),true);
 const diamond:ScreenPanel={index:4,points:[{x:200,y:100,z:.2},{x:300,y:200,z:.2},{x:200,y:300,z:.2},{x:100,y:200,z:.2}]};
 assert.equal(check.rectangle({left:105,right:120,top:105,bottom:120},.5,0,[diamond]),false);
 assert.equal(check.rectangle({left:160,right:240,top:160,bottom:240},.5,0,[diamond]),true);
 diamond.points.reverse();assert.equal(check.rectangle({left:160,right:240,top:160,bottom:240},.5,0,[diamond]),true);
});

test('leader lines crossing a closer board are hidden together with their labels, without blocking clear lines',()=>{
 const check=createLabelOcclusion(),panels=[square(1,.3)];
 assert.equal(check.segment({x:50,y:200},{x:350,y:200},.6,0,panels),true);
 assert.equal(check.segment({x:350,y:200},{x:50,y:200},.6,0,panels),true);
 assert.equal(check.segment({x:50,y:50},{x:350,y:50},.6,0,panels),false);
 assert.equal(check.segment({x:50,y:200},{x:350,y:200},.2,0,panels),false);
 assert.equal(check.segment({x:50,y:200},{x:350,y:200},.6,1,panels),false);
});

test('projected depth agrees with independent ray hits through perspective, drag and exchanged foreground positions',()=>{
 const camera=new T.PerspectiveCamera(36,1361/811,.1,100),geometry=new T.PlaneGeometry(4.7,3.44),material=new T.MeshBasicMaterial({side:T.DoubleSide}),root=new T.Group();
 const meshes=Array.from({length:8},(_,index)=>{const mesh=new T.Mesh(geometry,material);mesh.userData.module=index;root.add(mesh);return mesh;});
 const check=createLabelOcclusion(),ray=new T.Raycaster(),point=new T.Vector3(),anchor=new T.Vector3();let covered=0,clear=0;
 for(const selected of [0,3,7])for(const yaw of [-.42,0,.42])for(const zoom of [.85,1.25]){
  camera.position.set(8,6.4,17.8*zoom);camera.lookAt(-1.2,.5,-.3);camera.updateMatrixWorld(true);root.rotation.set(yaw*.3,yaw,0);
  meshes.forEach((mesh,index)=>{let rel=(index-selected+8)%8;if(rel>4)rel-=8;mesh.position.set(index===selected?2:2+rel*1.45,index===selected?.8:Math.abs(rel)*.14,index===selected?1.35:-2.45-Math.abs(rel)*1.2);mesh.rotation.set(index===selected?-.11:-.16,index===selected?-.25:-.65,index===selected?-.055:0);mesh.scale.setScalar(index===selected?1.38:.86);});root.updateMatrixWorld(true);
  const panels=meshes.map((mesh,index)=>({index,points:[[-2.35,-1.72],[2.35,-1.72],[2.35,1.72],[-2.35,1.72]].map(([x,y])=>{point.set(x,y,0).applyMatrix4(mesh.matrixWorld).project(camera);return {x:point.x,y:point.y,z:point.z};})}));
  for(const [index,mesh] of meshes.entries())for(const y of [0,1,1.97]){
   anchor.set(0,y,0).applyMatrix4(mesh.matrixWorld);const distance=camera.position.distanceTo(anchor);point.copy(anchor).project(camera);ray.setFromCamera(new T.Vector2(point.x,point.y),camera);
   const expected=ray.intersectObjects(meshes.filter(m=>m!==mesh),false).some(hit=>hit.distance<distance-.001);
   assert.equal(check.rectangle({left:point.x,right:point.x,top:point.y,bottom:point.y},point.z,index,panels),expected,`selected=${selected} own=${index} yaw=${yaw} zoom=${zoom} y=${y}`);
   if(expected)covered++;else clear++;
  }
 }
 assert.ok(covered>50&&clear>50,'exercise both occluded and exposed labels');geometry.dispose();material.dispose();
});
