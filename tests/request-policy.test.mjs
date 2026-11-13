import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startPreview} from '../tools/serve.mjs';
import {createRequestPolicy} from '../tools/request-policy.mjs';
import {createAssistantMiddleware} from '../tools/assistant-gateway.mjs';
import {createAccountMiddleware,createAccountStore} from '../tools/account-service.mjs';
import {createImageMiddleware} from '../tools/contract-image.mjs';

const req=(host,origin,method='POST')=>({headers:{host,...(origin?{origin}:{})},method});
test('a whitespace public origin cannot open an external listener',()=>{
 const directory=mkdtempSync(join(tmpdir(),'first-step-host-')),previous=process.env.FIRST_STEP_PUBLIC_ORIGIN;
 try{
  mkdirSync(join(directory,'dist'));writeFileSync(join(directory,'dist/index.html'),'synthetic');writeFileSync(join(directory,'package.json'),JSON.stringify({version:'synthetic'}));
  process.env.FIRST_STEP_PUBLIC_ORIGIN=' ';
  assert.throws(()=>startPreview({directory,host:'0.0.0.0',port:5186}),/PUBLIC_ORIGIN/);
 }finally{if(previous===undefined)delete process.env.FIRST_STEP_PUBLIC_ORIGIN;else process.env.FIRST_STEP_PUBLIC_ORIGIN=previous;unlinkSync(join(directory,'dist/index.html'));unlinkSync(join(directory,'package.json'));rmdirSync(join(directory,'dist'));rmdirSync(directory);}
});
test('local access stays same-origin and malformed or external hosts cannot borrow local access',()=>{
 const policy=createRequestPolicy({publicOrigin:''});
 for(const host of ['localhost:5186','127.0.0.1:5186','[::1]:5186'])assert.equal(policy.allows(req(host,`http://${host}`)),true);
 for(const host of ['localhost@evil.example','localhost/evil','evil.example','localhost?x',''])assert.equal(policy.allows(req(host)),false);
 assert.equal(policy.allows(req('localhost:5186','https://evil.example')),false);
});
test('public origin accepts one HTTPS site and requires an exact Origin for mutations',()=>{
 const policy=createRequestPolicy({publicOrigin:'https://trial.example/'});assert.equal(policy.secure,true);
 assert.equal(policy.allows(req('trial.example','https://trial.example')),true);
 assert.equal(policy.allows(req('trial.example',undefined,'GET')),true);
 for(const value of [req('trial.example'),req('evil.example','https://trial.example'),req('trial.example','http://trial.example'),req('trial.example','https://trial.example.evil'),req('localhost','https://trial.example')])assert.equal(policy.allows(value),false);
 assert.equal(policy.allows({...req('evil.example','https://evil.example'),headers:{host:'evil.example',origin:'https://evil.example','x-forwarded-host':'trial.example','x-forwarded-proto':'https'}}),false);
 for(const publicOrigin of ['http://trial.example','https://user:password@trial.example','https://trial.example/path','https://trial.example/?x','https://trial.example/#x','*'])assert.throws(()=>createRequestPolicy({publicOrigin}));
});
test('the assistant, image and account HTTP entries all use the configured site policy',async()=>{
 const policy=createRequestPolicy({publicOrigin:'https://trial.example'}),store=createAccountStore({file:':memory:'});
 const assistant=createAssistantMiddleware({policy,config:{apiKey:'',model:'synthetic'}}),account=createAccountMiddleware({policy,store}),image=createImageMiddleware({policy,config:{apiKey:''}});
 const server=http.createServer((req,res)=>{if(!account(req,res)&&!image(req,res)&&!assistant(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 // Use the real HTTP transport with a preserved proxy Host. fetch can rewrite Host.
 const send=(path,options={})=>new Promise((resolve,reject)=>{
  const client=http.request(base+path,options,response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:{get:name=>String(response.headers[name.toLowerCase()]??'')},json:async()=>JSON.parse(Buffer.concat(chunks).toString('utf8'))}));});
  client.on('error',reject);client.end(options.body);
 });
 const post=(path,body,host='trial.example',origin='https://trial.example')=>send(path,{method:'POST',headers:{Host:host,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await send('/api/v1/assistant/status',{headers:{Host:'trial.example'}})).status,200);
  for(const path of ['/api/v1/assistant/chat','/api/v1/contract/extract-image','/api/v1/account/register']){
   assert.equal((await post(path,{},'evil.example')).status,403);
   assert.equal((await post(path,{},'trial.example','https://evil.example')).status,403);
   assert.equal((await post(path,{})).status===403,false);
  }
  const response=await post('/api/v1/account/register',{username:'trial_account',password:'synthetic-trial-password'});
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);
  assert.doesNotMatch(JSON.stringify(await response.json()),/password|token/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));store.close();}
});

test('existing hosted proxy aliases still require the configured Origin and reject suffix lookalikes',()=>{
 const policy=createRequestPolicy({publicOrigin:'https://trial.example'});
 for(const host of ['preview.cloudstudio.club','project.workbuddy.host','project.workbuddy.host:443']){
  assert.equal(policy.allows(req(host,'https://trial.example')),true);
  assert.equal(policy.allows(req(host,'https://evil.example')),false);
  assert.equal(policy.allows(req(host)),false);
 }
 for(const host of ['cloudstudio.club.evil.example','project.workbuddy.host.evil','workbuddy.host','localhost'])assert.equal(policy.allows(req(host,'https://trial.example')),false);
});
