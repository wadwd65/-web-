import test from 'node:test';
import assert from 'node:assert/strict';
import {amount,compareOffers,estimateAnnualTax,leavingRoute,rentBudget,reviewRent,socialRoute,TAX_BANDS} from '../src/lib/eight-tools.ts';
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
