import type {ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

export function FieldMark({kind='optional',children}:{kind?:'required'|'optional'|'conditional';children?:ReactNode}){
 return <span className="field-mark" data-kind={kind}>{children??(kind==='required'?'必填':kind==='conditional'?'按需补充':'选填')}</span>;
}
export function FormStart({children}:{children:ReactNode}){return <p className="form-start-note">{children}</p>;}
export function OptionalFields({title='补充信息',hint='选填，不影响先看结果',children}:{title?:string;hint?:string;children:ReactNode}){
 return <details className="optional-fields" onInvalidCapture={event=>{event.currentTarget.open=true;}}><summary><span>{title}<small>{hint}</small></span><ChevronDown size={16}/></summary><div>{children}</div></details>;
}
