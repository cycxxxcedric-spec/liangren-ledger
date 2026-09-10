import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialData} from './budget.ts';
import {undoDeleted,recoveryList,saveRecovery} from './recovery.ts';
import {mergeLedger} from './sync-merge.ts';
const e=(id:string,amount=100)=>({id,amount,date:'2026-09-09',kind:'expense' as const,category:'food',note:'',who:'一起'});
test('撤回只恢复删除的单笔，保留之后新增的记录，拒绝重复',()=>{const d=initialData();d.entries=[e('new')];const next=undoDeleted(d,e('deleted'));assert.equal(next.entries.length,2);assert.throws(()=>undoDeleted(next,e('deleted')));});
test('逐项解决冲突仍保留双方不冲突的新增记录',()=>{const b=initialData();b.entries=[e('shared')];const l=structuredClone(b),r=structuredClone(b);l.entries=[e('shared',200),e('local')];r.entries=[e('shared',300),e('remote')];const m=mergeLedger(b,l,r,{'entry:shared':'remote'});assert.ok(m.ok);assert.equal(m.data.entries.length,3);assert.equal(m.data.entries.find(x=>x.id==='shared')!.amount,300);});
test('保留最近10份操作副本并读取旧版副本，损坏内容不阻塞列表',()=>{
 const map=new Map<string,string>();const storage={get length(){return map.size;},key:(i:number)=>[...map.keys()][i]??null,getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);},clear:()=>map.clear()} satisfies Storage;
 for(let i=0;i<12;i++)saveRecovery(storage,initialData(),'操作'+i);
 assert.equal(recoveryList(storage).length,10);
 storage.setItem('liangren-before-cloud-1700000000000',JSON.stringify(initialData()));
 storage.setItem('liangren-before-start-1700000000000','broken');
 assert.equal(recoveryList(storage).length,11);
});
