import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import BackButton from '../components/BackButton';
import './Visits.css';

export default function Appointments() {
  const [allAppointments, setAllAppointments] = useState<any[]>([]);
  const [alertDays, setAlertDays] = useState(3);
  const [isFilterActive, setIsFilterActive] = useState(false);

  useEffect(() => {
    // 1. ดึงค่า Setting การแจ้งเตือน
    getDoc(doc(db, 'settings', 'appointment')).then((snap) => {
      if (snap.exists()) setAlertDays(snap.data().alertDays);
    });

    // 2. ดึงรายการนัดหมายทั้งหมด
    const q = query(collection(db, 'visits'), where('nextAppt', '!=', ''));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // กรองออก: แสดงเฉพาะรายการที่ยังไม่มีสถานะการติดตาม
      const pendingList = list.filter(
        (appt) => !appt.followUpStatus || appt.followUpStatus === ''
      );

      setAllAppointments(
        pendingList.sort((a, b) => a.nextAppt.localeCompare(b.nextAppt))
      );
    });
    return () => unsub();
  }, []);

  // 🆕 ฟังก์ชันอัปเดตสถานะพร้อมบันทึก วันที่/เวลา ที่ติดตาม
  const handleUpdateStatus = async (visitId: string, newStatus: string) => {
    if (!newStatus) return;

    try {
      await updateDoc(doc(db, 'visits', visitId), {
        followUpStatus: newStatus,
        followUpDate: new Date().toISOString(), // 📅 บันทึกวันที่และเวลาที่ทำการติดตาม
      });
      // รายการจะหายไปจากหน้าจอทันทีเนื่องจาก pendingList Filter ไว้
    } catch (e) {
      alert('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingAppts = allAppointments.filter((item: any) => {
    const apptDate = new Date(item.nextAppt);
    const diffTime = apptDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= alertDays;
  });

  const displayList = isFilterActive ? upcomingAppts : allAppointments;

  return (
    <div className="reg-container">
      <BackButton />
      <div className="reg-card fade-in">
        <header className="reg-header">
          <h1>📅 รายการนัดหมายติดตามผล</h1>
        </header>

        <div
          onClick={() => setIsFilterActive(!isFilterActive)}
          style={{
            background: isFilterActive ? '#ef4444' : '#f8fafc',
            color: isFilterActive ? 'white' : '#1e3a8a',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            border: isFilterActive ? 'none' : '2px dashed #1e3a8a',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.3s ease',
            boxShadow: isFilterActive
              ? '0 4px 12px rgba(239, 68, 68, 0.3)'
              : 'none',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
              {upcomingAppts.length > 0
                ? `🔔 มีนัดหมายใกล้ถึงกำหนด ${upcomingAppts.length} รายการ`
                : '✅ ไม่มีนัดหมายใกล้กำหนดในขณะนี้'}
            </h3>
            <p
              style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '0.9rem' }}
            >
              {isFilterActive
                ? 'กำลังแสดงเฉพาะรายการที่ใกล้ถึง (คลิกเพื่อดูทั้งหมด)'
                : `เกณฑ์แจ้งเตือนล่วงหน้า: ${alertDays} วัน (คลิกเพื่อกรองข้อมูล)`}
            </p>
          </div>
          <div style={{ fontSize: '1.5rem' }}>
            {isFilterActive ? '🔍' : '🔔'}
          </div>
        </div>

        <div className="table-container">
          <table className="patient-table">
            <thead>
              <tr>
                <th>วันที่นัด</th>
                <th>CN / ชื่อคนไข้</th>
                <th>สถานะนัด</th>
                <th>การติดตาม</th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((appt) => {
                const apptDateObj = new Date(appt.nextAppt);
                const isToday =
                  apptDateObj.toDateString() === new Date().toDateString();
                const isUpcoming = upcomingAppts.some((u) => u.id === appt.id);

                return (
                  <tr
                    key={appt.id}
                    style={isToday ? { background: '#fffbeb' } : {}}
                  >
                    <td className="font-bold">
                      {apptDateObj.toLocaleDateString('th-TH')}
                    </td>
                    <td>
                      <strong>{appt.cn}</strong>
                      <br />
                      {appt.patientName}
                    </td>
                    <td>
                      {isToday ? (
                        <span className="badge badge-red">วันนี้นัด</span>
                      ) : isUpcoming ? (
                        <span className="badge badge-orange">ใกล้ถึงนัด</span>
                      ) : (
                        <span
                          className="badge"
                          style={{ background: '#e2e8f0', color: '#64748b' }}
                        >
                          รอนัดหมาย
                        </span>
                      )}
                    </td>
                    <td>
                      <select
                        value={appt.followUpStatus || ''}
                        onChange={(e) =>
                          handleUpdateStatus(appt.id, e.target.value)
                        }
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border:
                            isToday || isUpcoming
                              ? '2px solid #ef4444'
                              : '1px solid #cbd5e1',
                          fontSize: '0.85rem',
                          background: 'white',
                          color: '#1e293b',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="">⏳ รอดำเนินการ</option>
                        <option value="ติดตามแล้ว">
                          ✅ ติดตามแล้ว (ลบออก)
                        </option>
                        <option value="ติดตามไม่ได้">
                          ❌ ติดตามไม่ได้ (ลบออก)
                        </option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {displayList.length === 0 && (
            <div
              style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}
            >
              {isFilterActive
                ? 'ไม่มีนัดหมายที่ต้องจัดการในช่วงนี้'
                : 'ยังไม่มีข้อมูลการนัดหมายที่รอดำเนินการ'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
