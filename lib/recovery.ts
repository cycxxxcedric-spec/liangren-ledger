import {validateData,type Data,type Entry} from './budget.ts';
export type Recovery={id:string;date:string;label:string;data:Data};
const KEY='liangren-recovery-v1';
export function recoveryList(storage:Storage):Recovery[]{
 const result:Recovery[]=[];
 try{for(const r of JSON.parse(storage.getItem(KEY)||'[]')){try{if(typeof r.id!=='string'||typeof r.label!=='string'||typeof r.date!=='string'||isNaN(Date.parse(r.date)))continue;result.push({...r,data:validateData(r.data)});}catch{}}}catch{}
 for(let i=0;i<storage.length;i++){const k=storage.key(i)!;if(!/^liangren-before-(cloud|start|resolve)-\d+$/.test(k))continue;try{result.push({id:k,date:new Date(Number(k.split('-').pop())).toISOString(),label:k.includes('-start-')?'调整开始日期前':'连接或处理同步前',data:validateData(JSON.parse(storage.getItem(k)!))});}catch{}}
 return result.sort((a,b)=>b.date.localeCompare(a.date));
}
export function saveRecovery(storage:Storage,data:Data,label:string){
 const rows=recoveryList(storage).filter(r=>!r.id.startsWith('liangren-before-'));
 rows.unshift({id:crypto.randomUUID(),date:new Date().toISOString(),label,data:validateData(data)});
 storage.setItem(KEY,JSON.stringify(rows.slice(0,10)));
}
export function undoDeleted(data:Data,entry:Entry):Data{
 if(data.entries.some(e=>e.id===entry.id))throw Error('这笔记录已经存在，未重复恢复。');
 return validateData({...data,entries:[...data.entries,entry]});
}
