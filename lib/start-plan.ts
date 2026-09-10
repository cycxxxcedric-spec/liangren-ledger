import {planAt,validateData,type Data} from './budget.ts';
export const agreedStart='2026-09-10';
export function startSeptemberPlan(d:Data,openingTreasury:number,openingSavings:number):Data {
 const start='2026-09';
 return validateData({...d,start,startDate:agreedStart,openingTreasury,openingSavings,
 plans:[{...planAt(d,start),effective:start},...d.plans.filter(p=>p.effective>start)]});
}
