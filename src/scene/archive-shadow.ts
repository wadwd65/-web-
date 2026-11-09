import * as T from 'three';

/** Parallel light projection onto the floor. It is an affine transform, so
 * rotating a case moves its whole soft footprint continuously, without a map. */
export function archiveShadowProjection(light:T.Vector3,groundY:number){
 if(!Number.isFinite(groundY)||!Number.isFinite(light.x+light.y+light.z)||Math.abs(light.y)<.001)throw Error('Invalid archive shadow projection');
 const x=light.x/light.y,z=light.z/light.y;
 return new T.Matrix4().set(1,-x,0,groundY*x, 0,0,0,groundY+.012, 0,-z,1,groundY*z, 0,0,0,1);
}

/** A single instanced draw of soft case silhouettes. Approximate grounding,
 * not physical occlusion: no depth-map pass, render target or shadow sampler.
 * The photographed disc, case materials and lights remain independent. */
export function createArchiveShadows(scene:T.Scene,frames:T.Mesh[],light:T.Vector3,groundY:number){
 const geometry=new T.PlaneGeometry(1,1),alpha=new T.InstancedBufferAttribute(new Float32Array(frames.length),1);
 geometry.setAttribute('caseAlpha',alpha);
 const material=new T.ShaderMaterial({
  uniforms:{shadowColor:{value:new T.Color('#020b13')},shadowOpacity:{value:0}},
  vertexShader:`attribute float caseAlpha;
varying vec2 shadowUv;
varying float shadowAlpha;
varying float shadowDepth;
void main(){
 shadowUv=uv;shadowAlpha=caseAlpha;
 vec4 viewPosition=modelViewMatrix*instanceMatrix*vec4(position,1.0);
 shadowDepth=-viewPosition.z;
 gl_Position=projectionMatrix*viewPosition;
}`,
  fragmentShader:`uniform vec3 shadowColor;
uniform float shadowOpacity;
varying vec2 shadowUv;
varying float shadowAlpha;
varying float shadowDepth;
void main(){
 vec2 q=abs(shadowUv-0.5)-vec2(0.368,0.333)+0.045;
 float distanceToCase=length(max(q,0.0))+min(max(q.x,q.y),0.0)-0.045;
 float coverage=1.0-smoothstep(-0.025,0.105,distanceToCase);
 float opacity=coverage*shadowAlpha*shadowOpacity*(1.0-smoothstep(25.0,58.0,shadowDepth));
 if(opacity<0.0001)discard;
 gl_FragColor=vec4(shadowColor,opacity);
 #include <colorspace_fragment>
}`,
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,
 });
 material.forceSinglePass=true;
 const mesh=new T.InstancedMesh(geometry,material,frames.length);
 mesh.name='Archive soft floor shadows';mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=-1;
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);alpha.setUsage(T.DynamicDrawUsage);scene.add(mesh);
 const projection=archiveShadowProjection(light,groundY),local=frames.map(frame=>{
  frame.geometry.computeBoundingBox();const bounds=frame.geometry.boundingBox!,size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  return new T.Matrix4().compose(center,new T.Quaternion(),new T.Vector3(size.x*1.36,size.y*1.50,1));
 });
 const previous=frames.map(()=>new T.Matrix4()),slots:(number|undefined)[]=[],matrix=new T.Matrix4();let disposed=false;
 return {
  mesh,
  update(opacity:(index:number)=>number,strength:number){
   if(disposed)return false;
   material.uniforms.shadowOpacity.value=Number.isFinite(strength)?T.MathUtils.clamp(strength,0,.14):0;
   let count=0,matricesChanged=false,alphaChanged=false;
   for(let index=0;index<frames.length;index++){
    const raw=opacity(index),value=Number.isFinite(raw)?T.MathUtils.clamp(raw,0,1):0;
    if(value<.001)continue;
    matrix.multiplyMatrices(projection,frames[index].matrixWorld).multiply(local[index]);
    if(slots[count]!==index||!previous[count].equals(matrix)){mesh.setMatrixAt(count,matrix);previous[count].copy(matrix);slots[count]=index;matricesChanged=true;}
    if(alpha.getX(count)!==Math.fround(value)){alpha.setX(count,value);alphaChanged=true;}
    count++;
   }
   mesh.count=count;mesh.visible=count>0&&material.uniforms.shadowOpacity.value>.0001;
   if(matricesChanged)mesh.instanceMatrix.needsUpdate=true;
   if(alphaChanged)alpha.needsUpdate=true;
   return matricesChanged||alphaChanged;
  },
  dispose(){if(disposed)return;disposed=true;scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();},
 };
}
