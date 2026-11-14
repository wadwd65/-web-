import {PDF_LIMITS,pdfPageText} from './pdf-text-layout.ts';
import type {PdfTextResult} from './pdf-text-layout.ts';
export type {PdfTextResult} from './pdf-text-layout.ts';
export async function extractPdfText(file:File,signal:AbortSignal,onProgress:(page:number,total:number)=>void=()=>{}):Promise<PdfTextResult>{
 if(file.size>PDF_LIMITS.bytes)throw Error('PDF 超过 8 MB，请缩小文件或只选本次要核对的部分。');
 signal.throwIfAborted();
 // Loaded only after explicitly choosing a PDF. The version-matched worker is local.
 const {getDocument,GlobalWorkerOptions}=await import('pdfjs-dist');
 signal.throwIfAborted();GlobalWorkerOptions.workerSrc=new URL('/pdfjs/pdf.worker.min.mjs',location.origin).href;
 const data=new Uint8Array(await file.arrayBuffer());signal.throwIfAborted();
 const task=getDocument({data,cMapUrl:new URL('/pdfjs/cmaps/',location.origin).href,cMapPacked:true,useWorkerFetch:true,stopAtErrors:true,disableFontFace:true,useSystemFonts:true});
 const cancel=()=>{void task.destroy();};signal.addEventListener('abort',cancel,{once:true});
 try{
  const doc=await task.promise;signal.throwIfAborted();
  if(doc.numPages>PDF_LIMITS.pages)throw Error(`这份 PDF 有 ${doc.numPages} 页，本次最多读取 30 页。请先拆分后再试。`);
  const pages:string[]=[],emptyPages:number[]=[];let count=0;
  for(let index=1;index<=doc.numPages;index++){
   signal.throwIfAborted();const page=await doc.getPage(index);const content=await page.getTextContent();signal.throwIfAborted();
   const text=pdfPageText(content.items);page.cleanup();if(!text.trim())emptyPages.push(index);count+=text.length;
   if(count+Math.max(0,index-1)*2>PDF_LIMITS.characters)throw Error('提取文字超过 60,000 字符，请拆分材料后再试。');pages.push(text);onProgress(index,doc.numPages);
  }
  if(!pages.some(page=>page.trim()))throw Error('未提取到可读文字，可能是扫描件或文字已转为图形。可复制文字粘贴，或使用单页照片识别后校对。');
  return {text:pages.join('\n\n'),pages:doc.numPages,emptyPages};
 }catch(cause){
  if(signal.aborted)throw new DOMException('已取消 PDF 读取','AbortError');
  if(cause instanceof Error&&cause.name==='PasswordException')throw Error('这是加密 PDF，请先在本机解除密码后再选取；此处不会上传或尝试破解。');
  if(cause instanceof Error&&/InvalidPDF|MissingPDF|UnknownError/u.test(cause.name))throw Error('这份 PDF 暂时无法读取，请确认文件完整，或改用复制文字。');
  throw cause;
 }finally{signal.removeEventListener('abort',cancel);await task.destroy();}
}
