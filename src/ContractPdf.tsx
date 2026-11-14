import {useEffect,useRef,useState} from 'react';
import {Check,FileText,X} from 'lucide-react';
import {extractPdfText} from './lib/pdf-text.ts';
import type {PdfTextResult} from './lib/pdf-text.ts';

export default function ContractPdf({file,onApply,onBusy}:{file:File;onApply:(text:string)=>void;onBusy:(busy:boolean)=>void}){
 const [result,setResult]=useState<PdfTextResult|null>(null),[text,setText]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true),[checked,setChecked]=useState(false),[progress,setProgress]=useState('准备本地读取…'),[run,setRun]=useState(0);
 const controller=useRef<AbortController|null>(null),applyRef=useRef(onApply),busyRef=useRef(onBusy);applyRef.current=onApply;busyRef.current=onBusy;
 useEffect(()=>{const pending=new AbortController();controller.current=pending;setBusy(true);busyRef.current(true);setError('');setResult(null);setChecked(false);
  void extractPdfText(file,pending.signal,(page,total)=>setProgress(`正在本地读取 ${page} / ${total} 页`)).then(value=>{if(!pending.signal.aborted){setResult(value);setText(value.text);}}).catch(cause=>{if(!pending.signal.aborted)setError(cause instanceof Error?cause.message:'PDF 读取未完成，可重试或复制文字。');}).finally(()=>{if(!pending.signal.aborted){setBusy(false);busyRef.current(false);}});
  return()=>{pending.abort();busyRef.current(false);};
 },[file,run]);
 return <section className="pdf-text-review" aria-label="PDF本地文字提取"><header><FileText size={16}/><strong>PDF 文字 · 本机处理</strong><span className="pdf-filename">{file.name}</span><small>8 MB / 30 页以内</small></header>
 {busy?<div className="pdf-progress" role="status"><span>{progress}</span><button onClick={()=>{controller.current?.abort();setBusy(false);busyRef.current(false);setError('已取消读取，原填写没有改变。');}}><X size={13}/>取消读取</button></div>:error?<div role="alert"><p>{error}</p><button className="button secondary" onClick={()=>setRun(value=>value+1)}>重新读取</button></div>:result&&<><p>读取 {result.pages} 页。文字顺序、金额和表格可能存在偏差，请对照上方预览修改后再带入。</p>{result.emptyPages.length>0&&<p className="pdf-warning">第 {result.emptyPages.join('、')} 页没有提取到文字，可能包含扫描内容，当前文字并不完整。</p>}<label>待校对的提取文字<textarea aria-label="PDF提取文字" maxLength={60000} rows={8} value={text} onChange={event=>{setText(event.target.value);setChecked(false);}}/></label><label className="pdf-confirm"><input type="checkbox" checked={checked} onChange={event=>setChecked(event.target.checked)}/>我已对照原件核对文字、数字和缺页情况</label><button className="button primary" disabled={!checked||!text.trim()} onClick={()=>{applyRef.current(text);setChecked(false);}}><Check size={15}/>使用校对后的文字</button></>}
 <p className="pdf-privacy">文件在浏览器里读取，不会上传。带入只替换本次合同文字；不会自动发给 AI，也不会自动保存草稿。</p></section>;
}
