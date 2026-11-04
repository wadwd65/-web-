import {Download,Gauge} from 'lucide-react';
import {saveText} from './lib/download.ts';
import type {PerformanceRecord} from './performance-record.ts';

export default function PerformanceDiagnostics({record}:{record:PerformanceRecord|null}){
 if(!record)return null;
 return <details className="performance-record"><summary><Gauge size={14}/>性能记录</summary><div><p>记录前台有效检测窗口与模式切换。切到简易后，之前的记录仍会保留。</p><small>仅含浏览器、设备概况和帧率。点击下载到本机后，可交给开发者排查。</small><button onClick={()=>saveText(JSON.stringify(record.snapshot(),null,2),'初程-性能记录.json')}><Download size={14}/>下载性能记录</button></div></details>;
}
