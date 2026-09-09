/** Keep user-entered decimal precision; commas are presentation only. */
export function cleanMoneyInput(value:string):string|null {
 const raw=value.normalize('NFKC').replace(/[,，\s]/g,'');
 if(!/^\d*(?:\.\d{0,2})?$/.test(raw))return null;
 return raw.startsWith('.')?'0'+raw:raw;
}
export function formatMoneyInput(raw:string):string {
 if(!raw)return '';
 const [integer,decimal]=raw.split('.');
 return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(decimal===undefined?'':'.'+decimal);
}
