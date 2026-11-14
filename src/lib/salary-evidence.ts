/** Ground model-proposed amounts in user words. This never infers rates or missing money. */
import {explicitMoney} from './explicit-money.ts';
export const SALARY_LABELS = {
  gross: '(?:应发(?:工资)?|税前(?:工资)?)',
  insurance: '(?:个人)?社保(?:扣款)?',
  fund: '(?:个人)?公积金(?:扣款)?',
  tax: '(?:已扣)?(?:个人所得税|个税)',
  other: '(?:其他|其它|其余|别的)扣款',
  received: '(?:实际到账|到账|实发)(?:工资|金额)?',
} as const;
export type SalaryField = keyof typeof SALARY_LABELS;
export const SALARY_REQUIRED: SalaryField[] = ['gross', 'insurance', 'fund', 'tax', 'other'];
export const SALARY_FIELD_NAMES: Record<SalaryField, string> = {gross:'应发工资',insurance:'个人社保扣款',fund:'个人公积金扣款',tax:'已扣个税',other:'其他扣款',received:'实际到账'};
export type SalaryFact = {value:number|null; state:'confirmed'|'unknown'|'absent'; quote:string};
const deduction = (key:SalaryField) => ['insurance','fund','tax','other'].includes(key);
const uncertain = /不是|不对|不确定|不知道|不清楚|未知|待确认|未确认|没确认|记不清|不记得|撤回|取消|没查到|查不到|没出|没有明细|可能|好像|不一定|大概|大约|估计|左右|上下|差不多/u;
// A total is supported only when every member of this fixed income checklist is confirmed.
const INCOME_LABELS = {base:'(?:基本工资|底薪)',performance:'绩效(?:工资|奖金)?',overtime:'加班(?:费|工资)?',allowance:'津贴',bonus:'奖金'} as const;
type EvidenceField = SalaryField | keyof typeof INCOME_LABELS;
const evidenceLabels = {...SALARY_LABELS,...INCOME_LABELS};
const allLabels = Object.values(evidenceLabels).join('|');
const zeroAfter=/^(?:[:：\s]|是|为|本月|本期|当月|这月|本次|明确|确实|确认|确定|都|均)*(?:没有(?:扣款|扣钱)?|没(?:有)?扣(?:款|钱)?|未扣(?:除|款)?|不扣(?:款|钱)?|无(?:扣款)?|零(?:元)?)(?:了|的)?$/u;
const unchangedAfter=/^(?:[:：\s]|是|为)*(?:不变|没变|未变|照旧|同上|保持不变)(?:了|的)?$/u;

function explicitFact(text:string,key:EvidenceField):SalaryFact {
  // Commas inside a conventional thousands group are formatting, not clause boundaries.
  const normalized=text.replace(/(\d)[,，](?=\d{3}(?:\D|$))/g,'$1');
  // Scan all labels together so “绩效奖金” cannot also invent a separate bonus fact.
  const occurrences=Array.from(normalized.matchAll(new RegExp(allLabels,'gu')));
  const parts=(candidate:RegExpExecArray)=>{
    const start=candidate.index!;
    let last=candidate;
    // Shared absence/unknown/unchanged applies to a connected list. A shared positive
    // amount does not: “社保、公积金600” cannot confirm both deductions as 600.
    for(let i=occurrences.indexOf(candidate)+1;i<occurrences.length;i++){
      const next=occurrences[i],between=normalized.slice(last.index!+last[0].length,next.index!);
      if(!/^\s*(?:、|和|及|与|以及)\s*$/u.test(between))break;
      last=next;
    }
    const tailAt=(entry:RegExpExecArray)=>{
      const a=entry.index!+entry[0].length,t=normalized.slice(a).split(/[，,、。；;\n！？?]/u)[0];
      const nl=t.search(new RegExp(allLabels,'u')),raw=nl<0?t:t.slice(0,nl);
      return {body:raw.trim(),end:a+raw.length,continuation:nl<0?normalized.slice(a+t.length):''};
    };
    let tail=tailAt(candidate);
    if(last!==candidate){
      const shared=tailAt(last);
      if(zeroAfter.test(shared.body)||uncertain.test(shared.body)||unchangedAfter.test(shared.body))tail=shared;
    }
    const prefix=normalized.slice(Math.max(0,start-12),start).split(/[，,。；;\n]/u).at(-1)??'';
    return {...tail,prefix,quote:prefix+normalized.slice(start,tail.end)};
  };
  const matches=occurrences.filter(candidate=>new RegExp(`^(?:${evidenceLabels[key]})$`,'u').test(candidate[0])).filter(candidate=>{
    const {body:b,prefix:p,continuation:c}=parts(candidate);
    if(/^[？?]/u.test(c))return true;
    const unchanged=!/不是|并非/u.test(p)&&unchangedAfter.test(b);
    const verbMention=/(?:核对|重算|计算|算一下|算算|算出|看看|看下|查查|确认)(?:一下|下)?\s*$/u.test(p)&&!/\d/u.test(b)&&!uncertain.test(b)&&!/^(?:[:：\s]|是|为)*(?:没有|没|未|不|无|零)/u.test(b);
    return !unchanged&&!verbMention;
  });
  const match=matches.at(-1);
  if(!match)return {value:null,state:'absent',quote:''};
  const {body,prefix,quote,continuation}=parts(match);
  if(/^[？?]|^[，,](?:这项|这个|我)?(?:不确定|不清楚|还不知道)/u.test(continuation))return {value:null,state:'unknown',quote};
  if(uncertain.test(body)||/(?:不确定|不知道|不清楚|可能|好像|不是|撤回|取消|不一定|大概|估计|大约|差不多)[^，,。；;\n]{0,8}$/u.test(prefix)||/(?:公司|单位|企业)(?:承担|缴纳|缴的|交的)?\s*$/u.test(prefix))return {value:null,state:'unknown',quote};
  if(key in INCOME_LABELS&&/(?:上(?:一|个|一个)?月|上(?:一)?期|去年)/u.test(prefix+body))return {value:null,state:'unknown',quote};
  if(body!==''&&(/没(?:有)?扣(?:除)?\s*$/u.test(prefix)||key==='other'&&/(?:没有|无)\s*$/u.test(prefix)))return {value:null,state:'unknown',quote};
  const amount=explicitMoney(body);
  if(amount!==null)return {value:amount,state:'confirmed',quote};
  // Explicit absence confirms an income item or employee deduction, never gross/receipt.
  const zeroBefore=body===''&&(/没(?:有)?扣(?:除)?\s*$/u.test(prefix)||(key==='other'||key in INCOME_LABELS)&&/(?:没有|无)\s*$/u.test(prefix));
  if((key in INCOME_LABELS||deduction(key as SalaryField))&&(zeroAfter.test(body)||zeroBefore))return {value:0,state:'confirmed',quote};
  return {value:null,state:'unknown',quote};
}

export function salaryFact(text:string,key:SalaryField):SalaryFact {
  const direct=explicitFact(text,key);
  if(key!=='gross'||direct.state!=='absent')return direct;
  const components=Object.keys(INCOME_LABELS).map(key=>explicitFact(text,key as keyof typeof INCOME_LABELS));
  const quote=components.filter(fact=>fact.quote).map(fact=>fact.quote).join('；');
  if(components.some(fact=>fact.state!=='confirmed'||fact.value===null||!Number.isFinite(fact.value)))return {value:null,state:quote?'unknown':'absent',quote};
  // Sum in cents, just like the payslip calculation, without inventing a missing item.
  return {value:components.reduce((sum,fact)=>sum+Math.round(fact.value!*100),0)/100,state:'confirmed',quote};
}

export function salaryFacts(text:string):Record<SalaryField,SalaryFact> {
  return Object.fromEntries(Object.keys(SALARY_LABELS).map(key=>[key,salaryFact(text,key as SalaryField)])) as Record<SalaryField,SalaryFact>;
}

export function salaryValueGrounded(value:unknown,text:string,key:SalaryField):boolean {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return false;
  const fact=salaryFact(text,key);
  return fact.state==='confirmed'&&fact.value!==null&&Math.abs(fact.value-value)<.00001;
}

export function asksSalaryFirstStep(text:string):boolean {
  return /从哪(?:里|儿|一?步)?开始|先(?:做什么|干什么|做哪|看哪|查哪)|(?:去|到|在|从)哪(?:里|儿)?.{0,5}(?:查|找|看)|怎么(?:查|找|拿到|获取)|应该(?:怎么做|怎么办)/u.test(text);
}
