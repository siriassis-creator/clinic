import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BackButton() {
  const navigate = useNavigate();

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: 'transparent', // ทำพื้นหลังให้โปร่งใสดูคลีนๆ
    color: '#64748b', // สีเทาเข้ม
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.05rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px',
    alignSelf: 'flex-start', // ให้ปุ่มชิดซ้ายเสมอแม้ฟอร์มจะขยายใหญ่
    transition: 'all 0.2s ease',
  };

  return (
    <button
      style={buttonStyle}
      onClick={() => navigate('/')}
      onMouseOver={(e) => {
        e.currentTarget.style.color = '#4f46e5'; // เปลี่ยนเป็นสีม่วงตอนชี้
        e.currentTarget.style.backgroundColor = '#f1f5f9'; // มีพื้นหลังอ่อนๆ โผล่มา
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.color = '#64748b';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* ใช้ SVG แทนตัวหนังสือลูกศร เพื่อความคมชัดและสวยงาม */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
      ย้อนกลับ
    </button>
  );
}
