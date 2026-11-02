import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ScanLine,Square,Upload,X} from 'lucide-react';
type Extraction={text:string;warnings:string[];page:number};
export default function ContractImage({onConfirm}:{onConfirm:(text:string)=>void}){
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Extraction|null>(null),[text,setText]=useState(''),[confirmed,setConfirmed]=useState(false),[applied,setApplied]=useState(false);
 const details=useRef<HTMLDetailsElement>(null);
 const request=useRef<AbortController|null>(null),serial=useRef(0);
 useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);useEffect(()=>()=>request.current?.abort(),[]);
 function stop(){serial.current++;request.current?.abort();request.current=null;setBusy(false);setError('已停止识别，原图还在，可以重试。');}
 function choose(next:File|undefined){if(!next)return;stop();setError('');setResult(null);setText('');setConfirmed(false);setApplied(false);if(!['image/png','image/jpeg'].includes(next.type)||next.size>4*1024*1024){setFile(null);setUrl('');setError('请选择4 MB以内的PNG或JPEG单页图片。');return;}setFile(next);setUrl(URL.createObjectURL(next));}
 async function extract(){if(!file||request.current)return;const id=++serial.current,controller=new AbortController();request.current=controller;setBusy(true);setError('');setResult(null);setApplied(false);setConfirmed(false);
  try{const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('图片读取失败。'));reader.readAsDataURL(file);});if(serial.current!==id)return;
   const response=await fetch('/api/v1/contract/extract-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image}),credentials:'same-origin',signal:controller.signal});const value=await response.json();if(!response.ok)throw Error(value.error||'识别失败，请重试。');
   if(serial.current!==id)return;if(typeof value.data?.text!=='string'||!Array.isArray(value.data?.warnings))throw Error('识别结果不完整，请重试。');setResult(value.data);setText(value.data.text);
  }catch(cause){if(serial.current===id)setError(cause instanceof Error?cause.message:'识别失败，请重试或粘贴文字。');}finally{if(serial.current===id){request.current=null;setBusy(false);}}
 }
 return <details ref={details} className="contract-image"><summary><ScanLine size={16}/><span>从合同照片开始<small>单页图片 · 识别后由你校对</small></span><Upload size={14}/></summary><div className="ci-content"><p>选择图片只会在本页预览。点击“发送此图识别”才发送至 DeepSeek；不会保存到账号。</p><label className="ci-select"><Upload size={15}/>{file?'重新选择图片':'选择一张合同图片'}<input type="file" accept="image/png,image/jpeg" aria-label="选择一张合同图片" disabled={busy} onChange={event=>{choose(event.target.files?.[0]);event.target.value='';}}/></label>
 {url&&<><div className="ci-preview"><img src={url} alt="本次待校对的合同原图"/><span>原图 / 第1页</span></div><div className="ci-actions">{busy?<button onClick={stop}><Square size={12}/>停止识别</button>:<button onClick={()=>void extract()}><ScanLine size={14}/>{result?'重新识别':'发送此图识别'}</button>}<small>{busy?'正在读取本页文字…':file?.name}</small></div></>}
 {result&&<section className="ci-correction"><header><strong>先对照原图，再确认文字</strong><small>识别结果尚未用于核对</small></header>{result.warnings.map((warning,i)=><p className="ci-warning" key={i}>{warning}</p>)}<label>识别文字，可直接修改<textarea aria-label="识别文字，可直接修改" rows={9} maxLength={12000} value={text} onChange={event=>{setText(event.target.value);setConfirmed(false);setApplied(false);}}/></label><label className="ci-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>我已对照原图校对，模糊和缺失处保留待确认</label><button className="ci-apply" disabled={!confirmed||!text.trim()||busy} onClick={()=>{onConfirm(text);setApplied(true);if(details.current)details.current.open=false;}}>{applied?<><Check size={14}/>已带入下方文字区</>:<>使用校对后的文字<ArrowRight size={14}/></>}</button><p>仅替换文字，不自动判断用工类型或期限，也不自动生成最终结论。</p></section>}
 {error&&<p className="ci-error" role="alert">{error}</p>}{url&&!busy&&<button className="ci-remove" onClick={()=>{setFile(null);setUrl('');setResult(null);setError('');}}><X size={12}/>移除本次图片</button>}
 </div></details>;
}
