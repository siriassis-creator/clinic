import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyClinicToken } from '../server/clinic-auth.mjs';
import handler from '../api/clinic.mjs';

await test('clinic API requires a signed token from an existing clinic account', async () => {
  const originalFetch = globalThis.fetch;
  const oldCutoff = process.env.CLINIC_ACCOUNT_CUTOFF_MS;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  process.env.CLINIC_ACCOUNT_CUTOFF_MS = '2000';
  const now = Math.floor(Date.now() / 1000);
  const token = overrides => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
    const claims = Buffer.from(JSON.stringify({ aud: 'clinic-43b84', iss: 'https://securetoken.google.com/clinic-43b84', sub: 'staff', exp: now + 600, iat: now, auth_time: now, ...overrides })).toString('base64url');
    return header + '.' + claims + '.' + sign('RSA-SHA256', Buffer.from(header + '.' + claims), privateKey).toString('base64url');
  };
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('metadata/x509')) return Response.json({ test: pem });
    if (String(url).includes('accounts:lookup')) {
      const idToken = JSON.parse(options.body).idToken;
      const { sub } = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url'));
      return Response.json({ users: [{ localId: sub, createdAt: sub === 'new-staff' ? '3000' : '1000', disabled: sub === 'disabled-staff' }] });
    }
    throw new Error('Unexpected network request');
  };
  try {
    assert.equal(await verifyClinicToken(token({})), 'staff');
    await assert.rejects(() => verifyClinicToken(token({ aud: 'another-project' })));
    await assert.rejects(() => verifyClinicToken(token({ exp: now - 60 })));
    await assert.rejects(() => verifyClinicToken(token({ sub: 'new-staff' })));
    await assert.rejects(() => verifyClinicToken(token({ sub: 'disabled-staff' })));
    let code;
    const res = { setHeader() {}, status(value) { code = value; return this; }, json(value) { return value; } };
    await handler({ method: 'POST', headers: {}, body: { action: 'read', collection: 'patients' } }, res);
    assert.equal(code, 401);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldCutoff === undefined) delete process.env.CLINIC_ACCOUNT_CUTOFF_MS;
    else process.env.CLINIC_ACCOUNT_CUTOFF_MS = oldCutoff;
  }
});
