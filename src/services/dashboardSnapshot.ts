import { collection, doc, getDocFromServer, getDocsFromServer } from './database';
import { db } from './database';
import { auth } from './firebase';
import { expiryWarningDays } from './medicineExpiry';

const collections = ['patients', 'visits', 'pharmacy', 'medicine_history'] as const;

async function readSnapshot() {
  const configTask = getDocFromServer(doc(db, 'settings', 'appointment'));
  void configTask.catch(() => {});
  const rows = await Promise.allSettled(collections.map(async name => {
    const result = await getDocsFromServer(collection(db, name));
    return [name, result.docs.map(row => ({ ...row.data(), id: row.id }))] as const;
  }));
  const data = Object.fromEntries(rows.map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  }));
  const config = (await configTask).data();
  return {
    data,
    clinic: {
      name: config?.clinicName || 'เอื้องฟ้าคลินิก',
      subtitle: config?.clinicSubtitle || 'การพยาบาลและการผดุงครรภ์',
    },
    warningDays: expiryWarningDays(config?.expiryWarningDays),
    updatedAt: new Date(),
  };
}

type Snapshot = Awaited<ReturnType<typeof readSnapshot>>;
type SessionCache = { uid: string; snapshot?: Snapshot; pending?: Promise<Snapshot> };
let cache: SessionCache | undefined;

export function resetDashboardSnapshot(uid?: string) {
  if (cache?.uid !== uid || !uid) cache = undefined;
}

export function getDashboardSnapshot() {
  return cache?.uid === auth.currentUser?.uid ? cache?.snapshot : undefined;
}

export function refreshDashboardSnapshot() {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('กรุณาเข้าสู่ระบบใหม่'));
  if (!cache || cache.uid !== uid) cache = { uid };
  const session = cache;
  if (!session.pending) {
    session.pending = readSnapshot().then(snapshot => {
      if (cache !== session || auth.currentUser?.uid !== uid) {
        throw new Error('บัญชีผู้ใช้งานเปลี่ยนแล้ว');
      }
      session.snapshot = snapshot;
      return snapshot;
    }).finally(() => { session.pending = undefined; });
  }
  return session.pending;
}


// Keep the manually refreshed dashboard consistent with an explicit settings edit.
export function renameCachedDiagnosis(previous: string, label: string) {
  if (!cache?.snapshot || cache.uid !== auth.currentUser?.uid) return;
  cache.snapshot = { ...cache.snapshot, data: { ...cache.snapshot.data,
    visits: cache.snapshot.data.visits.map((row: Record<string, any>) => row.diagnosis === previous ? { ...row, diagnosis: label } : row),
  } };
}
