import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db, auth } from '../services/firebase';
import { buildDashboard, bangkokDate } from '../services/dashboardSummary';
import './Dashboard.css';
import PatientAvatar from '../components/PatientAvatar';
import { patientIndex } from '../services/patientAvatar';

type Row = Record<string, any>;
const money = (n:number) => n.toLocaleString('th-TH',{maximumFractionDigits:2});
const number = (n:number) => n.toLocaleString('th-TH');
const colors = ['#2ab59a','#f3b94e','#f07179'];
function Empty({text='ยังไม่มีข้อมูลในช่วงนี้'}:{text?:string}) {return <div className="overview-empty">{text}</div>;}
export default function Dashboard() {
  const navigate=useNavigate();
  const [clinic,setClinic]=useState({name:'เอื้องฟ้าคลินิก',subtitle:'การพยาบาลและการผดุงครรภ์'});
  const [data,setData]=useState<Record<string,Row[]>>({patients:[],visits:[],pharmacy:[],medicine_history:[]});
  const [loaded,setLoaded]=useState<Record<string,boolean>>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [month,setMonth]=useState(()=>bangkokDate(new Date()).slice(0,7));
  const [search,setSearch]=useState('');
  useEffect(()=>{
    const stop=['patients','visits','pharmacy','medicine_history'].map(name=>onSnapshot(collection(db,name),snap=>{
      setData(prev=>({...prev,[name]:snap.docs.map(d=>({id:d.id,...d.data()}))}));setLoaded(prev=>({...prev,[name]:true}));setErrors(prev=>({...prev,[name]:''}));
    },error=>{setLoaded(prev=>({...prev,[name]:true}));setErrors(prev=>({...prev,[name]:error.message}));}));
    stop.push(onSnapshot(doc(db,'settings','appointment'),snap=>{if(snap.exists())setClinic({name:snap.data().clinicName||'เอื้องฟ้าคลินิก',subtitle:snap.data().clinicSubtitle||'การพยาบาลและการผดุงครรภ์'});}));
    return ()=>stop.forEach(fn=>fn());
  },[]);
  const summary=useMemo(()=>buildDashboard(data,month,new Date(),auth.currentUser?.uid),[data,month]);
  const loading=Object.keys(loaded).length<4;
  const failed=Object.values(errors).some(Boolean);
  const ready=!loading&&!failed;
  const found=search.trim()?data.patients.filter(p=>`${p.firstName||''} ${p.lastName||''} ${p.cn||''}`.toLowerCase().includes(search.trim().toLowerCase())).slice(0,6):[];
  const patientForVisit=useMemo(()=>patientIndex(data.patients),[data.patients]);
  const openPatient=(p:Row)=>navigate('/visits',{state:{patient:p}});
  const stats=[
    {icon:'👥',label:'ผู้ป่วยทั้งหมด',value:number(data.patients.length),unit:'คน',detail:'ทะเบียนผู้ป่วย',path:'/register',tone:'blue'},
    {icon:'🩺',label:'ตรวจรักษาเดือนนี้',value:number(summary.monthClinical.length),unit:'ครั้ง',detail:'ไม่รวมฉบับร่าง / ขายยาหน้าร้าน',path:'/visits',tone:'green'},
    {icon:'📅',label:'นัดหมายวันนี้',value:number(summary.appointments.length),unit:'รายการ',detail:'นัดที่ยังไม่ติดตาม',path:'/appointments',tone:'purple'},
    {icon:'📦',label:'ยาและเวชภัณฑ์',value:number(data.pharmacy.length),unit:'รายการ',detail:`สต็อกต่ำ ${summary.low.length} · หมดอายุ ${summary.expired.length}`,path:'/pharmacy',tone:'amber'},
    {icon:'฿',label:'รายรับเดือนนี้',value:'฿ '+money(summary.income),unit:'',detail:'รับชำระแล้ว รวมขายหน้าร้าน',path:'/reports',tone:'blue'},
    {icon:'↗',label:'มูลค่ารับยาเข้าเดือนนี้',value:'฿ '+money(summary.expense),unit:'',detail:'ประมาณจากราคาทุนปัจจุบัน',path:'/reports',tone:'rose'},
  ];
  return <div className="dashboard-container clinic-overview">
    <section className="overview-hero">
      <div className="hero-copy"><span className="hero-eyebrow">CLINIC CARE · ภาพรวมการดูแลผู้ป่วย</span><div className="clinic-name-with-nurse"><h1>{clinic.name}</h1></div><h2>บริหารจัดการครบ จบในที่เดียว</h2><p>{clinic.subtitle}</p><div className="hero-tags"><span>✚ ผู้ป่วย</span><span>✓ การรักษา</span><span>◷ นัดหมาย</span><span>▣ ยาและเวชภัณฑ์</span></div></div>
      <div className="hero-art"><div className="hero-watermark" aria-hidden="true"><span>✚</span></div><img src="/images/clinic-nurse-hero-3d.webp" alt="ภาพการ์ตูนพยาบาล 3D กอดอก" width="598" height="700" /></div>
      <div className="hero-features"><div><span>👥</span><strong>จัดการผู้ป่วย</strong><small>ทะเบียนและประวัติการรักษา</small></div><div><span>🩺</span><strong>ติดตามการตรวจ</strong><small>ฉบับร่าง จ่ายยา และชำระเงิน</small></div><div><span>📅</span><strong>นัดหมาย</strong><small>ติดตามนัดและการดูแลต่อเนื่อง</small></div><div><span>💊</span><strong>คลังยา</strong><small>ตรวจสต็อกและวันหมดอายุ</small></div><p>ข้อมูลสรุปอัปเดตจากระบบ · เมนูการใช้งานอยู่ด้านล่าง</p></div>
    </section>
    <div className="overview-toolbar"><div><h2>ภาพรวมการบริหารจัดการ</h2><span>{new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'})}</span></div><div className="overview-tools"><div className="overview-search"><input aria-label="ค้นหาผู้ป่วย" placeholder="ค้นหาชื่อผู้ป่วย หรือ CN..." value={search} onChange={e=>setSearch(e.target.value)}/>{search.trim()&&<div className="overview-results">{found.length?found.map(p=><button key={p.id} onClick={()=>openPatient(p)}>{p.firstName} {p.lastName}<small>{p.cn}</small></button>):<p>ไม่พบผู้ป่วย</p>}</div>}</div><input type="month" aria-label="เดือนที่แสดงข้อมูล" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value);}}/><button className="overview-logout" onClick={()=>{if(window.confirm('ออกจากระบบ?'))void auth.signOut();}}>ออกจากระบบ</button></div></div>
    {failed&&<p className="overview-error" role="alert">โหลดข้อมูลสรุปไม่ครบ กรุณาตรวจสิทธิ์หรือเชื่อมต่อใหม่ — {Object.entries(errors).filter(([,v])=>v).map(([k])=>k).join(', ')}</p>}
    <section className="overview-stats" data-reveal-wait={loading ? "" : undefined} aria-label="ตัวเลขสรุป">{stats.map(s=><button key={s.label} className="overview-stat" onClick={()=>navigate(s.path)}><span className={'stat-icon '+s.tone}>{s.icon}</span><div><span className="stat-label">{s.label.replace('เดือนนี้',month===bangkokDate(new Date()).slice(0,7)?'เดือนนี้':'เดือนที่เลือก')}</span><strong>{ready?s.value:'—'} <small>{s.unit}</small></strong></div><p>{loading?'กำลังโหลดข้อมูล...':failed?'ข้อมูลยังไม่พร้อม':s.detail}</p></button>)}</section>
    <div className="overview-grid" data-reveal-wait={loading ? "" : undefined}>
      <section className="overview-panel appointments"><div className="panel-heading"><h3>นัดหมายวันนี้</h3><button onClick={()=>navigate('/appointments')}>ดูทั้งหมด ↗</button></div>{ready?(summary.appointments.length?<div className="overview-list">{summary.appointments.slice(0,5).map(v=><button key={v.id} onClick={()=>navigate('/appointments')}><PatientAvatar patient={patientForVisit(v)}/><span><strong>{v.patientName||'ไม่ระบุชื่อ'}</strong><small>{v.cn||'—'} · ยังไม่ติดตาม</small></span><span className="list-badge amber">วันนี้</span></button>)}</div>:<Empty text="วันนี้ไม่มีนัดที่รอติดตาม"/>):<Empty text={loading?'กำลังโหลด...':'ไม่สามารถแสดงข้อมูล'}/>}</section>
      <section className="overview-panel trend"><div className="panel-heading"><h3>สถิติการรักษา</h3><span>7 วันล่าสุด</span></div>{ready?<div className="overview-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.week} margin={{top:12,right:12,left:-25,bottom:0}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6edf5"/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis allowDecimals={false} tick={{fontSize:11}}/><Tooltip/><Legend iconType="circle"/><Area type="monotone" dataKey="visits" name="การรักษา" stroke="#2389d7" fill="#2389d7" fillOpacity={.08} strokeWidth={2}/><Area type="monotone" dataKey="patients" name="ผู้ป่วยใหม่" stroke="#2ab59a" fill="#2ab59a" fillOpacity={.04} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>:<Empty/>}</section>
      <section className="overview-panel new-patients"><div className="panel-heading"><h3>ผู้ป่วยลงทะเบียนล่าสุด</h3><button onClick={()=>navigate('/register')}>ดูทั้งหมด ↗</button></div>{ready?(summary.recentPatients.length?<div className="overview-list">{summary.recentPatients.map(p=><button key={p.id} onClick={()=>openPatient(p)}><PatientAvatar patient={p}/><span><strong>{p.firstName} {p.lastName}</strong><small>{p.cn||'—'}</small></span><small className="list-date">{p.createdAt?new Date(p.createdAt).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}):'ไม่ระบุวันที่'}</small></button>)}</div>:<Empty/>):<Empty/>}</section>
      <section className="overview-panel inventory"><div className="panel-heading"><h3>ผู้ป่วยใหม่วันนี้</h3><button onClick={()=>navigate('/register')}>ดูทั้งหมด ↗</button></div>{ready?(summary.todayPatients.length?<div className="overview-list">{summary.todayPatients.map(p=><button key={p.id} onClick={()=>openPatient(p)}><PatientAvatar patient={p}/><span><strong>{p.firstName} {p.lastName}</strong><small>{p.cn||'—'}</small></span><small className="list-date">{p.createdAt?new Date(p.createdAt).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'}):'ไม่ระบุวันที่'}</small></button>)}</div>:<Empty text="วันนี้ยังไม่มีผู้ป่วยลงทะเบียนใหม่"/>):<Empty text={loading?'กำลังโหลด...':'ไม่สามารถแสดงข้อมูล'}/>}</section>
      <section className="overview-panel alerts"><div className="panel-heading"><h3>สถานะยาและเวชภัณฑ์</h3><button onClick={()=>navigate('/pharmacy')}>ดูทั้งหมด ↗</button></div>{ready&&data.pharmacy.length?<><div className="inventory-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={summary.stock} dataKey="value" nameKey="name" innerRadius="65%" outerRadius="90%" stroke="none">{summary.stock.map((s,i)=><Cell key={s.name} fill={colors[i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div><strong>{data.pharmacy.length}</strong><small>รายการ</small></div></div><div className="stock-legend">{summary.stock.map((s,i)=><span key={s.name}><i style={{background:colors[i]}}/>{s.name}<strong>{s.value}</strong></span>)}</div></>:<Empty text={loading?'กำลังโหลด...':'ยังไม่มีรายการยา'}/>}</section>
      <section className="overview-panel diagnosis"><div className="panel-heading"><h3>การวินิจฉัยที่พบบ่อย</h3><span>เดือนที่เลือก</span></div>{ready&&summary.diagnoses.length?<div className="diagnosis-bars">{summary.diagnoses.map((d,i)=><div key={d.name}><span>{i+1}. {d.name}</span><div><i style={{width:`${d.count/summary.diagnoses[0].count*100}%`}}/></div><strong>{d.count}</strong></div>)}</div>:<Empty/>}</section>
      <section className="overview-panel activity"><div className="panel-heading"><h3>กิจกรรมการตรวจล่าสุด</h3><button onClick={()=>navigate('/visits')}>ห้องตรวจ ↗</button></div>{ready&&summary.recentVisits.length?<div className="overview-list">{summary.recentVisits.map(v=><button key={v.id} onClick={()=>navigate('/visits')}><PatientAvatar patient={patientForVisit(v)}/><span><strong>{v.patientName||'ไม่ระบุชื่อ'}</strong><small>{summary.status(v.workflowStatus)} · {v.vn||v.cn}</small></span><small className="list-date">{new Date(v.updatedAt||v.visitDate).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short'})}</small></button>)}</div>:<Empty/>}</section>
      <section className="overview-panel finance"><div className="panel-heading"><h3>รายรับและมูลค่ารับยาเข้า</h3><button onClick={()=>navigate('/reports')}>รายงาน ↗</button></div>{ready?<><div className="overview-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.finance} margin={{top:10,right:8,left:-12,bottom:0}}><CartesianGrid vertical={false} stroke="#e6edf5"/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}} tickFormatter={v=>Number(v)>=1000?`${Number(v)/1000}k`:String(v)}/><Tooltip formatter={v=>money(Number(v))+' บาท'}/><Legend iconType="circle"/><Bar dataKey="income" name="รายรับ" fill="#2ab59a" radius={[3,3,0,0]}/><Bar dataKey="expense" name="รับยาเข้า (ประมาณ)" fill="#f07179" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer></div><p className="finance-footnote">มูลค่ารับยาเข้าอ้างอิงทุนปัจจุบัน ไม่ใช่รายจ่ายบัญชีทั้งหมด</p></>:<Empty/>}</section>
      <section className="overview-panel case-summary"><div className="panel-heading"><h3>เคสที่กำลังดำเนินการ</h3><span>บัญชีนี้</span></div><div className="case-summary-list">{[['กำลังตรวจ',summary.pending.draft],['รอรับยา',summary.pending.awaiting_medicine],['รอชำระเงิน',summary.pending.awaiting_payment]].map(([label,count])=><div key={label}><span>{label}</span><strong>{ready?count:'—'} <small>เคส</small></strong></div>)}</div><button className="overview-primary" onClick={()=>navigate('/visits')}>เปิดห้องตรวจ ↗</button><p className="finance-footnote">ฉบับร่างยังไม่ตัดสต็อกและไม่นับเป็นรายรับ</p></section>
    </div>
  </div>;
}
