import * as T from 'three';
import {withArchiveCoverage,setArchiveCoverage} from './archive-coverage.ts';
/** Batch parked cases, but draw a moving case from its actual scene hierarchy.
 * Its shell and disc therefore change pose/visibility together, without a
 * transparent-batch handoff in the middle of extraction or a record change. */
export function batchArchiveMeshes(scene:T.Scene,sources:T.Mesh[],alpha:(mesh:T.Mesh)=>number,direct:(mesh:T.Mesh)=>boolean=()=>false){
 const groups=new Map<string,T.Mesh[]>(),hidden=new T.MeshBasicMaterial({visible:false});
 const originals=new Map(sources.map(mesh=>[mesh,{material:mesh.material as T.Material,castShadow:mesh.castShadow}]));
 for(const mesh of sources){const key=mesh.userData.batchKey as string|undefined;if(key){const group=groups.get(key)??[];group.push(mesh);groups.set(key,group);}}
 const sets:{sources:T.Mesh[];solid:T.InstancedMesh;fade:T.InstancedMesh;fadeMaterial:T.Material;last:T.Matrix4[];slots:(T.Mesh|null)[]}[]=[];
 for(const meshes of groups.values()){
  const source=meshes[0].material as T.Material,base=source.clone(),fadeMaterial=source.clone();
  // Material.clone does not copy shader callbacks. Preserve the designed CD
  // surface, and keep instance/non-instance program state on separate materials.
  for(const material of [base,fadeMaterial]){material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;}
  // Keep solid layers opaque/depth-writing through the same coverage mask.
  // Per-layer alpha blending makes the back-row discs show through their shells.
  withArchiveCoverage(fadeMaterial);fadeMaterial.forceSinglePass=true;
  const solid=new T.InstancedMesh(meshes[0].geometry,base,meshes.length),fade=new T.InstancedMesh(meshes[0].geometry,fadeMaterial,meshes.length);
  solid.castShadow=meshes[0].castShadow;for(const batch of [solid,fade]){batch.frustumCulled=false;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);batch.count=0;scene.add(batch);}
  for(const mesh of meshes){mesh.material=hidden;mesh.castShadow=false;}
  sets.push({sources:meshes,solid,fade,fadeMaterial,last:meshes.map(()=>new T.Matrix4()),slots:meshes.map(()=>null)});
 }
 const position=new T.Vector3();let directParts=0;
 function update(camera:T.Camera){
  directParts=0;
  for(const set of sets){let n=0,dirty=false;const fading:{mesh:T.Mesh;alpha:number;depth:number}[]=[];
   for(const mesh of set.sources){
    const original=originals.get(mesh)!,drawDirect=direct(mesh);mesh.material=drawDirect?original.material:hidden;mesh.castShadow=drawDirect&&original.castShadow;
    let visible=true;for(let p:T.Object3D|null=mesh;p;p=p.parent)if(!p.visible){visible=false;break;}const a=alpha(mesh);if(!visible||a<.001)continue;
    if(drawDirect){directParts++;continue;}
    if(a<.999){position.setFromMatrixPosition(mesh.matrixWorld);fading.push({mesh,alpha:a,depth:position.distanceToSquared(camera.position)});continue;}
    if(set.slots[n]!==mesh||!set.last[n].equals(mesh.matrixWorld)){set.solid.setMatrixAt(n,mesh.matrixWorld);set.last[n].copy(mesh.matrixWorld);set.slots[n]=mesh;dirty=true;}n++;
   }
   set.solid.count=n;set.solid.visible=n>0;if(dirty)set.solid.instanceMatrix.needsUpdate=true;
   // All parked cases share one screen-space coverage; layers keep occlusion.
   fading.sort((a,b)=>b.depth-a.depth);set.fade.count=fading.length;set.fade.visible=fading.length>0;
   if(fading.length){setArchiveCoverage(set.fadeMaterial,fading[0].alpha);fading.forEach((value,i)=>set.fade.setMatrixAt(i,value.mesh.matrixWorld));set.fade.instanceMatrix.needsUpdate=true;}
  }
 }
 return {update,batches:sets.flatMap(s=>[s.solid,s.fade]),directParts:()=>directParts,materials:()=>[...originals.values()].map(o=>o.material),warm(){
  // Compile and upload both render paths while the loading surface still covers
  // the canvas. No first-use shader/vertex upload is deferred to a click.
  for(const [mesh,original] of originals){mesh.material=original.material;mesh.castShadow=original.castShadow;}
  for(const set of sets){set.fade.visible=true;set.fade.count=1;setArchiveCoverage(set.fadeMaterial,.5);set.fade.setMatrixAt(0,set.sources[0].matrixWorld);set.fade.instanceMatrix.needsUpdate=true;}
 },dispose(){for(const set of sets){set.solid.dispose();set.fade.dispose();scene.remove(set.solid,set.fade);}hidden.dispose();}};
}
