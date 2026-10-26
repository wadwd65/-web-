/**
 * Local text rules, not an online model or a legal opinion.
 * Source: PRC Labor Contract Law, 2012 revision, articles 17/19/22/23/25.
 * Official text checked on 2026-10-26. Special contract types require review.
 */
const LAW_SOURCE = 'https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2023/art_0abfdd261c03417b949df19d869add8d.html';

export const DEMO_CONTRACT = `劳动合同示例（合成材料，仅供体验）
甲方：示例科技有限公司
乙方：示例毕业生
一、合同期限：本合同为固定期限劳动合同，期限为12个月。
二、试用期：试用期为3个月，包含在合同期限内。
三、工作内容与地点：乙方担任运营助理，工作地点按业务安排。
四、劳动报酬：乙方税前月工资为8000元，每月15日发放上月工资。
五、工作时间和休息休假：实行标准工时制度，休息休假按相关规定执行。
六、社会保险：双方按规定参加社会保险，个人承担部分由甲方代扣代缴。
七、普通离职约定：乙方普通离职须向甲方支付违约金8000元。
本示例未附专项培训服务期协议或竞业限制协议。`;

export type Finding = {
  id: string;
  title: string;
  status: 'attention' | 'missing' | 'noted';
  summary: string;
  quote: string;
  source: string;
  article: string;
  question: string;
  category: string;
};

type ContractInput = {
  text: string;
  contractMonths: number | null;
  probationMonths: number | null;
};

function finding(value: Omit<Finding, 'source'>): Finding {
  return { ...value, source: LAW_SOURCE };
}

/** Return an actual text fragment; never construct a quotation from form fields. */
function locate(text: string, pattern: RegExp): string {
  const clauses = text.match(/[^\n。；;]+[。；;]?/gu) ?? [];
  return clauses.find((clause) => pattern.test(clause))?.trim() ?? '';
}

function validMonths(value: number | null, allowZero: boolean): value is number {
  return typeof value === 'number' && Number.isFinite(value) && (allowZero ? value >= 0 : value > 0);
}

function checkProbation(input: ContractInput): Finding {
  const { text, contractMonths, probationMonths } = input;
  const quote = locate(text, /试用期/u);
  const specialType = /无固定期限|以完成.{0,18}(?:工作)?任务.{0,8}(?:为)?期限|以.{0,15}任务完成.{0,8}(?:为)?期限/u.test(text);

  if (specialType) {
    return finding({
      id: 'probation', category: '合同期限与试用期', status: 'missing',
      title: '先确认合同类型，再核对试用期',
      summary: '文本出现无固定期限或任务期限的表述，可能也只是模板中的备选项。本原型不把它代入普通固定期限月份规则；请确认实际选择的类型。第十九条对任务期限合同和无固定期限合同有不同规定，当前结果待确认。',
      quote: locate(text, /无固定期限|任务/u) || quote,
      article: '第十九条',
      question: '最终采用的是固定期限、无固定期限，还是以完成一定工作任务为期限的劳动合同？请标出已选中的条款。',
    });
  }

  if (!validMonths(contractMonths, false) || !validMonths(probationMonths, true)) {
    return finding({
      id: 'probation', category: '合同期限与试用期', status: 'missing',
      title: '合同期限或试用月份待确认',
      summary: '请按实际合同确认固定期限月数和试用期月数；没有约定试用期可填0。缺失、负数或非有限数值不会被猜成合同事实。本次文本规则不会从日期或零散数字自动推定期限。',
      quote, article: '第十九条',
      question: '这份合同的起止日期、折合期限和试用期分别是多少？试用期是否包含在合同期限内？',
    });
  }

  if (contractMonths < 3) {
    return finding({
      id: 'probation', category: '合同期限与试用期', status: 'missing',
      title: '不足3个月的合同需单独确认',
      summary: `你确认的合同期限为${contractMonths}个月，试用期为${probationMonths}个月。第十九条规定期限不满3个月的劳动合同不得约定试用期。本首版对短期合同标为待确认，请核对合同类型和期限，不能据此直接判断整份合同的效力。`,
      quote, article: '第十九条',
      question: '请确认合同是否确实不足3个月，以及是否另行约定了试用期。',
    });
  }

  const maximum = contractMonths < 12 ? 1 : contractMonths < 36 ? 2 : 6;
  const exceeds = probationMonths > maximum;
  return finding({
    id: 'probation', category: '合同期限与试用期', status: exceeds ? 'attention' : 'noted',
    title: exceeds ? '试用月份与对应区间上限有出入' : '已完成试用月份的区间对照',
    summary: `按你确认的普通固定期限${contractMonths}个月，对应试用期上限为${maximum}个月；你填写的试用期为${probationMonths}个月${exceeds ? '，超过该区间上限，请进一步核对' : '，未超过该区间上限'}。这只是确认值的区间对照，未核验是否重复约定试用期等其他事实，也不代表整份合同已通过审查。`,
    quote, article: '第十九条',
    question: exceeds
      ? `请说明约定${probationMonths}个月试用期的依据，并核对能否调整到与实际合同期限相对应的范围。`
      : '这是我在同一用人单位的第一次试用期吗？试用期是否包含在合同期限内？',
  });
}

function checkLocation(text: string): Finding {
  const quote = locate(text, /工作地点|工作场所|办公地点|工作地[为：:]/u);
  if (!quote) {
    return finding({
      id: 'location', category: '工作内容与地点', status: 'missing',
      title: '本次文本未定位到工作地点',
      summary: '第十七条列有工作内容和工作地点。本次文本规则未匹配到相应表述；可能存在于未提供的附件或其他表述中，不等于已经证实合同缺失该条款。',
      quote: '', article: '第十七条',
      question: '合同约定的主要工作城市和地点在哪里？是否另有工作地点附件？',
    });
  }
  const vague = /按.{0,8}(?:业务|公司|甲方|工作|经营).{0,8}(?:安排|需要)|根据.{0,10}(?:需要|安排)|另行通知|全国|服从.{0,8}(?:安排|调配)|以.{0,8}安排为准/u.test(quote);
  return finding({
    id: 'location', category: '工作内容与地点', status: vague ? 'attention' : 'noted',
    title: vague ? '工作地点及变动范围需要说清楚' : '已定位工作地点相关表述',
    summary: vague
      ? '定位到按安排、需要或较宽范围确定地点的表述。请确认主要工作地点、可能调整的范围及沟通方式；仅凭这类关键词不能判断条款效力。'
      : '已定位相关表述，仍请核对具体城市、地址及调整安排。找到关键词不代表所有地点条件都已明确。',
    quote, article: '第十七条',
    question: '我的主要工作城市和办公地点能否写明？如需跨城市或跨地点调整，会怎样协商确认？',
  });
}

function checkPenalty(text: string): Finding | null {
  const quote = locate(text, /违约金/u);
  if (!quote) return null;
  const explicitNoPenalty = /(?:无需|无须|不需|不必|不得|不)[^。；;\n]{0,6}(?:支付|承担|收取|约定)[^。；;\n]{0,6}违约金/u.test(quote);
  return finding({
    id: 'penalty', category: '离职与违约金', status: explicitNoPenalty ? 'noted' : 'attention',
    title: explicitNoPenalty ? '已定位违约金相关说明' : '违约金的适用情形需要核对',
    summary: '文本提到违约金。第二十五条将劳动者承担违约金的约定限定于第二十二条、第二十三条规定的情形，涉及专项培训服务期或竞业限制。应核对实际适用情形、相关协议和事实，不能把普通离职、保密义务或关键词本身直接等同于这些例外。',
    quote, article: '第二十二条、第二十三条、第二十五条',
    question: '这笔违约金具体对应专项培训服务期还是竞业限制？请提供相应协议、适用条件和金额依据，并说明普通离职是否涉及。',
  });
}

function checkPresence(text: string, config: {
  id: string; category: string; pattern: RegExp; name: string; detail: string; question: string;
}): Finding {
  const quote = locate(text, config.pattern);
  return finding({
    id: config.id, category: config.category, status: quote ? 'noted' : 'missing',
    title: quote ? `已定位${config.name}相关表述` : `本次文本未定位到${config.name}`,
    summary: quote
      ? `${config.detail}本次只做关键词定位，条款出现不等于内容完整或已实际履行。`
      : `第十七条列有${config.name}。本次文本规则未找到对应表述，请检查其他页面、附件或不同措辞；未找到不等于已经证实缺失。`,
    quote, article: '第十七条', question: config.question,
  });
}

export function analyzeContract(input: ContractInput): Finding[] {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  const scope = finding({
    id: 'scope', category: '核对范围', status: 'noted', title: '本次结果来自本地文本规则',
    summary: '尚未接入在线模型。仅定位已提供文字中的部分条款，并对用户确认的固定期限月份做区间对照；无法核实签署背景、附件、实际履行或条款整体效力。依据为中国大陆《劳动合同法》2012年修正全文，核验日期2026-10-26。',
    quote: '', article: '第十七条、第十九条、第二十二条、第二十三条、第二十五条',
    question: '提供的是完整的劳动合同吗？是否还有附件、补充协议或其他约定需要一并核对？',
  });
  if (!text) {
    return [finding({
      id: 'contract-text', category: '材料完整性', status: 'missing', title: '先补充合同文本',
      summary: '当前没有可核对的文字，暂不生成条款判断。请粘贴合同内容，或先使用已标明的合成示例。',
      quote: '', article: '第十七条', question: '请补充要核对的合同文字，隐去不必要的身份证号、住址等个人信息。',
    }), scope];
  }

  const findings: Finding[] = [checkProbation({ ...input, text }), checkLocation(text)];
  const penalty = checkPenalty(text);
  if (penalty) findings.push(penalty);
  findings.push(
    checkPresence(text, { id: 'pay', category: '劳动报酬', pattern: /劳动报酬|工资|薪资|薪酬|月薪/u, name: '劳动报酬', detail: '请核对税前金额、组成、支付周期和日期。', question: '约定金额是税前还是税后？固定工资、绩效与其他项目分别如何确定，何时发放？' }),
    checkPresence(text, { id: 'hours', category: '工作时间与休息', pattern: /工时|工作时间|休息休假|每周.{0,8}(?:天|小时)|每日.{0,8}小时/u, name: '工作时间和休息休假', detail: '请核对工时制度、工作安排和休息休假约定。', question: '适用哪种工时制度？日常工作时间、休息休假和加班安排在哪里说明？' }),
    checkPresence(text, { id: 'insurance', category: '社会保险', pattern: /社会保险|社保|养老保险|医疗保险|五险/u, name: '社会保险', detail: '请核对参保安排、开始时间及个人承担部分；条款不能证明实际参保状态。', question: '将从什么时候、在哪个城市参保？缴费基数及个人承担部分如何确定和查询？' }),
    scope,
  );
  const priority: Record<Finding['status'], number> = { attention: 0, missing: 1, noted: 2 };
  return findings.sort((a, b) => priority[a.status] - priority[b.status]);
}
