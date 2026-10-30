import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveEase,ARCHIVE_MOTION_MS,spectrumBands} from '../src/archive-motion.ts';

test('archive motion finishes at a fixed deadline with no overshoot or residual tail',()=>{
 assert.equal(archiveEase(-200),0);assert.equal(archiveEase(0),0);assert.equal(archiveEase(ARCHIVE_MOTION_MS),1);assert.equal(archiveEase(ARCHIVE_MOTION_MS*8),1);
 let previous=0;for(let ms=0;ms<=ARCHIVE_MOTION_MS;ms++){const p=archiveEase(ms);assert.ok(p>=previous&&p<=1);previous=p;}
 // Restarting from the actual rendered pose is continuous on an interrupted move.
 const halfway=archiveEase(390),from=4+(12-4)*halfway;assert.equal(from+(2-from)*archiveEase(0),from);assert.equal(from+(2-from)*archiveEase(ARCHIVE_MOTION_MS),2);
});
test('spectrum uses the supplied audio bytes and returns quiet, bounded output',()=>{
 assert.ok(spectrumBands(new Uint8Array()).every(x=>x===0));assert.ok(spectrumBands(new Uint8Array(512)).every(x=>x===0));assert.ok(spectrumBands(new Uint8Array(512).fill(255)).every(x=>x===1));
 const bins=new Uint8Array(512);bins.fill(180,0,30);const values=spectrumBands(bins);assert.equal(values.length,40);assert.ok(values.every(x=>Number.isFinite(x)&&x>=0&&x<=1));assert.ok(values[0]>values[39]);
});
