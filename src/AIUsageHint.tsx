import {useEffect,useState} from 'react';
import {fetchUsage} from './services/ai-settings-client.ts';
import type {AIUsage} from './services/ai-settings-client.ts';
export default function AIUsageHint({active,refresh,kind='chat'}:{active:boolean;refresh:boolean;kind?:'chat'|'image'}){
 const [value,setValue]=useState<AIUsage|null>(null),[error,setError]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const changed=()=>setRevision(v=>v+1);window.addEventListener('first-step-ai-settings-changed',changed);return()=>window.removeEventListener('first-step-ai-settings-changed',changed);},[]);
 useEffect(()=>{if(!active||refresh)return;const controller=new AbortController();void fetchUsage(controller.signal).then(v=>{setValue(v);setError(false);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[active,refresh,revision]);
 if(!active)return null;const remaining=value?.[kind];
 if(!error&&value?.mode==='personal')return <details className="ai-usage-hint"><summary>自备接口 · 不限制每日{kind==='chat'?'提问':'识图'}次数{remaining?.available?'':' · 请稍后再试'}</summary><p>不占用比赛提供的每日试用次数。费用和可用余额由你的DeepSeek账号决定，仍保留并发和短时频率保护。临时密钥过期后需重新连接，不会自动改用比赛接口。</p></details>;
 if(!error&&value?.mode==='expired')return <details className="ai-usage-hint"><summary>自备接口已失效 · 请重新连接</summary><p>在API设置中重新连接自己的接口，或主动选择比赛提供的接口。不会在你不知情时切换。</p></details>;
 return <details className="ai-usage-hint"><summary>{error?'试用次数暂未确认':remaining?`今日${kind==='chat'?'提问':'识图'}剩余 ${remaining.remaining} / ${remaining.limit} 次${remaining.available?'':' · 当前暂不可用'}`:'正在读取试用次数…'}</summary><p>{value?.identity==='account'?'按当前账号计次':'游客按当前浏览器计次，无需登录'}，北京时间每日零点恢复。开始调用模型后计一次；中断或失败也会计入，以防反复请求。本站和同一网络还有请求保护，次数不代表API余额；八项手动工具不受此限。</p></details>;
}
