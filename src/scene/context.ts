import * as THREE from 'three';
/** Quiet, true three-dimensional context: receding galleries and an inlaid path. */
export function createContext(){
 const group=new THREE.Group();group.name='distant-research-galleries';
 const metal=new THREE.MeshStandardMaterial({color:'#afc3d3',metalness:.62,roughness:.34});
 const recess=new THREE.MeshStandardMaterial({color:'#59768f',metalness:.4,roughness:.4});
 const frames=[[-28,-43,7,17],[14,-53,5,19],[34,-40,9,13]];
 for(const [x,z,h,w] of frames){
  const structure=new THREE.Group();structure.position.set(x,0,z);
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,9),metal);body.position.y=h/2;structure.add(body);
  for(let i=0;i<6;i++){const pane=new THREE.Mesh(new THREE.BoxGeometry(w/9,h*.55,.06),recess);pane.position.set((i-2.5)*w/7,h*.58,4.54);structure.add(pane);}
  const top=new THREE.Mesh(new THREE.BoxGeometry(w+.7,.22,9.7),metal);top.position.y=h+.12;structure.add(top);group.add(structure);
 }
 const path=new THREE.CatmullRomCurve3([new THREE.Vector3(19,.015,27),new THREE.Vector3(12,.015,15),new THREE.Vector3(10,.015,4),new THREE.Vector3(13,.015,-12),new THREE.Vector3(22,.015,-30)]);
 const inlay=new THREE.Mesh(new THREE.TubeGeometry(path,128,.018,6,false),new THREE.MeshStandardMaterial({color:'#457baf',metalness:.7,roughness:.3}));group.add(inlay);
 return group;
}
