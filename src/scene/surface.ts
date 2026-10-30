import * as THREE from 'three';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createArchitecture} from './architecture.ts';
export const COUNT=42000;
export const noise=`float grain(vec3 p){return fract(sin(dot(floor(p*8.),vec3(12.9898,78.233,39.425)))*43758.5453);}`;
export const smooth=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
export const rand=(seed:number)=>()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
export type Space=ReturnType<typeof createArchitecture>&{points:Float32Array;colours:Float32Array;dissolve:{value:number};min:number;span:number};
/** Bake actual scene meshes before area-weighted sampling. Image/depth maps are never used. */
export function prepareSpace(index:number):Space{
 const architecture=createArchitecture(index);architecture.group.updateMatrixWorld(true);
 const pieces:THREE.BufferGeometry[]=[];
 architecture.group.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!object.userData.dissolve)return;
  const source=object.geometry.clone().applyMatrix4(object.matrixWorld),geometry=source.index?source.toNonIndexed():source;
  if(geometry!==source)source.dispose();
  const position=geometry.getAttribute('position'),colours=new Float32Array(position.count*3);
  const material=(Array.isArray(object.material)?object.material[0]:object.material) as THREE.MeshStandardMaterial;
  const colour=material.color?.clone()??new THREE.Color('#bac8d8'),vertexColour=geometry.getAttribute('color'),mixed=new THREE.Color();
  for(let n=0;n<position.count;n++){mixed.copy(colour);if(material.vertexColors&&vertexColour)mixed.multiply(new THREE.Color(vertexColour.getX(n),vertexColour.getY(n),vertexColour.getZ(n)));mixed.toArray(colours,n*3);}
  const weights=new Float32Array(position.count).fill(object.userData.sampleWeight??1);
  const clean=new THREE.BufferGeometry();clean.setAttribute('position',position.clone());clean.setAttribute('color',new THREE.BufferAttribute(colours,3));clean.setAttribute('sampleWeight',new THREE.BufferAttribute(weights,1));pieces.push(clean);geometry.dispose();
 });
 const merged=mergeGeometries(pieces,false);pieces.forEach(item=>item.dispose());if(!merged)throw new Error('No architectural mesh');
 merged.computeBoundingBox();const box=merged.boundingBox!;
 const sampler=new MeshSurfaceSampler(new THREE.Mesh(merged));
 // Runtime r183 includes this method; its matching DefinitelyTyped declaration omits it.
 (sampler as MeshSurfaceSampler & {setRandomGenerator:(random:()=>number)=>MeshSurfaceSampler}).setRandomGenerator(rand(1921+index*1049));sampler.setWeightAttribute('sampleWeight').build();
 const point=new THREE.Vector3(),colour=new THREE.Color(),samples:{p:number[];c:number[];key:number}[]=[];
 for(let n=0;n<COUNT;n++){sampler.sample(point,undefined,colour);samples.push({p:point.toArray(),c:colour.toArray(),key:Math.floor((point.y-box.min.y)*5)*100000+Math.floor((point.z-box.min.z)*5)*200+Math.floor((point.x-box.min.x)*5)});}
 samples.sort((a,b)=>a.key-b.key);const positions=new Float32Array(COUNT*3),colours=new Float32Array(COUNT*3);
 samples.forEach((p,n)=>{positions.set(p.p,n*3);colours.set(p.c,n*3);});merged.dispose();
 const dissolve={value:0},min=box.min.y,span=box.max.y-box.min.y,map=new Map<THREE.Material,THREE.Material>();
 architecture.group.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||!object.userData.dissolve)return;
  const originals=Array.isArray(object.material)?object.material:[object.material];
  const compile=(shader:THREE.WebGLProgramParametersWithUniforms)=>{
    shader.uniforms.uDissolve=dissolve;shader.uniforms.uFloor={value:min};shader.uniforms.uSpan={value:span};
    shader.vertexShader='varying vec3 vSurfacePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfacePosition=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=`varying vec3 vSurfacePosition;uniform float uDissolve,uFloor,uSpan;${noise}\n`+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nfloat scan=(vSurfacePosition.y-uFloor+.22*grain(vSurfacePosition))/(uSpan+.23);if(uDissolve>0.&&scan<uDissolve)discard;`);
   };
  const materials=originals.map(original=>{if(map.has(original))return map.get(original)!;const material=original.clone();material.onBeforeCompile=compile;material.customProgramCacheKey=()=>`architecture-surface-v014`;map.set(original,material);return material;});
  object.material=Array.isArray(object.material)?materials:materials[0];object.castShadow=true;object.receiveShadow=true;
  object.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});object.customDepthMaterial.onBeforeCompile=compile;object.customDepthMaterial.customProgramCacheKey=()=>`architecture-depth-v014`;
 });
 map.forEach((_copy,original)=>original.dispose());
 return {...architecture,points:positions,colours,dissolve,min,span};
}
export const pointVertex=`
uniform float uMorph,uFrom,uTo,uTime,uSize,uCloud,uMotion,uUnobstructed;uniform vec2 uPointer;uniform vec4 uBounds;
attribute vec3 aTarget,aColour,aTargetColour;attribute float aSeed,aIndex;varying vec3 vColour;varying float vAlpha;
${noise}
void main(){
 float t=uMorph,w=sin(t*3.14159265);vec3 p=mix(position,aTarget,t);
 float strand=(floor(aSeed*4.)-1.5)*.14;
 vec3 flow=vec3(-5.+aIndex*12.,4.+sin(aIndex*5.1-.6)*1.15+strand+sin(aSeed*47.)*.025,sin(aIndex*3.14159)*4.-4.+(aSeed-.5)*.16);
 p=mix(p,flow,w*w*.985);
 float ta=(position.y-uBounds.x+.22*grain(position))/(uBounds.y+.23);
 float tb=(aTarget.y-uBounds.z+.22*grain(aTarget))/(uBounds.w+.23);
 float a=smoothstep(ta-.025,ta+.035,uFrom),b=smoothstep(tb-.025,tb+.035,uTo);
 float alpha=max(mix(a,b,t),uCloud);vec4 mv=modelViewMatrix*vec4(p,1.);vec4 clip=projectionMatrix*mv;
 vec2 d=clip.xy/clip.w-uPointer;d.x*=1.5;float near=exp(-dot(d,d)*18.);
 p+=vec3(d.x,d.y,sin(aSeed*50.))*near*.25*uMotion;p.y+=sin(uTime*.6+aSeed*60.)*.025*uCloud*uMotion;
 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uSize*(.75+aSeed*.65)*(1.-w*.30)*25./max(5.,-mv.z),.7,4.5);
 vColour=mix(mix(aColour,aTargetColour,t)*.35,vec3(.012,.12,.49),.78);vec3 lightColour=mix(vec3(.18,.49,.8),vec3(.012,.1,.4),step(.93,aSeed));vColour=mix(vColour,lightColour,w*.78);vAlpha=alpha*(.88+near*.12)*(1.-w*.62);
 vAlpha*=mix(smoothstep(-.34,.05,gl_Position.x/gl_Position.w),1.,uUnobstructed);
}`;
export const pointFragment=`varying vec3 vColour;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.||vAlpha<.005)discard;gl_FragColor=vec4(vColour,vAlpha*(1.-smoothstep(.35,1.,r)));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`;
