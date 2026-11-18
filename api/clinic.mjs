import { verifyClinicToken } from '../server/clinic-auth.mjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    const uid = await verifyClinicToken(token);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || JSON.stringify(body).length > 2000000) return res.status(400).json({ error: 'INVALID_REQUEST' });
    if (!process.env.CLINIC_GATEWAY_KEY || !process.env.CLINIC_SUPABASE_KEY) throw new Error('DATABASE_UNAVAILABLE');
    const response = await fetch('https://jscmuurzzjkyqixiukwl.supabase.co/rest/v1/rpc/clinic_gateway', {
      method: 'POST',
      headers: { apikey: process.env.CLINIC_SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: process.env.CLINIC_GATEWAY_KEY, p_uid: uid, p_request: body }),
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (!response.ok) {
      const conflict = result.message === 'CLINIC_CONFLICT';
      const forbidden = result.message === 'CLINIC_FORBIDDEN';
      return res.status(conflict ? 409 : forbidden ? 403 : 400).json({
        error: conflict ? 'CLINIC_CONFLICT' : forbidden ? 'ไม่มีสิทธิ์จัดการเคสนี้' : 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบรายการแล้วลองอีกครั้ง',
      });
    }
    return res.status(200).json(result);
  } catch (error) {
    const unauthenticated = error.message === 'UNAUTHENTICATED';
    return res.status(unauthenticated ? 401 : 503).json({
      error: unauthenticated ? 'กรุณาเข้าสู่ระบบด้วยบัญชีเจ้าหน้าที่คลินิกเดิม' : 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
    });
  }
}
