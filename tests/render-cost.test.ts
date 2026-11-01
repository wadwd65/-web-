import test from 'node:test';
import assert from 'node:assert/strict';
import {createStyleWriter} from '../src/scene/style-writer.ts';
import {deferredAsset} from '../src/scene/deferred-asset.ts';

test('CSSOM normalization does not cause identical transforms to be written every frame',()=>{
 let writes=0,stored='';const style={};Object.defineProperty(style,'transform',{get:()=>stored,set:(value:string)=>{writes++;stored=value.replaceAll(',',', ');}});
 const node={style} as HTMLElement,write=createStyleWriter();
 for(let frame=0;frame<165;frame++)write(node,'transform','translate3d(100px,200px,0)');
 assert.equal(writes,1);assert.notEqual(stored,'translate3d(100px,200px,0)');
 write(node,'transform','translate3d(101px,200px,0)');assert.equal(writes,2);
});
test('style assignments are independent per element and property',()=>{
 let writes=0;const write=createStyleWriter(()=>writes++),a={style:{}} as HTMLElement,b={style:{}} as HTMLElement;
 write(a,'visibility','hidden');write(b,'visibility','hidden');write(a,'cursor','grab');write(a,'visibility','hidden');assert.equal(writes,3);
});
test('hover prefetch shares bytes but never parses a model; actual opening parses once',async()=>{
 let reads=0,parses=0;const bytes=new ArrayBuffer(16),resource=deferredAsset(async()=>{reads++;return bytes;},async value=>{parses++;assert.equal(value,bytes);return {model:'synthetic'};});
 await Promise.all([resource.prefetch(),resource.prefetch()]);assert.equal(reads,1);assert.equal(parses,0);
 const [a,b]=await Promise.all([resource.load(),resource.load()]);assert.equal(a,b);assert.equal(reads,1);assert.equal(parses,1);
});
test('failed asset downloads or parses can retry without duplicate successful downloads',async()=>{
 let reads=0,parses=0;const resource=deferredAsset(async()=>{if(++reads===1)throw Error('test download failure');return new ArrayBuffer(8);},async()=>{if(++parses===1)throw Error('test parse failure');return 'ready';});
 await assert.rejects(resource.prefetch());await assert.rejects(resource.load());assert.equal(await resource.load(),'ready');assert.equal(reads,2);assert.equal(parses,2);
});
