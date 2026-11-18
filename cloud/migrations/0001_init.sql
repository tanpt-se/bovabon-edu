-- Bovabon Edu cloud: tài khoản (email + TOTP), phiên đăng nhập, mã dự phòng, dữ liệu đồng bộ.
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  totp_secret   TEXT NOT NULL,              -- base32, mã hoá AES-GCM bằng secret ENC_KEY
  confirmed     INTEGER NOT NULL DEFAULT 0, -- 0 = đang đăng ký (chưa xác nhận mã OTP đầu tiên)
  pending_until INTEGER,                    -- hạn hoàn tất đăng ký (ms)
  last_step     INTEGER NOT NULL DEFAULT 0, -- bước thời gian TOTP đã dùng gần nhất (chống dùng lại mã)
  failed        INTEGER NOT NULL DEFAULT 0, -- số lần nhập sai liên tiếp
  locked_until  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

CREATE TABLE backup_codes (
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at   INTEGER,
  PRIMARY KEY (user_id, code_hash)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  label      TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE user_state (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL,
  version    INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
