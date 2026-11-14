export const PDF_LIMITS={bytes:8*1024*1024,pages:30,characters:60000};
export type PdfTextResult={text:string;pages:number;emptyPages:number[]};
type TextItem={str:string;hasEOL?:boolean};
/** Preserve PDF reading order and line boundaries; never infer missing text. */
export function pdfPageText(items:unknown[]):string{
 return items.filter((item):item is TextItem=>!!item&&typeof item==='object'&&'str' in item&&typeof item.str==='string')
  .map(item=>item.str+(item.hasEOL?'\n':' ')).join('').replace(/[ \t]+\n/g,'\n').trim();
}
