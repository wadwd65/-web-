/** Cache assigned values, since CSSOM normalizes transform strings on readback. */
export function createStyleWriter(onWrite:()=>void=()=>{}){
 const previous=new WeakMap<HTMLElement|SVGElement,Map<string,string>>();
 return (element:HTMLElement|SVGElement,key:'visibility'|'transform'|'zIndex'|'cursor',value:string)=>{
  let properties=previous.get(element);if(!properties){properties=new Map();previous.set(element,properties);}
  if(properties.get(key)===value)return;
  element.style[key]=value;properties.set(key,value);onWrite();
 };
}
