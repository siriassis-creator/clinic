type Row = Record<string, any>;
export const bangkokDate = (value: string | Date) => {
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
};
const paid = (v:Row) => !v.workflowStatus || v.workflowStatus === 'paid';
const clinical = (v:Row) => v.cn !== 'WALK-IN' && v.workflowStatus !== 'draft';
const sumIncome = (rows:Row[]) => rows.reduce((n,v)=>n+(Number(v.totalAmount)||0),0);
export function buildDashboard(data:Record<string,Row[]>, month:string, now=new Date(), uid?:string) {
  const today=bangkokDate(now), visits=data.visits||[], patients=data.patients||[], meds=data.pharmacy||[], history=data.medicine_history||[];
  const monthClinical=visits.filter(v=>clinical(v)&&bangkokDate(v.examinedAt||v.visitDate).startsWith(month));
  const paidVisits=visits.filter(paid);
  const income=sumIncome(paidVisits.filter(v=>bangkokDate(v.paidAt||v.visitDate).startsWith(month)));
  const stockMap=new Map(meds.map(m=>[m.id,m]));
  const cost=(h:Row)=>(Number(h.unitCost??h.costPrice??stockMap.get(h.medicineId)?.costPrice)||0)*(Number(h.amount)||0);
  const receipts=history.filter(h=>h.type==='IN');
  const expense=receipts.filter(h=>bangkokDate(h.timestamp).startsWith(month)).reduce((n,h)=>n+cost(h),0);
  const expired=meds.filter(m=>m.expiryDate&&m.expiryDate<today);
  const low=meds.filter(m=>(Number(m.stockQty)||0)<=(Number(m.minAlert)||0));
  const expiredIds=new Set(expired.map(m=>m.id));
  const lowOnly=low.filter(m=>!expiredIds.has(m.id));
  const appointments=visits.filter(v=>v.workflowStatus!=='draft'&&v.nextAppt===today&&!v.followUpStatus).sort((a,b)=>(a.patientName||'').localeCompare(b.patientName||''));
  const recentPatients=[...patients].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,5);
  const todayPatients = patients
    .filter(patient => bangkokDate(patient.createdAt) === today)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const week=Array.from({length:7},(_,i)=>{const d=new Date(today+'T12:00:00+07:00');d.setUTCDate(d.getUTCDate()-(6-i));const day=bangkokDate(d);return{label:new Date(day+'T12:00:00+07:00').toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}),visits:visits.filter(v=>clinical(v)&&bangkokDate(v.examinedAt||v.visitDate)===day).length,patients:patients.filter(p=>bangkokDate(p.createdAt)===day).length};});
  const finance=Array.from({length:6},(_,i)=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1-(5-i),15));const key=d.toISOString().slice(0,7);return{label:d.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',month:'short'}),income:sumIncome(paidVisits.filter(v=>bangkokDate(v.paidAt||v.visitDate).startsWith(key))),expense:receipts.filter(h=>bangkokDate(h.timestamp).startsWith(key)).reduce((n,h)=>n+cost(h),0)};});
  const dx=new Map<string,number>();monthClinical.forEach(v=>{if(v.diagnosis)dx.set(v.diagnosis,(dx.get(v.diagnosis)||0)+1)});
  const pending={draft:0,awaiting_medicine:0,awaiting_payment:0};visits.filter(v=>!uid||v.ownerUid===uid).forEach(v=>{if(v.workflowStatus in pending)pending[v.workflowStatus as keyof typeof pending]++;});
  return{monthClinical,income,expense,expired,low,appointments,recentPatients,todayPatients,week,finance,pending,
    stock:[{name:'ปกติ',value:meds.length-expired.length-lowOnly.length},{name:'สต็อกต่ำ',value:lowOnly.length},{name:'หมดอายุ',value:expired.length}],
    alerts:[...expired.map((m):Row=>({...m,isExpired:true})),...lowOnly.map((m):Row=>({...m,isExpired:false}))],
    diagnoses:[...dx].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,5),
    recentVisits:[...visits].filter(v=>v.visitDate).sort((a,b)=>String(b.updatedAt||b.visitDate).localeCompare(String(a.updatedAt||a.visitDate))).slice(0,5),
    status:(s:string)=>({draft:'กำลังตรวจ',awaiting_medicine:'รอรับยา',awaiting_payment:'รอชำระเงิน',paid:'รับชำระแล้ว'}[s]||'บันทึกการตรวจ')};
}
