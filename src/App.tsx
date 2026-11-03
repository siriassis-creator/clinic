import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';

// Import หน้าต่างๆ ของคุณ
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Register from './pages/Register';
import Visits from './pages/Visits';
import Pharmacy from './pages/Pharmacy';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import PharmacySales from './pages/PharmacySales';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="loading-screen">กำลังโหลดระบบ...</div>;

  return (
    <Router>
      <Routes>
        {/* หน้า Login: ถ้าล็อกอินแล้วให้เด้งไปหน้าแรกเลย */}
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" />}
        />

        {/* หน้าอื่นๆ: ถ้ายังไม่ได้ล็อกอิน ให้เด้งไปหน้า Login เสมอ */}
        <Route
          path="/"
          element={user ? <Dashboard /> : <Navigate to="/login" />}
        />
        <Route
          path="/register"
          element={user ? <Register /> : <Navigate to="/login" />}
        />
        <Route
          path="/visits"
          element={user ? <Visits /> : <Navigate to="/login" />}
        />
        <Route
          path="/pharmacy"
          element={user ? <Pharmacy /> : <Navigate to="/login" />}
        />
        <Route
          path="/appointments"
          element={user ? <Appointments /> : <Navigate to="/login" />}
        />
        <Route
          path="/reports"
          element={user ? <Reports /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={user ? <Settings /> : <Navigate to="/login" />}
        />

        {/* 🟢 ย้ายเข้ามาอยู่ใน <Routes> ให้ถูกต้องเรียบร้อย 🟢 */}
        <Route
          path="/pos"
          element={user ? <PharmacySales /> : <Navigate to="/login" />}
        />

        {/* กรณีเข้า URL อื่นที่ไม่มีในระบบ ให้ดีดกลับหน้าแรก */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
