import {BookOpen,ChevronDown,ExternalLink} from 'lucide-react';
import {CONTRACT_KNOWLEDGE} from './lib/contract-knowledge.ts';
import type {ContractRetrieval} from './lib/contract-knowledge.ts';

export default function ContractSources({result}:{result:ContractRetrieval}) {
  return <details className="contract-sources">
    <summary><span><BookOpen size={15}/>{result.status==='matched'?`查看官方依据 · ${result.excerpts.length} 段条文`:'这次没有可用的检索依据'}</span><ChevronDown size={15}/></summary>
    <div className="contract-sources-content">
      <p className="contract-sources-note">{result.message}</p>
      {result.excerpts.map((excerpt,index)=><section key={excerpt.id} className="contract-source-excerpt">
        <header><span>{String(index+1).padStart(2,'0')}</span><div><strong>{excerpt.article}</strong><small>{excerpt.title}</small></div></header>
        <blockquote>{excerpt.text}</blockquote>
        <small className="contract-source-match">匹配内容 · {excerpt.matchedTerms.join(' / ')}</small>
      </section>)}
      <footer><strong>{CONTRACT_KNOWLEDGE.title}</strong><span>{CONTRACT_KNOWLEDGE.version} · 核验 {CONTRACT_KNOWLEDGE.checkedOn}</span><p>{CONTRACT_KNOWLEDGE.scope}。当前摘录覆盖第17、19、22、23、25条。个人用工类型和地区仍需确认。</p><a href={CONTRACT_KNOWLEDGE.url} target="_blank" rel="noreferrer">查看官方全文<ExternalLink size={12}/></a></footer>
    </div>
  </details>;
}
