/** Guangzhou HRSS FAQ published 2026-02-11; checked 2026-10-26. */
const SOURCE = 'https://rsj.gz.gov.cn/zmhd/cjwt/ldbz/content/post_10677608.html';
const APPLICATION_URL = 'https://ggfw.hrss.gd.gov.cn/employment/internet/portal/#/home';
const DEADLINE_NOTE = '依据广州市人社局2026-02-11常见问题，核验日期2026-10-26。该页未给出具体申报起止日期，也未单列政策生效日；请在广东公共就业服务云平台及学校当期通知核对是否开放、申报期和材料要求，不能据此认定当前可申报。';

export type PolicyInput = {
  schoolCity: string;
  inGraduatingYear: 'yes' | 'no' | 'unknown';
  /** low_income includes the official listed hardship categories, not low income alone. */
  supportCondition: 'loan' | 'low_income' | 'disability' | 'none' | 'unknown';
  claimedBefore: 'yes' | 'no' | 'unknown';
};

export type PolicyResult = {
  status: 'potential' | 'not-matched' | 'needs-info' | 'unsupported';
  /** Policy reference amount for a potential match; never an approved payment. */
  amount: number | null;
  title: string;
  requirements: {
    label: string;
    status: 'met' | 'unmet' | 'unknown';
    detail: string;
  }[];
  source: string;
  applicationUrl: string;
  deadlineNote: string;
};

function flag(value: string): 'yes' | 'no' | 'unknown' {
  return value === 'yes' || value === 'no' ? value : 'unknown';
}

/**
 * A limited screening of one Guangzhou policy using self-reported answers.
 * 'none' must mean no condition in the official list, not merely no visible shortcut.
 * School type, evidence, and the current application window remain unverified.
 */
export function evaluateSubsidy(input: PolicyInput): PolicyResult {
  const city = typeof input.schoolCity === 'string' ? input.schoolCity.trim().replace(/\s/gu, '') : '';
  const cityUnknown = !city || /^(?:未知|不确定|待确认|unknown)$/iu.test(city);
  const inGuangzhou = /^(?:广东(?:省)?)?广州市?$/u.test(city);
  const graduating = flag(input.inGraduatingYear);
  const claimed = flag(input.claimedBefore);
  const support = ['loan', 'low_income', 'disability', 'none'].includes(input.supportCondition)
    ? input.supportCondition : 'unknown';

  const supportDetails: Record<string, string> = {
    loan: '你填报曾获得国家助学贷款；还需按官方要求核对对应助学贷款材料，不将其他商业贷款视为同类条件。',
    low_income: '你自述属于官方列示的困难情形。范围包括低保家庭、残疾人家庭、脱贫人口家庭、特困职工家庭成员及特困人员；一般收入较低不自动等同于这些类别，需核对证明或系统核验结果。',
    disability: '你自述符合残疾相关情形，需核对本人或家庭成员对应的官方类别、有效证明与学校审核要求。',
    none: '你填报不符合官方列示的任何情形。若属于脱贫人口家庭、特困人员等其他列示类别，请重新核对后修改，不能只按本页快捷选项排除。',
    unknown: '需确认是否具有官方列示的困难家庭、特困人员、残疾或曾获国家助学贷款等情形，并准备相应核验材料。',
  };

  const requirements: PolicyResult['requirements'] = [
    {
      label: '学校位于广州市',
      status: cityUnknown ? 'unknown' : inGuangzhou ? 'met' : 'unmet',
      detail: cityUnknown ? '请填写学校所在城市；工作地、户籍地或现居地不能替代。'
        : inGuangzhou ? '你填报学校位于广州，仍需通过学籍和学校信息核对。'
          : `你填报学校位于${city}。本原型只维护广州这一项政策，其他地区需要查询当地规定。`,
    },
    {
      label: '处于毕业学年', status: graduating === 'unknown' ? 'unknown' : graduating === 'yes' ? 'met' : 'unmet',
      detail: graduating === 'yes' ? '你填报目前处于毕业学年，需要与学校确认学年和申报批次。'
        : graduating === 'no' ? '该项补贴面向毕业学年的学生，你填报当前不处于毕业学年。'
          : '“已经毕业”与“处于毕业学年”不是同一条件，请向学校确认当前学年。',
    },
    {
      label: '具有官方列示的支持情形', status: support === 'unknown' ? 'unknown' : support === 'none' ? 'unmet' : 'met',
      detail: supportDetails[support],
    },
    {
      label: '此前未成功申领过该补贴', status: claimed === 'unknown' ? 'unknown' : claimed === 'yes' ? 'unmet' : 'met',
      detail: claimed === 'yes' ? '你填报曾申领过。官方说明为一次性补贴，不可重复申领，跨本科与研究生学制也不能重复。'
        : claimed === 'no' ? '你填报此前未成功申领，仍需核对历史申领记录。'
          : '需确认是否在当前或此前学制成功申领过该项补贴；仅提交过申请但未获批时，应核对办理结果。',
    },
    {
      label: '学校类型、证明材料和申报期', status: 'unknown',
      detail: '本次尚未核验学校是否属于普通高校、中等职业学校或技工院校，也未审核证明材料和当前申报期。即使上述自述条件匹配，仍仅是可能符合，最终以主管部门及学校核验为准。',
    },
  ];

  const base = { requirements, source: SOURCE, applicationUrl: APPLICATION_URL, deadlineNote: DEADLINE_NOTE };
  if (!cityUnknown && !inGuangzhou) {
    return { ...base, status: 'unsupported', amount: null, title: '该地区暂未接入补贴规则' };
  }
  const screening = requirements.slice(0, 4);
  if (screening.some((requirement) => requirement.status === 'unmet')) {
    return { ...base, status: 'not-matched', amount: null, title: '当前填报有条件未匹配，请逐项核对' };
  }
  if (screening.some((requirement) => requirement.status === 'unknown')) {
    return { ...base, status: 'needs-info', amount: null, title: '补充信息后才能进行初筛' };
  }
  return { ...base, status: 'potential', amount: 3000, title: '可能符合广州求职创业补贴初筛条件' };
}
