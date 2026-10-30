import {createReadStream,statSync} from 'node:fs';
import path from 'node:path';
export function audioRange(header,size){
 if(!header)return null;const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2]))return false;
 const suffix=!match[1],start=suffix?Math.max(0,size-Number(match[2])):Number(match[1]),end=suffix?size-1:match[2]?Math.min(size-1,Number(match[2])):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||suffix&&Number(match[2])===0)return false;
 return {start,end};
}
/** Hashed local tracks only; stream a byte range rather than buffering/decoding the full song. */
export function audioMiddleware(root,req,res){
 let pathname;try{pathname=decodeURIComponent(new URL(req.url??'/','http://127.0.0.1').pathname);}catch{return false;}
 if(!/^\/audio\/[0-9]{6}-[a-f0-9]{10}\.mp3$/.test(pathname))return false;
 if(!['GET','HEAD'].includes(req.method??'GET')){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return true;}
 const file=path.join(root,'audio',path.basename(pathname));let stats;try{stats=statSync(file);if(!stats.isFile())throw Error('Not a file');}catch{res.writeHead(404);res.end();return true;}
 const etag='"'+path.basename(file)+'"',headers={'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Cache-Control':'private, max-age=31536000, immutable','ETag':etag,'X-Content-Type-Options':'nosniff'};
 if(!req.headers.range&&req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return true;}
 const requested=req.headers['if-range']&&req.headers['if-range']!==etag?undefined:req.headers.range,range=audioRange(requested,stats.size);
 if(range===false){res.writeHead(416,{...headers,'Content-Range':`bytes */${stats.size}`,'Content-Length':0});res.end();return true;}
 const start=range?.start??0,end=range?.end??stats.size-1;if(range)headers['Content-Range']=`bytes ${start}-${end}/${stats.size}`;
 res.writeHead(range?206:200,{...headers,'Content-Length':end-start+1});if(req.method==='HEAD'){res.end();return true;}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return true;
}
