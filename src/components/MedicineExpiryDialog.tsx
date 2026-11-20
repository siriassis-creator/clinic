import { useEffect, useRef } from 'react';

type Medicine = Record<string, any>;
export default function MedicineExpiryDialog({ medicines, expired, warningDays, asOf, onClose }: {
  medicines: Medicine[]; expired: boolean; warningDays: number; asOf: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element=dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const rows=[...medicines].sort((a,b)=>String(a.expiryDate).localeCompare(String(b.expiryDate)));
  return <dialog ref={dialog} className="medicine-expiry-dialog" onCancel={onClose} onClose={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby="medicine-expiry-title">
    <header><div><h2 id="medicine-expiry-title">{expired?'🔴 ยาและเวชภัณฑ์หมดอายุ':'🟠 ยาและเวชภัณฑ์ใกล้หมดอายุ'}</h2><p>{expired?'หมดอายุก่อนวันที่สรุปข้อมูล':`เตือนล่วงหน้า ${warningDays} วัน ตามที่ตั้งค่า`} · {rows.length} รายการ</p></div><button type="button" autoFocus onClick={onClose} aria-label="ปิดรายการยา">×</button></header>
    <p className="expiry-snapshot-note">ข้อมูลจากการรีเฟรชล่าสุด · วันที่ {asOf}</p>
    <div className="expiry-dialog-list">{rows.length?rows.map(m=>{
      const days=Math.round((Date.parse(m.expiryDate+'T00:00:00Z')-Date.parse(asOf+'T00:00:00Z'))/86400000);
      return <article key={m.id} className={expired?'expiry-item expired':'expiry-item expiring'}>
        <div><strong>{m.tradeName||m.genericName||'ไม่ระบุชื่อ'}</strong><small>{[m.genericName,m.strength].filter(Boolean).join(' · ')}</small><span>คงเหลือ {m.stockQty??'—'} {m.unit||''}</span></div>
        <div className="expiry-item-date"><b>{expired?`หมดอายุแล้ว ${Math.abs(days)} วัน`:days===0?'หมดอายุวันนี้':`เหลือ ${days} วัน`}</b><span>วันหมดอายุ {new Date(m.expiryDate+'T00:00:00Z').toLocaleDateString('th-TH',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'})}</span></div>
      </article>;
    }):<p className="overview-empty">ไม่พบรายการ{expired?'หมดอายุ':'ใกล้หมดอายุ'}</p>}</div>
    <footer><button type="button" onClick={onClose}>ปิด</button></footer>
  </dialog>;
}
