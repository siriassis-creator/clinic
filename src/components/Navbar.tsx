import { useLayoutEffect, useRef, type RefObject } from 'react';
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

const menuOrder = [...primary, ...secondary].map(item => item.to);

export default function Navbar({ contentRef }: { contentRef: RefObject<HTMLDivElement | null> }) {
  const { pathname } = useLocation();
  const dialog = useRef<HTMLDialogElement>(null);
  const previousPath = useRef(pathname);
  const nav = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const moreActive = secondary.some(item => item.to === pathname);

  useLayoutEffect(() => {
    dialog.current?.close();
    window.scrollTo({ top: 0, behavior: 'instant' });

    const from = menuOrder.indexOf(previousPath.current);
    const to = menuOrder.indexOf(pathname);
    previousPath.current = pathname;

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

    const content = contentRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animation = content && typeof content.animate === 'function' && from >= 0 && to >= 0 && from !== to && !reduced.matches
      ? content.animate(
          [{ transform: 'translateX(' + (to > from ? '100%' : '-100%') + ')' }, { transform: 'none' }],
          { duration: 290, easing: 'cubic-bezier(.2,.75,.25,1)' },
        )
      : undefined;
    const stopMotion = () => {
      if (reduced.matches) animation?.cancel();
    };
    reduced.addEventListener('change', stopMotion);
    return () => {
      resize?.disconnect();
      reduced.removeEventListener('change', stopMotion);
      animation?.cancel();
    };
  }, [pathname, contentRef]);

  return (
    <>
      <nav ref={nav} className="clinic-bottom-nav" aria-label="เมนูหลัก">
        <span ref={indicator} className="clinic-menu-indicator" aria-hidden="true" />
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
