import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // 🟢 1. เพิ่ม Import สำหรับระบบ Login

const firebaseConfig = {
  apiKey: 'AIzaSyBrqEL09XID7EyKTKuvkQCV3sZfbKLmCD0',
  authDomain: 'clinic-43b84.firebaseapp.com',
  projectId: 'clinic-43b84',
  storageBucket: 'clinic-43b84.firebasestorage.app',
  messagingSenderId: '1036492987555',
  appId: '1:1036492987555:web:f1d0711b9b35f55725f316',
  measurementId: 'G-E52155JP86',
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);

// 🟢 2. สร้างและส่งออก auth เพื่อใช้ในหน้า Login และ App.tsx
export const auth = getAuth(app);

// ส่งออก db สำหรับจัดการฐานข้อมูล (เหมือนเดิม)
export const db = getFirestore(app);
