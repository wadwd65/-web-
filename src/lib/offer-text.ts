import {amount} from './eight-tools.ts';
import type {OfferInput,OfferBenefitStatus} from './eight-tools.ts';

export type OfferTextField=Exclude<keyof OfferInput,'id'>;
export const OFFER_TEXT_LABELS:Record<OfferTextField,string>={name:'机会名称',monthly:'正常税前月薪',months:'固定发薪月数',probation:'试用期月薪',rent:'每月住房预算',commute:'每月通勤预算',hours:'每周工时',employer:'签约关系',socialInsurance:'社保 / 五险',housingFund:'住房公积金',benefitNotes:'福利及缴费说明'};
export type OfferTextItem={key:OfferTextField;value:string;quote:string};
/** Conservative, local text extraction. The user reviews every imported field. */
export function parseOfferText(raw:string){
 const text=raw.trim();if(!text)throw new Error('先粘贴招聘说明，或用一段话说说这份工作的条件。');if(text.length>6000)throw new Error('一次最多整理6000字，请只保留这一份工作的说明。');
 const items:OfferTextItem[]=[],warnings:string[]=[];
 if(/更正|撤回|改口|说错|作废|改为/u.test(text))return {items,warnings:['这段包含更正或撤回。请只保留最终确认的条件，或交给AI继续梳理，本次不沿用旧数字。'],monthlyNeedsConfirmation:false};
 const markers=[/A\s*公司|公司\s*A|甲公司|第一家/iu,/B\s*公司|公司\s*B|乙公司|第二家/iu];
 if(markers.every(pattern=>pattern.test(text))||/两份\s*(?:offer|工作)|另一家公司|分别是/iu.test(text))return {items,warnings:['这段可能包含多份工作。请一次只贴一份，避免把不同公司的条件混在一起。'],monthlyNeedsConfirmation:false};
 const normalized=text.replace(/(?<!\d)\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)/gu,value=>value.replaceAll(',',''));
 const clauses=normalized.split(/[，,。；;\n]|但是|不过|但/gu).map(value=>value.trim()).filter(Boolean);
 function push(key:OfferTextField,value:string,quote:string){items.push({key,value,quote});}
 function money(key:OfferTextField,pattern:RegExp,eligible:(clause:string)=>boolean=()=>true){
  const found:{value:string;quote:string}[]=[];
  for(const clause of clauses){
   if(!eligible(clause))continue;const match=pattern.exec(clause);if(!match)continue;
   if(/\d\s*(?:[kKwW万千]|元)?\s*[-~～至到]\s*\d|大概|大约|约\d|左右|起步|起薪|面议/u.test(clause)){warnings.push(`${OFFER_TEXT_LABELS[key]}含区间或约数，请手动确认具体值。`);continue;}
   const suffix=clause.slice(match.index+match[0].length);
   if(/^\s*(?:薪|个月|天|%|％)/u.test(suffix)||/^[kKwW万千]/u.test(match[2]??'')&&/^\d/u.test(suffix)){warnings.push(`${OFFER_TEXT_LABELS[key]}的数字口径不明确，请手动确认。`);continue;}
   const unit=match[2]??match[4]??'',factor=/[wW万]/u.test(unit)?10000:/[kK千]/u.test(unit)?1000:1;
   const value=Number(match[1]??match[3])*factor;
   try{amount(String(value),OFFER_TEXT_LABELS[key]);}catch{warnings.push(`${OFFER_TEXT_LABELS[key]}的数字未能可靠读取，请手动填写。`);continue;}
   found.push({value:String(value),quote:clause});
  }
  const unique=new Set(found.map(value=>value.value));
  if(unique.size>1&&!/更正|改为|改口/u.test(found.at(-1)!.quote)){warnings.push(`${OFFER_TEXT_LABELS[key]}出现多个数字，暂不选择其中一个。`);return;}
  const last=found.at(-1);if(last)push(key,last.value,last.quote);
 }
 const number='\\s*(?:是|为|[:：])?\\s*[¥￥]?\\s*(\\d+(?:\\.\\d+)?)\\s*([kKwW万千])?';
 money('monthly',new RegExp('(?:正常税前月薪|税前月薪|正常月薪|转正(?:后)?(?:月薪|工资)|月薪|每月工资|薪资|工资)'+number+'|(\\d+(?:\\.\\d+)?)\\s*([kKwW万千])?\\s*(?:元)?\\s*[/／]\\s*月','u'),clause=>{
  if(/税后|到手/u.test(clause)){if(/月薪|工资|薪资/u.test(clause))warnings.push('税后或到手金额不能直接当作税前月薪，本次不填这项。');return false;}
  if(/基本工资|底薪|(?:含|包含|其中).{0,12}(?:绩效|奖金)/u.test(clause)){warnings.push('基本工资或含浮动部分的薪资需要确认组成，本次不直接当作固定税前月薪。');return false;}
  return !/试用|实习|更正.{0,8}\d.{0,10}\d/u.test(clause);
 });
 money('probation',new RegExp('试用(?:期)?(?:税前)?(?:月薪|工资|薪资)'+number,'u'),clause=>!/税后|到手/u.test(clause));
 money('rent',new RegExp('(?:每月住房预算|住房预算|每月房租|房租|月租)'+number,'u'),clause=>!/补贴|房补|报销/u.test(clause));
 money('commute',new RegExp('(?:通勤预算|通勤支出|每月通勤费|通勤费)'+number,'u'),clause=>!/补贴|报销/u.test(clause));
 const salaryMonths=clauses.filter(clause=>/\d+\s*薪/u.test(clause));
 if(salaryMonths.length===1){const clause=salaryMonths[0],match=/(\d{2})\s*薪/u.exec(clause);if(match&&Number(match[1])>=12&&Number(match[1])<=24&&!/不保证|视绩效|看绩效|浮动|可能|口头|最高|最多|至|-|～/u.test(clause))push('months',match[1],clause);else warnings.push('发薪月数尚不明确，奖金或浮动部分没有计入固定年薪。');}
 else if(salaryMonths.length>1)warnings.push('出现多种发薪月数，请手动确认固定部分。');
 const hours=clauses.filter(clause=>/(?:每周|周工时)\s*\d+(?:\.\d+)?\s*(?:个)?小时/u.test(clause));
 if(hours.length===1){const match=/(?:每周|周工时)\s*(\d+(?:\.\d+)?)\s*(?:个)?小时/u.exec(hours[0]);if(match&&Number(match[1])>0&&Number(match[1])<=168)push('hours',match[1],hours[0]);}
 const name=/(?:公司名称|公司名|机会名称)\s*[:：]\s*([^，。；;\n]{1,40})/u.exec(text);if(name)push('name',name[1].trim(),name[0]);
 function status(clause:string):OfferBenefitStatus{
  if(/不清楚|不知道|不确定|不一定|不保证|未明确|未承诺|没承诺|未说明|没说|未知|待确认|可能|或许|好像|应该|是否|听说|据说|不是不|并非不|没有不|[?？]/u.test(clause))return 'unknown';
  if(/不(?:交|缴|买|提供)|公司不.{0,6}(?:交|缴)|不.{0,6}由公司.{0,2}(?:交|缴)|没有|不含|不包|不予|取消|无(?:社保|五险|公积金|一金)|(?:社保|五险|公积金|一金)\s*无|^无/u.test(clause))return 'none';
  if(/转正后|试用期(?:满|后)|过了试用/u.test(clause)&&/交|缴|买|提供/u.test(clause))return 'after-probation';
  if(/部分|只交|只缴|仅交|仅缴/u.test(clause))return 'partial';
  if(/不|未|没|无/u.test(clause))return 'unknown';
  if(/缴|交|购买|提供|都有|有五险|有社保|有公积金|有一金|含五险|含社保|含公积金/u.test(clause))return 'provided';
  return 'unknown';
 }
 const insurance=/五险|六险|七险|社保|社会保险/u,fund=/公积金|一金/u;
 for(const [key,pattern] of [['socialInsurance',insurance],['housingFund',fund]] as const){
  const relevant=clauses.filter(clause=>pattern.test(clause));if(!relevant.length)continue;
  const last=relevant.at(-1)!;
  // Independent insurance/fund claims need punctuation; never let one negation affect both.
  const linked=/五险一金|六险一金|七险一金|社保[和及、与]公积金/u.test(last);
  const ambiguous=insurance.test(last)&&fund.test(last)&&!linked;
  const value=ambiguous?'unknown':status(last);push(key,value,last);
  if(ambiguous)warnings.push('社保和公积金的表述挤在同一句里，请分别确认是否缴纳。');
 }
 const benefitNotes=clauses.filter(clause=>/社保|五险|公积金|一金|基数|缴费|缴存|餐补|饭补|交通补|房补|住宿|包吃|包住|年假|双休|单休|轮休|调休|带薪|大小周|加班|年终奖|绩效|奖金|商业保险|补贴|补助/u.test(clause)).join('；');
 if(benefitNotes)push('benefitNotes',benefitNotes.slice(0,1000),benefitNotes.slice(0,1000));
 const monthly=items.find(item=>item.key==='monthly'),monthlyNeedsConfirmation=!!monthly&&!/税前/u.test(monthly.quote);
 if(monthlyNeedsConfirmation)warnings.push('原文未明确税前口径，确认是正常税前月薪后再填入。');
 if(!items.length)warnings.push('这段暂时没有可可靠提取的字段，可以继续补一句，或直接问AI。');
 return {items,warnings:[...new Set(warnings)],monthlyNeedsConfirmation};
}

export function applyOfferText(current:OfferInput,items:OfferTextItem[]):OfferInput{
 const next={...current};for(const item of items){if(!Object.hasOwn(OFFER_TEXT_LABELS,item.key))throw new Error('未知的Offer字段。');Object.assign(next,{[item.key]:item.value});}
 return next;
}
