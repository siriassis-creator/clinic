import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import BackButton from '../components/BackButton';
import './Visits.css';

const initialSaleState = {
  prescriptions: [] as any[],
  totalAmount: 0,
};

export default function PharmacySales() {
  const [saleData, setSaleData] = useState(initialSaleState);
  const [inventory, setInventory] = useState<any[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [newServiceLabel, setNewServiceLabel] = useState('');

  // 1. โหลดข้อมูลสต็อกยาและรายการบริการ
  useEffect(() => {
    const unsubPharma = onSnapshot(collection(db, 'pharmacy'), (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubSvc = onSnapshot(collection(db, 'settings_services'), (snap) => {
      setServiceOptions(snap.docs.map((doc) => doc.data().label).sort());
    });
    return () => {
      unsubPharma();
      unsubSvc();
    };
  }, []);

  // 2. คำนวณยอดรวมสุทธิอัตโนมัติ
  useEffect(() => {
    const total = saleData.prescriptions.reduce(
      (sum, item) =>
        sum + Number(item.sellingPrice || 0) * Number(item.qtyToGive || 0),
      0
    );
    setSaleData((prev) => ({ ...prev, totalAmount: total }));
  }, [saleData.prescriptions]);

  // ฟังก์ชันเพิ่มยา
  const addMedicine = (med: any) => {
    if (saleData.prescriptions.find((p) => p.id === med.id))
      return alert('ยานี้อยู่ในรายการแล้ว');
    setSaleData({
      ...saleData,
      prescriptions: [
        ...saleData.prescriptions,
        { ...med, qtyToGive: 1, isService: false },
      ],
    });
    setIsModalOpen(false);
    setMedSearch('');
  };

  // ฟังก์ชันเพิ่มบริการ
  const addServiceToVisit = (serviceName: string) => {
    const serviceId = `svc_${Date.now()}`;
    const newServiceItem = {
      id: serviceId,
      tradeName: serviceName,
      qtyToGive: 1,
      sellingPrice: 0,
      isService: true,
    };
    setSaleData({
      ...saleData,
      prescriptions: [...saleData.prescriptions, newServiceItem],
    });
    setIsServiceModalOpen(false);
  };

  const handleAddServiceOption = async () => {
    if (!newServiceLabel.trim()) return alert('กรุณาระบุชื่อค่าบริการ');
    try {
      await addDoc(collection(db, 'settings_services'), {
        label: newServiceLabel.trim(),
      });
      setNewServiceLabel('');
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const updateQty = (id: string, qty: string) => {
    const updated = saleData.prescriptions.map((p) =>
      p.id === id ? { ...p, qtyToGive: Number(qty) } : p
    );
    setSaleData({ ...saleData, prescriptions: updated });
  };

  const updateItemPrice = (id: string, price: string) => {
    const updated = saleData.prescriptions.map((p) =>
      p.id === id ? { ...p, sellingPrice: Number(price) } : p
    );
    setSaleData({ ...saleData, prescriptions: updated });
  };

  const removeMedicine = (id: string) => {
    setSaleData({
      ...saleData,
      prescriptions: saleData.prescriptions.filter((p) => p.id !== id),
    });
  };

  // 💰 ฟังก์ชันยืนยันการขาย และตัดสต็อก 💰
  const handleConfirmSale = async () => {
    if (saleData.prescriptions.length === 0) return alert('กรุณาเลือกรายการยา');
    if (!window.confirm('ยืนยันการขายและตัดสต็อก?')) return;

    try {
      const vn = `POS${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // บันทึกลง Visits เพื่อส่งไปหน้า Reports
      await addDoc(collection(db, 'visits'), {
        cn: 'WALK-IN',
        patientName: 'ลูกค้าทั่วไป (หน้าร้าน)',
        vn: vn,
        visitDate: new Date().toISOString(),
        chiefComplaint: 'ซื้อยาหน้าร้าน',
        diagnosis: 'OTC Sale',
        prescriptions: saleData.prescriptions,
        totalAmount: saleData.totalAmount,
        updatedAt: new Date().toISOString(),
      });

      // ตัดสต็อกเฉพาะรายการที่เป็น "ยา"
      for (const med of saleData.prescriptions) {
        if (!med.isService) {
          const currentInStock = inventory.find((i) => i.id === med.id);
          if (currentInStock) {
            const newQty =
              Number(currentInStock.stockQty) - Number(med.qtyToGive);
            await updateDoc(doc(db, 'pharmacy', med.id), {
              stockQty: newQty.toString(),
            });
            await addDoc(collection(db, 'medicine_history'), {
              medicineId: med.id,
              type: 'OUT',
              amount: med.qtyToGive,
              note: `ขายหน้าร้าน (Ref: ${vn})`,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      alert('✅ บันทึกการขายและตัดสต็อกเรียบร้อย');
      setSaleData(initialSaleState);
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="reg-container">
      <BackButton />
      <div className="reg-card fade-in">
        <header className="reg-header" style={{ paddingBottom: '10px' }}>
          <h1>🛒 ขายยาหน้าร้าน (POS)</h1>
          <p style={{ color: '#64748b', marginBottom: '20px' }}>
            สำหรับการขายยาคนไข้ทั่วไปโดยไม่ลงทะเบียนประวัติ
          </p>

          {/* 🔘 ปุ่มคำสั่งแบบสั้นชิดซ้าย 🔘 */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              padding: '0 5px',
              justifyContent: 'flex-start',
            }}
          >
            <button
              type="button"
              className="btn-submit"
              style={{
                background: '#10b981',
                width: '130px',
                padding: '10px 0',
                fontSize: '0.85rem',
                borderRadius: '8px',
                margin: '0',
                flex: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onClick={() => setIsModalOpen(true)}
            >
              💊 เลือกยา
            </button>
            <button
              type="button"
              className="btn-submit"
              style={{
                background: '#6366f1',
                width: '130px',
                padding: '10px 0',
                fontSize: '0.85rem',
                borderRadius: '8px',
                margin: '0',
                flex: 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              onClick={() => setIsServiceModalOpen(true)}
            >
              🛠️ เลือกบริการ
            </button>
          </div>
        </header>

        {/* 📋 ส่วนรายการสินค้า (Receipt Style) 📋 */}
        <div
          className="reg-section"
          style={{ marginTop: '10px', borderTop: '1px solid #f1f5f9' }}
        >
          <div className="table-container">
            <table className="patient-table">
              <thead>
                <tr>
                  <th>รายการ</th>
                  <th style={{ textAlign: 'center', width: '80px' }}>จำนวน</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>ราคา</th>
                  <th style={{ textAlign: 'right', width: '100px' }}>รวม</th>
                  <th style={{ textAlign: 'center', width: '50px' }}>ลบ</th>
                </tr>
              </thead>
              <tbody>
                {saleData.prescriptions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>
                        {p.isService ? '🛠️ ' : ''}
                        {p.tradeName}
                      </strong>
                      <br />
                      <small>{p.strength || 'ค่าบริการ'}</small>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.isService ? (
                        '1'
                      ) : (
                        <input
                          type="number"
                          min="1"
                          value={p.qtyToGive}
                          onChange={(e) => updateQty(p.id, e.target.value)}
                          style={{
                            width: '100%',
                            textAlign: 'center',
                            padding: '5px',
                            borderRadius: '5px',
                            border: '1px solid #ddd',
                          }}
                        />
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.isService ? (
                        <input
                          type="number"
                          value={p.sellingPrice}
                          onChange={(e) =>
                            updateItemPrice(p.id, e.target.value)
                          }
                          style={{
                            width: '80px',
                            textAlign: 'right',
                            border: '1px solid #6366f1',
                            borderRadius: '6px',
                            padding: '4px',
                          }}
                        />
                      ) : (
                        Number(p.sellingPrice).toLocaleString()
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {(p.sellingPrice * p.qtyToGive).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => removeMedicine(p.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.1rem',
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saleData.prescriptions.length === 0 && (
              <p
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#94a3b8',
                }}
              >
                🛒 ยังไม่มีรายการในตะกร้า
              </p>
            )}
          </div>

          <div
            style={{
              textAlign: 'right',
              marginTop: '20px',
              padding: '20px',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontSize: '1.1rem', color: '#64748b' }}>
              ยอดรวมสุทธิ:
            </span>
            <span
              style={{
                fontSize: '2.2rem',
                fontWeight: '900',
                color: '#1e3a8a',
                marginLeft: '15px',
              }}
            >
              {saleData.totalAmount.toLocaleString()} ฿
            </span>
          </div>

          <button
            className="btn-submit"
            style={{
              marginTop: '20px',
              height: '60px',
              fontSize: '1.4rem',
              borderRadius: '15px',
              boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)',
            }}
            onClick={handleConfirmSale}
          >
            💰 ยืนยันการรับเงินและตัดสต็อก
          </button>
        </div>
      </div>

      {/* 💊 Modal เลือกยา 💊 */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '500px' }}>
            <h3 className="section-title">💊 ค้นหาและเลือกยา</h3>
            <input
              type="text"
              placeholder="พิมพ์ชื่อยา..."
              autoFocus
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '2px solid #e2e8f0',
              }}
            />
            <div
              className="v-search-dropdown"
              style={{
                position: 'static',
                marginTop: '10px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {inventory
                .filter((i) =>
                  i.tradeName.toLowerCase().includes(medSearch.toLowerCase())
                )
                .map((i) => (
                  <div
                    key={i.id}
                    className="v-search-item"
                    onClick={() => addMedicine(i)}
                  >
                    <div>
                      <strong>{i.tradeName}</strong>
                      <br />
                      <small>
                        คงเหลือ: {i.stockQty} | {i.sellingPrice} ฿
                      </small>
                    </div>
                    <div style={{ color: '#10b981', fontWeight: 'bold' }}>
                      เลือก ➔
                    </div>
                  </div>
                ))}
            </div>
            <button
              className="btn-cancel mt-4"
              style={{ width: '100%' }}
              onClick={() => setIsModalOpen(false)}
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}

      {/* 🛠️ Modal เลือกบริการ 🛠️ */}
      {isServiceModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsServiceModalOpen(false)}
        >
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '500px', padding: '0' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="section-title"
              style={{
                margin: '0',
                background: '#6366f1',
                padding: '20px',
                color: 'white',
              }}
            >
              🛠️ เลือกค่าบริการอื่นๆ
            </h3>
            <div style={{ padding: '20px' }}>
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px',
                  background: '#f8fafc',
                }}
              >
                {serviceOptions.map((opt) => (
                  <div
                    key={opt}
                    className="v-search-item"
                    style={{
                      padding: '12px 15px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      justifyContent: 'space-between',
                      background: 'white',
                    }}
                    onClick={() => addServiceToVisit(opt)}
                  >
                    <strong>{opt}</strong>
                    <div style={{ color: '#6366f1', fontWeight: 'bold' }}>
                      เลือก ➔
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: '#f5f3ff',
                  borderRadius: '15px',
                  border: '1px solid #ddd6fe',
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    color: '#4338ca',
                    marginBottom: '8px',
                  }}
                >
                  + เพิ่มบริการใหม่
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={newServiceLabel}
                    onChange={(e) => setNewServiceLabel(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '10px',
                      border: '2px solid #ddd6fe',
                    }}
                    placeholder="ระบุชื่อบริการ..."
                  />
                  <button
                    type="button"
                    className="btn-submit"
                    style={{ width: 'auto', padding: '0 15px' }}
                    onClick={handleAddServiceOption}
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>
              <button
                className="btn-cancel mt-4"
                style={{ width: '100%' }}
                onClick={() => setIsServiceModalOpen(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
