/** Reviewed official excerpts. Retrieval is lexical and local, without sending a query to a search provider. */
export const CONTRACT_KNOWLEDGE = {
  id: 'labor-contract-2012-v1',
  title: '中华人民共和国劳动合同法',
  publisher: '国家税务总局政策法规库',
  url: 'https://fgk.chinatax.gov.cn/zcfgk/c100009/c5193025/content.html',
  crossCheckUrl: 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html',
  version: '2012年12月28日修正',
  checkedOn: '2026-11-03',
  reviewAfter: '2027-02-01',
  scope: '中国内地劳动合同。本资料库聚焦全日制劳动合同的条款、试用期与违约金',
} as const;

export const CONTRACT_EXCERPTS = [
  {id:'LC17', article:'第十七条', title:'合同应写明哪些事项', terms:['合同','签合同','劳动合同','要写','必须写','必备','条款','签字','签约','地点','工作内容','报酬','工资','社保','工时','休息','劳动保护','主体','缺项'], text:'劳动合同应当具备以下条款：\n（一）用人单位的名称、住所和法定代表人或者主要负责人；\n（二）劳动者的姓名、住址和居民身份证或者其他有效身份证件号码；\n（三）劳动合同期限；\n（四）工作内容和工作地点；\n（五）工作时间和休息休假；\n（六）劳动报酬；\n（七）社会保险；\n（八）劳动保护、劳动条件和职业危害防护；\n（九）法律、法规规定应当纳入劳动合同的其他事项。\n劳动合同除前款规定的必备条款外，用人单位与劳动者可以约定试用期、培训、保守秘密、补充保险和福利待遇等其他事项。'},
  {id:'LC19-1', article:'第十九条第一款', title:'试用期与合同期限的区间', terms:['试用期','试用','上限','一年','三年','固定期限','无固定期限','合同期限','合同期','转正'], text:'劳动合同期限三个月以上不满一年的，试用期不得超过一个月；劳动合同期限一年以上不满三年的，试用期不得超过二个月；三年以上固定期限和无固定期限的劳动合同，试用期不得超过六个月。'},
  {id:'LC19-2', article:'第十九条第二款', title:'同一单位只能约定一次试用期', terms:['试用期','试用','重复','再次','二次','第二次','一次','同一单位','同一用人单位','调岗'], text:'同一用人单位与同一劳动者只能约定一次试用期。'},
  {id:'LC19-3', article:'第十九条第三款', title:'短期或任务期限合同的试用期', terms:['试用期','试用','不足三个月','不满三个月','两个月','2个月','任务期限','工作任务','短期'], text:'以完成一定工作任务为期限的劳动合同或者劳动合同期限不满三个月的，不得约定试用期。'},
  {id:'LC19-4', article:'第十九条第四款', title:'试用期包含在合同期限内', terms:['试用期','试用','单独','仅约定','只签','包含','另加','不计入','试用合同'], text:'试用期包含在劳动合同期限内。劳动合同仅约定试用期的，试用期不成立，该期限为劳动合同期限。'},
  {id:'LC22', article:'第二十二条', title:'专项培训服务期与费用', terms:['违约金','专项培训','培训费','培训','服务期','分摊'], text:'用人单位为劳动者提供专项培训费用，对其进行专业技术培训的，可以与该劳动者订立协议，约定服务期。\n劳动者违反服务期约定的，应当按照约定向用人单位支付违约金。违约金的数额不得超过用人单位提供的培训费用。用人单位要求劳动者支付的违约金不得超过服务期尚未履行部分所应分摊的培训费用。\n用人单位与劳动者约定服务期的，不影响按照正常的工资调整机制提高劳动者在服务期期间的劳动报酬。'},
  {id:'LC23', article:'第二十三条', title:'保密与竞业限制的约定', terms:['违约金','竞业','竞业限制','保密','商业秘密','经济补偿'], text:'用人单位与劳动者可以在劳动合同中约定保守用人单位的商业秘密和与知识产权相关的保密事项。\n对负有保密义务的劳动者，用人单位可以在劳动合同或者保密协议中与劳动者约定竞业限制条款，并约定在解除或者终止劳动合同后，在竞业限制期限内按月给予劳动者经济补偿。劳动者违反竞业限制约定的，应当按照约定向用人单位支付违约金。'},
  {id:'LC25', article:'第二十五条', title:'劳动者承担违约金的约定范围', terms:['违约金','普通离职','辞职','离职','赔钱','罚款'], text:'除本法第二十二条和第二十三条规定的情形外，用人单位不得与劳动者约定由劳动者承担违约金。'},
] as const;

export type ContractExcerpt = {id:string;article:string;title:string;text:string;matchedTerms:string[]};
export type ContractRetrieval = {
  corpusId: typeof CONTRACT_KNOWLEDGE.id;
  status: 'matched'|'no-match'|'out-of-scope'|'needs-refresh'|'unsupported-version';
  query:string;
  message:string;
  excerpts:ContractExcerpt[];
};

/** Reuse a single recent user topic only for specific follow-up questions. */
export function contractQueryFromMessages(messages:readonly {role:string;content:string}[]):string {
  const latest=messages.at(-1)?.content.trim()??'';
  if(/合同|试用|竞业|培训|服务期|违约/u.test(latest))return latest;
  if(/工资|扣款|社保|医保|租房|押金|个税|补贴|offer|赔偿|仲裁/iu.test(latest))return latest;
  const shortQuestion=latest.replace(/[\s？?。！!，,]/gu,'');
  const probationOnly=/(?:单独|仅|只)(?:写|约定|签).{0,6}(?:那段|这段)/u.test(shortQuestion)&&/算数|成立|有效/u.test(shortQuestion);
  if(!probationOnly&&!/^(?:那|那么|那如果|如果|请问|具体)?(?:第[二三234]次|再次|重复|重新|另加|包含|算在|几个月|[一二三四五六七八九十\d]+年|哪(?:一)?条(?:依据|原文)?|条文|原文|依据)(?:呢|吗|么|可以吗|行吗|怎么算|怎么说|是什么|在哪里|在哪|有吗)?$/u.test(shortQuestion))return latest;
  const previous=messages.slice(0,-1).filter(message=>message.role==='user').slice(-3).reverse();
  for(const message of previous){
    if(/工资|扣款|社保|医保|租房|押金|个税|补贴|offer|先不聊|换个话题|换个问题|另一个问题|新问题/iu.test(message.content))return latest;
    const topics=Array.from(new Set(message.content.match(/试用期|竞业限制|专项培训|服务期|违约金/gu)??[]));
    if(topics.length>1)return latest;
    if(topics.length===1){
      if(probationOnly&&topics[0]!=='试用期')return latest;
      return `${latest}\n沿用此前用户问题的主题：${probationOnly?'仅约定试用期':topics[0]}`;
    }
  }
  return latest;
}

function scopeOutside(context:string,fullTimeConfirmed:boolean):boolean {
  const last = Array.from(context.matchAll(/不是全日制|非全日制|全日制|普通劳动合同|实习协议|实习合同|劳务协议|劳务合同|劳务派遣|派遣合同/gu)).at(-1);
  const relationship=last?.[0];
  const scopeClause=last?context.slice(0,last.index!).split(/[，,。；;\n]/u).at(-1)!+context.slice(last.index!).split(/[，,。；;\n]/u)[0]:'';
  // “是不是全日制” contains “不是全日制”; a question is not a confirmed exclusion.
  const uncertain=/是不是|是否|不知道|不确定|不清楚|待确认|可能|[？?]/u.test(scopeClause);
  const region = Array.from(context.matchAll(/中国内地|中国大陆|中国境内|香港|澳门|台湾|美国|日本|英国|新加坡|境外|海外/gu)).at(-1)?.[0];
  return (!fullTimeConfirmed&&!uncertain&&Boolean(relationship&&!['全日制','普通劳动合同'].includes(relationship))) || Boolean(region&&!['中国内地','中国大陆','中国境内'].includes(region));
}

/** Rank reviewed excerpts by matched phrases. Generic words carry less weight than a specific topic. */
export function searchContractKnowledge(query:string, options:{context?:string;fullTimeConfirmed?:boolean;today?:string}={}):ContractRetrieval {
  const normalized=query.trim().slice(0,12000).replaceAll('违约费','违约金');
  const result:ContractRetrieval={corpusId:CONTRACT_KNOWLEDGE.id,status:'no-match',query:normalized.slice(0,200),message:'现有资料没有检索到足够相关的条文。可换成具体的合同问题，或打开官方全文核实。',excerpts:[]};
  if(/住宅租赁|房屋租赁|退租|房东|出租人|租房|押金/u.test(normalized)&&!/(?:先|现在|只|改).{0,4}(?:问|看|聊|核对)?.{0,3}(?:劳动合同|试用期)/u.test(normalized))return {...result,status:'out-of-scope',message:'住宅租赁不是劳动用工关系，不能用这里的劳动合同法摘录判断租房押金或退租问题。'};
  if(scopeOutside(options.context??normalized,options.fullTimeConfirmed===true))return {...result,status:'out-of-scope',message:'这份资料库只整理中国内地全日制劳动合同。你提到的地区或用工情形需要另查适用依据，暂不套用这里的条文。'};
  if(/2007(?:年)?.{0,8}(?:版|原文)|旧版|修正前/u.test(normalized))return {...result,status:'unsupported-version',message:'当前只收录2012年修正文本，没有收录你要查的历史版本，不能拿现行摘录代替。'};
  const today=options.today??new Date().toISOString().slice(0,10);
  if(today>CONTRACT_KNOWLEDGE.reviewAfter||today<CONTRACT_KNOWLEDGE.checkedOn)return {...result,status:'needs-refresh',message:'这份资料需要重新核验，暂不提供检索摘录。核验周期届满不表示法律失效，请打开官方全文确认。'};
  if(!normalized)return result;
  if(/仲裁|诉讼|提前.{0,6}(?:天|日|通知)|通知期|最低工资|试用期.{0,6}(?:工资|薪资)|(?:工资|薪资).{0,6}试用期|辞退|解雇|解除赔偿|补偿金|赔偿金/u.test(normalized))return {...result,message:'当前摘录尚未覆盖工资标准、解除补偿或争议处理等问题，需要补充对应依据后再解释。可先打开官方全文核实。'};
  if(!/合同|试用|竞业|专项培训|服务期|违约金|第[一二三四五六七八九十]+条/u.test(normalized))return result;
  // Only a clearly stated duration below three months prioritizes this paragraph.
  // Weeks <=12 / days <89 are safely below three calendar months; no conversion
  // is used to fill the user's contract form or determine an unknown duration.
  const shortTerm=Array.from(normalized.matchAll(/合同[^。；;，,\n]{0,12}?(\d+|[一二两三四五六七八九十]+)\s*个?(星期|周|天|日|月)/gu)).some(match=>{
    if(/不是|不对|不知道|不确定|可能|大概|约/u.test(match[0]))return false;
    const digits:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
    const token=match[1],parts=token.split('十');
    const number=/^\d/u.test(token)?Number(token):token.includes('十')?(parts[0]?digits[parts[0]]:1)*10+(parts[1]?digits[parts[1]]:0):digits[token];
    return number>0&&(match[2]==='月'?number<3:['周','星期'].includes(match[2])?number<=12:number<89);
  });
  const ranked=CONTRACT_EXCERPTS.map(excerpt=>{
    const matchedTerms:string[]=excerpt.terms.filter(term=>normalized.includes(term));
    const repeatProbation=/试用/u.test(normalized)&&/再次|第二次|二次|重复|重新|又|调岗|换岗|转岗|回原公司/u.test(normalized);
    if(excerpt.id==='LC19-2'&&repeatProbation){
      for(const term of ['同一家公司','同一公司','同一个单位','原公司','换岗','转岗'])if(normalized.includes(term))matchedTerms.push(term);
    }
    const articleMatch=normalized.includes(excerpt.article)||normalized.includes(excerpt.article.replace(/第(.+)条.*/u,'第$1条'));
    let score=matchedTerms.reduce((sum,term)=>sum+(['合同','试用期','试用','工资','社保','离职','违约金'].includes(term)?1:term.length),0)+(articleMatch?10:0);
    if(!articleMatch&&excerpt.id==='LC19-3'&&shortTerm&&/试用/u.test(normalized)){score+=8;matchedTerms.push('明确的短期合同期限');}
    if(!articleMatch&&excerpt.id==='LC19-4'&&/试用/u.test(normalized)&&/另加|不计入|不包含|仅约定|只签/u.test(normalized))score+=8;
    if(!articleMatch&&excerpt.id==='LC23'&&/保密|商业秘密|竞业/u.test(normalized))score+=8;
    if(excerpt.id==='LC17'&&/试用/u.test(normalized)&&!articleMatch&&matchedTerms.every(term=>['合同','劳动合同','签合同'].includes(term)))score=0;
    return {excerpt,matchedTerms:articleMatch?[...matchedTerms,excerpt.article]:matchedTerms,score};
  }).filter(hit=>hit.score>=2).sort((a,b)=>b.score-a.score||a.excerpt.id.localeCompare(b.excerpt.id));
  if(!ranked.length)return result;
  return {...result,status:'matched',message:'检索自已核验的官方条文摘录。请结合完整原文与实际情况理解。',excerpts:ranked.filter(hit=>hit.score>=ranked[0].score*.5).slice(0,3).map(({excerpt,matchedTerms})=>({id:excerpt.id,article:excerpt.article,title:excerpt.title,text:excerpt.text,matchedTerms}))};
}

/** Only allow exact corpus excerpts to reach source cards. Model-written links and quotations are not accepted. */
export function isContractRetrieval(value:unknown):value is ContractRetrieval {
  if(!value||typeof value!=='object')return false;
  const v=value as ContractRetrieval;
  if(v.corpusId!==CONTRACT_KNOWLEDGE.id||!['matched','no-match','out-of-scope','needs-refresh','unsupported-version'].includes(v.status)||typeof v.query!=='string'||v.query.length>200||typeof v.message!=='string'||v.message.length>300||!Array.isArray(v.excerpts)||v.excerpts.length>3)return false;
  if((v.status==='matched')!==(v.excerpts.length>0)||new Set(v.excerpts.map(item=>item?.id)).size!==v.excerpts.length)return false;
  return v.excerpts.every(item=>{
    const original=CONTRACT_EXCERPTS.find(entry=>entry.id===item?.id);
    return original&&item.article===original.article&&item.title===original.title&&item.text===original.text&&Array.isArray(item.matchedTerms)&&item.matchedTerms.length<=20&&item.matchedTerms.every(term=>typeof term==='string'&&term.length<=30);
  });
}

export function contractSourcesForCopy(result:ContractRetrieval):string {
  if(result.status!=='matched')return result.message;
  return ['本次检索依据',`${CONTRACT_KNOWLEDGE.title} · ${CONTRACT_KNOWLEDGE.version}`,`核验 ${CONTRACT_KNOWLEDGE.checkedOn} · ${CONTRACT_KNOWLEDGE.scope}`,...result.excerpts.flatMap(item=>[`${item.article} · ${item.title}`,item.text]),CONTRACT_KNOWLEDGE.url].join('\n');
}
