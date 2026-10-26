export type PayslipInput = {
  gross: number;
  insurance: number;
  fund: number;
  tax: number;
  other: number;
  received: number | null;
};

export type PayslipResult = {
  net: number;
  deductions: number;
  /** Actual received amount minus calculated net; positive means received more. */
  difference: number | null;
};

function cents(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label}必须是有效金额。`);
  }
  if (value < 0) throw new RangeError(`${label}不能为负数。`);
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result)) throw new RangeError(`${label}超出可精确核对的金额范围。`);
  // Tolerate representation noise (e.g. 0.1 + 0.2), not real sub-cent amounts.
  const tolerance = Number.EPSILON * Math.max(1, value) * 4;
  if (Math.abs(value - result / 100) > tolerance) {
    throw new RangeError(`${label}最多填写两位小数。`);
  }
  return result;
}

/**
 * Reconcile user-provided payslip amounts in integer cents.
 * No tax rates, contribution rates, benefits, or salary parameters are inferred.
 * Insurance and fund inputs mean the employee deductions shown on the payslip.
 */
export function calculatePayslip(input: PayslipInput): PayslipResult {
  const gross = cents(input.gross, '应发工资');
  const deductions = cents(input.insurance, '个人社保扣款')
    + cents(input.fund, '个人公积金扣款')
    + cents(input.tax, '个税扣款')
    + cents(input.other, '其他扣款');
  if (!Number.isSafeInteger(deductions)) throw new RangeError('扣款合计超出可精确核对的金额范围。');
  if (deductions > gross) throw new RangeError('扣款合计超过应发工资，请核对金额和扣款口径。');
  const net = gross - deductions;
  const received = input.received === null ? null : cents(input.received, '实际到账');
  return {
    net: net / 100,
    deductions: deductions / 100,
    difference: received === null ? null : (received - net) / 100,
  };
}
