import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Navbar.css';

const primary = [
  { to: '/', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/register', label: 'ผู้ป่วย', icon: '📝' },
  { to: '/visits', label: 'ห้องตรวจ', icon: '🩺' },
  { to: '/pharmacy', label: 'คลังยา', icon: '💊' },
];
const secondary = [
  { to: '/appointments', label: 'นัดหมาย', icon: '📅' },
  { to: '/pos', label: 'ขายยาหน้าร้าน', icon: '🛒' },
  { to: '/reports', label: 'รายงาน', icon: '📊' },
  { to: '/settings', label: 'ตั้งค่า', icon: '⚙️' },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const moreActive = secondary.some(item => item.to === pathname);

  useEffect(() => {
    dialog.current?.close();
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <>
      <nav className="clinic-bottom-nav" aria-label="เมนูหลัก">
        {primary.map(item => (
          <NavLink key={item.to} to={item.to} end
            className={({ isActive }) => `clinic-bottom-item${isActive ? ' is-active' : ''}`}>
            <span className="clinic-bottom-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`clinic-bottom-item${moreActive ? ' is-active' : ''}`}
          aria-haspopup="dialog" aria-controls="clinic-more-menu"
          onClick={() => dialog.current?.showModal()}>
          <span className="clinic-bottom-icon" aria-hidden="true">☰</span>
          <span>เพิ่มเติม</span>
        </button>
      </nav>
      <dialog ref={dialog} id="clinic-more-menu" className="clinic-more-dialog" aria-labelledby="clinic-more-title"
        onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
        <div className="clinic-more-panel">
          <div className="clinic-more-header">
            <h2 id="clinic-more-title">เมนูเพิ่มเติม</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="ปิดเมนูเพิ่มเติม">✕</button>
          </div>
          <div className="clinic-more-grid">
            {secondary.map(item => (
              <NavLink key={item.to} to={item.to}
                onClick={() => dialog.current?.close()}
                className={({ isActive }) => `clinic-more-link${isActive ? ' is-active' : ''}`}>
                <span aria-hidden="true">{item.icon}</span>{item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
