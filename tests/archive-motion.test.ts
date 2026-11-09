import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveEase,archiveStages,archiveBrowse,archiveLayers,archiveNeedsRetarget,advanceArchiveTime,ARCHIVE_SPACE,ARCHIVE_MOTION_MS,spectrumBands} from '../src/archive-motion.ts';
import {createRenderCadence} from '../src/scene/render-cadence.ts';
import {batchArchiveMeshes} from '../src/scene/archive-batch.ts';
import {withArchiveCoverage,setArchiveCoverage,getArchiveCoverage} from '../src/scene/archive-coverage.ts';
import {disposeAfterPreparation} from '../src/scene/deferred-asset.ts';
import {archiveShadowProjection,createArchiveShadows} from '../src/scene/archive-shadow.ts';
import {createArchiveDrag} from '../src/scene/archive-drag.ts';
import * as T from 'three';

const leftPress={pointerId:10,button:0,isPrimary:true,x:100,y:100,index:3};

test('each of the eight cases can be dragged without changing any other case target',()=>{
 const drag=createArchiveDrag(8);
 for(let index=0;index<8;index++){
  const before=structuredClone(drag.poses);
  assert.equal(drag.begin({...leftPress,index}),true);
  assert.equal(drag.move({pointerId:10,x:150,y:120}),true);
  for(let other=0;other<8;other++)if(other!==index)assert.deepEqual(drag.poses[other],before[other]);
  assert.ok(drag.poses[index].yaw>before[index].yaw);
  assert.equal(drag.finish({pointerId:10,button:0,x:150,y:120,index,inside:true}),null,'drag release must not open details');
 }
});

test('incremental movement is measured from the press, with bounded repeatable poses',()=>{
 const drag=createArchiveDrag(8);drag.begin(leftPress);
 for(let x=101;x<=106;x++)assert.equal(drag.move({pointerId:10,x,y:100}),false);
 assert.deepEqual(drag.poses[3],{pitch:0,yaw:0});
 assert.equal(drag.move({pointerId:10,x:107,y:100}),true);
 drag.move({pointerId:10,x:1100,y:-900});assert.deepEqual(drag.poses[3],{pitch:-.18,yaw:.30});
 drag.move({pointerId:10,x:-900,y:1100});assert.deepEqual(drag.poses[3],{pitch:.18,yaw:-.30});
 drag.move({pointerId:10,x:100,y:100});assert.deepEqual(drag.poses[3],{pitch:0,yaw:0});
 assert.equal(drag.finish({pointerId:10,button:0,x:100,y:100,index:3,inside:true}),null,'returning to the origin does not turn a completed drag back into a click');
});

test('only the primary left pointer can own a case; unrelated pointers cannot steal or release it',()=>{
 const drag=createArchiveDrag(8);
 for(const event of [{...leftPress,button:2},{...leftPress,isPrimary:false},{...leftPress,index:-1},{...leftPress,index:8},{...leftPress,index:NaN}])assert.equal(drag.begin(event),false);
 assert.equal(drag.begin(leftPress),true);
 assert.equal(drag.begin({...leftPress,pointerId:11,index:2}),false);
 assert.equal(drag.move({pointerId:11,x:400,y:400}),false);
 assert.equal(drag.finish({pointerId:11,button:0,x:100,y:100,index:3,inside:true}),null);
 drag.cancel(11);assert.equal(drag.press?.index,3);
 assert.equal(drag.finish({pointerId:10,button:2,x:100,y:100,index:3,inside:true}),null);
 assert.equal(drag.press?.index,3);
 assert.equal(drag.finish({pointerId:10,button:0,x:102,y:101,index:3,inside:true}),3);
 assert.equal(drag.press,null);
});

test('blank, cross-record, outside, cancelled and moved releases never open a case',()=>{
 const drag=createArchiveDrag(8),release={pointerId:10,button:0,x:100,y:100,index:3,inside:true};
 for(const event of [{...release,index:-1},{...release,index:4},{...release,inside:false},{...release,x:107}]){drag.begin(leftPress);assert.equal(drag.finish(event),null);assert.equal(drag.press,null);}
 drag.begin(leftPress);drag.cancel();assert.equal(drag.finish(release),null);
 drag.begin(leftPress);drag.move({pointerId:10,x:145,y:122});drag.reset();
 assert.equal(drag.press,null);assert.ok(drag.poses.every(p=>p.pitch===0&&p.yaw===0));
 assert.equal(drag.finish(release),null,'a mode transition cancels the outstanding pointer');
});

test('soft case shadows project onto the floor along the original light direction at every angle',()=>{
 const scene=new T.Scene(),parent=new T.Group(),frame=new T.Mesh(new T.BoxGeometry(6,4.4,.2),new T.MeshBasicMaterial());parent.add(frame);scene.add(parent);
 const light=new T.Vector3(-7,9,9),floor=-2.65,projection=archiveShadowProjection(light,floor),shadows=createArchiveShadows(scene,[frame],light,floor),matrix=new T.Matrix4();
 for(let n=0;n<240;n++){
  parent.position.set(n/100,.28+Math.sin(n/20)*.3,3.2);parent.rotation.set(Math.sin(n/30)*.27,Math.cos(n/30)*.55,0);scene.updateMatrixWorld(true);shadows.update(()=>1,.14);shadows.mesh.getMatrixAt(0,matrix);
  for(const x of [-.5,.5])for(const y of [-.5,.5]){const p=new T.Vector3(x,y,0).applyMatrix4(matrix);assert.ok(Math.abs(p.y-(floor+.012))<.00001);}
  const center=new T.Vector3().setFromMatrixPosition(frame.matrixWorld),actual=new T.Vector3().setFromMatrixPosition(matrix),expected=center.clone().applyMatrix4(projection);assert.ok(actual.distanceTo(expected)<.00001);
 }
 assert.throws(()=>archiveShadowProjection(new T.Vector3(1,0,1),floor));shadows.dispose();frame.geometry.dispose();(frame.material as T.Material).dispose();
});

test('shadow footprints follow each rendered pose rather than a clock, and unchanged poses skip uploads',()=>{
 const scene=new T.Scene(),frame=new T.Mesh(new T.BoxGeometry(6,4,.1),new T.MeshBasicMaterial());scene.add(frame);const shadows=createArchiveShadows(scene,[frame],new T.Vector3(-7,9,9),-2.65);
 scene.updateMatrixWorld(true);shadows.update(()=>1,.14);const initial=shadows.mesh.instanceMatrix.version;
 for(let n=0;n<20;n++){frame.rotation.y+=.001;scene.updateMatrixWorld(true);assert.equal(shadows.update(()=>1,.14),true);}
 assert.equal(shadows.mesh.instanceMatrix.version,initial+20,'every visible drag pose gets its matching footprint');
 const stable=shadows.mesh.instanceMatrix.version;for(let n=0;n<120;n++)assert.equal(shadows.update(()=>1,.14),false);assert.equal(shadows.mesh.instanceMatrix.version,stable);
 shadows.update(()=>1,0);assert.equal(shadows.mesh.visible,false,'transition envelope can hide the shadow before travel');shadows.update(()=>1,.14);assert.equal(shadows.mesh.visible,true);
 shadows.dispose();shadows.dispose();assert.ok(!scene.children.includes(shadows.mesh));frame.geometry.dispose();(frame.material as T.Material).dispose();
});

test('hidden and reselected records cannot leave stale instances or opacity in the shadow batch',()=>{
 const scene=new T.Scene(),geometry=new T.BoxGeometry(6,4,.1),material=new T.MeshBasicMaterial(),frames=Array.from({length:8},(_,i)=>{const m=new T.Mesh(geometry,material);m.position.x=i*3;scene.add(m);return m;});const shadows=createArchiveShadows(scene,frames,new T.Vector3(-7,9,9),-2.65),alpha=shadows.mesh.geometry.getAttribute('caseAlpha');scene.updateMatrixWorld(true);
 shadows.update(()=>1,.085);assert.equal(shadows.mesh.count,8);
 for(const selected of [7,0,3,7,2]){shadows.update(i=>i===selected?.4:0,.14);assert.equal(shadows.mesh.count,1);assert.ok(Math.abs(alpha.getX(0)-.4)<.00001);const matrix=new T.Matrix4();shadows.mesh.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[12]-(selected*3+2.65*7/9))<.00001);}
 shadows.update(()=>0,.14);assert.equal(shadows.mesh.count,0);assert.equal(shadows.mesh.visible,false);
 shadows.update(()=>1,NaN);assert.equal(shadows.mesh.visible,false);shadows.dispose();geometry.dispose();material.dispose();
});

test('list navigation is a preview; requests during docking keep only their latest intent',()=>{
 assert.equal(archiveNeedsRetarget({busy:false,kind:'return',detail:false,active:2},{detail:false,selected:7}),false);
 assert.equal(archiveNeedsRetarget({busy:true,kind:'return',detail:false,active:2},{detail:true,selected:7}),false);
 assert.equal(archiveNeedsRetarget({busy:false,kind:'return',detail:false,active:2},{detail:true,selected:7}),true);
 assert.equal(archiveNeedsRetarget({busy:true,kind:'browse',detail:true,active:2},{detail:true,selected:7}),false);
 assert.equal(archiveNeedsRetarget({busy:false,kind:'browse',detail:true,active:2},{detail:true,selected:7}),true);
 assert.equal(archiveNeedsRetarget({busy:true,kind:'browse',detail:true,active:2},{detail:false,selected:7}),false);
});

test('collection cases are invisible for the entire travelling interval, in both directions',()=>{
 for(const kind of ['enter','return'] as const)for(let n=0;n<=1000;n++){
  const t=n/1000,s=archiveStages(kind,t),others=kind==='enter'?s.fadeOut:s.reveal;
  if(s.move>0&&s.move<1)assert.equal(others,0,`${kind} t=${t}: another case entered the travelling path`);
  if(kind==='return'&&s.move>0)assert.equal(s.open,1,'the disc must retract before docking travel');
 }
});

test('each changing record remains closed during travel; the receding and incoming cases never intersect',()=>{
 for(let n=0;n<=1000;n++){
  const t=n/1000,s=archiveStages('browse',t),b=archiveBrowse(t);
  if(s.move>0&&s.move<1)assert.equal(s.open,0,'incoming disc opens only after its complete case docks');
  if(b.outMove>0)assert.equal(b.outClose,1,'outgoing disc retracts before its case leaves');
  if(b.outVisible&&b.inVisible){const old=new T.Vector3(...ARCHIVE_SPACE.detail).lerp(new T.Vector3(...ARCHIVE_SPACE.outgoing),b.outMove),next=new T.Vector3(...ARCHIVE_SPACE.incoming).lerp(new T.Vector3(...ARCHIVE_SPACE.detail),s.move);const gap=old.distanceTo(next)-ARCHIVE_SPACE.radius*2;assert.ok(gap>0,`two complete cases intersect at ${t}`);}
  if(s.move<1)assert.ok(b.outVisible,'the old complete case stays behind the next until it docks');
  const enter=archiveStages('enter',t);if(enter.move>0&&enter.move<1)assert.equal(enter.open,0,'extract the entire closed case first');
 }
 assert.equal(archiveStages('browse',1).open,1);assert.equal(archiveStages('enter',1).open,1);
});

test('a stalled or resumed browser cannot consume an entire assembly animation in one frame',()=>{
 assert.equal(advanceArchiveTime(0,1000/60),1000/60);assert.equal(advanceArchiveTime(0,1000/45),1000/45);
 assert.equal(advanceArchiveTime(100,5000),150);assert.equal(advanceArchiveTime(900,1000),ARCHIVE_MOTION_MS);assert.equal(advanceArchiveTime(100,-1),100);
});
test('the visible glass cover never intersects the printed disc while opening or closing',()=>{
 for(let n=0;n<=1000;n++){const open=n/1000,s=archiveLayers(open);if(s.lidVisible&&s.lidOpacity>.001)assert.ok(s.lidZ+.20691891029823264>s.discZ+.08+.02,`overlap at ${open}`);}
 assert.equal(archiveLayers(1).discZ,.78);assert.equal(archiveLayers(0).discZ,.27);
});
test('native cadence preserves every actual callback on slow GPUs and high-refresh displays',()=>{
 for(const hz of [30,45,60,120,144,165,240]){const c=createRenderCadence();let rendered=0;for(let n=0;n<hz*4;n++){const due=c.due(n*1000/hz);if(n>=hz*2&&due)rendered++;}assert.equal(rendered/2,hz);assert.equal(c.state().stride,1);assert.ok(Math.abs(c.state().refreshHz-hz)<.01);c.reset();assert.ok(c.due(10000));assert.ok(c.due(10016.7));}
});
test('opaque and fading batches preserve poses, skip hidden instances and sort fades back to front',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera();camera.position.z=20;const geometry=new T.BoxGeometry(1,2,.2),mat=new T.MeshStandardMaterial(),values=[1,1,.5,.5];
 const meshes=values.map((_,i)=>{const m=new T.Mesh(geometry,mat.clone());m.position.set(i,0,-i);m.userData={batchKey:'shell',index:i};scene.add(m);return m;});
 const batching=batchArchiveMeshes(scene,meshes,m=>values[m.userData.index]);scene.updateMatrixWorld(true);batching.update(camera);const [solid,fade]=batching.batches;assert.equal(solid.count,2);assert.equal(fade.count,2);assert.equal(getArchiveCoverage(fade.material as T.Material),.5);assert.equal((fade.material as T.Material).opacity,1);assert.equal((fade.material as T.Material).transparent,false);assert.equal((fade.material as T.Material).depthWrite,true);
 const pose=new T.Matrix4();fade.getMatrixAt(0,pose);assert.equal(pose.elements[14],-3);values[1]=values[2]=values[3]=0;batching.update(camera);assert.equal(solid.count,1);assert.equal(fade.count,0);
 const version=solid.instanceMatrix.version;batching.update(camera);assert.equal(solid.instanceMatrix.version,version);batching.dispose();geometry.dispose();mat.dispose();
});

test('a moving shell and disc hand off atomically between the hierarchy and batches without changing pose',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),geometry=new T.BoxGeometry(),values=[1,1,1];let moving=-1;
 const roots=values.map((_,i)=>{const group=new T.Group();group.position.set(i*7,0,-i);scene.add(group);return group;});
 const sources=roots.flatMap((group,index)=>['shell','disc'].map((part,p)=>{const material=new T.MeshStandardMaterial();material.name=part;const mesh=new T.Mesh(geometry,material);mesh.position.z=p*.4;mesh.userData={index,batchKey:part};mesh.castShadow=true;group.add(mesh);return mesh;}));
 const originals=sources.map(m=>m.material),batching=batchArchiveMeshes(scene,sources,m=>values[m.userData.index],m=>m.userData.index===moving);
 scene.updateMatrixWorld(true);batching.update(camera);assert.equal(batching.directParts(),0);
 for(const index of [2,0,1,2,-1,0,-1]){
  moving=index;
  for(let frame=0;frame<=30;frame++){
   if(index>=0)roots[index].position.y=frame/30;
   scene.updateMatrixWorld(true);batching.update(camera);
   assert.equal(batching.directParts(),index<0?0:2);
   sources.forEach((m,i)=>assert.equal((m.material as T.Material).visible,m.userData.index===moving));
   if(index>=0){assert.equal(sources[index*2].material,originals[index*2]);assert.equal(sources[index*2+1].material,originals[index*2+1]);assert.equal(sources[index*2].matrixWorld.elements[13],sources[index*2+1].matrixWorld.elements[13]);}
   assert.equal(batching.batches.reduce((n,b)=>n+(b.visible?b.count:0),0),index<0?6:4,'no source is duplicated in both render paths');
  }
 }
 batching.dispose();geometry.dispose();
});

test('batch materials retain the optical shader while isolating instance and loose-mesh program state',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),material);mesh.userData.batchKey='disc';scene.add(mesh);
 const hook=()=>{};material.onBeforeCompile=hook;material.customProgramCacheKey=()=> 'disc-regression';
 const batching=batchArchiveMeshes(scene,[mesh],()=>1);
 for(const [i,batch] of batching.batches.entries()){assert.notEqual(batch.material,material);if(i===0)assert.equal((batch.material as T.Material).onBeforeCompile,hook);assert.equal((batch.material as T.Material).customProgramCacheKey(),i===0?'disc-regression':'disc-regression:archive-screen-coverage-v1');}
 batching.warm();assert.equal(mesh.material,material,'prepare loose-mesh shader before any click');batching.update(new T.Camera());assert.equal((mesh.material as T.Material).visible,false);batching.dispose();mesh.geometry.dispose();material.dispose();
});

test('case fades share a screen-space mask without weakening solid occlusion or the optical shader',()=>{
 const material=new T.MeshStandardMaterial({opacity:1,transparent:false,depthWrite:true});let opticalHook=0;
 material.onBeforeCompile=shader=>{opticalHook++;shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n// optical-surface');};material.customProgramCacheKey=()=> 'original-optical';
 withArchiveCoverage(material);withArchiveCoverage(material);setArchiveCoverage(material,.4);
 const shader={uniforms:{},vertexShader:'',fragmentShader:'#include <common>\n#include <alphatest_fragment>'} as unknown as T.WebGLProgramParametersWithUniforms;
 material.onBeforeCompile(shader,{} as T.WebGLRenderer);
 assert.equal(opticalHook,1);assert.equal(shader.uniforms.uArchiveCoverage.value,.4);assert.ok(shader.fragmentShader.includes('// optical-surface'));assert.ok(shader.fragmentShader.includes('floor(gl_FragCoord.xy)'));assert.ok(shader.fragmentShader.includes('discard'));
 assert.equal(material.opacity,1);assert.equal(material.transparent,false);assert.equal(material.depthWrite,true);
 setArchiveCoverage(material,1);assert.equal(shader.uniforms.uArchiveCoverage.value,1);setArchiveCoverage(material,NaN);assert.equal(getArchiveCoverage(material),0);material.dispose();
});
test('GPU resources survive a mode switch until asynchronous shader preparation finishes',async()=>{
 let ready!:()=>void,released=0;const pending=new Promise<void>(resolve=>{ready=resolve;}),dispose=disposeAfterPreparation(pending,()=>released++);dispose();assert.equal(released,0);ready();await pending;dispose();assert.equal(released,1);
});

test('archive motion finishes at a fixed deadline with no overshoot or residual tail',()=>{
 assert.equal(archiveEase(-200),0);assert.equal(archiveEase(0),0);assert.equal(archiveEase(ARCHIVE_MOTION_MS),1);assert.equal(archiveEase(ARCHIVE_MOTION_MS*8),1);
 let previous=0;for(let ms=0;ms<=ARCHIVE_MOTION_MS;ms++){const p=archiveEase(ms);assert.ok(p>=previous&&p<=1);previous=p;}
 // Restarting from the actual rendered pose is continuous on an interrupted move.
 const halfway=archiveEase(390),from=4+(12-4)*halfway;assert.equal(from+(2-from)*archiveEase(0),from);assert.equal(from+(2-from)*archiveEase(ARCHIVE_MOTION_MS),2);
});
test('spectrum uses the supplied audio bytes and returns quiet, bounded output',()=>{
 assert.ok(spectrumBands(new Uint8Array()).every(x=>x===0));assert.ok(spectrumBands(new Uint8Array(512)).every(x=>x===0));assert.ok(spectrumBands(new Uint8Array(512).fill(255)).every(x=>x===1));
 const bins=new Uint8Array(512);bins.fill(180,0,30);const values=spectrumBands(bins);assert.equal(values.length,40);assert.ok(values.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.ok(values[0]>values[39]);
});
