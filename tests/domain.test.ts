import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeContract, DEMO_CONTRACT } from '../src/lib/contracts.ts';
import { calculatePayslip } from '../src/lib/wages.ts';
import { evaluateSubsidy } from '../src/lib/policies.ts';
import type { PolicyInput } from '../src/lib/policies.ts';

function probation(contractMonths: number | null, probationMonths: number | null, text = '本合同为固定期限劳动合同。试用期由双方核对。') {
  const result = analyzeContract({ text, contractMonths, probationMonths }).find((item) => item.id === 'probation');
  assert.ok(result);
  return result;
}

test('试用期区间包含3个月、12个月、36个月边界且上限不算超出', () => {
  const intervals = [
    [3, 1], [11.99, 1], [12, 2], [35.99, 2], [36, 6], [120, 6],
  ];
  for (const [months, maximum] of intervals) {
    assert.equal(probation(months, maximum).status, 'noted', `期限 ${months}、试用 ${maximum}`);
    assert.equal(probation(months, maximum + 0.01).status, 'attention', `期限 ${months}超上限`);
    assert.match(probation(months, maximum).summary, new RegExp(`上限为${maximum}个月`));
  }
});

test('不足3个月、任务期限、无固定期限合同明确转待确认', () => {
  assert.equal(probation(2.99, 1).status, 'missing');
  assert.match(probation(2, 1).summary, /不得约定试用期/u);
  for (const text of ['本合同为无固定期限劳动合同。试用期六个月。', '本合同以完成一定工作任务为期限。试用期一个月。']) {
    const result = probation(36, 6, text);
    assert.equal(result.status, 'missing');
    assert.match(result.summary, /待确认/u);
  }
});

test('期限确认值缺失或无效时不从合同文字猜数字', () => {
  for (const [months, trial] of [[null, 3], [12, null], [-1, 1], [0, 1], [NaN, 1], [12, -1], [12, Infinity]] as const) {
    assert.equal(probation(months, trial, DEMO_CONTRACT).status, 'missing');
  }
  assert.equal(probation(12, 0).status, 'noted');
});

test('合成示例的试用期、地点和违约金被列为核对项，引用确实来自原文', () => {
  const results = analyzeContract({ text: DEMO_CONTRACT, contractMonths: 12, probationMonths: 3 });
  for (const id of ['probation', 'location', 'penalty']) {
    assert.equal(results.find((item) => item.id === id)?.status, 'attention');
  }
  for (const item of results) {
    if (item.quote) assert.ok(DEMO_CONTRACT.includes(item.quote));
    assert.match(item.source, /^https:\/\/www\.samr\.gov\.cn\//u);
  }
  const penalty = results.find((item) => item.id === 'penalty');
  assert.match(penalty?.summary ?? '', /专项培训服务期或竞业限制/u);
  assert.match(results.find((item) => item.id === 'scope')?.summary ?? '', /本地|在线模型/u);
});

test('缺少条款只报告本次文本未定位，不断言合同违法', () => {
  const results = analyzeContract({ text: '双方订立固定期限劳动合同。', contractMonths: 12, probationMonths: 0 });
  for (const id of ['location', 'pay', 'hours', 'insurance']) {
    const item = results.find((result) => result.id === id);
    assert.equal(item?.status, 'missing');
    assert.equal(item?.quote, '');
    assert.doesNotMatch(item?.summary ?? '', /已经违法|合同违法|合法有效/u);
  }
  const empty = analyzeContract({ text: '  ', contractMonths: 12, probationMonths: 1 });
  assert.equal(empty[0].id, 'contract-text');
  assert.equal(empty[0].status, 'missing');
  assert.equal(empty.some((item) => item.id === 'probation'), false);
});

test('具体工作地点与不承担违约金的表述不会被当作明确收费疑点', () => {
  const results = analyzeContract({ text: '工作地点：广州市天河区示例路1号。乙方正常离职无需支付违约金。', contractMonths: 12, probationMonths: 1 });
  assert.equal(results.find((item) => item.id === 'location')?.status, 'noted');
  assert.equal(results.find((item) => item.id === 'penalty')?.status, 'noted');
});

const payslip = { gross: 8000, insurance: 800.35, fund: 400.15, tax: 72.53, other: 0, received: null };

test('工资核对按分运算，实际到账与核对净额差额方向明确', () => {
  assert.deepEqual(calculatePayslip(payslip), { net: 6726.97, deductions: 1273.03, difference: null });
  assert.equal(calculatePayslip({ ...payslip, received: 6700 }).difference, -26.97);
  assert.equal(calculatePayslip({ ...payslip, received: 6750 }).difference, 23.03);
  assert.equal(calculatePayslip({ ...payslip, received: 6726.97 }).difference, 0);
});

test('小额小数不会留下浮点尾差，零到账和未填到账不同', () => {
  assert.deepEqual(calculatePayslip({ gross: 0.3, insurance: 0.1, fund: 0.2, tax: 0, other: 0, received: 0 }), { net: 0, deductions: 0.3, difference: 0 });
  assert.deepEqual(calculatePayslip({ gross: 0.1 + 0.2, insurance: 0, fund: 0, tax: 0, other: 0, received: null }), { net: 0.3, deductions: 0, difference: null });
  assert.equal(calculatePayslip({ ...payslip, received: 0 }).difference, -6726.97);
});

test('工资核对拒绝负数、NaN、Infinity、分以下精度、超范围以及超额扣款', () => {
  for (const key of ['gross', 'insurance', 'fund', 'tax', 'other', 'received']) {
    for (const value of [-0.01, NaN, Infinity, 0.001]) {
      assert.throws(() => calculatePayslip({ ...payslip, [key]: value }), undefined, `${key}=${value}`);
    }
  }
  assert.throws(() => calculatePayslip({ ...payslip, insurance: 8000 }), /超过应发工资/u);
  assert.throws(() => calculatePayslip({ ...payslip, gross: Number.MAX_VALUE }), /范围/u);
});

const eligible: PolicyInput = { schoolCity: '广州', inGraduatingYear: 'yes', supportCondition: 'loan', claimedBefore: 'no' };

test('广州初筛匹配仅返回可能符合，金额是3000元政策参考标准', () => {
  for (const supportCondition of ['loan', 'low_income', 'disability'] as const) {
    const result = evaluateSubsidy({ ...eligible, supportCondition });
    assert.equal(result.status, 'potential');
    assert.equal(result.amount, 3000);
    assert.match(result.title, /可能/u);
    assert.ok(result.requirements.some((item) => item.status === 'unknown'));
    assert.match(result.deadlineNote, /未给出具体申报起止日期/u);
    assert.match(result.source, /^https:\/\/rsj\.gz\.gov\.cn\//u);
    assert.equal(result.applicationUrl, 'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home');
  }
});

test('关键条件未知保留待补信息，不猜资格或金额', () => {
  for (const input of [
    { ...eligible, schoolCity: '' },
    { ...eligible, inGraduatingYear: 'unknown' as const },
    { ...eligible, supportCondition: 'unknown' as const },
    { ...eligible, claimedBefore: 'unknown' as const },
  ]) {
    const result = evaluateSubsidy(input);
    assert.equal(result.status, 'needs-info');
    assert.equal(result.amount, null);
  }
});

test('重复申领、不在毕业学年、未具有列示条件分别显示未匹配', () => {
  for (const input of [
    { ...eligible, claimedBefore: 'yes' as const },
    { ...eligible, inGraduatingYear: 'no' as const },
    { ...eligible, supportCondition: 'none' as const },
  ]) {
    const result = evaluateSubsidy(input);
    assert.equal(result.status, 'not-matched');
    assert.equal(result.amount, null);
    assert.ok(result.requirements.some((item) => item.status === 'unmet'));
  }
});

test('外地学校返回规则未覆盖，不推断全国不能领', () => {
  for (const schoolCity of ['深圳', '北京市', '广州市附近']) {
    const result = evaluateSubsidy({ ...eligible, schoolCity });
    assert.equal(result.status, 'unsupported');
    assert.equal(result.amount, null);
    assert.match(result.title, /暂未接入/u);
  }
  assert.equal(evaluateSubsidy({ ...eligible, schoolCity: ' 广东省广州市 ' }).status, 'potential');
  assert.equal(evaluateSubsidy({ ...eligible, schoolCity: '未知' }).status, 'needs-info');
});
