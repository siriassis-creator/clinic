import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from '../services/database'; // 🆕 เพิ่มการดึงข้อมูลจาก Firestore
import { db } from '../services/database';
import { auth } from '../services/firebase'; // 🆕 นำเข้า db เพิ่มเติม
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [clinicName, setClinicName] = useState('เอื้องฟ้าคลินิก'); // 🆕 State สำหรับชื่อคลินิก
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/'); // ล็อกอินสำเร็จไปหน้า Dashboard
    } catch (err: any) {
      setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card fade-in">
        <div className="login-logo">🌸</div>
        {/* 🆕 แสดงชื่อคลินิกแบบ Dynamic */}
        <h1>{clinicName}</h1>
        <p>กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>อีเมล</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="input-group">
            <label>รหัสผ่าน</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="login-btn">
            เข้าสู่ระบบ 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

