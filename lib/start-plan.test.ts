import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,quotaAt,envelopes,treasury,yearTotals,validateData} from './budget.ts';
import {startSeptemberPlan} from './start-plan.ts';
test('9月10日起只分配21天预算，10月恢复整月，原目标不擅自提高',()=>{
 const d=startSeptemberPlan(initialData(),100000,0);
 assert.equal(quotaAt(d,'2026-09',0),105000);
 assert.equal(quotaAt(d,'2026-10',0),150000);
 assert.equal(d.goals['2026'],3000000);
 assert.equal(envelopes(d,'2026-10')[0].left,255000);
});
test('9月10日前记录保留作历史，不重复扣期初或消费额度',()=>{
 const d=initialData();d.entries=[{id:'before',date:'2026-09-09',kind:'expense',amount:5000,category:'food',who:'一起',note:''},{id:'after',date:'2026-09-10',kind:'expense',amount:3000,category:'food',who:'一起',note:''}];
 const next=startSeptemberPlan(d,100000,0);assert.equal(next.entries.length,2);
 assert.equal(treasury(next,'2026-09').total,97000);assert.equal(envelopes(next,'2026-09')[0].spent,3000);
 assert.equal(yearTotals(next,2026).expense,8000);
 assert.throws(()=>validateData({...next,startDate:'2026-09-31'}));
});
