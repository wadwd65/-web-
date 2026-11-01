import test from 'node:test';
import assert from 'node:assert/strict';
import {previewFromPress,actionFromPress} from '../src/scene-pointer.ts';
const press={pointerId:1,x:100,y:100,module:3};
const release={pointerId:1,x:102,y:101,module:3,inside:true};
test('model clicks only select a preview; blank and changed hit targets are ignored',()=>{
 assert.equal(previewFromPress(press,release,false,false),3);
 assert.equal(previewFromPress({...press,module:null},release,false,false),null);
 assert.equal(previewFromPress(press,{...release,module:6},false,false),null);
 assert.equal(previewFromPress(press,{...release,module:null},false,false),null);
});
test('small incremental drags, outside releases, cancellation and other pointers cannot activate',()=>{
 assert.equal(previewFromPress(press,{...release,x:109},false,false),null);
 assert.equal(previewFromPress(press,release,true,false),null);
 assert.equal(previewFromPress(press,{...release,inside:false},false,false),null);
 assert.equal(previewFromPress(null,release,false,false),null);
 assert.equal(previewFromPress(press,{...release,pointerId:2},false,false),null);
});
test('workspaces are immune to canvas selection and only valid home previews are accepted',()=>{
 assert.equal(previewFromPress(press,release,false,true),null);
 for(const module of [-1,8,NaN])assert.equal(previewFromPress({...press,module},{...release,module},false,false),null);
});
test('foreground sub-options remain clickable while background and cross-zone gestures cannot execute',()=>{
 const start={...press,zone:'face:material',foreground:true},end={...release,zone:'face:material',action:'material' as const};
 assert.equal(actionFromPress(start,end,false,3,true),'material');
 assert.equal(actionFromPress({...start,foreground:false},end,false,3,true),null);
 assert.equal(actionFromPress(start,end,false,2,true),null);
 assert.equal(actionFromPress(start,{...end,zone:'face:result',action:'result'},false,3,true),null);
 assert.equal(actionFromPress(start,end,true,3,true),null);
 assert.equal(actionFromPress(start,end,false,3,false),null);
 assert.equal(actionFromPress(start,{...end,inside:false},false,3,true),null);
});
