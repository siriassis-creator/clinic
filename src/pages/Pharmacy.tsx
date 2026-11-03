import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import './Pharmacy.css';

const initialFormState = {
  tradeName: '',
  genericName: '',
  strength: '',
  dosageForm: '',
  stockQty: '',
  unit: '',
  minAlert: '',
  costPrice: '',
  sellingPrice: '',
  expiryDate: '',
};

const days = Array.from({ length: 31 }, (_, i) =>
  (i + 1).toString().padStart(2, '0')
);
const months = [
  { val: '01', label: 'มกราคม' },
  { val: '02', label: 'กุมภาพันธ์' },
  { val: '03', label: 'มีนาคม' },
  { val: '04', label: 'เมษายน' },
  { val: '05', label: 'พฤษภาคม' },
  { val: '06', label: 'มิถุนายน' },
  { val: '07', label: 'กรกฎาคม' },
  { val: '08', label: 'สิงหาคม' },
  { val: '09', label: 'กันยายน' },
  { val: '10', label: 'ตุลาคม' },
  { val: '11', label: 'พฤศจิกายน' },
  { val: '12', label: 'ธันวาคม' },
];
const currentYearBE = new Date().getFullYear() + 543;
const years = Array.from({ length: 15 }, (_, i) =>
  (currentYearBE + i).toString()
);

export default function Pharmacy() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [medicineList, setMedicineList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormState);
  const [expiry, setExpiry] = useState({ day: '', month: '', year: '' });
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedMedName, setSelectedMedName] = useState('');
  const [dosageOptions, setDosageOptions] = useState<string[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);

  const [showSuggest, setShowSuggest] = useState(false);
  const [isDosageModalOpen, setIsDosageModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [newDosage, setNewDosage] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [pharmacyCount, setPharmacyCount] = useState(0);
  const [isFilterLowStock, setIsFilterLowStock] = useState(false);

  const loadAllData = async () => {
    try {
      const unsub = onSnapshot(collection(db, 'pharmacy'), (snap) => {
        const list: any[] = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMedicineList(list);
        setPharmacyCount(
          list.filter((m) => Number(m.stockQty) <= Number(m.minAlert)).length
        );
      });

      const dSnap = await getDocs(collection(db, 'settings_dosage'));
      const uSnap = await getDocs(collection(db, 'settings_unit'));
      setDosageOptions(dSnap.docs.map((doc) => doc.data().label).sort());
      setUnitOptions(uSnap.docs.map((doc) => doc.data().label).sort());

      return unsub;
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [activeTab]);

  const handleViewHistory = async (m: any) => {
    setSelectedMedName(m.tradeName);
    try {
      const q = query(
        collection(db, 'medicine_history'),
        where('medicineId', '==', m.id),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      setHistoryList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setShowHistoryModal(true);
    } catch (e) {
      alert('ไม่สามารถโหลดประวัติได้');
    }
  };

  // 🆕 ฟังก์ชัน Export ประวัติยาเป็น Excel (CSV)
  const handleExportHistory = () => {
    if (historyList.length === 0) return alert('ไม่มีข้อมูลสำหรับส่งออก');

    const headers = ['วันที่/เวลา', 'ประเภท', 'จำนวน', 'หมายเหตุ/อ้างอิง'];
    const csvRows = [headers.join(',')];

    historyList.forEach((h) => {
      const typeLabel =
        h.type === 'IN' ? 'รับเข้า' : h.type === 'OUT' ? 'จ่ายออก' : 'แก้ไข';
      const values = [
        `"${new Date(h.timestamp).toLocaleString('th-TH')}"`,
        `"${typeLabel}"`,
        `"${h.amount}"`,
        `"${h.note?.replace('HN:', 'CN:') || '-'}"`, // แทนที่ HN เป็น CN ตามระบบล่าสุด
      ];
      csvRows.push(values.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvString], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ประวัติยา_${selectedMedName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteMedicine = async (id: string) => {
    if (
      window.confirm(
        '⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบรายการยานี้? ข้อมูลจะหายไปถาวร'
      )
    ) {
      try {
        await deleteDoc(doc(db, 'pharmacy', id));
        alert('ลบข้อมูลสำเร็จ');
      } catch (e) {
        alert('เกิดข้อผิดพลาดในการลบข้อมูล');
      }
    }
  };

  const handleSelectSuggest = (m: any) => {
    setFormData({
      ...formData,
      tradeName: m.tradeName,
      genericName: m.genericName,
      strength: m.strength,
      dosageForm: m.dosageForm,
      unit: m.unit,
      minAlert: m.minAlert,
      sellingPrice: m.sellingPrice,
    });
    setShowSuggest(false);
  };

  const handleAddOption = async (type: 'dosage' | 'unit') => {
    const value = type === 'dosage' ? newDosage : newUnit;
    const colName = type === 'dosage' ? 'settings_dosage' : 'settings_unit';
    if (!value.trim()) return alert('กรุณาระบุข้อมูล');
    try {
      await addDoc(collection(db, colName), { label: value.trim() });
      if (type === 'dosage') {
        setDosageOptions([...dosageOptions, value.trim()].sort());
        setNewDosage('');
        setIsDosageModalOpen(false);
      } else {
        setUnitOptions([...unitOptions, value.trim()].sort());
        setNewUnit('');
        setIsUnitModalOpen(false);
      }
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    }
  };

  useEffect(() => {
    if (expiry.day && expiry.month && expiry.year) {
      const adYear = parseInt(expiry.year, 10) - 543;
      setFormData((prev) => ({
        ...prev,
        expiryDate: `${adYear}-${expiry.month}-${expiry.day}`,
      }));
    }
  }, [expiry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.expiryDate) return alert('กรุณาเลือกวันหมดอายุ');

    try {
      const existingMed = !editId
        ? medicineList.find(
            (m) =>
              m.tradeName.toLowerCase().trim() ===
                formData.tradeName.toLowerCase().trim() &&
              m.strength.trim() === formData.strength.trim() &&
              m.dosageForm === formData.dosageForm
          )
        : null;

      if (editId) {
        await updateDoc(doc(db, 'pharmacy', editId), {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        await addDoc(collection(db, 'medicine_history'), {
          medicineId: editId,
          type: 'UPDATE',
          amount: formData.stockQty,
          note: 'แก้ไขข้อมูลเวชภัณฑ์',
          timestamp: new Date().toISOString(),
        });
        alert('อัปเดตข้อมูลสำเร็จ');
      } else if (existingMed) {
        const newTotalQty =
          Number(existingMed.stockQty) + Number(formData.stockQty);
        await updateDoc(doc(db, 'pharmacy', existingMed.id), {
          stockQty: newTotalQty.toString(),
          costPrice: formData.costPrice,
          sellingPrice: formData.sellingPrice,
          expiryDate: formData.expiryDate,
          updatedAt: new Date().toISOString(),
        });
        await addDoc(collection(db, 'medicine_history'), {
          medicineId: existingMed.id,
          type: 'IN',
          amount: formData.stockQty,
          note: `รับเข้าเพิ่ม (รวมยอดเดิม ${existingMed.stockQty})`,
          timestamp: new Date().toISOString(),
        });
        alert(`รวมยอดเข้ากับรายการเดิมเรียบร้อย (คงเหลือใหม่: ${newTotalQty})`);
      } else {
        const docRef = await addDoc(collection(db, 'pharmacy'), {
          ...formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        await addDoc(collection(db, 'medicine_history'), {
          medicineId: docRef.id,
          type: 'IN',
          amount: formData.stockQty,
          note: 'รับยาเข้าคลังครั้งแรก',
          timestamp: new Date().toISOString(),
        });
        alert('บันทึกยาใหม่สำเร็จ');
      }
      resetForm();
      setActiveTab('list');
    } catch (error) {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setExpiry({ day: '', month: '', year: '' });
    setEditId(null);
  };

  const displayList = medicineList.filter((m) => {
    const matchesSearch =
      m.tradeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.genericName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLowStock = isFilterLowStock
      ? Number(m.stockQty) <= Number(m.minAlert)
      : true;

    return matchesSearch && matchesLowStock;
  });

  const lowStockItemsCount = medicineList.filter(
    (m) => Number(m.stockQty) <= Number(m.minAlert)
  ).length;

  return (
    <div className="reg-container">
      <BackButton />
      <div className="reg-card fade-in">
        <header className="reg-header">
          <h2>คลังยาและเวชภัณฑ์</h2>
          <div className="tab-row mt-4">
            <div className="tab-menu">
              <button
                className={`tab-btn ${
                  activeTab === 'register' ? 'active' : ''
                }`}
                onClick={() => {
                  setActiveTab('register');
                  setSearchTerm('');
                  if (!editId) resetForm();
                }}
              >
                {editId ? '✏️ แก้ไขข้อมูลยา' : '➕ เพิ่มยาใหม่'}
              </button>
              <button
                className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
              >
                📋 รายการยา
              </button>
            </div>

            <div
              className={`search-container ${
                activeTab === 'list' ? 'show' : ''
              }`}
            >
              <input
                type="text"
                placeholder="🔍 ค้นหาชื่อยา หรือชื่อสามัญ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-inline"
              />
            </div>
          </div>
        </header>

        {activeTab === 'register' && (
          <form onSubmit={handleSubmit} className="reg-form fade-in">
            <div className="reg-section">
              <h3 className="section-title">💊 รายละเอียดเวชภัณฑ์/ยา</h3>
              <div className="reg-row">
                <div
                  className="reg-group flex-3"
                  style={{ position: 'relative' }}
                >
                  <label>ชื่อทางการค้า</label>
                  <input
                    type="text"
                    placeholder="พิมพ์ชื่อยา..."
                    value={formData.tradeName}
                    onChange={(e) => {
                      setFormData({ ...formData, tradeName: e.target.value });
                      setShowSuggest(true);
                    }}
                    onBlur={() => setTimeout(() => setShowSuggest(false), 250)}
                    required
                  />
                  {showSuggest && formData.tradeName.length > 0 && (
                    <div className="thai-suggestion-box">
                      {medicineList
                        .filter((m) =>
                          m.tradeName
                            .toLowerCase()
                            .includes(formData.tradeName.toLowerCase())
                        )
                        .slice(0, 5)
                        .map((m, i) => (
                          <div
                            key={i}
                            className="thai-suggestion-item"
                            onClick={() => handleSelectSuggest(m)}
                          >
                            <strong>{m.tradeName}</strong>{' '}
                            <small>
                              ({m.genericName} - {m.strength})
                            </small>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <div className="reg-group flex-3">
                  <label>ชื่อสามัญทางยา</label>
                  <input
                    type="text"
                    value={formData.genericName}
                    onChange={(e) =>
                      setFormData({ ...formData, genericName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>ความแรง</label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={(e) =>
                      setFormData({ ...formData, strength: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="reg-group flex-1">
                  <label style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
                    รูปแบบ
                  </label>
                  <div style={{ display: 'flex' }}>
                    <select
                      value={formData.dosageForm}
                      onChange={(e) =>
                        setFormData({ ...formData, dosageForm: e.target.value })
                      }
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: '2px solid #1e3a8a',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                      }}
                      required
                    >
                      <option value="">เลือกรูปแบบ</option>
                      {dosageOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsDosageModalOpen(true)}
                      style={{
                        padding: '0 15px',
                        background: '#1e3a8a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        marginLeft: '10px',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="reg-section">
              <h3 className="section-title">📊 สต็อกและการเงิน</h3>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>จำนวนรับเข้า</label>
                  <input
                    type="number"
                    value={formData.stockQty}
                    onChange={(e) =>
                      setFormData({ ...formData, stockQty: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="reg-group flex-1">
                  <label style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
                    หน่วยนับ
                  </label>
                  <div style={{ display: 'flex' }}>
                    <select
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: '2px solid #1e3a8a',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                      }}
                      required
                    >
                      <option value="">เลือกหน่วย</option>
                      {unitOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsUnitModalOpen(true)}
                      style={{
                        padding: '0 15px',
                        background: '#1e3a8a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        marginLeft: '10px',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="reg-group flex-1">
                  <label>จุดเตือนขั้นต่ำ</label>
                  <input
                    type="number"
                    value={formData.minAlert}
                    onChange={(e) =>
                      setFormData({ ...formData, minAlert: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>ทุน/หน่วย</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, costPrice: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="reg-group flex-1">
                  <label>ขาย/หน่วย</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, sellingPrice: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="reg-group flex-2">
                  <label>วันหมดอายุ (พ.ศ.)</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <select
                      value={expiry.day}
                      onChange={(e) =>
                        setExpiry({ ...expiry, day: e.target.value })
                      }
                      required
                      style={{ flex: 1 }}
                    >
                      <option value="">วัน</option>
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {parseInt(d)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={expiry.month}
                      onChange={(e) =>
                        setExpiry({ ...expiry, month: e.target.value })
                      }
                      required
                      style={{ flex: 1.5 }}
                    >
                      <option value="">เดือน</option>
                      {months.map((m) => (
                        <option key={m.val} value={m.val}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={expiry.year}
                      onChange={(e) =>
                        setExpiry({ ...expiry, year: e.target.value })
                      }
                      required
                      style={{ flex: 1.2 }}
                    >
                      <option value="">พ.ศ.</option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="reg-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  if (editId) {
                    resetForm();
                    setActiveTab('list');
                  } else navigate('/');
                }}
              >
                ✖ กลับ
              </button>
              <button type="submit" className="btn-submit">
                💾 {editId ? 'อัปเดตข้อมูล' : 'บันทึกเข้าคลัง'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'list' && (
          <div className="fade-in">
            <div
              onClick={() => setIsFilterLowStock(!isFilterLowStock)}
              style={{
                background: isFilterLowStock ? '#ef4444' : '#f8fafc',
                color: isFilterLowStock ? 'white' : '#1e3a8a',
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '20px',
                border: isFilterLowStock ? 'none' : '2px dashed #1e3a8a',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                boxShadow: isFilterLowStock
                  ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                  : 'none',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                  {lowStockItemsCount > 0
                    ? `🔔 มีรายการสต็อกต่ำ ${lowStockItemsCount} รายการ`
                    : '✅ สต็อกปกติทุกรายการ'}
                </h3>
                <p
                  style={{
                    margin: '5px 0 0 0',
                    opacity: 0.8,
                    fontSize: '0.9rem',
                  }}
                >
                  {isFilterLowStock
                    ? 'กำลังแสดงเฉพาะรายการที่ต้องสั่งซื้อเพิ่ม (คลิกเพื่อดูทั้งหมด)'
                    : 'อิงตามจุดเตือนขั้นต่ำที่กำหนดไว้ (คลิกเพื่อกรองข้อมูล)'}
                </p>
              </div>
              <div style={{ fontSize: '1.5rem' }}>
                {isFilterLowStock ? '🔍' : '📦'}
              </div>
            </div>

            <div className="table-container">
              <table className="patient-table">
                <thead>
                  <tr>
                    <th>ชื่อยา</th>
                    <th>คงเหลือ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.tradeName}</strong>
                        <br />
                        <small>
                          {m.genericName} {m.strength}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            Number(m.stockQty) <= Number(m.minAlert)
                              ? 'badge-red'
                              : 'badge-orange'
                          }`}
                        >
                          {m.stockQty} {m.unit}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-action edit"
                          onClick={() => {
                            setFormData(m);
                            setEditId(m.id);
                            setActiveTab('register');
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-action history"
                          style={{
                            background: '#10b981',
                            color: 'white',
                            marginLeft: '5px',
                          }}
                          onClick={() => handleViewHistory(m)}
                        >
                          🕒
                        </button>
                        <button
                          className="btn-action delete"
                          style={{
                            background: '#ef4444',
                            color: 'white',
                            marginLeft: '5px',
                          }}
                          onClick={() => handleDeleteMedicine(m.id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {displayList.length === 0 && (
                <p
                  className="empty-text"
                  style={{ textAlign: 'center', padding: '20px' }}
                >
                  ไม่พบข้อมูลรายการยา
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showHistoryModal && (
        <div className="modal-overlay">
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '800px', position: 'relative' }}
          >
            {/* 🆕 ปุ่ม Export Excel ไว้มุมขวาบนของ Popup */}
            <button
              onClick={handleExportHistory}
              style={{
                position: 'absolute',
                top: '15px',
                right: '20px',
                background: '#ffffff',
                color: '#10b981',
                border: 'none',
                padding: '5px 15px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                zIndex: 10,
              }}
            >
              📥 Export Excel
            </button>

            <h3
              className="section-title"
              style={{
                background: '#10b981',
                margin: '-30px -30px 20px -30px',
                paddingRight: '150px', // กันชื่อยาซ้อนกับปุ่ม
              }}
            >
              🕒 ประวัติการเคลื่อนไหว: {selectedMedName}
            </h3>
            <div
              className="table-container"
              style={{ maxHeight: '400px', overflowY: 'auto' }}
            >
              <table className="patient-table">
                <thead>
                  <tr>
                    <th>วันที่/เวลา</th>
                    <th>ประเภท</th>
                    <th>จำนวน</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h) => (
                    <tr key={h.id}>
                      <td>{new Date(h.timestamp).toLocaleString('th-TH')}</td>
                      <td>
                        <span
                          className={`badge ${
                            h.type === 'IN'
                              ? 'badge-green'
                              : h.type === 'OUT'
                              ? 'badge-red'
                              : ''
                          }`}
                        >
                          {h.type === 'IN'
                            ? 'รับเข้า'
                            : h.type === 'OUT'
                            ? 'จ่ายออก'
                            : 'แก้ไข'}
                        </span>
                      </td>
                      <td>{h.amount}</td>
                      <td>{h.note?.replace('HN:', 'CN:')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '20px',
              }}
            >
              <button
                className="btn-cancel"
                style={{ width: '200px' }}
                onClick={() => setShowHistoryModal(false)}
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {isDosageModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '400px' }}>
            <h3 className="section-title">➕ เพิ่มรูปแบบยา</h3>
            <div className="reg-form">
              <div className="reg-group">
                <label>ชื่อรูปแบบยา</label>
                <input
                  type="text"
                  value={newDosage}
                  onChange={(e) => setNewDosage(e.target.value)}
                  placeholder="เช่น Tablet, Syrup..."
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn-cancel"
                  style={{ flex: 1 }}
                  onClick={() => setIsDosageModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn-submit"
                  style={{ flex: 1 }}
                  onClick={() => handleAddOption('dosage')}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isUnitModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '400px' }}>
            <h3 className="section-title">➕ เพิ่มหน่วยนับ</h3>
            <div className="reg-form">
              <div className="reg-group">
                <label>ชื่อหน่วยนับ</label>
                <input
                  type="text"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  placeholder="เช่น เม็ด, ขวด, แผง..."
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn-cancel"
                  style={{ flex: 1 }}
                  onClick={() => setIsUnitModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn-submit"
                  style={{ flex: 1 }}
                  onClick={() => handleAddOption('unit')}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
