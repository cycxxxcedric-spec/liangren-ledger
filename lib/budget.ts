export type Kind = 'expense' | 'refund' | 'income' | 'saving' | 'withdrawal';
export type Entry = { id: string; date: string; kind: Kind; amount: number; category: string; note: string; who: string; time?: string };
export type Plan = { effective: string; annual: number[]; income: number; profile: string };
export type Data = { schema: 1; start: string; startDate?: string; openingSavings: number | null; openingTreasury?: number | null; plans: Plan[]; goals: Record<string,number>; entries: Entry[]; savedAt: string };
export const categories = [
  {id:'food',name:'日常外食',hint:'非旅行时的正餐、外卖',group:'日常'},
  {id:'home',name:'家庭补给',hint:'水果、临时买菜等；日常伙食父母支持',group:'日常'},
  {id:'snack',name:'零食饮料',hint:'非旅行时的咖啡、奶茶、零食',group:'日常'},
  {id:'daily',name:'日用品',hint:'清洁、纸品和家庭消耗品',group:'日常'},
  {id:'car',name:'交通与用车',hint:'非旅行交通、油费、保养和车险',group:'日常'},
  {id:'utility',name:'水电通信',hint:'水电煤、手机和宽带',group:'日常'},
  {id:'personal',name:'两人零花',hint:'每人500元/月；购物只扣一次，夫妻转账不记支出',group:'日常'},
  {id:'travel',name:'旅行基金',hint:'机酒、旅行餐饮、当地交通和门票都记这里',group:'项目'},
  {id:'digital',name:'数码家电',hint:'手机、电脑、相机和家电',group:'项目'},
  {id:'clothes',name:'衣物美妆',hint:'衣鞋、美妆及护理用品',group:'项目'},
  {id:'fun',name:'娱乐学习',hint:'娱乐、运动及学习',group:'项目'},
  {id:'gift',name:'人情礼物',hint:'请客、送礼、节日红包',group:'项目'},
  {id:'insurance',name:'保险党费',hint:'人身及父母保险、党费；车险记用车',group:'项目'},
  {id:'health',name:'医疗备孕',hint:'必要医疗不因额度不足而停止',group:'项目'},
  {id:'buffer',name:'机动缓冲',hint:'意外支出；不用于掩盖其他分类超支',group:'预留'},
  {id:'gold',name:'金饰及其他',hint:'金饰按消费记录；投资买卖请另行核算',group:'项目'}
];
const base = [18000,3600,3600,6000,15600,6000,12000,30000,12000,12000,7600,9600,7200,16800,20000,0];
export const cents = (n:number) => Math.round(n*100);
export function profilePlan(profile:string, effective:string): Plan {
  const annual = [...base];
  if(profile==='12') {annual[7]+=6000; annual[8]+=6000; annual[9]+=6000; annual[10]+=2000;}
  if(profile==='15') {annual[7]-=6000; annual[8]-=2000; annual[9]-=2000;}
  return {effective, annual:annual.map(cents), income:32000000, profile};
}
export function initialData():Data {
  const old = profilePlan('14','2026-10');
  return {schema:1,start:'2026-10',openingSavings:null,plans:[old,profilePlan('14','2027-01')],goals:{'2026':3000000},entries:[],savedAt:''};
}
export const monthIndex = (m:string) => Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
export const monthName = (n:number) => `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
export const validMonth = (m:unknown):m is string => typeof m==='string' && /^(20\d\d)-(?:0[1-9]|1[0-2])$/.test(m);
export function planAt(d:Data, month:string):Plan {
  return d.plans.filter(p=>p.effective<=month).sort((a,b)=>b.effective.localeCompare(a.effective))[0] ?? d.plans[0];
}
export const budgetStartDate=(d:Data)=>d.startDate??`${d.start}-01`;
export function quotaAt(d:Data, month:string, i:number):number {
  if(month<d.start) return 0;
  const annual=planAt(d,month).annual[i];
  const full=month.endsWith('-12') ? annual-Math.floor(annual/12)*11 : Math.floor(annual/12);
  if(month===d.start&&d.startDate){const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();return Math.floor(full*(days-Number(d.startDate.slice(8))+1)/days);}
  return full;
}
export function envelopes(d:Data, month:string) {
  return categories.map((c,i)=>{
    let allocated=0;
    for(let n=monthIndex(d.start);n<=monthIndex(month);n++) allocated+=quotaAt(d,monthName(n),i);
    const entries=d.entries.filter(t=>t.category===c.id && t.date>=budgetStartDate(d) && t.date.slice(0,7)<=month);
    const net=(ts:Entry[])=>ts.reduce((s,t)=>s+(t.kind==='expense'?t.amount:t.kind==='refund'?-t.amount:0),0);
    const spent=net(entries.filter(t=>t.date.startsWith(month)));
    const quota=quotaAt(d,month,i);
    const left=allocated-net(entries);
    return {...c,quota,spent,left,carry:left-quota+spent};
  });
}
export function goalAt(d:Data,year:number):number {
  if(year<Number(d.start.slice(0,4))) return 0;
  if(d.goals[String(year)]!==undefined) return d.goals[String(year)];
  // Unconfigured years use the household's 140k recommendation. Each explicit
  // year's goal is independent of budget edits in any other year.
  const full=14000000;
  const days=new Date(Number(d.start.slice(0,4)),Number(d.start.slice(5)),0).getDate();
  const count=year===Number(d.start.slice(0,4))?13-Number(d.start.slice(5))-(d.startDate?(Number(d.startDate.slice(8))-1)/days:0):12;
  return Math.round(full*count/12);
}
export function yearTotals(d:Data,year:number,through=`${year}-12`) {
  const rows=d.entries.filter(t=>t.date.startsWith(`${year}-`)&&t.date.slice(0,7)<=through);
  const sum=(kind:Kind)=>rows.filter(t=>t.kind===kind&&(!['saving','withdrawal'].includes(kind)||t.date>=budgetStartDate(d))).reduce((a,t)=>a+t.amount,0);
  return {income:sum('income'),expense:sum('expense')-sum('refund'),saved:sum('saving')-sum('withdrawal'),count:rows.length};
}
export const sumSavings=(d:Data,through:string)=>d.entries.filter(t=>t.date>=budgetStartDate(d)&&t.date.slice(0,7)<=through).reduce((s,t)=>s+(t.kind==='saving'?t.amount:t.kind==='withdrawal'?-t.amount:0),0);
export function validateData(value:unknown):Data {
  const d=value as Data;
  const money=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=1e12;
  if(!d || d.schema!==1 || !validMonth(d.start) || !(d.openingSavings===null||money(d.openingSavings)) || !Array.isArray(d.plans) || !d.plans.length || d.plans.length>2000 || !Array.isArray(d.entries) || d.entries.length>100000 || !d.goals || typeof d.goals!=='object') throw Error('不是有效的两人小账备份。');
  if(d.startDate!==undefined&&(typeof d.startDate!=='string'||!/^20\d\d-\d\d-\d\d$/.test(d.startDate)||d.startDate.slice(0,7)!==d.start||isNaN(Date.parse(d.startDate))||new Date(d.startDate+'T12:00:00Z').toISOString().slice(0,10)!==d.startDate))throw Error('开始日期无效。');
  if(d.openingTreasury!==undefined&&d.openingTreasury!==null&&!money(d.openingTreasury)) throw Error('期初金库金额有误。');
  if(d.openingTreasury!=null&&d.openingSavings!=null&&d.openingSavings>d.openingTreasury) throw Error('期初目标存款属于总金库，不能超过期初金库总额。');
  if(!d.plans.some(p=>p.effective===d.start)) throw Error('缺少开始月份的预算。');
  if(new Set(d.plans.map(p=>p.effective)).size!==d.plans.length) throw Error('预算生效月份重复。');
  for(const p of d.plans) if(!validMonth(p.effective)||p.effective<d.start||!Array.isArray(p.annual)||p.annual.length!==categories.length||!p.annual.every(money)||!money(p.income)||typeof p.profile!=='string') throw Error('预算数据有误。');
  for(const [year,n] of Object.entries(d.goals)) if(!/^20\d\d$/.test(year)||!money(n)) throw Error('年度目标有误。');
  const ids=new Set<string>();
  for(const t of d.entries) {
    const parsed=typeof t.date==='string'&&/^20\d\d-\d\d-\d\d$/.test(t.date)&&!isNaN(Date.parse(t.date))&&new Date(t.date+'T12:00:00Z').toISOString().slice(0,10)===t.date;
    if(typeof t.id!=='string'||!t.id||ids.has(t.id)||!parsed||t.date<'2025-01-01'||(t.time!==undefined&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.time))||!validMonth(t.date.slice(0,7))||!money(t.amount)||t.amount===0||!['expense','refund','income','saving','withdrawal'].includes(t.kind)||!categories.some(c=>c.id===t.category)||typeof t.note!=='string'||t.note.length>300||typeof t.who!=='string'||t.who.length>30) throw Error('流水格式不正确，未导入。');
    ids.add(t.id);
  }
  return d;
}

export function annualCategories(d:Data,year:number){return categories.map(c=>({...c,amount:d.entries.filter(t=>t.date.startsWith(`${year}-`)&&t.category===c.id).reduce((s,t)=>s+(t.kind==='expense'?t.amount:t.kind==='refund'?-t.amount:0),0)}));}
export function entriesCsv(entries:Entry[]):string{
 const labels:Record<Kind,string>={expense:'消费',refund:'退款',income:'收入',saving:'存入存款',withdrawal:'取出存款'};
 const quote=(v:string)=>'"'+(/^[\s]*[=+@-]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';
 const rows=[['日期','时间','类型','分类','金额（元）','记录人','备注'],...entries.map(t=>[t.date,t.time??'',labels[t.kind],['expense','refund'].includes(t.kind)?categories.find(c=>c.id===t.category)!.name:'不扣消费额度',(t.amount/100).toFixed(2),t.who,t.note])];
 return '\uFEFF'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}

export function treasury(d:Data,through:string){
 const active=through>=d.start;
 const rows=d.entries.filter(t=>t.date>=budgetStartDate(d)&&t.date.slice(0,7)<=through);
 const sum=(kind:Kind,month?:string)=>rows.filter(t=>t.kind===kind&&(!month||t.date.startsWith(month))).reduce((s,t)=>s+t.amount,0);
 const income=sum('income'), expense=sum('expense')-sum('refund'), netReserved=sum('saving')-sum('withdrawal');
 const total=active&&d.openingTreasury!=null?d.openingTreasury+income-expense:null;
 const reserved=active&&d.openingSavings!==null?d.openingSavings+netReserved:null;
 const available=total!==null&&reserved!==null?total-reserved:null;
 return {total,reserved,available,income,expense,netReserved,change:income-expense,monthIncome:sum('income',through),monthExpense:sum('expense',through)-sum('refund',through),monthReserved:sum('saving',through)-sum('withdrawal',through)};
}
