/** Ground model-proposed amounts in user words. This never infers rates or missing money. */
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
const uncertain = /不是|不对|不确定|不知道|不清楚|待确认|未确认|记不清|不记得|撤回|取消|没查到|查不到|没出|没有明细|可能|好像|不一定|大概|大约|估计|左右|上下|差不多/u;
const allLabels = Object.values(SALARY_LABELS).join('|');

export function salaryFact(text:string,key:SalaryField):SalaryFact {
  // Commas inside a conventional thousands group are formatting, not clause boundaries.
  const normalized=text.replace(/(\d)[,，](?=\d{3}(?:\D|$))/g,'$1');
  const match=Array.from(normalized.matchAll(new RegExp(SALARY_LABELS[key],'gu'))).at(-1);
  if(!match)return {value:null,state:'absent',quote:''};
  const start=match.index!, after=start+match[0].length;
  const tail=normalized.slice(after).split(/[，,、。；;\n！？?]/u)[0];
  const nextLabel=tail.search(new RegExp(allLabels,'u'));
  const body=(nextLabel<0?tail:tail.slice(0,nextLabel)).trim();
  const prefix=normalized.slice(Math.max(0,start-12),start).split(/[，,。；;\n]/u).at(-1)??'';
  const quote=prefix+match[0]+body;
  const continuation=nextLabel<0?normalized.slice(after+tail.length):'';
  if(/^[？?]|^[，,](?:这项|这个|我)?(?:不确定|不清楚|还不知道)/u.test(continuation))return {value:null,state:'unknown',quote};
  if(uncertain.test(body)||/(?:不确定|不知道|不清楚|可能|好像|不是|不一定|大概|估计|大约|差不多)[^，,。；;\n]{0,8}$/u.test(prefix)||/(?:公司|单位|企业)(?:承担|缴纳|缴的|交的)?\s*$/u.test(prefix))return {value:null,state:'unknown',quote};
  if(body!==''&&(/没(?:有)?扣(?:除)?\s*$/u.test(prefix)||key==='other'&&/(?:没有|无)\s*$/u.test(prefix)))return {value:null,state:'unknown',quote};
  // A negative sign or a third decimal must never become a positive/rounded amount.
  const amount=body.match(/^(?:[:：=\s¥￥]|是|为|扣了|扣除|扣的|扣|金额|本次|共|合计)*(\d+(?:\.\d{1,2})?)(?=元|块|[\s（(]|$)/u);
  if(amount)return {value:Number(amount[1]),state:'confirmed',quote};
  // Only explicitly denied employee deductions may be zero. No account / no payslip is not zero.
  const zeroAfter=/^(?:[:：\s]|是|为)*(?:没有(?:扣款|扣钱)?|没(?:有)?扣(?:款|钱)?|未扣(?:除|款)?|不扣(?:款|钱)?|无(?:扣款)?|零(?:元)?)(?:了|的)?$/u.test(body);
  const zeroBefore=/没(?:有)?扣(?:除)?\s*$/u.test(prefix)&&body==='' || key==='other'&&/(?:没有|无)\s*$/u.test(prefix)&&body==='';
  if(deduction(key)&&(zeroAfter||zeroBefore))return {value:0,state:'confirmed',quote};
  return {value:null,state:'unknown',quote};
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
