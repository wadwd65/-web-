/** Independently composed editions using attributed, non-character Arknights
 * environments. These are not the songs' official album covers. */
const artworkFiles=['rhine-corridor.png','rhine-sky.png','rhine-ascent.png','rhine-energy.png','rhine-ecolab.png'];
export const MUSIC_ATMOSPHERES=['扫描光','横向云流','上升星尘','扩散光环','漂浮微粒'] as const;
const images:(HTMLImageElement|null)[]=Array(artworkFiles.length).fill(null);
let artworkPromise:Promise<void>|null=null;
export function warmArtworkAssets(){return artworkPromise??=Promise.allSettled(artworkFiles.map(async(file,index)=>{const image=new Image();image.src='/artwork/'+file;await image.decode();images[index]=image;})).then(()=>{thumbnails.clear();});}
export const MUSIC_EDITIONS=[
 {accent:'#b4e5e6',secondary:'#8caed9',ink:'#153342',mood:'理性 · 细密 · 克制',word:'STRUCTURE',subtitle:'秩序之中，仍有回声。',artwork:0,atmosphere:0,overlay:'#5183a41a'},
 {accent:'#bad3ff',secondary:'#e9bba6',ink:'#253a62',mood:'辽阔 · 舒展 · 向外',word:'HORIZON',subtitle:'把目光，留给更远的地方。',artwork:1,atmosphere:1,overlay:'#5183a41a'},
 {accent:'#d4d4ff',secondary:'#91d8ea',ink:'#303657',mood:'空灵 · 上升 · 明亮',word:'ASCENT',subtitle:'循着微光，向上而行。',artwork:2,atmosphere:2,overlay:'#5183a41a'},
 {accent:'#edc5ad',secondary:'#a7c8e6',ink:'#3a394b',mood:'沉静 · 坚定 · 推进',word:'IMPULSE',subtitle:'愿望在寂静中持续生长。',artwork:3,atmosphere:3,overlay:'#5183a41a'},
 {accent:'#c2ded0',secondary:'#b6c8ff',ink:'#243f49',mood:'清透 · 期待 · 延展',word:'EMERGENCE',subtitle:'在此刻，听见将至的未来。',artwork:4,atmosphere:4,overlay:'#5183a41a'},
 {
  accent:'#9bdce1',secondary:'#91bce9',ink:'#1f4259',
  mood:'深蓝 · 流动 · 远方',word:'BEYOND',subtitle:'彼端 · 水月与深蓝之树',
  artwork:1,atmosphere:1,overlay:'#16528654',motif:'water',
 },
 {
  accent:'#c1e6e1',secondary:'#f0d1ad',ink:'#314f5c',
  mood:'轻快 · 松弛 · 清亮',word:'DAYLIGHT',subtitle:'放松一点，继续向前。',
  artwork:1,atmosphere:4,overlay:'#dabf8b20',
 },
 {
  accent:'#e8d3bc',secondary:'#c7dfc7',ink:'#43545d',
  mood:'温暖 · 舒展 · 轻盈',word:'SPRING',subtitle:'春弦 · 轻轻展开的旋律',
  artwork:2,atmosphere:2,overlay:'#c5ba8d25',
 },
] as const;
export const musicEdition=(index:number)=>MUSIC_EDITIONS[((index%MUSIC_EDITIONS.length)+MUSIC_EDITIONS.length)%MUSIC_EDITIONS.length];
export const musicAtmosphere=(index:number)=>MUSIC_ATMOSPHERES[musicEdition(index).atmosphere];
export const editionSceneArtwork=(index:number)=>'/artwork/'+artworkFiles[musicEdition(index).artwork];

/** A shared motif joins the physical label, cover thumbnail and listening UI. */
export function drawEdition(canvas:HTMLCanvasElement,index:number,typography=true){
 const c=canvas.getContext('2d')!,s=canvas.width,d=musicEdition(index);c.save();c.scale(s/512,s/512);
 const image=images[d.artwork];if(image){
  const side=Math.min(image.naturalWidth,image.naturalHeight),left=(image.naturalWidth-side)*.5,top=(image.naturalHeight-side)*.5;c.drawImage(image,left,top,side,side,0,0,512,512);
  c.fillStyle=d.overlay;c.fillRect(0,0,512,512);
  if('motif' in d && d.motif==='water'){
   c.save();c.strokeStyle='#c6f3f761';c.lineWidth=1.2;
   for(let wave=0;wave<7;wave++){
    c.beginPath();
    for(let x=0;x<=512;x+=8){
     const y=120+wave*43+Math.sin(x/85+wave*.7)*8;
     if(x===0)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.stroke();
   }
   c.restore();
  }
  const shade=c.createLinearGradient(0,230,0,512);shade.addColorStop(0,'#07172700');shade.addColorStop(1,'#061623dc');c.fillStyle=shade;c.fillRect(0,0,512,512);
  if(typography){c.fillStyle='#eef8fd';c.font='500 32px Arial,sans-serif';c.fillText(d.word,29,446);c.fillStyle=d.accent;c.font='11px ui-monospace,monospace';c.fillText(`R / ${String(index+1).padStart(2,'0')}    RHINE LAB / SOUND`,31,470);}c.restore();return canvas;
 }
 c.fillStyle=d.ink;c.fillRect(0,0,512,512);
 const light=c.createRadialGradient(306,228,2,306,228,310);light.addColorStop(0,d.secondary+'b0');light.addColorStop(.35,d.accent+'42');light.addColorStop(1,d.ink+'00');c.fillStyle=light;c.fillRect(0,0,512,512);
 c.save();c.translate(270,228);c.rotate(-.68+index*.21);c.scale(1,.57+index*.04);
 for(let i=0;i<28;i++){c.strokeStyle=i%5===0?d.accent+'b0':d.accent+'38';c.lineWidth=i%5===0?1.35:.65;c.beginPath();c.ellipse(0,0,68+i*5.5,68+i*5.5,0,-.25,Math.PI*1.85);c.stroke();}c.restore();
 const beam=c.createLinearGradient(0,390,512,100);beam.addColorStop(0,d.accent+'00');beam.addColorStop(.45,d.accent+'14');beam.addColorStop(.51,'#effbffc0');beam.addColorStop(.57,d.secondary+'30');beam.addColorStop(1,d.accent+'00');c.fillStyle=beam;c.beginPath();c.moveTo(-30,395);c.lineTo(540,48+index*17);c.lineTo(540,95+index*17);c.lineTo(-30,428);c.fill();
 c.fillStyle=d.accent+'36';for(let y=44;y<470;y+=19)for(let x=38;x<486;x+=19){if((x*7+y*13+index*17)%41>15)c.fillRect(x,y,.9,.9);}
 c.strokeStyle='#e9f8ff8c';c.lineWidth=1;c.beginPath();c.moveTo(32,57);c.lineTo(32,32);c.lineTo(57,32);c.moveTo(455,480);c.lineTo(480,480);c.lineTo(480,455);c.stroke();
 if(typography){c.fillStyle='#eff9ff';c.font='500 35px Arial,sans-serif';c.fillText(d.word,33,438);c.fillStyle=d.accent;c.font='12px ui-monospace,monospace';c.fillText(`R / ${String(index+1).padStart(2,'0')}     SOUND COLLECTION`,35,465);}
 c.restore();return canvas;
}
const thumbnails=new Map<number,string>();
export function editionArtwork(index:number){
 let result=thumbnails.get(index);if(!result){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;drawEdition(canvas,index);result=canvas.toDataURL('image/png');thumbnails.set(index,result);}return result;
}
