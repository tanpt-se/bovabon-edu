// Bovabon Edu — API đồng bộ trên Cloudflare Workers + D1.
// Đăng nhập bằng email + mã OTP (TOTP, RFC 6238) từ app authenticator; không gửi email, không mật khẩu.
import { renderSVG } from 'uqr';

const ISSUER = 'Bovabon Edu';
const STEP_MS = 30_000;
const PENDING_MS = 15 * 60_000;          // thời gian để hoàn tất đăng ký
const SESSION_MS = 180 * 24 * 3600_000;  // phiên đăng nhập 180 ngày
const MAX_FAILED = 5;                    // sai 5 lần liên tiếp → khoá tạm
const LOCK_MS = 15 * 60_000;
const MAX_PENDING = 1000;
const MAX_STATE_BYTES = 2 * 1024 * 1024;
const BACKUP_CODES = 8;

// ------------------------------------------------------------------ helpers
const enc = new TextEncoder();
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}
function localOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return origin === url.origin && (url.protocol === 'http:' || url.protocol === 'https:') &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  } catch {
    return false;
  }
}
function withCors(req, response) {
  response.headers.set('Vary', 'Origin');
  const origin = req.headers.get('Origin');
  if (localOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  return response;
}
class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra || {}; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

function randomBytes(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
function b64(bytes) { let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s); }
function unb64(str) { return Uint8Array.from(atob(str), (c) => c.charCodeAt(0)); }
const b64url = (bytes) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sha256hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(str) {
  let bits = 0, value = 0; const out = [];
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c); if (i < 0) throw new Error('base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

async function hotp(secretBytes, counter) {
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const msg = new ArrayBuffer(8); const view = new DataView(msg);
  view.setUint32(0, Math.floor(counter / 2 ** 32)); view.setUint32(4, counter >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = h[19] & 15;
  const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}
/** Trả về bước thời gian khớp (cho phép lệch ±1 bước) và lớn hơn lastStep, hoặc null. */
async function verifyTotp(secretB32, code, lastStep, now) {
  const secret = unbase32(secretB32);
  const step = Math.floor(now / STEP_MS);
  for (const s of [step, step - 1, step + 1]) {
    if (s > lastStep && (await hotp(secret, s)) === code) return s;
  }
  return null;
}

// TOTP secret được mã hoá trước khi lưu D1 (khoá ENC_KEY: 32 byte base64, đặt bằng `wrangler secret put ENC_KEY`)
async function aesKey(env) {
  if (!env.ENC_KEY) throw new HttpError(500, 'Server chưa cấu hình ENC_KEY');
  return crypto.subtle.importKey('raw', unb64(env.ENC_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function seal(env, text) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(text)));
  return b64(iv) + '.' + b64(ct);
}
async function unseal(env, sealed) {
  const [iv, ct] = sealed.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(env), unb64(ct));
  return new TextDecoder().decode(pt);
}

function normEmail(v) {
  const e = String(v || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail(400, 'Email không hợp lệ');
  return e;
}
function normCode(v) { return String(v || '').replace(/[\s-]/g, '').toUpperCase(); }
function registrationPayload(email, secret) {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
  return {
    email,
    secret: secret.match(/.{1,4}/g).join(' '),
    otpauth,
    qrSvg: renderSVG(otpauth, { ecc: 'M', border: 2 }),
    expiresInSeconds: PENDING_MS / 1000,
  };
}
async function body(req) {
  const limit = MAX_STATE_BYTES + 4096;
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > limit) fail(413, 'Dữ liệu quá lớn');
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      fail(413, 'Dữ liệu quá lớn');
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(400, 'JSON không hợp lệ'); }
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, 'JSON không hợp lệ'); }
}

// ------------------------------------------------------------------ auth
function lockCheck(user, now) {
  if (user.locked_until > now) {
    const secs = Math.ceil((user.locked_until - now) / 1000);
    fail(429, `Nhập sai quá nhiều lần. Thử lại sau ${Math.ceil(secs / 60)} phút.`, { 'Retry-After': String(secs) });
  }
}
async function registerFailure(env, user, now, revealLock = true) {
  const result = await env.DB.prepare(`
    UPDATE users
    SET failed = CASE WHEN failed + 1 >= ? THEN 0 ELSE failed + 1 END,
        locked_until = CASE WHEN failed + 1 >= ? THEN ? ELSE locked_until END
    WHERE id = ? AND confirmed = ? AND locked_until <= ?
  `).bind(MAX_FAILED, MAX_FAILED, now + LOCK_MS, user.id, user.confirmed, now).run();
  if (result.meta.changes !== 1 && revealLock) {
    const latest = await env.DB.prepare('SELECT locked_until FROM users WHERE id = ?').bind(user.id).first();
    if (latest) lockCheck(latest, now);
  }
}
async function consumeTotpStep(env, user, step, now, registration = false) {
  const statement = registration
    ? env.DB.prepare(`UPDATE users SET confirmed = 1, pending_until = NULL, last_step = ?, failed = 0, locked_until = 0
        WHERE id = ? AND confirmed = 0 AND pending_until >= ? AND last_step < ? AND locked_until <= ? AND totp_secret = ?`)
      .bind(step, user.id, now, step, now, user.totp_secret)
    : env.DB.prepare(`UPDATE users SET last_step = ?, failed = 0, locked_until = 0
        WHERE id = ? AND confirmed = 1 AND last_step < ? AND locked_until <= ?`)
      .bind(step, user.id, step, now);
  const result = await statement.run();
  return result.meta.changes === 1;
}
async function removeExpiredRegistrations(env, now) {
  await env.DB.prepare('DELETE FROM users WHERE confirmed = 0 AND (pending_until IS NULL OR pending_until <= ?)').bind(now).run();
}
async function newSession(env, userId, label, now) {
  const token = b64url(randomBytes(32));
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen, label) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256hex(token), userId, now, now + SESSION_MS, now, String(label || '').slice(0, 80) || null).run();
  return token;
}
const BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function newBackupCodes(env, userId) {
  const codes = [];
  for (let i = 0; i < BACKUP_CODES; i++) {
    const r = randomBytes(16);
    const raw = [...r].map((x) => BACKUP_ALPHABET[x % BACKUP_ALPHABET.length]).join('');
    codes.push([raw.slice(0, 4), raw.slice(4, 8), raw.slice(8, 12), raw.slice(12)].join('-'));
  }
  const stmts = [env.DB.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId)];
  for (const c of codes) stmts.push(env.DB.prepare('INSERT INTO backup_codes (user_id, code_hash) VALUES (?, ?)').bind(userId, await sha256hex(normCode(c))));
  await env.DB.batch(stmts);
  return codes;
}
async function authed(req, env, now) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.get('Authorization') || '');
  if (!m) fail(401, 'Chưa đăng nhập');
  const hash = await sha256hex(m[1]);
  const row = await env.DB.prepare('SELECT s.token_hash, s.user_id, s.last_seen, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(hash, now).first();
  if (!row) fail(401, 'Phiên đăng nhập đã hết hạn');
  if (now - row.last_seen > 3600_000) {
    await env.DB.prepare('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?').bind(now, now + SESSION_MS, hash).run();
  }
  return row;
}

// ------------------------------------------------------------------ routes
const routes = {
  'GET /': async () => json({ ok: true, service: 'bovabon-edu-api' }),

  // Bước 1 đăng ký: tạo secret TOTP + QR cho app authenticator
  'POST /auth/register': async (req, env, now) => {
    const { email: rawEmail } = await body(req);
    const email = normEmail(rawEmail);
    await removeExpiredRegistrations(env, now);
    const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const secret = base32(randomBytes(20));
    if (existing && (existing.confirmed || existing.locked_until > now)) return json(registrationPayload(email, secret));
    const sealed = await seal(env, secret);
    if (existing) {
      await env.DB.prepare('UPDATE users SET totp_secret = ?, pending_until = ?, last_step = 0 WHERE id = ?').bind(sealed, now + PENDING_MS, existing.id).run();
    } else {
      const created = await env.DB.prepare(`
        INSERT INTO users (email, totp_secret, confirmed, pending_until, created_at)
        SELECT ?, ?, 0, ?, ?
        WHERE (SELECT COUNT(*) FROM users WHERE confirmed = 0 AND pending_until > ?) < ?
      `).bind(email, sealed, now + PENDING_MS, now, now, MAX_PENDING).run();
      if (created.meta.changes !== 1) fail(503, 'Đang có quá nhiều yêu cầu đăng ký. Hãy thử lại sau.');
    }
    return json(registrationPayload(email, secret));
  },

  // Bước 2 đăng ký: nhập mã 6 số đầu tiên → kích hoạt tài khoản, nhận mã dự phòng + phiên đăng nhập
  'POST /auth/register/verify': async (req, env, now) => {
    const b = await body(req);
    const email = normEmail(b.email);
    const code = normCode(b.code);
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || user.confirmed || !user.pending_until || user.pending_until <= now || user.locked_until > now) fail(401, 'Email hoặc mã không đúng');
    const step = /^\d{6}$/.test(code) ? await verifyTotp(await unseal(env, user.totp_secret), code, user.last_step, now) : null;
    if (step === null) { await registerFailure(env, user, now, false); fail(401, 'Email hoặc mã không đúng'); }
    if (!await consumeTotpStep(env, user, step, now, true)) {
      await registerFailure(env, user, now, false);
      fail(401, 'Email hoặc mã không đúng');
    }
    const backupCodes = await newBackupCodes(env, user.id);
    const token = await newSession(env, user.id, b.device, now);
    return json({ token, email, backupCodes });
  },

  'POST /auth/login': async (req, env, now) => {
    const b = await body(req);
    const email = normEmail(b.email);
    const code = normCode(b.code);
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND confirmed = 1').bind(email).first();
    if (!user) fail(401, 'Email hoặc mã không đúng');
    if (user.locked_until > now) fail(401, 'Email hoặc mã không đúng');
    let ok = false;
    let backupCode = false;
    if (/^\d{6}$/.test(code)) {
      const step = await verifyTotp(await unseal(env, user.totp_secret), code, user.last_step, now);
      if (step !== null) ok = await consumeTotpStep(env, user, step, now);
    } else if (/^(?:[A-Z0-9]{8}|[A-Z0-9]{16})$/.test(code)) {
      const r = await env.DB.prepare(`UPDATE backup_codes SET used_at = ?
        WHERE user_id = ? AND code_hash = ? AND used_at IS NULL
          AND EXISTS (SELECT 1 FROM users WHERE id = ? AND confirmed = 1 AND locked_until <= ?)`)
        .bind(now, user.id, await sha256hex(code), user.id, now).run();
      ok = r.meta.changes === 1;
      backupCode = ok;
    }
    if (!ok) { await registerFailure(env, user, now, false); fail(401, 'Email hoặc mã không đúng'); }
    if (backupCode) {
      const reset = await env.DB.prepare('UPDATE users SET failed = 0, locked_until = 0 WHERE id = ? AND locked_until <= ?').bind(user.id, now).run();
      if (reset.meta.changes !== 1) fail(401, 'Email hoặc mã không đúng');
    }
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM backup_codes WHERE user_id = ? AND used_at IS NULL').bind(user.id).first();
    return json({ token: await newSession(env, user.id, b.device, now), email, backupCodesLeft: left.n });
  },

  'POST /auth/logout': async (req, env, now) => {
    const s = await authed(req, env, now);
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(s.token_hash).run();
    return json({ ok: true });
  },

  'GET /me': async (req, env, now) => {
    const s = await authed(req, env, now);
    const left = await env.DB.prepare('SELECT COUNT(*) AS n FROM backup_codes WHERE user_id = ? AND used_at IS NULL').bind(s.user_id).first();
    return json({ email: s.email, backupCodesLeft: left.n });
  },

  // Tạo lại mã dự phòng (cần mã OTP hiện tại)
  'POST /me/backup-codes': async (req, env, now) => {
    const s = await authed(req, env, now);
    const code = normCode((await body(req)).code);
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first();
    lockCheck(user, now);
    const step = /^\d{6}$/.test(code) ? await verifyTotp(await unseal(env, user.totp_secret), code, user.last_step, now) : null;
    if (step === null) { await registerFailure(env, user, now); fail(401, 'Mã OTP không đúng'); }
    if (!await consumeTotpStep(env, user, step, now)) {
      await registerFailure(env, user, now);
      fail(401, 'Mã OTP không đúng');
    }
    return json({ backupCodes: await newBackupCodes(env, user.id) });
  },

  'GET /state': async (req, env, now) => {
    const s = await authed(req, env, now);
    const row = await env.DB.prepare('SELECT data, version, updated_at FROM user_state WHERE user_id = ?').bind(s.user_id).first();
    return json(row ? { state: JSON.parse(row.data), version: row.version, updatedAt: row.updated_at } : { state: null, version: 0, updatedAt: null });
  },

  // Ghi đè có kiểm tra phiên bản: baseVersion phải bằng bản trên server, nếu không trả 409 kèm bản mới nhất để client gộp lại
  'PUT /state': async (req, env, now) => {
    const s = await authed(req, env, now);
    const b = await body(req);
    if (!b.state || typeof b.state !== 'object' || Array.isArray(b.state)) fail(400, 'Thiếu state');
    const data = JSON.stringify(b.state);
    if (data.length > MAX_STATE_BYTES) fail(413, 'Dữ liệu tiến độ quá lớn (tối đa 2 MB)');
    const base = Number.isSafeInteger(b.baseVersion) ? b.baseVersion : -1;
    let r;
    if (base === 0) {
      r = await env.DB.prepare('INSERT INTO user_state (user_id, data, version, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(s.user_id, data, now).run();
    } else {
      r = await env.DB.prepare('UPDATE user_state SET data = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?').bind(data, now, s.user_id, base).run();
    }
    if (r.meta.changes !== 1) {
      const cur = await env.DB.prepare('SELECT data, version, updated_at FROM user_state WHERE user_id = ?').bind(s.user_id).first();
      return json({ error: 'Dữ liệu trên server đã thay đổi', state: cur ? JSON.parse(cur.data) : null, version: cur ? cur.version : 0, updatedAt: cur ? cur.updated_at : null }, 409);
    }
    return json({ version: base + 1, updatedAt: now });
  },
};

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return withCors(req, new Response(null, { status: 204 }));
    if (path.startsWith('/auth/') || (req.method === 'POST' && path === '/me/backup-codes')) {
      const source = req.headers.get('CF-Connecting-IP') || 'unknown';
      const allowance = await env.AUTH_LIMITER.limit({ key: source });
      if (!allowance.success) return withCors(req, json({ error: 'Quá nhiều yêu cầu xác thực. Hãy thử lại sau.' }, 429, { 'Retry-After': '60' }));
    }
    const handler = routes[`${req.method} ${path}`];
    if (!handler) return withCors(req, json({ error: 'Không tìm thấy' }, 404));
    try {
      return withCors(req, await handler(req, env, Date.now()));
    } catch (e) {
      if (e instanceof HttpError) return withCors(req, json({ error: e.message }, e.status, e.extra));
      console.error(e);
      return withCors(req, json({ error: 'Lỗi máy chủ' }, 500));
    }
  },
  async scheduled(_controller, env) {
    await removeExpiredRegistrations(env, Date.now());
  },
};

// Xuất cho test
export { base32, unbase32, hotp };
