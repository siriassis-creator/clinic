import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();

  // --- 1. State สำหรับข้อมูลหน้าจอ ---
  const [clinicName, setClinicName] = useState('กำลังโหลด...');
  const [clinicSubtitle, setClinicSubtitle] = useState('');
  const [notifyCount, setNotifyCount] = useState(0);
  const [pharmacyCount, setPharmacyCount] = useState(0);

  useEffect(() => {
    let unsubAppt: () => void;
    let unsubPharma: () => void;
    let unsubSettings: () => void;

    const startListeners = async () => {
      // 🏥 ฟังชื่อคลินิก 2 บรรทัดแบบ Real-time
      unsubSettings = onSnapshot(doc(db, 'settings', 'appointment'), (snap) => {
        if (snap.exists()) {
          setClinicName(snap.data().clinicName || 'เอื้องฟ้าคลินิก');
          setClinicSubtitle(
            snap.data().clinicSubtitle || 'การพยาบาลและการผดุงครรภ์'
          );
        }
      });

      // 🔴 แก้ไขการนับ Badge แจ้งเตือนนัดหมาย
      const settingsSnap = await getDoc(doc(db, 'settings', 'appointment'));
      const alertDays = settingsSnap.exists()
        ? settingsSnap.data().alertDays
        : 3;

      const qAppt = query(
        collection(db, 'visits'),
        where('nextAppt', '!=', '')
      );
      unsubAppt = onSnapshot(qAppt, (snap) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const count = snap.docs.filter((doc) => {
          const data = doc.data();

          // 🆕 เพิ่มเงื่อนไข: นับเฉพาะที่ยังไม่มีสถานะการติดตาม (Pending)
          const isPending = !data.followUpStatus || data.followUpStatus === '';

          const apptDate = new Date(data.nextAppt);
          const diffDays = Math.ceil(
            (apptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          // ต้องยังไม่ถูกจัดการ และ อยู่ในช่วงวันที่แจ้งเตือน
          return isPending && diffDays >= 0 && diffDays <= alertDays;
        }).length;

        setNotifyCount(count);
      });

      // 🟡 แจ้งเตือนสต็อกยาต่ำ
      unsubPharma = onSnapshot(collection(db, 'pharmacy'), (snap) => {
        const count = snap.docs.filter((doc) => {
          const data = doc.data();
          return Number(data.stockQty) <= Number(data.minAlert);
        }).length;
        setPharmacyCount(count);
      });
    };

    startListeners();
    return () => {
      if (unsubAppt) unsubAppt();
      if (unsubPharma) unsubPharma();
      if (unsubSettings) unsubSettings();
    };
  }, []);

  const handleLogout = () => {
    if (window.confirm('คุณต้องการออกจากระบบใช่หรือไม่?')) {
      auth.signOut();
    }
  };

  const menus = [
    {
      title: 'ทะเบียนผู้ป่วย',
      desc: 'จัดการเวชระเบียน',
      icon: '📝',
      path: '/register',
      color: '#4f46e5',
    },
    {
      title: 'บันทึกการตรวจ',
      desc: 'บันทึกอาการ (OPD)',
      icon: '🩺',
      path: '/visits',
      color: '#10b981',
    },
    {
      title: 'นัดหมาย',
      desc: 'ตารางนัดหมายล่วงหน้า',
      icon: '📅',
      path: '/appointments',
      color: '#f59e0b',
      badgeValue: notifyCount,
    },
    {
      title: 'คลังยา',
      desc: 'สต็อกยาและเวชภัณฑ์',
      icon: '💊',
      path: '/pharmacy',
      color: '#ec4899',
      badgeValue: pharmacyCount,
    },
    {
      title: 'ขายยาหน้าร้าน',
      desc: 'ขายยาคนไข้ทั่วไป',
      icon: '🛒',
      path: '/pos', // เราจะสร้าง path นี้ใหม่
      color: '#8b5cf6', // สีม่วงเข้ม
    },
    {
      title: 'รายงาน',
      desc: 'สรุปสถิติการรักษา',
      icon: '📊',
      path: '/reports',
      color: '#06b6d4',
    },
    {
      title: 'ตั้งค่า',
      desc: 'ระบบและผู้ใช้งาน',
      icon: '⚙️',
      path: '/settings',
      color: '#64748b',
    },
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="clinic-logo-section">
          <span className="clinic-icon-main">🌸</span>
          <div className="clinic-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1>{clinicName}</h1>
              <button className="mini-logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
            <p className="clinic-subtitle">{clinicSubtitle}</p>
          </div>
        </div>
      </header>

      <div className="menu-grid">
        {menus.map((menu, index) => (
          <div
            key={index}
            className="menu-card"
            onClick={() => navigate(menu.path)}
            style={
              {
                '--menu-color': menu.color,
                position: 'relative',
              } as React.CSSProperties
            }
          >
            {menu.badgeValue !== undefined && menu.badgeValue > 0 && (
              <div
                className={`appointment-badge ${
                  menu.badgeValue > 99 ? 'plus' : ''
                }`}
              >
                {menu.badgeValue > 99 ? '99+' : menu.badgeValue}
              </div>
            )}
            <div className="card-pattern-bg">{menu.icon}</div>
            <div className="card-content">
              <div className="icon-main-box">{menu.icon}</div>
              <div className="text-content">
                <h3>{menu.title}</h3>
                <p>{menu.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
