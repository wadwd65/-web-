import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('the offline archive asset matches its pinned source and retains the author licence',()=>{
 const data=readFileSync(new URL('../public/models/rhine-archive-cassette.glb',import.meta.url));
 const source=JSON.parse(readFileSync(new URL('../public/credits/model-source.json',import.meta.url),'utf8'));
 const model=source.files.find((entry:{path:string})=>entry.path==='Assets/models/archive-cassette.glb');
 assert.ok(/^[a-f0-9]{40}$/.test(source.commit));
 assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
 assert.equal(createHash('sha256').update(data).digest('hex'),model.sha256);
 const length=data.readUInt32LE(12),gltf=JSON.parse(data.toString('utf8',20,20+length));
 assert.ok(gltf.meshes.length>=10);assert.ok(gltf.materials.length>=10);
 assert.ok(gltf.buffers.every((buffer:{uri?:string})=>!buffer.uri));
 assert.equal(gltf.images?.length??0,0,'The model must not silently fetch external covers or CG.');
 const licence=readFileSync(new URL('../public/credits/RhineLabUI-MIT.txt',import.meta.url),'utf8');
 assert.match(licence,/Copyright \(c\) 2026 LBEILC/);assert.match(licence,/MIT License/);
});

test('the five scene artworks are local, unchanged and individually attributed',()=>{
 const source=JSON.parse(readFileSync(new URL('../public/credits/artwork-source.json',import.meta.url),'utf8'));
 assert.equal(source.assets.length,5);assert.equal(new Set(source.assets.map((a:{file:string})=>a.file)).size,5);
 for(const asset of source.assets){const data=readFileSync(new URL('../public'+asset.file,import.meta.url));assert.equal(data.length,asset.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);assert.equal(data.readUInt32BE(16),asset.dimensions[0]);assert.equal(data.readUInt32BE(20),asset.dimensions[1]);assert.ok(asset.source.startsWith('https://prts.wiki/'));assert.match(asset.copyright,/not covered/);}
});
