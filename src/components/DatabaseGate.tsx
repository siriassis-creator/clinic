import { useEffect, useState, type ReactNode } from 'react';
import { prepareSupabase } from '../services/prepareSupabase';

export default function DatabaseGate({ uid, children }: { uid?: string; children: ReactNode }) {
  const [readyFor, setReadyFor] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!uid) { setReadyFor(''); return; }
    let active = true;
    setError('');
    prepareSupabase().then(() => { if (active) setReadyFor(uid); }).catch(cause => {
      if (active) setError(cause.code === 'resource-exhausted'
        ? 'Firebase มีโควตาอ่านไม่พอสำหรับย้ายข้อมูลล่าสุด กรุณาลองใหม่เมื่อโควตาพร้อม'
        : cause.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ');
    });
    return () => { active = false; };
  }, [uid, attempt]);
  if (!uid || readyFor === uid) return children;
  return <main className="reg-container"><section className="reg-card" style={{ padding: 24 }}>
    <h2>กำลังเตรียมข้อมูลคลินิก</h2>
    <p role="status">ครั้งแรกระบบจะย้ายข้อมูลล่าสุดไป Supabase กรุณาพักการบันทึกจากเครื่องอื่นจนกว่าจะเสร็จ</p>
    {error ? <><p role="alert">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>ลองใหม่</button></>
      : <p>กำลังตรวจสอบและโอนข้อมูล กรุณาเปิดหน้านี้ไว้</p>}
  </section></main>;
}
