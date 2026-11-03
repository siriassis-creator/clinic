import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="modern-navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🏥</span>
        Clinic<span className="brand-highlight">OS</span>
      </div>

      <div className="navbar-menu">
        {/* เพิ่มไอคอน 🏠, 📝, 🩺, 💊, 📅 ด้านหน้าข้อความเมนู */}
        <Link className={`nav-link ${isActive('/') ? 'active' : ''}`} to="/">
          <span className="menu-icon">🏠</span> หน้าหลัก
        </Link>
        <Link
          className={`nav-link ${isActive('/register') ? 'active' : ''}`}
          to="/register"
        >
          <span className="menu-icon">📝</span> ลงทะเบียน
        </Link>
        <Link
          className={`nav-link ${isActive('/opd') ? 'active' : ''}`}
          to="/opd"
        >
          <span className="menu-icon">🩺</span> ห้องตรวจ
        </Link>
        <Link
          className={`nav-link ${isActive('/pharmacy') ? 'active' : ''}`}
          to="/pharmacy"
        >
          <span className="menu-icon">💊</span> จ่ายยา
        </Link>
        <Link
          className={`nav-link ${isActive('/appointments') ? 'active' : ''}`}
          to="/appointments"
        >
          <span className="menu-icon">📅</span> นัดหมาย
        </Link>
      </div>
    </nav>
  );
}
