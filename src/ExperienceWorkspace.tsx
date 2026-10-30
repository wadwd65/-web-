import {lazy,Suspense,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,ChevronLeft,ChevronRight,CircleHelp,ListChecks,Maximize,Play,RotateCcw,Sparkles,X} from 'lucide-react';
import {EXPERIENCE_MODULES} from './experience-modules.ts';
import type {ExperiencePage,WorkspacePage} from './experience-modules.ts';
import {resultAvailable} from './terminal-state.ts';
import type {TerminalSignals,ToolId} from './terminal-state.ts';
import {MODULE_GUIDES} from './module-guides.ts';
import PointerFeedback from './PointerFeedback.tsx';
import ExperienceEntry from './ExperienceEntry.tsx';
import RhineMark from './RhineMark.tsx';
import {MusicEntry,useSoundtrack} from './Soundtrack.tsx';
import MusicPlayer from './MusicPlayer.tsx';
import type {SceneAction} from './scene-actions.ts';
import type {MusicModePhase} from './music-mode.ts';
const Scene=lazy(()=>import('./TaskArrayScene.tsx'));
const find=(page:ExperiencePage)=>EXPERIENCE_MODULES.findIndex(item=>item.id===page);
function firstEntry(){try{return sessionStorage.getItem('first-step-entry-v017')!=='seen';}catch{return true;}}
function statusFor(index:number,signals:TerminalSignals){
  const task=EXPERIENCE_MODULES[index];if(!task)return '';
  if(task.id==='contract'){const value=signals.contract;return value.reviewed?`已核对 ${value.items} 项 · ${value.unresolved??0} 项待确认`:value.characters?`${value.characters.toLocaleString()} 字原文已载入`:'尚未载入合同原文';}
  if(task.id==='salary')return signals.salary.net===null?'等待工资条上的已知金额':`计算实发 ¥ ${signals.salary.net.toLocaleString('zh-CN',{minimumFractionDigits:2})}`;
  if(task.id==='subsidy'){if(!signals.subsidy.checked)return '广州政策样例 · 等待实际条件';return signals.subsidy.status==='unsupported'?'当前地区尚未维护':`已完成条件对照 · ${signals.subsidy.states.filter(item=>item==='unknown').length} 项待确认`;}
  return signals.tools[task.id as ToolId].summary;
}
export default function ExperienceWorkspace({page,go,questionCount,signals,openSources,demo,covered=false,musicOpen,openMusic,closeMusic,children}:{page:WorkspacePage;musicOpen:boolean;openMusic:()=>void;closeMusic:()=>void;go:(page:ExperiencePage)=>void;questionCount:number;signals:TerminalSignals;openSources:()=>void;demo:()=>void;covered?:boolean;children:ReactNode}){
  const [selected,setSelected]=useState(()=>(find(page)<0?1:find(page))),[working,setWorking]=useState(page!=='home'),[directory,setDirectory]=useState(false);
  const [phase,setPhase]=useState('事务阵列');
  const [workView,setWorkView]=useState<'material'|'result'>('material');
  const [feedback,setFeedback]=useState('');
  const [musicDetail,setMusicDetail]=useState(false);
  const [musicPhase,setMusicPhase]=useState<MusicModePhase>('closed');
  const musicPresent=musicOpen||musicPhase!=='closed';
  const [intro,setIntro]=useState(()=>!musicOpen&&firstEntry()),[introKey,setIntroKey]=useState(0),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[simple,setSimple]=useState(false),[particles,setParticles]=useState(false),[reset,setReset]=useState(0),[cinema,setCinema]=useState(false);
  const root=useRef<HTMLDivElement>(null),overview=useRef<HTMLElement>(null),workspace=useRef<HTMLElement>(null),indexDialog=useRef<HTMLDialogElement>(null),directoryTrigger=useRef<HTMLButtonElement>(null),closeIndex=useRef<HTMLButtonElement>(null),previousPage=useRef(page);
  const soundtrack=useSoundtrack({working:working&&!musicOpen,entering:intro});
  const intent=useRef<{page:ExperiencePage;view:'material'|'result'}|null>(null);
  const [focusRequest,setFocusRequest]=useState<{page:ExperiencePage;view:'material'|'result';detail?:string;serial:number}|null>(null);
  const task=EXPERIENCE_MODULES[selected],list=page==='list';
  const hasResult=!!task&&resultAvailable(task.id,signals);
  useEffect(()=>{if(intent.current){if(intent.current.page===page){setWorkView(intent.current.view);intent.current=null;}}else setWorkView(hasResult?'result':'material');},[hasResult,page]);
  useEffect(()=>{
    if(!focusRequest||!working||page!==focusRequest.page||workView!==focusRequest.view)return;
    const timer=setTimeout(()=>{
      if(document.querySelector('dialog[open]'))return;const module=root.current?.querySelector<HTMLElement>(`.module-${page}`);if(!module||root.current?.dataset.module!==page)return;
      let target:HTMLElement|null=null;
      if(focusRequest.view==='material'){
        if(page==='contract')target=module.querySelector('#contract-text');
        else if(page==='salary')target=module.querySelector(`input[aria-label="${focusRequest.detail==='deductions'?'个人社保扣款':'应发工资'}"]`);
        else if(page==='subsidy')target=module.querySelectorAll<HTMLSelectElement>('select')[Number(focusRequest.detail?.split('-')[1]??0)]??null;
        else target=module.querySelector('form input:not([type=checkbox]),form textarea,form select');
      }else target=module.querySelector(page==='salary'?(focusRequest.detail==='deductions'?'.deduction-deck':'.pay-display'):page==='contract'?'.review-content':page==='subsidy'?'.policy-evaluation':'.tool-result');
      if(target){if(!target.matches('input,textarea,select,button,a'))target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    },560);return()=>clearTimeout(timer);
  },[focusRequest,page,workView,working]);
  useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(''),2200);return()=>clearTimeout(timer);},[feedback]);
  useEffect(()=>{workspace.current?.scrollTo({top:0,behavior:'instant'});},[workView]);
  const choose=useCallback((index:number)=>{intent.current=null;setFocusRequest(null);setSelected(index);setCinema(false);setDirectory(false);if(working){setWorkView('material');go(EXPERIENCE_MODULES[index].id);}else go('home');},[go,working]);
  function openWork(){if(!task)return;intent.current=null;setFocusRequest(null);setParticles(false);setWorkView(hasResult?'result':'material');setCinema(false);setWorking(true);go(task.id);}
  function openFromScene(index:number){intent.current=null;setFocusRequest(null);setParticles(false);setSelected(index);setCinema(false);setWorking(true);setDirectory(false);go(EXPERIENCE_MODULES[index].id);}
  function closeWork(){intent.current=null;setFocusRequest(null);setWorking(false);go('home');requestAnimationFrame(()=>overview.current?.focus({preventScroll:true}));}
  function openList(){intent.current=null;setFocusRequest(null);setWorking(true);setCinema(false);go('list');}
  function completeIntro(){try{sessionStorage.setItem('first-step-entry-v017','seen');}catch{}setIntro(false);}
  function sceneAction(index:number,action:SceneAction,detail?:string){
    if(action==='sources'){intent.current=null;setFocusRequest(null);openSources();return;}
    if(action==='list'){openList();return;}
    const module=EXPERIENCE_MODULES[index];
    if(action==='open'||!module.ready){openFromScene(index);return;}
    const available=resultAvailable(module.id,signals);
    const nextView=action==='result'&&available?'result':'material';intent.current=page===module.id?null:{page:module.id,view:nextView};setSelected(index);setParticles(false);setCinema(false);setWorking(true);setWorkView(nextView);go(module.id);
    setFocusRequest({page:module.id,view:nextView,detail,serial:Date.now()});if(action==='result'&&!available)setFeedback('先准备材料并完成核对，再查看结果。');
  }
  useEffect(()=>{void import('./TaskArrayScene.tsx').catch(()=>{});},[]);
  useLayoutEffect(()=>{if(page!==previousPage.current){if(page==='home')setWorking(false);else{setWorking(true);if(page!=='list')setSelected(find(page));}previousPage.current=page;}workspace.current?.scrollTo({top:0,behavior:'instant'});},[page]);
  useEffect(()=>{if(intro)return;const timer=window.setTimeout(()=>{if(document.querySelector('dialog[open]'))return;if(cinema){root.current?.querySelector<HTMLButtonElement>('.experience-cinema-return')?.focus({preventScroll:true});return;}const target=(working?workspace:overview).current;if(target&&!target.contains(document.activeElement))target.focus({preventScroll:true});},working?180:0);return()=>clearTimeout(timer);},[intro,working,page,cinema]);
  useEffect(()=>{const dialog=indexDialog.current;if(directory&&!dialog?.open){dialog?.showModal();closeIndex.current?.focus();}else if(!directory&&dialog?.open){dialog.close();directoryTrigger.current?.focus();}},[directory]);
  useEffect(()=>{
    function key(event:KeyboardEvent){if(intro||directory||musicOpen||document.querySelector('dialog[open]')||(event.target as HTMLElement)?.closest('input,textarea,select'))return;if(cinema){if(event.key==='Escape'){event.preventDefault();setCinema(false);}return;}if(event.key==='Escape'){if(working){event.preventDefault();closeWork();}return;}if(working)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setSelected(value=>value<0?(event.key==='ArrowRight'?0:7):(value+(event.key==='ArrowRight'?1:7))%8);}if(event.key==='Enter'&&!(event.target as HTMLElement)?.closest('button,a')&&task){event.preventDefault();openWork();}}
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[intro,directory,musicOpen,working,cinema,task]);
  useEffect(()=>{
    const target=root.current;if(!target)return;const events=new AbortController();let hot:HTMLElement|null=null,rect:DOMRect|null=null,frame=0,x=0,y=0;
    function clear(){if(hot)delete hot.dataset.hovered;hot=null;rect=null;cancelAnimationFrame(frame);frame=0;}
    function paint(){frame=0;if(!hot)return;rect??=hot.getBoundingClientRect();hot.style.setProperty('--mx',`${Math.round(x-rect.left)}px`);hot.style.setProperty('--my',`${Math.round(y-rect.top)}px`);}
    target.addEventListener('pointermove',event=>{const next=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(next!==hot){clear();hot=next;if(hot)hot.dataset.hovered='true';}x=event.clientX;y=event.clientY;if(hot&&!frame)frame=requestAnimationFrame(paint);},{passive:true,signal:events.signal});target.addEventListener('pointerleave',clear,{signal:events.signal});window.addEventListener('resize',()=>{rect=null;},{signal:events.signal});target.addEventListener('scroll',()=>{rect=null;},{capture:true,passive:true,signal:events.signal});return()=>{events.abort();clear();};
  },[]);
  return <>
    <div ref={root} className={`experience-shell ${musicPresent?'has-player':''} ${working?'is-working':''} ${cinema?'is-cinema':''} ${intro?'is-intro':''} ${directory||musicPresent||covered?'is-covered':''} ${simple?'is-reduced':''}`} data-music-phase={musicPhase} data-view={workView} data-stage={working?(list?'list':task?.ready?workView:'planned'):'overview'} data-module={task?.id??'welcome'} inert={intro||musicPresent} aria-hidden={intro||musicPresent||undefined}>
      <a className="skip-link" href="#experience-content" onClick={event=>{event.preventDefault();(working?workspace:overview).current?.focus();}}>跳到主要内容</a>
      <div className={`experience-world ${failed||simple?'is-still':ready?'is-dynamic':''}`} aria-label="随事务与工作状态变化的三维资料空间">
        {!failed&&<Suspense fallback={null}><Scene key="task-space-v018-tool-details" entering={intro} onAction={sceneAction} selected={selected} signals={signals} view={workView} onSelect={choose} onOpen={openFromScene} working={working} particles={particles} reset={reset} paused={simple} suspended={directory||musicPresent||covered} cinema={cinema} onPhase={setPhase} onReady={()=>setReady(true)} onFailure={()=>{setFailed(true);setReady(true);}}/></Suspense>}
      </div>
      <div className="experience-shade" aria-hidden="true"/><div className="experience-registration" aria-hidden="true"><i/><i/><i/><i/></div>
      <header className="experience-header" inert={cinema}>
        <a className="experience-brand" href="#/home" onClick={()=>{setSelected(1);setWorking(false);setCinema(false);}} aria-label="初程首页"><RhineMark/><span>初程<small>FIRST STEP</small></span></a>
        <div className="experience-team"><span>莱茵生命</span><small>THE NEXT CHAPTER</small></div>
        <div className="experience-header-actions"><MusicEntry state={soundtrack} contextKey={`${page}:${musicPresent}`} onOpen={detail=>{setMusicDetail(detail);setCinema(false);setDirectory(false);openMusic();}}/><button ref={directoryTrigger} onClick={()=>setDirectory(true)}><span className="experience-menu-mark" aria-hidden="true"><i/><i/></span><span>事务目录</span><small>08</small></button><button onClick={openList}><ListChecks size={16}/><span>询问清单</span><small>{String(questionCount).padStart(2,'0')}</small></button><button onClick={openSources} aria-label="资料与当前能力" title="资料与当前能力"><CircleHelp size={18}/></button></div>
      </header>
      <main ref={overview} className="experience-overview" id={!working?'experience-content':'scene-content'} tabIndex={-1} inert={working||cinema} aria-hidden={working||cinema}>
        <div className="experience-section-label"><i/><span>FIRST STEP / LIFE IN PROGRESS</span><small>08 个事务 · 本地规则与办理工具</small></div>
        <article className="experience-story" key={task?.id??'welcome'}>
          <div className="experience-kicker"><span>{task?`${task.code} / ${task.english}`:'00 — THE BEGINNING'}</span><i/><small>{task?.phase??'毕业之后，生活展开'}</small></div>
          <h1>{task?.label??'事务总览'}<small>{task?.english}</small></h1>
          <p>{task?.description??'第一份工作，第一份约定，第一次独自出发。把未知留给远方，把眼前的事弄清楚。'}</p>
          <button className="experience-enter" onClick={task?openWork:()=>setDirectory(true)}><span>{task?(task.ready?`进入${task.label}`:`查看${task.label}规划`):'选择你的下一步'}</span><ArrowUpRight size={25}/><i/></button>
          <div className="experience-task-details"><span><small>准备材料</small>{task?.input??'选择一件事务开始'}</span><span><small>带走什么</small>{task?.outputs.join(' / ')}</span></div>
          <div className="experience-story-foot" aria-live="polite">{task?<><span className={task.ready?'module-ready':'module-planned'}><i/>{task.ready?'可体验':'待开发'}</span><span>{task.ready?statusFor(selected,signals):'入口已预留 · 暂不生成结果'}</span></>:<><span>08 个模块</span><b>／</b><span>08 项本地体验</span></>}</div>
          {task?.id==='contract'&&<button className="experience-example" onClick={()=>{setWorking(true);demo();}}>用合成示例走一遍<ArrowRight size={14}/></button>}
        </article>
        <aside className="experience-spatial-note" aria-hidden="true"><span>{task?.code}</span><div><small>{phase}</small><span>08 / CONNECTED TASKS</span></div><i/></aside>
      </main>
      <aside className="experience-work-context" aria-hidden={!working} inert={!working}>
        <div className="context-id"><span>{list?'—':task?.code}</span><small>{list?'SHARED RECORDS':task?.english}</small></div>
        <h2>{list?'询问清单':task?.label}</h2>
        <p>{list?'把需要确认的问题整理在一起。':task?.description}</p>
        <div className="context-state"><i/><span>{list?`${questionCount} 项已保存问题`:statusFor(selected,signals)}</span></div>
        <ol>{(list?['整理问题','记录答复','导出清单']:task?.outputs??[]).map((value,i)=><li key={value}><span>{String(i+1).padStart(2,'0')}</span>{value}</li>)}</ol>
        <button onClick={closeWork}><ArrowLeft size={14}/>返回事务空间</button>
      </aside>
      <section className="experience-workspace" ref={workspace} id={working?'experience-content':'work-content'} tabIndex={-1} data-open={working} inert={!working} aria-hidden={!working} onClickCapture={event=>{const clicked=(event.target as HTMLElement).closest('button');if(clicked?.dataset.materialView===page){intent.current=null;setFocusRequest(null);setWorkView('material');}const label=clicked?.textContent??'';if(label.includes('查看原文')){setWorkView('material');setTimeout(()=>{if(root.current?.dataset.stage!=='material'||root.current?.dataset.module!=='contract')return;const field=document.getElementById('contract-text');field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},480);}if(label.includes('导出'))setFeedback('导出已发起 · TXT 记录');if(label.includes('加入询问清单')||label.includes('整理')&&label.includes('待确认'))setFeedback('询问清单已更新');}}>
        <header className="experience-workbar"><button onClick={closeWork}><ArrowLeft size={16}/>收起工作区</button><span>{list?'MY CHECKLIST':`${task?.code} / ${task?.english}`}</span><div><small>收起后保留本次填写</small><button onClick={openSources}>资料与依据<ArrowUpRight size={13}/></button><button onClick={closeWork} aria-label="收起工作区"><X size={19}/></button></div></header>
        {task?.ready&&!list&&<div className="motion-work-nav" aria-label="工作视图"><button aria-pressed={workView==='material'} onClick={()=>{intent.current=null;setFocusRequest(null);setWorkView('material');}}><span>01</span>{MODULE_GUIDES[task.id].input}<small>{task.id==='contract'?(signals.contract.characters?`${signals.contract.characters} 字`:'等待材料'):'填写与确认'}</small></button><i/><button aria-pressed={workView==='result'} disabled={!hasResult} onClick={()=>{intent.current=null;setFocusRequest(null);setWorkView('result');}}><span>02</span>{MODULE_GUIDES[task.id].result}<small>{hasResult?(task.id==='contract'?`${signals.contract.items} 项 / ${signals.contract.unresolved} 待确认`:'结果已就绪'):'待生成'}</small></button><i/><button onClick={openList}><span>03</span>询问清单<small>{questionCount} 项</small></button><div aria-live="polite">{feedback||'填写与结果在本次操作中保留'}</div></div>}
        {task&&!task.ready&&!list&&<div className="experience-planned"><span className="eyebrow">MODULE {task.code} / PLANNED</span><h1>{task.label}</h1><p>界面入口已预留，功能尚未开发。</p><div><section><small>计划输入</small><h2>{task.input}</h2></section><section><small>计划输出</small>{task.outputs.map(output=><h2 key={output}>{output}</h2>)}</section></div><p>这个模块将使用可核验的资料与规则。当前不会生成核对结果。</p><button className="button" onClick={()=>{setSelected(1);go('contract');}}>先体验合同核对<ArrowUpRight size={18}/></button></div>}
        {task&&!list&&<details className="module-method"><summary><span>这件事怎么做</span>{MODULE_GUIDES[task.id].steps.map((step,i)=><small key={step}>{String(i+1).padStart(2,'0')} {step}</small>)}<ChevronRight size={13}/></summary><p>{MODULE_GUIDES[task.id].logic}</p></details>}
        <div className="experience-business-content" hidden={Boolean(task&&!task.ready&&!list)}>{children}</div>
      </section>
      <div className="experience-scene-tools" hidden={working} inert={cinema}><div><button onClick={()=>setParticles(value=>!value)} aria-pressed={particles} disabled={simple||failed}><Sparkles size={14}/>{particles?'重组资料':'查看几何点云'}</button><button onClick={()=>setReset(value=>value+1)} aria-label="复位场景视角" title="复位场景视角"><RotateCcw size={14}/></button><button onClick={()=>setSimple(value=>!value)} aria-pressed={simple}>{simple?'开启动效':'减少动态'}</button><button onClick={()=>setCinema(value=>!value)} aria-pressed={cinema}><Maximize size={14}/>{cinema?'显示界面':'纯净观景'}</button></div><p>{failed?'三维场景暂不可用 · 事务功能仍可打开':simple?'已减少动态 · 事务入口照常可用':'拖动改变视角 · 点击下方事务直接进入'}</p></div>
      <footer className="experience-footer" inert={cinema}><div className="experience-archive-label"><span>选择下一步</span><small>EXPLORE / 08</small><div><button aria-label="上一个模块" onClick={()=>choose((Math.max(0,selected)+7)%8)}><ChevronLeft size={17}/></button><strong>{task?.code??'00'}</strong><span>/ 08</span><button aria-label="下一个模块" onClick={()=>choose((Math.max(-1,selected)+1)%8)}><ChevronRight size={17}/></button></div></div><nav aria-label="八个事务模块">{EXPERIENCE_MODULES.map((item,index)=><button key={item.id} onClick={()=>openFromScene(index)} aria-pressed={selected===index&&!list}><span><small>{item.code}</small><i className={item.ready?'is-ready':''}/></span><strong>{item.label}<ArrowUpRight size={12}/></strong><b/></button>)}</nav></footer>
      <div className="experience-systemline" inert={cinema}><span><i/>FIRST STEP / 0.26<span>LOCAL INTERACTIVE PROTOTYPE</span></span><div><button onClick={()=>{setIntroKey(value=>value+1);setIntro(true);}}><Play size={10}/>重播入场</button><button onClick={openSources}>能力范围 ↗</button></div></div>
      {cinema&&<button className="experience-cinema-return" onClick={()=>setCinema(false)}>返回界面<ArrowLeft size={15}/><small>ESC</small></button>}
    </div>
    <MusicPlayer state={soundtrack} open={musicOpen} onClose={closeMusic} returnPage={page} returnLabel={page==='home'?'事务空间':page==='list'?'询问清单':task.label} reduced={simple} entryDetail={musicDetail} onModeChange={setMusicPhase}/>
    <PointerFeedback enabled={!intro&&!simple}/><audio ref={soundtrack.audio} crossOrigin="anonymous" loop={soundtrack.loop==='single'} preload="none" data-soundtrack={soundtrack.track.cid} aria-hidden="true"/>
    <dialog className="experience-index" ref={indexDialog} onCancel={()=>setDirectory(false)} aria-labelledby="experience-index-title"><header><div><span>FIRST STEP / EIGHT CHAPTERS</span><h1 id="experience-index-title">生活展开，<em>从一件事开始。</em></h1></div><button ref={closeIndex} onClick={()=>setDirectory(false)} aria-label="关闭事务目录"><X size={22}/></button></header><div className="experience-index-list">{EXPERIENCE_MODULES.map((item,index)=><button key={item.id} onClick={()=>choose(index)}><span className="index-number">{item.code}</span><div><strong>{item.label}</strong><small>{item.english} / {item.phase}</small></div><span className={item.ready?'module-ready':'module-planned'}><i/>{item.ready?'可体验':'待开发'}</span><ArrowUpRight size={20}/></button>)}</div><footer><span>八项本地工具各有适用范围。询问清单由各模块共用。</span><button onClick={()=>{setDirectory(false);openList();}}>打开询问清单<ArrowRight size={16}/></button></footer></dialog>
    {intro&&<ExperienceEntry key={introKey} staticMode={simple} ready={ready||simple||failed} onComplete={completeIntro} onMusicToggle={soundtrack.toggle} musicPlaying={soundtrack.playing}/>}
  </>;
}
