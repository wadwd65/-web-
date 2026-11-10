import * as T from 'three';

/** Bounds of the actual depth-map casters projected along the sun onto the
 * floor. Keep the original light, PCF shader and receiver's sorting position. */
export function shadowFootprint(casters:Iterable<T.Mesh>,light:T.Vector3,floor:number,padding=.75){
 const bounds=new T.Box2(),p=new T.Vector3();
 if(Math.abs(light.y)<.001)throw Error('Shadow light must be above the receiver');
 for(const mesh of casters){
  if(!mesh.castShadow)continue;
  let visible=true;for(let node:T.Object3D|null=mesh;node;node=node.parent)if(!node.visible)visible=false;
  const material=mesh.material as T.Material;if(!visible||!material.visible)continue;
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;if(!box)continue;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   p.set(x,y,z).applyMatrix4(mesh.matrixWorld);const height=(p.y-floor)/light.y;
   bounds.expandByPoint(new T.Vector2(p.x-light.x*height,p.z-light.z*height));
  }
 }
 if(!bounds.isEmpty())bounds.expandByScalar(padding);return bounds;
}

/** Limit only the expensive full-floor shadow fragment pass. Projection close
 * to/behind the near plane conservatively uses the entire viewport. */
export function shadowScissor(bounds:T.Box2,floor:number,camera:T.Camera,width:number,height:number){
 if(bounds.isEmpty())return new T.Vector4(0,0,0,0);
 const projected=new T.Box2(),point=new T.Vector4(),vp=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.y,bounds.max.y]){
  point.set(x,floor,z,1).applyMatrix4(vp);
  if(point.w<=0||point.z/point.w< -1||point.z/point.w>1)return new T.Vector4(0,0,width,height);
  projected.expandByPoint(new T.Vector2((point.x/point.w*.5+.5)*width,(point.y/point.w*.5+.5)*height));
 }
 const left=Math.max(0,Math.floor(projected.min.x)-2),bottom=Math.max(0,Math.floor(projected.min.y)-2),right=Math.min(width,Math.ceil(projected.max.x)+2),top=Math.min(height,Math.ceil(projected.max.y)+2);
 return new T.Vector4(left,bottom,Math.max(0,right-left),Math.max(0,top-bottom));
}

export function scopeShadowReceiver(renderer:T.WebGLRenderer,receiver:T.Mesh,casters:Iterable<T.Mesh>,light:T.Vector3,floor:number){
 let footprint=new T.Box2(),previousTest=false;const size=new T.Vector2(),previous=new T.Vector4(),clipped=new T.Vector4();
 const before=receiver.onBeforeRender,after=receiver.onAfterRender;
 receiver.onBeforeRender=function(...args){
  before.apply(this,args);renderer.getSize(size);previousTest=renderer.getScissorTest();renderer.getScissor(previous);
  clipped.copy(shadowScissor(footprint,floor,args[2],size.x,size.y));
  if(previousTest){const right=Math.min(previous.x+previous.z,clipped.x+clipped.z),top=Math.min(previous.y+previous.w,clipped.y+clipped.w);clipped.x=Math.max(previous.x,clipped.x);clipped.y=Math.max(previous.y,clipped.y);clipped.z=Math.max(0,right-clipped.x);clipped.w=Math.max(0,top-clipped.y);}
  renderer.setScissor(clipped);renderer.setScissorTest(true);
 };
 receiver.onAfterRender=function(...args){renderer.setScissor(previous);renderer.setScissorTest(previousTest);after.apply(this,args);};
 return {capture(){footprint=shadowFootprint(casters,light,floor);},dispose(){receiver.onBeforeRender=before;receiver.onAfterRender=after;}};
}
