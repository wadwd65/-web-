import * as T from 'three';
import {musicEdition} from './music-artwork.ts';
/** A fixed particle buffer and one light plane; changing editions only changes
 * uniforms. No video, new renderer, frame-by-frame texture or React updates. */
export function createMusicAtmosphere(scene:T.Scene){
 const uniforms={uTime:{value:0},uMode:{value:0},uTint:{value:new T.Color(musicEdition(0).accent)},uPointer:{value:new T.Vector2()},uActive:{value:0},uClick:{value:10},uClickPoint:{value:new T.Vector2()}};
 const common=`uniform float uTime;uniform float uMode;uniform vec3 uTint;uniform vec2 uPointer;uniform float uActive;uniform float uClick;uniform vec2 uClickPoint;float w(float n){return max(0.,1.-abs(uMode-n));}`;
 const count=1040,positions=new Float32Array(count*3),seeds=new Float32Array(count);let seed=51243;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<count;n++){positions[n*3]=(random()-.5)*66;positions[n*3+1]=(random()-.5)*34+4;positions[n*3+2]=-7-random()*28;seeds[n]=random();}
 const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(positions,3)).setAttribute('aSeed',new T.BufferAttribute(seeds,1));
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:`${common}attribute float aSeed;varying float vAlpha;varying float vStretch;void main(){
   vec3 p=position;float t=uTime;
   p.x+=w(0.)*sin(t*.16+aSeed*8.)*.20;
   p.x+=w(1.)*(mod(position.x+t*.46+45.,80.)-40.-position.x);p.y+=w(1.)*sin(t*.24+aSeed*6.)*.5;
   p.y+=w(2.)*(mod(position.y+t*.55+24.,42.)-17.-position.y);
   p.xy+=w(3.)*normalize(position.xy+vec2(.01))*sin(t*.45-length(position.xy)*.15)*.25;
   p.xy+=w(4.)*vec2(sin(t*.22+aSeed*12.)*1.4,cos(t*.19+aSeed*9.)*.8);
   vec2 mouse=uPointer*vec2(31.,17.);vec2 delta=p.xy-mouse;float d=length(delta);float proximity=exp(-d*d*.035)*uActive;p.xy+=normalize(delta+vec2(.001))*proximity*1.3;
   float ripple=exp(-abs(length(p.xy-uClickPoint*vec2(31.,17.))-uClick*5.)*1.5)*exp(-uClick*1.2);p.xy+=normalize(p.xy-uClickPoint*vec2(31.,17.)+vec2(.001))*ripple*.4;
   vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((88./max(1.,-mv.z))*(.55+aSeed*.6),1.,5.);
   vAlpha=.20+aSeed*.20+proximity*.48+ripple*.25;vStretch=w(1.)*.5+w(2.)*.8;
  }`,
  fragmentShader:`${common}varying float vAlpha;varying float vStretch;void main(){vec2 q=gl_PointCoord-.5;q.x*=1.+vStretch;float d=length(q);if(d>.48)discard;gl_FragColor=vec4(uTint,vAlpha*smoothstep(.48,.06,d));#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const particles=new T.Points(geometry,material);particles.frustumCulled=false;scene.add(particles);
 const lightGeometry=new T.PlaneGeometry(140,82),lightMaterial=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`${common}varying vec2 vUv;void main(){vec2 q=vUv-.5;float t=uTime;
   float scan=pow(max(0.,sin(q.y*25.-t*.70)),35.)*.32;
   float cloud=exp(-pow((q.y+.07+sin(q.x*4.+t*.07)*.025)*19.,2.))*(.6+.3*sin(q.x*4.-t*.08));
   float rise=pow(max(0.,sin(q.x*26.+q.y*2.+t*.10)),22.)*exp(-abs(q.x)*4.);
   float rings=pow(max(0.,sin(length(q-vec2(.04,.0))*62.-t*.55)),16.)*exp(-length(q)*5.);
   float drift=exp(-pow((q.y-sin(q.x*9.+t*.10)*.07)*16.,2.));
   float field=(w(0.)*scan+w(1.)*cloud*.38+w(2.)*rise*.26+w(3.)*rings*.26+w(4.)*drift*.29)*smoothstep(.48,.03,length(q));
   gl_FragColor=vec4(uTint,field);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 const light=new T.Mesh(lightGeometry,lightMaterial);light.position.set(3,4,-33);scene.add(light);
 const tint=new T.Color();let time=0;
 return {uniforms,update(dt:number,index:number,pointer:T.Vector2,active:boolean,reduced:boolean){time+=reduced?0:dt;uniforms.uTime.value=time;uniforms.uMode.value=T.MathUtils.damp(uniforms.uMode.value,index,3.8,dt);uniforms.uTint.value.lerp(tint.set(musicEdition(index).accent),1-Math.exp(-3*dt));uniforms.uPointer.value.lerp(pointer,1-Math.exp(-6*dt));uniforms.uActive.value=T.MathUtils.damp(uniforms.uActive.value,active&&!reduced?1:0,6,dt);uniforms.uClick.value+=reduced?10:dt;},click(pointer:T.Vector2){uniforms.uClick.value=0;uniforms.uClickPoint.value.copy(pointer);},dispose(){scene.remove(particles,light);geometry.dispose();material.dispose();lightGeometry.dispose();lightMaterial.dispose();}};
}
