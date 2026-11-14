import {cash,OFFER_BENEFIT_LABELS} from './eight-tools.ts';
import type {compareOffers} from './eight-tools.ts';

type OfferRow=ReturnType<typeof compareOffers>[number];
export type OfferMetric='monthly'|'annual'|'budget'|'hours';
export function offerSummary(rows:OfferRow[],metric:OfferMetric){
  const missing=rows.filter(row=>row[metric]===null);
  const labels={monthly:'税前月薪',annual:'明确税前年薪',budget:'减去住房通勤预算后的金额',hours:'每周工作时长'};
  if(missing.length)return {kind:'incomplete',headline:metric==='annual'?'年薪暂时还不能一起比':metric==='budget'?'先补齐预算，再看生活负担':'工时还没有填齐',detail:`${missing.map(row=>row.name).join('、')}还缺${metric==='annual'?'明确发薪月数':metric==='budget'?'发薪月数或住房、通勤预算':'每周工作时长'}。已知值保留，未填的不会算成 0。`,difference:null};
  if(rows.length<2)return {kind:'incomplete',headline:'再放一份机会，才能比较',detail:'保留已有条件，至少需要两份机会。',difference:null};
  const ordered=[...rows].sort((a,b)=>a[metric]!-b[metric]!),low=ordered[0],high=ordered.at(-1)!,difference=high[metric]!-low[metric]!;
  if(difference===0)return {kind:'equal',headline:`这几份${labels[metric]}一样`,detail:metric==='hours'?`都是每周 ${high.hours} 小时；休息和加班安排仍需核实。`:`都是 ¥ ${cash(high[metric]!)}${metric==='monthly'?' / 月':''}。这只是当前这一项相同，不代表整份待遇一样。`,difference};
  const headline=metric==='monthly'?`每月相差 ¥ ${cash(difference)}`:metric==='annual'?`税前年薪相差 ¥ ${cash(difference)}`:metric==='budget'?`减去生活预算后，相差 ¥ ${cash(difference)}`:`每周工时相差 ${Number(difference.toFixed(2))} 小时`;
  const detail=metric==='hours'?'只比较你填写的每周时长，数值更高不代表更好。休息与加班另行确认。':`${rows.length===2?`${high.name} 比 ${low.name}`:'最高与最低的已知条件'}${rows.length===2?'高出这一金额。':'有这个差额。'}${metric==='budget'?'这里仍是税前口径减已填生活预算，不是到手收入。':'这里只比较已填税前金额，奖金、税费和其他待遇另看。'}`;
  return {kind:'comparison',headline,detail,difference};
}

export function priorityOfferQuestions(rows:OfferRow[]){
  const questions:{id:string;title:string;detail:string;question:string}[]=[];
  const names=(items:OfferRow[])=>items.map(row=>row.name).join('、');
  const groups=(items:OfferRow[],key:(row:OfferRow)=>string)=>{const grouped=new Map<string,OfferRow[]>();for(const row of items){const id=key(row);grouped.set(id,[...(grouped.get(id)??[]),row]);}return [...grouped.values()];};
  const insurance=rows.filter(row=>row.socialInsurance!=='provided'||row.housingFund!=='provided');
  if(insurance.length){
    const statuses=[...new Set(insurance.flatMap(row=>[row.socialInsurance,row.housingFund]).filter(status=>status!=='provided'))].map(status=>OFFER_BENEFIT_LABELS[status]);
    const ask=(label:string,status:OfferRow['socialInsurance'])=>status==='provided'?'':status==='none'?`${label}已明确告知不缴，请说明原因和书面处理安排，并核对实际记录。`:`${label}${OFFER_BENEFIT_LABELS[status]}，请写明具体项目、起始月、缴费主体与基数。`;
    questions.push({id:'insurance',title:'五险一金的安排要先问清',detail:`${names(insurance)}：${statuses.join('、')}。把书面说法和实际记录分开核实。`,question:groups(insurance,row=>row.socialInsurance+'/'+row.housingFund).map(group=>`${names(group)}：${ask('社保',group[0].socialInsurance)}${ask('公积金',group[0].housingFund)}`).join('\n')});
  }
  const pay=rows.filter(row=>row.months===null||row.probation===null);
  if(pay.length)questions.push({id:'pay',title:'发薪月数和试用工资写清了吗？',detail:`${names(pay)}还缺部分薪资条件。先要书面说明，再比较全年收入。`,question:groups(pay,row=>String(row.months===null)+'/'+String(row.probation===null)).map(group=>`${names(group)}：请明确${[group[0].months===null?'固定发薪月数及奖金条件':null,group[0].probation===null?'试用期工资及组成':null].filter(Boolean).join('、')}。`).join('\n')});
  const employer=rows.filter(row=>!row.employer||row.employer==='unknown'||row.employer==='dispatch');
  if(employer.length)questions.push({id:'employer',title:'合同到底跟谁签？',detail:`${names(employer)}的签约主体或派遣关系需要再核实，别只看招聘方的名称。`,question:`${names(employer)}：请确认合同签约主体、实际用工单位，以及是否属于劳务派遣；已说明派遣的，请分别写明两方。`});
  const hours=rows.filter(row=>row.hours===null);
  if(hours.length)questions.push({id:'hours',title:'平时怎么上班、怎么休息？',detail:`${names(hours)}还没有确认工时，月薪相近时也值得先问清。`,question:`${names(hours)}：请明确每周工时、休息和加班安排，并核对书面约定。`});
  const budget=rows.filter(row=>row.rent===null||row.commute===null);
  if(budget.length)questions.push({id:'budget',title:'住房和通勤每月要花多少？',detail:`${names(budget)}的生活预算尚不完整，先保留未知。`,question:`${names(budget)}：请补齐每月住房和通勤预算；确认没有才填 0，不把未知当作没有开销。`});
  const benefits=rows.filter(row=>!row.benefitNotes);
  if(benefits.length)questions.push({id:'benefits',title:'其他福利有什么条件？',detail:`${names(benefits)}还没记录餐补、住宿或休假等条件。`,question:`${names(benefits)}：请确认餐补、住宿、休假等其他待遇的条件和书面约定。`});
  return questions.slice(0,3);
}
