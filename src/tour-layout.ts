export type TourRect={left:number;top:number;width:number;height:number};
export function placeTourCard(target:TourRect|null,viewport:{width:number;height:number},card:{width:number;height:number}){
 const gap=18,margin=16,maxX=Math.max(margin,viewport.width-card.width-margin),maxY=Math.max(margin,viewport.height-card.height-margin);
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
 if(!target)return {left:clamp((viewport.width-card.width)/2,margin,maxX),top:clamp((viewport.height-card.height)/2,margin,maxY)};
 const right=target.left+target.width,bottom=target.top+target.height;
 const candidates=[
  {left:target.left-card.width-gap,top:target.top+(target.height-card.height)/2},
  {left:right+gap,top:target.top+(target.height-card.height)/2},
  {left:target.left+(target.width-card.width)/2,top:bottom+gap},
  {left:target.left+(target.width-card.width)/2,top:target.top-card.height-gap},
 ].map(p=>({left:clamp(p.left,margin,maxX),top:clamp(p.top,margin,maxY)}));
 let best=candidates[0],bestOverlap=Infinity;
 for(const p of candidates){const overlap=Math.max(0,Math.min(p.left+card.width,right)-Math.max(p.left,target.left))*Math.max(0,Math.min(p.top+card.height,bottom)-Math.max(p.top,target.top));if(overlap<bestOverlap){best=p;bestOverlap=overlap;}if(!overlap)break;}
 return best;
}
