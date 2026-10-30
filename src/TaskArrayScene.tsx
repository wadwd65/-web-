import {useEffect,useRef} from 'react';
import * as T from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {EXPERIENCE_MODULES as MODULES} from './experience-modules.ts';
import type {TerminalSignals,ToolId} from './terminal-state.ts';
import {faceAction,PART_LABELS} from './scene-actions.ts';
import type {SceneAction,SceneInteraction} from './scene-actions.ts';
import {DISPLAY,FASTENER} from './scene-clearance.ts';
import {createAudit,countAudit} from './performance-audit.ts';

type Props={selected:number;working:boolean;entering:boolean;particles:boolean;paused?:boolean;suspended?:boolean;cinema?:boolean;reset:number;signals:TerminalSignals;view:string;onSelect:(index:number)=>void;onOpen:(index:number)=>void;onAction:SceneInteraction;onReady:()=>void;onFailure:()=>void;onPhase?:(phase:string)=>void};
type Dossier={group:T.Group;texture:T.CanvasTexture;canvas:HTMLCanvasElement;key:string;signal:TerminalSignals|null;active:boolean;hot:SceneAction|null;cover:T.Mesh;layers:T.Group;index:number;samples:Float32Array;meshes:{mesh:T.Mesh;opacity:number}[];bars:T.Mesh[];solid:number;hover:number;outline:T.LineSegments};
const COUNT=10000;
const LABEL_OFFSETS=[[0,0],[42,0],[-42,0],[84,0],[-84,0],[126,0],[-126,0],[0,34],[60,34],[-60,34],[120,34],[-120,34],[0,68],[80,68],[-80,68],[160,0],[-160,0]];
const quarter=(n:number)=>Math.round(n*4)/4;
function style(el:HTMLElement|SVGElement,key:'visibility'|'transform'|'zIndex'|'cursor',value:string){if(el.style[key]!==value){el.style[key]=value;countAudit('domWrites');}}
function data(el:HTMLElement,key:string,value:string){if(el.dataset[key]!==value){el.dataset[key]=value;countAudit('domWrites');}}
function hide(el:HTMLElement,hidden:boolean){if(el.hidden!==hidden){el.hidden=hidden;countAudit('domWrites');}}
function attr(el:SVGElement,key:string,value:string){if(el.getAttribute(key)!==value){el.setAttribute(key,value);countAudit('domWrites');}}
const money=(n:number|null)=>n===null?'等待填写':`¥ ${n.toLocaleString('zh-CN',{minimumFractionDigits:2})}`;
function content(index:number,s:TerminalSignals){
 const m=MODULES[index];if(!m.ready)return ['功能待开发',m.input,'入口预留 · 暂不生成结果'];
 if(m.id==='contract')return [s.contract.characters?`${s.contract.characters} 字合同原文`:'等待载入合同原文',s.contract.reviewed?`${s.contract.items} 项已核对 / ${s.contract.unresolved} 项待确认`:'原文定位 / 依据入口 / 询问清单','本地规则核对 · 保留不确定项'];
 if(m.id==='salary')return [`应发 ${money(s.salary.gross)}`,`扣款 ${money(s.salary.deductions)}`,`实发 ${money(s.salary.net)}`];
 if(m.id==='subsidy')return [s.subsidy.checked?'已对照个人条件':'从个人实际条件开始',s.subsidy.checked?`${s.subsidy.states.filter(v=>v==='unknown').length} 项待确认`:'地区 / 毕业 / 就业情况','广州政策示例 · 以官方审核为准'];
 const value=s.tools[m.id as ToolId];return value.ready?value.lines:[m.input,m.outputs.join(' / '),'本地工具 · 材料不自动上传'];
}
function redraw(d:Dossier,s:TerminalSignals,active=false,hot:SceneAction|null=null){
 if(d.key&&d.signal===s&&d.active===active&&d.hot===hot)return;d.signal=s;d.active=active;d.hot=hot;
 const m=MODULES[d.index],lines=content(d.index,s),key=JSON.stringify([lines,active,hot]);if(d.key===key)return;d.key=key;
 const c=d.canvas.getContext('2d')!;c.clearRect(0,0,1280,900);
 const bg=c.createLinearGradient(0,0,1280,900);bg.addColorStop(0,active?'#29475c':'#edf3f7');bg.addColorStop(.52,active?'#203e55':'#e2ebf0');bg.addColorStop(1,active?'#142f46':'#c2d5e1');c.fillStyle=bg;c.fillRect(0,0,1280,900);
 c.fillStyle=active?'#a2c4d9':'#50758b';c.font='22px Consolas,monospace';c.fillText('FIRST STEP  /  '+m.english,75,78);c.fillStyle=active?'#b9e0f4':'#244963';c.font='46px Consolas,monospace';c.fillText(m.code,1110,82);
 c.strokeStyle=active?'#7396ad':'#8ba9bb';c.lineWidth=1;c.beginPath();c.moveTo(75,111);c.lineTo(1205,111);c.stroke();
 c.fillStyle=active?'#eef7fa':'#183449';c.font='500 88px "Microsoft YaHei",sans-serif';c.fillText(m.label,73,258);if(hot==='open'){c.strokeStyle=active?'#b8e8ff':'#3b83b3';c.beginPath();c.moveTo(75,281);c.lineTo(Math.min(1040,75+c.measureText(m.label).width),281);c.stroke();}
 c.fillStyle=active?'#9fbcd0':'#5a7a8d';c.font='25px "Microsoft YaHei",sans-serif';c.fillText(m.phase+'  /  '+(m.ready?'可体验':'待开发'),78,322);
 lines.forEach((line,i)=>{c.fillStyle=active?(i===1?'#a4ddf4':'#a8c2d3'):(i===1?'#286e98':'#4f7185');c.font=`${i===1?'500 36':'29'}px "Microsoft YaHei",sans-serif`;c.fillText(line,80,453+i*88);});
 c.strokeStyle=active?'#789cb266':'#849fb150';for(let i=0;i<36;i++){const x=80+i*32;c.beginPath();c.moveTo(x,735);c.lineTo(x,735+(i%5?10:23));c.stroke();}
 c.fillStyle=active?'#8dabbf':'#55788d';c.font='19px Consolas,monospace';if(m.ready){['准备材料','查看结果','询问清单'].forEach((text,n)=>{const action=(['material','result','list'] as const)[n];c.fillStyle=hot===action?'#ddf6ff':active?'#a8cada':'#55788d';c.font='26px "Microsoft YaHei",sans-serif';c.fillText(text+' ↗',80+n*368,815);c.strokeStyle=hot===action?'#a8e4ff':'#7a9caf77';c.beginPath();c.moveTo(80+n*368,830);c.lineTo(290+n*368,830);c.stroke();});}else c.fillText('PLANNED / 点击名称查看规划',80,813);
 // A readout driven by real session data, never a decorative invented result.
 if(m.id==='salary'&&s.salary.gross!==null&&s.salary.net!==null&&s.salary.gross>0){c.fillStyle='#8eacbe';c.fillRect(80,680,1100,7);c.fillStyle='#4388b8';c.fillRect(80,680,1100*Math.max(0,Math.min(1,s.salary.net/s.salary.gross)),7);}
 c.fillStyle=active?'#a3d9f4':'#3a7caa';c.fillRect(1220,155,5,529);d.texture.needsUpdate=true;
}
function cutPlate(w:number,h:number,depth:number){
 const r=.12,s=new T.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.lineTo(w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.lineTo(w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.lineTo(-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.022,bevelThickness:.018,bevelSegments:2,steps:1});g.translate(0,0,-depth/2);return g;
}
const pointFragment=`varying float vAlpha;varying vec3 vColour;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(vColour,vAlpha*smoothstep(.5,.12,d));#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include');
/** A single persistent renderer: every module is a real dossier, not an unrelated architectural scene. */
export default function TaskArrayScene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),labelRefs=useRef<(HTMLDivElement|null)[]>([]),leaderRefs=useRef<(SVGLineElement|null)[]>([]),partRefs=useRef<(HTMLButtonElement|null)[]>([]),uiHover=useRef<{index:number;part:number;action:SceneAction|null}|null>(null);latest.current=props;
 const wake=useRef<()=>void>(()=>{});
 useEffect(()=>{wake.current();},[props.selected,props.working,props.entering,props.particles,props.paused,props.suspended,props.cinema,props.reset,props.signals,props.view]);
 const pointAt=(index:number,part=-1,action:SceneAction|null=null)=>{uiHover.current={index,part,action};wake.current();};
 const clearPoint=()=>{uiHover.current=null;wake.current();};
 useEffect(()=>{
  const el=host.current;if(!el)return;let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{latest.current.onFailure();return;}
  const audit=createAudit('v0.22 task space');
  let dead=false,frame=0,last=performance.now(),clock=0,work=0,result=0,yaw=0,pitch=0,zoom=1,drag=false,moved=false,downX=0,downY=0,width=1,height=1,hover=-1,oldReset=props.reset,selected=Math.max(0,props.selected),morph=1,morphStarted=0,lastShadow=-Infinity,cloud=0,boot=props.entering?0:1,contextLost=false;
  const abort=new AbortController(),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.type=T.PCFShadowMap;renderer.domElement.setAttribute('aria-hidden','true');el.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;latest.current.onFailure();},{signal:abort.signal});
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.1,100);camera.position.set(8,6.4,17.8);const look=new T.Vector3(-1,0,0),cameraTarget=new T.Vector3();
  const pm=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pm.fromScene(room,.025);scene.environment=env.texture;scene.environmentIntensity=.95;room.dispose();pm.dispose();
  scene.add(new T.HemisphereLight('#effaff','#315173',2));const sun=new T.DirectionalLight('#fff8eb',3.8);sun.position.set(-4,11,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;sun.shadow.normalBias=.04;scene.add(sun);const blue=new T.DirectionalLight('#68b6ff',3);blue.position.set(6,3,-9);scene.add(blue);
  const ground=new T.Mesh(new T.PlaneGeometry(120,120),new T.ShadowMaterial({color:'#3f6487',opacity:.15}));ground.rotation.x=-Math.PI/2;ground.position.y=-2.5;ground.receiveShadow=true;scene.add(ground);
  const root=new T.Group();scene.add(root);const pickables:T.Mesh[]=[],dossiers:Dossier[]=[];
  const batch=(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,poses:{x:number;y:number;z:number;rx?:number}[])=>{const mesh=new T.InstancedMesh(geometry,material.clone(),poses.length),dummy=new T.Object3D();poses.forEach((p,index)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(p.rx??0,0,0);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.userData.noShadow=true;parent.add(mesh);return mesh;};
  const metal=new T.MeshStandardMaterial({color:'#b7c8d6',metalness:.92,roughness:.22}),dark=new T.MeshStandardMaterial({color:'#2c4b65',metalness:.85,roughness:.24}),light=new T.MeshStandardMaterial({color:'#c8e3f1',metalness:.5,roughness:.2}),accent=new T.MeshStandardMaterial({color:'#488dc1',metalness:.55,roughness:.22,emissive:'#163d6f',emissiveIntensity:.3});
  const glow=new T.MeshBasicMaterial({color:'#92d5ff',transparent:true,opacity:.7});
  for(let i=0;i<8;i++){
   const group=new T.Group();root.add(group);const add=(g:T.BufferGeometry,m:T.Material,x=0,y=0,z=0,parent:T.Group=group)=>{const mesh=new T.Mesh(g,m.clone());mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
   const chassis=add(cutPlate(4.65,3.38,.15),metal);chassis.userData.module=i;pickables.push(chassis);
   add(cutPlate(4.48,3.21,.1),dark,0,0,-.18);add(cutPlate(4.44,3.17,.045),light,0,0,.105);
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=900;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
   const face=add(new T.PlaneGeometry(DISPLAY.width,DISPLAY.height),new T.MeshBasicMaterial({map:texture,toneMapped:false}),0,0,DISPLAY.z);face.userData.noShadow=true;face.userData.module=i;face.userData.face=true;pickables.push(face);
   const cover=add(cutPlate(4.54,3.27,.025),new T.MeshPhysicalMaterial({color:'#b5d8ee',roughness:.17,metalness:.2,clearcoat:1,transparent:true,opacity:.14}),0,0,.22);
   for(const y of [-1.68,1.68])add(new T.BoxGeometry(3.8,.035,.12),dark,-.12,y,0);
   batch(group,new T.BoxGeometry(.008,.028,.02),metal,[-1.68,1.68].flatMap(y=>Array.from({length:28},(_,n)=>({x:-1.8+n*.13,y,z:.079}))));
   add(new T.BoxGeometry(.024,2.2,.035),glow,2.285,0,.13);
   // Fasteners sit on the rim, with a real gap from the display: no coplanar depth conflict.
   const fasteners=batch(group,new T.CylinderGeometry(FASTENER.radius,FASTENER.radius,FASTENER.depth,10),dark,[-FASTENER.x,FASTENER.x].flatMap(x=>[-FASTENER.y,FASTENER.y].map(y=>({x,y,z:FASTENER.z,rx:Math.PI/2}))));
   const fastenerMaterial=fasteners.material as T.MeshStandardMaterial;fastenerMaterial.roughness=.62;fastenerMaterial.metalness=.45;
   add(new T.BoxGeometry(.30,.022,.03),accent,-1.73,1.54,.14);add(new T.BoxGeometry(.08,.022,.03),glow,-1.48,1.54,.14);
   const outline=new T.LineSegments(new T.EdgesGeometry(chassis.geometry,25),new T.LineBasicMaterial({color:'#b9e8ff',transparent:true,opacity:0,depthWrite:false}));outline.scale.setScalar(1.006);group.add(outline);
   const layers=new T.Group();group.add(layers);const bars:T.Mesh[]=[];
   const tagPart=(mesh:T.Mesh,part:number)=>{mesh.userData.module=i;mesh.userData.part=part;mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox!.getSize(new T.Vector3()),target=new T.Mesh(new T.BoxGeometry(Math.max(.42,size.x),Math.max(.4,size.y),Math.max(.28,size.z)),new T.MeshBasicMaterial({visible:false}));target.userData={module:i,part,hitTarget:true,noShadow:true};mesh.add(target);pickables.push(target);return mesh;};
   for(let l=0;l<2;l++){
    const sheet=add(cutPlate(4.43-l*.08,3.16-l*.06,.035),new T.MeshPhysicalMaterial({color:l?'#b5cbdc':'#d3e7f3',metalness:.48,roughness:.2,transparent:true,opacity:.58}),0,.08+l*.04,-.36-l*.19);
    add(new T.BoxGeometry(.025,2.6,.015),accent,2.1,.08+l*.04,-.33-l*.19);
    // These physical layers visibly separate during work. No mirrored webpage screenshot is used.
    sheet.userData.sheet=l+1;
   }
   if(i===0){
    for(let b=0;b<2;b++){const bar=add(cutPlate(.95,1.12,.08),b?accent:metal,-.92+b*1.84,-.22,.67,layers);tagPart(bar,b);bars.push(bar);}const axis=add(new T.BoxGeometry(3.25,.045,.10),dark,0,-.96,.65,layers);tagPart(axis,2);bars.push(axis);
   }else if(i===3){
    for(let b=0;b<3;b++){const slab=add(new T.BoxGeometry(.62,1,.16),b===2?accent:metal,-1.12+b*1.12,-.30,.65,layers);tagPart(slab,b);bars.push(slab);}
   }else if(i===4||i===7){
    const count=i===4?4:5;for(let b=0;b<count;b++){const node=add(new T.CylinderGeometry(.13,.13,.09,6),accent,-1.5+b*3/(count-1),-.12+(b%2)*.24,.65,layers);node.rotation.x=Math.PI/2;tagPart(node,b);bars.push(node);if(b){const rail=add(new T.BoxGeometry(3/(count-1)-.16,.022,.03),metal,-1.5+(b-.5)*3/(count-1),0,.63,layers);rail.rotation.z=b%2?.20:-.20;}}
   }else if(i===2){ // The three heights represent actual gross / deductions / net amounts.
    for(let b=0;b<3;b++){const bar=add(new T.BoxGeometry(.49,1,.32),b===1?dark:accent,-1.15+b*1.12,-.6,.65,layers);tagPart(bar,b);bars.push(bar);}
   }else if(i===6){
    for(let n=0;n<5;n++){const node=add(new T.CylinderGeometry(.085,.085,.08,24),accent,-1.6+n*.8,(n%2?-.4:.2),.65,layers);node.rotation.x=Math.PI/2;tagPart(node,n);bars.push(node);if(n){const a=new T.Vector3(-1.6+(n-1)*.8,(n%2?.2:-.4),.65),b=new T.Vector3(-1.6+n*.8,(n%2?-.4:.2),.65);const line=new T.Line(new T.BufferGeometry().setFromPoints([a,b]),new T.LineBasicMaterial({color:'#3a89be',transparent:true,opacity:.6}));layers.add(line);}}
   }else{
    for(let n=0;n<3;n++){const strip=add(new T.BoxGeometry(3.65,.07,.025),n===1?accent:metal,0,-.72+n*.62,.65,layers);tagPart(strip,n);bars.push(strip);add(new T.BoxGeometry(.035,.23,.04),dark,-1.95,-.72+n*.62,.65,layers);}
   }
   const meshes:{mesh:T.Mesh;opacity:number}[]=[];group.traverse(o=>{if(o instanceof T.Mesh){const material=o.material as T.Material;meshes.push({mesh:o,opacity:material.opacity});}});
   // Area sampling uses actual model meshes, including the chassis and physical glass layers.
   group.updateMatrixWorld(true);const sampleMeshes=meshes.filter(o=>!(o.mesh instanceof T.InstancedMesh)&&o.mesh!==cover&&o.mesh!==face&&o.mesh.parent!==layers&&!o.mesh.userData.sheet&&!o.mesh.userData.hitTarget),samples=new Float32Array(COUNT*3),p=new T.Vector3();
   const pieces=sampleMeshes.map(({mesh})=>{const original=mesh.geometry,flat=original.index?original.toNonIndexed():original;const piece=new T.BufferGeometry();piece.setAttribute('position',flat.getAttribute('position').clone());piece.applyMatrix4(mesh.matrixWorld);if(flat!==original)flat.dispose();return piece;});
   const merged=mergeGeometries(pieces,false)!;pieces.forEach(piece=>piece.dispose());const sampler=new MeshSurfaceSampler(new T.Mesh(merged)).build();
   for(let n=0;n<COUNT;n++){sampler.sample(p);samples.set(p.toArray(),n*3);}merged.dispose();
   const d={group,texture,canvas,key:'',signal:null,active:false,hot:null,cover,layers,index:i,samples,meshes,bars,solid:i===selected?1:.58,hover:0,outline};dossiers.push(d);redraw(d,latest.current.signals);
  }
  metal.dispose();dark.dispose();light.dispose();accent.dispose();glow.dispose();
  document.fonts.ready.then(()=>{if(!dead)for(const d of dossiers){d.key='';redraw(d,latest.current.signals,d.index===selected);}});
  // Persistent, truly spatial currents. Module selection changes their trajectory without replacing the background.
  const count=14000,flowGeometry=new T.BufferGeometry(),flowPositions=new Float32Array(count*3),seed=new Float32Array(count);
  for(let n=0;n<count;n++){const row=Math.floor(n/280),u=(n%280)/279;flowPositions.set([-25+u*50,(row/50-.5)*3.6,-3-row*.28],n*3);seed[n]=((n*16807)%65537)/65537;}
  flowGeometry.setAttribute('position',new T.BufferAttribute(flowPositions,3));flowGeometry.setAttribute('aSeed',new T.BufferAttribute(seed,1));
  const flowUniforms={uTime:{value:0},uTask:{value:selected},uWork:{value:0},uMotion:{value:1},uPointer:{value:new T.Vector2(-9,-9)}};
  const flowMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:flowUniforms,vertexShader:`attribute float aSeed;uniform float uTime,uTask,uWork,uMotion;uniform vec2 uPointer;varying float vAlpha;varying vec3 vColour;void main(){vec3 p=position;float t=uTime*.32*uMotion;p.y+=sin(p.x*.19+t+uTask*.58)*1.35+cos(p.z*.16+t*.7)*.5+.9;p.x+=sin(t+p.z*.2)*.6;p.z+=sin(p.x*.12+uTask*.3)*1.6;vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.);vec2 d=clip.xy/clip.w-uPointer;float near=exp(-dot(d,d)*22.);p.y+=near*.5*uMotion;p.z+=near*.8*uMotion;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.5+aSeed*1.7)*27./max(7.,-mv.z),1.1,4.5);vAlpha=(.48+aSeed*.5)*(1.-uWork*.18);vColour=mix(vec3(.08,.28,.47),vec3(.34,.62,.83),aSeed);}`,fragmentShader:pointFragment});const flow=new T.Points(flowGeometry,flowMaterial);scene.add(flow);
  // Fine spatial guides, rather than a white floor or a separate decorative backdrop.
  const rails=new T.Group();scene.add(rails);
  const paths:T.CatmullRomCurve3[]=[];const pulses:T.Mesh[]=[];
  for(let n=0;n<3;n++){
   const curve=new T.CatmullRomCurve3([new T.Vector3(-15,1.3+n*.14,-12),new T.Vector3(-4,3.3+n*.14,-7),new T.Vector3(4,4.2+n*.14,-5),new T.Vector3(14,1.7+n*.14,-8),new T.Vector3(23,-2+n*.14,-14)]);paths.push(curve);
   rails.add(new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(150)),new T.LineBasicMaterial({color:n===1?'#c3eaff':'#6396bd',transparent:true,opacity:n===1?.42:.26})));
   for(let l=0;l<5;l++){const pulse=new T.Mesh(new T.SphereGeometry(l===0?.035:.015,6,4),new T.MeshBasicMaterial({color:'#ddf7ff',transparent:true,opacity:.8}));scene.add(pulse);pulses.push(pulse);}
  }
  for(let n=0;n<5;n++){const points:T.Vector3[]=[];for(let k=0;k<=100;k++){const x=-28+k*.56;points.push(new T.Vector3(x,-2.25+n*.006,-6-n*2+Math.sin(x*.085)*2.6));}rails.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#6297bb',transparent:true,opacity:n%2?.13:.26})));}
  // One point cloud is shared across transitions. Rapid re-selection starts at the currently rendered positions.
  const cloudGeometry=new T.BufferGeometry(),from=new Float32Array(COUNT*3),target=new Float32Array(dossiers[selected].samples),seeds=new Float32Array(COUNT);
  for(let n=0;n<COUNT;n++)seeds[n]=((n*48271)%2147483647)/2147483647;
  cloudGeometry.setAttribute('position',new T.BufferAttribute(from,3));cloudGeometry.setAttribute('aTarget',new T.BufferAttribute(target,3));cloudGeometry.setAttribute('aSeed',new T.BufferAttribute(seeds,1));
  const cloudUniforms={uMorph:{value:1},uAmount:{value:0},uMatrix:{value:new T.Matrix4()},uMotion:{value:1},uTime:{value:0}};
  const cloudMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:cloudUniforms,vertexShader:`attribute vec3 aTarget;attribute float aSeed;uniform float uMorph,uAmount,uTime,uMotion;uniform mat4 uMatrix;varying float vAlpha;varying vec3 vColour;void main(){float w=sin(uMorph*3.14159265);vec3 q=(uMatrix*vec4(aTarget,1.)).xyz;vec3 p=mix(position,q,uMorph);p.y+=w*(.8+sin(aSeed*98.)*.32);p.z+=w*sin(aSeed*74.)*.5;p.x+=w*sin(aSeed*42.)*.4;p.y+=sin(uTime*.5+aSeed*80.)*.015*uMotion;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(2.2*25./max(5.,-mv.z),1.1,4.0);vColour=mix(vec3(.055,.22,.39),vec3(.19,.46,.7),aSeed);vAlpha=uAmount*.8;}`,fragmentShader:pointFragment});const pointCloud=new T.Points(cloudGeometry,cloudMaterial);pointCloud.frustumCulled=false;scene.add(pointCloud);
  const tmp=new T.Vector3(),pos=new T.Vector3(),scale=new T.Vector3(),anchor=new T.Vector3(),anchorDirection=new T.Vector3(),ray=new T.Raycaster(),pointer=new T.Vector2(-9,-9),labelPositions=new Map<number,{x:number;y:number}>();let pinnedIndex=-1;let previousPhase='',overScene=false,lastHot=-1,lastPart=-1,hoverExpires=0,hotAction:SceneAction|null=null;
  let bounds={left:0,top:0};
  const resize=()=>{const r=el.getBoundingClientRect();bounds={left:r.left,top:r.top};width=r.width;height=r.height;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();wake.current();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const updatePointer=(e:{clientX:number;clientY:number})=>{pointer.set((e.clientX-bounds.left)/width*2-1,-(e.clientY-bounds.top)/height*2+1);wake.current();};
  renderer.domElement.addEventListener('pointermove',e=>{updatePointer(e);if(drag){const dx=e.clientX-downX,dy=e.clientY-downY;if(Math.abs(dx)+Math.abs(dy)>3)moved=true;if(!latest.current.working){yaw=T.MathUtils.clamp(yaw+dx*.003,-.42,.42);pitch=T.MathUtils.clamp(pitch+dy*.002,-.18,.18);}downX=e.clientX;downY=e.clientY;}},{signal:abort.signal});
  // Track the pointer on the interface too; the background responds without stealing input.
  window.addEventListener('pointermove',e=>{updatePointer(e);overScene=e.target===renderer.domElement||!!(e.target as HTMLElement)?.closest?.('.scene-label-layer');},{passive:true,signal:abort.signal});renderer.domElement.addEventListener('pointerleave',()=>{if(!uiHover.current)overScene=false;},{signal:abort.signal});window.addEventListener('blur',()=>{pointer.set(-9,-9);overScene=false;uiHover.current=null;},{signal:abort.signal});
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.button)return;updatePointer(e);drag=true;moved=false;downX=e.clientX;downY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);},{signal:abort.signal});
  const shown=(o:T.Object3D)=>{for(let p:T.Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const pick=()=>{ray.setFromCamera(pointer,camera);return ray.intersectObjects(pickables,false).find(hit=>shown(hit.object));};
  const activate=(hit:T.Intersection)=>{const index=hit.object.userData.module as number,part=hit.object.userData.part as number|undefined;const definition=PART_LABELS.find(value=>value.module===index&&value.part===part);const action=definition?.action??(hit.object.userData.face&&hit.uv?faceAction(hit.uv.x,hit.uv.y,index,latest.current.signals.contract.reviewed):null);if(action)latest.current.onAction(index,action,definition&&'detail' in definition?definition.detail:index===2&&hit.uv?(1-hit.uv.y)*900>585?'net':(1-hit.uv.y)*900>495?'deductions':'gross':undefined);else if(!latest.current.working)latest.current.onSelect(index);};
  renderer.domElement.addEventListener('pointerup',e=>{updatePointer(e);const hit=pick();if(drag&&!moved&&hit)activate(hit);drag=false;},{signal:abort.signal});
  renderer.domElement.addEventListener('pointercancel',()=>{drag=false;},{signal:abort.signal});
  renderer.domElement.addEventListener('dblclick',e=>{updatePointer(e);const hit=pick();if(hit&&!latest.current.working&&!moved)latest.current.onOpen(hit.object.userData.module);},{signal:abort.signal});
  renderer.domElement.addEventListener('wheel',e=>{if(latest.current.working)return;e.preventDefault();zoom=T.MathUtils.clamp(zoom+e.deltaY*.0003,.85,1.25);},{passive:false,signal:abort.signal});
  function setFromCurrent(next:number,now:number){
   const targetMatrix=dossiers[selected].group.matrixWorld,w=Math.sin(morph*Math.PI);for(let n=0;n<COUNT;n++){const n3=n*3;tmp.fromArray(target,n3).applyMatrix4(targetMatrix);pos.fromArray(from,n3).lerp(tmp,morph);if(morph<1){pos.y+=w*(.8+Math.sin(seeds[n]*98)*.32);pos.z+=w*Math.sin(seeds[n]*74)*.5;pos.x+=w*Math.sin(seeds[n]*42)*.4;}from.set(pos.toArray(),n3);}target.set(dossiers[next].samples);(cloudGeometry.getAttribute('position') as T.BufferAttribute).needsUpdate=true;(cloudGeometry.getAttribute('aTarget') as T.BufferAttribute).needsUpdate=true;morph=0;morphStarted=now;selected=next;lastShadow=-Infinity;
  }
  function draw(now:number){
   const cpuStart=performance.now();
   frame=0;if(dead||contextLost||document.hidden)return;const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;const s=latest.current,still=s.paused||reduce.matches,k=still?1:1-Math.exp(-dt*5.4);if(!still)clock+=dt;
   if(s.reset!==oldReset){oldReset=s.reset;yaw=pitch=0;zoom=1;}
   const next=Math.max(0,Math.min(7,s.selected));if(next!==selected){setFromCurrent(next,now);}
   morph=still||morphStarted===0?1:Math.min(1,(now-morphStarted)/1050);work=T.MathUtils.lerp(work,s.working?1:0,k);result=T.MathUtils.lerp(result,s.view==='result'&&s.working?1:0,k);cloud=T.MathUtils.lerp(cloud,s.particles?1:0,k);boot=T.MathUtils.lerp(boot,s.entering?0:1,k);
   const aspect=width/height,narrow=Math.max(0,(1.65-aspect)/.5),float=still?0:Math.sin(clock*.54)*.045*(1-work);
   // Use a screen anchor for the actual selected mesh, so different desktop ratios do not crop the dossier.
   const azimuth=selected===2?.65:selected===6?-.7:0;cameraTarget.set(8-work*1.2+narrow*1.5+azimuth,6.4-work*.8+narrow*.8+(selected===2?.4:0),(17.8+narrow*3.7+(selected===6?.6:0))*zoom);camera.position.lerp(cameraTarget,k);tmp.set(-1.2+work*(9.0+narrow*1.5),.5+work*.3,-.3);look.lerp(tmp,k);camera.lookAt(look);camera.updateMatrixWorld(true);
   anchor.set(-.70-narrow*.05,-.31,.5).unproject(camera);anchorDirection.copy(anchor).sub(camera.position).normalize();anchor.copy(camera.position).addScaledVector(anchorDirection,((1.1-work*.6)-camera.position.z)/anchorDirection.z);
   const hit=overScene&&!drag?pick():undefined,hitIndex=hit?.object.userData.module??-1,hitPart=hit?.object.userData.part??-1;
   if(uiHover.current){hover=uiHover.current.index;lastPart=uiHover.current.part;hotAction=uiHover.current.action;lastHot=hover;hoverExpires=now+180;}
   else if(hitIndex>=0){hover=hitIndex;lastHot=hitIndex;lastPart=hitPart;hotAction=hit?.object.userData.face&&hit.uv?faceAction(hit.uv.x,hit.uv.y,hitIndex,s.signals.contract.reviewed):null;hoverExpires=now+180;}
   else if(now<hoverExpires){hover=lastHot;}else{hover=-1;lastPart=-1;hotAction=null;}
   if(s.entering||s.cinema){hover=-1;lastPart=-1;}if(hover<0)pinnedIndex=-1;else if(pinnedIndex!==hover)pinnedIndex=hover;
   for(const d of dossiers){
    d.hover=T.MathUtils.lerp(d.hover,d.index===hover?1:0,k);const arrival=T.MathUtils.clamp(boot*1.6-Math.min((d.index-selected+8)%8,(selected-d.index+8)%8)*.11,0,1);
    const active=d.index===selected;let rel=(d.index-selected+8)%8;if(rel>4)rel-=8;const tx=active?T.MathUtils.lerp(2,anchor.x,work):2+rel*1.45,ty=active?T.MathUtils.lerp(.8,anchor.y,work):Math.abs(rel)*.14,tz=active?1.1-work*.6:-2.7-Math.abs(rel)*1.2;
    pos.set(tx,ty+(active?float:0)+d.hover*.13*(1-work)-(1-arrival)*2,tz+d.hover*.24*(1-work)-(1-arrival)*2);d.group.position.lerp(pos,k);d.group.rotation.x=T.MathUtils.lerp(d.group.rotation.x,active?-.11+work*.12:-.16,k);d.group.rotation.y=T.MathUtils.lerp(d.group.rotation.y,active?-.25+work*.12:-.65,k);d.group.rotation.z=T.MathUtils.lerp(d.group.rotation.z,active?-.055:0,k);const size=(active?1.38:.86)*(1-work*.4)*(active?1-work*narrow*.25:1)*(1+d.hover*.025*(1-work))*(.84+arrival*.16);scale.setScalar(size);d.group.scale.lerp(scale,k);
    d.cover.position.z=T.MathUtils.lerp(d.cover.position.z,.22+(active?work*.72+result*.28:0)+d.hover*.095,k);d.cover.position.y=T.MathUtils.lerp(d.cover.position.y,active?work*.35:0,k);
    for(const item of d.meshes){if(item.mesh.userData.sheet){const l=item.mesh.userData.sheet;item.mesh.position.z=T.MathUtils.lerp(item.mesh.position.z,-.36-(l-1)*.19-(active?work*.14*l:0),k);item.mesh.position.x=T.MathUtils.lerp(item.mesh.position.x,active?work*.14*l:0,k);}}
    d.layers.position.z=T.MathUtils.lerp(d.layers.position.z,active?work*.4:0,k);d.layers.position.y=T.MathUtils.lerp(d.layers.position.y,active?work*2.15:0,k);d.layers.visible=active&&work>.05;
    if(d.index===2){const vals=[s.signals.salary.gross,s.signals.salary.deductions,s.signals.salary.net],max=Math.max(1,...vals.map(v=>v??0));d.bars.forEach((bar,b)=>{const h=vals[b]===null?.12:Math.max(.06,(vals[b]??0)/max*1.65);bar.scale.y=T.MathUtils.lerp(bar.scale.y,h,k);bar.position.y=-.8+bar.scale.y/2;for(const target of bar.children)if(target.userData.hitTarget)target.scale.y=Math.max(1,.35/bar.scale.y);});}
    if(d.index===6)d.bars.forEach((bar,b)=>{bar.visible=!s.signals.subsidy.checked||b<s.signals.subsidy.states.length;const state=s.signals.subsidy.states[b],mat=bar.material as T.MeshStandardMaterial;mat.color.set(state==='met'?'#5b99c5':state==='unmet'?'#b38a56':'#9aaebd');});
    if(d.index===3){const values=s.signals.tools.tax.values??[],max=Math.max(1,...values.map(v=>v??0));d.bars.forEach((bar,b)=>{const h=values[b]===undefined?.16:Math.max(.08,(values[b]??0)/max*1.15);bar.scale.y=T.MathUtils.lerp(bar.scale.y,h,k);bar.position.y=-.72+bar.scale.y/2;for(const target of bar.children)if(target.userData.hitTarget)target.scale.y=Math.max(1,.35/bar.scale.y);});}
    if(d.index===4||d.index===7){const value=s.signals.tools[d.index===4?'social':'leaving'];d.bars.forEach((bar,b)=>{(bar.material as T.MeshStandardMaterial).color.set(value.ready?(value.values?.[b]?'#4395bf':'#9faeb9'):'#9faeb9');});}
    const activeAlpha=cloud>.01?1-cloud:T.MathUtils.smoothstep(morph,.28,.85);d.solid=T.MathUtils.lerp(d.solid,active?activeAlpha:(s.working?.13:.42)+d.hover*.40,k);for(const item of d.meshes){const mat=item.mesh.material as T.Material;const opacity=item.opacity*d.solid*arrival,transparent=opacity<.995;if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true;}mat.opacity=opacity;item.mesh.castShadow=d.solid>.9&&!item.mesh.userData.noShadow;mat.depthWrite=!transparent;}
    (d.outline.material as T.LineBasicMaterial).opacity=d.hover*.72*arrival;d.outline.visible=d.hover>.003;
    d.bars.forEach((bar,b)=>{const material=bar.material as T.MeshStandardMaterial;material.emissive.set('#70bcf5');material.emissiveIntensity=d.index===hover&&lastPart===b?.55:0;});
    redraw(d,s.signals,active,d.index===hover?hotAction:null);
   }
   root.rotation.y=T.MathUtils.lerp(root.rotation.y,yaw*(1-work),k);root.rotation.x=T.MathUtils.lerp(root.rotation.x,pitch*(1-work),k);root.updateMatrixWorld(true);
   pulses.forEach((p,n)=>{const path=paths[Math.floor(n/5)];path.getPointAt(T.MathUtils.euclideanModulo(clock*.035+(n%5)*.014+Math.floor(n/5)*.23,1),p.position);});
   rails.rotation.y=T.MathUtils.lerp(rails.rotation.y,(selected-3)*.025,k);
   flowUniforms.uTime.value=clock;flowUniforms.uTask.value=T.MathUtils.lerp(flowUniforms.uTask.value,selected,k);flowUniforms.uWork.value=work;flowUniforms.uMotion.value=still?0:1;flowUniforms.uPointer.value.copy(pointer);
   blue.position.x=T.MathUtils.lerp(blue.position.x,6+(still?0:T.MathUtils.clamp(pointer.x,-1,1)*.9*(1-work)),k);blue.position.y=T.MathUtils.lerp(blue.position.y,3+(still?0:T.MathUtils.clamp(pointer.y,-1,1)*.35*(1-work)),k);
   cloudUniforms.uMorph.value=morph;cloudUniforms.uAmount.value=Math.max(cloud,Math.sin(morph*Math.PI));pointCloud.visible=cloudUniforms.uAmount.value>.003;cloudUniforms.uMatrix.value.copy(dossiers[selected].group.matrixWorld);cloudUniforms.uTime.value=clock;cloudUniforms.uMotion.value=still?0:1;
   // A continuous camera crosses the same world. Working leaves a live dossier on the left, readable controls on the right.
   const occupied:{left:number;right:number;top:number;bottom:number}[]=[{left:width*.78,right:width*.97,top:108,bottom:155}];
   const labelOrder=[...dossiers].sort((a,b)=>(a.index===hover?-20:a.index===selected?-10:Math.min((a.index-selected+8)%8,(selected-a.index+8)%8))-(b.index===hover?-20:b.index===selected?-10:Math.min((b.index-selected+8)%8,(selected-b.index+8)%8)));
   for(const d of labelOrder){
    const label=labelRefs.current[d.index];if(!label)continue;tmp.set(0,1.97,.23).applyMatrix4(d.group.matrixWorld).project(camera);
    const visible=tmp.z>-1&&tmp.z<1&&Math.abs(tmp.x)<1.08&&Math.abs(tmp.y)<1.08&&!s.working&&work<.07&&!s.cinema&&!s.entering&&boot>.65;
    hide(label,!visible);const leader=leaderRefs.current[d.index];if(leader)style(leader,'visibility',visible?'visible':'hidden');data(label,'selected',String(d.index===selected));data(label,'hot',String(d.index===hover));if(!visible)continue;
    const expanded=d.index===selected||d.index===hover||label.matches(':focus-within'),w=expanded?168:31,h=62;
    const originX=T.MathUtils.clamp((tmp.x*.5+.5)*width,99,width-99),base=Math.max(165,(-tmp.y*.5+.5)*height-8);let x=originX,y=base;
    const fixed=d.index===pinnedIndex?labelPositions.get(d.index):null;const candidates=fixed?[[fixed.x-originX,fixed.y-base]]:LABEL_OFFSETS;
    for(const [dx,dy] of candidates){const xx=T.MathUtils.clamp(originX+dx,w/2+15,width-w/2-15),yy=base+dy,box={left:xx-w/2-5,right:xx+w/2+5,top:yy-h-5,bottom:yy+4};if(yy<165)continue;if(fixed||!occupied.some(r=>box.left<r.right&&box.right>r.left&&box.top<r.bottom&&box.bottom>r.top)){x=xx;y=yy;occupied.push(box);break;}}
    x=quarter(x);y=quarter(y);labelPositions.set(d.index,{x,y});style(label,'transform',`translate3d(${x}px,${y}px,0) translate(-50%,-100%)`);style(label,'zIndex',String(d.index===hover?40:d.index===selected?30:20));
    if(leader){attr(leader,'x1',String(x));attr(leader,'y1',String(y+2));attr(leader,'x2',String(quarter(originX)));attr(leader,'y2',String(quarter(base+17)));}
   }
   PART_LABELS.forEach((part,n)=>{const label=partRefs.current[n],d=dossiers[part.module],mesh=d.bars[part.part];if(!label||!mesh)return;const visible=s.working&&selected===part.module&&!s.entering&&!s.cinema&&hover===part.module&&lastPart===part.part&&shown(mesh);hide(label,!visible);if(!visible)return;tmp.set(0,part.module===2||part.module===3?(.5*mesh.scale.y+.2)/Math.max(.01,mesh.scale.y):.22,0).applyMatrix4(mesh.matrixWorld).project(camera);style(label,'transform',`translate3d(${quarter((tmp.x*.5+.5)*width)}px,${quarter(Math.max(315,(-tmp.y*.5+.5)*height-5))}px,0) translate(-50%,-100%)`);});
   style(renderer.domElement,'cursor',drag&&!s.working?'grabbing':hover>=0&&(lastPart>=0||hotAction||!s.working)?'pointer':s.working?'default':'grab');
   if(now-lastShadow>100||still){renderer.shadowMap.needsUpdate=true;lastShadow=now;countAudit('shadowRefreshes');}renderer.render(scene,camera);audit.frame({cpu:performance.now()-cpuStart,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
   const phase=morph<1?'事务迁移':s.working?(s.view==='result'?'结果展开':'材料展开'):'事务轨道';data(el!,'phase',phase);data(el!,'scene',String(selected));data(el!,'motion',still?'reduced':'dynamic');data(el!,'transition',morph.toFixed(3));data(el!,'hover',String(hover));data(el!,'hoverPart',String(lastPart));data(el!,'entry',boot.toFixed(3));if(previousPhase!==phase){previousPhase=phase;latest.current.onPhase?.(phase);}
   if(!still&&!s.suspended&&!s.entering)frame=requestAnimationFrame(draw);
  }
  wake.current=()=>{if(!frame&&!dead&&!contextLost&&!document.hidden&&!latest.current.suspended&&!latest.current.entering)frame=requestAnimationFrame(draw);};
  document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake.current();},{signal:abort.signal});
  reduce.addEventListener('change',()=>wake.current(),{signal:abort.signal});
  // Establish the initial poses before reporting that the scene is ready.
  for(const d of dossiers){const rel=(d.index-selected+8)%8;d.group.position.set(2+(rel>4?rel-8:rel)*1.45,.55,-3-Math.min(rel,8-rel)*1.2);}dossiers[selected].group.position.set(2,.55,1.1);root.updateMatrixWorld(true);for(let n=0;n<COUNT;n++){tmp.fromArray(target,n*3).applyMatrix4(dossiers[selected].group.matrixWorld);from.set(tmp.toArray(),n*3);}frame=requestAnimationFrame(draw);latest.current.onReady();
  return()=>{wake.current=()=>{};audit.dispose();dead=true;cancelAnimationFrame(frame);abort.abort();observer.disconnect();env.dispose();dossiers.forEach(d=>d.texture.dispose());const gs=new Set<T.BufferGeometry>(),ms=new Set<T.Material>();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.Line){gs.add(o.geometry);if(o instanceof T.InstancedMesh)o.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 return <div className="exhibit-webgl" ref={host} data-geometry="task-orbit-mesh">
   <div className="scene-label-layer"><svg className="scene-label-leaders" aria-hidden="true">{MODULES.map((module,index)=><line key={module.id} ref={el=>{leaderRefs.current[index]=el;}}/>)}</svg>
     {MODULES.map((module,index)=><div key={module.id} className="scene-dossier-label" ref={el=>{labelRefs.current[index]=el;}} data-dossier={index} onPointerEnter={()=>pointAt(index)} onPointerLeave={clearPoint} onFocus={()=>pointAt(index)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))clearPoint();}}>
       <button className="scene-label-title" aria-label={`打开三维事务：${module.label}`} onPointerEnter={()=>pointAt(index,-1,'open')} onClick={()=>latest.current.onAction(index,'open')}><small>{module.code}</small><strong>{module.label}</strong><span>↗</span></button>
       <div className="scene-label-actions">{module.ready?(['material','result','list'] as const).map((action,n)=><button key={action} aria-label={`${module.label}：${['准备材料','查看结果','询问清单'][n]}`} onPointerEnter={()=>pointAt(index,-1,action)} onClick={()=>latest.current.onAction(index,action)}>{['材料','结果','清单'][n]}<span>↗</span></button>):<button onClick={()=>latest.current.onAction(index,'open')}>查看规划 ↗</button>}</div>
     </div>)}
     {PART_LABELS.map((part,index)=><button key={`${part.module}-${part.part}`} className="scene-part-label" ref={el=>{partRefs.current[index]=el;}} aria-label={`三维数据：${part.label}`} onPointerEnter={()=>pointAt(part.module,part.part,part.action)} onPointerLeave={clearPoint} onFocus={()=>pointAt(part.module,part.part,part.action)} onBlur={clearPoint} onClick={()=>latest.current.onAction(part.module,part.action,'detail' in part?part.detail:undefined)}>{part.label}<span>↗</span></button>)}
   </div>
 </div>;
}
