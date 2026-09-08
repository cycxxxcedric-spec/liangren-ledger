import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData,annualCategories,entriesCsv} from './budget.ts';
void test('年度饼图按分类净消费，不纳入收入和存款',()=>{const d=initialData();d.entries=[{id:'1',date:'2026-09-01',kind:'expense',amount:10000,category:'travel',who:'一起',note:''},{id:'2',date:'2026-09-02',kind:'refund',amount:2000,category:'travel',who:'一起',note:''},{id:'3',date:'2026-09-02',kind:'saving',amount:50000,category:'food',who:'一起',note:''}];assert.equal(annualCategories(d,2026)[7].amount,8000);assert.equal(annualCategories(d,2026)[0].amount,0);});
void test('CSV有中文BOM、时间、转义引号换行并防止公式注入',()=>{const csv=entriesCsv([{id:'1',date:'2026-09-01',time:'12:30',kind:'expense',amount:125,category:'food',who:'一起',note:'=1+1,"午饭"\n第二行'}]);assert.equal(csv.charCodeAt(0),0xfeff);assert.ok(csv.includes('"12:30"'));assert.ok(csv.includes('"1.25"'));assert.ok(csv.includes('"\'=1+1,""午饭""\n第二行"'));});
