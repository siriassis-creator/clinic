import React from 'react';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* 
        ไม่มี Navbar แล้ว 
        หน้าต่างๆ จะมาแทรกตรง Outlet เลย 
      */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
