export type ContractSignal = { characters:number; reviewed:boolean; unresolved:number|null; items:number };
export type SalarySignal = { gross:number|null; net:number|null; deductions:number|null };
export type SubsidySignal = { checked:boolean; status:'potential'|'not-matched'|'needs-info'|'unsupported'|null; states:('met'|'unmet'|'unknown')[] };
export type ToolId='offer'|'tax'|'social'|'rent'|'leaving';
export type ToolSignal={ready:boolean;items:number;pending:number;summary:string;lines:string[];values?:(number|null)[]};
export const EMPTY_TOOL:ToolSignal={ready:false,items:0,pending:0,summary:'等待填写材料',lines:[]};
export type TerminalSignals = { contract:ContractSignal; salary:SalarySignal; subsidy:SubsidySignal; tools:Record<ToolId,ToolSignal> };
export const EMPTY_SIGNALS:TerminalSignals={
  contract:{characters:0,reviewed:false,unresolved:null,items:0},
  salary:{gross:null,net:null,deductions:null},
  subsidy:{checked:false,status:null,states:[]},
  tools:{offer:{...EMPTY_TOOL},tax:{...EMPTY_TOOL},social:{...EMPTY_TOOL},rent:{...EMPTY_TOOL},leaving:{...EMPTY_TOOL}},
};
export function resultAvailable(id:string,s:TerminalSignals){return id==='contract'?s.contract.reviewed:id==='salary'?s.salary.net!==null:id==='subsidy'?s.subsidy.checked:s.tools[id as ToolId]?.ready??false;}
