/** Accept exactly one configured HTTPS site. Forwarded host/protocol headers never grant access. */
export function createRequestPolicy({publicOrigin=process.env.FIRST_STEP_PUBLIC_ORIGIN||''}={}){
 let site=null;
 if(publicOrigin.trim()){
  try{
   site=new URL(publicOrigin.trim());
   if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash)throw Error();
  }catch{throw Error('FIRST_STEP_PUBLIC_ORIGIN需要完整的HTTPS站点地址，不含路径、账号或参数。');}
 }
 return {
  secure:Boolean(site),
  allows(req){
   try{
    const host=req.headers.host||'';
    if(!host||/[\s/@\\?#]/u.test(host))return false;
    const origin=req.headers.origin;
    if(site){
     if(new URL('https://'+host).host!==site.host)return false;
     return origin===site.origin||!origin&&['GET','HEAD'].includes(req.method);
    }
    if(!['127.0.0.1','localhost','[::1]'].includes(new URL('http://'+host).hostname))return false;
    return !origin||origin===`http://${host}`||origin===`https://${host}`;
   }catch{return false;}
  },
 };
}
