import type {ExperienceMode} from './runtime-mode.ts';
export default function ModeSwitch({mode,onChange}:{mode:ExperienceMode;onChange:(mode:ExperienceMode)=>void}){
 return <div className="experience-mode-switch" role="group" aria-label="界面模式"><button onClick={()=>onChange('full')} aria-pressed={mode==='full'} aria-label="切换完整模式" title="保留三维与动态效果">完整</button><button onClick={()=>onChange('simple')} aria-pressed={mode==='simple'} aria-label="切换简易模式" title="轻量界面，工具和填写保持不变">简易</button></div>;
}
