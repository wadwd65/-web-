/** Explicit online check with synthetic input only; not part of npm test/build. */
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5222';
const cases=[
 {name:'salary',text:'以下是合成测试金额：我的应发工资8000元，个人社保800元，公积金600元，个税66元，其他扣款0元。请用工具核对计算实发。',tool:'calculate_salary'},
 {name:'contract',text:'以下为合成测试：我签的是全日制劳动合同。合同期限为12个月，试用期为3个月，工作地点由单位安排。请用合同工具核对这段文字。',tool:'review_contract'},
 {name:'missing',text:'合成测试：我的应发工资8000元，想知道实发，其他信息还没拿到。',tool:null},
];
const records=[];
for(const item of cases){
 const start=performance.now();const response=await fetch(base+'/api/v1/assistant/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:item.text}],module:'home'}),signal:AbortSignal.timeout(55000)});
 const value=await response.json();
 if(!response.ok)throw new Error(`${item.name}: ${value.error?.message||'Request failed'}`);
 assert.equal(value.data.provider,'DeepSeek');
 if(item.tool)assert.ok(value.data.steps.some(step=>step.name===item.tool&&step.ok),`${item.name}: expected actual rule tool`);
 if(item.name==='salary')assert.equal(value.data.actions.find(action=>action.kind==='apply-salary')?.input.gross,8000);
 if(item.name==='missing')assert.ok(!value.data.actions.some(action=>action.kind==='apply-salary'),'Missing deductions cannot become zero');
 const record={name:item.name,model:value.data.model,elapsedMs:Math.round(performance.now()-start),steps:value.data.steps,actions:value.data.actions.map(action=>action.kind),reply:value.data.reply};records.push(record);console.log(JSON.stringify(record));
}
console.log(JSON.stringify({result:'passed',syntheticCases:records.length}));
