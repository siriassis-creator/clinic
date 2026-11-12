export type AvatarAge = 'child' | 'teen' | 'adult' | 'senior' | 'unknown';
export function avatarProfile(patient: Record<string, any> = {}, now = new Date()) {
  const gender = patient.gender === 'ชาย' ? 'male' : patient.gender === 'หญิง' ? 'female' : 'neutral';
  let age: number | null = null;
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const birth = typeof patient.birthDate === 'string' ? patient.birthDate : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    const date = new Date(birth+'T00:00:00Z');
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === birth && birth <= today) {
      age = Number(today.slice(0,4))-Number(birth.slice(0,4))-(today.slice(5)<birth.slice(5)?1:0);
    }
  }
  if (age === null && patient.age !== '' && patient.age !== null && patient.age !== undefined && /^\d+$/.test(String(patient.age))) age = Number(patient.age);
  if (age !== null && (age < 0 || age > 130)) age = null;
  const group: AvatarAge = age === null ? 'unknown' : age < 13 ? 'child' : age < 20 ? 'teen' : age < 60 ? 'adult' : 'senior';
  const labels = {child:'เด็ก 0–12 ปี',teen:'วัยรุ่น 13–19 ปี',adult:'ผู้ใหญ่ 20–59 ปี',senior:'ผู้สูงอายุ 60 ปีขึ้นไป',unknown:'ไม่ทราบช่วงอายุ'};
  return { gender, group, label: `อวาตาร์มาตรฐาน ${gender === 'male' ? 'ชาย' : gender === 'female' ? 'หญิง' : 'ไม่ระบุเพศ'} · ${labels[group]}` };
}
export function patientIndex(patients: Record<string, any>[]) {
  const ids = new Map(patients.filter(p=>p.id).map(p=>[p.id,p]));
  const codes = new Map<string, Record<string, any> | null>();
  patients.forEach(p=>{if(p.cn) codes.set(p.cn,codes.has(p.cn)?null:p);});
  return (visit: Record<string, any>) => ids.get(visit.patientId) || codes.get(visit.cn) || visit.patientSnapshot || {};
}
