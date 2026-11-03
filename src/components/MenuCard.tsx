import React from 'react';
import './MenuCard.css';

// กำหนดประเภทของข้อมูลที่คอมโพเนนต์นี้รับเข้ามา
interface MenuCardProps {
  icon: string; // หรือ React.ReactNode ถ้าใช้ไอคอนจากไลบรารี
  title: string;
  description: string;
  onClick: () => void; // เป็นฟังก์ชันที่ไม่มีการ return ค่า
}

export default function MenuCard({
  icon,
  title,
  description,
  onClick,
}: MenuCardProps) {
  return (
    <div className="flip-card" onClick={onClick}>
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <div className="icon-container">{icon}</div>
          <h3>{title}</h3>
        </div>
        <div className="flip-card-back">
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}
