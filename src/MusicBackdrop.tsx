import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {editionSceneArtwork} from './music-artwork.ts';
import {MUSIC_ATMOSPHERE_FADE_MS as FADE_MS} from './music-atmosphere-blend.ts';
import './music-background.css';

const SCENES=[
 {base:'#dfe9ec',light:'#a7c3ca',opacity:.30,position:'center'},
 {base:'#dce9f4',light:'#a2c2e2',opacity:.56,position:'center 44%'},
 {base:'#e5e6f0',light:'#b5b9da',opacity:.36,position:'center 50%'},
 {base:'#eee6df',light:'#d4b99e',opacity:.36,position:'center 55%'},
 {base:'#e2ece6',light:'#b2cec3',opacity:.32,position:'center'},
 {base:'#d5e7ee',light:'#7faec8',opacity:.63,position:'center 64%'},
 {base:'#e8eef0',light:'#bed8e0',opacity:.39,position:'center 30%'},
 {base:'#eee9e2',light:'#d5c3ae',opacity:.32,position:'center 40%'},
] as const;
type Layer={index:number;id:number};

/** Only two painted backgrounds at a time. Finish a fade before following the
 * latest rapid skip; hovering or browsing unplayed records never reaches here. */
export default function MusicBackdrop({index,reduced,artReady}:{index:number;reduced:boolean;artReady:boolean}){
 const state=useRef({settled:{index,id:0},requested:index,sequence:0,timer:undefined as ReturnType<typeof setTimeout>|undefined});
 const [layers,setLayers]=useState<Layer[]>([state.current.settled]);
 useEffect(()=>{
  const value=state.current;value.requested=index;
  function follow(){
   if(value.timer!==undefined||value.requested===value.settled.index)return;
   const incoming={index:value.requested,id:++value.sequence};
   setLayers([value.settled,incoming]);
   value.timer=setTimeout(()=>{value.timer=undefined;value.settled=incoming;setLayers([incoming]);follow();},FADE_MS);
  }
  if(reduced){clearTimeout(value.timer);value.timer=undefined;value.settled={index,id:++value.sequence};setLayers([value.settled]);}
  else follow();
 },[index,reduced]);
 useEffect(()=>()=>{clearTimeout(state.current.timer);state.current.timer=undefined;},[]);
 return <div className="ma-background" aria-hidden="true" data-track-index={index} style={{'--background-fade':`${FADE_MS}ms`} as CSSProperties}>
  {layers.map((layer,order)=>{const scene=SCENES[layer.index%SCENES.length];return <div key={layer.id} className="ma-background-layer" data-incoming={order>0} data-scene-index={layer.index} style={{'--scene-base':scene.base,'--scene-light':scene.light,'--scene-art-opacity':scene.opacity,'--scene-art-position':scene.position} as CSSProperties}>
   {artReady&&<div className="ma-background-art" style={{backgroundImage:`url("${editionSceneArtwork(layer.index)}")`}}/>}
   <div className="ma-background-wash"/>
  </div>;})}
 </div>;
}
