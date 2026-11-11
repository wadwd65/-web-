import {amount} from './eight-tools.ts';
import {calculatePayslip} from './wages.ts';
import type {PayslipInput} from './wages.ts';

export const PAY_DEDUCTIONS=['insurance','fund','tax','other'] as const;
const labels={insurance:'个人社保扣款',fund:'个人公积金扣款',tax:'已扣个人所得税',other:'其他扣款'};
export type PayDraft=Record<keyof PayslipInput,string>;
/** Unknown deductions remain null; a subtotal is never labelled take-home pay. */
export function reviewPartialPay(form:PayDraft){
 const gross=amount(form.gross,'应发工资')!;
 const entries=PAY_DEDUCTIONS.map(key=>({key,value:amount(form[key],labels[key],true)}));
 const missing=entries.filter(item=>item.value===null).map(item=>item.key);
 const known=entries.reduce((sum,item)=>sum+(item.value??0),0);
 if(known>gross)throw new Error('已填扣款合计超过应发工资，请核对金额。');
 const received=amount(form.received,'实际到账',true);
 const input:PayslipInput|null=missing.length?null:{gross:gross/100,insurance:entries[0].value!/100,fund:entries[1].value!/100,tax:entries[2].value!/100,other:entries[3].value!/100,received:received===null?null:received/100};
 return {gross:gross/100,knownDeductions:known/100,confirmedCount:4-missing.length,missing,input,result:input?calculatePayslip(input):null};
}
