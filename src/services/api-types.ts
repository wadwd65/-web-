import type {ExperienceModule} from '../experience-modules.ts';

export type BusinessModule=ExperienceModule['id'];
export type ApiEnvelope<T>={requestId:string;data:T};
export type Capabilities={schemaVersion:1;supportedModules:BusinessModule[];documentReview:boolean;ocr:boolean;rag:boolean;agent:boolean};
export type DocumentReviewRequest={module:'contract'|'rent';text:string;region:string|null;confirmed?:Record<string,string|number|boolean|null>};
export type EvidenceSpan={start:number;end:number;text:string};
export type ApiCitation={id:string;title:string;url:string;region:string|null;verifiedAt:string};
export type DocumentReview={schemaVersion:1;findings:{id:string;title:string;status:'noted'|'needs-confirmation'|'missing-information';evidence:EvidenceSpan|null;sourceIds:string[]}[];questions:string[];citations:ApiCitation[];limitations:string[]};
export type UploadConsent={transmitConfirmed:true;signal?:AbortSignal};
