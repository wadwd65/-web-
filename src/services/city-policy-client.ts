import {isCityPolicyResult} from '../lib/city-policies.ts';
export async function findCityPolicies(city:string,topic:string,{signal,refresh=false}:{signal?:AbortSignal;refresh?:boolean}={}){
 const response=await fetch('/api/v1/policies/search',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({city,topic,refresh}),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(25000)]):AbortSignal.timeout(25000)});
 const envelope=await response.json();if(!response.ok)throw Error(typeof envelope.error==='string'?envelope.error:'查询没有完成，可以稍后重试。');if(!isCityPolicyResult(envelope.data))throw Error('政策资料不完整，暂不显示结论。');return envelope.data;
}
