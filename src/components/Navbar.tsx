import { useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Navbar.css';

const menus = [
  { to: '/', label: 'หน้าหลัก', icon: '🏠' },
  { to: '/register', label: 'ผู้ป่วย', icon: '📝' },
  { to: '/visits', label: 'ห้องตรวจ', icon: '🩺' },
  { to: '/pharmacy', label: 'คลังยา', icon: '💊' },

  { to: '/appointments', label: 'นัดหมาย', icon: '📅' },
  { to: '/pos', label: 'ขายยาหน้าร้าน', icon: '🛒' },
  { to: '/settings', label: 'ตั้งค่า', icon: '⚙️' },
];


export default function Navbar() {
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });

    const navElement = nav.current;
    const active = navElement?.querySelector<HTMLElement>('.clinic-bottom-item.is-active');
    const bar = indicator.current;
    const positionIndicator = () => {
      if (!active || !bar) return;
      const width = Math.min(active.offsetWidth * 0.48, 52);
      bar.style.width = width + 'px';
      bar.style.transform = 'translateX(' + (active.offsetLeft + (active.offsetWidth - width) / 2) + 'px)';
    };
    positionIndicator();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(positionIndicator);
    if (navElement) resize?.observe(navElement);

    return () => { resize?.disconnect(); };
  }, [pathname]);

  return (
    <>
      <nav ref={nav} className="clinic-bottom-nav" aria-label="เมนูหลัก">
        <span ref={indicator} className="clinic-menu-indicator" aria-hidden="true" />
        {menus.map(item => (
          <NavLink key={item.to} to={item.to} end
            className={({ isActive }) => `clinic-bottom-item${isActive ? ' is-active' : ''}`}>
            <span className="clinic-bottom-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

    </>
  );
}

