import { avatarProfile } from '../services/patientAvatar';
import './PatientAvatar.css';

/** Standard illustration, never an actual patient photo. */
export default function PatientAvatar({ patient = {} }: { patient?: Record<string, any> }) {
  const {gender,group,label} = avatarProfile(patient);
  const child=group==='child', senior=group==='senior', female=gender==='female';
  const generic=group==='unknown';
  const hair=senior?'#a3adb9':group==='teen'?'#3e516a':'#35465f';
  const shirt=gender==='neutral'?'#71869e':female?'#8299cd':'#488bbd';
  return <span className="patient-avatar clinic-patient-avatar" role="img" aria-label={label} title={label}>
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="#eaf2fb"/>
      {generic ? <><circle cx="32" cy="24" r="11" fill="#93a8bf"/><path d="M12 61V53a20 17 0 0 1 40 0v8" fill="#93a8bf"/></> : <>
        {female&&<path d="M17 39V24c0-21 30-21 30 0v17L41 48H23Z" fill={hair}/>}
        <path d={child?'M11 64v-7c0-18 42-18 42 0v7':'M8 64v-7c0-20 48-20 48 0v7'} fill={shirt}/>
        <path d="M27 39h10v9q-5 7-10 0Z" fill="#edbfa2"/>
        <ellipse cx="32" cy={child?27:26} rx={child?14:13} ry={child?15:17} fill="#f5cfb2"/>
        {female ? <path d="M18 25c-3-21 32-24 28 3-5-3-10-9-11-12-3 5-11 9-17 9" fill={hair}/> : <path d={senior?'M19 23c-4-13 3-17 9-17v8h9V6c8 2 11 9 8 18l-4-6H23Z':'M18 24C12 8 28 3 39 9c10 0 10 11 7 17l-5-10c-7 4-14 2-17 2l-3 8Z'} fill={hair}/>}
        <circle cx="27" cy="28" r="1.4" fill="#39465b"/><circle cx="37" cy="28" r="1.4" fill="#39465b"/>
        <path d="M29 35q3 3 6 0" fill="none" stroke="#b87664" strokeWidth="1.5" strokeLinecap="round"/>
        {senior&&<g fill="none" stroke="#61778b" strokeWidth="1.4"><rect x="21" y="24" width="9" height="8" rx="3"/><rect x="34" y="24" width="9" height="8" rx="3"/><path d="M30 27h4"/></g>}
        {!child&&<path d="m25 48 7 7 7-7" fill="none" stroke="#ffffffaa" strokeWidth="2"/>}
      </>}
    </svg>
  </span>;
}
