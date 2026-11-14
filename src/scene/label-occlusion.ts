export type ScreenPoint={x:number;y:number;z:number};
export type ScreenRect={left:number;right:number;top:number;bottom:number};
export type ScreenPanel={index:number;points:ScreenPoint[]};
const EPSILON=1e-6;

/** DOM labels have no depth buffer. Test their screen footprint against the
 * nearer part of each projected board instead of promoting them with z-index.
 * NDC depth is affine across a projected planar face, including a tilted face.
 * One scratch polygon is reused; no mesh raycasts or DOM measurements per label.
 */
export function createLabelOcclusion(){
 const scratch=Array.from({length:6},()=>({x:0,y:0,z:0}));let count=0;
 function nearer(panel:ScreenPanel,depth:number){
  count=0;const limit=depth-EPSILON,points=panel.points;
  if(!points.some(p=>p.z<limit))return false;
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],inside=a.z<limit,nextInside=b.z<limit;
   if(inside){Object.assign(scratch[count++],a);}
   if(inside!==nextInside){const t=(limit-a.z)/(b.z-a.z),p=scratch[count++];p.x=a.x+(b.x-a.x)*t;p.y=a.y+(b.y-a.y)*t;p.z=limit;}
  }
  return count>=3;
 }
 function rectangleHits(rect:ScreenRect){
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity,cx=0,cy=0;
  for(let i=0;i<count;i++){const p=scratch[i];left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);cx+=p.x;cy+=p.y;}
  if(rect.right<left||rect.left>right||rect.bottom<top||rect.top>bottom)return false;
  cx/=count;cy/=count;
  for(let i=0;i<count;i++){
   const a=scratch[i],b=scratch[(i+1)%count],dx=b.x-a.x,dy=b.y-a.y;
   const side=dx*(cy-a.y)-dy*(cx-a.x),x=dy>0?rect.left:rect.right,y=dx>0?rect.bottom:rect.top;
   const max=dx*(y-a.y)-dy*(x-a.x),min=dx*((dx>0?rect.top:rect.bottom)-a.y)-dy*((dy>0?rect.right:rect.left)-a.x);
   if(side>0?max<0:min>0)return false;
  }
  return true;
 }
 function segmentHits(a:Pick<ScreenPoint,'x'|'y'>,b:Pick<ScreenPoint,'x'|'y'>){
  let cx=0,cy=0;for(let i=0;i<count;i++){cx+=scratch[i].x;cy+=scratch[i].y;}cx/=count;cy/=count;
  let enter=0,exit=1;
  for(let i=0;i<count;i++){
   const p=scratch[i],q=scratch[(i+1)%count],dx=q.x-p.x,dy=q.y-p.y,sign=dx*(cy-p.y)-dy*(cx-p.x)>=0?1:-1;
   const start=sign*(dx*(a.y-p.y)-dy*(a.x-p.x)),end=sign*(dx*(b.y-p.y)-dy*(b.x-p.x));
   if(start<0&&end<0)return false;
   if(start<0)enter=Math.max(enter,start/(start-end));else if(end<0)exit=Math.min(exit,start/(start-end));
   if(enter>exit)return false;
  }
  return true;
 }
 return {
  rectangle(rect:ScreenRect,depth:number,own:number,panels:ScreenPanel[]){
   for(const panel of panels)if(panel.index!==own&&nearer(panel,depth)&&rectangleHits(rect))return true;
   return false;
  },
  segment(a:Pick<ScreenPoint,'x'|'y'>,b:Pick<ScreenPoint,'x'|'y'>,depth:number,own:number,panels:ScreenPanel[]){
   for(const panel of panels)if(panel.index!==own&&nearer(panel,depth)&&segmentHits(a,b))return true;
   return false;
  }
 };
}
