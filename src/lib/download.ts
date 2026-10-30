/** A deliberate local download: no server, account or automatic upload. */
export function saveText(text:string,filename:string){
  const url=URL.createObjectURL(new Blob(['\uFEFF'+text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function recordTime(){return new Date().toLocaleString('zh-CN',{hour12:false});}
