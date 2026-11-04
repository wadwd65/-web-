export type DraftModule='contract'|'salary'|'subsidy'|'offer'|'tax'|'social'|'rent'|'leaving'|'chat';
export type DraftEnvelope={schema:1;module:DraftModule;savedAt:string;data:unknown};
type Check=(value:unknown)=>boolean;
const text=(max:number):Check=>value=>typeof value==='string'&&value.length<=max;
const oneOf=(...values:string[]):Check=>value=>typeof value==='string'&&values.includes(value);
const flag:Check=value=>typeof value==='boolean';
function record(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function fields(shape:Record<string,Check>):Check {
  return value=>record(value)&&Object.keys(value).length===Object.keys(shape).length&&Object.entries(shape).every(([key,check])=>check(value[key]));
}
const marks:Check=value=>record(value)&&Object.keys(value).length<=30&&Object.entries(value).every(([key,item])=>key.length<=80&&flag(item));
const notes:Check=value=>record(value)&&Object.keys(value).length<=30&&Object.entries(value).every(([key,item])=>key.length<=80&&text(1500)(item));
const offer=fields({id:text(100),name:text(100),monthly:text(50),months:text(50),rent:text(50),commute:text(50),hours:text(50),probation:text(500),employer:text(400)});
const social=fields({scenario:oneOf('first','medical','transfer','card'),city:text(30),target:text(30),insured:oneOf('employee','resident','unknown')});
const leaving=fields({lastDay:text(20),mode:oneOf('voluntary','agreement','other','unknown'),probation:oneOf('yes','no','unknown'),move:oneOf('same','cross','unknown'),relation:oneOf('labour','unknown'),note:text(1500)});
const checks:Record<DraftModule,Check>={
  contract:fields({text:text(60000),months:text(50),probation:text(50),scope:oneOf('unknown','fulltime','other'),filename:text(1024),sample:flag}),
  salary:fields({form:fields({gross:text(50),insurance:text(50),fund:text(50),tax:text(50),other:text(50),received:text(50)}),demo:flag}),
  subsidy:fields({schoolCity:text(100),inGraduatingYear:oneOf('yes','no','unknown'),supportCondition:oneOf('loan','low_income','disability','none','unknown'),claimedBefore:oneOf('yes','no','unknown')}),
  offer:fields({form:value=>Array.isArray(value)&&value.length>=2&&value.length<=3&&value.every(offer)&&new Set(value.map(item=>item.id)).size===value.length,sample:flag}),
  tax:fields({form:fields({income:text(50),insurance:text(50),additional:text(50),other:text(50),prepaid:text(50),resident:flag,salaryOnly:flag,year:oneOf('2025','2026')}),sample:flag}),
  social:fields({form:social,generated:flag,done:marks,notes}),
  rent:fields({text:text(30000),fees:fields({monthly:text(50),period:text(50),deposit:text(50),fee:text(50)}),sample:flag}),
  leaving:fields({form:leaving,generated:flag,done:marks,notes}),
  chat:fields({input:text(6000),turns:value=>Array.isArray(value)&&value.length<=150&&value.every(fields({role:oneOf('user','assistant'),content:text(20000)}))}),
};

export function draftKey(owner:string,module:DraftModule):string {
  return `first-step:draft:v1:${encodeURIComponent(owner)}:${module}`;
}
export function encodeDraft(module:DraftModule,data:unknown,now=new Date().toISOString()):string {
  if(!checks[module](data))throw Error('这份填写内容超出可保存范围，请精简后重试。');
  const raw=JSON.stringify({schema:1,module,savedAt:now,data});
  if(raw.length>200000)throw Error('这份草稿较大，请先导出并精简。');
  return raw;
}
export function decodeDraft(module:DraftModule,raw:string):DraftEnvelope {
  if(raw.length>200000)throw Error('保存的草稿过大，暂时无法恢复。');
  let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('保存的草稿无法读取，可以重新保存本页内容。');}
  if(!record(value)||value.schema!==1||value.module!==module||typeof value.savedAt!=='string'||!Number.isFinite(Date.parse(value.savedAt))||!checks[module](value.data))throw Error('保存的草稿版本或内容不兼容，请重新保存。');
  return value as DraftEnvelope;
}

/** Each page has a separate slot. A stale page cannot silently replace a newer saved draft. */
export function writeDraft(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,key:string,expected:string|null,next:string|null):void {
  if(storage.getItem(key)!==expected)throw Error('另一页面更新了这份草稿，请重新查看后再操作。');
  if(next===null)storage.removeItem(key);else storage.setItem(key,next);
}
