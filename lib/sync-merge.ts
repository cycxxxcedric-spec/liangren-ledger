import type {Data, Entry} from './budget.ts';

// Three-way merge against the last acknowledged server snapshot. Never use
// device timestamps to decide which spouse's edit wins.
const canonical = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
};
export type MergeResult = {ok:true; data:Data} | {ok:false; conflicts:string[]};
export function mergeLedger(base:Data, local:Data, remote:Data,choices:Record<string,'local'|'remote'>={}):MergeResult {
  const conflicts:string[]=[];
  function choose<T>(key:string,b:T,l:T,r:T):T {
    if(canonical(l)===canonical(r)) return l;
    if(canonical(l)===canonical(b)) return r;
    if(canonical(r)===canonical(b)) return l;
    if(choices[key])return choices[key]==='local'?l:r;
    conflicts.push(key); return l;
  }
  const maps=[base,local,remote].map(d=>new Map(d.entries.map(e=>[e.id,e])));
  const entries:Entry[]=[];
  for(const id of new Set(maps.flatMap(m=>[...m.keys()]))) {
    const entry=choose('entry:'+id,maps[0].get(id),maps[1].get(id),maps[2].get(id));
    if(entry) entries.push(entry);
  }
  // Keep related budget settings atomic so independently merged fields cannot
  // accidentally produce an invalid opening balance or budget configuration.
  const settings=(d:Data)=>{const {entries:_,savedAt:__,...rest}=d;return rest;};
  const config=choose('settings',settings(base),settings(local),settings(remote));
  if(conflicts.length) return {ok:false,conflicts};
  return {ok:true,data:{...config,entries,savedAt:remote.savedAt}};
}
