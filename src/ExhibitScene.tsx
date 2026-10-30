import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {COUNT,prepareSpace,pointVertex,pointFragment,rand,smooth} from './scene/surface.ts';
import type {Space} from './scene/surface.ts';
import {createContext} from './scene/context.ts';
type Props={selected:number;working:boolean;particles:boolean;paused?:boolean;cinema?:boolean;reset:number;onReady:()=>void;onFailure:()=>void;onPhase?:(phase:string)=>void};
export default function ExhibitScene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props);latest.current=props;
 useEffect(()=>{
  const container=host.current;if(!container)return;
  let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch{latest.current.onFailure();return;}
  const events=new AbortController(),reduced=matchMedia('(prefers-reduced-motion: reduce)');let disposed=false,frame=0,width=1,height=1,elapsed=0,last=performance.now(),lastPhase='',frames=0,frameTotal=0;
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.style.cursor='grab';container.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dce8ef');scene.fog=new THREE.Fog('#dce8ef',34,100);
  const camera=new THREE.PerspectiveCamera(40,1,.1,220);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.85;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#e3f3ff','#526478',.85));
  const sun=new THREE.DirectionalLight('#fff8ed',3.2);sun.position.set(-8,18,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-21;sun.shadow.camera.right=21;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-16;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);
  const rim=new THREE.DirectionalLight('#8abaff',1.5);rim.position.set(7,6,-14);scene.add(rim);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(120,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,toneMapped:false,vertexShader:'varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vWorld;void main(){vec3 d=normalize(vWorld);float h=max(0.,d.y);vec3 c=mix(vec3(.68,.79,.86),vec3(.16,.36,.64),pow(h,.22));float light=pow(max(0.,dot(d,normalize(vec3(-.7,.8,.2)))),30.);c+=vec3(.12,.10,.06)*light;gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>}`}));scene.add(sky);
  // The floor reflects the real architecture, not a reflection image.
  const floor=new Reflector(new THREE.PlaneGeometry(200,200),{color:0xc6d0d9,textureWidth:768,textureHeight:768,clipBias:.004,multisample:0});floor.rotation.x=-Math.PI/2;floor.position.y=-.055;
  const floorMaterial=floor.material as THREE.ShaderMaterial;
  floorMaterial.fragmentShader=floorMaterial.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );','vec4 base = texture2DProj( tDiffuse, vUv );\nbase.rgb=mix(vec3(.66,.74,.81),base.rgb,.30);');scene.add(floor);
  const seams=new THREE.Group(),seamMat=new THREE.LineBasicMaterial({color:'#7891a5',transparent:true,opacity:.12});
  for(const n of [-13,0,13])seams.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(n,.002,-65),new THREE.Vector3(n,.002,65)]),seamMat));scene.add(seams);
  const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(70,70),new THREE.ShadowMaterial({opacity:.18}));shadowFloor.rotation.x=-Math.PI/2;shadowFloor.position.y=-.04;shadowFloor.receiveShadow=true;scene.add(shadowFloor);
  scene.add(createContext());
  const spaces=new Map<number,Space>();function getSpace(index:number){if(spaces.has(index))return spaces.get(index)!;const space=prepareSpace(index);space.group.visible=false;spaces.set(index,space);scene.add(space.group);return space;}
  const indexOf=(value:number)=>value<0?1:Math.max(0,Math.min(7,value));let active=indexOf(latest.current.selected),current=getSpace(active);current.group.visible=true;
  const pointGeometry=new THREE.BufferGeometry(),seeds=new Float32Array(COUNT),indices=new Float32Array(COUNT),random=rand(71341);for(let n=0;n<COUNT;n++){seeds[n]=random();indices[n]=n/(COUNT-1);}
  pointGeometry.setAttribute('position',new THREE.BufferAttribute(current.points.slice(),3));pointGeometry.setAttribute('aTarget',new THREE.BufferAttribute(current.points.slice(),3));pointGeometry.setAttribute('aColour',new THREE.BufferAttribute(current.colours.slice(),3));pointGeometry.setAttribute('aTargetColour',new THREE.BufferAttribute(current.colours.slice(),3));pointGeometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  pointGeometry.setAttribute('aIndex',new THREE.BufferAttribute(indices,1));
  const pointer=new THREE.Vector2(-4,-4),pointerTarget=pointer.clone();
  const uniforms={uMorph:{value:0},uFrom:{value:0},uTo:{value:0},uTime:{value:0},uSize:{value:renderer.getPixelRatio()*2.4},uCloud:{value:0},uMotion:{value:1},uUnobstructed:{value:0},uPointer:{value:pointer},uBounds:{value:new THREE.Vector4(current.min,current.span,current.min,current.span)}};
  const points=new THREE.Points(pointGeometry,new THREE.ShaderMaterial({uniforms,vertexShader:pointVertex,fragmentShader:pointFragment,transparent:true,depthWrite:false}));points.frustumCulled=false;points.visible=false;scene.add(points);
  const dustGeometry=new THREE.BufferGeometry(),dustPosition=new Float32Array(650*3);for(let n=0;n<650;n++)dustPosition.set([(random()-.5)*48,random()*17+.4,(random()-.5)*40],n*3);dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPosition,3));
  const dust=new THREE.Points(dustGeometry,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,vertexShader:`uniform float uTime,uMotion;uniform vec2 uPointer;varying float vAlpha;void main(){vec3 p=position;p.y+=sin(uTime*.17+p.x)*.16*uMotion;vec4 v=modelViewMatrix*vec4(p,1.);vec4 c=projectionMatrix*v;vec2 d=c.xy/c.w-uPointer;float near=exp(-dot(d,d)*24.);v.xy+=normalize(d+vec2(.001))*.3*near*uMotion;gl_Position=projectionMatrix*v;gl_PointSize=1.4+near*2.;vAlpha=.08+near*.5;}`,fragmentShader:`varying float vAlpha;void main(){if(length(gl_PointCoord-.5)>.5)discard;gl_FragColor=vec4(.08,.28,.53,vAlpha);}`}));scene.add(dust);
  let transition:null|{from:Space;to:Space;target:number;started:number;camera:THREE.Vector3;focus:THREE.Vector3}=null;
  let cloud=0,orbit=0,elevation=0,zoom=1,dragging=false,x=0,y=0,lastReset=latest.current.reset;
  const baseCamera=current.camera.clone(),baseFocus=current.focus.clone(),cameraTarget=new THREE.Vector3(),focusTarget=baseFocus.clone();
  function attachPoints(from:Space,to:Space){(pointGeometry.getAttribute('position') as THREE.BufferAttribute).copyArray(from.points).needsUpdate=true;(pointGeometry.getAttribute('aTarget') as THREE.BufferAttribute).copyArray(to.points).needsUpdate=true;(pointGeometry.getAttribute('aColour') as THREE.BufferAttribute).copyArray(from.colours).needsUpdate=true;(pointGeometry.getAttribute('aTargetColour') as THREE.BufferAttribute).copyArray(to.colours).needsUpdate=true;uniforms.uBounds.value.set(from.min,from.span,to.min,to.span);}
  function start(target:number){const to=getSpace(target);to.group.visible=true;to.dissolve.value=1.01;attachPoints(current,to);const continuousCamera=baseFocus.clone().add(camera.position.clone().sub(baseFocus).divideScalar(width<1000?1.17:1));transition={from:current,to,target,started:elapsed,camera:continuousCamera,focus:baseFocus.clone()};orbit=elevation=0;zoom=1;}
  function phase(value:string){if(value===lastPhase)return;lastPhase=value;container!.dataset.phase=value;latest.current.onPhase?.(value);}
  function resize(){const r=container!.getBoundingClientRect();width=r.width;height=r.height;if(width<2||height<2)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.setViewOffset(width,height,-width*(width<1000?.12:.16),-height*.015,width,height);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  window.addEventListener('pointermove',event=>{const rect=container!.getBoundingClientRect();pointerTarget.set((event.clientX-rect.left)/width*2-1,-(event.clientY-rect.top)/height*2+1);if(!dragging)return;orbit+=(event.clientX-x)*.006;elevation=THREE.MathUtils.clamp(elevation+(event.clientY-y)*.004,-.25,.4);x=event.clientX;y=event.clientY;},{passive:true,signal:events.signal});
  renderer.domElement.addEventListener('pointerdown',event=>{if(event.button||latest.current.working||transition)return;dragging=true;x=event.clientX;y=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);renderer.domElement.style.cursor='grabbing';},{signal:events.signal});
  const release=()=>{dragging=false;renderer.domElement.style.cursor='grab';};renderer.domElement.addEventListener('pointerup',release,{signal:events.signal});renderer.domElement.addEventListener('pointercancel',release,{signal:events.signal});renderer.domElement.addEventListener('lostpointercapture',release,{signal:events.signal});
  renderer.domElement.addEventListener('wheel',event=>{if(latest.current.working)return;event.preventDefault();zoom=THREE.MathUtils.clamp(zoom+event.deltaY*.0005,.72,1.5);},{passive:false,signal:events.signal});
  window.addEventListener('blur',()=>{release();pointerTarget.set(-4,-4);},{signal:events.signal});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!disposed)latest.current.onFailure();},{signal:events.signal});
  function draw(now:number){
   if(disposed)return;frame=requestAnimationFrame(draw);if(document.hidden){last=now;return;}
   const state=latest.current,rate=state.working?24:60;if(now-last<1000/rate-1)return;const dt=Math.min((now-last)/1000,.08);last=now;elapsed+=dt;frames++;frameTotal+=dt;
   const still=Boolean(state.paused||reduced.matches),target=indexOf(state.selected);uniforms.uUnobstructed.value=state.cinema?1:0;uniforms.uMotion.value=still?0:1;uniforms.uTime.value=still?0:elapsed;pointer.lerp(pointerTarget,1-Math.exp(-dt*9));
   if(state.reset!==lastReset){lastReset=state.reset;orbit=elevation=0;zoom=1;}
   if(still&&transition){transition.from.group.visible=false;transition.from.dissolve.value=0;current=transition.to;active=transition.target;current.dissolve.value=0;transition=null;baseCamera.copy(current.camera);baseFocus.copy(current.focus);attachPoints(current,current);}
   if(!transition&&target!==active){if(still){current.group.visible=false;current=getSpace(target);current.group.visible=true;current.dissolve.value=0;active=target;baseCamera.copy(current.camera);baseFocus.copy(current.focus);attachPoints(current,current);}else start(target);}
   cloud=THREE.MathUtils.damp(cloud,state.particles?1:0,still?100:4,dt);uniforms.uCloud.value=cloud;
   if(transition){
    const t=THREE.MathUtils.clamp((elapsed-transition.started)/3.6,0,1),m=smooth((t-.20)/.60);
    const from=smooth(t/.28),to=1-smooth((t-.73)/.27);transition.from.dissolve.value=Math.max(from*1.01,cloud*1.01);transition.to.dissolve.value=Math.max(to*1.01,cloud*1.01);
    uniforms.uFrom.value=from;uniforms.uTo.value=to;uniforms.uMorph.value=m;points.visible=true;
    baseCamera.lerpVectors(transition.camera,transition.to.camera,smooth(t));baseCamera.y+=Math.sin(t*Math.PI)*2.8;baseFocus.lerpVectors(transition.focus,transition.to.focus,smooth(t));
    phase(t<.25?'表面解构':t<.73?'空间迁移':'几何重组');container!.dataset.progress=t.toFixed(3);
    if(t>=1){transition.from.group.visible=false;transition.from.dissolve.value=0;current=transition.to;active=transition.target;current.dissolve.value=cloud*1.01;transition=null;attachPoints(current,current);uniforms.uMorph.value=0;}
   }else{current.dissolve.value=cloud*1.01;uniforms.uFrom.value=cloud;uniforms.uTo.value=cloud;uniforms.uMorph.value=0;points.visible=cloud>.005;phase(cloud>.8?'几何点云':'实体空间');container!.dataset.progress='1';}
   for(const space of spaces.values())space.group.traverse(o=>{if(o instanceof THREE.Line||o instanceof THREE.LineSegments)o.visible=space.dissolve.value<.25;});
   const offset=baseCamera.clone().sub(baseFocus);offset.applyAxisAngle(new THREE.Vector3(0,1,0),orbit+(still?0:pointer.x*.015));offset.y+=elevation*12;offset.multiplyScalar(zoom*(width<1000?1.17:1));cameraTarget.copy(baseFocus).add(offset);focusTarget.copy(baseFocus);
   camera.position.lerp(cameraTarget,still?1:1-Math.exp(-dt*5));camera.lookAt(focusTarget);renderer.render(scene,camera);
   container!.dataset.scene=String(active);
   if(frames%90===0){container!.dataset.frameMs=(frameTotal/frames*1000).toFixed(1);container!.dataset.drawCalls=String(renderer.info.render.calls);container!.dataset.triangles=String(renderer.info.render.triangles);}
  }
  camera.position.copy(baseCamera);camera.lookAt(baseFocus);renderer.render(scene,camera);latest.current.onReady();frame=requestAnimationFrame(draw);
  return()=>{disposed=true;cancelAnimationFrame(frame);events.abort();observer.disconnect();floor.dispose();environment.dispose();const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points||object instanceof THREE.Line){geometries.add(object.geometry);(Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className="exhibit-webgl" data-geometry="mesh-surface-sampled"/>;
}
