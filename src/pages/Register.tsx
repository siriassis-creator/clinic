import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';

// --- วิธีแก้ปัญหา Vite CJS/ESM Mismatch สำหรับ Library ที่อยู่ ---
import addressPackage from 'react-thailand-address-typeahead';
const { ThailandAddressTypeahead, ThailandAddressValue } = addressPackage;

import './Register.css';

const initialFormState = {
  cn: '',
  idCard: '',
  prefix: 'นาย',
  otherPrefix: '',
  firstName: '',
  lastName: '',
  gender: 'ชาย',
  age: '',
  birthDate: '',
  phone: '',
  addressDetail: '',
  province: '',
  district: '',
  subdistrict: '',
  zipcode: '',
  hasAllergy: 'ไม่มี',
  allergyDetail: '',
  hasUnderlyingDisease: 'ไม่มี',
  diseaseDetail: '',
  emergencyContact: '',
  emergencyPhone: '',
};

const currentYearBE = new Date().getFullYear() + 543;
const years = Array.from({ length: 120 }, (_, i) =>
  (currentYearBE - i).toString()
);
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

export default function Register() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('register');
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState(initialFormState);
  const [addressObj, setAddressObj] = useState(ThailandAddressValue.empty());
  const [birth, setBirth] = useState({ day: '', month: '', year: '' });

  const generateCN = (currentList: any[]) => {
    const nextNumber = currentList.length + 1;
    return 'CN' + nextNumber.toString().padStart(5, '0');
  };

  const fetchPatients = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'patients'));
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPatientsList(list);

      if (!editId) {
        setFormData((prev) => ({ ...prev, cn: generateCN(list) }));
      }
      return list; // 🆕 ส่งค่า list กลับออกไปเพื่อให้ handleSubmit ใช้งานได้ทันที
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [activeTab, editId]);

  useEffect(() => {
    if (birth.day && birth.month && birth.year) {
      const adYear = parseInt(birth.year, 10) - 543;
      setFormData((prev) => ({
        ...prev,
        birthDate: `${adYear}-${birth.month}-${birth.day}`,
      }));
    } else {
      setFormData((prev) => ({ ...prev, birthDate: '', age: '' }));
    }
  }, [birth]);

  useEffect(() => {
    if (formData.birthDate && formData.birthDate.length === 10) {
      const birthDate = new Date(formData.birthDate);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        )
          age--;
        setFormData((prev) => ({ ...prev, age: age.toString() }));
      }
    }
  }, [formData.birthDate]);

  const filteredPatients = patientsList.filter(
    (p) =>
      p.cn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phone?.replace(/-/g, '').includes(searchTerm.replace(/-/g, ''))
  );

  const formatPhone = (val: string) => {
    let res = val.replace(/\D/g, '');
    if (res.length > 3 && res.length <= 6)
      res = res.slice(0, 3) + '-' + res.slice(3);
    else if (res.length > 6)
      res = res.slice(0, 3) + '-' + res.slice(3, 6) + '-' + res.slice(6, 10);
    return res;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalPrefix =
        formData.prefix === 'อื่นๆ' ? formData.otherPrefix : formData.prefix;

      const now = new Date().toISOString();

      const baseData = {
        ...formData,
        prefix: finalPrefix,
        fullAddress: `${formData.addressDetail} ต.${formData.subdistrict} อ.${formData.district} จ.${formData.province} ${formData.zipcode}`,
        updatedAt: now,
      };

      if (editId) {
        await updateDoc(doc(db, 'patients', editId), baseData);
        alert('อัปเดตข้อมูลเรียบร้อย');
      } else {
        const dataToSave = {
          ...baseData,
          createdAt: now,
        };
        await addDoc(collection(db, 'patients'), dataToSave);
        alert('ลงทะเบียนคนไข้ใหม่เรียบร้อย (รหัส: ' + formData.cn + ')');
      }

      // 🆕 1. ดึงข้อมูลผู้ป่วยล่าสุดจากฐานข้อมูลทันที
      const updatedList = await fetchPatients();

      // 🆕 2. ส่งรายชื่อที่อัปเดตแล้วเข้าไปใน resetForm เพื่อคำนวณ CN ใหม่
      resetForm(updatedList);
    } catch (error) {
      console.error(error);
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleEditClick = (patient: any) => {
    setFormData(patient);
    if (patient.birthDate) {
      const [y, m, d] = patient.birthDate.split('-');
      setBirth({ day: d, month: m, year: (parseInt(y, 10) + 543).toString() });
    }
    setAddressObj({
      subdistrict: patient.subdistrict || '',
      district: patient.district || '',
      province: patient.province || '',
      postalCode: patient.zipcode || '',
    });
    setEditId(patient.id);
    setActiveTab('register');
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('ยืนยันการลบข้อมูลผู้ป่วยรายนี้?')) {
      await deleteDoc(doc(db, 'patients', id));
      fetchPatients();
    }
  };

  // 🆕 ปรับปรุงให้รับ currentList เข้ามาได้
  const resetForm = (currentList?: any[]) => {
    const listToUse = currentList || patientsList;
    setFormData({
      ...initialFormState,
      cn: generateCN(listToUse),
    });
    setAddressObj(ThailandAddressValue.empty());
    setBirth({ day: '', month: '', year: '' });
    setEditId(null);
  };

  return (
    <div className="reg-container">
      <BackButton />
      <div className="reg-card fade-in">
        <header className="reg-header">
          <h2>ทะเบียนผู้ป่วย</h2>
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
                {editId ? '✏️ แก้ไขข้อมูล' : '📝 ลงทะเบียนใหม่'}
              </button>
              <button
                className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('list');
                }}
              >
                📋 รายชื่อผู้ป่วย
              </button>
            </div>
            <div
              className={`search-container ${
                activeTab === 'list' ? 'show' : ''
              }`}
            >
              <input
                type="text"
                placeholder="🔍 ค้นหา CN, ชื่อ หรือเบอร์โทร..."
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
              <h3 className="section-title">👤 ประวัติส่วนตัว</h3>
              <div className="reg-row">
                <div className="reg-group flex-2">
                  <label>เลขบัตรประชาชน</label>
                  <input
                    type="text"
                    maxLength={13}
                    value={formData.idCard}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        idCard: e.target.value.replace(/\D/g, ''),
                      })
                    }
                  />
                </div>
                <div className="reg-group flex-1">
                  <label>CN (Auto)</label>
                  <input
                    type="text"
                    value={formData.cn}
                    readOnly
                    className="readonly-input"
                    style={{ fontWeight: 'bold', color: '#1e3a8a' }}
                  />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>คำนำหน้า</label>
                  <select
                    value={formData.prefix}
                    onChange={(e) =>
                      setFormData({ ...formData, prefix: e.target.value })
                    }
                  >
                    <option value="นาย">นาย</option>
                    <option value="นางสาว">นางสาว</option>
                    <option value="นาง">นาง</option>
                    <option value="เด็กชาย">เด็กชาย</option>
                    <option value="เด็กหญิง">เด็กหญิง</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>
                {formData.prefix === 'อื่นๆ' && (
                  <div className="reg-group flex-1">
                    <label>ระบุคำนำหน้า</label>
                    <input
                      type="text"
                      value={formData.otherPrefix}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          otherPrefix: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                )}
                <div className="reg-group flex-2">
                  <label>ชื่อ</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="reg-group flex-2">
                  <label>นามสกุล</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="reg-row">
                <div className="reg-group flex-2">
                  <label>วันเกิด</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={birth.day}
                      onChange={(e) =>
                        setBirth({ ...birth, day: e.target.value })
                      }
                      required
                      style={{ flex: 1 }}
                    >
                      <option value="">วัน</option>
                      {days.map((d) => (
                        <option key={d} value={d}>
                          {parseInt(d, 10)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={birth.month}
                      onChange={(e) =>
                        setBirth({ ...birth, month: e.target.value })
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
                      value={birth.year}
                      onChange={(e) =>
                        setBirth({ ...birth, year: e.target.value })
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
                <div className="reg-group flex-1">
                  <label>อายุ (ปี)</label>
                  <input
                    type="text"
                    value={formData.age}
                    readOnly
                    className="readonly-input"
                  />
                </div>
                <div className="reg-group flex-1">
                  <label>เพศ</label>
                  <select
                    value={formData.gender}
                    onChange={(e) =>
                      setFormData({ ...formData, gender: e.target.value })
                    }
                  >
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
                <div className="reg-group flex-2">
                  <label>เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    maxLength={12}
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: formatPhone(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>
            </div>

            <div className="reg-section">
              <h3 className="section-title">📍 ข้อมูลที่อยู่</h3>
              <div className="reg-group">
                <label>บ้านเลขที่ / ถนน</label>
                <input
                  type="text"
                  value={formData.addressDetail}
                  onChange={(e) =>
                    setFormData({ ...formData, addressDetail: e.target.value })
                  }
                  required
                />
              </div>
              <div style={{ position: 'relative' }}>
                <ThailandAddressTypeahead
                  value={addressObj}
                  onValueChange={(val: any) => {
                    setAddressObj(val);
                    setFormData((p) => ({
                      ...p,
                      subdistrict: val.subdistrict || '',
                      district: val.district || '',
                      province: val.province || '',
                      zipcode: val.postalCode || '',
                    }));
                  }}
                >
                  <div className="reg-row">
                    <div className="reg-group flex-1 typeahead-wrapper">
                      <label>ตำบล</label>
                      <ThailandAddressTypeahead.SubdistrictInput placeholder="ตำบล..." />
                    </div>
                    <div className="reg-group flex-1 typeahead-wrapper">
                      <label>อำเภอ</label>
                      <ThailandAddressTypeahead.DistrictInput placeholder="อำเภอ..." />
                    </div>
                    <div className="reg-group flex-1 typeahead-wrapper">
                      <label>จังหวัด</label>
                      <ThailandAddressTypeahead.ProvinceInput placeholder="จังหวัด..." />
                    </div>
                    <div className="reg-group flex-1 typeahead-wrapper">
                      <label>รหัสไปรษณีย์</label>
                      <ThailandAddressTypeahead.PostalCodeInput placeholder="รหัส..." />
                    </div>
                  </div>
                  <div id="address-dropdown-container">
                    <ThailandAddressTypeahead.Suggestion
                      containerProps={{ className: 'thai-suggestion-box' }}
                      optionItemProps={{ className: 'thai-suggestion-item' }}
                    />
                  </div>
                </ThailandAddressTypeahead>
              </div>
            </div>

            <div className="reg-section">
              <h3 className="section-title">🏥 ประวัติทางการแพทย์</h3>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>แพ้ยา/อาหาร</label>
                  <select
                    value={formData.hasAllergy}
                    onChange={(e) =>
                      setFormData({ ...formData, hasAllergy: e.target.value })
                    }
                  >
                    <option value="ไม่มี">ไม่มี</option>
                    <option value="มี">มี</option>
                  </select>
                </div>
                {formData.hasAllergy === 'มี' && (
                  <div className="reg-group flex-3">
                    <label className="danger-text">ระบุสิ่งที่แพ้</label>
                    <input
                      type="text"
                      value={formData.allergyDetail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          allergyDetail: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                )}
              </div>
              <div className="reg-row">
                <div className="reg-group flex-1">
                  <label>โรคประจำตัว</label>
                  <select
                    value={formData.hasUnderlyingDisease}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hasUnderlyingDisease: e.target.value,
                      })
                    }
                  >
                    <option value="ไม่มี">ไม่มี</option>
                    <option value="มี">มี</option>
                  </select>
                </div>
                {formData.hasUnderlyingDisease === 'มี' && (
                  <div className="reg-group flex-3">
                    <label>ระบุโรคประจำตัว</label>
                    <input
                      type="text"
                      value={formData.diseaseDetail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          diseaseDetail: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="reg-section">
              <h3 className="section-title">📞 ผู้ติดต่อฉุกเฉิน</h3>
              <div className="reg-row">
                <div className="reg-group flex-2">
                  <label>ชื่อผู้ติดต่อ</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyContact: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="reg-group flex-1">
                  <label>เบอร์โทรศัพท์</label>
                  <input
                    type="tel"
                    maxLength={12}
                    value={formData.emergencyPhone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emergencyPhone: formatPhone(e.target.value),
                      })
                    }
                  />
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
                ✖ {editId ? 'ยกเลิก' : 'กลับ'}
              </button>
              <button type="submit" className="btn-submit">
                💾 {editId ? 'อัปเดตข้อมูล' : 'ลงทะเบียน'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'list' && (
          <div className="table-container fade-in">
            {filteredPatients.length === 0 ? (
              <p className="empty-text">ไม่พบข้อมูล</p>
            ) : (
              <table className="patient-table">
                <thead>
                  <tr>
                    <th>CN</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>อายุ</th>
                    <th>เบอร์โทร</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.cn}</td>
                      <td>
                        {p.prefix}
                        {p.firstName} {p.lastName}
                      </td>
                      <td>{p.age} ปี</td>
                      <td>{p.phone}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-action edit"
                          onClick={() => handleEditClick(p)}
                        >
                          ✏️ แก้ไข
                        </button>
                        <button
                          className="btn-action delete"
                          onClick={() => handleDeleteClick(p.id)}
                        >
                          🗑️ ลบ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
