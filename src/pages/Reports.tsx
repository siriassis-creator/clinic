import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import BackButton from '../components/BackButton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LabelList,
} from 'recharts';
import './Reports.css';

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [clinicName, setClinicName] = useState('กำลังโหลด...');
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalAppts, setTotalAppts] = useState(0);

  // --- ⚙️ Config State ---
  const [config, setConfig] = useState({
    headerColor: '#475569',
    showFinance: true,
    showPatientStats: true,
    showTopMeds: true,
    showDx: true,
  });

  // --- 💰 Finance States ---
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalMedIncome, setTotalMedIncome] = useState(0);
  const [totalServiceIncome, setTotalServiceIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);

  const [financeStats, setFinanceStats] = useState<any[]>([]);
  // 🆕 State สำหรับเก็บข้อมูลดิบเพื่อใช้ Export
  const [rawExportData, setRawExportData] = useState<{
    incomes: any[];
    expenses: any[];
  }>({ incomes: [], expenses: [] });

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [financeView, setFinanceView] = useState<'all' | 'income' | 'expense'>(
    'all'
  );

  const [dailyStats, setDailyStats] = useState<
    { day: number; count: number }[]
  >([]);
  const [topMedicines, setTopMedicines] = useState<
    { name: string; qty: number }[]
  >([]);
  const [dxStats, setDxStats] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'settings', 'report_config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setConfig({
            headerColor: data.headerColor || '#475569',
            showFinance: data.showFinance ?? true,
            showPatientStats: data.showPatientStats ?? true,
            showTopMeds: data.showTopMeds ?? true,
            showDx: data.showDx ?? true,
          });
        }
      }
    );

    const unsubClinic = onSnapshot(
      doc(db, 'settings', 'appointment'),
      (snap) => {
        if (snap.exists()) {
          setClinicName(snap.data().clinicName || 'เอื้องฟ้าคลินิก');
        }
      }
    );

    return () => {
      unsubConfig();
      unsubClinic();
    };
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const pSnap = await getDocs(collection(db, 'patients'));
      setTotalPatients(pSnap.size);

      const invSnap = await getDocs(collection(db, 'pharmacy'));
      const inventoryMap: any = {};
      invSnap.forEach((d) => (inventoryMap[d.id] = d.data()));

      const vSnap = await getDocs(collection(db, 'visits'));
      const hSnap = await getDocs(collection(db, 'medicine_history'));

      const allVisits = vSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      const allHistory = hSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const monthVisits = allVisits.filter(
        (v) => v.visitDate && v.visitDate.includes(selectedMonth)
      );
      const monthHistory = allHistory.filter(
        (h) =>
          h.timestamp && h.timestamp.includes(selectedMonth) && h.type === 'IN'
      );

      const todayStr = new Date().toISOString().slice(0, 10);
      setTotalAppts(
        allVisits.filter(
          (v) =>
            v.nextAppt &&
            v.nextAppt >= todayStr &&
            (!v.followUpStatus || v.followUpStatus === '')
        ).length
      );

      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const dayMap: { [key: number]: any } = {};
      for (let i = 1; i <= daysInMonth; i++) {
        dayMap[i] = {
          day: i,
          count: 0,
          รายรับค่ายา: 0,
          รายรับค่าบริการ: 0,
          รายจ่าย: 0,
        };
      }

      let mMedIncome = 0;
      let mServiceIncome = 0;
      let mExpense = 0;
      const medsMap: { [key: string]: number } = {};
      const dxMap: { [key: string]: number } = {};

      const incomeRows: any[] = [];
      const expenseRows: any[] = [];

      monthVisits.forEach((v) => {
        const d = new Date(v.visitDate).getDate();
        if (dayMap[d]) {
          dayMap[d].count += 1;
          v.prescriptions?.forEach((p: any) => {
            const amount =
              Number(p.sellingPrice || 0) * Number(p.qtyToGive || 0);

            incomeRows.push({
              วันที่: new Date(v.visitDate).toLocaleDateString('th-TH'),
              ประเภท: p.isService ? 'ค่าบริการ' : 'ค่ายา',
              รายการ: p.tradeName,
              อ้างอิง: v.patientName,
              จำนวน: p.qtyToGive,
              ราคาต่อหน่วย: p.sellingPrice,
              ยอดรวม: amount,
            });

            if (p.isService) {
              dayMap[d].รายรับค่าบริการ += amount;
              mServiceIncome += amount;
            } else {
              dayMap[d].รายรับค่ายา += amount;
              mMedIncome += amount;
              medsMap[p.tradeName] =
                (medsMap[p.tradeName] || 0) + Number(p.qtyToGive);
            }
          });
        }
        if (v.diagnosis) dxMap[v.diagnosis] = (dxMap[v.diagnosis] || 0) + 1;
      });

      monthHistory.forEach((h) => {
        const d = new Date(h.timestamp).getDate();
        const med = inventoryMap[h.medicineId];
        const costPerUnit = med ? Number(med.costPrice || 0) : 0;
        const totalCost = costPerUnit * Number(h.amount || 0);

        if (dayMap[d]) dayMap[d].รายจ่าย += totalCost;
        mExpense += totalCost;

        expenseRows.push({
          วันที่: new Date(h.timestamp).toLocaleDateString('th-TH'),
          ประเภท: 'รายจ่าย (รับยาเข้า)',
          รายการ: med?.tradeName || 'ไม่ระบุชื่อยา',
          อ้างอิง: h.note || '-',
          จำนวน: h.amount,
          ราคาทุนต่อหน่วย: costPerUnit,
          ยอดรวม: totalCost,
        });
      });

      const finalStats = Object.keys(dayMap).map((d) => ({
        ...dayMap[Number(d)],
        ยอดรวมรายรับ:
          dayMap[Number(d)].รายรับค่ายา + dayMap[Number(d)].รายรับค่าบริการ,
      }));

      setDailyStats(finalStats.map((s) => ({ day: s.day, count: s.count })));
      setFinanceStats(finalStats);
      setRawExportData({ incomes: incomeRows, expenses: expenseRows });

      setTotalMedIncome(mMedIncome);
      setTotalServiceIncome(mServiceIncome);
      setTotalIncome(mMedIncome + mServiceIncome);
      setTotalExpense(mExpense);
      setTopMedicines(
        Object.keys(medsMap)
          .map((name) => ({ name, qty: medsMap[name] }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10)
      );
      setDxStats(
        Object.keys(dxMap)
          .map((name) => ({ name, count: dxMap[name] }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (e) {
      console.error('Report Error:', e);
    }
    setLoading(false);
  };

  const handleExportExcel = () => {
    const combinedData = [...rawExportData.incomes, ...rawExportData.expenses];
    if (combinedData.length === 0)
      return alert('ไม่มีข้อมูลสำหรับส่งออกในเดือนนี้');

    const headers = [
      'วันที่',
      'ประเภท',
      'รายการ',
      'อ้างอิง (ชื่อคนไข้/หมายเหตุ)',
      'จำนวน',
      'ราคา/หน่วย',
      'ยอดรวมสุทธิ',
    ];
    const csvRows = [headers.join(',')];

    combinedData.forEach((row) => {
      const values = [
        row.วันที่,
        row.ประเภท,
        `"${row.รายการ}"`,
        `"${row.อ้างอิง}"`,
        row.จำนวน,
        row.ราคาต่อหน่วย || row.ราคาทุนต่อหน่วย,
        row.ยอดรวม,
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
    link.setAttribute('download', `รายงานรายรับรายจ่าย_${selectedMonth}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="report-page-full">
      <BackButton />
      <div className="report-wrapper-full fade-in">
        <header className="report-top-bar">
          <div className="title-area">
            <h1>📊 รายงานสถิติและการเงิน</h1>
            <p>{clinicName}</p>
          </div>
          <div className="filter-area">
            <label>ประจำเดือน:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>
        </header>

        <div className="stats-row-full">
          <div className="stat-card-new blue">
            <div className="stat-icon-new">👥</div>
            <div className="stat-info-new">
              <h3>คนไข้ทั้งหมด</h3>
              <p>{totalPatients.toLocaleString()}</p>
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                จำนวนผู้ป่วยที่ลงทะเบียนทั้งหมด
              </small>
            </div>
          </div>
          <div className="stat-card-new indigo">
            <div className="stat-icon-new">📅</div>
            <div className="stat-info-new">
              <h3>นัดติดตามผล</h3>
              <p style={{ color: '#6366f1', fontWeight: 'bold' }}>
                {totalAppts.toLocaleString()}
              </p>
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                เฉพาะนัดที่รอดำเนินการ
              </small>
            </div>
          </div>
          <div className="stat-card-new green">
            <div className="stat-icon-new">💰</div>
            <div className="stat-info-new">
              <h3>รายรับ (เดือนนี้)</h3>
              <p style={{ color: '#10b981', fontWeight: 'bold' }}>
                {totalIncome.toLocaleString()}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <small style={{ color: '#059669', fontSize: '0.7rem' }}>
                  💊 ยา: {totalMedIncome.toLocaleString()}
                </small>
                <small style={{ color: '#4f46e5', fontSize: '0.7rem' }}>
                  🛠️ บริการ: {totalServiceIncome.toLocaleString()}
                </small>
              </div>
            </div>
          </div>
          <div className="stat-card-new red">
            <div className="stat-icon-new">📉</div>
            <div className="stat-info-new">
              <h3>รายจ่าย (ซื้อยา)</h3>
              <p style={{ color: '#ef4444', fontWeight: 'bold' }}>
                {totalExpense.toLocaleString()}
              </p>
              <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                ต้นทุนรวมจากการรับยาเข้าคลัง
              </small>
            </div>
          </div>
        </div>

        {config.showFinance && (
          <section
            className="main-chart-full mb-5"
            style={{
              padding: '20px',
              background: '#fff',
              borderRadius: '15px',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            <div
              className="card-header-new"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '15px 15px 0 0',
                margin: '-20px -20px 25px -20px',
                padding: '15px 25px',
                width: 'auto',
                background: config.headerColor,
              }}
            >
              <h3 style={{ margin: 0, color: 'white' }}>
                💸 กราฟสรุปรายรับ - รายจ่าย รายวัน (บาท)
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleExportExcel}
                  style={{
                    padding: '5px 15px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#10b981',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  📥 Export Excel
                </button>
                <select
                  value={financeView}
                  onChange={(e) => setFinanceView(e.target.value as any)}
                  style={{
                    padding: '5px 15px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all" style={{ color: '#333' }}>
                    📊 แสดงทั้งหมด
                  </option>
                  <option value="income" style={{ color: '#333' }}>
                    💰 ดูเฉพาะรายรับ
                  </option>
                  <option value="expense" style={{ color: '#333' }}>
                    📉 ดูเฉพาะรายจ่าย
                  </option>
                </select>
              </div>
            </div>

            <div className="chart-container-new">
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={financeStats}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip
                    labelFormatter={() => ''}
                    formatter={(value: any, name: any) => {
                      if (!value || value === 0) return [null, null];
                      return [
                        new Intl.NumberFormat('th-TH').format(value) + ' ฿',
                        name,
                      ];
                    }}
                    contentStyle={{
                      borderRadius: '15px',
                      border: 'none',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" />
                  {(financeView === 'all' || financeView === 'income') && (
                    <>
                      <Bar
                        name="รายรับค่ายา"
                        dataKey="รายรับค่ายา"
                        stackId="รายรับ"
                        fill="#10b981"
                        barSize={25}
                      />
                      <Bar
                        name="รายรับค่าบริการ"
                        dataKey="รายรับค่าบริการ"
                        stackId="รายรับ"
                        fill="#6366f1"
                        radius={[4, 4, 0, 0]}
                        barSize={25}
                      >
                        {/* 🆕 เพิ่ม Label ยอดรวมรายรับบนยอด Stack */}
                        <LabelList
                          dataKey="ยอดรวมรายรับ"
                          position="top"
                          formatter={(val: any) =>
                            val > 0 ? val.toLocaleString() : ''
                          }
                          style={{
                            fontSize: 10,
                            fill: '#6366f1',
                            fontWeight: 'bold',
                          }}
                        />
                      </Bar>
                    </>
                  )}
                  {(financeView === 'all' || financeView === 'expense') && (
                    <Bar
                      name="รายจ่าย"
                      dataKey="รายจ่าย"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      barSize={25}
                      label={{
                        position: 'top',
                        fontSize: 10,
                        fill: '#ef4444',
                        fontWeight: 'bold',
                        formatter: (val: any) =>
                          val > 0 ? val.toLocaleString() : '',
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {config.showPatientStats && (
          <section
            className="main-chart-full mb-5"
            style={{
              padding: '20px',
              background: '#fff',
              borderRadius: '15px',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            <div
              className="card-header-new"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderRadius: '15px 15px 0 0',
                margin: '-20px -20px 25px -20px',
                padding: '15px 25px',
                width: 'auto',
                background: config.headerColor,
              }}
            >
              <h3 style={{ margin: 0, color: 'white' }}>
                📈 สถิติผู้เข้ารับการรักษา (จำนวนเคส)
              </h3>
            </div>
            <div className="chart-container-new">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyStats}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar
                    name="จำนวนคนไข้"
                    dataKey="count"
                    radius={[8, 8, 0, 0]}
                    barSize={35}
                    label={{
                      position: 'top',
                      fill: '#1e3a8a',
                      fontSize: 12,
                      fontWeight: 'bold',
                      formatter: (val: any) => (val > 0 ? val : ''),
                    }}
                  >
                    {dailyStats.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.count > 0 ? '#1e3a8a' : '#e2e8f0'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <div className="bottom-grid-full mt-5">
          {config.showTopMeds && (
            <div className="data-table-card">
              <div
                className="card-header-new"
                style={{
                  background: config.headerColor,
                  borderRadius: '15px 15px 0 0',
                  padding: '15px 25px',
                }}
              >
                <h3 style={{ margin: 0, color: 'white' }}>
                  💊 10 อันดับยาจ่ายบ่อย
                </h3>
              </div>
              <div className="table-inner">
                <table className="modern-report-table">
                  <thead>
                    <tr>
                      <th>รายการยา</th>
                      <th className="text-right">จำนวนจ่าย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMedicines.length > 0 ? (
                      topMedicines.map((m, i) => (
                        <tr key={i}>
                          <td>
                            <span className="rank-label">{i + 1}</span> {m.name}
                          </td>
                          <td className="text-right bold-navy">
                            {m.qty.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="text-center empty-msg">
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {config.showDx && (
            <div className="data-table-card">
              <div
                className="card-header-new"
                style={{
                  background: config.headerColor,
                  borderRadius: '15px 15px 0 0',
                  padding: '15px 25px',
                }}
              >
                <h3 style={{ margin: 0, color: 'white' }}>
                  🩺 สรุปการวินิจฉัย (Dx)
                </h3>
              </div>
              <div className="table-inner">
                <table className="modern-report-table">
                  <thead>
                    <tr>
                      <th>โรค / อาการ</th>
                      <th className="text-right">จำนวนเคส</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dxStats.length > 0 ? (
                      dxStats.map((d, i) => (
                        <tr key={i}>
                          <td>
                            <span className="dot-dx"></span> {d.name}
                          </td>
                          <td className="text-right bold-navy">
                            {d.count.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="text-center empty-msg">
                          ไม่มีข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
