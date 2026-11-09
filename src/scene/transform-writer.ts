import type {Object3D} from 'three';

/** Compose only changed local transforms. World propagation still goes through
 * Three, so moving a parent updates all of its frozen children correctly. */
export function createTransformWriter(){
 const previous=new WeakMap<Object3D,number[]>();
 return (object:Object3D)=>{
  const p=object.position,q=object.quaternion,s=object.scale,old=previous.get(object);
  if(old&&old[0]===p.x&&old[1]===p.y&&old[2]===p.z&&old[3]===q.x&&old[4]===q.y&&old[5]===q.z&&old[6]===q.w&&old[7]===s.x&&old[8]===s.y&&old[9]===s.z)return false;
  const values=old??new Array<number>(10);values[0]=p.x;values[1]=p.y;values[2]=p.z;values[3]=q.x;values[4]=q.y;values[5]=q.z;values[6]=q.w;values[7]=s.x;values[8]=s.y;values[9]=s.z;
  if(!old)previous.set(object,values);object.matrixAutoUpdate=false;object.updateMatrix();return true;
 };
}
