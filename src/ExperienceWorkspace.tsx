import AISettings from './AISettings.tsx';
import {lazy,Suspense,useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {version} from '../package.json';
import PerformanceDiagnostics from './PerformanceDiagnostics.tsx';
import type {ReactNode} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,ChevronRight,CircleHelp,Maximize,Play,RotateCcw,SlidersHorizontal,Sparkles,X} from 'lucide-react';
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
import HomeTaskDirectory,{HomeBackdrop} from './HomeTaskDirectory.tsx';
import ToolDirectory from './ToolDirectory.tsx';
import AIAssistant from './AIAssistant.tsx';
import type {AssistantSeed} from './AIAssistant.tsx';
import type {AssistantAction} from './services/assistant-types.ts';
import {AccountEntry} from './Account.tsx';
import type {SavedQuestion} from './Account.tsx';
import ModeSwitch from './ModeSwitch.tsx';
import SceneBoundary from './SceneBoundary.tsx';
import {useExperienceMode} from './useExperienceMode.ts';
const Scene=lazy(()=>import('./TaskArrayScene.tsx'));
const find=(page:ExperiencePage)=>EXPERIENCE_MODULES.findIndex(item=>item.id===page);
function statusFor(index:number,signals:TerminalSignals){
  const task=EXPERIENCE_MODULES[index];if(!task)return '';
  if(task.id==='contract'){const value=signals.contract;return value.reviewed?`已核对 ${value.items} 项 · ${value.unresolved??0} 项待确认`:value.characters?`${value.characters.toLocaleString()} 字原文已载入`:'尚未载入合同原文';}
  if(task.id==='salary')return signals.salary.net===null?'填好金额后，点「算到手工资」':`计算实发 ¥ ${signals.salary.net.toLocaleString('zh-CN',{minimumFractionDigits:2})}`;
  if(task.id==='subsidy'){if(signals.subsidy.summary)return signals.subsidy.summary;if(!signals.subsidy.checked)return '选择城市，查官方政策与求职住宿';return signals.subsidy.status==='unsupported'?'当前地区尚未维护':`已完成条件对照 · ${signals.subsidy.states.filter(item=>item==='unknown').length} 项待确认`;}
  return signals.tools[task.id as ToolId].summary;
}
export default function ExperienceWorkspace({page,go,questionCount,signals,openSources,covered=false,musicOpen,openMusic,closeMusic,onAssistantAction,children,accountQuestions,restoreAccountQuestions,accountEpoch,policyAsk}:{policyAsk?:{id:number;text:string}|null;accountEpoch:number;accountQuestions:SavedQuestion[];restoreAccountQuestions:(items:SavedQuestion[])=>void;page:WorkspacePage;musicOpen:boolean;openMusic:()=>void;closeMusic:()=>void;go:(page:ExperiencePage)=>void;questionCount:number;signals:TerminalSignals;openSources:()=>void;demo:()=>void;onAssistantAction:(action:AssistantAction)=>void;covered?:boolean;children:ReactNode}){
  const modeState=useExperienceMode(),lightweight=modeState.mode==='simple';
  const [selected,setSelected]=useState(()=>(find(page)<0?1:find(page))),[working,setWorking]=useState(page!=='home');
  const [accountOpen,setAccountOpen]=useState(false),[apiOpen,setApiOpen]=useState(false);
  useEffect(()=>{setAssistantOpen(false);setAssistantSeed(null);setHomeQuestion('');},[accountEpoch]);
  const [assistantOpen,setAssistantOpen]=useState(false),[assistantSeed,setAssistantSeed]=useState<AssistantSeed|null>(null),[homeQuestion,setHomeQuestion]=useState('');
  function ask(text=''){setCinema(false);setAssistantSeed(text?{id:Date.now(),text,send:true}:null);setAssistantOpen(true);if(text)setHomeQuestion('');}
  useEffect(()=>{if(policyAsk)ask(policyAsk.text);},[policyAsk]);
  function openTools(){setCinema(false);go('tools');}
  const [phase,setPhase]=useState('事务阵列');
  const [workView,setWorkView]=useState<'material'|'result'>('material');
  const [feedback,setFeedback]=useState('');
  const [musicDetail,setMusicDetail]=useState(false);
  const [musicPhase,setMusicPhase]=useState<MusicModePhase>('closed');
  const musicPresent=musicOpen||musicPhase!=='closed';
  const [intro,setIntro]=useState(()=>!lightweight&&!musicOpen&&page==='home'),[introKey,setIntroKey]=useState(0),[introReveal,setIntroReveal]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false),[simple,setSimple]=useState(false),[particles,setParticles]=useState(false),[reset,setReset]=useState(0),[cinema,setCinema]=useState(false);
  function changeMode(next:'simple'|'full'){setCinema(false);setFailed(false);if(next==='full'&&lightweight)setReady(false);if(next==='simple')setIntro(false);modeState.change(next);}
  useEffect(()=>{modeState.setActive(lightweight||intro||assistantOpen||covered||accountOpen||apiOpen||page==='tools'?null:musicPresent?'music':'task');return()=>modeState.setActive(null);},[lightweight,intro,assistantOpen,covered,accountOpen,apiOpen,musicPresent,page,modeState.setActive]);
  useEffect(()=>{if(lightweight)setCinema(false);},[lightweight]);
  const root=useRef<HTMLDivElement>(null),overview=useRef<HTMLElement>(null),workspace=useRef<HTMLElement>(null),previousPage=useRef(page);
  const soundtrack=useSoundtrack({working:working&&!musicOpen,entering:intro});
  const intent=useRef<{page:ExperiencePage;view:'material'|'result'}|null>(null);
  const [focusRequest,setFocusRequest]=useState<{page:ExperiencePage;view:'material'|'result';detail?:string;serial:number}|null>(null);
  const routeIndex=find(page),task=EXPERIENCE_MODULES[routeIndex>=0?routeIndex:selected],list=page==='list',tools=page==='tools',utility=list||tools;
  const hasResult=!!task&&resultAvailable(task.id,signals);
  useLayoutEffect(()=>{if(intent.current){if(intent.current.page===page){setWorkView(intent.current.view);intent.current=null;}}else setWorkView(hasResult?'result':'material');},[hasResult,page]);
  useEffect(()=>{
    if(!focusRequest||!working||page!==focusRequest.page||workView!==focusRequest.view)return;
    const timer=setTimeout(()=>{
      if(document.querySelector('dialog[open]'))return;const module=root.current?.querySelector<HTMLElement>(`.module-${page}`);if(!module||root.current?.dataset.module!==page)return;
      let target:HTMLElement|null=null;
      if(focusRequest.view==='material'){
        if(page==='contract')target=module.querySelector('#contract-text');
        else if(page==='salary')target=module.querySelector(`input[aria-label="${focusRequest.detail==='deductions'?'个人社保扣款':'应发工资'}"]`);
        else if(page==='subsidy')target=[...module.querySelectorAll<HTMLElement>('.policy-city-choices button,select')].find(item=>item.getClientRects().length>0)??null;
        else target=module.querySelector('form input:not([type=checkbox]),form textarea,form select');
      }else target=module.querySelector(page==='salary'?(focusRequest.detail==='deductions'?'.deduction-deck':'.pay-display'):page==='contract'?'.review-content':page==='subsidy'?'.city-policy-sources,.policy-evaluation':'.tool-result');
      if(target){if(!target.matches('input,textarea,select,button,a'))target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    },560);return()=>clearTimeout(timer);
  },[focusRequest,page,workView,working]);
  useEffect(()=>{if(!feedback)return;const timer=setTimeout(()=>setFeedback(''),2200);return()=>clearTimeout(timer);},[feedback]);
  useEffect(()=>{workspace.current?.scrollTo({top:0,behavior:'instant'});},[workView]);
  const choose=useCallback((index:number)=>{intent.current=null;setFocusRequest(null);setSelected(index);setCinema(false);if(working){setWorkView('material');go(EXPERIENCE_MODULES[index].id);}else go('home');},[go,working]);
  function openFromScene(index:number){intent.current=null;setFocusRequest(null);setParticles(false);setSelected(index);setCinema(false);setWorking(true);go(EXPERIENCE_MODULES[index].id);}
  function closeWork(){intent.current=null;setFocusRequest(null);setWorking(false);go('home');requestAnimationFrame(()=>overview.current?.focus({preventScroll:true}));}
  function openList(){intent.current=null;setFocusRequest(null);setWorking(true);setCinema(false);go('list');}
  function completeIntro(){setIntro(false);setIntroReveal(false);}
  function sceneAction(index:number,action:SceneAction,detail?:string){
    if(action==='sources'){intent.current=null;setFocusRequest(null);openSources();return;}
    if(action==='list'){openList();return;}
    const module=EXPERIENCE_MODULES[index];
    if(action==='open'||!module.ready){openFromScene(index);return;}
    const available=resultAvailable(module.id,signals);
    const nextView=action==='result'&&available?'result':'material';intent.current=page===module.id?null:{page:module.id,view:nextView};setSelected(index);setParticles(false);setCinema(false);setWorking(true);setWorkView(nextView);go(module.id);
    setFocusRequest({page:module.id,view:nextView,detail,serial:Date.now()});if(action==='result'&&!available)setFeedback('先准备材料并完成核对，再查看结果。');
  }
  useEffect(()=>{if(working||cinema||assistantOpen||musicPresent)root.current?.querySelector('details.home-scene-settings')?.removeAttribute('open');},[working,cinema,assistantOpen,musicPresent]);
  useLayoutEffect(()=>{if(page!==previousPage.current){if(page==='home')setWorking(false);else{setWorking(true);const index=find(page);if(index>=0)setSelected(index);}previousPage.current=page;}workspace.current?.scrollTo({top:0,behavior:'instant'});},[page]);
  useEffect(()=>{if(intro)return;const timer=window.setTimeout(()=>{if(document.querySelector('dialog[open]'))return;if(cinema){root.current?.querySelector<HTMLButtonElement>('.experience-cinema-return')?.focus({preventScroll:true});return;}const target=(working?workspace:overview).current;if(target&&!target.contains(document.activeElement))target.focus({preventScroll:true});},working?180:0);return()=>clearTimeout(timer);},[intro,working,page,cinema]);
  useEffect(()=>{
    function key(event:KeyboardEvent){if(intro||assistantOpen||accountOpen||musicOpen||document.querySelector('dialog[open]')||(event.target as HTMLElement)?.closest('input,textarea,select'))return;if(cinema){if(event.key==='Escape'){event.preventDefault();setCinema(false);}return;}if(event.key==='Escape'){if(working){event.preventDefault();closeWork();}return;}if(working||lightweight)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();setSelected(value=>value<0?(event.key==='ArrowRight'?0:7):(value+(event.key==='ArrowRight'?1:7))%8);}}
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[intro,assistantOpen,accountOpen,musicOpen,working,cinema,task,lightweight]);
  useEffect(()=>{
    const target=root.current;if(!target)return;const events=new AbortController();let hot:HTMLElement|null=null,rect:DOMRect|null=null,frame=0,x=0,y=0;
    function clear(){if(hot)delete hot.dataset.hovered;hot=null;rect=null;cancelAnimationFrame(frame);frame=0;}
    function paint(){frame=0;if(!hot)return;rect??=hot.getBoundingClientRect();hot.style.setProperty('--mx',`${Math.round(x-rect.left)}px`);hot.style.setProperty('--my',`${Math.round(y-rect.top)}px`);}
    target.addEventListener('pointermove',event=>{const next=(event.target as HTMLElement).closest<HTMLElement>('button,a');if(next!==hot){clear();hot=next;if(hot)hot.dataset.hovered='true';}x=event.clientX;y=event.clientY;if(hot&&!frame)frame=requestAnimationFrame(paint);},{passive:true,signal:events.signal});target.addEventListener('pointerleave',clear,{signal:events.signal});window.addEventListener('resize',()=>{rect=null;},{signal:events.signal});target.addEventListener('scroll',()=>{rect=null;},{capture:true,passive:true,signal:events.signal});return()=>{events.abort();clear();};
  },[]);
  return <>
    <div ref={root} className={`experience-shell ${lightweight?'is-simple':''} ${musicPresent?'has-player':''} ${working?'is-working':''} ${cinema?'is-cinema':''} ${intro?'is-intro':''} ${introReveal?'is-intro-revealing':''} ${assistantOpen||musicPresent||covered||accountOpen||apiOpen?'is-covered':''} ${simple||lightweight?'is-reduced':''}`} data-experience-mode={modeState.mode} data-music-phase={musicPhase} data-view={workView} data-stage={working?(utility?page:task?.ready?workView:'planned'):'overview'} data-module={utility?page:task?.id??'welcome'} inert={intro||musicPresent} aria-hidden={intro||musicPresent||undefined}>
      <a className="skip-link" href="#experience-content" onClick={event=>{event.preventDefault();(working?workspace:overview).current?.focus();}}>跳到主要内容</a>
      <div className={`experience-world ${failed||simple?'is-still':ready?'is-dynamic':''}`} aria-label="可以选择办事工具的三维界面">
        <HomeBackdrop/>
        {!failed&&!lightweight&&<SceneBoundary onFailure={modeState.unavailable}><Suspense fallback={<div className="mode-scene-loading" role="status">正在准备三维界面…<button onClick={()=>changeMode('simple')}>先用简易模式</button></div>}><Scene key="task-space-v018-tool-details" entering={intro&&!introReveal} onAction={sceneAction} selected={selected} signals={signals} view={workView} onSelect={choose} onOpen={openFromScene} working={working} particles={particles} reset={reset} paused={simple} suspended={assistantOpen||musicPresent||covered||accountOpen||apiOpen||tools} cinema={cinema} onPhase={setPhase} onFrame={(now,eligible)=>modeState.frame('task',now,eligible)} onReady={()=>setReady(true)} onFailure={()=>{setFailed(true);setReady(true);modeState.unavailable();}}/></Suspense></SceneBoundary>}
      </div>
      <div className="experience-shade" aria-hidden="true"/><div className="experience-registration" aria-hidden="true"><i/><i/><i/><i/></div>
      <header className="experience-header" inert={cinema}>
        <a className="experience-brand" href="#/home" onClick={()=>{setSelected(1);setWorking(false);setCinema(false);}} aria-label="初程首页"><RhineMark/><span>初程<small>FIRST STEP</small></span></a>
        <div className="experience-team"><span>莱茵生命</span><small>THE NEXT CHAPTER</small></div>
        <div className="experience-header-actions"><ModeSwitch mode={modeState.mode} onChange={changeMode}/><button hidden={!working} className="assistant-header-entry" onClick={()=>ask()}><Sparkles size={15}/><span>问 AI</span></button><button hidden={!working} onClick={openTools}><span className="experience-menu-mark" aria-hidden="true"><i/><i/></span><span>工具列表</span><small>08</small></button><MusicEntry state={soundtrack} contextKey={`${page}:${musicPresent}`} lightweight={lightweight} onOpen={detail=>{setMusicDetail(detail);setCinema(false);openMusic();}}/><button className="experience-replay-entry" aria-label="重播入场" title="重播入场" hidden={lightweight} onClick={()=>{setCinema(false);setIntroReveal(false);setIntroKey(value=>value+1);setIntro(true);}}><Play size={13}/><span>重播入场</span></button><button className="home-help-entry" onClick={openSources} aria-label="资料与当前能力" title="资料与当前能力"><CircleHelp size={17}/><span>使用说明</span></button><AISettings onVisibility={setApiOpen}/><AccountEntry onVisibility={setAccountOpen} questions={accountQuestions} onRestore={restoreAccountQuestions} onUse={text=>{setAssistantSeed({id:Date.now(),text,send:false});setAssistantOpen(true);}}/></div>
      </header>
      <main ref={overview} className="experience-overview" id={!working?'experience-content':'scene-content'} tabIndex={-1} inert={working||cinema} aria-hidden={working||cinema}>
        <div className="experience-section-label"><i/><span>初入职场，慢慢弄明白。</span></div>
        <article className="experience-story home-ask-story">
          <div className="experience-kicker"><span>FIRST STEP / YOUR NEXT MOVE</span></div>
          <h1>遇到什么事了？</h1>
          <p>合同怎么看，工资怎么算，租房先问什么。<br/>从你眼前的这件事开始。</p>
        </article>
        <section className="home-command-dock" aria-label="直接提问">
          <form className="home-question-form" onSubmit={event=>{event.preventDefault();if(homeQuestion.trim())ask(homeQuestion);}}><label htmlFor="home-question" className="sr-only">说说你遇到的问题</label><span className="home-command-provider"><Sparkles size={18}/>DeepSeek 助手</span><textarea id="home-question" rows={1} value={homeQuestion} maxLength={6000} onChange={event=>setHomeQuestion(event.target.value)} placeholder="比如：刚收到合同，不知道该先看哪里…"/><footer><button type="submit" disabled={!homeQuestion.trim()}>发送问题<ArrowUpRight size={16}/></button></footer></form>
          <div className="home-command-foot"><div className="home-question-examples"><small>也可以问</small>{['试用期怎么算？','第一笔工资怎么核对？'].map(example=><button key={example} onClick={()=>setHomeQuestion(example)}>{example}</button>)}</div><p className="home-input-note">不清楚的信息可以先留空，我们会逐项确认。</p></div>
        </section>
        {lightweight&&<aside className="simple-home-guide"><small>从问题到下一步</small><ol><li><span>01</span><div><strong>先说情况</strong><p>不用判断该选哪个工具。</p></div></li><li><span>02</span><div><strong>只补必要信息</strong><p>不确定的地方，可以直接说不知道。</p></div></li><li><span>03</span><div><strong>核对，再带走结果</strong><p>金额按规则算，要问的事留在清单里。</p></div></li></ol><p className="simple-guide-foot">也可以从下方工具列表自行核对。</p></aside>}
        <aside className="experience-spatial-note" aria-hidden="true"><span>{task?.code}</span><div><small>{phase}</small><span>08 / CONNECTED TASKS</span></div><i/></aside>
      </main>
      <aside className="experience-work-context" aria-hidden={!working} inert={!working}>
        <div className="context-id"><span>{utility?'—':task?.code}</span><small>{tools?'PRACTICAL TOOLS':list?'SHARED RECORDS':task?.english}</small></div>
        <h2>{tools?'工具列表':list?'询问清单':task?.label}</h2>
        <p>{tools?'八件常遇到的事，都有直接可用的工具。':list?'把要问的问题先记下来。':task?.description}</p>
        <div className="context-state"><i/><span>{tools?'不使用 AI 也能完成':list?`${questionCount} 项已保存问题`:statusFor(selected,signals)}</span></div>
        <ol>{(tools?['选择工具','填写已知信息','核对并带走结果']:list?['整理问题','记录答复','导出清单']:task?.outputs??[]).map((value,i)=><li key={value}><span>{String(i+1).padStart(2,'0')}</span>{value}</li>)}</ol>
        <button onClick={closeWork}><ArrowLeft size={14}/>返回首页</button>
      </aside>
      <section className="experience-workspace" ref={workspace} id={working?'experience-content':'work-content'} tabIndex={-1} data-open={working} inert={!working} aria-hidden={!working} onClickCapture={event=>{const clicked=(event.target as HTMLElement).closest('button');if(clicked?.dataset.materialView===page){intent.current=null;setFocusRequest(null);setWorkView('material');}const label=clicked?.textContent??'';if(label.includes('查看原文')){setWorkView('material');setTimeout(()=>{if(root.current?.dataset.stage!=='material'||root.current?.dataset.module!=='contract')return;const field=document.getElementById('contract-text');field?.focus({preventScroll:true});field?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});},480);}if(label.includes('导出')||label.includes('下载'))setFeedback('已开始下载，请查看浏览器下载列表');if(label.includes('加入询问清单')||label.includes('整理')&&label.includes('待确认'))setFeedback('询问清单已更新');}}>
        <header className="experience-workbar"><button onClick={closeWork}><ArrowLeft size={16}/>返回首页</button><span>{tools?'TOOLS / 08':list?'MY CHECKLIST':`${task?.code} / ${task?.english}`}</span><div><small>返回后保留本次填写</small><button onClick={openSources}>资料与依据<ArrowUpRight size={13}/></button><button onClick={closeWork} aria-label="收起工作区"><X size={19}/></button></div></header>
        {task?.ready&&!utility&&<div className="motion-work-nav" aria-label="工作视图"><button aria-pressed={workView==='material'} onClick={()=>{intent.current=null;setFocusRequest(null);setWorkView('material');}}><span>01</span>{MODULE_GUIDES[task.id].input}<small>{task.id==='contract'?(signals.contract.characters?`${signals.contract.characters} 字`:'等待材料'):'在这里填写或修改'}</small></button><i/><button aria-pressed={workView==='result'} disabled={!hasResult} onClick={()=>{intent.current=null;setFocusRequest(null);setWorkView('result');}}><span>02</span>{MODULE_GUIDES[task.id].result}<small>{hasResult?(task.id==='contract'?`${signals.contract.items} 项 / ${signals.contract.unresolved} 待确认`:'点击查看'):'先完成前一步'}</small></button><i/><button onClick={openList}><span>03</span>询问清单<small>{questionCount} 项</small></button><div aria-live="polite">{feedback||'返回首页不会清空本次填写'}</div></div>}
        {tools&&<ToolDirectory go={go} onAsk={text=>ask(text)}/>}
        <div className="experience-business-content">{children}</div>
        {task&&!utility&&<details className="module-method"><summary><span>这件事怎么做</span>{MODULE_GUIDES[task.id].steps.map((step,i)=><small key={step}>{String(i+1).padStart(2,'0')} {step}</small>)}<ChevronRight size={13}/></summary><p>{MODULE_GUIDES[task.id].logic}</p></details>}
      </section>
      <div className="experience-scene-tools" hidden={working||lightweight} inert={cinema}><p>{failed?'三维暂不可用 · 工具列表仍可使用':simple?'已减少动态 · 工具入口照常可用':'后排只预览 · 当前模型的文字与子选项可操作'}</p><details className="home-scene-settings" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}><summary><SlidersHorizontal size={14}/>场景设置<ChevronRight size={12}/></summary><div><button onClick={()=>setParticles(value=>!value)} aria-pressed={particles} disabled={simple||failed}><Sparkles size={14}/>{particles?'重组资料':'查看几何点云'}</button><button onClick={()=>setReset(value=>value+1)} aria-label="复位场景视角"><RotateCcw size={14}/>复位场景视角</button><button onClick={()=>setSimple(value=>!value)} aria-pressed={simple}>{simple?'开启动效':'减少动态'}</button><button onClick={()=>setCinema(value=>!value)} aria-pressed={cinema}><Maximize size={14}/>{cinema?'显示界面':'纯净观景'}</button></div></details></div>
      <footer className="experience-footer" inert={cinema}><HomeTaskDirectory onAsk={()=>ask()} onTools={openTools} onList={openList} questionCount={questionCount}/></footer>
      <div className="experience-systemline" inert={cinema}><span><i/>FIRST STEP / {version}<span>YOUR NEXT MOVE</span></span><div><button onClick={openSources}>使用范围 ↗</button></div></div>
      {cinema&&<button className="experience-cinema-return" onClick={()=>setCinema(false)}>返回界面<ArrowLeft size={15}/><small>ESC</small></button>}
    </div>
    {modeState.notice&&<div className="experience-mode-notice" role="status"><span>{modeState.notice}</span>{lightweight&&<button onClick={()=>changeMode('full')}>切回完整</button>}<button onClick={modeState.dismiss} aria-label="关闭模式提示"><X size={14}/></button></div>}
    <MusicPlayer state={soundtrack} lightweight={lightweight} modeNotice={modeState.notice} onSimpleMode={()=>changeMode('simple')} onFullMode={()=>changeMode('full')} onFrame={(now,eligible)=>modeState.frame('music',now,eligible)} open={musicOpen} onClose={closeMusic} returnPage={page} returnLabel={page==='home'?'首页':tools?'工具列表':list?'询问清单':task.label} reduced={simple} entryDetail={musicDetail} onModeChange={setMusicPhase}/>
    <AIAssistant key={`assistant-${accountEpoch}`} onResume={()=>setAssistantOpen(true)} modeSwitch={<ModeSwitch mode={modeState.mode} onChange={changeMode}/>} open={assistantOpen} onClose={()=>setAssistantOpen(false)} module={page} seed={assistantSeed} onAction={onAssistantAction} onTools={openTools}/>
    <PerformanceDiagnostics record={modeState.record}/><PointerFeedback enabled={!intro&&!simple} follow={!lightweight}/><audio ref={soundtrack.audio} crossOrigin="anonymous" loop={soundtrack.loop==='single'} preload="none" data-soundtrack={soundtrack.track.cid} aria-hidden="true"/>
    {intro&&<ExperienceEntry key={`entry-${introKey}`} staticMode={simple} ready={ready||simple||failed} onComplete={completeIntro} onReveal={()=>setIntroReveal(true)} onMusicToggle={soundtrack.toggle} musicPlaying={soundtrack.playing}/>}
  </>;
}
