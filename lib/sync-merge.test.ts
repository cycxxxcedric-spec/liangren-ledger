import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from './budget.ts';
import {mergeLedger} from './sync-merge.ts';
const entry=(id:string,amount=100)=>({id,amount,date:'2026-10-01',kind:'expense' as const,category:'food',note:'',who:'一起'});
test('two phones add different expenses without overwriting either',()=>{
 const b=initialData(),l=structuredClone(b),r=structuredClone(b);l.entries=[entry('a')];r.entries=[entry('b')];
 const m=mergeLedger(b,l,r);assert.ok(m.ok);assert.equal(m.data.entries.length,2);
});
test('delete versus unchanged stays deleted; delete versus edit conflicts',()=>{
 const b=initialData();b.entries=[entry('a')];const l=structuredClone(b),r=structuredClone(b);l.entries=[];
 let m=mergeLedger(b,l,r);assert.ok(m.ok);assert.equal(m.data.entries.length,0);
 r.entries[0].amount=200;m=mergeLedger(b,l,r);assert.deepEqual(m,{ok:false,conflicts:['entry:a']});
});
test('same edit deduplicates; divergent edits require a decision',()=>{
 const b=initialData();b.entries=[entry('a')];const l=structuredClone(b),r=structuredClone(b);l.entries[0].amount=200;r.entries[0].amount=200;
 assert.ok(mergeLedger(b,l,r).ok);r.entries[0].amount=300;assert.equal(mergeLedger(b,l,r).ok,false);
});
test('settings and separate entry can merge; concurrent settings stay atomic',()=>{
 const b=initialData(),l=structuredClone(b),r=structuredClone(b);l.openingTreasury=1000;r.entries=[entry('a')];
 assert.ok(mergeLedger(b,l,r).ok);r.openingSavings=500;assert.deepEqual(mergeLedger(b,l,r),{ok:false,conflicts:['settings']});
});
