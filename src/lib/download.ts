/** A deliberate local download: no server, account or automatic upload. */
export function saveText(text:string,filename:string){
  const json=filename.endsWith('.json');
  const url=URL.createObjectURL(new Blob([json?text:'\uFEFF'+text],{type:json?'application/json;charset=utf-8':'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function recordTime(){return new Date().toLocaleString('zh-CN',{hour12:false});}
