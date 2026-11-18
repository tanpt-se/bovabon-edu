#!/usr/bin/env python3
"""Kiểm thử end-to-end API đồng bộ (chạy với `npm run dev` hoặc URL đã deploy).

    python3 test/e2e.py [http://127.0.0.1:8799]
"""
import base64, hashlib, hmac, http.client, json, struct, sys, time, urllib.error, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

API = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8799").rstrip("/")


def call_response(method, path, body=None, token=None, origin=None, preflight=False):
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "bovabon-e2e")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if origin:
        req.add_header("Origin", origin)
    if preflight:
        req.add_header("Access-Control-Request-Method", "POST")
        req.add_header("Access-Control-Request-Headers", "content-type")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}"), r.headers
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}"), e.headers


def call(method, path, body=None, token=None):
    status, payload, _ = call_response(method, path, body, token)
    return status, payload


def totp(secret, offset=0):
    key = base64.b32decode(secret.replace(" ", "") + "=" * (-len(secret.replace(" ", "")) % 8))
    step = int(time.time() // 30) + offset
    h = hmac.new(key, struct.pack(">Q", step), hashlib.sha1).digest()
    o = h[19] & 15
    return "%06d" % ((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000)


passed = 0
def check(name, cond, info=""):
    global passed
    if not cond:
        print(f"✗ {name} {info}")
        sys.exit(1)
    passed += 1
    print(f"✓ {name}")


def chunked_oversize_status():
    base = urlsplit(API)
    connection_type = http.client.HTTPSConnection if base.scheme == "https" else http.client.HTTPConnection
    connection = connection_type(base.hostname, base.port, timeout=15)
    path = (base.path.rstrip("/") or "") + "/auth/register"
    payload = b'{"email":"' + b'a' * (2 * 1024 * 1024 + 4096) + b'"}'
    connection.putrequest("POST", path)
    connection.putheader("Content-Type", "application/json")
    connection.putheader("Transfer-Encoding", "chunked")
    connection.endheaders()
    for offset in range(0, len(payload), 65536):
        chunk = payload[offset:offset + 65536]
        connection.send(f"{len(chunk):X}\r\n".encode() + chunk + b"\r\n")
    connection.send(b"0\r\n\r\n")
    response = connection.getresponse()
    response.read()
    connection.close()
    return response.status


check("chunked request body is capped before JSON parsing", chunked_oversize_status() == 413)

email = f"e2e-{uuid.uuid4().hex[:8]}@example.test"
s, r = call("POST", "/auth/register", {"email": email})
check("đăng ký trả secret + QR", s == 200 and r["qrSvg"].startswith("<svg") and r["otpauth"].startswith("otpauth://totp/"), r)
registration_keys = set(r)
secret = r["secret"]
s, r = call("POST", "/auth/register", {"email": "khong-hop-le"})
check("email sai định dạng bị từ chối", s == 400)
s, r = call("POST", "/auth/register/verify", {"email": email, "code": "000000" if totp(secret) != "000000" else "111111"})
check("mã sai khi xác nhận → 401", s == 401, r)
invalid_verify = r
registration_code = totp(secret)
with ThreadPoolExecutor(max_workers=2) as pool:
    registration_results = list(pool.map(lambda _: call("POST", "/auth/register/verify", {"email": email, "code": registration_code, "device": "e2e"}), range(2)))
check("OTP xác nhận đăng ký đồng thời chỉ phát một phiên", sum(s == 200 for s, _ in registration_results) == 1 and all(s in (200, 400, 401) for s, _ in registration_results), registration_results)
s, r = next((s, r) for s, r in registration_results if s == 200)
check("xác nhận mã đúng → token + 8 mã dự phòng 16 ký tự", s == 200 and r["token"] and len(r["backupCodes"]) == 8 and all(len(c.replace("-", "")) == 16 for c in r["backupCodes"]), r)
token, backups = r["token"], r["backupCodes"]
replay_code = totp(secret, offset=1)
with ThreadPoolExecutor(max_workers=2) as pool:
    replay_results = list(pool.map(lambda _: call("POST", "/me/backup-codes", {"code": replay_code}, token=token), range(2)))
check("cùng OTP chỉ tạo lại mã dự phòng một lần khi gọi đồng thời", sorted(s for s, _ in replay_results) == [200, 401], replay_results)
backups = next(r["backupCodes"] for s, r in replay_results if s == 200)
s, r = call("POST", "/auth/login", {"email": email, "code": replay_code})
check("OTP dùng để tạo lại mã dự phòng không đăng nhập lại được", s == 401, r)
s, r = call("POST", "/auth/register", {"email": email})
check("email đã có trả 200 và cùng cấu trúc QR như email mới", s == 200 and set(r) == registration_keys and r["email"] == email and r["qrSvg"].startswith("<svg") and r["secret"] != secret, r)
confirmed_registration = r
s, r = call("POST", "/auth/register/verify", {"email": email, "code": totp(confirmed_registration["secret"])})
check("OTP xác nhận của email đã có trả cùng lỗi 401", s == 401 and r == invalid_verify, r)
s, r = call("POST", "/auth/register/verify", {"email": f"missing-{uuid.uuid4().hex[:8]}@example.test", "code": "000000"})
check("email chưa từng đăng ký trả cùng lỗi 401", s == 401 and r == invalid_verify, r)
s, _, headers = call_response("POST", "/auth/register", {"email": email}, origin="http://127.0.0.1:45678")
check("CORS giữ origin loopback của app", s == 200 and headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:45678")
s, _, headers = call_response("POST", "/auth/register", {"email": email}, origin="https://attacker.example")
check("CORS không cho origin ngoài đọc phản hồi tài khoản", s == 200 and headers.get("Access-Control-Allow-Origin") is None)
s, _, headers = call_response("OPTIONS", "/auth/register", origin="https://attacker.example", preflight=True)
check("preflight origin ngoài bị chặn", s == 204 and headers.get("Access-Control-Allow-Origin") is None)

s, r = call("GET", "/me", token=token)
check("/me trả email", s == 200 and r["email"] == email and r["backupCodesLeft"] == 8, r)
s, r = call("GET", "/me")
check("/me không token → 401", s == 401)

s, r = call("GET", "/state", token=token)
check("state ban đầu rỗng", s == 200 and r["state"] is None and r["version"] == 0, r)
s, r = call("PUT", "/state", {"state": {"progress": {"answers": {}}, "n": 1}, "baseVersion": 0}, token=token)
check("ghi state lần đầu → version 1", s == 200 and r["version"] == 1, r)
s, r = call("PUT", "/state", {"state": {"n": 2}, "baseVersion": 0}, token=token)
check("ghi với version cũ → 409 kèm bản server", s == 409 and r["version"] == 1 and r["state"]["n"] == 1, r)
s, r = call("PUT", "/state", {"state": {"n": 2}, "baseVersion": 1}, token=token)
check("ghi đúng version → 2", s == 200 and r["version"] == 2, r)
s, r = call("GET", "/state", token=token)
check("đọc lại state", r["state"] == {"n": 2} and r["version"] == 2, r)

# Mã OTP đã dùng để xác nhận không dùng lại được (chống replay)
s, r = call("POST", "/auth/login", {"email": email, "code": totp(secret)})
check("dùng lại mã OTP vừa dùng → 401", s == 401, r)
bad_login = r
s, r = call("POST", "/auth/login", {"email": email, "code": backups[0]})
check("đăng nhập bằng mã dự phòng", s == 200 and r["backupCodesLeft"] == 7, r)
token2 = r["token"]
s, r = call("POST", "/auth/login", {"email": email, "code": backups[0]})
check("mã dự phòng chỉ dùng 1 lần", s == 401)
s, r = call("POST", "/auth/login", {"email": "ai-do@example.test", "code": "123456"})
check("email không tồn tại giống OTP sai", s == 401 and r == bad_login)
missing_login = r

s, r = call("POST", "/auth/logout", token=token2)
check("đăng xuất", s == 200)
s, r = call("GET", "/me", token=token2)
check("token đã đăng xuất → 401", s == 401)

# Khoá tạm sau nhiều lần sai (lần sai trước đó đã tính 1)
with ThreadPoolExecutor(max_workers=8) as pool:
    login_failures = list(pool.map(lambda _: call("POST", "/auth/login", {"email": email, "code": "999999" if totp(secret) != "999999" else "888888"}), range(8)))
check("đoán OTP đồng thời sau lockout vẫn trả lỗi 401 chung", all(s == 401 and r == missing_login for s, r in login_failures), login_failures)
s, r = call("POST", "/auth/login", {"email": email, "code": backups[1]})
check("tài khoản đang khoá giống email không tồn tại", s == 401 and r == missing_login, r)

locked_email = f"locked-{uuid.uuid4().hex[:8]}@example.test"
s, pending = call("POST", "/auth/register", {"email": locked_email})
check("tạo đăng ký chờ để kiểm tra lockout", s == 200, pending)
locked_secret = pending["secret"]
bad_code = "999999" if totp(locked_secret) != "999999" else "888888"
with ThreadPoolExecutor(max_workers=5) as pool:
    locked_attempts = list(pool.map(lambda _: call("POST", "/auth/register/verify", {"email": locked_email, "code": bad_code}), range(5)))
check("OTP sai khi đăng ký chờ vẫn trả lỗi 401 chung", all(s == 401 and r == invalid_verify for s, r in locked_attempts), locked_attempts)
s, r = call("POST", "/auth/register", {"email": locked_email})
check("đăng ký chờ đang bị khoá vẫn trả QR decoy 200", s == 200 and set(r) == registration_keys and r["email"] == locked_email and r["secret"] != locked_secret, r)

limited = [call("POST", "/auth/not-a-route")[0] for _ in range(50)]
check("auth limiter chặn yêu cầu dồn dập từ cùng nguồn", 429 in limited)

print(f"\n{passed} kiểm tra đều đạt ✅  ({API})")
