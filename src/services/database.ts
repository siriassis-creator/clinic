import { auth } from './firebase';

type Row = Record<string, any>;
type Ref = { collection: string; id?: string; constraints?: Constraint[] };
type Constraint = { kind: 'where' | 'order'; field: string; op: string; value?: any };
type DocumentRow = { id: string; data: Row; version: string };
const listeners = new Set<() => void>();

export async function databaseRequest(body: Row) {
  const user = auth.currentUser;
  if (!user) throw new Error('กรุณาเข้าสู่ระบบ');
  const response = await fetch('/api/clinic', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    Object.assign(error, { code: response.status === 409 ? 'CLINIC_CONFLICT' : 'DATABASE_ERROR' });
    throw error;
  }
  return result;
}

export const db = {};
export const collection = (_db: unknown, name: string): Ref => ({ collection: name });
export function doc(parent: Ref | unknown, name?: string, id?: string): Ref & { id: string } {
  return name === undefined ? { ...(parent as Ref), id: crypto.randomUUID() } : { collection: name, id: id ?? crypto.randomUUID() };
}
export const where = (field: string, op: string, value: any): Constraint => ({ kind: 'where', field, op, value });
export const orderBy = (field: string, op = 'asc'): Constraint => ({ kind: 'order', field, op });
export const query = (ref: Ref, ...constraints: Constraint[]): Ref => ({ ...ref, constraints });

function documentSnapshot(row: DocumentRow | undefined, id?: string) {
  return { id: row?.id || id || '', exists: () => Boolean(row), data: (): Row => structuredClone(row?.data ?? {}) };
}

async function read(ref: Ref) {
  const rows: DocumentRow[] = await databaseRequest({ action: 'read', collection: ref.collection, id: ref.id, constraints: ref.constraints || [] });
  return rows;
}
export async function getDoc(ref: Ref) { return documentSnapshot((await read(ref))[0], ref.id); }
export const getDocFromServer = getDoc;
export async function getDocs(ref: Ref) {
  const docs = (await read(ref)).map(row => documentSnapshot(row));
  return { docs, size: docs.length, empty: !docs.length, forEach: (fn: (row: ReturnType<typeof documentSnapshot>) => void) => docs.forEach(fn) };
}
export const getDocsFromServer = getDocs;

// Share each identical subscription across mounted patient tabs and release it when unused.
const subscriptions = new Map<string, { callbacks: Set<(value: any) => void>; errors: Set<(error: Error) => void>; stop: () => void; value?: any }>();
type QuerySnapshot = Awaited<ReturnType<typeof getDocs>>;
type Snapshot = QuerySnapshot & ReturnType<typeof documentSnapshot>;
export function onSnapshot(ref: Ref, callback: (value: Snapshot) => void, onError: (error: Error) => void = () => {}) {
  const key = auth.currentUser?.uid + ':' + JSON.stringify(ref);
  let entry = subscriptions.get(key);
  if (!entry) {
    let active = true;
    let pending = false;
    const uid = auth.currentUser?.uid;
    const current = { callbacks: new Set<(value: any) => void>(), errors: new Set<(error: Error) => void>(), stop: () => {}, value: undefined as any };
    const refresh = async () => {
      if (!active || pending || document.hidden || auth.currentUser?.uid !== uid) return;
      pending = true;
      try {
        const value = ref.id ? await getDoc(ref) : await getDocs(ref);
        if (active && auth.currentUser?.uid === uid) {
          current.value = value;
          current.callbacks.forEach(fn => fn(value));
        }
      } catch (error) { if (active) current.errors.forEach(fn => fn(error as Error)); }
      finally { pending = false; }
    };
    const interval = window.setInterval(() => void refresh(), 30000);
    const visibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visibility);
    listeners.add(refresh);
    current.stop = () => {
      active = false;
      clearInterval(interval);
      listeners.delete(refresh);
      document.removeEventListener('visibilitychange', visibility);
    };
    entry = current;
    subscriptions.set(key, current);
    queueMicrotask(() => void refresh());
  }
  entry.callbacks.add(callback);
  entry.errors.add(onError);
  if (entry.value) callback(entry.value);
  const current = entry;
  return () => {
    current.callbacks.delete(callback);
    current.errors.delete(onError);
    if (!current.callbacks.size) { current.stop(); subscriptions.delete(key); }
  };
}

function notify() { listeners.forEach(refresh => refresh()); }
export async function runTransaction<T>(_db: unknown, operation: (tx: any) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const reads: Row[] = [];
    const writes: Row[] = [];
    const tx = {
      get: async (ref: Ref) => {
        const row = (await read(ref))[0];
        reads.push({ collection: ref.collection, id: ref.id, version: row?.version ?? null });
        return documentSnapshot(row, ref.id);
      },
      set: (ref: Ref, data: Row, options?: { merge?: boolean }) => writes.push({ ...ref, action: options?.merge ? 'merge' : 'set', data }),
      update: (ref: Ref, data: Row) => writes.push({ ...ref, action: 'update', data }),
      delete: (ref: Ref) => writes.push({ ...ref, action: 'delete' }),
    };
    const value = await operation(tx);
    try {
      if (writes.length) {
        await databaseRequest({ action: 'commit', requestId: crypto.randomUUID(), reads, writes });
        notify();
      }
      return value;
    } catch (error: any) {
      if (error.code !== 'CLINIC_CONFLICT' || attempt === 3) throw error;
    }
  }
  throw new Error('เคสถูกแก้ไขพร้อมกัน กรุณาลองอีกครั้ง');
}
async function write(ref: Ref, action: string, data?: Row) {
  await databaseRequest({ action: 'commit', requestId: crypto.randomUUID(), reads: [], writes: [{ ...ref, action, data }] });
  notify();
}
export async function addDoc(ref: Ref, data: Row) {
  const next = { ...ref, id: crypto.randomUUID() };
  await write(next, 'create', data);
  return next;
}
export const updateDoc = (ref: Ref, data: Row) => write(ref, 'update', data);
export const deleteDoc = (ref: Ref) => write(ref, 'delete');
export const setDoc = (ref: Ref, data: Row, options?: { merge?: boolean }) => write(ref, options?.merge ? 'merge' : 'set', data);
