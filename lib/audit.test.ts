import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,profilePlan,quotaAt,envelopes,treasury,yearTotals,categories,monthName,monthIndex} from './budget.ts';
test('36个月独立核对：现金恒等式、所有类目正负结转、月年报收支一致',()=>{
 const d=initialData();d.openingTreasury=5000000;d.openingSavings=1000000;
 for(let i=0;i<36;i++){const month=monthName(monthIndex(d.start)+i);for(const [j,kind] of (['income','expense','refund','saving','withdrawal'] as const).entries())d.entries.push({id:`${i}-${j}`,date:month+'-10',kind,amount:kind==='income'?2000000:kind==='expense'?1500000:30000+i,category:categories[i%categories.length].id,note:'test',who:'一起'});}
 let cash=5000000,reserved=1000000;const balances=categories.map(()=>0);
 for(let i=0;i<36;i++){const month=monthName(monthIndex(d.start)+i),entries=d.entries.filter(e=>e.date.startsWith(month));for(const e of entries){if(e.kind==='income')cash+=e.amount;if(e.kind==='expense')cash-=e.amount;if(e.kind==='refund')cash+=e.amount;if(e.kind==='saving')reserved+=e.amount;if(e.kind==='withdrawal')reserved-=e.amount;}
 const v=treasury(d,month);assert.equal(v.total,cash);assert.equal(v.reserved,reserved);assert.equal(v.available,cash-reserved);
 const env=envelopes(d,month);for(let j=0;j<categories.length;j++){const old=balances[j];balances[j]+=quotaAt(d,month,j);for(const e of entries.filter(e=>e.category===categories[j].id)){if(e.kind==='expense')balances[j]-=e.amount;if(e.kind==='refund')balances[j]+=e.amount;}assert.equal(env[j].carry,old);assert.equal(env[j].left,balances[j]);}
 const y=Number(month.slice(0,4)),sum=Array.from({length:Number(month.slice(5))},(_,m)=>treasury(d,`${y}-${String(m+1).padStart(2,'0')}`));assert.equal(yearTotals(d,y,month).income,sum.reduce((s,v)=>s+v.monthIncome,0));assert.equal(yearTotals(d,y,month).expense,sum.reduce((s,v)=>s+v.monthExpense,0));}
});
test('闰年首月和年中预算版本按日期生效',()=>{const d=initialData();d.start='2028-02';d.startDate='2028-02-29';d.plans=[profilePlan('14','2028-02'),profilePlan('12','2028-06')];assert.equal(quotaAt(d,'2028-02',0),Math.floor(150000/29));assert.equal(quotaAt(d,'2028-05',7),250000);assert.equal(quotaAt(d,'2028-06',7),300000);});
