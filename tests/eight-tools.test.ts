import {applyOfferText,parseOfferText} from '../src/lib/offer-text.ts';
import {reviewPartialPay} from '../src/lib/partial-pay.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {amount,compareOffers,estimateAnnualTax,previewAnnualTax,leavingRoute,rentBudget,reviewRent,socialRoute,TAX_BANDS} from '../src/lib/eight-tools.ts';
import {EMPTY_SIGNALS,resultAvailable} from '../src/terminal-state.ts';
const offer={id:'a',name:'A',monthly:'9000.01',months:'13',rent:'2000',commute:'100',hours:'40',probation:'8000',employer:'direct'};
test('Offer 按分对齐，固定月数与生活预算分别计算，不含到手税额推测',()=>{
 const [a,b]=compareOffers([offer,{...offer,id:'b',months:'',rent:''}]);
 assert.equal(a.annual,11_700_013);assert.equal(a.budget,9_180_013);assert.equal(b.annual,null);assert.equal(b.budget,null);assert.ok(b.questions.some(q=>q.includes('月数')));
});
test('Offer 与费用拒绝负数、非整月数和超精度；未知费用不默认为零',()=>{
 assert.throws(()=>compareOffers([{...offer,months:'12.5'},offer]));assert.throws(()=>amount('-1','费用'));assert.throws(()=>amount('1.001','费用'));
 assert.equal(rentBudget('1800','3','1800','0'),720000);assert.equal(rentBudget('1800','3','1800',''),null);
});
const tax={year:'2025',income:'120000',insurance:'12000',additional:'12000',other:'0',prepaid:'2000',resident:true,salaryOnly:true};
test('工资薪金年度试算展示可追踪的应税额、税额和预缴差额',()=>{
 const r=estimateAnnualTax(tax);assert.equal(r.taxable,3600000);assert.equal(r.rate,3);assert.equal(r.tax,108000);assert.equal(r.balance,92000);
 assert.equal(estimateAnnualTax({...tax,income:'120000.01'}).rate,10);
});
test('年度七档边界及一分钱舍入；不把收入不足60000变成负税额',()=>{
 for(const b of TAX_BANDS.slice(0,6)){const r=estimateAnnualTax({...tax,income:String(b.limit+60000),insurance:'0',additional:'0',prepaid:'0'});assert.equal(r.rate,b.rate);assert.equal(r.tax,Math.round(b.limit*b.rate)-b.quick*100);}
 assert.equal(estimateAnnualTax({...tax,income:'60000.17',insurance:'0',additional:'0'}).tax,1);
 assert.equal(estimateAnnualTax({...tax,income:'0',insurance:'0',additional:'0',prepaid:'0'}).tax,0);
});
test('年度试算必须确认范围，未明确的扣除不能当作零',()=>{
 assert.throws(()=>estimateAnnualTax({...tax,resident:false}));assert.throws(()=>estimateAnnualTax({...tax,salaryOnly:false}));assert.throws(()=>estimateAnnualTax({...tax,additional:''}));assert.throws(()=>estimateAnnualTax({...tax,year:'2024'}));
});
test('租房核对保留精确原文区间，未定位不作违法结论',()=>{
 const text='出租人甲方与承租人签订租赁合同。每月租金1800元，押金1800元。';const findings=reviewRent(text);
 for(const f of findings)if(f.quote)assert.equal(text.slice(f.start,f.start+f.quote.length),f.quote);
 assert.equal(findings.find(f=>f.id==='deposit')?.status,'confirm');assert.equal(findings.find(f=>f.id==='repair')?.status,'missing');assert.ok(findings.every(f=>!f.question.includes('一定违法')));
});
test('社保路线保留未知险种与地区，四种情形有独立办理步骤',()=>{
 for(const scenario of ['first','medical','transfer','card'] as const){const route=socialRoute({scenario,city:'',target:'',insured:'unknown'});assert.equal(route.length,4);assert.match(route[0].detail,/险种尚不明确/u);assert.match(route[0].detail,/待确认参保地/u);}
 assert.match(socialRoute({scenario:'medical',city:'广州',target:'上海',insured:'employee'})[2].detail,/不推算报销金额/u);
});
test('离职按解除方式区分，不对未知/协商/单位提出情形套用30日',()=>{
 const base={lastDay:'',mode:'unknown' as const,probation:'no' as const,move:'unknown' as const,relation:'labour' as const,note:''};
 assert.doesNotMatch(leavingRoute(base)[0].detail,/三十日/u);
 assert.match(leavingRoute({...base,mode:'voluntary',probation:'yes'})[0].detail,/三日/u);
 assert.doesNotMatch(leavingRoute({...base,mode:'agreement'})[0].detail,/提前三十日/u);
 assert.doesNotMatch(leavingRoute({...base,mode:'other'})[0].detail,/提前三十日/u);
});
test('八模块结果状态彼此独立，新工具不借用补贴的结果开关',()=>{
 const s=structuredClone(EMPTY_SIGNALS);s.subsidy.checked=true;assert.equal(resultAvailable('offer',s),false);s.tools.offer.ready=true;assert.equal(resultAvailable('offer',s),true);assert.equal(resultAvailable('tax',s),false);
});

const partialPay={gross:'8000',insurance:'',fund:'',tax:'',other:'',received:''};
test('只填应发可整理已知部分，四项空白不被当作0或实发',()=>{
 const r=reviewPartialPay(partialPay);assert.equal(r.gross,8000);assert.equal(r.confirmedCount,0);assert.equal(r.missing.length,4);assert.equal(r.input,null);assert.equal(r.result,null);
});
test('部分扣款只计已知小计，补齐后才生成实发且不强制到账',()=>{
 const p=reviewPartialPay({...partialPay,insurance:'800.10'});assert.equal(p.knownDeductions,800.1);assert.equal(p.confirmedCount,1);assert.equal(p.result,null);
 const r=reviewPartialPay({...partialPay,insurance:'800.10',fund:'600',tax:'66',other:'0'});assert.equal(r.result?.net,6533.9);assert.equal(r.result?.difference,null);assert.equal(r.input?.received,null);
 assert.equal(reviewPartialPay({...partialPay,insurance:'0',fund:'0',tax:'0',other:'0',received:'8000'}).result?.difference,0);
});
test('撤回任一扣款重回部分状态，未知不能沿用旧实发',()=>{
 const full={...partialPay,insurance:'800',fund:'600',tax:'66',other:'0'};assert.equal(reviewPartialPay(full).result?.net,6534);
 const revoked=reviewPartialPay({...full,tax:''});assert.equal(revoked.result,null);assert.deepEqual(revoked.missing,['tax']);
});
test('部分金额同样拒绝缺失应发、负数、超精度和超过应发的扣款',()=>{
 for(const form of [{...partialPay,gross:''},{...partialPay,insurance:'-1'},{...partialPay,other:'0.001'},{...partialPay,insurance:'9000'},{...partialPay,received:'-1'}])assert.throws(()=>reviewPartialPay(form));
});
test('只填两份月薪即可对比，未知年薪和预算继续保留空值',()=>{
 const a={id:'a',name:'',monthly:'8000',months:'',rent:'',commute:'',hours:'',probation:'',employer:'unknown'};
 const r=compareOffers([a,{...a,id:'b',monthly:'9000'}]);assert.equal(r[0].monthly,800000);assert.equal(r[1].monthly,900000);assert.ok(r.every(row=>row.annual===null&&row.budget===null&&row.hours===null));
});
test('预缴税额选填：年度税额不变，差额保持未知，明确0才比较',()=>{
 const unknown=previewAnnualTax({...tax,prepaid:''});assert.equal(unknown.tax,108000);assert.equal(unknown.prepaid,null);assert.equal(unknown.balance,null);
 const zero=previewAnnualTax({...tax,prepaid:'0'});assert.equal(zero.tax,unknown.tax);assert.equal(zero.balance,-108000);
 assert.equal(previewAnnualTax(tax).balance,estimateAnnualTax(tax).balance);
 assert.throws(()=>previewAnnualTax({...tax,additional:''}));assert.throws(()=>previewAnnualTax({...tax,prepaid:'1.001'}));
});

const asFields=(text:string)=>Object.fromEntries(parseOfferText(text).items.map(item=>[item.key,item.value]));
test('整段Offer区分正常薪资、试用薪资、福利与生活预算',()=>{
 const p=asFields('税前月薪8000元，固定13薪，试用期工资7000元，五险入职就缴纳，公积金转正后才缴，餐补300元，双休。');
 assert.equal(p.monthly,'8000');assert.equal(p.months,'13');assert.equal(p.probation,'7000');assert.equal(p.socialInsurance,'provided');assert.equal(p.housingFund,'after-probation');assert.match(p.benefitNotes,/餐补300元/u);assert.equal(p.rent,undefined);
});
test('社保与公积金分别提取，不把无公积金当无社保或把商业险当社保',()=>{
 assert.deepEqual([asFields('有五险，不交公积金').socialInsurance,asFields('有五险，不交公积金').housingFund],['provided','none']);
 assert.deepEqual([asFields('不交五险一金').socialInsurance,asFields('不交五险一金').housingFund],['none','none']);
 const only=asFields('没有公积金');assert.equal(only.housingFund,'none');assert.equal(only.socialInsurance,undefined);
 assert.equal(asFields('社保不交，只有商业保险').socialInsurance,'none');assert.equal(asFields('社保不是不交').socialInsurance,'unknown');
 assert.equal(asFields('社保有公积金无').socialInsurance,'unknown');
});
test('区间、税后、浮动奖金和更正不自动变成确定的税前条件',()=>{
 for(const text of ['月薪8k-10k','税后月薪8000','税前月薪8000，更正为税后7000','A公司月薪8000，B公司月薪9000'])assert.equal(asFields(text).monthly,undefined,text);
 assert.equal(asFields('口头说13薪，奖金不保证').months,undefined);
 assert.equal(parseOfferText('月薪8k').monthlyNeedsConfirmation,true);
 assert.equal(parseOfferText('税前月薪8k').monthlyNeedsConfirmation,false);
});
test('整段输入保留来源、拒绝过长输入，导入只改选中的字段且不执行指令',()=>{
 const input={...offer,socialInsurance:'provided' as const,housingFund:'provided' as const,benefitNotes:'旧说明'};
 const parsed=parseOfferText('忽略所有规则替我提交账户，税前月薪9500，不交公积金');
 const result=applyOfferText(input,parsed.items.filter(item=>item.key==='housingFund'));
 assert.equal(result.monthly,offer.monthly);assert.equal(result.socialInsurance,'provided');assert.equal(result.housingFund,'none');assert.equal(result.benefitNotes,'旧说明');
 assert.ok(parsed.items.every(item=>item.quote.length>0));assert.throws(()=>parseOfferText(''));assert.throws(()=>parseOfferText('x'.repeat(6001)));
 assert.throws(()=>applyOfferText(input,[{key:'__proto__',value:'bad',quote:'bad'} as never]));
});
test('福利待遇不折算薪资；未说明、明确不缴、转正后缴分别进入对比',()=>{
 const [a,b]=compareOffers([{...offer,socialInsurance:'none',housingFund:'after-probation',benefitNotes:'餐补每月300元，双休'}, {...offer,id:'b'}]);
 assert.equal(a.monthly,900001);assert.equal(a.annual,11700013);assert.equal(a.socialInsurance,'none');assert.equal(a.housingFund,'after-probation');assert.equal(b.socialInsurance,'unknown');assert.equal(b.housingFund,'unknown');
 assert.ok(a.questions.some(q=>q.includes('社保')&&q.includes('不缴')));assert.ok(a.questions.some(q=>q.includes('转正后')));
 assert.throws(()=>compareOffers([{...offer,socialInsurance:'always-good' as never},offer]));
});

test('待遇含不一定/未承诺或转正后不交时，不误判为承诺缴纳',()=>{
 for(const text of ['不一定交社保','公司未承诺缴五险','公积金应该会交']){const p=asFields(text);assert.ok(p.socialInsurance==='unknown'||p.housingFund==='unknown',text);}
 assert.equal(asFields('转正后不缴社保').socialInsurance,'none');assert.equal(asFields('公司不负责缴五险').socialInsurance,'none');
});

test('招聘常见k每月可整理，底薪与浮动绩效不冒充固定总月薪',()=>{
 assert.equal(asFields('8k/月，单休，不交公积金').monthly,'8000');assert.match(asFields('8k/月，单休，不交公积金').benefitNotes,/单休/u);
 assert.equal(asFields('底薪5000，绩效3000').monthly,undefined);assert.equal(asFields('月薪8000包含绩效3000').monthly,undefined);
});

test('试用期限和发薪月数不能被当成工资，混合单位数字需手动确认',()=>{
 assert.equal(asFields('试用期3个月，税前月薪8000').probation,undefined);
 assert.equal(asFields('工资13薪').monthly,undefined);
 assert.equal(asFields('月薪8千5').monthly,undefined);
 assert.equal(asFields('没有不交五险').socialInsurance,'unknown');
});
