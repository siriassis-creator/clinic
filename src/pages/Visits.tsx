import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import BackButton from '../components/BackButton';
import './Visits.css';
import './VisitWorkspace.css';
import { discardCase, finishCase, saveCaseDraft, startCase, stageLabel } from '../services/visitWorkflow';

const initialVisitState = {
  chiefComplaint: '',
  weight: '',
  height: '',
  temp: '',
  resp: '',
  pulse: '',
  bp: '',
  o2sat: '',
  diagnosis: '',
  treatment: '',
  nextAppt: '',
  prescriptions: [] as any[],
  totalAmount: 0,
};

function PatientCase({ patient, caseId, seed, isDiscarding }: { patient: any; caseId: string; seed: any; isDiscarding: () => boolean }) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'record'>(
    'record'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const selectedPatient = patient;
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<any | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [editVisitId, setEditVisitId] = useState<string | null>(null);
  const [visitData, setVisitData] = useState({ ...initialVisitState, ...seed });
  const [stage, setStage] = useState(seed.workflowStatus || 'draft');
  const [saveState, setSaveState] = useState('บันทึกฉบับร่างแล้ว');
  const [busy, setBusy] = useState(false);
  const revision = useRef(seed.revision || 0);
  const queue = useRef(Promise.resolve());
  const latest = useRef(visitData);
  const stageRef = useRef(stage);
  latest.current = visitData;
  stageRef.current = stage;
  const [conflict, setConflict] = useState(false);

  const [dxOptions, setDxOptions] = useState<string[]>([]);
  const [isDxModalOpen, setIsDxModalOpen] = useState(false);
  const [newDx, setNewDx] = useState('');

  // --- States สำหรับค่าบริการอื่นๆ ---
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [newServiceLabel, setNewServiceLabel] = useState('');

  const [modalTab, setModalTab] = useState(1);

  useEffect(() => {
    const unsubP = onSnapshot(collection(db, 'patients'), (snap) => {
      setAllPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubM = onSnapshot(collection(db, 'pharmacy'), (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubDx = onSnapshot(collection(db, 'settings_diagnosis'), (snap) => {
      setDxOptions(snap.docs.map((doc) => doc.data().label).sort());
    });
    // ดึงรายการค่าบริการจาก Setting
    const unsubSvc = onSnapshot(collection(db, 'settings_services'), (snap) => {
      setServiceOptions(snap.docs.map((doc) => doc.data().label).sort());
    });

    return () => {
      unsubP();
      unsubM();
      unsubDx();
      unsubSvc();
    };
  }, []);

  const handleAddDx = async () => {
    if (!newDx.trim()) return alert('กรุณาระบุชื่อการวินิจฉัย');
    try {
      await addDoc(collection(db, 'settings_diagnosis'), {
        label: newDx.trim(),
      });
      setNewDx('');
      setIsDxModalOpen(false);
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    }
  };

  // ฟังก์ชันเพิ่มรายการค่าบริการใหม่ลง Setting
  const handleAddServiceOption = async () => {
    if (!newServiceLabel.trim()) return alert('กรุณาระบุชื่อค่าบริการ');
    try {
      await addDoc(collection(db, 'settings_services'), {
        label: newServiceLabel.trim(),
      });
      setNewServiceLabel('');
      alert('เพิ่มรายการค่าบริการสำเร็จ ✨');
    } catch (e) {
      alert('เกิดข้อผิดพลาด');
    }
  };

  useEffect(() => {
    return onSnapshot(query(collection(db, 'visits'), where('cn', '==', patient.cn)), snap => {
      const history = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
        .filter(v => !v.workflowStatus || v.workflowStatus === 'paid');
      setPatientHistory(history.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()));
    });
  }, [patient.cn]);

  useEffect(() => {
    const total = visitData.prescriptions.reduce((sum: number, item: any) => sum + Number(item.sellingPrice || 0) * Number(item.qtyToGive || 0), 0);
    setVisitData((prev: any) => prev.totalAmount === total ? prev : { ...prev, totalAmount: total });
  }, [visitData.prescriptions]);

  const persist = (data: any) => {
    setSaveState('กำลังเก็บฉบับร่าง...');
    const task = queue.current.then(async () => {
      if (isDiscarding()) return;
      revision.current = await saveCaseDraft(caseId, data, revision.current, seed.episodeId);
      setSaveState('บันทึกฉบับร่างแล้ว');
    });
    queue.current = task.catch(() => {});
    return task.catch(error => {
      setSaveState('บันทึกไม่สำเร็จ: ' + error.message);
      if (error.message.includes('อุปกรณ์อื่น')) setConflict(true);
      throw error;
    });
  };
  useEffect(() => {
    if (stage !== 'draft' || editVisitId || conflict) return;
    const timer = setTimeout(() => { void persist(visitData).catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [visitData, stage, editVisitId, conflict]);
  useEffect(() => () => {
    if (stageRef.current === 'draft' && !isDiscarding()) void persist(latest.current).catch(() => {});
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveState !== 'บันทึกฉบับร่างแล้ว') { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const addMedicine = (med: any) => {
    if (visitData.prescriptions.find((p: any) => p.id === med.id))
      return alert('ยานี้อยู่ในรายการแล้ว');
    setVisitData({
      ...visitData,
      prescriptions: [
        ...visitData.prescriptions,
        { ...med, qtyToGive: 1, isService: false },
      ],
    });
    setMedSearch('');
    setIsPrescriptionModalOpen(false);
  };

  // ฟังก์ชันเลือกค่าบริการเพิ่มลงในตาราง
  const addServiceToVisit = (serviceName: string) => {
    const serviceId = `svc_${Date.now()}`;
    const newServiceItem = {
      id: serviceId,
      tradeName: serviceName,
      qtyToGive: 1,
      sellingPrice: 0,
      isService: true, // กำกับไว้เพื่อไม่ให้ตัดสต็อกยา
    };
    setVisitData({
      ...visitData,
      prescriptions: [...visitData.prescriptions, newServiceItem],
    });
    setIsServiceModalOpen(false);
  };

  const updateMedQty = (id: string, qty: string) => {
    const updated = visitData.prescriptions.map((p: any) =>
      p.id === id ? { ...p, qtyToGive: Number(qty) } : p
    );
    setVisitData({ ...visitData, prescriptions: updated });
  };

  // ฟังก์ชันอัปเดตราคา (สำหรับค่าบริการโดยเฉพาะ)
  const updateItemPrice = (id: string, price: string) => {
    const updated = visitData.prescriptions.map((p: any) =>
      p.id === id ? { ...p, sellingPrice: Number(price) } : p
    );
    setVisitData({ ...visitData, prescriptions: updated });
  };

  const removeMedicine = (id: string) => {
    setVisitData({
      ...visitData,
      prescriptions: visitData.prescriptions.filter((p: any) => p.id !== id),
    });
  };

  const transition = async () => {
    if (busy || conflict || isDiscarding()) return;
    if (stage === 'draft' && (!visitData.chiefComplaint || !visitData.diagnosis)) {
      alert('กรุณาระบุอาการสำคัญและการวินิจฉัย'); return;
    }
    const next = stage === 'draft' ? 'awaiting_medicine' : stage === 'awaiting_medicine' ? 'awaiting_payment' : 'paid';
    if (!window.confirm(next === 'paid' ? `ยืนยันรับชำระ ${visitData.totalAmount} บาท?` : next === 'awaiting_payment' ? 'ยืนยันส่งมอบยาและตัดสต็อก?' : 'ยืนยันตรวจเสร็จ? ยังไม่ตัดยาและยังไม่รับชำระเงิน')) return;
    setBusy(true);
    try {
      if (stage === 'draft') await persist(visitData);
      await queue.current;
      const result = await finishCase(caseId, stage, revision.current, seed.episodeId);
      revision.current = result.revision;
      setStage(next);
      setSaveState(next === 'paid' ? 'รับชำระแล้ว' : 'บันทึกสถานะแล้ว');
    } catch (error: any) { alert(error.message); }
    finally { setBusy(false); }
  };
  const handleSaveVisit = async (e: React.FormEvent) => { e.preventDefault(); await transition(); };
  const handleEditClick = (_visit?: any) => alert('ประวัติที่จ่ายยาแล้วเปิดดูได้เท่านั้น กรุณาเปิดเคสใหม่สำหรับการตรวจครั้งใหม่');

  return (
    <div className={selectedPatient ? 'reg-container' : 'v-full-screen'}>
      <div className="case-status-bar">
        <strong>{stageLabel(stage)}</strong><span role="status">{saveState}</span>
        {stage !== 'paid' && <button type="button" disabled={busy || conflict} onClick={transition}>
          {busy ? 'กำลังดำเนินการ...' : stage === 'draft' ? 'ตรวจเสร็จ → รอรับยา' : stage === 'awaiting_medicine' ? 'ยืนยันจ่ายยา → รอชำระเงิน' : `รับชำระ ${visitData.totalAmount} บาท`}
        </button>}
      </div>

      {selectedPatient && (
        <div className="reg-card fade-in">
          <header className="reg-header">
            <div className="header-info">
              <h2>
                {selectedPatient.prefix}
                {selectedPatient.firstName} {selectedPatient.lastName}
              </h2>
              <p>
                CN: <strong>{selectedPatient.cn}</strong> | อายุ:{' '}
                {selectedPatient.age} ปี
              </p>
              <dl className="patient-clinical-summary">
                <div>
                  <dt>โรคประจำตัว</dt>
                  <dd>{selectedPatient.diseaseDetail?.trim() || (selectedPatient.hasUnderlyingDisease === 'มี' ? 'มี แต่ยังไม่ระบุรายละเอียด' : selectedPatient.hasUnderlyingDisease === 'ไม่มี' ? 'ไม่มี' : 'ยังไม่ระบุ')}</dd>
                </div>
                <div className="patient-allergy">
                  <dt>⚠️ การแพ้ยา</dt>
                  <dd>{selectedPatient.allergyDetail?.trim() || (selectedPatient.hasAllergy === 'มี' ? 'มี แต่ยังไม่ระบุรายละเอียด' : selectedPatient.hasAllergy === 'ไม่มี' ? 'ไม่มี' : 'ยังไม่ระบุ')}</dd>
                </div>
              </dl>
            </div>
            <div className="tab-row mt-4">
              <div className="tab-menu">
                <button
                  className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                  onClick={() => setActiveTab('info')}
                >
                  👤 ข้อมูลทั่วไป
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === 'record' ? 'active' : ''
                  }`}
                  onClick={() => {

                    setActiveTab('record');
                  }}
                >
                  🩺 บันทึกตรวจรักษา
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === 'history' ? 'active' : ''
                  }`}
                  onClick={() => setActiveTab('history')}
                >
                  📜 ประวัติรักษา
                </button>
              </div>
            </div>
          </header>

          <div className="reg-form">
            {activeTab === 'info' && (
              <div className="fade-in">
                <div className="reg-section">
                  <h3 className="section-title">👤 ข้อมูลส่วนตัว</h3>
                  <div className="reg-row">
                    <div className="reg-group flex-1">
                      <label>เลขบัตร</label>
                      <p>{selectedPatient.idCard || '-'}</p>
                    </div>
                    <div className="reg-group flex-1">
                      <label>วันเกิด</label>
                      <p>{selectedPatient.birthDate || '-'}</p>
                    </div>
                    <div className="reg-group flex-1">
                      <label>เพศ/อายุ</label>
                      <p>
                        {selectedPatient.gender} / {selectedPatient.age} ปี
                      </p>
                    </div>
                  </div>
                  <div className="reg-row mt-2">
                    <div className="reg-group flex-1">
                      <label>เบอร์โทรศัพท์</label>
                      <p>{selectedPatient.phone || '-'}</p>
                    </div>
                  </div>
                  <div className="reg-group mt-3">
                    <label>ที่อยู่</label>
                    <p>{selectedPatient.fullAddress || '-'}</p>
                  </div>
                  <div
                    className="reg-group mt-2"
                    style={{
                      borderLeft: '4px solid #1e3a8a',
                      paddingLeft: '15px',
                    }}
                  >
                    <label>📞 ติดต่อฉุกเฉิน</label>
                    <p>
                      {selectedPatient.emergencyContact} (
                      {selectedPatient.emergencyPhone})
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'record' && (
              <form onSubmit={handleSaveVisit} className="fade-in"><fieldset disabled={stage !== 'draft' || busy || conflict} style={{border:0,padding:0,margin:0,minWidth:0}}>
                <div className="reg-section">
                  <div className="reg-group">
                    <label>อาการสำคัญ (CC)</label>
                    <textarea
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                      value={visitData.chiefComplaint}
                      onChange={(e) =>
                        setVisitData({
                          ...visitData,
                          chiefComplaint: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="reg-row mt-3">
                    <div className="reg-group flex-1">
                      <label>BW (kg)</label>
                      <input
                        type="text"
                        placeholder="น้ำหนัก"
                        value={visitData.weight}
                        onChange={(e) =>
                          setVisitData({ ...visitData, weight: e.target.value })
                        }
                      />
                    </div>
                    <div className="reg-group flex-1">
                      <label>HT (cm)</label>
                      <input
                        type="text"
                        placeholder="ส่วนสูง"
                        value={visitData.height}
                        onChange={(e) =>
                          setVisitData({ ...visitData, height: e.target.value })
                        }
                      />
                    </div>
                    <div className="reg-group flex-1">
                      <label>Temp (°C)</label>
                      <input
                        type="text"
                        placeholder="ไข้"
                        value={visitData.temp}
                        onChange={(e) =>
                          setVisitData({ ...visitData, temp: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="reg-row mt-2">
                    <div className="reg-group flex-1">
                      <label>RR (/min)</label>
                      <input
                        type="text"
                        placeholder="หายใจ"
                        value={visitData.resp}
                        onChange={(e) =>
                          setVisitData({ ...visitData, resp: e.target.value })
                        }
                      />
                    </div>
                    <div className="reg-group flex-1">
                      <label>PR (/min)</label>
                      <input
                        type="text"
                        placeholder="ชีพจร"
                        value={visitData.pulse}
                        onChange={(e) =>
                          setVisitData({ ...visitData, pulse: e.target.value })
                        }
                      />
                    </div>
                    <div className="reg-group flex-1">
                      <label>BP (mmHg)</label>
                      <input
                        type="text"
                        placeholder="ความดัน"
                        value={visitData.bp}
                        onChange={(e) =>
                          setVisitData({ ...visitData, bp: e.target.value })
                        }
                      />
                    </div>
                    <div className="reg-group flex-1">
                      <label>O2 Sat (%)</label>
                      <input
                        type="text"
                        placeholder="ออกซิเจน"
                        value={visitData.o2sat}
                        onChange={(e) =>
                          setVisitData({ ...visitData, o2sat: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div
                    className="reg-section mt-4"
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      padding: '20px',
                      borderRadius: '15px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px dashed #cbd5e1',
                        paddingBottom: '12px',
                        marginBottom: '15px',
                      }}
                    >
                      <label
                        style={{
                          fontWeight: 'bold',
                          color: '#1e3a8a',
                          fontSize: '1.1rem',
                        }}
                      >
                        🧾 รายการสั่งยา / ค่าบริการ
                      </label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          className="btn-action edit"
                          style={{
                            background: '#6366f1',
                            color: 'white',
                            borderRadius: '25px',
                            padding: '6px 18px',
                          }}
                          onClick={() => setIsServiceModalOpen(true)}
                        >
                          + ค่าบริการอื่นๆ
                        </button>
                        <button
                          type="button"
                          className="btn-action edit"
                          style={{
                            background: '#10b981',
                            color: 'white',
                            borderRadius: '25px',
                            padding: '6px 18px',
                          }}
                          onClick={() => setIsPrescriptionModalOpen(true)}
                        >
                          + ค้นหายา
                        </button>
                      </div>
                    </div>

                    {visitData.prescriptions.length > 0 ? (
                      <div
                        style={{
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '1px solid #f1f5f9',
                        }}
                      >
                        <table className="patient-table" style={{ margin: 0 }}>
                          <thead style={{ background: '#f8fafc' }}>
                            <tr>
                              <th>รายการ</th>
                              <th
                                style={{ textAlign: 'center', width: '80px' }}
                              >
                                จำนวน
                              </th>
                              <th
                                style={{ textAlign: 'right', width: '110px' }}
                              >
                                ราคา/หน่วย
                              </th>
                              <th
                                style={{ textAlign: 'right', width: '110px' }}
                              >
                                ยอดรวม
                              </th>
                              <th
                                style={{ textAlign: 'center', width: '50px' }}
                              ></th>
                            </tr>
                          </thead>
                          <tbody>
                            {visitData.prescriptions.map((p: any, i: number) => (
                              <tr key={p.id}>
                                <td>
                                  <div style={{ fontWeight: '600' }}>
                                    {p.isService ? '🛠️ ' : ''}
                                    {p.tradeName}
                                  </div>
                                  <small style={{ color: '#64748b' }}>
                                    {p.strength || 'ค่าบริการ'}
                                  </small>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {p.isService ? (
                                    '1'
                                  ) : (
                                    <input
                                      type="number"
                                      min="1"
                                      value={p.qtyToGive}
                                      onChange={(e) =>
                                        updateMedQty(p.id, e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        textAlign: 'center',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        padding: '4px',
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
                                      placeholder="0"
                                    />
                                  ) : (
                                    `${Number(
                                      p.sellingPrice
                                    ).toLocaleString()} ฿`
                                  )}
                                </td>
                                <td
                                  style={{
                                    textAlign: 'right',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {(
                                    Number(p.sellingPrice) * Number(p.qtyToGive)
                                  ).toLocaleString()}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      fontSize: '1.2rem',
                                      cursor: 'pointer',
                                      color: '#94a3b8',
                                    }}
                                    onClick={() => removeMedicine(p.id)}
                                  >
                                    🗑️
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot
                            style={{
                              background: '#f8fafc',
                              borderTop: '2px solid #1e3a8a',
                            }}
                          >
                            <tr>
                              <td
                                colSpan={3}
                                style={{
                                  textAlign: 'right',
                                  padding: '15px',
                                  fontWeight: 'bold',
                                }}
                              >
                                ยอดรวมทั้งสิ้น (Grand Total):
                              </td>
                              <td
                                style={{
                                  textAlign: 'right',
                                  fontWeight: '900',
                                  fontSize: '1.2rem',
                                  color: '#1e3a8a',
                                }}
                              >
                                {visitData.totalAmount.toLocaleString()}
                              </td>
                              <td
                                style={{
                                  fontWeight: 'bold',
                                  textAlign: 'center',
                                }}
                              >
                                ฿
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p
                        style={{
                          textAlign: 'center',
                          color: '#94a3b8',
                          padding: '20px',
                        }}
                      >
                        ยังไม่มีรายการยาหรือค่าบริการ
                      </p>
                    )}
                  </div>

                  <div className="reg-group mt-4">
                    <label style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
                      การวินิจฉัย (Dx)
                    </label>
                    <div style={{ display: 'flex' }}>
                      <select
                        style={{
                          flex: 1,
                          padding: '10px',
                          borderRadius: '8px',
                          border: '2px solid #1e3a8a',
                          fontWeight: 'bold',
                          fontSize: '1.1rem',
                        }}
                        value={visitData.diagnosis}
                        onChange={(e) =>
                          setVisitData({
                            ...visitData,
                            diagnosis: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">เลือกการวินิจฉัย</option>
                        {dxOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
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
                        onClick={() => setIsDxModalOpen(true)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="reg-group mt-3">
                    <label style={{ color: '#1e3a8a', fontWeight: 'bold' }}>
                      การรักษา / หัตถการ (Treatment)
                    </label>
                    <textarea
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                      }}
                      value={visitData.treatment}
                      onChange={(e) =>
                        setVisitData({
                          ...visitData,
                          treatment: e.target.value,
                        })
                      }
                      placeholder="ระบุการรักษาเพิ่มเติม เช่น ทำแผล, ฉีดยา, พ่นยา..."
                    />
                  </div>

                  <div className="reg-group mt-3">
                    <label>📅 วันนัดครั้งหน้า</label>
                    <input
                      type="date"
                      value={visitData.nextAppt}
                      onChange={(e) =>
                        setVisitData({ ...visitData, nextAppt: e.target.value })
                      }
                    />
                  </div>

                  <div
                    className="reg-actions mt-4"
                    style={{ display: 'flex', gap: '10px' }}
                  >
                    <button
                      type="button"
                      className="btn-cancel"
                      style={{ flex: 1, height: '60px', fontSize: '1.2rem' }}
                      onClick={() => {
                        if (window.confirm('ล้างข้อมูลในฉบับร่างนี้?')) setVisitData(initialVisitState);
                      }}
                    >
                      ล้างฉบับร่าง
                    </button>
                    <button
                      type="submit"
                      className="btn-submit"
                      style={{ flex: 1, height: '60px', fontSize: '1.2rem' }}
                    >
                      ตรวจเสร็จ → รอรับยา
                    </button>
                  </div>
                </div>
              </fieldset></form>
            )}

            {activeTab === 'history' && (
              <div className="table-container fade-in">
                <table className="patient-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>VN</th>
                      <th>Dx</th>
                      <th>ยอดรวม</th>
                      <th>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientHistory.map((v) => (
                      <tr key={v.id}>
                        <td>
                          {new Date(v.visitDate).toLocaleDateString('th-TH')}
                        </td>
                        <td className="font-bold">{v.vn}</td>
                        <td
                          style={{
                            maxWidth: '150px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {v.diagnosis}
                          {/* 🆕 แสดงผลสถานะการติดตามในตารางประวัติ */}
                          {v.followUpStatus && (
                            <div
                              style={{
                                fontSize: '0.75rem',
                                color:
                                  v.followUpStatus === 'ติดตามแล้ว'
                                    ? '#10b981'
                                    : '#ef4444',
                                fontWeight: 'bold',
                                marginTop: '4px',
                              }}
                            >
                              ● {v.followUpStatus}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>
                          {v.totalAmount?.toLocaleString()} ฿
                        </td>
                        <td style={{ display: 'flex', gap: '5px' }}>
                          <button
                            className="btn-action edit"
                            onClick={() => handleEditClick(v)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-action"
                            style={{ background: '#64748b', color: 'white' }}
                            onClick={() => {
                              setSelectedVisit(v);
                              setModalTab(1);
                            }}
                          >
                            👁️
                          </button>
                          <button
                            className="btn-action delete"
                            style={{ background: '#ef4444', color: 'white' }}
                            onClick={() => {
                              alert('ไม่สามารถลบประวัติที่จ่ายยาแล้วจากหน้าห้องตรวจได้');
                            }}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isServiceModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsServiceModalOpen(false)}
        >
          <div
            className="modal-content fade-in"
            style={{ maxWidth: '500px', padding: '0', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="section-title"
              style={{
                margin: '0',
                background: '#6366f1',
                padding: '20px',
                color: 'white',
                borderRadius: '0',
              }}
            >
              🛠️ เลือกค่าบริการอื่นๆ
            </h3>

            <div style={{ padding: '20px' }}>
              <label
                style={{
                  fontWeight: 'bold',
                  color: '#64748b',
                  fontSize: '0.9rem',
                }}
              >
                รายการที่มีอยู่:
              </label>
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px',
                  marginTop: '8px',
                  background: '#f8fafc',
                }}
              >
                {serviceOptions.length > 0 ? (
                  serviceOptions.map((opt) => (
                    <div
                      key={opt}
                      className="v-search-item"
                      style={{
                        padding: '12px 15px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: 'white',
                      }}
                      onClick={() => addServiceToVisit(opt)}
                    >
                      <span style={{ fontWeight: '500', color: '#1e293b' }}>
                        {opt}
                      </span>
                      <div
                        style={{
                          color: '#6366f1',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                        }}
                      >
                        เลือก ➔
                      </div>
                    </div>
                  ))
                ) : (
                  <p
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: '#94a3b8',
                    }}
                  >
                    ยังไม่มีข้อมูลรายการ
                  </p>
                )}
              </div>

              <div
                style={{
                  marginTop: '25px',
                  padding: '18px',
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
                    marginBottom: '10px',
                    fontSize: '0.95rem',
                  }}
                >
                  ➕ สร้างรายการค่าบริการใหม่
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="เช่น ค่าใบรับรองแพทย์..."
                    value={newServiceLabel}
                    onChange={(e) => setNewServiceLabel(e.target.value)}
                    style={{
                      flex: 1,
                      border: '2px solid #ddd6fe',
                      borderRadius: '10px',
                      padding: '10px 15px',
                      fontSize: '0.95rem',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    className="btn-submit"
                    style={{
                      padding: '0 20px',
                      background: '#6366f1',
                      borderRadius: '10px',
                    }}
                    onClick={handleAddServiceOption}
                  >
                    เพิ่ม
                  </button>
                </div>
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
                  style={{
                    borderRadius: '12px',
                    height: '45px',
                    padding: '0 30px',
                  }}
                  onClick={() => setIsServiceModalOpen(false)}
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDxModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '400px' }}>
            <h3
              className="section-title"
              style={{
                margin: '-30px -30px 20px -30px',
                background: '#1e3a8a',
              }}
            >
              ➕ เพิ่มการวินิจฉัยใหม่
            </h3>
            <div className="reg-form">
              <div className="reg-group">
                <label>ชื่อโรค / อาการวินิจฉัย</label>
                <input
                  type="text"
                  autoFocus
                  value={newDx}
                  onChange={(e) => setNewDx(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="btn-cancel"
                  style={{ flex: 1 }}
                  onClick={() => setIsDxModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn-submit"
                  style={{ flex: 1 }}
                  onClick={handleAddDx}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isPrescriptionModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content fade-in" style={{ maxWidth: '500px' }}>
            <h3
              className="section-title"
              style={{
                margin: '-30px -30px 20px -30px',
                background: '#1e3a8a',
              }}
            >
              💊 ค้นหาและเลือกยา
            </h3>
            <div className="reg-form">
              <input
                type="text"
                placeholder="ชื่อยา..."
                autoFocus
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
              />
              <div
                className="v-search-dropdown"
                style={{
                  position: 'static',
                  marginTop: '10px',
                  maxHeight: '250px',
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
                          สต็อก: {i.stockQty} | {i.sellingPrice} ฿
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
                onClick={() => setIsPrescriptionModalOpen(false)}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedVisit && (
        <div className="modal-overlay" onClick={() => setSelectedVisit(null)}>
          <div
            className="modal-content fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '700px',
              padding: '0',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setSelectedVisit(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '15px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '5px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                zIndex: 100,
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              ปิดหน้าต่าง
            </button>
            <h3
              className="section-title"
              style={{
                margin: '0',
                background: '#475569',
                borderRadius: '0',
                paddingRight: '100px',
              }}
            >
              📋 รายละเอียด VN: {selectedVisit.vn}
            </h3>
            <div
              className="tab-menu"
              style={{
                padding: '10px 20px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
              }}
            >
              <button
                className={`tab-btn ${modalTab === 1 ? 'active' : ''}`}
                onClick={() => setModalTab(1)}
              >
                👤 ข้อมูลพื้นฐาน
              </button>
              <button
                className={`tab-btn ${modalTab === 2 ? 'active' : ''}`}
                onClick={() => setModalTab(2)}
              >
                📊 สัญญาณชีพ
              </button>
              <button
                className={`tab-btn ${modalTab === 3 ? 'active' : ''}`}
                onClick={() => setModalTab(3)}
              >
                📦 รายการยา
              </button>
            </div>
            <div
              className="reg-form"
              style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}
            >
              {modalTab === 1 && (
                <div className="fade-in">
                  {/* 🆕 ปรับ Layout ข้อมูลพื้นฐานให้จัดหน้าอัตโนมัติ */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: '20px',
                    }}
                  >
                    <div className="reg-group">
                      <label style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                        🚩 อาการสำคัญ (Chief Complaint)
                      </label>
                      <p
                        style={{
                          padding: '12px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          minHeight: '60px',
                          whiteSpace: 'pre-wrap',
                          marginTop: '5px',
                        }}
                      >
                        {selectedVisit.chiefComplaint || '-'}
                      </p>
                    </div>
                    <div className="reg-group">
                      <label style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                        🩺 การวินิจฉัย (Diagnosis)
                      </label>
                      <p
                        style={{
                          padding: '12px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          minHeight: '60px',
                          whiteSpace: 'pre-wrap',
                          marginTop: '5px',
                          fontWeight: 'bold',
                          color: '#0f172a',
                        }}
                      >
                        {selectedVisit.diagnosis || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="reg-group mt-4">
                    <label style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                      💊 หัตถการและการรักษา (Treatment)
                    </label>
                    <p
                      style={{
                        padding: '12px',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        minHeight: '80px',
                        whiteSpace: 'pre-wrap',
                        marginTop: '5px',
                      }}
                    >
                      {selectedVisit.treatment || '-'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: '20px',
                      marginTop: '20px',
                    }}
                  >
                    {selectedVisit.nextAppt && (
                      <div className="reg-group">
                        <label style={{ fontWeight: 'bold', color: '#1e3a8a' }}>
                          📅 นัดหมายติดตามผลครั้งต่อไป
                        </label>
                        <p
                          style={{
                            padding: '12px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: '8px',
                            marginTop: '5px',
                            color: '#b45309',
                            fontWeight: 'bold',
                          }}
                        >
                          {new Date(selectedVisit.nextAppt).toLocaleDateString(
                            'th-TH',
                            { year: 'numeric', month: 'long', day: 'numeric' }
                          )}
                        </p>
                      </div>
                    )}

                    {/* 🆕 แสดงผลสถานะการติดตามในหน้ารายละเอียดพร้อมวันเวลา */}
                    {selectedVisit.followUpStatus && (
                      <div className="reg-group">
                        <label style={{ fontWeight: 'bold', color: '#64748b' }}>
                          📌 ผลการติดตามผลนัดหมาย
                        </label>
                        <div
                          style={{
                            padding: '12px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            marginTop: '5px',
                          }}
                        >
                          <span
                            className={`badge ${
                              selectedVisit.followUpStatus === 'ติดตามแล้ว'
                                ? 'badge-green'
                                : 'badge-red'
                            }`}
                            style={{
                              marginBottom: '5px',
                              display: 'inline-block',
                            }}
                          >
                            {selectedVisit.followUpStatus}
                          </span>
                          <br />
                          <small style={{ color: '#64748b' }}>
                            (ดำเนินการเมื่อ:{' '}
                            {new Date(
                              selectedVisit.followUpDate
                            ).toLocaleString('th-TH')}
                            )
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {modalTab === 2 && (
                <div className="fade-in">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '15px',
                    }}
                  >
                    {[
                      {
                        label: 'น้ำหนัก (BW)',
                        val: selectedVisit.weight,
                        unit: 'kg',
                      },
                      {
                        label: 'ส่วนสูง (HT)',
                        val: selectedVisit.height,
                        unit: 'cm',
                      },
                      {
                        label: 'อุณหภูมิ (Temp)',
                        val: selectedVisit.temp,
                        unit: '°C',
                      },
                      {
                        label: 'ความดัน (BP)',
                        val: selectedVisit.bp,
                        unit: 'mmHg',
                      },
                      {
                        label: 'ชีพจร (PR)',
                        val: selectedVisit.pulse,
                        unit: '/min',
                      },
                      {
                        label: 'หายใจ (RR)',
                        val: selectedVisit.resp,
                        unit: '/min',
                      },
                      {
                        label: 'ออกซิเจน (O2 Sat)',
                        val: selectedVisit.o2sat,
                        unit: '%',
                      },
                    ].map((vs, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '12px',
                          background: '#fff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      >
                        <small style={{ color: '#64748b' }}>{vs.label}:</small>
                        <br />
                        <strong style={{ fontSize: '1.1rem' }}>
                          {vs.val || '-'} {vs.val ? vs.unit : ''}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {modalTab === 3 && (
                <div className="fade-in">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '2px solid #cbd5e1',
                          textAlign: 'left',
                        }}
                      >
                        <th style={{ padding: '10px 0' }}>รายการ</th>
                        <th style={{ textAlign: 'center' }}>จำนวน</th>
                        <th style={{ textAlign: 'right' }}>รวม (฿)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVisit.prescriptions?.map((p: any, i: number) => (
                        <tr
                          key={i}
                          style={{ borderBottom: '1px solid #e2e8f0' }}
                        >
                          <td style={{ padding: '10px 0' }}>
                            <strong>{p.tradeName}</strong>
                            <br />
                            <small style={{ color: '#64748b' }}>
                              {p.strength || 'ค่าบริการ'}
                            </small>
                          </td>
                          <td style={{ textAlign: 'center' }}>{p.qtyToGive}</td>
                          <td style={{ textAlign: 'right' }}>
                            {(
                              Number(p.sellingPrice) * Number(p.qtyToGive)
                            ).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div
                    style={{
                      textAlign: 'right',
                      marginTop: '20px',
                      fontSize: '1.3rem',
                      fontWeight: 'bold',
                      color: '#1e3a8a',
                    }}
                  >
                    ยอดรวมสุทธิ:{' '}
                    {Number(selectedVisit.totalAmount).toLocaleString()} บาท
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function Visits() {
  const location = useLocation();
  const [patients, setPatients] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [active, setActive] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState('');
  const discarding = useRef(new Set<string>());
  useEffect(() => onSnapshot(collection(db, 'patients'), snap => setPatients(snap.docs.map(d => ({id:d.id,...d.data()}))), e => setError(e.message)), []);
  useEffect(() => onSnapshot(query(collection(db, 'visits'), where('ownerUid', '==', auth.currentUser?.uid || '')), snap => {
    const rows = snap.docs.map(d => ({id:d.id,...d.data()} as any)).filter(v => ['draft','awaiting_medicine','awaiting_payment'].includes(v.workflowStatus));
    setCases(rows);
  }, e => setError('ไม่สามารถโหลดฉบับร่าง: '+e.message)), []);
  const open = async (patient: any) => {
    if (opening) return;
    setOpening(true); setError('');
    try { const id = await startCase(patient); setActive(id); setSearch(''); }
    catch(e:any) { setError('เปิดเคสไม่สำเร็จ: '+e.message); }
    finally {setOpening(false);}
  };
  useEffect(() => { if (location.state?.patient) void open(location.state.patient); }, [location.key]);
  const closeCase = async (visit: { id: string; episodeId: string; workflowStatus: string }) => {
    if (closing || discarding.current.has(visit.episodeId)) return;
    if (visit.workflowStatus === 'awaiting_payment') {
      setError('เคสนี้จ่ายยาแล้ว จึงยกเลิกจากแท็บไม่ได้ กรุณาดำเนินการรับชำระในเคสเดิม');
      return;
    }
    if (!window.confirm('ยกเลิกเคสนี้และลบฉบับร่างทั้งหมด? ข้อมูลการตรวจในแท็บนี้จะไม่ถูกเก็บไว้')) return;

    discarding.current.add(visit.episodeId);
    setClosing(visit.id);
    setError('');
    try {
      await discardCase(visit.id, visit.episodeId);
      setCases(rows => rows.filter(row => row.episodeId !== visit.episodeId));
    } catch (e: any) {
      discarding.current.delete(visit.episodeId);
      setError('ยกเลิกเคสไม่สำเร็จ: ' + e.message);
    } finally {
      setClosing('');
    }
  };
  const visible = cases;
  const selected = visible.some(c => c.id === active) ? active : visible[0]?.id;
  return <div className="visit-workspace">
    <BackButton />
    <header className="workspace-header"><h1>🩺 ห้องตรวจ</h1><span>ฉบับร่างแยกตามผู้ป่วย · ตรวจ → จ่ายยา → รับชำระเงิน</span></header>
    {error && <p role="alert">{error}</p>}
    <div className="workspace-search"><input aria-label="ค้นหาผู้ป่วยเพื่อเปิดแท็บ" placeholder="+ เปิดผู้ป่วยเพิ่ม — ชื่อ หรือ CN" value={search} onChange={e=>setSearch(e.target.value)} />
      {search && <div className="workspace-results">{patients.filter(p => `${p.firstName} ${p.lastName} ${p.cn}`.toLowerCase().includes(search.toLowerCase())).slice(0,8).map(p => <button key={p.id} disabled={opening} onClick={()=>open(p)}>{p.firstName} {p.lastName} · {p.cn}</button>)}</div>}
    </div>
    <div className="patient-case-tabs" role="tablist" aria-label="เคสผู้ป่วยที่เปิดอยู่">{visible.map(c => <div className="patient-case-tab" key={c.id}>
      <button role="tab" id={'tab-'+c.id} aria-selected={selected===c.id} aria-controls={'panel-'+c.id} onClick={()=>setActive(c.id)}>{c.patientName}<small>{c.cn} · {stageLabel(c.workflowStatus)}</small></button>
      <button type="button" aria-label={'ยกเลิกเคส '+c.patientName} disabled={Boolean(closing)} onClick={()=>void closeCase(c)}>×</button>
    </div>)}</div>
    {!visible.length && <p className="workspace-empty">ค้นหาผู้ป่วยเพื่อเริ่มตรวจ หรือเปิดฉบับร่างเดิมกลับมาทำต่อ</p>}
    {visible.map(c => <section key={c.episodeId || c.id} role="tabpanel" id={'panel-'+c.id} aria-labelledby={'tab-'+c.id} hidden={selected!==c.id}>
      <PatientCase patient={patients.find(p=>p.id===c.patientId)||{...c.patientSnapshot,id:c.patientId,cn:c.cn}} caseId={c.id} seed={c} isDiscarding={()=>discarding.current.has(c.episodeId)} />
    </section>)}
  </div>;
}
