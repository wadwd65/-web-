import {calculatePayslip} from './wages.ts';
import type {PayslipInput} from './wages.ts';
export const formatMoney=(value:number)=>value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});

/** One statement shared by the first screen, exported record, and saved question. */
export function salaryOutcome(input:PayslipInput){
  const result=calculatePayslip(input),difference=result.difference;
  const status=difference===null?'unchecked':difference===0?'matched':difference<0?'less':'more';
  return {status,result,headline:difference===null?'算好了，再和银行到账核对':difference===0?'这笔到账与计算一致':`实际到账${difference<0?'少':'多'}了 ¥${formatMoney(Math.abs(difference))}`,
    next:difference===null?'实际到账还没填，暂时不能判断是否有差额。':difference===0?'金额对得上；缴费基数和扣款依据仍需按工资明细确认。':'先核实计薪期间和未列明的扣项；差额本身不说明扣错了。'};
}

export function salaryContext(input:PayslipInput):string {
  const {result,headline}=salaryOutcome(input);
  return `应发 ¥${formatMoney(input.gross)} − 个人社保 ¥${formatMoney(input.insurance)} − 个人公积金 ¥${formatMoney(input.fund)} − 个税 ¥${formatMoney(input.tax)} − 其他扣款 ¥${formatMoney(input.other)} = 计算实发 ¥${formatMoney(result.net)}；${input.received===null?'实际到账未填写':`填写的实际到账 ¥${formatMoney(input.received)}`}。${headline}。`;
}

export function salaryQuestionText(input:PayslipInput):string {
  const {status,result}=salaryOutcome(input);
  const opening=status==='less'||status==='more'?`我按工资条算得实发 ¥${formatMoney(result.net)}，实际到账 ¥${formatMoney(input.received!)}，${status==='less'?'少':'多'}了 ¥${formatMoney(Math.abs(result.difference!))}。`:status==='matched'?'这次工资到账与填写金额算得一致。':'我想核对这次工资的明细，实际到账暂未确认。';
  return `${opening}请问本次实际计薪期间、各项个人扣款的计算基数和承担比例分别是什么？能否提供完整明细，${status==='less'||status==='more'?'帮助确认这笔差额':'便于我核对'}？`;
}
