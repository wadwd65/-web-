import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SOUNDTRACKS} from './Soundtrack.tsx';
import {createAudit} from './performance-audit.ts';
import {RHINE_SYMBOL_PATHS} from './RhineMark.tsx';
import {drawEdition,musicEdition,warmArtworkAssets,MUSIC_ATMOSPHERES} from './music-artwork.ts';
import {createMusicAtmosphere} from './music-atmosphere.ts';
import {cdMaterial} from './cd-material.ts';
import {archiveEase,ARCHIVE_MOTION_MS} from './archive-motion.ts';

let modelPromise:Promise<T.Group>|null=null;
export function warmArchiveAsset(){return modelPromise??=(new GLTFLoader().loadAsync('/models/rhine-archive-cassette.glb').then(gltf=>gltf.scene).catch(error=>{modelPromise=null;throw error;}));}
function adaptedMaterial(source:T.MeshStandardMaterial){
 const m=source.clone() as T.MeshPhysicalMaterial,n=source.name;
 const palette:Record<string,string>={Frosted_Polymer:'#b3d4e3',Ivory_Edges:'#c4ced5',Optical_Diffuser:'#233c57',Printed_Label:'#d6e6ec',Optical_Edges:'#a6c8d5',Case_Engraving:'#648996',Case_Engraving_Highlight:'#cfecf3',Titanium_Fasteners:'#e0e4e8',Moulded_Lettering:'#94bdcf',Champagne_Index:'#a7ceda'};
 const key=Object.keys(palette).find(k=>n.startsWith(k));if(key)m.color.set(palette[key]);
 // Thin reflective sheets avoid rendering the entire collection a second time.
 m.transmission=0;m.clearcoat=0;m.iridescence=0;m.emissiveIntensity=0;
 if(n.startsWith('Titanium')){m.metalness=.95;m.roughness=.17;}
 if(n.startsWith('Ivory')){m.metalness=.78;m.roughness=.25;}
 if(n.startsWith('Optical_Diffuser')){m.metalness=.38;m.roughness=.45;}
 if(n.startsWith('Frosted')){m.transparent=true;m.opacity=.13;m.depthWrite=false;m.metalness=.32;m.roughness=.22;}
 return m;
}
function symbol(c:CanvasRenderingContext2D,x:number,y:number,scale:number,color:string){c.save();c.translate(x,y);c.scale(scale,scale);c.lineWidth=1.7;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;for(const path of RHINE_SYMBOL_PATHS)c.stroke(new Path2D(path));c.restore();}
function labelTexture(index:number){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=768;drawEdition(canvas,index,false);const c=canvas.getContext('2d')!;
 // All print stays inside the circular crop, with contrast suited to the image.
 c.fillStyle=[0,1,4].includes(index)?'#15364c':'#edfaff';c.font='500 34px Arial,sans-serif';c.fillText('RHINE LAB',155,180);c.font='17px ui-monospace,monospace';c.fillText(`SOUND / ${String(index+1).padStart(2,'0')}`,158,211);
 c.fillStyle='#f1f9ff';c.font='500 42px Arial,sans-serif';c.fillText(musicEdition(index).word,155,593);c.fillStyle='#b9dae8';c.font='14px ui-monospace,monospace';c.fillText(`R / ${String(index+1).padStart(2,'0')}   MSR / ${SOUNDTRACKS[index].cid}`,158,625);symbol(c,520,542,1.0,'#d8f7ff');
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;
}
function stickerTexture(index:number){
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const c=canvas.getContext('2d')!,d=musicEdition(index);c.fillStyle='#c8dce3';c.fillRect(0,0,768,256);c.fillStyle='#16323f';c.font='500 46px Arial,sans-serif';c.fillText(SOUNDTRACKS[index].name,28,85,710);c.font='26px ui-monospace,monospace';c.fillText(`R / ${String(index+1).padStart(2,'0')}  —  ${d.word}`,30,157);symbol(c,590,184,1.25,'#345866');const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;return t;
}
function discSolid(){const s=new T.Shape();s.absarc(0,0,1.83,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,.21,0,Math.PI*2,true);s.holes.push(hole);return new T.ExtrudeGeometry(s,{depth:.05,bevelEnabled:true,bevelSize:.009,bevelThickness:.006,bevelSegments:2,curveSegments:72,steps:1});}
type Props={selected:number;detail:boolean;current:number;playing:boolean;reduced:boolean;revealed:boolean;enabled:boolean;preview:number;onPick:(i:number)=>void;onHover:(i:number)=>void;onReady:()=>void;onFailure:()=>void};
type Pose={position:T.Vector3;quaternion:T.Quaternion;open:number};
type RecordObject={group:T.Group;lid:T.Group;disc:T.Group;rim:T.LineSegments;tab:T.Mesh;position:T.Vector3;yaw:number;hoverLift:number;open:number;from:Pose;to:Pose};
type CameraPose={position:T.Vector3;aim:T.Vector3;offset:T.Vector2};

/** One scene survives route changes. The camera, mesh and cover share a finite
 * timeline; choosing another track never waits for the old one to fully close. */
export default function MusicArchiveScene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),wake=useRef<()=>void>(()=>{}),[template,setTemplate]=useState<T.Group|null>(null);latest.current=props;
 useEffect(()=>{let alive=true;Promise.all([warmArchiveAsset(),warmArtworkAssets()]).then(([model])=>{if(alive)setTemplate(model);}).catch(()=>{if(alive)latest.current.onFailure();});return()=>{alive=false;};},[]);
 useEffect(()=>{wake.current();},[props.enabled,props.revealed]);
 useEffect(()=>{
  if(!template)return;const el=host.current;if(!el)return;const abort=new AbortController();let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{latest.current.onFailure();return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  const audit=createAudit('music archive'),scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.1,100),aim=new T.Vector3();scene.fog=new T.Fog('#142b42',25,58);
  const pm=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pm.fromScene(room,.035);scene.environment=environment.texture;scene.environmentIntensity=.90;pm.dispose();room.dispose();
  scene.add(new T.HemisphereLight('#e9f5ff','#293e5a',.85));const key=new T.DirectionalLight('#fff8ef',2.65);key.position.set(-7,9,9);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-12;key.shadow.camera.right=16;key.shadow.camera.top=9;key.shadow.camera.bottom=-8;key.shadow.normalBias=.04;key.shadow.bias=-.0002;scene.add(key);
  const edge=new T.DirectionalLight('#a7deff',3.2);edge.position.set(8,4,-8);scene.add(edge);const fill=new T.DirectionalLight('#b3d7ed',.9);fill.position.set(-8,-1,4);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(90,90),new T.ShadowMaterial({color:'#020b13',opacity:.14}));ground.rotation.x=-Math.PI/2;ground.position.y=-2.65;ground.receiveShadow=true;scene.add(ground);
  const metal=new T.MeshStandardMaterial({color:'#dbe4ec',metalness:.98,roughness:.14}),hub=new T.MeshPhysicalMaterial({color:'#8ba7b7',metalness:1,roughness:.11,clearcoat:1}),optical=cdMaterial(),objects:RecordObject[]=[],pickable:T.Mesh[]=[],ownedGeometries=new Set<T.BufferGeometry>();
  const add=(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,x=0,y=0,z=0)=>{ownedGeometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const bounds=new T.Box3().setFromObject(template),center=bounds.getCenter(new T.Vector3()),normalization=4.4/bounds.getSize(new T.Vector3()).y;
  const outlineGeometry=new T.EdgesGeometry((template.children.find(n=>n.name.startsWith('Ivory')) as T.Mesh).geometry,28);ownedGeometries.add(outlineGeometry);
  const sharedSolid=discSolid(),sharedRing=new T.RingGeometry(.214,1.83,128),labelRing=new T.RingGeometry(.31,1.60,128);[sharedSolid,sharedRing,labelRing].forEach(g=>ownedGeometries.add(g));
  for(let i=0;i<SOUNDTRACKS.length;i++){
   const group=new T.Group(),position=new T.Vector3(-3.6+i*2.1,.16,4-i*3.8),yaw=-.30+i*.085;scene.add(group);group.position.copy(position);group.rotation.set(.01,yaw,-.025);
   const body=new T.Group(),lid=new T.Group();for(const a of [body,lid]){a.scale.setScalar(normalization);a.position.set(-center.x*normalization,-center.y*normalization,0);group.add(a);}lid.position.z=.18;
   let frameMesh:T.Mesh|null=null;
   // Geometry only: LBEILC / RhineLabUI via MikeQu223, MIT. UI and adaptations
   // are independent; complete provenance remains in public/credits.
   for(const node of template.children){
    if(!(node instanceof T.Mesh)||['Carbon_Ink','Internal_Ceramic','Subsurface_Optics','Optical_Film_Edge','Amber_Optical_Inlay','Optical_Film','Index_Inlay'].some(n=>node.name.startsWith(n)))continue;
    const mesh=node.clone() as T.Mesh;mesh.material=adaptedMaterial(node.material as T.MeshStandardMaterial);mesh.userData.index=i;mesh.castShadow=mesh.name.startsWith('Ivory')||mesh.name.startsWith('Optical_Diffuser');(mesh.name.startsWith('Frosted')?lid:body).add(mesh);pickable.push(mesh);if(mesh.name.startsWith('Ivory'))frameMesh=mesh;
   }
   const label=add(body,new T.PlaneGeometry(1.03,.35),new T.MeshBasicMaterial({map:stickerTexture(i),toneMapped:false}),-1.36,3.04,.26);label.userData.index=i;pickable.push(label);
   const tab=add(group,new T.BoxGeometry(.35,.27,.055),new T.MeshStandardMaterial({color:musicEdition(i).accent,metalness:.54,roughness:.3,emissive:musicEdition(i).accent,emissiveIntensity:.07}),-2.55,2.04,.27);
   const numberCanvas=document.createElement('canvas');numberCanvas.width=128;numberCanvas.height=96;const c=numberCanvas.getContext('2d')!;c.fillStyle='#123445';c.font='500 62px Arial,sans-serif';c.textAlign='center';c.fillText(String(i+1).padStart(2,'0'),64,70);const numberTexture=new T.CanvasTexture(numberCanvas);numberTexture.colorSpace=T.SRGBColorSpace;add(group,new T.PlaneGeometry(.31,.23),new T.MeshBasicMaterial({map:numberTexture,transparent:true,toneMapped:false}),-2.55,2.04,.305);
   const disc=new T.Group();disc.position.set(.50,-.04,.38);group.add(disc);add(disc,sharedSolid,metal);const face=add(disc,sharedRing,optical,0,0,.058);face.userData.index=i;pickable.push(face);const print=add(disc,labelRing,new T.MeshStandardMaterial({map:labelTexture(i),roughness:.44,metalness:.18}),0,0,.064);print.userData.index=i;pickable.push(print);
   add(disc,new T.RingGeometry(.214,.31,64),hub,0,0,.067);add(disc,new T.RingGeometry(1.805,1.841,128),metal,0,0,.063);add(disc,new T.RingGeometry(1.60,1.614,128),metal,0,0,.066);
   const spindle=add(group,new T.CylinderGeometry(.151,.151,.14,40),hub,.50,-.04,.39);spindle.rotation.x=Math.PI/2;
   const rim=new T.LineSegments(outlineGeometry,new T.LineBasicMaterial({color:musicEdition(i).accent,transparent:true,opacity:0,depthWrite:false}));rim.scale.setScalar(1.003);frameMesh!.add(rim);
   const initial:Pose={position:position.clone(),quaternion:group.quaternion.clone(),open:0};objects.push({group,lid,disc,rim,tab,position,yaw,hoverLift:0,open:0,from:initial,to:initial});
  }
  const fieldPoints=new Float32Array(36*22*3);for(let row=0;row<22;row++)for(let col=0;col<36;col++){const n=(row*36+col)*3;fieldPoints[n]=-14+col*.9;fieldPoints[n+1]=-2.61;fieldPoints[n+2]=-22+row*1.2;}
  const fieldGeometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(fieldPoints,3));ownedGeometries.add(fieldGeometry);scene.add(new T.Points(fieldGeometry,new T.PointsMaterial({color:'#70b1c6',size:.028,transparent:true,opacity:.30,depthWrite:false})));
  for(const offset of [-.85,.85]){const curve=new T.CatmullRomCurve3(objects.map(o=>new T.Vector3(o.position.x,-2.62,o.position.z+offset))),g=new T.BufferGeometry().setFromPoints(curve.getPoints(80));ownedGeometries.add(g);scene.add(new T.Line(g,new T.LineBasicMaterial({color:'#83bcce',transparent:true,opacity:.18,depthWrite:false})));}
  const atmosphere=createMusicAtmosphere(scene),raycaster=new T.Raycaster(),pointer=new T.Vector2(-10,-10),mouse=new T.Vector2(),ambientPointer=new T.Vector2(),ambientWorld=new T.Vector2(),ambientRay=new T.Raycaster(),tilt=new T.Vector2(),rotation=new T.Vector2(),zero2=new T.Vector2(),scratch=new T.Vector3();let ambientActive=false;
  const dialog=el.closest('dialog');dialog?.addEventListener('pointermove',event=>{const r=el.getBoundingClientRect();ambientPointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ambientActive=true;},{signal:abort.signal});dialog?.addEventListener('pointerleave',()=>{ambientActive=false;},{signal:abort.signal});
  const pulses:{index:number;at:number}[]=[],debug=new URLSearchParams(location.search).get('perf')==='1';
  let w=1,h=1,presence=0,raf=0,last=0,lastShadow=0,lastDiagnostic=0,fieldCenter=latest.current.selected,fieldGain=0,hover=-1,lastHover=-1,pointerDirty=false,shadowDirty=true,lost=false,disposed=false,prepared=false,zoom=1,zoomTarget=1,active=latest.current.selected,goalDetail=false,tweenAt=-1,tweenDone=true,mix=0,mixFrom=0,shownPhase='',shownActive=-1;
  let cameraA:CameraPose,cameraB:CameraPose,pointerDown:{x:number;y:number;dragged:boolean;canDrag:boolean;index:number}|null=null;
  const media=matchMedia('(prefers-reduced-motion: reduce)');let systemReduced=media.matches;media.addEventListener('change',()=>{systemReduced=media.matches;},{signal:abort.signal});
  function fitPose(points:T.Vector3[],target:T.Vector3,direction:T.Vector3,stage:[number,number,number,number]):CameraPose{
   camera.clearViewOffset();let distance=18;const box=new T.Box2();
   for(let n=0;n<6;n++){camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);camera.updateMatrixWorld();box.makeEmpty();for(const point of points){scratch.copy(point).project(camera);box.expandByPoint(new T.Vector2(scratch.x,scratch.y));}const ratio=Math.max((box.max.x-box.min.x)/((stage[1]-stage[0])*2),(box.max.y-box.min.y)/((stage[3]-stage[2])*2));distance*=T.MathUtils.clamp(ratio,.7,1.8);if(Math.abs(ratio-1)<.01)break;}
   camera.position.copy(target).addScaledVector(direction,distance);camera.lookAt(target);camera.updateMatrixWorld();box.makeEmpty();for(const point of points){scratch.copy(point).project(camera);box.expandByPoint(new T.Vector2(scratch.x,scratch.y));}
   return {position:camera.position.clone(),aim:target.clone(),offset:new T.Vector2(((box.min.x+box.max.x)/2-(stage[0]+stage[1]-1))/2,(-((box.min.y+box.max.y)/2)-(stage[2]+stage[3]-1))/2)};
  }
  function resize(){
   const r=el!.getBoundingClientRect();if(r.width<2||r.height<2)return;w=r.width;h=r.height;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
   const corners=(position:T.Vector3,yaw:number)=>{const points:T.Vector3[]=[];for(const x of [-3.02,3.02])for(const y of [-2.22,2.22])for(const z of [-.15,.5])points.push(new T.Vector3(x,y,z).applyAxisAngle(new T.Vector3(0,1,0),yaw).add(position));return points;};
   cameraA=fitPose(objects.flatMap(o=>corners(o.position,o.yaw)),new T.Vector3(.9,.0,-2.5),new T.Vector3(.04,.15,1).normalize(),[.35,.985,.11,.83]);
   cameraB=fitPose(corners(new T.Vector3(0,.28,3.2),-.19),new T.Vector3(0,.28,3.2),new T.Vector3(.10,.075,1).normalize(),[.38,.96,.07,.91]);shadowDirty=true;
  }
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  function hit(){scene.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);for(const hit of raycaster.intersectObjects(pickable,false)){let visible=true;for(let p:T.Object3D|null=hit.object;p;p=p.parent)if(!p.visible)visible=false;const material=(hit.object as T.Mesh).material as T.Material;if(visible&&!(material.transparent&&material.opacity<.02))return hit.object.userData.index as number;}return -1;}
  function locate(event:PointerEvent){const rect=el!.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);mouse.set(pointer.x,pointer.y);pointerDirty=true;}
  function hoverAt(i:number){if(i===hover)return;hover=i;el!.dataset.hover=String(i);el!.style.cursor=i>=0?'pointer':latest.current.detail?'grab':'default';latest.current.onHover(i);}
  el.addEventListener('pointermove',event=>{locate(event);if(pointerDown){const dx=event.clientX-pointerDown.x,dy=event.clientY-pointerDown.y;if(Math.hypot(dx,dy)>7)pointerDown.dragged=true;if(pointerDown.dragged&&pointerDown.canDrag){rotation.x=T.MathUtils.clamp(rotation.x+dy*.0035,-.27,.27);rotation.y=T.MathUtils.clamp(rotation.y+dx*.0035,-.55,.55);pointerDown.x=event.clientX;pointerDown.y=event.clientY;shadowDirty=true;el.style.cursor='grabbing';}}},{signal:abort.signal});
  el.addEventListener('pointerleave',()=>{if(!pointerDown){pointer.set(-10,-10);mouse.set(0,0);hoverAt(-1);}},{signal:abort.signal});
  el.addEventListener('pointerdown',event=>{if(event.button!==0)return;locate(event);atmosphere.click(mouse);const i=hit();pointerDown={x:event.clientX,y:event.clientY,dragged:false,canDrag:latest.current.detail&&tweenDone&&i===active,index:i};el.setPointerCapture(event.pointerId);},{signal:abort.signal});
  el.addEventListener('pointerup',event=>{if(!pointerDown)return;locate(event);const down=pointerDown;pointerDown=null;if(el.hasPointerCapture(event.pointerId))el.releasePointerCapture(event.pointerId);if(!down.dragged){const i=down.index>=0?down.index:hit();if(i>=0)latest.current.onPick(i);}el.style.cursor=hover>=0?'pointer':latest.current.detail?'grab':'default';},{signal:abort.signal});
  el.addEventListener('pointercancel',()=>{pointerDown=null;},{signal:abort.signal});el.addEventListener('wheel',event=>{if(!latest.current.detail)return;event.preventDefault();zoomTarget=T.MathUtils.clamp(zoomTarget+event.deltaY*.00045,.88,1.20);},{passive:false,signal:abort.signal});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;cancelAnimationFrame(raf);latest.current.onFailure();},{signal:abort.signal});
  function retarget(now:number){
   const p=latest.current,wasDetail=goalDetail,oldActive=active;active=p.selected;goalDetail=p.detail;tweenAt=now;tweenDone=false;mixFrom=mix;rotation.set(0,0);zoomTarget=1;
   audit.begin(!goalDetail?'return to collection':wasDetail?`browse ${oldActive+1} → ${active+1}`:`extract ${active+1}`);
   for(let i=0;i<objects.length;i++){
    if(wasDetail&&goalDetail&&i!==oldActive&&i!==active){objects[i].group.visible=false;continue;}
    const o=objects[i],chosen=i===active;if(!o.group.visible){o.group.position.copy(goalDetail?new T.Vector3(12,.28,3):o.position.clone().add(new T.Vector3(1,-.3,-5)));o.group.rotation.set(0,o.yaw,0);o.open=0;}
    o.from={position:o.group.position.clone(),quaternion:o.group.quaternion.clone(),open:o.open};
    // The captured pose already includes hover. Reset the offset so the first
    // extraction frame cannot add the same elevation for a second time.
    o.hoverLift=0;
    const position=goalDetail?(chosen?new T.Vector3(0,.28,3.2):wasDetail&&i===oldActive?new T.Vector3(-1,.2,-29):o.position.clone().add(new T.Vector3(5,-.6,-20))):o.position.clone();
    o.to={position,quaternion:new T.Quaternion().setFromEuler(new T.Euler(goalDetail&&chosen?.015:.01,goalDetail&&chosen?-.19:o.yaw,goalDetail&&chosen?-.035:-.025)),open:goalDetail&&chosen?1:0};o.group.visible=true;
   }
  }
  function tick(now:number){
   raf=0;if(disposed||document.hidden||lost||!latest.current.enabled)return;
   // Render each display frame; the former modulo limiter produced an uneven
   // cadence on variable-refresh monitors, even when CPU work was small.
   const began=performance.now(),dt=Math.min(.10,Math.max(.001,(now-last)/1000||.016));last=now;
   const p=latest.current,reduced=p.reduced||systemReduced;if(p.detail!==goalDetail||p.selected!==active)retarget(now);zoom=T.MathUtils.damp(zoom,zoomTarget,reduced?50:8,dt);
   const t=tweenDone?1:archiveEase(now-tweenAt,reduced?20:ARCHIVE_MOTION_MS);mix=T.MathUtils.lerp(mixFrom,goalDetail?1:0,t);
   const source=!p.detail?(p.preview>=0?p.preview:hover):-1;if(source>=0&&source!==lastHover&&!reduced){pulses.push({index:source,at:now});if(pulses.length>8)pulses.shift();}lastHover=source;while(pulses.length&&now-pulses[0].at>2000)pulses.shift();
   fieldGain=T.MathUtils.damp(fieldGain,source>=0&&!reduced?1:0,6,dt);if(source>=0)fieldCenter=T.MathUtils.damp(fieldCenter,source,6,dt);
   for(let i=0;i<objects.length;i++){
    const o=objects[i],chosen=i===active;let ripple=0;if(!reduced)for(const pulse of pulses){const age=(now-pulse.at)/1000-Math.abs(i-pulse.index)*.11;if(age>0&&age<1.4)ripple+=Math.sin(age/1.4*Math.PI)**2*.14*Math.exp(-Math.abs(i-pulse.index)*.35);}
    const field=fieldGain*.46*Math.exp(-.5*((i-fieldCenter)/.95)**2);o.hoverLift=T.MathUtils.damp(o.hoverLift,!p.detail?field+Math.min(.18,ripple)+(chosen?.07:0):0,8,dt);
    const before=o.group.position.clone();o.group.position.lerpVectors(o.from.position,o.to.position,t);o.group.position.y+=o.hoverLift+(goalDetail&&chosen&&!tweenDone?Math.sin(t*Math.PI)*.48:0);o.group.quaternion.slerpQuaternions(o.from.quaternion,o.to.quaternion,t);
    if(goalDetail&&chosen){o.group.rotation.x+=rotation.x*mix;o.group.rotation.y+=rotation.y*mix;}else if(!p.detail)o.group.rotation.z+=field*(i-fieldCenter)*.015;
    o.open=T.MathUtils.lerp(o.from.open,o.to.open,t);o.lid.position.z=.18+o.open*.33;o.lid.rotation.y=-o.open*.06;o.lid.visible=o.open<.995;
    for(const child of o.lid.children)((child as T.Mesh).material as T.MeshPhysicalMaterial).opacity=.13*(1-o.open);
    o.disc.position.z=.38+o.open*.40;if(p.playing&&p.current===i&&!reduced)o.disc.rotation.z-=dt*.12;
    const rim=o.rim.material as T.LineBasicMaterial;rim.opacity=T.MathUtils.damp(rim.opacity,source===i?.58:chosen?.14:0,10,dt);(o.tab.material as T.MeshStandardMaterial).emissiveIntensity=p.playing&&p.current===i?.23:.07;
    if(before.distanceToSquared(o.group.position)>.000002)shadowDirty=true;
   }
   if(!tweenDone&&t>=1){tweenDone=true;for(let i=0;i<objects.length;i++)objects[i].group.visible=!goalDetail||i===active;audit.end();}
   if(cameraA&&cameraB){
    camera.position.lerpVectors(cameraA.position,cameraB.position,mix);aim.lerpVectors(cameraA.aim,cameraB.aim,mix);tilt.lerp(reduced?zero2:mouse,1-Math.exp(-3*dt));camera.position.x+=tilt.x*.12;camera.position.y+=tilt.y*.08;
    presence=T.MathUtils.damp(presence,p.revealed?1:0,reduced?50:6,dt);camera.position.z+=(1-presence)*1.2;camera.position.sub(aim).multiplyScalar(1+(zoom-1)*mix).add(aim);camera.lookAt(aim);
    camera.setViewOffset(w,h,w*T.MathUtils.lerp(cameraA.offset.x,cameraB.offset.x,mix),h*T.MathUtils.lerp(cameraA.offset.y,cameraB.offset.y,mix),w,h);
   }
   if(pointerDirty&&!pointerDown){pointerDirty=false;hoverAt(hit());}
   if(shadowDirty&&now-lastShadow>((!tweenDone||fieldGain>.02||pointerDown?.dragged)?1000/60:100)){renderer.shadowMap.needsUpdate=true;lastShadow=now;shadowDirty=false;audit.count('shadowRefreshes');}
   camera.updateMatrixWorld();ambientRay.setFromCamera(ambientPointer,camera);ambientRay.ray.at((-18-ambientRay.ray.origin.z)/ambientRay.ray.direction.z,scratch);ambientWorld.set(scratch.x/31,scratch.y/17);
   atmosphere.update(dt,p.selected,ambientWorld,ambientActive,reduced);renderer.render(scene,camera);const phase=!tweenDone?(goalDetail?'extracting':'returning'):goalDetail?'detail':'collection';
   if(phase!==shownPhase){shownPhase=phase;el!.dataset.phase=phase;}if(active!==shownActive){shownActive=active;el!.dataset.active=String(active);}
   if(debug&&now-lastDiagnostic>90){lastDiagnostic=now;el!.dataset.heights=objects.map(o=>o.group.position.y.toFixed(3)).join(',');el!.dataset.exposure=objects[active].open.toFixed(3);el!.dataset.discAngle=objects[p.current].disc.rotation.z.toFixed(4);el!.dataset.visibleRecords=String(objects.filter(o=>o.group.visible).length);el!.dataset.rippleCount=String(pulses.length);el!.dataset.waveSource=String(source);el!.dataset.lastFrame=String(Math.round(now));el!.dataset.atmosphere=MUSIC_ATMOSPHERES[p.selected];el!.dataset.atmosphereTime=atmosphere.uniforms.uTime.value.toFixed(2);el!.dataset.pointerGlow=atmosphere.uniforms.uActive.value.toFixed(2);el!.dataset.zoom=zoom.toFixed(3);}
   audit.frame({cpu:performance.now()-began,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});raf=requestAnimationFrame(tick);
  }
  const wakeScene=()=>{cancelAnimationFrame(raf);raf=0;last=0;if(prepared&&!disposed&&!document.hidden&&!lost&&latest.current.enabled){resize();raf=requestAnimationFrame(tick);}};wake.current=wakeScene;document.addEventListener('visibilitychange',wakeScene,{signal:abort.signal});
  // Compile every material before the visible handoff; reopen retains GPU assets.
  const warmStarted=performance.now();renderer.compileAsync(scene,camera).then(()=>{if(disposed)return;renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);prepared=true;el.dataset.preparedMs=String(Math.round(performance.now()-warmStarted));latest.current.onReady();wakeScene();}).catch(()=>{if(!disposed)latest.current.onFailure();});
  return()=>{disposed=true;abort.abort();observer.disconnect();cancelAnimationFrame(raf);wake.current=()=>{};audit.dispose();atmosphere.dispose();const materials=new Set<T.Material>(),textures=new Set<T.Texture>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}});ownedGeometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[template]);
 return <div className="ma-scene" ref={host} aria-hidden="true"/>;
}
