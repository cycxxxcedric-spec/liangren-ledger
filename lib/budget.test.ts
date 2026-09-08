import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,profilePlan,envelopes,quotaAt,goalAt,validateData,yearTotals,sumSavings} from './budget.ts';
import type {Data, Entry} from './budget.ts';
const entry=(values:Partial<Entry>):Entry=>({id:'1',date:'2026-10-05',kind:'expense',amount:10000,category:'food',note:'',who:'一起',...values});
void test('12/14/15万方案分别满足32万收入与2万缓冲',()=>{for(const n of ['12','14','15']){const p=profilePlan(n,'2027-01');assert.equal(32000000-p.annual.reduce((a,b)=>a+b,0),Number(n)*1000000);assert.equal(p.annual[14],2000000);}});
void test('半年不旅行逐月累积，跨年余额保留',()=>{const d=initialData();assert.equal(envelopes(d,'2026-12')[7].left,750000);assert.equal(envelopes(d,'2027-01')[7].carry,750000);assert.equal(envelopes(d,'2027-06')[7].left,2250000);});
void test('超支300带入下月，1500额度只剩1200',()=>{const d=initialData();d.entries=[entry({amount:180000})];assert.equal(envelopes(d,'2026-10')[0].left,-30000);assert.equal(envelopes(d,'2026-11')[0].carry,-30000);assert.equal(envelopes(d,'2026-11')[0].left,120000);});
void test('未来月份流水不能污染过去；更改与删除旧流水会重算',()=>{const d=initialData();d.entries=[entry({amount:180000}),entry({id:'2',date:'2026-11-02',amount:50000})];assert.equal(envelopes(d,'2026-10')[0].left,-30000);assert.equal(envelopes(d,'2026-11')[0].left,70000);d.entries[0].amount=150000;assert.equal(envelopes(d,'2026-11')[0].left,100000);d.entries.shift();assert.equal(envelopes(d,'2026-11')[0].left,250000);});
void test('跨月退款返还原分类，旅行餐饮不扣外食',()=>{const d=initialData();d.entries=[entry({category:'travel',amount:100000}),entry({id:'2',date:'2026-11-10',category:'travel',kind:'refund',amount:20000})];assert.equal(envelopes(d,'2026-11')[7].left,420000);assert.equal(envelopes(d,'2026-11')[0].left,300000);});
void test('存款与收入不扣消费额度，存款取出降低进度，期初不计新增',()=>{const d=initialData();d.openingSavings=10000000;d.entries=[entry({kind:'saving',amount:100000}),entry({id:'2',kind:'withdrawal',amount:20000}),entry({id:'3',kind:'income',amount:2000000})];assert.equal(envelopes(d,'2026-10')[0].left,150000);assert.equal(yearTotals(d,2026).saved,80000);assert.equal(sumSavings(d,'2026-10'),80000);assert.equal(yearTotals(d,2026).income,2000000);assert.equal(yearTotals(d,2026).expense,0);});
void test('分到月的分币在12月调平，全年总额完全相等',()=>{const d=initialData();for(let c=0;c<16;c++){const sum=Array.from({length:12},(_,m)=>quotaAt(d,`2027-${String(m+1).padStart(2,'0')}`,c)).reduce((a,b)=>a+b,0);assert.equal(sum,d.plans[1].annual[c]);}});
void test('年中预算改变不影响早期额度，年度目标互相独立',()=>{const d=initialData();const before=envelopes(d,'2027-05');d.plans.push(profilePlan('15','2027-06'));assert.deepEqual(envelopes(d,'2027-05'),before);assert.equal(quotaAt(d,'2027-06',7),200000);d.goals['2027']=15000000;assert.equal(goalAt(d,2026),3000000);assert.equal(goalAt(d,2028),14000000);});
void test('空账本开始为0实际，备份恢复无损',()=>{const d=initialData();assert.equal(yearTotals(d,2027).saved,0);assert.equal(d.openingSavings,null);assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))),d);});
void test('拒绝重复流水ID、无效日期、未知分类及非法金额',()=>{for(const change of [(d:Data)=>d.entries.push(entry({})),(d:Data)=>d.entries[0].date='2026-02-30',(d:Data)=>d.entries[0].category='nope',(d:Data)=>d.entries[0].amount=-1,(d:Data)=>d.entries[0].amount=.2]){const d=initialData();d.entries=[entry({})];change(d);assert.throws(()=>validateData(d));}});



void test('历史补记进入年度消费统计，但不改变预算开始后的额度',()=>{const d=initialData();d.entries=[entry({date:'2025-08-03',amount:200000})];assert.doesNotThrow(()=>validateData(d));assert.equal(yearTotals(d,2025).expense,200000);assert.equal(envelopes(d,'2026-10')[0].left,150000);});
void test('旧备份没有时间仍可恢复，非法时间被拒绝',()=>{const d=initialData();d.entries=[entry({time:'18:30'})];assert.doesNotThrow(()=>validateData(d));d.entries[0].time='25:00';assert.throws(()=>validateData(d));});
