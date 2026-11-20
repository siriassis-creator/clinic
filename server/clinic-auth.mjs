import { createPublicKey, verify } from 'node:crypto';

const project = 'clinic-43b84';
const issuer = `https://securetoken.google.com/${project}`;
let certificates;
let certificatesExpire = 0;
const accounts = new Map();

export async function verifyClinicToken(token) {
  if (typeof token !== 'string' || token.length > 20000) throw new Error('UNAUTHENTICATED');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('UNAUTHENTICATED');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  const now = Date.now();
  if (header.alg !== 'RS256' || !header.kid || claims.aud !== project || claims.iss !== issuer ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      !Number.isFinite(claims.exp) || claims.exp * 1000 <= now ||
      !Number.isFinite(claims.iat) || claims.iat * 1000 > now + 30000 ||
      !Number.isFinite(claims.auth_time) || claims.auth_time * 1000 > now + 30000) {
    throw new Error('UNAUTHENTICATED');
  }
  if (!certificates || now >= certificatesExpire) {
    const response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('AUTH_UNAVAILABLE');
    certificates = await response.json();
    certificatesExpire = now + 3600000;
  }
  const certificate = certificates[header.kid];
  if (!certificate || !verify('RSA-SHA256', Buffer.from(parts.slice(0, 2).join('.')),
      createPublicKey(certificate), Buffer.from(parts[2], 'base64url'))) throw new Error('UNAUTHENTICATED');

  // Limit migration access to existing clinic accounts. Firebase remains the login provider.
  const cached = accounts.get(claims.sub);
  if (!cached || cached.expire <= now || cached.authTime !== claims.auth_time) {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.CLINIC_FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('UNAUTHENTICATED');
    const { users } = await response.json();
    const account = users?.find(user => user.localId === claims.sub);
    const cutoff = Number(process.env.CLINIC_ACCOUNT_CUTOFF_MS);
    if (!Number.isFinite(cutoff) || !account || account.disabled || !account.createdAt ||
        Number(account.createdAt) > cutoff || claims.auth_time * 1000 < Number(account.validSince || 0) * 1000) {
      throw new Error('UNAUTHENTICATED');
    }
    if (accounts.size > 100) accounts.clear();
    accounts.set(claims.sub, { expire: now + 60000, authTime: claims.auth_time });
  }
  return claims.sub;
}
