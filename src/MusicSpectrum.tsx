import {useEffect,useRef} from 'react';
import type {SoundtrackState} from './Soundtrack.tsx';
import {spectrumBands} from './archive-motion.ts';

/** One small 24Hz audio-driven plot. Paused, muted or unavailable => quiet line. */
export default function MusicSpectrum({state,active,reduced}:{state:SoundtrackState;active:boolean;reduced:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null),latest=useRef({state,active,reduced});latest.current={state,active,reduced};
 useEffect(()=>{
  const el=canvas.current,c=el?.getContext('2d');if(!el||!c)return;let raf=0,last=0;const bars=new Float32Array(40),data=new Uint8Array(512);
  function paint(now:number){raf=0;const p=latest.current;if(document.hidden||!p.active)return;if(now-last<1000/24){raf=requestAnimationFrame(paint);return;}last=now;
   const live=p.state.playing&&p.state.volume>0&&p.state.analysisStatus==='ready'&&!p.reduced,analyser=p.state.analyser.current;data.fill(0);if(live&&analyser)analyser.getByteFrequencyData(data);
   const next=spectrumBands(data);c!.clearRect(0,0,400,46);c!.fillStyle='#afd9e6';let peak=0;for(let n=0;n<40;n++){bars[n]+=(next[n]-bars[n])*.48;peak=Math.max(peak,bars[n]);const height=Math.max(1,bars[n]*42);c!.globalAlpha=.25+bars[n]*.7;c!.fillRect(n*10,45-height,2,height);}c!.globalAlpha=1;
   el!.dataset.signal=live&&peak>.001?'live':'quiet';raf=requestAnimationFrame(paint);
  }
  const visible=()=>{cancelAnimationFrame(raf);raf=0;if(!document.hidden&&latest.current.active)raf=requestAnimationFrame(paint);};document.addEventListener('visibilitychange',visible);visible();return()=>{cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visible);};
 },[active]);
 return <div className="ma-spectrum"><div><span>LIVE / SPECTRUM</span><span>{state.playing&&state.volume>0&&state.analysisStatus==='ready'&&!reduced?'实时音频':'待机'}</span></div><canvas ref={canvas} width="400" height="46" aria-label="当前播放音频的实时频谱"/><small>LOW <i/> HIGH</small></div>;
}
