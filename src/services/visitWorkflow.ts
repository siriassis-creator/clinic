import { collection, doc, runTransaction } from 'firebase/firestore';
import { auth, db } from './firebase';

export const stageLabel = (stage: string) => ({draft:'กำลังตรวจ',awaiting_medicine:'รอรับยา',awaiting_payment:'รอชำระเงิน',paid:'เสร็จสิ้น'}[stage] || stage);
export function validatePrescription(items: any[]) {
  if (!Array.isArray(items)) throw new Error('รายการยาไม่ถูกต้อง');
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id || seen.has(item.id)) throw new Error('รายการยาซ้ำหรือไม่ถูกต้อง');
    seen.add(item.id);
    if (!Number.isFinite(Number(item.qtyToGive)) || Number(item.qtyToGive) <= 0 || (!item.isService && !Number.isInteger(Number(item.qtyToGive)))) throw new Error('จำนวนยาต้องเป็นจำนวนเต็มมากกว่า 0');
    if (!Number.isFinite(Number(item.sellingPrice)) || Number(item.sellingPrice) < 0) throw new Error('ราคาต้องไม่ติดลบ');
  }
  return items.reduce((sum, item) => sum + Number(item.qtyToGive) * Number(item.sellingPrice), 0);
}
export async function startCase(patient: any) {
  const uid = auth.currentUser?.uid;
  if (!uid || !patient.id) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const ref = doc(db, 'visits', `draft_${uid}_${patient.id}`);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    const now = new Date().toISOString();
    const episode = doc(collection(db, 'visits')).id;
    tx.set(ref, { workflowStatus:'draft', ownerUid:uid, patientId:patient.id,
      patientSnapshot:{firstName:patient.firstName||'',lastName:patient.lastName||'',age:patient.age||'',prefix:patient.prefix||''},
      patientName:`${patient.firstName} ${patient.lastName}`,cn:patient.cn,episodeId:episode,vn:`VN-${episode}`,visitDate:now,createdAt:now,updatedAt:now,revision:0,
      chiefComplaint:'',weight:'',height:'',temp:'',resp:'',pulse:'',bp:'',o2sat:'',diagnosis:'',treatment:'',nextAppt:'',prescriptions:[],totalAmount:0 });
  });
  return ref.id;
}
export async function saveCaseDraft(id: string, data: any, expectedRevision: number, episodeId: string) {
  return runTransaction(db, async tx => {
    const ref = doc(db,'visits',id); const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('ไม่พบเคส กรุณาโหลดหน้าใหม่');
    const current = snap.data();
    if (current.episodeId !== episodeId) throw new Error('ฉบับร่างนี้ถูกยกเลิกแล้ว');
    if (current.ownerUid !== auth.currentUser?.uid || current.workflowStatus !== 'draft') throw new Error('เคสนี้เปลี่ยนสถานะแล้ว กรุณาโหลดหน้าใหม่');
    if (current.revision !== expectedRevision) throw new Error('เคสถูกแก้ไขจากอุปกรณ์อื่น กรุณาโหลดหน้าใหม่ก่อนทำต่อ');
    const fields = ['chiefComplaint','weight','height','temp','resp','pulse','bp','o2sat','diagnosis','treatment','nextAppt'];
    const payload: any = Object.fromEntries(fields.map(k => [k,data[k] || '']));
    payload.prescriptions = data.prescriptions || [];
    // Incomplete input is allowed in drafts; completion validates quantities and prices.
    payload.totalAmount = payload.prescriptions.reduce((sum:number,p:any)=>sum+(Number(p.sellingPrice)||0)*(Number(p.qtyToGive)||0),0);
    const revision = current.revision + 1;
    tx.update(ref,{...payload,revision,updatedAt:new Date().toISOString()});
    return revision;
  });
}
export async function finishCase(id: string, expectedStage: string, expectedRevision: number) {
  return runTransaction(db, async tx => {
    const ref = doc(db,'visits',id); const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('เคสนี้ปิดแล้ว กรุณาเปิดประวัติการตรวจ');
    const data = snap.data();
    if (data.episodeId !== episodeId) throw new Error('ฉบับร่างนี้ถูกยกเลิกแล้ว');
    if (data.ownerUid !== auth.currentUser?.uid) throw new Error('ไม่มีสิทธิ์จัดการเคสนี้');
    if (data.workflowStatus !== expectedStage || data.revision !== expectedRevision) throw new Error('เคสเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่ ไม่ได้ทำรายการซ้ำ');
    const next = {draft:'awaiting_medicine',awaiting_medicine:'awaiting_payment',awaiting_payment:'paid'}[expectedStage];
    if (!next) throw new Error('สถานะไม่ถูกต้อง');
    if (!data.chiefComplaint?.trim() || !data.diagnosis?.trim()) throw new Error('กรุณาระบุอาการสำคัญและการวินิจฉัย');
    const totalAmount = validatePrescription(data.prescriptions);
    const now = new Date().toISOString();
    if (expectedStage === 'awaiting_medicine') {
      const meds = data.prescriptions.filter((p:any)=>!p.isService);
      // Firestore requires every read before any write.
      const stocks = await Promise.all(meds.map((p:any)=>tx.get(doc(db,'pharmacy',p.id))));
      meds.forEach((p:any,i:number)=>{
        const med = stocks[i]; const stock = Number(med.data()?.stockQty);
        if (!med.exists() || !Number.isFinite(stock) || stock < Number(p.qtyToGive)) throw new Error(`ยา ${p.tradeName} คงเหลือไม่พอ`);
        const expiry = med.data()?.expiryDate;
        const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        if (expiry && expiry < today) throw new Error(`ยา ${p.tradeName} หมดอายุแล้ว`);
      });
      meds.forEach((p:any,i:number)=>{
        tx.update(doc(db,'pharmacy',p.id),{stockQty:String(Number(stocks[i].data()?.stockQty)-Number(p.qtyToGive))});
        tx.set(doc(db,'medicine_history',`${data.episodeId}_${p.id}`),{medicineId:p.id,type:'OUT',amount:p.qtyToGive,note:`จ่ายยาคนไข้ CN: ${data.cn} (VN: ${data.vn})`,timestamp:now,visitId:data.episodeId});
      });
    }
    const revision = data.revision + 1;
    const final = {...data,workflowStatus:next,revision,totalAmount,updatedAt:now,
      ...(expectedStage==='draft'?{examinedAt:now}:{}),
      ...(expectedStage==='awaiting_medicine'?{dispensedAt:now}:{}),
      ...(next==='paid'?{paidAt:now,paymentStatus:'paid'}:{})};
    if (next === 'paid') {
      tx.set(doc(db,'visits',data.episodeId),final);
      tx.delete(ref);
    } else tx.update(ref,final);
    return {revision,stage:next};
  });
}

export async function discardCase(id: string, episodeId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'visits', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = snap.data();
    if (current.ownerUid !== uid || current.episodeId !== episodeId) {
      throw new Error('เคสเปลี่ยนแปลงแล้ว กรุณาตรวจสอบอีกครั้ง');
    }
    if (!['draft', 'awaiting_medicine'].includes(current.workflowStatus) || current.dispensedAt || current.paidAt) {
      throw new Error('เคสนี้จ่ายยาหรือรับชำระแล้ว จึงยกเลิกจากแท็บไม่ได้');
    }
    tx.delete(ref);
  });
}
