import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryFact,salaryFacts,salaryValueGrounded,asksSalaryFirstStep} from '../src/lib/salary-evidence.ts';
import {salaryOutcome,salaryQuestionText} from '../src/lib/salary-review.ts';
import {salaryQuestion,isQuestionEvidence,sameQuestion,questionExport} from '../src/lib/checklist.ts';
import type {SalaryField} from '../src/lib/salary-evidence.ts';

test('explicit spoken amounts and unit abbreviations work without guessing ranges or omitted units',()=>{
 for(const [phrase,value] of [['八千五百元',8500],['一千零五元',1005],['一百二十三元',123],['一万零三元',10003],['一万二千元',12000],['零点八元',.8],['8.5k',8500],['0.7千元',700],['.85万元',8500],['1.00001千元',1000.01],['10.01元',10.01],['180元不变',180],['一百八十元不变',180]] as const){
  assert.equal(salaryFact('应发'+phrase,'gross').value,value,phrase);
  assert.equal(salaryValueGrounded(value,'应发'+phrase,'gross'),true,phrase);
 }
 for(const phrase of ['八千五','一百二','一万二千五','一万二','八五元','8000元到9000元','8千至9千','8000~9000元','8000元以上','8000元起','1.234元','-10元','1e4元','0.000001千元']){
  assert.equal(salaryFact('应发'+phrase,'gross').value,null,phrase);
 }
 const text='应发八千五百元，社保七百元，公积金五百元，个税八十元，其他扣款没有，实际到账七千二百二十元。';
 assert.equal(salaryFact(text,'received').value,7220);
 assert.equal(salaryFact(text+'\n应发不知道，撤回原数','gross').value,null);
 assert.equal(salaryFact(text+'\n应发8000元到9000元','gross').value,null);
 assert.equal(salaryFact('公司社保七百元','insurance').value,null);
});

test('task mentions and unchanged references cannot replace a confirmed salary fact',()=>{
  assert.equal(salaryFact('银行卡实际到账8600元。帮我核对实发和差额。','received').value,8600);
  assert.equal(salaryValueGrounded(8600,'银行卡实际到账8600元。帮我核对实发和差额。','received'),true);
  const text='个人社保950元，个人公积金800元，个税180元。\n更正：应发11500元，社保、公积金和个税不变，请重新核对实发。';
  for(const [key,value] of [['insurance',950],['fund',800],['tax',180]] as const)assert.equal(salaryFact(text,key).value,value);
  assert.equal(salaryFact('社保800元，确认社保不变？','insurance').value,null,'a question is not a confirmation');
  assert.equal(salaryFact('公积金600元，公积金不确定，先撤回','fund').value,null);
  assert.equal(salaryFact('个税180元，个税没有扣款','tax').value,0);
  assert.equal(salaryFact('个人社保950元，后来个人社保900元','insurance').value,900);
  assert.equal(salaryFact('个税不变','tax').value,null,'unchanged without earlier evidence is not a value');
});

test('confirmed absence, unknowns, corrections and employee amounts stay distinct',()=>{
  const cases:[string,SalaryField,number|null][]=[
    ['其他扣款没有','other',0],['其他扣款为零元','other',0],['无其他扣款','other',0],['社保800、公积金600、个税100','insurance',800],['社保¥800元','insurance',800],['社保800元左右','insurance',null],['大概社保800元','insurance',null],['没扣个税100元','tax',null],['其它扣款：没有扣款','other',0],['没有其他扣款','other',0],
    ['社保没扣','insurance',0],['公积金未扣款','fund',0],['没扣个税','tax',0],
    ['其他扣款没有明细','other',null],['其他扣款不知道','other',null],['其他扣款可能没有','other',null],
    ['其他扣款不是没有','other',null],['其他扣款没有？我不确定','other',null],
    ['没有社保账户','insurance',null],['公司社保800','insurance',null],
    ['其他扣款没有，后来其他扣款50元','other',50],['个税66元\n个税不清楚，先撤回','tax',null],
    ['社保800元\n个人社保900元','insurance',900],['应发工资9,000.50元','gross',9000.5],
    ['其他扣款-10元','other',null],['其他扣款1.234元','other',null],['实际到账没有','received',null],
    ['公积金600元个税100元','fund',600],['社保800公积金600其他扣款没有？','insurance',800],['其他扣款不是0，是50元','other',null],
  ];
  for(const [text,key,value] of cases)assert.equal(salaryFact(text,key).value,value,text);
  assert.equal(salaryValueGrounded(0,'其他扣款没有','other'),true);
  assert.equal(salaryValueGrounded(0,'其他扣款不知道','other'),false);
  assert.equal(salaryValueGrounded(0,'其他扣款没有\n其他扣款还没确认','other'),false);
});

test('confirmed current income components survive corrections and explicit zero replaces a withdrawn amount',()=>{
  const original='基本工资8460元，绩效1250元，加班费470元，津贴180元，奖金340元，个人社保620元，个人公积金500元，个税210元，其他扣款100元，实际到账9020元。';
  const text=original+'\n更正：奖金应是540元，其他扣款应是40元，到账应是9040元。\n撤回加班费470元，那是上月的，本月明确没有加班费，其余不变。';
  const facts=salaryFacts(text);
  assert.equal(facts.other.value,40);
  assert.equal(facts.received.value,9040);
  assert.equal(facts.gross.value,10430);
  assert.equal(salaryValueGrounded(10430,text,'gross'),true);
  const input=Object.fromEntries(Object.entries(facts).map(([key,fact])=>[key,fact.value])) as {gross:number;insurance:number;fund:number;tax:number;other:number;received:number|null};
  assert.equal(salaryOutcome(input).result.net,9060);
});

test('explicit shared absence completes income while unknown personal deductions stay unknown',()=>{
  const text='基本工资7200元，绩效、加班费、津贴、奖金、其他扣款本月确实都没有，个人社保、公积金、个税未知，到账6450元仅对照。';
  const facts=salaryFacts(text);
  assert.equal(facts.gross.value,7200);
  assert.equal(facts.other.value,0);
  for(const key of ['insurance','fund','tax'] as const)assert.equal(facts[key].value,null,key);
  assert.equal(salaryValueGrounded(6450,text,'gross'),false,'bank receipt cannot stand in for gross');
});

test('component totals require all five current facts and never override direct gross evidence',()=>{
  const complete='基本工资5000元，绩效600元，加班费100元，津贴200元，奖金300元。';
  assert.equal(salaryFact(complete,'gross').value,6200);
  for(const suffix of ['绩效未知。','确认绩效未知。','绩效先撤回。','撤回绩效600元。','绩效600元是上月的。','绩效600元是上一个月的。','绩效应是600元？']){
    assert.equal(salaryFact(complete+'\n'+suffix,'gross').value,null,suffix);
  }
  assert.equal(salaryFact('基本工资5000元，绩效600元，加班费100元，津贴200元。','gross').value,null,'missing bonus is not zero');
  assert.equal(salaryFact(complete+'\n应发工资6500元。','gross').value,6500);
  assert.equal(salaryFact(complete+'\n税前工资未知。','gross').value,null,'explicitly unknown gross is not silently replaced');
  assert.equal(salaryFact(complete+'\n应发6200元，撤回应发6200元。','gross').value,null,'withdrawn direct gross is not resurrected');
  assert.equal(salaryFact(complete+'\n应发工资不是6200元。','gross').value,null,'conflicting direct gross cannot use a component fallback');
  assert.equal(salaryFact(complete+'\n绩效应是800元，其余不变。','gross').value,6400);
  assert.equal(salaryFact(complete+'\n绩效、加班费、津贴和奖金不变。','gross').value,6200);
  assert.equal(salaryFact(complete+'\n绩效、津贴未知。','gross').value,null,'shared unknown withdraws previous values');
  assert.equal(salaryFact('基本工资5000元，绩效、加班费、津贴、奖金100元。','gross').value,null,'a shared positive amount is not assigned to every item');
  assert.equal(salaryFact('基本工资5000元，绩效奖金600元，加班费100元，津贴200元。','gross').value,null,'performance bonus cannot double as the separate bonus');
  assert.equal(salaryFact('基本工资5000.11元，绩效600.22元，加班费100.33元，津贴200.44元，奖金300.55元。','gross').value,6201.65);
  assert.equal(salaryFact('基本工资没有，绩效、加班费、津贴和奖金均没有。','gross').value,0);
  assert.equal(salaryFact('基本工资5000元，绩效、加班费、津贴、奖金可能都没有。','gross').value,null);
});

test('an amount difference has a direction and a missing bank amount stays unchecked',()=>{
  const base={gross:9000,insurance:800,fund:600,tax:100,other:0,received:7450};
  assert.equal(salaryOutcome(base).headline,'实际到账少了 ¥50.00');
  assert.equal(salaryOutcome({...base,received:7550}).headline,'实际到账多了 ¥50.00');
  assert.equal(salaryOutcome({...base,received:7500}).status,'matched');
  assert.equal(salaryOutcome({...base,received:null}).status,'unchecked');
  assert.match(salaryQuestionText(base),/7,500.00.*7,450.00.*少了 ¥50.00/);
  assert.ok(asksSalaryFirstStep('只知道应发9000，我应该从哪一步开始？'));
});

test('saved salary questions hold their own immutable inputs through editing, export and later calculations',()=>{
  const input={gross:9000,insurance:800,fund:600,tax:100,other:0,received:7450};
  const draft=salaryQuestion(input,{id:'synthetic-pay-1',at:'2026-11-06T08:00:00Z',demo:false});
  input.gross=9500;
  assert.ok(isQuestionEvidence(draft.evidence));
  const saved={...draft,id:'saved-1',done:false,text:'请解释这笔差额',answer:'等待本期明细'};
  const output=questionExport([saved]);
  for(const part of ['9,000.00','7,500.00','7,450.00','少了 ¥50.00','原核对建议','等待本期明细'])assert.ok(output.includes(part),part);
  assert.ok(!output.includes('9,500.00'));
  assert.equal(sameQuestion(draft,saved),true);
  assert.equal(sameQuestion(draft,salaryQuestion(input,{id:'synthetic-pay-2',at:'2026-11-06T09:00:00Z',demo:false})),false);
  assert.equal(isQuestionEvidence({...draft.evidence,input:{...input,other:10000}}),false);
  assert.equal(isQuestionEvidence({...draft.evidence,input:{...input,tax:-1}}),false);
});
