import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstStepApi,FirstStepApiError} from '../src/services/api-client.ts';

const code=(name:string)=>(error:unknown)=>error instanceof FirstStepApiError&&error.code===name;
const capabilities={schemaVersion:1,supportedModules:['contract','rent'],documentReview:true,ocr:false,rag:false,agent:false};
const original='合成材料：工作地点需要确认。';
const report={schemaVersion:1,findings:[{id:'f1',title:'请确认工作地点',status:'needs-confirmation',evidence:{start:5,end:9,text:'工作地点'},sourceIds:['s1']}],questions:['请明确具体工作地点。'],citations:[{id:'s1',title:'合成接口测试来源',url:'https://example.test/source',region:null,verifiedAt:'2026-10-30'}],limitations:['这是合成接口测试数据。']};
const input={module:'contract' as const,text:original,region:null};
const consent={transmitConfirmed:true as const};
const response=(data:unknown)=>new Response(JSON.stringify({requestId:'test-request',data}),{headers:{'Content-Type':'application/json'}});

test('an unconfigured API never sends materials or probes a default server',async()=>{
 let calls=0;const api=createFirstStepApi({fetcher:async()=>{calls++;return response(capabilities);}});
 assert.equal(api.configured,false);await assert.rejects(api.getCapabilities(),code('not-configured'));await assert.rejects(api.reviewDocument(input,consent),code('not-configured'));assert.equal(calls,0);
});

test('capabilities use the versioned backend and reject false capability shapes',async()=>{
 let address='',options:RequestInit|undefined;const api=createFirstStepApi({baseUrl:'/api/v1/',fetcher:async(url,init)=>{address=String(url);options=init;return response(capabilities);}});
 assert.equal((await api.getCapabilities()).data.ocr,false);assert.equal(address,'/api/v1/capabilities');assert.equal(options?.method,'GET');assert.equal(options?.cache,'no-store');
 const bad=createFirstStepApi({baseUrl:'/api/v1',fetcher:async()=>response({...capabilities,rag:'yes'})});await assert.rejects(bad.getCapabilities(),code('invalid-response'));
});

test('document review needs explicit consent and validates inputs before fetching',async()=>{
 let calls=0;const api=createFirstStepApi({baseUrl:'/api/v1',fetcher:async()=>{calls++;return response(report);}});
 await assert.rejects(api.reviewDocument(input,{transmitConfirmed:false} as never),code('invalid-input'));
 await assert.rejects(api.reviewDocument({...input,text:' '},consent),code('invalid-input'));
 await assert.rejects(api.reviewDocument(undefined as never,consent),code('invalid-input'));
 await assert.rejects(api.reviewDocument({...input,confirmed:{months:Infinity}},consent),code('invalid-input'));assert.equal(calls,0);
});

test('a valid review preserves exact original spans and sends only the declared request',async()=>{
 let body='';const api=createFirstStepApi({baseUrl:'https://example.test/api/v1',fetcher:async(url,init)=>{assert.equal(String(url),'https://example.test/api/v1/documents/review');assert.equal(init?.credentials,'same-origin');body=String(init?.body);return response(report);}});
 const result=await api.reviewDocument(input,consent);assert.equal(result.data.findings[0].evidence?.text,original.slice(5,9));assert.deepEqual(JSON.parse(body),input);
});

test('fabricated quotes, invalid offsets and undeclared source references are rejected',async()=>{
 for(const change of ['quote','offset','source']){const data=structuredClone(report);if(change==='quote')data.findings[0].evidence.text='不存在的条款';if(change==='offset')data.findings[0].evidence.end=60001;if(change==='source')data.findings[0].sourceIds=['absent'];const api=createFirstStepApi({baseUrl:'/api/v1',fetcher:async()=>response(data)});await assert.rejects(api.reviewDocument(input,consent),code('invalid-response'));}
});

test('HTTP and network failures expose safe errors without echoing response material',async()=>{
 const api=createFirstStepApi({baseUrl:'/api/v1',fetcher:async()=>new Response('private fixture content',{status:503,headers:{'X-Request-ID':'trace-123'}})});
 await assert.rejects(api.getCapabilities(),error=>error instanceof FirstStepApiError&&error.code==='http'&&error.status===503&&error.requestId==='trace-123'&&!error.message.includes('private fixture'));
 const offline=createFirstStepApi({baseUrl:'/api/v1',fetcher:async()=>{throw Error('internal fixture detail');}});await assert.rejects(offline.getCapabilities(),code('network'));
});

test('timeouts and caller cancellation abort the request without retrying',async()=>{
 let calls=0;const pending:typeof fetch=async(_url,init)=>{calls++;return new Promise((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true});});};
 const api=createFirstStepApi({baseUrl:'/api/v1',timeoutMs:15,fetcher:pending});await assert.rejects(api.getCapabilities(),code('timeout'));assert.equal(calls,1);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(api.getCapabilities(cancelled.signal),code('aborted'));assert.equal(calls,1);
 const controller=new AbortController(),work=api.getCapabilities(controller.signal);controller.abort();await assert.rejects(work,code('aborted'));assert.equal(calls,2);
});

test('API base URLs cannot carry executable schemes or query credentials',()=>{
 assert.throws(()=>createFirstStepApi({baseUrl:'javascript:bad'}),code('invalid-input'));assert.throws(()=>createFirstStepApi({baseUrl:'/api/v1?auth=placeholder'}),code('invalid-input'));
});
