type Point={pointerId:number;x:number;y:number};
type Press=Point&{button:number;isPrimary:boolean;index:number};
type Release=Point&{button:number;index:number;inside:boolean};
type Gesture=Point&{index:number;pitch:number;yaw:number;dragged:boolean};

/** Each case owns its orientation. Capturing one pointer never changes a
 * neighbour's target, and a drag can never become an open-detail click. */
export function createArchiveDrag(count:number){
 const poses=Array.from({length:count},()=>({pitch:0,yaw:0}));
 let press:Gesture|null=null;
 const valid=(index:number)=>Number.isInteger(index)&&index>=0&&index<count;
 return {
  poses,
  get press(){return press;},
  begin(event:Press){
   if(press||event.button!==0||!event.isPrimary||!valid(event.index))return false;
   const pose=poses[event.index];
   press={pointerId:event.pointerId,x:event.x,y:event.y,index:event.index,pitch:pose.pitch,yaw:pose.yaw,dragged:false};
   return true;
  },
  move(event:Point){
   if(!press||press.pointerId!==event.pointerId)return false;
   const dx=event.x-press.x,dy=event.y-press.y;
   if(Math.hypot(dx,dy)>6)press.dragged=true;
   if(press.dragged){
    const pose=poses[press.index];
    pose.pitch=Math.max(-.18,Math.min(.18,press.pitch+dy*.0025));
    pose.yaw=Math.max(-.30,Math.min(.30,press.yaw+dx*.003));
   }
   return press.dragged;
  },
  finish(event:Release):number|null{
   if(!press||press.pointerId!==event.pointerId||event.button!==0)return null;
   const down=press;press=null;
   return !down.dragged&&event.inside&&event.index===down.index&&Math.hypot(event.x-down.x,event.y-down.y)<=6?down.index:null;
  },
  cancel(pointerId?:number){if(pointerId===undefined||press?.pointerId===pointerId)press=null;},
  reset(){press=null;for(const pose of poses){pose.pitch=0;pose.yaw=0;}}
 };
}
