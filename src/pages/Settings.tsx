import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import BackButton from '../components/BackButton';
import './Visits.css';
import { expiryWarningDays, DEFAULT_EXPIRY_WARNING_DAYS, MAX_EXPIRY_WARNING_DAYS } from '../services/medicineExpiry';

export default function Settings() {
  const [clinicName, setClinicName] = useState('');
  const [clinicSubtitle, setClinicSubtitle] = useState('');
  const [expiryDays, setExpiryDays] = useState(String(DEFAULT_EXPIRY_WARNING_DAYS));
  const [alertDays, setAlertDays] = useState(3);

  // 🆕 States สำหรับตั้งค่ารายงาน
  const [reportHeaderColor, setReportHeaderColor] = useState('#475569');
  const [showFinance, setShowFinance] = useState(true);
  const [showPatientStats, setShowPatientStats] = useState(true);
  const [showTopMeds, setShowTopMeds] = useState(true);
  const [showDx, setShowDx] = useState(true);

  const [newEmail, setNewEmail] = useState(auth.currentUser?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [displayName, setDisplayName] = useState(
    auth.currentUser?.displayName || ''
  );

  const [loading, setLoading] = useState(false);
  // 🆕 State สำหรับเปิด-ปิดการมองเห็นรหัสผ่าน
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // ดึงข้อมูลการนัดหมายและคลินิก
      const snap = await getDoc(doc(db, 'settings', 'appointment'));
      if (snap.exists()) {
        setClinicName(snap.data().clinicName || '');
        setClinicSubtitle(snap.data().clinicSubtitle || '');
        setExpiryDays(String(expiryWarningDays(snap.data().expiryWarningDays)));
        setAlertDays(snap.data().alertDays || 3);
      }

      // 🆕 ดึงข้อมูลการตั้งค่ารายงาน
      const reportSnap = await getDoc(doc(db, 'settings', 'report_config'));
      if (reportSnap.exists()) {
        const data = reportSnap.data();
        setReportHeaderColor(data.headerColor || '#475569');
        setShowFinance(data.showFinance ?? true);
        setShowPatientStats(data.showPatientStats ?? true);
        setShowTopMeds(data.showTopMeds ?? true);
        setShowDx(data.showDx ?? true);
      }
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async () => {
    const days = Number(expiryDays);
    if (!expiryDays.trim() || !Number.isInteger(days) || days < 0 || days > MAX_EXPIRY_WARNING_DAYS) {
      alert('กรุณากรอกจำนวนวันเป็นจำนวนเต็มตั้งแต่ 0 ถึง ' + MAX_EXPIRY_WARNING_DAYS);
      return;
    }
    setLoading(true);
    try {
      // 1. บันทึกข้อมูลคลินิกและตั้งค่าระบบ
      await setDoc(
        doc(db, 'settings', 'appointment'),
        {
          clinicName: clinicName,
          clinicSubtitle: clinicSubtitle,
          alertDays: Number(alertDays),
          expiryWarningDays: days,
        },
        { merge: true }
      );

      // 🆕 2. บันทึกการตั้งค่ารายงาน
      await setDoc(
        doc(db, 'settings', 'report_config'),
        {
          headerColor: reportHeaderColor,
          showFinance: showFinance,
          showPatientStats: showPatientStats,
          showTopMeds: showTopMeds,
          showDx: showDx,
        },
        { merge: true }
      );

      // 3. อัปเดตข้อมูลบัญชีผู้ใช้
      const user = auth.currentUser;
      if (user) {
        if (displayName !== user.displayName)
          await updateProfile(user, { displayName });
        if (newEmail !== user.email) await updateEmail(user, newEmail);
        if (newPassword.length >= 6) await updatePassword(user, newPassword);
        else if (newPassword.length > 0)
          alert('รหัสผ่านใหม่ต้องมี 6 ตัวขึ้นไป');
      }

      alert('บันทึกการตั้งค่าทั้งหมดเรียบร้อยแล้ว ✨');
      setNewPassword('');
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        alert(
          'เพื่อความปลอดภัย กรุณา Logout และ Login ใหม่อีกครั้งก่อนเปลี่ยน Email/Pass'
        );
      } else {
        alert('เกิดข้อผิดพลาด: ' + e.message);
      }
    }
    setLoading(false);
  };

  return (
    <div className="reg-container">
      <BackButton />
      <div
        className="reg-card fade-in"
        style={{ maxWidth: '700px', margin: '0 auto' }}
      >
        <header className="reg-header">
          <h1>⚙️ ตั้งค่าระบบและโปรไฟล์</h1>
        </header>

        <div className="reg-section">
          <h3 className="section-title">
            🏥 ข้อมูลคลินิก (แสดงหน้า Dashboard)
          </h3>
          <div className="reg-group">
            <label>ชื่อคลินิก (บรรทัดที่ 1)</label>
            <input
              type="text"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
          <div className="reg-group" style={{ marginTop: '15px' }}>
            <label>คำอธิบาย/สโลแกน (บรรทัดที่ 2)</label>
            <input
              type="text"
              value={clinicSubtitle}
              onChange={(e) => setClinicSubtitle(e.target.value)}
            />
          </div>
        </div>

        {/* 🆕 ส่วนที่เพิ่มใหม่: ตั้งค่ารายงาน */}
        <div className="reg-section">
          <h3 className="section-title">📊 ตั้งค่ารายงานสถิติ</h3>
          <div className="reg-group">
            <label>สีพื้นหลังหัวข้อรายงาน (Header Color)</label>
            <div
              style={{
                display: 'flex',
                gap: '15px',
                alignItems: 'center',
                marginTop: '5px',
              }}
            >
              <input
                type="color"
                value={reportHeaderColor}
                onChange={(e) => setReportHeaderColor(e.target.value)}
                style={{
                  width: '60px',
                  height: '40px',
                  padding: '2px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                }}
              />
              <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
                {reportHeaderColor.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="reg-group" style={{ marginTop: '20px' }}>
            <label>เลือกส่วนที่ต้องการให้แสดงในรายงาน:</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: 'normal',
                }}
              >
                <input
                  type="checkbox"
                  checked={showFinance}
                  onChange={(e) => setShowFinance(e.target.checked)}
                />
                กราฟรายรับ - รายจ่าย
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: 'normal',
                }}
              >
                <input
                  type="checkbox"
                  checked={showPatientStats}
                  onChange={(e) => setShowPatientStats(e.target.checked)}
                />
                กราฟสถิติผู้เข้ารับการรักษา
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: 'normal',
                }}
              >
                <input
                  type="checkbox"
                  checked={showTopMeds}
                  onChange={(e) => setShowTopMeds(e.target.checked)}
                />
                ตาราง 10 อันดับยาจ่ายบ่อย
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: 'normal',
                }}
              >
                <input
                  type="checkbox"
                  checked={showDx}
                  onChange={(e) => setShowDx(e.target.checked)}
                />
                ตารางสรุปการวินิจฉัย (Dx)
              </label>
            </div>
          </div>
        </div>

        <div className="reg-section">
          <h3 className="section-title">🔐 บัญชีผู้ใช้งาน</h3>
          <div className="reg-row">
            <div className="reg-group flex-1">
              <label>ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="reg-group flex-1">
              <label>อีเมล (Login)</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <div
            className="reg-group"
            style={{ marginTop: '15px', position: 'relative' }}
          >
            <label>รหัสผ่านใหม่ (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)</label>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <input
                type={showPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                style={{ paddingRight: '45px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: '#64748b',
                }}
              >
                {showPass ? '👁️' : '🙈'}
              </button>
            </div>
          </div>
        </div>

        <div className="reg-section">
          <h3 className="section-title">🔔 ตั้งค่าการแจ้งเตือน</h3>
          <div className="reg-group">
            <label>แจ้งเตือนนัดหมายล่วงหน้า (วัน)</label>
            <input
              type="number"
              value={alertDays}
              onChange={(e) => setAlertDays(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="reg-section">
          <h3 className="section-title">💊 แจ้งเตือนยาใกล้หมดอายุ</h3>
          <div className="reg-group">
            <label htmlFor="expiry-warning-days">แจ้งเตือนก่อนวันหมดอายุ (วัน)</label>
            <input id="expiry-warning-days" type="number" min={0} max={MAX_EXPIRY_WARNING_DAYS} step={1}
              value={expiryDays} onChange={e => setExpiryDays(e.target.value)} />
            <small>กรอก 0 เพื่อเตือนเฉพาะวันที่ยาหมดอายุ</small>
          </div>
        </div>

        <div className="reg-actions">
          <button
            className="btn-submit"
            onClick={handleSaveSettings}
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? '⏳ กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
          </button>
        </div>

        <button
          className="btn-cancel"
          onClick={() => auth.signOut()}
          style={{ width: '100%', marginTop: '15px', background: '#64748b' }}
        >
          🚪 ออกจากระบบ
        </button>
      </div>
    </div>
  );
}
