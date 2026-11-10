import {Download,Gauge} from 'lucide-react';
import {saveText} from './lib/download.ts';
import type {PerformanceRecord} from './performance-record.ts';
import {performanceAuditSnapshot} from './performance-audit.ts';

export default function PerformanceDiagnostics({record}:{record:PerformanceRecord|null}){
 if(!record)return null;
 return <details className="performance-record"><summary><Gauge size={14}/>性能记录</summary><div><p>记录前台帧率与模式切换。切到简易后，之前的记录仍会保留。</p><small>包含浏览器实际使用的显卡、画布像素和帧耗，不包含问题、表单或密钥。下载后可交给开发者排查。</small><button onClick={()=>saveText(JSON.stringify({...record.snapshot(),renderers:performanceAuditSnapshot()},null,2),'初程-性能记录.json')}><Download size={14}/>下载性能记录</button></div></details>;
}
