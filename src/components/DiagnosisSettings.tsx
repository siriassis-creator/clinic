import { useEffect, useState } from 'react';
import { addDoc, collection, db, doc, getDocs, runTransaction } from '../services/database';
import { renameCachedDiagnosis } from '../services/dashboardSnapshot';

export default function DiagnosisSettings() {
  const [rows, setRows] = useState<{label:string;ids:string[]}[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string|null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = async () => {
    const [masters, visits] = await Promise.all([getDocs(collection(db,'settings_diagnosis')),getDocs(collection(db,'visits'))]);
    const labels = new Map<string,string[]>();
    masters.docs.forEach(row => { const label=row.data().label; if(label) labels.set(label,[...(labels.get(label)||[]),row.id]); });
    visits.docs.forEach(row => { const label=row.data().diagnosis; if(label && !labels.has(label)) labels.set(label,[]); });
    setRows([...labels].map(([label,ids])=>({label,ids})).sort((a,b)=>a.label.localeCompare(b.label,'th')));
  };
  useEffect(()=>{void load().catch(()=>setMessage('โหลดรายการวินิจฉัยไม่สำเร็จ'));},[]);
  const save = async () => {
    const label=value.trim(), previous=rows.find(row=>row.label===editing);
    if(!previous || busy) return;
    if(!label || label.length>500) {setMessage('กรุณาระบุชื่อการวินิจฉัย 1–500 ตัวอักษร');return;}
    if(label===previous.label){setEditing(null);return;}
    setBusy(true);setMessage('');
    try {
      let ids=previous.ids;
      // Historical free text becomes a standard option before the atomic rename.
      if(!ids.length){ const created=await addDoc(collection(db,'settings_diagnosis'),{label:previous.label}); ids=[created.id]; }
      await runTransaction(db,async tx=>{
        const refs=ids.map(id=>doc(db,'settings_diagnosis',id));
        const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
        snapshots.forEach(snapshot=>{if(!snapshot.exists() || snapshot.data().label!==previous.label) throw new Error('รายการนี้เปลี่ยนแล้ว กรุณาโหลดรายการใหม่');});
        refs.forEach(ref=>tx.update(ref,{label}));
      });
      renameCachedDiagnosis(previous.label,label);
      setEditing(null);setMessage('อัปเดตชื่อและทุกรายการตรวจที่ใช้ชื่อเดิมแล้ว');
      await load();
    }catch(error){setMessage(error instanceof Error?error.message:'แก้ไขไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  return <div className="reg-section">
    <h3 className="section-title">🩺 การวินิจฉัยที่พบบ่อย</h3>
    <p>แก้ชื่อแล้วจะอัปเดตทุกประวัติและเคสที่ใช้ชื่อเดิม รวมถึงกราฟสรุป หากเปลี่ยนเป็นชื่อที่มีอยู่แล้ว กราฟจะรวมยอดเข้าด้วยกัน</p>
    <div className="reg-group"><label htmlFor="diagnosis-search">ค้นหาการวินิจฉัย</label><input id="diagnosis-search" value={search} onChange={e=>setSearch(e.target.value)} /></div>
    {message && <p role="status">{message}</p>}
    {editing!==null && <div style={{padding:16,background:'#eff6ff',borderRadius:12,marginBottom:12}}>
      <p>ชื่อเดิม: <strong>{editing}</strong></p>
      <div className="reg-group"><label htmlFor="diagnosis-label">ชื่อใหม่</label><input id="diagnosis-label" value={value} disabled={busy} maxLength={500} onChange={e=>setValue(e.target.value)} /></div>
      <p>การบันทึกจะเปลี่ยนชื่อในข้อมูลการตรวจเดิมทั้งหมดที่ตรงกัน</p>
      <button type="button" className="btn-action edit" disabled={busy} onClick={()=>void save()}>{busy?'กำลังอัปเดตทุกรายการ…':'ยืนยันเปลี่ยนชื่อทุกรายการ'}</button>
      <button type="button" className="btn-action" disabled={busy} onClick={()=>setEditing(null)}>ยกเลิก</button>
    </div>}
    <div style={{maxHeight:360,overflowY:'auto'}}>{rows.filter(row=>row.label.toLowerCase().includes(search.toLowerCase())).map(row=><div key={row.label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'10px 0',borderBottom:'1px solid #e2e8f0'}}>
      <span style={{overflowWrap:'anywhere'}}>{row.label}</span><button type="button" className="btn-action edit" disabled={busy} onClick={()=>{setEditing(row.label);setValue(row.label);setMessage('');}}>แก้ไข</button>
    </div>)}</div>
  </div>;
}
