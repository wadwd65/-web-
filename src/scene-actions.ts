export type SceneAction='open'|'material'|'result'|'list'|'sources';
export type SceneInteraction=(index:number,action:SceneAction,detail?:string)=>void;
export const PART_LABELS=[
  {module:0,part:0,label:'机会 A 条件',action:'material',detail:'offer-0'},
  {module:0,part:1,label:'机会 B 条件',action:'material',detail:'offer-1'},
  {module:0,part:2,label:'对比结果',action:'result'},
  {module:1,part:0,label:'合同原文',action:'material'},
  {module:1,part:1,label:'核对依据',action:'sources'},
  {module:1,part:2,label:'询问清单',action:'list'},
  {module:2,part:0,label:'应发工资',action:'material',detail:'gross'},
  {module:2,part:1,label:'个人扣款',action:'result',detail:'deductions'},
  {module:2,part:2,label:'计算实发',action:'result',detail:'net'},
  {module:3,part:0,label:'全年金额',action:'material'},
  {module:3,part:1,label:'税额公式',action:'result'},
  {module:3,part:2,label:'税务依据',action:'sources'},
  {module:4,part:0,label:'办理情形',action:'material'},
  {module:4,part:1,label:'办理路线',action:'result'},
  {module:4,part:2,label:'个人进度',action:'result'},
  {module:4,part:3,label:'办理依据',action:'sources'},
  {module:5,part:0,label:'租房原文',action:'material'},
  {module:5,part:1,label:'条款与费用',action:'result'},
  {module:5,part:2,label:'租房询问',action:'list'},
  {module:6,part:0,label:'学校所在地',action:'material',detail:'condition-0'},
  {module:6,part:1,label:'毕业学年',action:'material',detail:'condition-1'},
  {module:6,part:2,label:'支持情形',action:'material',detail:'condition-2'},
  {module:6,part:3,label:'申领记录',action:'material',detail:'condition-3'},
  {module:6,part:4,label:'材料与申报',action:'sources'},
  {module:7,part:0,label:'离职情形',action:'material'},
  {module:7,part:1,label:'交接事项',action:'result'},
  {module:7,part:2,label:'证明与结算',action:'result'},
  {module:7,part:3,label:'保障转接依据',action:'sources'},
  {module:7,part:4,label:'待确认清单',action:'list'},
] as const;
/** UV coordinates refer to the real material face, not a screen-sized click overlay. */
export function faceAction(u:number,v:number,module=-1,reviewed=false):SceneAction|null {
  const x=u*1280,y=(1-v)*900;
  if(x<65||x>1190)return null;
  if(y>=155&&y<=290)return 'open';
  if(y>=760&&y<=850)return x<425?'material':x<795?'result':'list';
  if(y>=405&&y<=475)return 'material';
  if(y>=495&&y<=565){if(module===1&&!reviewed)return x<275?'material':x<465?'sources':'list';return 'result';}
  if(y>=585&&y<=650)return module===2?'result':'sources';
  return null;
}
