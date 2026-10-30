import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faceAction} from '../src/scene-actions.ts';
const at=(x:number,y:number,module=-1,reviewed=false)=>faceAction(x/1280,1-y/900,module,reviewed);

test('三维标题及材料/结果/清单各自路由，空白与框外不误开',()=>{
  assert.equal(at(350,220),'open');
  assert.equal(at(180,805),'material');
  assert.equal(at(550,805),'result');
  assert.equal(at(950,805),'list');
  assert.equal(at(800,90),null);
  assert.equal(at(15,220),null);
});
test('合同未核对时的三个文字入口不同，已有核对时进入真实结果',()=>{
  assert.equal(at(140,540,1,false),'material');
  assert.equal(at(350,540,1,false),'sources');
  assert.equal(at(570,540,1,false),'list');
  assert.equal(at(350,540,1,true),'result');
});
test('工资实发文字进入金额结果，补贴来源文字打开依据',()=>{
  assert.equal(at(330,630,2),'result');
  assert.equal(at(330,630,6),'sources');
});
