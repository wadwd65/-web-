import test from 'node:test';
import assert from 'node:assert/strict';
import {salaryFact,salaryValueGrounded,asksSalaryFirstStep} from '../src/lib/salary-evidence.ts';
import {salaryOutcome,salaryQuestionText} from '../src/lib/salary-review.ts';
import {salaryQuestion,isQuestionEvidence,sameQuestion,questionExport} from '../src/lib/checklist.ts';
import type {SalaryField} from '../src/lib/salary-evidence.ts';

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
