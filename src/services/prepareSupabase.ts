import { auth, app } from './firebase';
import { databaseRequest } from './database';

const collections = ['patients', 'visits', 'pharmacy', 'medicine_history', 'settings',
  'settings_diagnosis', 'settings_dosage', 'settings_services', 'settings_unit'];
let pending: { uid: string; task: Promise<void> } | undefined;

async function prepare() {
  const state = await databaseRequest({ action: 'migration_status' });
  if (state.ready) return;
  // This is the final one-time source sync. Normal pages use only the Supabase API.
  const source = await import('firebase/firestore');
  const firestore = source.getFirestore(app);
  const snapshots = await Promise.all(collections.map(async name => {
    const snapshot = await source.getDocsFromServer(source.collection(firestore, name));
    return { name, rows: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })) };
  }));
  const uid = auth.currentUser?.uid;
  if (!uid || pending?.uid !== uid) throw new Error('บัญชีผู้ใช้งานเปลี่ยนแล้ว');
  const jobId = crypto.randomUUID();
  const expected = Object.fromEntries(snapshots.map(snapshot => [snapshot.name, snapshot.rows.length]));
  const started = await databaseRequest({ action: 'migration_begin', jobId, expected });
  if (started.ready) return;
  for (const snapshot of snapshots) {
    for (let index = 0; index < snapshot.rows.length; index += 100) {
      await databaseRequest({ action: 'migration_upload', jobId, collection: snapshot.name, rows: snapshot.rows.slice(index, index + 100) });
    }
  }
  await databaseRequest({ action: 'migration_finish', jobId });
}

export function prepareSupabase() {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error('กรุณาเข้าสู่ระบบ'));
  if (!pending || pending.uid !== uid) {
    const task = prepare();
    pending = { uid, task };
    task.catch(() => { if (pending?.task === task) pending = undefined; });
  }
  return pending.task;
}
