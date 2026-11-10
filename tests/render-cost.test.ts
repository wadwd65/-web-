import test from 'node:test';
import assert from 'node:assert/strict';
import {createStyleWriter} from '../src/scene/style-writer.ts';
import {deferredAsset} from '../src/scene/deferred-asset.ts';
import {createTransformWriter} from '../src/scene/transform-writer.ts';
import {shadowFootprint,shadowScissor,scopeShadowReceiver} from '../src/scene/shadow-receiver.ts';
import * as T from 'three';

test('a bounded shadow receiver contains every projected caster corner through drag and extraction poses',()=>{
 const scene=new T.Scene(),parent=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(4.7,3.4,.3),new T.MeshStandardMaterial());scene.add(parent);parent.add(mesh);mesh.castShadow=true;
 const light=new T.Vector3(-4,11,7),floor=-2.5,camera=new T.PerspectiveCamera(36,16/9,.1,100);camera.position.set(8,6.4,17.8);camera.lookAt(-1.2,.5,-.3);camera.updateMatrixWorld(true);
 for(let n=0;n<100;n++){
  parent.position.set(2+Math.sin(n/10),.8+Math.cos(n/12),1.1);parent.rotation.set(Math.sin(n)*.18,-.25+Math.cos(n)*.42,-.055);parent.scale.setScalar(1.38);scene.updateMatrixWorld(true);
  const bounds=shadowFootprint([mesh],light,floor),clip=shadowScissor(bounds,floor,camera,1920,1080),box=mesh.geometry.boundingBox!;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const point=new T.Vector3(x,y,z).applyMatrix4(mesh.matrixWorld),h=(point.y-floor)/light.y;point.set(point.x-light.x*h,floor,point.z-light.z*h);assert.ok(bounds.containsPoint(new T.Vector2(point.x,point.z)));
   const screen=point.project(camera),sx=(screen.x*.5+.5)*1920,sy=(screen.y*.5+.5)*1080;
   if(sx>=0&&sx<=1920&&sy>=0&&sy<=1080){assert.ok(sx>=clip.x&&sx<=clip.x+clip.z);assert.ok(sy>=clip.y&&sy<=clip.y+clip.w);}
  }
 }
 parent.visible=false;assert.ok(shadowFootprint([mesh],light,floor).isEmpty());parent.visible=true;mesh.castShadow=false;assert.ok(shadowFootprint([mesh],light,floor).isEmpty());mesh.geometry.dispose();(mesh.material as T.Material).dispose();
});

test('shadow clipping safely falls back at the near plane and restores the renderer scissor for subsequent objects',()=>{
 const camera=new T.PerspectiveCamera(36,16/9,.1,100);camera.position.set(0,2,8);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 assert.deepEqual(shadowScissor(new T.Box2(),-2.5,camera,1920,1080).toArray(),[0,0,0,0]);
 assert.deepEqual(shadowScissor(new T.Box2(new T.Vector2(-100,-100),new T.Vector2(100,100)),-2.5,camera,1920,1080).toArray(),[0,0,1920,1080]);
 let enabled=true;const current=new T.Vector4(12,24,1000,600),initial=current.clone(),renderer={getSize:(size:T.Vector2)=>size.set(1920,1080),getScissorTest:()=>enabled,getScissor:(out:T.Vector4)=>out.copy(current),setScissor:(next:T.Vector4)=>current.copy(next),setScissorTest:(value:boolean)=>{enabled=value;}};
 const geometry=new T.PlaneGeometry(120,120),material=new T.ShadowMaterial(),floor=new T.Mesh(geometry,material),before=floor.onBeforeRender,after=floor.onAfterRender;
 const clipping=scopeShadowReceiver(renderer as unknown as T.WebGLRenderer,floor,[],new T.Vector3(-4,11,7),-2.5);clipping.capture();
 floor.onBeforeRender(renderer as unknown as T.WebGLRenderer,new T.Scene(),camera,geometry,material,null);assert.equal(enabled,true);assert.equal(current.z,0);
 floor.onAfterRender(renderer as unknown as T.WebGLRenderer,new T.Scene(),camera,geometry,material,null);assert.deepEqual(current.toArray(),initial.toArray());assert.equal(enabled,true);
 clipping.dispose();assert.equal(floor.onBeforeRender,before);assert.equal(floor.onAfterRender,after);geometry.dispose();material.dispose();
});

test('frozen transforms preserve world poses when their parent translates, rotates and scales',()=>{
 const scene=new T.Scene(),parent=new T.Group(),child=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());scene.add(parent);parent.add(child);child.position.set(2,3,4);
 const write=createTransformWriter();scene.traverse(o=>write(o));scene.updateMatrixWorld(true);
 for(let frame=0;frame<100;frame++){parent.position.set(frame/10,frame/20,-frame/8);parent.rotation.set(frame/60,-frame/80,frame/90);parent.scale.setScalar(1+frame/100);write(parent);scene.updateMatrixWorld();const expected=new T.Matrix4().compose(parent.position,parent.quaternion,parent.scale).multiply(child.matrix);assert.deepEqual(child.matrixWorld.elements,expected.elements);}
 child.geometry.dispose();(child.material as T.Material).dispose();
});

test('unchanged transforms never invalidate world matrices or recompose local matrices',()=>{
 const object=new T.Group(),write=createTransformWriter();let writes=0;const update=object.updateMatrix.bind(object);object.updateMatrix=()=>{writes++;update();};
 assert.equal(write(object),true);object.updateMatrixWorld();for(let n=0;n<500;n++)assert.equal(write(object),false);assert.equal(writes,1);assert.equal(object.matrixWorldNeedsUpdate,false);
 object.position.x=4;assert.equal(write(object),true);assert.equal(writes,2);object.updateMatrixWorld();assert.equal(object.matrixWorld.elements[12],4);assert.equal(write(object),false);
 object.rotation.z=.5;assert.equal(write(object),true);object.scale.y=2;assert.equal(write(object),true);assert.equal(writes,4);
});

test('CSSOM normalization does not cause identical transforms to be written every frame',()=>{
 let writes=0,stored='';const style={};Object.defineProperty(style,'transform',{get:()=>stored,set:(value:string)=>{writes++;stored=value.replaceAll(',',', ');}});
 const node={style} as HTMLElement,write=createStyleWriter();
 for(let frame=0;frame<165;frame++)write(node,'transform','translate3d(100px,200px,0)');
 assert.equal(writes,1);assert.notEqual(stored,'translate3d(100px,200px,0)');
 write(node,'transform','translate3d(101px,200px,0)');assert.equal(writes,2);
});
test('style assignments are independent per element and property',()=>{
 let writes=0;const write=createStyleWriter(()=>writes++),a={style:{}} as HTMLElement,b={style:{}} as HTMLElement;
 write(a,'visibility','hidden');write(b,'visibility','hidden');write(a,'cursor','grab');write(a,'visibility','hidden');assert.equal(writes,3);
});
test('hover prefetch shares bytes but never parses a model; actual opening parses once',async()=>{
 let reads=0,parses=0;const bytes=new ArrayBuffer(16),resource=deferredAsset(async()=>{reads++;return bytes;},async value=>{parses++;assert.equal(value,bytes);return {model:'synthetic'};});
 await Promise.all([resource.prefetch(),resource.prefetch()]);assert.equal(reads,1);assert.equal(parses,0);
 const [a,b]=await Promise.all([resource.load(),resource.load()]);assert.equal(a,b);assert.equal(reads,1);assert.equal(parses,1);
});
test('failed asset downloads or parses can retry without duplicate successful downloads',async()=>{
 let reads=0,parses=0;const resource=deferredAsset(async()=>{if(++reads===1)throw Error('test download failure');return new ArrayBuffer(8);},async()=>{if(++parses===1)throw Error('test parse failure');return 'ready';});
 await assert.rejects(resource.prefetch());await assert.rejects(resource.load());assert.equal(await resource.load(),'ready');assert.equal(reads,2);assert.equal(parses,2);
});
