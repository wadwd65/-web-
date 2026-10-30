// Official online fallback only. Local MP3 files are the default source.
const songs = new Map([['779491','Rhine Lab.LLC'],['232265','A World Above'],['125074','Ad astra'],['880337',"Control's Wishes"],['461158','The Coming of the Future']]);
const cache = new Map();
const pending = new Map();

export async function officialTrack(cid) {
  if (!songs.has(cid)) throw new Error('Unsupported track');
  const saved = cache.get(cid);
  if (saved && Date.now() - saved.time < 15 * 60 * 1000) return saved.data;
  if (pending.has(cid)) return pending.get(cid);
  const request = (async () => {
    const response = await fetch(`https://monster-siren.hypergryph.com/api/song/${cid}`, {signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('Official source unavailable');
    const payload = await response.json();
    const data = payload?.data;
    const source = new URL(data?.sourceUrl ?? 'about:blank');
    if (payload.code !== 0 || String(data.cid) !== cid || source.protocol !== 'https:' || !/^(?:host)?res\d+\.hycdn\.cn$/u.test(source.hostname)) throw new Error('Invalid official music metadata');
    const track = {cid,name:songs.get(cid),artist:'塞壬唱片-MSR',source:source.href,page:`https://monster-siren.hypergryph.com/music/${cid}`};
    cache.set(cid,{time:Date.now(),data:track});
    return track;
  })();
  pending.set(cid,request);
  try { return await request; } finally { pending.delete(cid); }
}

export function musicMiddleware(req,res,next) {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (!pathname.startsWith('/__first-step-music/')) return false;
  const cid = pathname.slice('/__first-step-music/'.length);
  const send = (status,payload) => {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method === 'HEAD' ? undefined : JSON.stringify(payload));};
  if (!['GET','HEAD'].includes(req.method ?? 'GET')) {send(405,{error:'Method not allowed'});return true;}
  if (!songs.has(cid)) {send(404,{error:'Unknown soundtrack'});return true;}
  officialTrack(cid).then(data=>send(200,data)).catch(()=>send(502,{error:'官方音源暂时无法连接，请稍后重试。'}));
  return true;
}
