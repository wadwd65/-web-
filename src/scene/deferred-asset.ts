/** Prefetch bytes without parsing a model or allocating a WebGL scene on hover. */
export function deferredAsset<T>(read:()=>Promise<ArrayBuffer>,parse:(bytes:ArrayBuffer)=>Promise<T>){
 let bytes:Promise<ArrayBuffer>|null=null,asset:Promise<T>|null=null;
 const prefetch=()=>bytes??=(read().catch(error=>{bytes=null;throw error;}));
 const load=()=>asset??=(prefetch().then(parse).catch(error=>{asset=null;throw error;}));
 return {prefetch,load};
}

export function disposeAfterPreparation(preparation:Promise<unknown>,release:()=>void){
 let settled=false,requested=false,released=false;
 const finish=()=>{if(settled&&requested&&!released){released=true;release();}};
 const ready=()=>{settled=true;finish();};preparation.then(ready,ready);
 return()=>{requested=true;finish();};
}
