/* Bovabon Edu — SPA (vanilla JS, không cần build). Tiến độ lưu localStorage, không cần đăng nhập. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = () => $('#view');
  $('#skip-link').onclick = () => view().focus();
  const TYPE_LABEL = { single: 'Trắc nghiệm', multiple: 'Nhiều đáp án', fill: 'Điền khuyết', essay: 'Tự luận', code: 'Bài tập code' };
  const LANG = {
    javascript: { label: 'JavaScript', engine: 'Boa JS engine (Rust)' },
    python: { label: 'Python', engine: 'Python 3 sandbox' },
    go: { label: 'Go', engine: 'go run (toolchain cục bộ)' },
    rust: { label: 'Rust', engine: 'rustc (toolchain cục bộ)' },
    php: { label: 'PHP', engine: 'PHP CLI cục bộ' },
  };
  const langOf = (q) => LANG[q.lang] || LANG.javascript;
  const testCount = (src) => (src.match(/(?:^|[^\w.])(?:test|it|Test)\(|^\s*"[^"\n]*"\s*=>/gm) || []).length;
  // Nhóm lộ trình theo thứ tự xuất hiện (Frontend, Backend, …)
  function trackGroups() {
    const out = [];
    for (const t of S.catalog.tracks) {
      const g = t.group || tr('Khác');
      let e = out.find((x) => x.name === g);
      if (!e) out.push((e = { name: g, tracks: [] }));
      e.tracks.push(t);
    }
    return out;
  }
  // Liên kết tham khảo DevDocs (mở tab mới). path dạng "react/reference/react/use".
  function docTitle(path) {
    const [slug, ...rest] = path.split('#')[0].split('/');
    const segs = rest.filter((x) => x && x !== 'index');
    const anchor = path.includes('#') ? path.split('#')[1] : '';
    return slug.split('~')[0] + ' › ' + (segs.length ? segs.slice(-2).join('/') : tr('tổng quan')) + (anchor ? ' #' + anchor : '');
  }
  function refLinks(paths, label) {
    if (!paths || !paths.length) return '';
    return `<div class="refs"><span class="refs-label">${label || 'Tài liệu tham khảo DevDocs'}</span>${paths.map((p) =>
      `<a href="https://devdocs.io/${encodeURI(p)}" target="_blank" rel="noopener noreferrer">${esc(docTitle(p))}${iconSvg('external-link', 'ic ref-external')}</a>`).join('')}</div>`;
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const stripHtml = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent || ''; };
  const diffStars = (d) => `<span class="diff" role="img" aria-label="${tr('Độ khó {d} trên 3', { d })}">${Array.from({ length: 3 }, (_, i) => iconSvg(i < d ? 'star-filled' : 'star', 'ic diff-star')).join('')}</span>`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function confirmDialog(message, options) {
    const config = Object.assign({ title: 'Xác nhận thao tác', confirmLabel: 'Tiếp tục', destructive: false }, options || {});
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'confirm-dialog';
      dialog.setAttribute('aria-labelledby', 'confirm-title');
      dialog.setAttribute('aria-describedby', 'confirm-message');
      dialog.innerHTML = `<form method="dialog" class="confirm-form">
        <h2 id="confirm-title">${esc(tr(config.title))}</h2>
        <p id="confirm-message">${esc(tr(message))}</p>
        <div class="confirm-actions"><button class="btn secondary" value="cancel">${tr('Huỷ')}</button><button class="btn ${config.destructive ? 'danger' : ''}" value="confirm">${esc(tr(config.confirmLabel))}</button></div>
      </form>`;
      dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'confirm'); dialog.remove(); }, { once: true });
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close('cancel'); });
      document.body.append(dialog);
      dialog.showModal();
      dialog.querySelector('[value="cancel"]').focus();
    });
  }

  const tr = window.I18N ? window.I18N.t : (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);
  const UI_LANG = window.I18N ? window.I18N.lang : 'vi';
  const LOCALE = UI_LANG === 'en' ? 'en-US' : 'vi-VN';
  for (const k in TYPE_LABEL) TYPE_LABEL[k] = tr(TYPE_LABEL[k]);
  for (const k in LANG) LANG[k].engine = tr(LANG[k].engine);
  // Nội dung đã dịch: server đọc ?lang=en (câu chưa dịch giữ tiếng Việt)
  const withLang = (p) => (UI_LANG === 'vi' || !p.startsWith('/api/') ? p : p + (p.includes('?') ? '&' : '?') + 'lang=' + UI_LANG);
  const api = {
    async get(p) { const r = await fetch(withLang(p)); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); },
    async post(p, body) {
      const r = await fetch(withLang(p), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      return r.json();
    },
  };

  // ------------------------------------------------------------------ progress store (localStorage)
  const KEY = 'bovabon.progress.v1';
  const Store = {
    data: null,
    empty() { return { answers: {}, code: {}, bookmarks: [], bmLog: {}, exams: [], activity: {}, created: Date.now() }; },
    normalize(value, requireAnswers) {
      const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
        && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
      const isTime = (v) => Number.isSafeInteger(v) && v >= 0;
      const isAnswerList = (v) => Array.isArray(v) && (v.every((item) => typeof item === 'string')
        || v.every((item) => Number.isSafeInteger(item) && item >= 0));
      const isDateKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
        && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
      if (!isObject(value)) return null;

      const hasAnswers = Object.prototype.hasOwnProperty.call(value, 'answers');
      const answers = Object.create(null);
      let answersValid = !hasAnswers || isObject(value.answers);
      if (answersValid && hasAnswers) {
        for (const [id, answer] of Object.entries(value.answers)) {
          if (!isObject(answer) || typeof answer.correct !== 'boolean' || !Number.isFinite(answer.score) || answer.score < 0 || answer.score > 1
            || !Number.isSafeInteger(answer.attempts) || answer.attempts < 1 || !isTime(answer.last)
            || typeof answer.everCorrect !== 'boolean'
            || !(typeof answer.answer === 'string' || isAnswerList(answer.answer))) {
            answersValid = false; break;
          }
          answers[id] = answer;
        }
      }
      if (requireAnswers && (!hasAnswers || !answersValid)) return null;

      const data = this.empty();
      data.answers = answersValid && hasAnswers ? answers : Object.create(null);

      const code = Object.create(null);
      let codeValid = !Object.prototype.hasOwnProperty.call(value, 'code') || isObject(value.code);
      if (codeValid && isObject(value.code)) {
        for (const [id, record] of Object.entries(value.code)) {
          if (!isObject(record) || !Number.isSafeInteger(record.attempts) || record.attempts < 0
            || !Number.isFinite(record.best) || record.best < 0 || record.best > 1
            || (record.last !== undefined && !isTime(record.last))
            || (record.draft !== undefined && typeof record.draft !== 'string')
            || (record.passed !== undefined && typeof record.passed !== 'boolean')
            || (record.lastRatio !== undefined && (!Number.isFinite(record.lastRatio) || record.lastRatio < 0 || record.lastRatio > 1))) {
            codeValid = false; break;
          }
          code[id] = record;
        }
      }
      if (requireAnswers && Object.prototype.hasOwnProperty.call(value, 'code') && !codeValid) return null;
      data.code = codeValid && isObject(value.code) ? code : Object.create(null);

      const bookmarks = value.bookmarks;
      const bookmarksValid = !Object.prototype.hasOwnProperty.call(value, 'bookmarks') || (Array.isArray(bookmarks) && bookmarks.every((id) => typeof id === 'string' && id.length > 0));
      if (requireAnswers && !bookmarksValid) return null;
      data.bookmarks = bookmarksValid && Array.isArray(bookmarks) ? bookmarks : [];

      const exams = value.exams;
      const examsValid = !Object.prototype.hasOwnProperty.call(value, 'exams') || (Array.isArray(exams) && exams.every((exam) => isObject(exam)
        && isTime(exam.date) && (exam.track === null || typeof exam.track === 'string')
        && Number.isSafeInteger(exam.total) && exam.total > 0
        && Number.isSafeInteger(exam.correct) && exam.correct >= 0 && exam.correct <= exam.total
        && Number.isFinite(exam.score) && exam.score >= 0 && exam.score <= 10 && Number.isSafeInteger(exam.seconds) && exam.seconds >= 0));
      if (requireAnswers && !examsValid) return null;
      data.exams = examsValid && Array.isArray(exams) ? exams : [];

      const activity = value.activity;
      const activityValid = !Object.prototype.hasOwnProperty.call(value, 'activity') || (isObject(activity) && Object.entries(activity).every(([date, count]) => isDateKey(date)
        && Number.isSafeInteger(count) && count >= 0));
      if (requireAnswers && !activityValid) return null;
      if (activityValid && isObject(activity)) data.activity = activity;
      if (requireAnswers && Object.prototype.hasOwnProperty.call(value, 'created') && !isTime(value.created)) return null;
      if (isTime(value.created)) data.created = value.created;
      // Nhật ký đánh dấu {id: [đang đánh dấu?, thời điểm]} — để đồng bộ cả thao tác bỏ đánh dấu
      if (isObject(value.bmLog)) {
        for (const [id, e] of Object.entries(value.bmLog)) {
          if (Array.isArray(e) && e.length === 2 && typeof e[0] === 'boolean' && isTime(e[1])) data.bmLog[id] = e;
        }
      }
      return data;
    },
    load() {
      try { this.data = this.normalize(JSON.parse(localStorage.getItem(KEY) || '{}'), false) || this.empty(); }
      catch (e) { this.data = this.empty(); }
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } Sync.schedule(); },
    bump() { const d = today(); this.data.activity[d] = (this.data.activity[d] || 0) + 1; },
    recordAnswer(qid, res, answer) {
      const prev = this.data.answers[qid] || { attempts: 0 };
      this.data.answers[qid] = {
        correct: !!res.correct, score: res.score, attempts: prev.attempts + 1, last: Date.now(), answer,
        everCorrect: !!(prev.everCorrect || res.correct),
      };
      this.bump(); this.save(); renderTopStats();
    },
    recordCode(qid, rep, code) {
      const prev = this.data.code[qid] || { attempts: 0, best: 0 };
      const ratio = rep.total ? rep.passed / rep.total : 0;
      this.data.code[qid] = Object.assign(prev, {
        attempts: prev.attempts + 1, last: Date.now(), draft: code,
        passed: prev.passed || rep.all_passed, best: Math.max(prev.best || 0, ratio), lastRatio: ratio,
      });
      this.bump(); this.save(); renderTopStats();
    },
    saveDraft(qid, code) { const c = this.data.code[qid] || { attempts: 0, best: 0 }; c.draft = code; this.data.code[qid] = c; this.save(); },
    status(qid) {
      const c = this.data.code[qid];
      if (c && c.attempts) return c.passed ? 'ok' : (c.best > 0 ? 'partial' : 'bad');
      const a = this.data.answers[qid];
      if (!a) return '';
      return a.correct ? 'ok' : (a.score > 0 ? 'partial' : 'bad');
    },
    done(qid) { const s = this.status(qid); return s === 'ok'; },
    toggleBookmark(qid) {
      const b = this.data.bookmarks; const i = b.indexOf(qid);
      if (i === -1) b.push(qid); else b.splice(i, 1);
      this.data.bmLog[qid] = [i === -1, Date.now()];
      this.save(); return i === -1;
    },
    streak() {
      let n = 0; const d = new Date();
      if (!this.data.activity[today()]) d.setDate(d.getDate() - 1);
      while (this.data.activity[d.toISOString().slice(0, 10)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
  };

  // ------------------------------------------------------------------ catalog
  const S = { catalog: null, allTracks: [], active: new Set(), tracks: {}, modules: {}, qmeta: {}, qcache: {} };
  const TRACK_MARKS = {
    javascript: 'browser', typescript: 'code', styling: 'tools', react: 'target',
    'react-native': 'layout-dashboard', nextjs: 'browser', vue: 'browser', angular: 'tools',
    testing: 'test-pipe', tooling: 'tools', nodejs: 'server', python: 'code', go: 'code',
    php: 'code', rust: 'code', 'web-api': 'plug-connected', databases: 'database', devops: 'server',
    'cefr-a1': 'book', 'cefr-a2': 'book', 'cefr-b1': 'book', 'cefr-b2': 'book',
    'cefr-c1': 'book', 'cefr-c2': 'book', 'en-collocations': 'book-2', 'en-vocab': 'book',
    'en-communication': 'language', 'en-docs': 'book-2', 'en-interview': 'pencil',
  };
  function iconSvg(name, className = 'ic') {
    return '<svg class="' + className + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="/icons.svg#tabler-' + name + '"></use></svg>';
  }
  function trackMark(track) {
    return `<span class="course-mark" aria-hidden="true">${iconSvg(TRACK_MARKS[track.id] || 'book-2', 'course-icon')}</span>`;
  }
  // Lộ trình bị tắt (lưu danh sách TẮT để lộ trình mới thêm vào kho mặc định được bật)
  const PREFS_KEY = 'bovabon.disabledTracks';
  const Prefs = {
    disabled() { try { return new Set(JSON.parse(localStorage.getItem(PREFS_KEY) || '[]')); } catch (e) { return new Set(); } },
    setDisabled(set, at) {
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify([...set]));
        localStorage.setItem(PREFS_KEY + '.at', String(at || Date.now()));
      } catch (e) { /* private mode */ }
      if (!at) Sync.schedule();
    },
    updatedAt() { try { return +localStorage.getItem(PREFS_KEY + '.at') || 0; } catch (e) { return 0; } },
  };
  // Khu vực học: 'dev' (lập trình, có Code Lab) | 'english' (chỉ trắc nghiệm / điền / tự luận)
  const AREA_KEY = 'bovabon.area';
  const AREAS = { dev: tr('Lập trình'), english: tr('Tiếng Anh') };
  S.area = (() => { try { return localStorage.getItem(AREA_KEY) === 'english' ? 'english' : 'dev'; } catch (e) { return 'dev'; } })();
  const areaOf = (t) => (t && t.area) || 'dev';
  const areaTracks = () => S.allTracks.filter((t) => areaOf(t) === S.area);
  function syncAreaUI() {
    document.body.dataset.area = S.area;
    $$('#area-switch button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.area === S.area)));
    const code = $('#nav a[data-route="code"]');
    if (code) code.hidden = S.area === 'english';
  }
  function setArea(a) {
    if (!AREAS[a] || a === S.area) return false;
    S.area = a;
    try { localStorage.setItem(AREA_KEY, a); } catch (e) {}
    if (S.catalog) { applyPrefs(); renderNav(); renderTopStats(); }
    syncAreaUI();
    return true;
  }
  function applyPrefs() {
    const off = Prefs.disabled();
    const inArea = areaTracks();
    let on = inArea.filter((t) => !off.has(t.id));
    if (!on.length) on = inArea.slice();
    S.catalog.tracks = on;
    S.active = new Set(on.map((t) => t.id));
  }
  const activeQs = () => Object.values(S.qmeta).filter((q) => S.active.has(q.track));
  const activeIds = () => activeQs().map((q) => q.id);
  // ------------------------------------------------------------------ đồng bộ đám mây (tuỳ chọn, kiểu Settings Sync của VS Code)
  // Không đăng nhập: mọi thứ lưu trên máy như cũ. Đăng nhập (email + OTP authenticator): tiến độ + cài đặt
  // được gộp với bản trên Cloudflare (Worker + D1, xem cloud/) và tự đồng bộ sau mỗi thay đổi.
  const SYNC_DEFAULT_API = 'https://bovabon-edu-api.phamtrongtandhcn2.workers.dev';
  const SYNC_KEY = 'bovabon.sync';
  function mergeProgress(a, b) {
    const out = Store.empty();
    out.created = Math.min(a.created || Date.now(), b.created || Date.now());
    for (const src of [a.answers, b.answers]) {
      for (const [id, r] of Object.entries(src)) {
        const cur = out.answers[id];
        if (!cur) { out.answers[id] = Object.assign({}, r); continue; }
        const newer = r.last > cur.last ? r : cur;
        out.answers[id] = Object.assign({}, newer, { attempts: Math.max(r.attempts, cur.attempts), everCorrect: !!(r.everCorrect || cur.everCorrect) });
      }
    }
    for (const src of [a.code, b.code]) {
      for (const [id, r] of Object.entries(src)) {
        const cur = out.code[id];
        if (!cur) { out.code[id] = Object.assign({}, r); continue; }
        const newer = (r.last || 0) > (cur.last || 0) ? r : cur;
        out.code[id] = Object.assign({}, newer, {
          attempts: Math.max(r.attempts || 0, cur.attempts || 0), best: Math.max(r.best || 0, cur.best || 0), passed: !!(r.passed || cur.passed),
        });
      }
    }
    for (const src of [a.bmLog, b.bmLog]) {
      for (const [id, e] of Object.entries(src)) { if (!out.bmLog[id] || e[1] > out.bmLog[id][1]) out.bmLog[id] = e; }
    }
    const marked = [];
    for (const id of a.bookmarks.concat(b.bookmarks)) {
      const log = out.bmLog[id];
      if (!marked.includes(id) && (!log || log[0])) marked.push(id);
    }
    for (const [id, e] of Object.entries(out.bmLog)) if (e[0] && !marked.includes(id)) marked.push(id);
    out.bookmarks = marked;
    const exams = new Map();
    for (const e of a.exams.concat(b.exams)) exams.set(`${e.date}|${e.track}|${e.total}`, e);
    out.exams = [...exams.values()].sort((x, y) => x.date - y.date);
    for (const src of [a.activity, b.activity]) {
      for (const [d, n] of Object.entries(src)) out.activity[d] = Math.max(out.activity[d] || 0, n);
    }
    return out;
  }
  const Sync = {
    conf: { api: SYNC_DEFAULT_API, token: null, email: null, lastSync: null, lastError: null },
    busy: false, again: false, timer: null, listeners: new Set(),
    load() {
      try { Object.assign(this.conf, JSON.parse(localStorage.getItem(SYNC_KEY) || '{}')); } catch (e) { /* bỏ qua */ }
      if (!this.conf.api) this.conf.api = SYNC_DEFAULT_API;
    },
    persist() { try { localStorage.setItem(SYNC_KEY, JSON.stringify(this.conf)); } catch (e) { /* private mode */ } this.listeners.forEach((fn) => fn()); },
    get on() { return !!this.conf.token; },
    async req(method, path, body, token) {
      let res;
      try {
        res = await fetch(this.conf.api.replace(/\/+$/, '') + path, {
          method,
          headers: Object.assign({ 'Content-Type': 'application/json' }, (token || this.conf.token) ? { Authorization: 'Bearer ' + (token || this.conf.token) } : {}),
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (e) { throw Object.assign(new Error('Không kết nối được máy chủ đồng bộ (đang offline?)'), { status: 0 }); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || tr('Lỗi {s}', { s: res.status })), { status: res.status, data });
      return data;
    },
    snapshot() { return { v: 1, progress: Store.data, prefs: { disabledTracks: [...Prefs.disabled()], updatedAt: Prefs.updatedAt() } }; },
    absorb(remote) {
      if (!remote || typeof remote !== 'object') return false;
      const before = JSON.stringify(this.snapshot());
      const rp = Store.normalize(remote.progress || {}, false);
      if (rp) { Store.data = mergeProgress(Store.data, rp); try { localStorage.setItem(KEY, JSON.stringify(Store.data)); } catch (e) {} }
      const pr = remote.prefs;
      if (pr && Array.isArray(pr.disabledTracks) && (pr.updatedAt || 0) > Prefs.updatedAt()) {
        Prefs.setDisabled(new Set(pr.disabledTracks.filter((id) => typeof id === 'string')), pr.updatedAt);
        if (S.catalog) applyPrefs();
      }
      return JSON.stringify(this.snapshot()) !== before;
    },
    async syncNow() {
      if (!this.on) return;
      if (this.busy) { this.again = true; return; }
      this.busy = true; clearTimeout(this.timer); this.timer = null;
      this.listeners.forEach((fn) => fn());
      let changed = false;
      try {
        const cur = await this.req('GET', '/state');
        changed = this.absorb(cur.state) || changed;
        let base = cur.version;
        for (let i = 0; ; i++) {
          try { await this.req('PUT', '/state', { state: this.snapshot(), baseVersion: base }); break; }
          catch (e) {
            if (e.status !== 409 || i >= 3) throw e;
            changed = this.absorb(e.data.state) || changed; base = e.data.version;
          }
        }
        this.conf.lastSync = Date.now(); this.conf.lastError = null;
      } catch (e) {
        this.conf.lastError = e.message;
        if (e.status === 401) { this.conf.token = null; this.conf.lastError = 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'; }
      } finally {
        this.busy = false; this.persist();
        if (changed && S.catalog) {
          renderNav(); renderTopStats();
          // Chỉ vẽ lại các trang tổng hợp; không làm gián đoạn khi đang làm bài
          const page = (location.hash.slice(2).split(/[/?]/)[0]) || '';
          if (['', 'progress', 'review', 'bank', 'code'].includes(page) || (page === 'settings' && !settingsDirty)) route();
        }
        if (this.again) { this.again = false; this.schedule(500); }
      }
    },
    schedule(ms) { if (!this.on) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.syncNow(), ms || 4000); },
    async signedIn(res) {
      Object.assign(this.conf, { token: res.token, email: res.email, lastError: null });
      this.persist();
      await this.syncNow();
    },
    async logout() {
      const token = this.conf.token;
      Object.assign(this.conf, { token: null, lastSync: null, lastError: null });
      this.persist();
      if (token) this.req('POST', '/auth/logout', undefined, token).catch(() => {});
    },
    device() { return (navigator.userAgent.includes('Macintosh') ? 'macOS' : navigator.platform || 'Thiết bị') + ', ' + (location.port ? 'app' : 'web'); },
  };
  Sync.load();
  Sync.listeners.add(() => renderTopStats());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && Sync.timer) Sync.syncNow(); });
  window.addEventListener('online', () => Sync.schedule(1000));

  async function loadCatalog() {
    S.catalog = await api.get('/api/catalog');
    S.allTracks = S.catalog.tracks.slice();
    for (const t of S.allTracks) {
      S.tracks[t.id] = t;
      for (const m of t.modules) { S.modules[m.id] = Object.assign({ track: t.id }, m); }
    }
    const all = await api.get('/api/questions');
    for (const q of all) { S.qmeta[q.id] = q; S.qcache[q.id] = q; }
    applyPrefs();
  }
  const trackQs = (tid) => Object.values(S.qmeta).filter((q) => q.track === tid);
  function progressOf(ids) {
    const done = ids.filter((id) => Store.done(id)).length;
    return { done, total: ids.length, p: pct(done, ids.length) };
  }
  function qTitle(q) {
    if (q.title) return q.title;
    const t = stripHtml(q.prompt_html).replace(/\s+/g, ' ').trim();
    return t.length > 110 ? t.slice(0, 110) + '…' : t;
  }

  // ------------------------------------------------------------------ shell
  function renderNav() {
    let index = 0;
    $('#nav-tracks').innerHTML = trackGroups().map((g) => `<div class="nav-sub">${esc(g.name)}</div>` + g.tracks.map((t) => {
      index += 1;
      return `<div class="nav-cat" data-cat="${t.id}"><a href="#/track/${t.id}" data-route="track-${t.id}">${trackMark(t)}<span class="nav-text">${esc(t.title)}</span><span class="nav-count">${t.modules.length}</span></a>`
        + `<div class="nav-mods">${t.modules.map((m) => `<a href="#/module/${m.id}" data-mod="${m.id}">${esc(m.title)}</a>`).join('')}</div></div>`;
    }).join('')).join('');
  }
  const sidebar = $('#sidebar');
  const menuButton = $('#menu-btn');
  const drawerCloseButton = $('#menu-close');
  const mobileDrawerQuery = matchMedia('(max-width: 760px)');
  function syncMobileDrawer() {
    const isMobile = mobileDrawerQuery.matches;
    const isOpen = isMobile && sidebar.classList.contains('open');
    if (isMobile && !isOpen) {
      sidebar.setAttribute('aria-hidden', 'true');
      sidebar.setAttribute('inert', '');
    } else {
      sidebar.removeAttribute('aria-hidden');
      sidebar.removeAttribute('inert');
    }
    drawerCloseButton.hidden = !isOpen;
    drawerCloseButton.style.display = isOpen ? 'inline-flex' : 'none';
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Đóng menu' : 'Mở menu');
  }
  function closeDrawer(returnFocus) {
    const wasOpen = mobileDrawerQuery.matches && sidebar.classList.contains('open');
    sidebar.classList.remove('open');
    syncMobileDrawer();
    if (returnFocus && wasOpen) menuButton.focus();
  }
  function focusViewStart() {
    const target = $('#view h1') || view();
    if (target !== view() && !target.hasAttribute('tabindex')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
  function setActive(route) {
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
    const openCat = route && route.startsWith('track-') ? route.slice(6) : null;
    const mod = (location.hash.match(/^#\/module\/([^?/]+)/) || [])[1];
    $$('#nav .nav-cat').forEach((c) => c.classList.toggle('open', c.dataset.cat === openCat));
    $$('#nav .nav-mods a').forEach((a) => a.classList.toggle('current', a.dataset.mod === mod));
    const drawerWasOpen = mobileDrawerQuery.matches && sidebar.classList.contains('open');
    closeDrawer(false);
    if (drawerWasOpen) setTimeout(focusViewStart, 50);
  }
  function crumbs(parts) {
    $('#crumbs').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${esc(tr(p[0]))}</b>` : `<a href="${p[1]}">${esc(tr(p[0]))}</a>`)).join(' / ');
    document.title = (parts.length ? tr(parts[parts.length - 1][0]) + ' | ' : '') + 'Bovabon Edu';
  }
  function renderTopStats() {
    if (!S.catalog) return;
    const ids = activeIds();
    const done = ids.filter((id) => Store.done(id)).length;
    $('#top-stats').innerHTML = `<span class="top-stat"><b>${done}</b> ${tr('/ {n} câu hoàn thành', { n: ids.length })}</span><span class="top-separator" aria-hidden="true"></span><span class="top-stat">${tr('{n} ngày học liên tiếp', { n: Store.streak() })}</span>`
      + (Sync.on ? `<span class="top-separator" aria-hidden="true"></span><a class="top-stat sync-stat${Sync.conf.lastError ? ' bad' : ''}" href="#/settings" title="${esc(Sync.conf.lastError || tr('Đồng bộ: {email}', { email: Sync.conf.email }))}">${iconSvg(Sync.conf.lastError ? 'alert-circle' : 'cloud', 'sync-stat-icon')}${Sync.busy ? 'Đang đồng bộ…' : Sync.conf.lastError ? 'Lỗi đồng bộ' : 'Đã đồng bộ'}</a>` : '');
  }

  // ------------------------------------------------------------------ pages
  function pageHome() {
    setActive('home'); crumbs([['Tổng quan', '#/']]);
    const ids = activeIds();
    const codeIds = ids.filter((id) => S.qmeta[id].type === 'code');
    const codePassed = codeIds.filter((id) => Store.data.code[id] && Store.data.code[id].passed).length;
    const wrong = ids.filter((id) => ['bad', 'partial'].includes(Store.status(id))).length;
    const done = ids.filter((id) => Store.done(id)).length;
    const last = Object.entries(Store.data.answers).concat(Object.entries(Store.data.code))
      .filter(([id, v]) => S.qmeta[id] && S.active.has(S.qmeta[id].track) && v.last).sort((a, b) => b[1].last - a[1].last)[0];
    const lastQ = last && S.qmeta[last[0]];
    const firstTrack = S.catalog.tracks.find((t) => S.active.has(t.id));
    const english = S.area === 'english';

    // Khối "Học tiếp": module gần nhất (hoặc danh mục đầu tiên nếu chưa học)
    let resume;
    if (lastQ) {
      const m = S.modules[lastQ.module], t = S.tracks[lastQ.track], p = progressOf(m.question_ids);
      const next = m.question_ids.find((id) => !Store.done(id)) || lastQ.id;
      resume = `<section class="resume" aria-labelledby="resume-title">
        <div class="resume-body">${trackMark(t)}<div class="resume-text"><span class="eyebrow">Học tiếp</span>
          <h2 id="resume-title">${esc(m.title)}</h2><p>${esc(t.title)} · ${tr('{d}/{t} câu hoàn thành', { d: p.done, t: p.total })}</p>
          <div class="bar" aria-hidden="true"><span style="width:${p.p}%"></span></div></div></div>
        <a class="btn lg" href="#/practice?module=${m.id}&start=${next}">Tiếp tục ${iconSvg('arrow-right', 'ic')}</a></section>`;
    } else if (firstTrack) {
      resume = `<section class="resume" aria-labelledby="resume-title">
        <div class="resume-body">${trackMark(firstTrack)}<div class="resume-text"><span class="eyebrow">Bắt đầu</span>
          <h2 id="resume-title">${esc(firstTrack.title)}</h2><p>${esc(firstTrack.description)}</p></div></div>
        <a class="btn lg" href="#/track/${firstTrack.id}">Vào học ${iconSvg('arrow-right', 'ic')}</a></section>`;
    } else resume = '';

    const stat = (icon, value, label, href) => `<a class="stat-tile" href="${href}">${iconSvg(icon, 'ic stat-icon')}<span class="stat-value">${value}</span><span class="stat-label">${label}</span></a>`;
    const stats = [
      stat('circle-check', `${done}<small>/${ids.length}</small>`, 'Câu đã hoàn thành', '#/progress'),
      stat('flame', Store.streak(), 'Ngày học liên tiếp', '#/progress'),
      stat('rotate-clockwise', wrong, 'Câu cần ôn lại', '#/review'),
      english ? stat('list-details', S.catalog.tracks.length, 'Danh mục', '#/bank') : stat('code', `${codePassed}<small>/${codeIds.length}</small>`, 'Bài code đã qua', '#/code'),
    ].join('');

    const groups = trackGroups().map((g) => {
      const cards = g.tracks.map((t) => {
        const pr = progressOf(trackQs(t.id).map((q) => q.id));
        return `<a class="cat-card" href="#/track/${t.id}">
          <span class="cat-head">${trackMark(t)}<strong>${esc(t.title)}</strong></span>
          <span class="cat-desc">${esc(t.description)}</span>
          <span class="cat-meta">${tr('{m} mục con, {q} câu', { m: t.modules.length, q: t.total })}${english ? '' : tr(', {c} bài code', { c: t.counts.code || 0 })}</span>
          <span class="cat-progress"><span class="bar" aria-hidden="true"><span style="width:${pr.p}%"></span></span><span class="cat-pct">${pr.p}%</span></span>
        </a>`;
      }).join('');
      return `<section class="cat-group"><div class="group-head"><h2>${esc(g.name)}</h2><span>${tr('{n} danh mục', { n: g.tracks.length })}</span></div><div class="cat-grid">${cards}</div></section>`;
    }).join('');

    const quick = (icon, href, title, desc) => `<a class="quick-tile" href="${href}">${iconSvg(icon, 'ic quick-icon')}<span><strong>${title}</strong><small>${desc}</small></span></a>`;
    view().innerHTML = `
      <header class="page-head"><div><h1>${english ? 'Tiếng Anh' : 'Lộ trình học'}</h1><p>${english ? 'Học theo chủ đề với trắc nghiệm, điền từ và tự luận ngắn; không có bài code.' : 'Chọn một danh mục để học bài, làm câu hỏi và bài code theo chủ đề.'}</p></div></header>
      ${resume}
      <div class="stat-row">${stats}</div>
      <section class="cat-group"><div class="group-head"><h2>Luyện tập nhanh</h2></div><div class="quick-grid">
        ${quick('arrows-shuffle', '#/practice?mode=random&count=10', '10 câu ngẫu nhiên', 'Trộn câu hỏi từ mọi danh mục')}
        ${quick('clock', '#/exam', 'Thi thử', 'Đề tính giờ, chấm khi nộp bài')}
        ${english ? quick('pencil', '#/practice?type=fill', 'Điền từ', 'Luyện các câu điền vào chỗ trống') : quick('code', '#/code', 'Code Lab', tr('{n} bài code có unit test', { n: codeIds.length }))}
        ${quick('target', '#/practice?type=essay', 'Tự luận', 'Trả lời theo ý chính và đáp án mẫu')}
      </div></section>
      ${groups}`;
  }

  function pageTrack(tid) {
    const t = S.tracks[tid];
    if (!t) return notFound();
    setActive('track-' + tid); crumbs([['Tổng quan', '#/'], [t.title, '#/track/' + tid]]);
    const all = trackQs(tid).map((q) => q.id);
    const pr = progressOf(all);
    const counts = ['single', 'multiple', 'fill', 'essay', 'code'].filter((k) => t.counts[k])
      .map((k) => `<a class="type-pill" href="#/practice?track=${tid}&type=${k}"><b>${t.counts[k]}</b> ${TYPE_LABEL[k]}</a>`).join('');
    view().innerHTML = `
      <section class="track-hero">
        <div class="track-hero-main">
          <div class="track-title">${trackMark(t)}<div><h1>${esc(t.title)}</h1><p>${esc(t.description)}</p></div></div>
          <div class="track-actions">
            <a class="btn lg" href="#/practice?track=${tid}">${iconSvg('player-play', 'ic')}${tr('Luyện toàn bộ ({n})', { n: t.total })}</a>
            <a class="btn secondary lg" href="#/exam?track=${tid}">${iconSvg('clock', 'ic')}Thi thử</a>
            ${t.counts.essay ? `<a class="btn ghost" href="#/practice?track=${tid}&type=essay">${tr('Ôn phỏng vấn ({n} câu tự luận)', { n: t.counts.essay })}</a>` : ''}
            ${t.counts.code ? `<a class="btn ghost" href="#/code?track=${tid}">${tr('Bài code ({n})', { n: t.counts.code })}</a>` : ''}
          </div>
        </div>
        <div class="track-stats">
          <div class="ring" style="--p:${pr.p}"><span>${pr.p}%</span></div>
          <div><b>${pr.done}/${pr.total}</b><span>câu hoàn thành</span></div>
        </div>
      </section>
      <div class="type-pills">${counts}</div>
      <div class="group-head"><h2>${tr('Mục con ({n})', { n: t.modules.length })}</h2></div>
      <div class="mod-grid">
        ${t.modules.map((m) => {
          const p = progressOf(m.question_ids);
          const state = p.total && p.done === p.total ? 'done' : p.done ? 'doing' : '';
          return `<a class="mod-card ${state}" href="#/module/${m.id}">
            <span class="mod-top"><strong>${esc(m.title)}</strong>${state === 'done' ? iconSvg('circle-check', 'ic mod-done') : ''}</span>
            <span class="mod-desc">${esc(m.description)}</span>
            <span class="mod-foot"><span class="bar" aria-hidden="true"><span style="width:${p.p}%"></span></span><span class="mod-count">${p.done}/${p.total}</span></span>
          </a>`;
        }).join('')}
      </div>
      ${t.docs && t.docs.length ? refLinks(t.docs, 'Tài liệu gốc trên DevDocs') : ''}`;
  }

  function questionList(ids, href) {
    if (!ids.length) return `<div class="empty">Không có câu hỏi nào.</div>`;
    return `<div class="card flush-card"><div class="qlist">${ids.map((id, i) => {
      const q = S.qmeta[id];
      return `<a class="qitem" href="${href(id, i)}"><span class="dot ${Store.status(id)}"></span>
        <span class="chip">${TYPE_LABEL[q.type]}</span>
        <span class="qt">${esc(qTitle(q))}</span>${diffStars(q.difficulty)}
        ${Store.data.bookmarks.includes(id) ? `<span class="bookmark-indicator" role="img" aria-label="Đã đánh dấu">${iconSvg('bookmark-filled', 'ic')}</span>` : ''}</a>`;
    }).join('')}</div></div>`;
  }

  function pageModule(mid, tab) {
    const m = S.modules[mid];
    if (!m) return notFound();
    const t = S.tracks[m.track];
    setActive('track-' + t.id);
    crumbs([['Tổng quan', '#/'], [t.title, '#/track/' + t.id], [m.title, '#/module/' + mid]]);
    tab = tab || 'lesson';
    const p = progressOf(m.question_ids);
    const typesHere = Object.keys(m.counts);
    view().innerHTML = `
      <div class="module-heading"><div><h1>${esc(m.title)}</h1></div>
        <a class="btn" href="#/practice?module=${mid}">${tr('Luyện tập module ({n})', { n: m.question_ids.length })}</a></div>
      <p class="muted">${esc(m.description)}, ${tr('{d}/{t} hoàn thành', { d: p.done, t: p.total })}</p>
      <div class="tabs" role="group" aria-label="Nội dung module">
        <button type="button" data-tab="lesson" aria-controls="tab-body" aria-pressed="${tab === 'lesson'}" class="${tab === 'lesson' ? 'active' : ''}">Bài học tóm tắt</button>
        <button type="button" data-tab="questions" aria-controls="tab-body" aria-pressed="${tab === 'questions'}" class="${tab === 'questions' ? 'active' : ''}">${tr('Câu hỏi ({n})', { n: m.question_ids.length })}</button>
        ${m.sources && m.sources.length ? `<button type="button" data-tab="docs" aria-controls="tab-body" aria-pressed="${tab === 'docs'}" class="${tab === 'docs' ? 'active' : ''}">Tài liệu gốc</button>` : ''}
      </div>
      <div id="tab-body"></div>`;
    const body = $('#tab-body');
    if (tab === 'lesson') {
      body.innerHTML = `<div class="card lesson">${m.lesson_html || '<p class="muted">Chưa có bài học.</p>'}${refLinks(m.sources, 'Đọc thêm trên DevDocs')}</div>
        <div class="section-title"><h2>Luyện theo dạng bài</h2></div>
        <div class="row">${typesHere.map((ty) => `<a class="btn secondary" href="#/practice?module=${mid}&type=${ty}">${TYPE_LABEL[ty]} (${m.counts[ty]})</a>`).join('')}</div>`;
      $$('.lesson table', body).forEach((table, index) => {
        const region = document.createElement('div');
        region.className = 'table-scroll';
        region.tabIndex = 0;
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', tr('Bảng {i}: {t}. Cuộn ngang để xem đủ cột.', { i: index + 1, t: m.title }));
        table.parentNode.insertBefore(region, table);
        region.appendChild(table);
        if (region.scrollWidth > region.clientWidth + 1) {
          const hint = document.createElement('p');
          hint.className = 'table-hint';
          hint.textContent = 'Cuộn ngang để xem đủ cột.';
          region.before(hint);
        }
      });
    } else if (tab === 'docs' && m.sources && m.sources.length) {
      renderDocs(body, m.sources);
    } else {
      body.innerHTML = questionList(m.question_ids, (id) => `#/practice?module=${mid}&start=${id}`);
    }
    $$('.tabs button').forEach((b) => (b.onclick = () => { location.hash = `#/module/${mid}${b.dataset.tab === 'lesson' ? '' : '?tab=' + b.dataset.tab}`; }));
  }

  // Đọc tài liệu gốc DevDocs ngay trong app: tải trang từ documents.devdocs.io khi xem (không lưu vào kho),
  // hiển thị trong iframe sandbox (không chạy script), link mở ra devdocs.io.
  function renderDocs(host, sources) {
    host.innerHTML = `<div class="docs-reader">
        <nav class="docs-list" aria-label="Tài liệu gốc">${sources.map((p, i) => `<button type="button" class="docs-item${i === 0 ? ' active' : ''}" data-i="${i}">${esc(docTitle(p))}</button>`).join('')}</nav>
        <div class="docs-pane"><div class="docs-bar"><span class="small muted" id="docs-status">Chọn một trang tài liệu để đọc ngay tại đây.</span><a class="small" id="docs-open" target="_blank" rel="noopener noreferrer" href="#">Mở trên DevDocs</a></div>
        <iframe class="doc-frame" id="doc-frame" title="DevDocs" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer"></iframe>
        <p class="tiny muted">Nội dung từ DevDocs, thuộc giấy phép của từng bộ tài liệu gốc.</p></div>
      </div>`;
    const frame = $('#doc-frame', host), status = $('#docs-status', host), open = $('#docs-open', host);
    let seq = 0;
    async function show(i) {
      const my = ++seq;
      $$('.docs-item', host).forEach((b) => b.classList.toggle('active', +b.dataset.i === i));
      const [path, anchor] = sources[i].split('#');
      const slug = path.split('/')[0];
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : slug + '/';
      open.href = 'https://devdocs.io/' + encodeURI(sources[i]);
      status.textContent = tr('Đang tải tài liệu…');
      try {
        const r = await fetch('https://documents.devdocs.io/' + encodeURI(path) + '.html');
        if (!r.ok) throw new Error(r.status);
        const html = await r.text();
        if (my !== seq) return;
        const cs = getComputedStyle(document.documentElement);
        const v = (n, d) => (cs.getPropertyValue(n) || d).trim();
        frame.srcdoc = `<!doctype html><meta charset="utf-8"><base href="https://devdocs.io/${encodeURI(dir)}" target="_blank">
          <style>body{font:15px/1.6 system-ui,sans-serif;margin:16px 20px;color:${v('--text', '#222')};background:${v('--surface', '#fff')}}
          a{color:${v('--accent', '#36c')}}pre,code{font:13px/1.5 ui-monospace,Menlo,monospace}pre{background:${v('--surface-2', '#f4f4f4')};padding:10px 12px;border-radius:6px;overflow:auto}
          table{border-collapse:collapse}td,th{border:1px solid ${v('--border', '#ddd')};padding:4px 8px}img{max-width:100%}h1{font-size:1.6em}</style>${html}`;
        frame.onload = () => {
          if (anchor) { try { const el = frame.contentDocument && frame.contentDocument.getElementById(anchor); if (el) el.scrollIntoView(); } catch (e) {} }
        };
        status.textContent = docTitle(sources[i]);
      } catch (e) {
        if (my !== seq) return;
        frame.srcdoc = '';
        status.textContent = tr('Không tải được tài liệu (cần kết nối mạng).');
      }
    }
    $$('.docs-item', host).forEach((b) => (b.onclick = () => show(+b.dataset.i)));
    show(0);
  }

  // ------------------------------------------------------------------ practice session
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function pagePractice(params) {
    let ids;
    let title = 'Luyện tập';
    const crumbsBase = [['Tổng quan', '#/']];
    if (params.ids) { ids = params.ids.split(',').filter((id) => S.qmeta[id] && S.active.has(S.qmeta[id].track)); title = ids.length === 1 ? qTitle(S.qmeta[ids[0]]) : 'Bộ câu hỏi tuỳ chọn'; }
    else {
      ids = (params.track || params.module ? Object.values(S.qmeta) : activeQs())
        .filter((q) => S.active.has(q.track))
        .filter((q) => !params.track || q.track === params.track)
        .filter((q) => !params.module || q.module === params.module)
        .filter((q) => !params.type || params.type.split(',').includes(q.type))
        .map((q) => q.id);
      if (params.module) { const m = S.modules[params.module]; crumbsBase.push([S.tracks[m.track].title, '#/track/' + m.track], [m.title, '#/module/' + m.id]); title = 'Luyện tập'; }
      else if (params.track) { crumbsBase.push([S.tracks[params.track].title, '#/track/' + params.track]); }
      if (params.type) title = tr('Luyện {types}', { types: params.type.split(',').map((t) => TYPE_LABEL[t]).join(', ') });
      if (params.mode === 'random') { ids = shuffle(ids.filter((id) => S.qmeta[id].type !== 'code')).slice(0, +params.count || 10); title = tr('Ngẫu nhiên {n} câu', { n: ids.length }); }
    }
    setActive(S.qmeta[ids[0]] && S.qmeta[ids[0]].type === 'code' && ids.length === 1 ? 'code' : (params.module ? 'track-' + S.modules[params.module].track : 'home'));
    crumbs(crumbsBase.concat([[title, location.hash]]));
    if (!ids.length) { view().innerHTML = `<div class="empty">Không có câu hỏi phù hợp.</div>`; return; }
    let idx = Math.max(0, params.start ? ids.indexOf(params.start) : 0);
    const session = { results: {} };

    function nav() {
      return `<div class="card qnav"><div class="row"><b>Tiến trình</b><span class="spacer"></span><span class="muted small">${idx + 1}/${ids.length}</span></div>
        <div class="qnav-grid">${ids.map((id, i) => {
          const st = session.results[id] || Store.status(id);
          return `<button data-i="${i}" class="${st} ${i === idx ? 'cur' : ''}" title="${esc(qTitle(S.qmeta[id]))}">${i + 1}</button>`;
        }).join('')}</div>
        <p class="tiny muted keyboard-hint">${tr('Phím tắt: nhấn {a} đến {b} để chọn, {enter} để kiểm tra hoặc sang câu tiếp, dùng {l} và {r} để chuyển câu.', { a: '<span class="kbd">1</span>', b: '<span class="kbd">6</span>', enter: '<span class="kbd">Enter</span>', l: '<span class="kbd">←</span>', r: '<span class="kbd">→</span>' })}</p></div>`;
    }
    function go(i) { idx = Math.max(0, Math.min(ids.length - 1, i)); draw(); }
    function draw() {
      const q = S.qcache[ids[idx]];
      view().innerHTML = `<div class="qwrap ${q.type === 'code' ? 'single' : ''}"><div id="qhost"></div><aside id="qnav">${nav()}</aside></div>`;
      $$('#qnav button[data-i]').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
      mountQuestion($('#qhost'), q, {
        index: idx, total: ids.length,
        onResult(res) { session.results[q.id] = res.correct ? 'ok' : res.score > 0 ? 'partial' : 'bad'; $('#qnav').innerHTML = nav(); $$('#qnav button[data-i]').forEach((b) => (b.onclick = () => go(+b.dataset.i))); },
        onPrev: idx > 0 ? () => go(idx - 1) : null,
        onNext: idx < ids.length - 1 ? () => go(idx + 1) : () => finish(),
        last: idx === ids.length - 1,
      });
      view().focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  function finish() {
      const done = ids.filter((id) => session.results[id]);
      const ok = done.filter((id) => session.results[id] === 'ok').length;
      const p = pct(ok, ids.length);
      view().innerHTML = `<div class="card session-complete">
        <div class="session-score"><b>${ok}/${ids.length}</b><span>câu đúng</span></div>
        <div class="result-progress" style="--result-color:${p >= 70 ? 'var(--ok)' : p >= 40 ? 'var(--warn)' : 'var(--bad)'}"><span style="width:${p}%"></span></div>
        <h2>Hoàn thành phiên luyện tập</h2>
        <p class="muted">${tr('Bạn đã làm {d}/{n} câu trong phiên này.', { d: done.length, n: ids.length })}</p>
        <div class="row" style="justify-content:center">
          <button class="btn" id="again">Làm lại từ đầu</button>
          ${ids.some((id) => session.results[id] && session.results[id] !== 'ok') ? `<a class="btn secondary" href="#/practice?ids=${ids.filter((id) => session.results[id] && session.results[id] !== 'ok').join(',')}">Ôn các câu sai</a>` : ''}
          <a class="btn ghost" href="#/">Về trang chủ</a>
        </div></div>`;
      $('#again').onclick = () => go(0);
    }
    draw();
  }

  // ------------------------------------------------------------------ question renderer
  function qHeader(q, opts) {
    const m = S.modules[q.module], t = S.tracks[q.track];
    const bm = Store.data.bookmarks.includes(q.id);
    return `<div class="qhead">
      ${opts.total ? `<span class="chip accent">${tr('Câu {i}/{n}', { i: opts.index + 1, n: opts.total })}</span>` : ''}
      <span class="chip">${TYPE_LABEL[q.type]}</span>
      <span class="chip">${esc(m.title)}</span>${diffStars(q.difficulty)}
      <span class="spacer"></span><span class="muted tiny">#${q.id}</span>
      ${opts.exam ? '' : `<button class="bookmark ${bm ? 'on' : ''}" data-bm title="Đánh dấu để ôn lại" aria-label="Đánh dấu" aria-pressed="${bm}">${iconSvg(bm ? 'bookmark-filled' : 'bookmark', 'ic bookmark-icon')}</button>`}
    </div>`;
  }
  function wireBookmark(host, q) {
    const b = $('[data-bm]', host);
    if (b) b.onclick = () => { const on = Store.toggleBookmark(q.id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.innerHTML = iconSvg(on ? 'bookmark-filled' : 'bookmark', 'ic bookmark-icon'); toast(on ? 'Đã đánh dấu câu hỏi' : 'Đã bỏ đánh dấu'); };
  }

  /**
   * opts: { exam, initial, onChange(answer), onResult(res), onPrev, onNext, index, total, review }
   */
  function mountQuestion(host, q, opts) {
    opts = opts || {};
    if (q.type === 'code' && !opts.exam) return mountCode(host, q, opts);
    const saved = opts.initial !== undefined ? opts.initial : (!opts.exam && Store.data.answers[q.id] ? Store.data.answers[q.id].answer : undefined);
    let answer = q.type === 'multiple' ? (Array.isArray(saved) ? saved.slice() : []) : q.type === 'single' ? (Array.isArray(saved) ? saved.slice() : []) : q.type === 'fill' ? (Array.isArray(saved) ? saved.slice() : []) : (typeof saved === 'string' ? saved : '');
    let checked = false;

    let inner = '';
    if (q.type === 'single' || q.type === 'multiple') {
      inner = `<div class="options" role="${q.type === 'single' ? 'radiogroup' : 'group'}" aria-label="${q.type === 'single' ? tr('Chọn một đáp án') : tr('Chọn các đáp án phù hợp')}">${q.options_html.map((o, i) =>
        `<button type="button" class="opt ${q.type === 'multiple' ? 'multi' : ''}" data-i="${i}" role="${q.type === 'single' ? 'radio' : 'checkbox'}" aria-checked="false"><span class="key">${q.type === 'multiple' ? '' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]}</span><span class="body">${o}</span></button>`).join('')}</div>
        ${q.type === 'multiple' ? '<p class="muted small options-hint">Chọn các lựa chọn phù hợp.</p>' : ''}`;
    } else if (q.type === 'essay') {
      inner = `<textarea class="essay" placeholder="${tr('Viết câu trả lời của bạn… (chấm theo các ý chính)')}">${esc(answer)}</textarea>`;
    }
    host.innerHTML = `<div class="card">${qHeader(q, opts)}<div class="qprompt">${q.prompt_html}</div>${inner}
      <div id="fb"></div>
      <div class="actions">
        ${opts.onPrev ? `<button class="btn ghost" data-prev>${iconSvg('arrow-left', 'ic')}Trước</button>` : ''}
        <span class="spacer"></span>
        ${opts.exam ? '' : '<button class="btn" data-check>Kiểm tra</button>'}
        ${opts.onNext ? `<button class="btn secondary" data-next>${opts.last ? 'Kết thúc' : `${opts.exam ? 'Câu tiếp' : 'Bỏ qua'} ${iconSvg('arrow-right', 'ic')}`}</button>` : ''}
      </div></div>`;
    wireBookmark(host, q);
    const blanks = $$('input.blank', host);
    blanks.forEach((inp, i) => inp.setAttribute('aria-label', tr('Ô trống {n}', { n: i + 1 })));

    function syncUI() {
      $$('.opt', host).forEach((b) => {
        const on = answer.includes(+b.dataset.i);
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        if (q.type === 'single') b.tabIndex = on || (!answer.length && +b.dataset.i === 0) ? 0 : -1;
      });
    }
    function changed() { if (opts.onChange) opts.onChange(answer); }
    $$('.opt', host).forEach((b) => (b.onclick = () => {
      if (checked) return;
      const i = +b.dataset.i;
      if (q.type === 'single') answer = [i];
      else answer = answer.includes(i) ? answer.filter((x) => x !== i) : answer.concat(i).sort();
      syncUI(); changed();
    }));
    const radioGroup = $('.options[role="radiogroup"]', host);
    if (radioGroup) radioGroup.onkeydown = (e) => {
      if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) return;
      const options = $$('.opt', radioGroup);
      if (!options.length) return;
      e.preventDefault();
      e.stopPropagation();
      const current = options.indexOf(document.activeElement);
      const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
      const next = (current + step + options.length) % options.length;
      options[next].focus();
      options[next].click();
    };
    blanks.forEach((inp, i) => {
      inp.value = answer[i] || '';
      inp.style.width = Math.max(10, (inp.value || '').length + 3) + 'ch';
      inp.oninput = () => { answer[i] = inp.value; inp.style.width = Math.max(10, inp.value.length + 3) + 'ch'; changed(); };
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (blanks[i + 1]) blanks[i + 1].focus(); else if (!opts.exam) check(); else if (opts.onNext) opts.onNext(); }
      };
    });
    const ta = $('textarea.essay', host);
    if (ta) ta.oninput = () => { answer = ta.value; changed(); };
    syncUI();

    async function check() {
      if (checked) { if (opts.onNext) opts.onNext(); return; }
      if (q.type === 'fill') { for (let i = 0; i < q.blank_count; i++) answer[i] = answer[i] || ''; }
      const empty = (q.type === 'essay' && !answer.trim()) || ((q.type === 'single' || q.type === 'multiple') && !answer.length) || (q.type === 'fill' && answer.every((x) => !x.trim()));
      if (empty) { toast('Bạn chưa trả lời'); return; }
      const btn = $('[data-check]', host); btn.disabled = true;
      try {
        const res = await api.post(`/api/questions/${q.id}/check`, { answer });
        checked = true;
        Store.recordAnswer(q.id, res, answer);
        showFeedback(host, q, res, answer);
        btn.disabled = false;
        btn.innerHTML = opts.onNext ? `${opts.last ? 'Hoàn thành' : 'Câu tiếp'} ${iconSvg(opts.last ? 'check' : 'arrow-right', 'ic')}` : `${iconSvg('check', 'ic')}Đã chấm`;
        const skip = $('[data-next]', host); if (skip) skip.remove();
        if (!opts.onNext) btn.disabled = true;
        const retry = document.createElement('button'); retry.className = 'btn ghost'; retry.innerHTML = `${iconSvg('rotate-clockwise', 'ic')}Làm lại`;
        retry.onclick = () => mountQuestion(host, q, Object.assign({}, opts, { initial: q.type === 'essay' ? answer : [] }));
        btn.before(retry);
        if (opts.onResult) opts.onResult(res);
      } catch (e) { btn.disabled = false; toast(tr('Lỗi: {e}', { e: e.message })); }
    }
    const cb = $('[data-check]', host); if (cb) cb.onclick = check;
    const nb = $('[data-next]', host); if (nb) nb.onclick = () => opts.onNext();
    const pb = $('[data-prev]', host); if (pb) pb.onclick = () => opts.onPrev();

    // phím tắt
    host._keys = (e) => {
      if (e.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return;
      if (/^[1-9]$/.test(e.key) && (q.type === 'single' || q.type === 'multiple')) { const b = $$('.opt', host)[+e.key - 1]; if (b) b.click(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (opts.exam) { if (opts.onNext) opts.onNext(); } else check(); }
      else if (e.key === 'ArrowRight' && opts.onNext) opts.onNext();
      else if (e.key === 'ArrowLeft' && opts.onPrev) opts.onPrev();
    };
    bindKeys(host._keys, host);
    if (opts.review) showFeedback(host, q, opts.review, answer);
    if (blanks[0] && !opts.review && !opts.exam) setTimeout(() => blanks[0].focus({ preventScroll: true }), 30);
  }

  let currentKeyHandler = null;
  let currentQuestionHost = null;
  function bindKeys(fn, host) { currentKeyHandler = fn; currentQuestionHost = host || null; }
  document.addEventListener('keydown', (e) => {
    if (currentKeyHandler && currentQuestionHost?.contains(e.target) && !document.querySelector('dialog[open]')
      && !e.metaKey && !e.ctrlKey && !e.altKey) currentKeyHandler(e);
  });

  function showFeedback(host, q, res, answer) {
    const cls = res.correct ? 'ok' : res.score > 0 ? 'partial' : 'bad';
    const verdict = res.correct ? `${iconSvg('check', 'ic verdict-icon')}Chính xác` : res.score > 0 ? `${iconSvg('minus', 'ic verdict-icon')}${tr('Đúng một phần ({p}%)', { p: Math.round(res.score * 100) })}` : `${iconSvg('x', 'ic verdict-icon')}Chưa đúng`;
    if (q.type === 'single' || q.type === 'multiple') {
      $$('.opt', host).forEach((b) => {
        const i = +b.dataset.i; b.disabled = true;
        b.classList.remove('selected');
        if (res.correct_options.includes(i)) b.classList.add('correct');
        else if (answer.includes(i)) b.classList.add('wrong');
      });
    }
    if (q.type === 'fill') {
      $$('input.blank', host).forEach((inp, i) => {
        inp.readOnly = true;
        inp.classList.add(res.blank_results[i] ? 'ok' : 'bad');
        if (!res.blank_results[i] && !inp.nextElementSibling?.classList?.contains('blank-fix')) {
          const s = document.createElement('span'); s.className = 'blank-fix'; s.innerHTML = `${iconSvg('arrow-right', 'ic')} ${esc(res.blank_answers[i])}`; inp.after(s);
        }
      });
    }
    if (q.type === 'essay') { const ta = $('textarea.essay', host); if (ta) ta.readOnly = true; }
    let extra = '';
    if (q.type === 'essay') {
      extra = `<p><b>Ý chính đã nêu:</b> ${res.matched_keywords.map((k) => `<span class="chip ok kw">${esc(k)}</span>`).join('') || '<span class="muted">chưa có</span>'}</p>
        ${res.missing_keywords.length ? `<p><b>Ý còn thiếu:</b> ${res.missing_keywords.map((k) => `<span class="chip bad kw">${esc(k)}</span>`).join('')}</p>` : ''}
        <details open><summary>Đáp án mẫu</summary><div style="margin-top:8px">${res.model_answer_html}</div></details>`;
    }
    $('#fb', host).innerHTML = `<div class="feedback ${cls}"><div class="verdict">${verdict}</div>${extra}${res.explanation_html ? `<div style="margin-top:8px">${res.explanation_html}</div>` : ''}${refLinks(q.sources)}</div>`;
  }

  // ------------------------------------------------------------------ code exercise
  function mountCode(host, q, opts) {
    const st = Store.data.code[q.id] || {};
    const initial = st.draft != null ? st.draft : q.starter;
    host.innerHTML = `<div class="card">${qHeader(q, opts)}<h2>${esc(q.title)}</h2><div class="qprompt">${q.prompt_html}</div>${refLinks(q.sources)}</div>
      <div class="code-layout">
        <div class="stack code-stack">
          <div class="panel-title">Bộ unit test có sẵn <span class="chip">${testCount(q.tests)} test</span></div>
          <details><summary>${tr('Xem mã nguồn test ({l})', { l: langOf(q).label })}</summary><pre><code>${esc(q.tests.trim())}</code></pre></details>
          <div id="hints"></div>
          <div id="solution"></div>
        </div>
        <div class="code-stack">
          <div class="row code-toolbar">
            <div class="panel-title compact-panel-title">Code của bạn <span class="chip lang-${esc(q.lang || 'javascript')}">${langOf(q).label}</span></div><span class="spacer"></span>
            <button class="btn ghost sm" data-reset title="Khôi phục code khởi đầu">${iconSvg('rotate-clockwise', 'ic')}Đặt lại</button>
          </div>
          <div class="editor"><div class="gutter" aria-hidden="true"></div><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${tr('Trình soạn code')}"></textarea></div>
          <div class="actions code-actions">
            ${opts.onPrev ? `<button class="btn ghost" data-prev>${iconSvg('arrow-left', 'ic')}Trước</button>` : ''}
            <button class="btn ok" data-run>Chạy test <span class="kbd">⌘/Ctrl ↵</span></button>
            <button class="btn secondary" data-hint>Gợi ý</button>
            <button class="btn ghost" data-sol>Lời giải</button>
            <span class="spacer"></span>
            ${opts.onNext ? `<button class="btn secondary" data-next>${opts.last ? 'Kết thúc' : `Bài tiếp ${iconSvg('arrow-right', 'ic')}`}</button>` : ''}
          </div>
          <div id="run-out" class="run-output"></div>
          <div id="run-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
        </div>
      </div>`;
    wireBookmark(host, q);
    const ta = $('.editor textarea', host), gutter = $('.editor .gutter', host);
    ta.value = initial;
    const syncGutter = () => {
      const n = ta.value.split('\n').length;
      gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
      gutter.scrollTop = ta.scrollTop;
      ta.style.height = 'auto'; ta.style.height = Math.max(380, ta.scrollHeight + 4) + 'px';
    };
    syncGutter();
    let draftT;
    ta.addEventListener('input', () => { syncGutter(); clearTimeout(draftT); draftT = setTimeout(() => Store.saveDraft(q.id, ta.value), 400); });
    ta.addEventListener('scroll', () => (gutter.scrollTop = ta.scrollTop));
    ta.addEventListener('keydown', (e) => {
      const { selectionStart: s, selectionEnd: en, value: v } = ta;
      if (e.key === 'Tab') {
        e.preventDefault();
        const lineStart = v.lastIndexOf('\n', s - 1) + 1;
        if (e.shiftKey) {
          if (v.slice(lineStart, lineStart + 2) === '  ') { ta.setRangeText('', lineStart, lineStart + 2, 'preserve'); }
        } else ta.setRangeText('  ', s, en, 'end');
        ta.dispatchEvent(new Event('input'));
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
      else if (e.key === 'Enter') {
        const lineStart = v.lastIndexOf('\n', s - 1) + 1;
        const indent = (v.slice(lineStart, s).match(/^\s*/) || [''])[0];
        const extra = /[{([]\s*$/.test(v.slice(lineStart, s)) ? '  ' : '';
        e.preventDefault();
        ta.setRangeText('\n' + indent + extra, s, en, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    });

    async function run() {
      const btn = $('[data-run]', host); btn.disabled = true;
      const out = $('#run-out', host);
      const announcement = $('#run-announcement', host);
      out.innerHTML = `<div class="muted">${tr('Đang chạy test trên server…')}${q.lang === 'go' ? tr(' (Go cần biên dịch, có thể mất vài giây)') : ''}</div>`;
      announcement.textContent = 'Đang chạy kiểm thử.';
      Store.saveDraft(q.id, ta.value);
      try {
        const rep = await api.post(`/api/questions/${q.id}/run`, { code: ta.value });
        Store.recordCode(q.id, rep, ta.value);
        out.innerHTML = renderRun(rep, q);
        announcement.textContent = rep.error
          ? tr('Kiểm thử gặp lỗi: {e}. Xem chi tiết bên dưới.', { e: rep.error.trim().split(/\r?\n/, 1)[0] })
          : rep.all_passed
            ? tr('Đã chạy {n} kiểm thử; tất cả đều đạt.', { n: rep.total })
            : tr('Đã chạy {n} kiểm thử; {p} đạt, {f} chưa đạt.', { n: rep.total, p: rep.passed, f: rep.total - rep.passed });
        if (opts.onResult) opts.onResult({ correct: rep.all_passed, score: rep.total ? rep.passed / rep.total : 0 });
        if (rep.all_passed) toast('Tất cả bài kiểm thử đều đạt.');
      } catch (e) {
        out.innerHTML = `<div class="feedback bad">${tr('Lỗi: {e}', { e: esc(e.message) })}</div>`;
        announcement.textContent = tr('Không thể chạy kiểm thử: {e}', { e: e.message });
      }
      btn.disabled = false;
    }
    let hintN = 0;
    $('[data-run]', host).onclick = run;
    $('[data-reset]', host).onclick = async () => { if (await confirmDialog('Code hiện tại sẽ được thay bằng code khởi đầu.', { title: 'Khôi phục code khởi đầu', confirmLabel: 'Khôi phục' })) { ta.value = q.starter; ta.dispatchEvent(new Event('input')); } };
    $('[data-hint]', host).onclick = async () => {
      if (hintN >= q.hint_count) { toast(q.hint_count ? 'Đã hết gợi ý' : 'Bài này không có gợi ý'); return; }
      const h = await api.get(`/api/questions/${q.id}/hint/${hintN}`);
      hintN++;
      $('#hints', host).insertAdjacentHTML('beforeend', `<div class="feedback partial"><div class="verdict">${tr('Gợi ý {i}/{n}', { i: h.index + 1, n: h.total })}</div>${h.html}</div>`);
    };
    $('[data-sol]', host).onclick = async () => {
      if (!(Store.data.code[q.id] && Store.data.code[q.id].attempts) && !await confirmDialog('Bạn chưa chạy thử bài này lần nào.', { title: 'Xem lời giải trước khi thử?', confirmLabel: 'Xem lời giải' })) return;
      const s = await api.get(`/api/questions/${q.id}/solution`);
      $('#solution', host).innerHTML = `<details open><summary>Lời giải tham khảo</summary><pre><code>${esc(s.solution.trim())}</code></pre>
        <div class="solution-explanation">${s.explanation_html}</div><button class="btn secondary sm copy-solution" data-use>Chép vào editor</button></details>`;
      $('[data-use]', host).onclick = () => { ta.value = s.solution.trim() + '\n'; ta.dispatchEvent(new Event('input')); };
    };
    const nb = $('[data-next]', host); if (nb) nb.onclick = () => opts.onNext();
    const pb = $('[data-prev]', host); if (pb) pb.onclick = () => opts.onPrev();
    bindKeys(null);
    if (st.attempts) $('#run-out', host).innerHTML = `<p class="muted small">${tr('Đã chạy {n} lần, tốt nhất {p}%', { n: st.attempts, p: Math.round((st.best || 0) * 100) })} ${st.passed ? '<span class="chip ok">ĐÃ ĐẠT</span>' : ''}</p>`;
  }

  function renderRun(rep, q) {
    const ok = rep.all_passed;
    return `<div class="run-summary ${ok ? 'ok' : 'bad'}">${iconSvg(ok ? 'check' : 'x', 'ic run-status-icon')}${tr('{p}/{n} bài kiểm thử đạt', { p: rep.passed, n: rep.total })} <span class="spacer"></span><span class="tiny" style="font-weight:500">${rep.duration_ms} ms, ${q ? langOf(q).engine : 'Rust'}</span></div>
      ${rep.error ? `<div class="feedback bad run-error"><div class="verdict">Lỗi</div><code style="white-space:pre-wrap">${esc(rep.error)}</code></div>` : ''}
      <div class="test-results">${rep.results.map((r) => `<div class="tres ${r.passed ? 'ok' : 'bad'}"><span class="mark">${iconSvg(r.passed ? 'check' : 'x', 'ic')}</span><div class="test-detail"><div>${esc(r.name)}</div>${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}</div></div>`).join('')}</div>
      ${rep.logs.length ? `<div class="panel-title console-title">Console</div><div class="console">${esc(rep.logs.join('\n'))}</div>` : ''}`;
  }

  // ------------------------------------------------------------------ code lab
  function pageCode(params) {
    setActive('code'); crumbs([['Tổng quan', '#/'], ['Code Lab', '#/code']]);
    const all = activeQs().filter((q) => q.type === 'code');
    const tf = params.track || '';
    const list = all.filter((q) => !tf || q.track === tf);
    const passed = list.filter((q) => Store.data.code[q.id] && Store.data.code[q.id].passed).length;
    const selectedTrack = tf && S.tracks[tf] ? S.tracks[tf].title : '';
    view().innerHTML = `
      <section class="code-heading">
        <div><h1>Code Lab</h1><p>Chọn bài để viết lời giải và chạy bộ unit test có sẵn.</p></div>
        <div class="code-count" aria-label="Tiến độ bài code"><strong>${passed}/${list.length}</strong><span>${selectedTrack ? tr('bài đã đạt trong {t}', { t: esc(selectedTrack) }) : tr('bài đã đạt')}</span></div>
      </section>
      <details class="code-help"><summary>Môi trường chạy unit test</summary>
        <p>${tr('<b>JavaScript</b> chạy trong sandbox Boa với bộ test theo cú pháp Jest; <b>Python</b> chạy qua <code>python3 -I</code>; <b>Go</b> chạy bằng <code>go run</code>; <b>Rust</b> chạy bằng <code>rustc</code>; <b>PHP</b> chạy bằng <code>php</code>. Mỗi bài có bộ test riêng hiển thị trong phần làm bài.')}</p>
      </details>
      <div class="code-filter"><label for="code-track">Lọc theo lộ trình</label>
        <select id="code-track"><option value="" ${tf ? '' : 'selected'}>Tất cả lộ trình</option>
          ${S.catalog.tracks.filter((t) => t.counts.code).map((t) => `<option value="${t.id}" ${tf === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
        </select>
      </div>
      <p class="code-list-summary">${selectedTrack ? tr('{n} bài code trong {t}', { n: list.length, t: esc(selectedTrack) }) : tr('{n} bài code trong toàn bộ kho', { n: list.length })}</p>
      <div class="code-list">${list.map((q, index) => {
        const c = Store.data.code[q.id];
        const t = S.tracks[q.track];
        const state = c && c.passed ? 'ok' : c && c.attempts ? 'partial' : '';
        const stateLabel = c && c.passed ? 'Đã đạt' : c && c.attempts ? tr('Đã thử, {p}%', { p: Math.round((c.best || 0) * 100) }) : 'Chưa làm';
        const preview = stripHtml(q.prompt_html).trim();
        return `<a class="code-row" href="#/practice?type=code${tf ? '&track=' + tf : ''}&start=${q.id}">
          <span class="code-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <span class="code-row-main"><strong>${esc(q.title)}</strong><small>${esc(t.title)}, ${esc(S.modules[q.module].title)}</small><span class="code-preview">${esc(preview.slice(0, 150))}${preview.length > 150 ? '…' : ''}</span></span>
          <span class="code-row-meta"><span class="code-state ${state}">${stateLabel}</span><span>${langOf(q).label}, ${testCount(q.tests)} test</span>${diffStars(q.difficulty)}</span>
        </a>`;
      }).join('') || '<div class="empty">Lộ trình này chưa có bài code.</div>'}</div>`;
    $('#code-track').onchange = (e) => { location.hash = e.target.value ? `#/code?track=${encodeURIComponent(e.target.value)}` : '#/code'; };
  }

  // ------------------------------------------------------------------ exam
  const EXAM_KEY = 'bovabon.exam.current';
  function pageExam(params) {
    setActive('exam'); crumbs([['Tổng quan', '#/'], ['Thi thử', '#/exam']]);
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(EXAM_KEY) || 'null'); } catch (e) {}
    const hist = Store.data.exams.slice().reverse();
    view().innerHTML = `
      <h1>Thi thử</h1><p class="muted">Đề ngẫu nhiên, tính giờ, chỉ chấm khi nộp bài, mô phỏng bài kiểm tra thật.</p>
      ${saved ? `<div class="feedback partial exam-resume"><div class="verdict">Bạn có một bài thi đang làm dở</div><div class="row"><button class="btn" id="resume">Tiếp tục làm</button><button class="btn ghost" id="discard">Huỷ bài đó</button></div></div>` : ''}
      <div class="grid cols-2">
        <form class="card stack" id="exam-form">
          <h3>Tạo đề thi</h3>
          <label class="stack" style="display:block"><span class="small muted">Lộ trình</span><br>
            <select name="track" style="width:100%"><option value="all">${S.active.size < areaTracks().length ? tr('Tất cả lộ trình {a} đang bật', { a: AREAS[S.area] }) : tr('Tất cả lộ trình {a}', { a: AREAS[S.area] })}</option>${trackGroups().map((g) => `<optgroup label="${esc(g.name)}">${g.tracks.map((t) => `<option value="${t.id}" ${params.track === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <div class="grid cols-2">
            <label><span class="small muted">Số câu</span><br><select name="count" style="width:100%">${[10, 20, 30, 40].map((n) => `<option ${n === 20 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label><span class="small muted">Thời gian (phút)</span><br><select name="minutes" style="width:100%">${[10, 15, 20, 30, 45, 60].map((n) => `<option ${n === 20 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>
          <div><span class="small muted">Dạng câu hỏi</span><div class="row exam-types">
            ${['single', 'multiple', 'fill', 'essay'].map((t) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="types" value="${t}" ${t !== 'essay' ? 'checked' : ''}> ${TYPE_LABEL[t]}</label>`).join('')}
          </div></div>
          <button class="btn" type="submit">Bắt đầu làm bài</button>
        </form>
        <div class="card"><h3>Lịch sử thi</h3>
          ${hist.length ? `<table><tr><th>Ngày</th><th>Lộ trình</th><th>Điểm</th><th>Thời gian</th></tr>${hist.slice(0, 10).map((x) => `<tr><td>${new Date(x.date).toLocaleString(LOCALE)}</td><td>${esc(x.track === 'all' ? 'Tất cả lộ trình' : x.track.split(',').map((id) => (S.tracks[id] || {}).title || id).join(', '))}</td><td><b>${x.score.toFixed(1)}</b>/10 <span class="muted small">(${x.correct}/${x.total})</span></td><td>${tr('{n} phút', { n: Math.round(x.seconds / 60) })}</td></tr>`).join('')}</table>` : '<p class="muted">Chưa có bài thi nào.</p>'}
        </div>
      </div>`;
    if (saved) {
      $('#resume').onclick = () => runExam(saved);
      $('#discard').onclick = () => { sessionStorage.removeItem(EXAM_KEY); pageExam(params); };
    }
    $('#exam-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const types = f.getAll('types');
      if (!types.length) { toast('Chọn ít nhất 1 dạng câu hỏi'); return; }
      const trackParam = f.get('track') === 'all' ? [...S.active].join(',') : f.get('track');
      const data = await api.get(`/api/exam?track=${encodeURIComponent(trackParam)}&count=${f.get('count')}&types=${types.join(',')}`);
      if (!data.questions.length) { toast('Không đủ câu hỏi'); return; }
      runExam({ track: trackParam, ids: data.questions.map((q) => q.id), answers: {}, started: Date.now(), limit: +f.get('minutes') * 60, idx: 0 });
    };
  }

  function runExam(ex) {
    const persist = () => { try { sessionStorage.setItem(EXAM_KEY, JSON.stringify(ex)); } catch (e) {} };
    persist();
    crumbs([['Tổng quan', '#/'], ['Thi thử', '#/exam'], ['Đang làm bài', '#/exam']]);
    let timerI;
    const left = () => Math.max(0, ex.limit - Math.floor((Date.now() - ex.started) / 1000));
    const fmt = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    function answered(id) { const a = ex.answers[id]; return a != null && (Array.isArray(a) ? a.some((x) => x !== '' && x != null) : String(a).trim() !== ''); }
    function draw() {
      view().innerHTML = `<div class="qwrap"><div id="qhost"></div><aside><div class="card qnav">
        <div class="row"><b>Thời gian</b><span class="spacer"></span><span class="timer" id="timer">${fmt(left())}</span></div>
        <div class="qnav-grid">${ex.ids.map((id, i) => `<button data-i="${i}" class="${answered(id) ? 'answered' : ''} ${i === ex.idx ? 'cur' : ''}">${i + 1}</button>`).join('')}</div>
        <p class="small muted exam-progress-note">${tr('{a}/{n} câu đã trả lời', { a: ex.ids.filter(answered).length, n: ex.ids.length })}</p>
        <button class="btn" style="width:100%" id="submit">Nộp bài</button></div></aside></div>`;
      $$('.qnav-grid button').forEach((b) => (b.onclick = () => { ex.idx = +b.dataset.i; persist(); draw(); }));
      $('#submit').onclick = async () => { const un = ex.ids.length - ex.ids.filter(answered).length; if (un && !await confirmDialog(tr('Còn {n} câu chưa trả lời.', { n: un }), { title: 'Nộp bài thi?', confirmLabel: 'Nộp bài' })) return; submit(); };
      const q = S.qcache[ex.ids[ex.idx]];
      mountQuestion($('#qhost'), q, {
        exam: true, index: ex.idx, total: ex.ids.length, initial: ex.answers[q.id],
        onChange(a) { ex.answers[q.id] = Array.isArray(a) ? a.slice() : a; persist(); $$('.qnav-grid button')[ex.idx].classList.toggle('answered', answered(q.id)); },
        onPrev: ex.idx > 0 ? () => { ex.idx--; persist(); draw(); } : null,
        onNext: ex.idx < ex.ids.length - 1 ? () => { ex.idx++; persist(); draw(); } : null,
      });
    }
    function tick() {
      const t = $('#timer'); const l = left();
      if (t) { t.textContent = fmt(l); t.classList.toggle('low', l < 60); }
      if (l <= 0) { toast('Hết giờ! Tự động nộp bài'); submit(); }
    }
    async function submit() {
      clearInterval(timerI); window.removeEventListener('hashchange', stop);
      view().innerHTML = '<div class="loading">Đang chấm bài…</div>';
      const results = await Promise.all(ex.ids.map((id) => api.post(`/api/questions/${id}/check`, { answer: ex.answers[id] == null ? (S.qmeta[id].type === 'essay' ? '' : []) : ex.answers[id] }).catch(() => ({ correct: false, score: 0 }))));
      let total = 0, correct = 0;
      results.forEach((r, i) => { total += r.score; if (r.correct) correct++; if (answered(ex.ids[i])) Store.recordAnswer(ex.ids[i], r, ex.answers[ex.ids[i]]); });
      const score = (total / ex.ids.length) * 10;
      const seconds = Math.min(ex.limit, Math.floor((Date.now() - ex.started) / 1000));
      Store.data.exams.push({ date: Date.now(), track: ex.track, total: ex.ids.length, correct, score, seconds });
      Store.save();
      sessionStorage.removeItem(EXAM_KEY);
      showExamResult(ex, results, score, correct, seconds);
    }
    const stop = () => clearInterval(timerI);
    window.addEventListener('hashchange', stop, { once: true });
    timerI = setInterval(tick, 1000);
    draw();
  }

  function showExamResult(ex, results, score, correct, seconds) {
    crumbs([['Tổng quan', '#/'], ['Thi thử', '#/exam'], ['Kết quả', '#/exam']]);
    const p = Math.round(score * 10);
    view().innerHTML = `<div class="card"><div class="row exam-result-row">
        <div class="score-ring" style="--p:${p};--ring:${p >= 70 ? 'var(--ok)' : p >= 40 ? 'var(--warn)' : 'var(--bad)'}"><div><div><b>${score.toFixed(1)}</b><span class="muted small">/ 10 điểm</span></div></div></div>
        <div style="flex:1;min-width:220px"><h1>${p >= 80 ? 'Kết quả xuất sắc' : p >= 50 ? 'Kết quả khá tốt' : 'Cần ôn thêm'}</h1>
          <p class="muted">${tr('{c}/{n} câu đúng hoàn toàn, làm trong {m} phút {s} giây', { c: correct, n: ex.ids.length, m: Math.floor(seconds / 60), s: seconds % 60 })}</p>
          <div class="row"><a class="btn" href="#/exam">Thi đề mới</a>${results.some((r) => !r.correct) ? `<a class="btn secondary" href="#/practice?ids=${ex.ids.filter((_, i) => !results[i].correct).join(',')}">Ôn lại câu sai</a>` : ''}</div></div>
      </div></div>
      <div class="section-title"><h2>Xem lại bài làm</h2></div>
      <div class="stack" id="exam-review"></div>`;
    const host = $('#exam-review');
    ex.ids.forEach((id, i) => {
      const d = document.createElement('div'); host.appendChild(d);
      const q = S.qcache[id];
      if (q.type === 'code') return;
      mountQuestion(d, q, { exam: true, review: results[i], initial: ex.answers[id], index: i, total: ex.ids.length });
    });
    bindKeys(null);
  }

  // ------------------------------------------------------------------ review / bank / progress
  function pageReview() {
    setActive('review'); crumbs([['Tổng quan', '#/'], ['Ôn câu sai', '#/review']]);
    const wrong = activeIds().filter((id) => ['bad', 'partial'].includes(Store.status(id)));
    const bms = Store.data.bookmarks.filter((id) => S.qmeta[id] && S.active.has(S.qmeta[id].track));
    view().innerHTML = `<h1>Ôn tập</h1><p class="muted">Học lại những câu chưa đúng và câu bạn đã đánh dấu.</p>
      <div class="section-title"><h2>Câu làm sai / chưa trọn vẹn</h2><span class="chip bad">${wrong.length}</span><span class="spacer"></span>${wrong.length ? `<a class="btn sm" href="#/practice?ids=${wrong.join(',')}">Ôn tất cả</a>` : ''}</div>
      ${wrong.length ? questionList(wrong, (id) => `#/practice?ids=${wrong.join(',')}&start=${id}`) : '<div class="card empty">Không có câu sai nào.</div>'}
      <div class="section-title"><h2>Đã đánh dấu</h2><span class="chip warn">${bms.length}</span><span class="spacer"></span>${bms.length ? `<a class="btn sm" href="#/practice?ids=${bms.join(',')}">Ôn tất cả</a>` : ''}</div>
      ${bms.length ? questionList(bms, (id) => `#/practice?ids=${bms.join(',')}&start=${id}`) : '<div class="card empty">Dùng nút Đánh dấu trên câu hỏi để lưu mục ôn tập.</div>'}`;
  }

  function pageBank(params) {
    setActive('bank'); crumbs([['Tổng quan', '#/'], ['Kho câu hỏi', '#/bank']]);
    view().innerHTML = `<h1>Kho câu hỏi</h1>
      <p class="muted">${tr('{n} câu hỏi', { n: activeIds().length })}${S.active.size < areaTracks().length ? tr(' (đang bật {a}/{b} lộ trình, <a href="#/settings">cài đặt</a>)', { a: S.active.size, b: areaTracks().length }) : ''}${tr('; các bài code có bộ unit test để chấm tự động.')}</p>
      <div class="filters">
        <input type="search" id="f-q" aria-label="Tìm trong kho câu hỏi" placeholder="Tìm theo nội dung, tag…" style="flex:1;min-width:200px" value="${esc(params.q || '')}">
        <select id="f-track" aria-label="Lọc theo lộ trình"><option value="">Mọi lộ trình</option>${S.catalog.tracks.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
        <select id="f-type" aria-label="Lọc theo dạng câu hỏi"><option value="">Mọi dạng</option>${Object.keys(TYPE_LABEL).map((t) => `<option value="${t}">${TYPE_LABEL[t]}</option>`).join('')}</select>
        <select id="f-diff" aria-label="Lọc theo độ khó"><option value="">Mọi độ khó</option><option value="1">Dễ</option><option value="2">Trung bình</option><option value="3">Khó</option></select>
        <select id="f-status" aria-label="Lọc theo trạng thái"><option value="">Mọi trạng thái</option><option value="new">Chưa làm</option><option value="ok">Đã đúng</option><option value="wrong">Sai / một phần</option></select>
      </div>
      <div class="row review-summary"><span class="muted small" id="f-count"></span><span class="spacer"></span><a class="btn sm secondary" id="f-practice">Luyện các câu đang lọc</a></div>
      <div id="f-list"></div>`;
    const apply = () => {
      const qv = $('#f-q').value.trim().toLowerCase(), trk = $('#f-track').value, ty = $('#f-type').value, df = $('#f-diff').value, stt = $('#f-status').value;
      const ids = activeQs().filter((q) => (!trk || q.track === trk) && (!ty || q.type === ty) && (!df || String(q.difficulty) === df)
        && (!stt || (stt === 'new' ? !Store.status(q.id) : stt === 'ok' ? Store.status(q.id) === 'ok' : ['bad', 'partial'].includes(Store.status(q.id))))
        && (!qv || (q.title + ' ' + stripHtml(q.prompt_html) + ' ' + q.tags.join(' ') + ' ' + q.id).toLowerCase().includes(qv))).map((q) => q.id);
      $('#f-count').textContent = tr('{n} câu hỏi', { n: ids.length });
      $('#f-list').innerHTML = questionList(ids, (id) => `#/practice?ids=${id}`);
      $('#f-practice').href = ids.length ? `#/practice?ids=${ids.join(',')}` : '#/bank';
    };
    ['#f-q', '#f-track', '#f-type', '#f-diff', '#f-status'].forEach((s) => $(s).addEventListener('input', apply));
    apply();
  }

  function pageProgress() {
    setActive('progress'); crumbs([['Tổng quan', '#/'], ['Tiến độ', '#/progress']]);
    const days = [];
    for (let i = 89; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); const n = Store.data.activity[k] || 0; days.push(`<span title="${tr('{d}: {n} lượt', { d: k, n })}" data-l="${n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3}"></span>`); }
    const types = Object.keys(TYPE_LABEL).map((ty) => {
      const ids = activeQs().filter((q) => q.type === ty).map((q) => q.id);
      const p = progressOf(ids);
      return `<div><div class="row small"><span>${TYPE_LABEL[ty]}</span><span class="spacer"></span><span class="muted">${p.done}/${p.total}</span></div><div class="progress"><span style="width:${p.p}%"></span></div></div>`;
    }).join('');
    view().innerHTML = `<h1>Tiến độ học tập</h1>
      <p class="muted">Bovabon Edu không cần đăng nhập: tiến độ được lưu trên trình duyệt này. Hãy xuất file để sao lưu hoặc chuyển sang máy khác.</p>
      <div class="grid cols-2">
        <div class="card"><h3>Hoạt động 90 ngày</h3><div class="heat">${days.join('')}</div><p class="small muted streak-note">${tr('Chuỗi hiện tại: {n} ngày', { n: Store.streak() })}</p></div>
        <div class="card stack"><h3>Theo dạng bài</h3>${types}</div>
      </div>
      ${trackGroups().map((g) => `<div class="section-title"><h2>${esc(g.name)}</h2></div><div class="grid cols-3">${g.tracks.map((t) => {
        return `<div class="card"><h3>${esc(t.title)}</h3><div class="stack">${t.modules.map((m) => { const p = progressOf(m.question_ids); return `<div><div class="row small"><a href="#/module/${m.id}">${esc(m.title)}</a><span class="spacer"></span><span class="muted">${p.p}%</span></div><div class="progress ${p.p === 100 ? 'ok' : ''}"><span style="width:${p.p}%"></span></div></div>`; }).join('')}</div></div>`;
      }).join('')}</div>`).join('')}
      <div class="card backup-card"><h3>Sao lưu dữ liệu</h3><div class="row">
        <button class="btn secondary" id="exp">Xuất tiến độ (.json)</button>
        <label class="btn secondary" style="cursor:pointer">Nhập tiến độ<input type="file" id="imp" accept="application/json" hidden></label>
        <span class="spacer"></span><button class="btn ghost" id="rst" style="color:var(--bad)">Xoá toàn bộ tiến độ</button></div></div>`;
    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bovabon-edu-progress-${today()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#imp').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const d = Store.normalize(JSON.parse(await f.text()), true); if (!d) throw new Error(tr('File không hợp lệ')); Store.data = d; Store.save(); toast('Đã nhập tiến độ'); renderTopStats(); pageProgress(); }
      catch (err) { toast(tr('Lỗi: {e}', { e: err.message })); }
    };
    $('#rst').onclick = async () => { if (await confirmDialog('Toàn bộ tiến độ lưu trên trình duyệt này sẽ bị xoá và không thể khôi phục.', { title: 'Xoá toàn bộ tiến độ?', confirmLabel: 'Xoá tiến độ', destructive: true })) { Store.data = Store.empty(); Store.save(); renderTopStats(); pageProgress(); toast('Đã xoá tiến độ'); } };
  }

  // ------------------------------------------------------------------ settings
  const GROUP_MARKS = { Frontend: 'browser', Backend: 'server', 'Ngoại ngữ': 'language' };
  function pageSettings() {
    setActive('settings'); crumbs([['Tổng quan', '#/'], ['Cài đặt', '#/settings']]);
    const off = Prefs.disabled();
    const groups = [];
    for (const t of S.allTracks) {
      const g = t.group || tr('Khác');
      let e = groups.find((x) => x.name === g);
      if (!e) groups.push((e = { name: g, tracks: [] }));
      e.tracks.push(t);
    }
    view().innerHTML = `<h1>Cài đặt</h1>
      <section class="card sync-card" id="sync-card" aria-labelledby="sync-title"></section>
      <h2 class="settings-heading">Nội dung học</h2>
      <p class="muted">Chọn nội dung bạn muốn học. Lộ trình bị tắt sẽ ẩn khỏi menu, trang chủ, Code Lab, kho câu hỏi, thi thử, ôn tập và thống kê; tiến độ cũ vẫn được giữ. Cài đặt lưu trên trình duyệt này.</p>
      <div class="row settings-bar"><span class="muted small" id="set-summary"></span><span class="spacer"></span>
        <button class="btn sm ghost" id="set-all" type="button">Chọn tất cả</button></div>
      <div class="stack">${groups.map((g) => `
        <fieldset class="card settings-group">
          <legend class="settings-legend">${GROUP_MARKS[g.name] ? iconSvg(GROUP_MARKS[g.name], 'ic group-icon') : ''}${esc(g.name)}</legend>
          <label class="settings-toggle-all small"><input type="checkbox" data-group="${esc(g.name)}"> Bật cả nhóm</label>
          <div class="settings-list">${g.tracks.map((t) => `
            <label class="settings-item">
              <input type="checkbox" data-track="${t.id}" ${off.has(t.id) ? '' : 'checked'}>
              <span class="settings-item-main"><strong>${esc(t.title)}</strong><small class="muted">${tr('{q} câu, {c} bài code, {m} module', { q: t.total, c: t.counts.code || 0, m: t.modules.length })}</small></span>
            </label>`).join('')}</div>
        </fieldset>`).join('')}</div>
      <div class="settings-actions" role="region" aria-label="Lưu cài đặt">
        <span class="small" id="set-dirty" aria-live="polite"></span><span class="spacer"></span>
        <button class="btn secondary" id="set-reset" type="button">Huỷ thay đổi</button>
        <button class="btn" id="set-save" type="button">Lưu cài đặt</button>
      </div>`;
    const boxes = $$('input[data-track]');
    const groupBoxes = $$('input[data-group]');
    const membersOf = (g) => boxes.filter((b) => b.closest('fieldset') === g.closest('fieldset'));
    function sync() {
      groupBoxes.forEach((g) => {
        const mine = membersOf(g);
        const n = mine.filter((b) => b.checked).length;
        g.checked = n === mine.length; g.indeterminate = n > 0 && n < mine.length;
      });
      const on = boxes.filter((b) => b.checked);
      const qn = on.reduce((sum, b) => sum + S.tracks[b.dataset.track].total, 0);
      $('#set-summary').textContent = tr('Chọn {a}/{b} lộ trình, {q} câu hỏi', { a: on.length, b: boxes.length, q: qn });
      // Thay đổi chỉ áp dụng khi bấm "Lưu cài đặt" (tránh bấm nhầm)
      const saved = Prefs.disabled();
      const n = boxes.filter((b) => b.checked === saved.has(b.dataset.track)).length;
      settingsDirty = n > 0;
      $('#set-dirty').innerHTML = settingsDirty ? `${iconSvg('alert-circle', 'status-icon')} ${tr('{n} thay đổi chưa lưu', { n })}` : tr('Đã lưu');
      $('#set-dirty').classList.toggle('unsaved', settingsDirty);
      $('#set-save').disabled = !settingsDirty;
      $('#set-reset').disabled = !settingsDirty;
    }
    function reset() { const saved = Prefs.disabled(); boxes.forEach((b) => (b.checked = !saved.has(b.dataset.track))); sync(); }
    function guard(revert) {
      if (boxes.some((b) => b.checked)) return true;
      revert(); toast('Cần bật ít nhất 1 lộ trình'); sync(); return false;
    }
    boxes.forEach((b) => (b.onchange = () => { guard(() => (b.checked = true)); sync(); }));
    groupBoxes.forEach((g) => (g.onchange = () => {
      const mine = membersOf(g);
      const prev = mine.map((b) => b.checked);
      mine.forEach((b) => (b.checked = g.checked));
      guard(() => mine.forEach((b, i) => (b.checked = prev[i])));
      sync();
    }));
    $('#set-all').onclick = () => { boxes.forEach((b) => (b.checked = true)); sync(); };
    $('#set-reset').onclick = reset;
    renderSyncCard($('#sync-card'));
    $('#set-save').onclick = () => {
      Prefs.setDisabled(new Set(boxes.filter((b) => !b.checked).map((b) => b.dataset.track)));
      applyPrefs(); renderNav(); renderTopStats(); setActive('settings'); sync();
      toast(tr('Đã lưu: bật {a}/{b} lộ trình', { a: S.active.size, b: S.allTracks.length }));
    };
    sync();
  }
  // ------------------------------------------------------------------ settings: thẻ đồng bộ
  function timeAgo(ts) {
    if (!ts) return tr('chưa đồng bộ');
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return tr('vừa xong');
    if (s < 3600) return tr('{n} phút trước', { n: Math.round(s / 60) });
    if (s < 86400) return tr('{n} giờ trước', { n: Math.round(s / 3600) });
    return new Date(ts).toLocaleString(LOCALE);
  }
  function downloadText(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function renderSyncCard(host) {
    if (!host) return;
    let mode = 'intro'; // intro | login | register | qr | codes
    let pending = null; // {email, secret, qrSvg, otpauth} hoặc {email, backupCodes}
    let busy = false;
    let error = '';
    const otpInput = (id, label) => `<label class="sync-field"><span>${label}</span>
      <input id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="9" placeholder="123456" required></label>`;
    function draw() {
      if (!host.isConnected) return;
      const err = error ? `<p class="sync-error" role="alert">${esc(error)}</p>` : '';
      const head = `<div class="sync-head"><h2 id="sync-title">${iconSvg('cloud', 'ic sync-icon')}Đồng bộ <span class="chip">Tuỳ chọn</span></h2></div>`;
      if (Sync.on) {
        if (mode === 'codes') { showCodes(); return; }
        if (mode === 'verify-codes') {
          host.innerHTML = `${head}<p class="muted">Nhập mã OTP hiện tại để tạo bộ mã dự phòng mới. Bộ mã cũ sẽ hết hiệu lực.</p>
            <form id="sync-codes-form" class="sync-form">${otpInput('sync-code', 'Mã OTP hiện tại')}${err}
              <div class="row"><button class="btn sm" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Đang xác nhận…' : 'Tạo mã mới'}</button><button class="btn sm ghost" id="sync-codes-cancel" type="button">Huỷ</button></div>
            </form>`;
          $('#sync-codes-cancel', host).onclick = () => { mode = 'intro'; error = ''; draw(); };
          $('#sync-codes-form', host).onsubmit = async (e) => {
            e.preventDefault();
            const code = $('#sync-code', host).value.replace(/\s+/g, '');
            if (!/^\d{6}$/.test(code)) { error = 'Mã OTP cần có 6 chữ số.'; draw(); return; }
            busy = true; error = ''; draw();
            try { const r = await Sync.req('POST', '/me/backup-codes', { code }); pending = { email: Sync.conf.email, backupCodes: r.backupCodes }; mode = 'codes'; busy = false; showCodes(); }
            catch (e2) { busy = false; error = e2.message; draw(); }
          };
          $('#sync-code', host).focus();
          return;
        }
        host.innerHTML = `${head}
          <p>${tr('Đã đăng nhập <b>{email}</b>. Tiến độ học, câu đánh dấu, lịch sử thi và lựa chọn lộ trình được đồng bộ giữa các máy.', { email: esc(Sync.conf.email) })}</p>
          <p class="small ${Sync.conf.lastError ? 'sync-error' : 'muted'}" aria-live="polite">${Sync.busy ? 'Đang đồng bộ…' : Sync.conf.lastError ? `${iconSvg('alert-circle', 'ic sync-status-icon')}${esc(Sync.conf.lastError)}` : tr('Lần đồng bộ gần nhất: {t}', { t: timeAgo(Sync.conf.lastSync) })}</p>
          <div class="row"><button class="btn sm" id="sync-now" type="button" ${Sync.busy ? 'disabled' : ''}>Đồng bộ ngay</button>
            <button class="btn sm secondary" id="sync-codes" type="button">Tạo lại mã dự phòng</button>
            <span class="spacer"></span><button class="btn sm ghost" id="sync-logout" type="button">Đăng xuất</button></div>`;
        $('#sync-now', host).onclick = () => Sync.syncNow();
        $('#sync-logout', host).onclick = async () => {
          if (await confirmDialog('Dữ liệu vẫn giữ trên máy này và trên đám mây; máy này sẽ ngừng đồng bộ.', { title: 'Đăng xuất đồng bộ?', confirmLabel: 'Đăng xuất' })) { await Sync.logout(); mode = 'intro'; draw(); toast('Đã đăng xuất đồng bộ'); }
        };
        $('#sync-codes', host).onclick = () => { mode = 'verify-codes'; error = ''; draw(); };
        return;
      }
      if (mode === 'intro') {
        host.innerHTML = `${head}
          <p class="muted">${tr('Bạn có thể học mà không cần tài khoản. Mọi thứ lưu trên máy này. Muốn tiếp tục trên máy khác hoặc giữ an toàn tiến độ, hãy bật đồng bộ bằng <b>email và mã OTP</b> từ ứng dụng xác thực (Google Authenticator, 1Password, Authy). Không cần mật khẩu.')}</p>
          <div class="row"><button class="btn sm" id="sync-to-register" type="button">Tạo tài khoản đồng bộ</button><button class="btn sm secondary" id="sync-to-login" type="button">Đăng nhập</button></div>`;
        $('#sync-to-register', host).onclick = () => { mode = 'register'; error = ''; draw(); };
        $('#sync-to-login', host).onclick = () => { mode = 'login'; error = ''; draw(); };
        return;
      }
      if (mode === 'login') {
        host.innerHTML = `${head}
          <form class="sync-form" id="sync-form">
            <label class="sync-field"><span>Email</span><input id="sync-email" type="email" autocomplete="email" required value="${esc((pending && pending.email) || '')}"></label>
            ${otpInput('sync-code', 'Mã OTP 6 số (hoặc mã dự phòng)').replace('inputmode="numeric" ', '').replace('maxlength="9"', 'maxlength="19"')}
            ${err}
            <div class="row"><button class="btn sm" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Đang đăng nhập…' : 'Đăng nhập & đồng bộ'}</button><button class="btn sm ghost" type="button" id="sync-back">Huỷ</button></div>
            <p class="small muted">${tr('Dữ liệu trên máy này sẽ được <b>gộp</b> với dữ liệu đã lưu trên đám mây (không mất tiến độ ở bên nào).')}</p>
          </form>`;
        $('#sync-back', host).onclick = () => { mode = 'intro'; error = ''; draw(); };
        $('#sync-form', host).onsubmit = async (e) => {
          e.preventDefault();
          const email = $('#sync-email', host).value;
          const code = $('#sync-code', host).value;
          busy = true; error = ''; pending = { email }; draw();
          try {
            const r = await Sync.req('POST', '/auth/login', { email, code, device: Sync.device() });
            busy = false; pending = null; mode = 'intro';
            await Sync.signedIn(r); toast('Đã bật đồng bộ');
          } catch (err2) { busy = false; error = err2.message; }
          draw();
        };
        $('#sync-email', host).focus();
        return;
      }
      if (mode === 'register') {
        host.innerHTML = `${head}
          <form class="sync-form" id="sync-form">
            <p class="small muted">Bước 1/3: Email chỉ dùng làm tên tài khoản, không gửi thư. Hãy dùng email của bạn để dễ nhớ.</p>
            <label class="sync-field"><span>Email</span><input id="sync-email" type="email" autocomplete="email" required value="${esc((pending && pending.email) || '')}"></label>
            ${err}
            <div class="row"><button class="btn sm" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Đang tạo…' : 'Tiếp tục'}</button><button class="btn sm ghost" type="button" id="sync-back">Huỷ</button></div>
          </form>`;
        $('#sync-back', host).onclick = () => { mode = 'intro'; error = ''; draw(); };
        $('#sync-form', host).onsubmit = async (e) => {
          e.preventDefault();
          const email = $('#sync-email', host).value;
          busy = true; error = ''; draw();
          try { pending = await Sync.req('POST', '/auth/register', { email }); mode = 'qr'; }
          catch (err2) { error = err2.message; pending = { email }; }
          busy = false; draw();
        };
        $('#sync-email', host).focus();
        return;
      }
      if (mode === 'qr') {
        const qrSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pending.qrSvg);
        host.innerHTML = `${head}
          <form class="sync-form" id="sync-form">
            <p class="small muted">${tr('Bước 2/3: Mở ứng dụng xác thực, chọn <b>thêm tài khoản rồi quét mã QR</b> (hoặc nhập khoá thủ công), sau đó nhập mã 6 số đang hiển thị.')}</p>
            <div class="sync-qr-row">
              <img class="sync-qr" src="${esc(qrSrc)}" alt="Mã QR để thêm tài khoản Bovabon Edu vào app authenticator" width="184" height="184">
              <div class="stack">
                <div><span class="small muted">Tài khoản</span><br><b>${esc(pending.email)}</b></div>
                <div><span class="small muted">Khoá nhập thủ công</span><br><code class="sync-secret">${esc(pending.secret)}</code></div>
                ${otpInput('sync-code', 'Mã 6 số')}
              </div>
            </div>
            ${err}
            <div class="row"><button class="btn sm" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Đang xác nhận…' : 'Xác nhận'}</button><button class="btn sm ghost" type="button" id="sync-back" ${busy ? 'disabled' : ''}>Huỷ</button></div>
          </form>`;
        $('#sync-back', host).onclick = () => { mode = 'intro'; error = ''; pending = null; draw(); };
        $('#sync-form', host).onsubmit = async (e) => {
          e.preventDefault();
          const code = $('#sync-code', host).value;
          busy = true; error = ''; draw();
          try {
            const r = await Sync.req('POST', '/auth/register/verify', { email: pending.email, code, device: Sync.device() });
            pending = { email: r.email, backupCodes: r.backupCodes }; mode = 'codes'; busy = false;
            showCodes();
            await Sync.signedIn(r);
          } catch (err2) { busy = false; error = err2.message; draw(); }
        };
        $('#sync-code', host).focus();
      }
    }
    function showCodes() {
      const codes = pending.backupCodes;
      host.innerHTML = `<div class="sync-head"><h2 id="sync-title">${iconSvg('cloud', 'ic sync-icon')}Đồng bộ đã bật</h2></div>
        <p class="small muted">${tr('Bước 3/3: Lưu <b>mã dự phòng</b> ở nơi an toàn, chẳng hạn trong trình quản lý mật khẩu. Mỗi mã dùng một lần khi bạn mất điện thoại. Mã chỉ hiển thị lần này.')}</p>
        <ol class="sync-codes">${codes.map((c) => `<li><code>${esc(c)}</code></li>`).join('')}</ol>
        <div class="row"><button class="btn sm secondary" id="codes-copy" type="button">Sao chép</button><button class="btn sm secondary" id="codes-dl" type="button">Tải file .txt</button><span class="spacer"></span><button class="btn sm" id="codes-done" type="button">Tôi đã lưu</button></div>`;
      const text = `${tr('Bovabon Edu: mã dự phòng cho {email} (mỗi mã dùng 1 lần)', { email: pending.email })}\n\n${codes.join('\n')}\n`;
      $('#codes-copy', host).onclick = () => navigator.clipboard.writeText(text).then(() => toast('Đã sao chép'), () => toast('Không sao chép được, hãy chọn và sao chép thủ công'));
      $('#codes-dl', host).onclick = () => downloadText('bovabon-edu-ma-du-phong.txt', text);
      $('#codes-done', host).onclick = () => { mode = 'intro'; pending = null; draw(); };
    }
    const onChange = () => { if (mode !== 'codes') draw(); };
    Sync.listeners.add(onChange);
    const stop = () => { if (!host.isConnected) { Sync.listeners.delete(onChange); window.removeEventListener('hashchange', stop); } };
    window.addEventListener('hashchange', stop);
    draw();
  }

  // Rời trang Cài đặt khi còn thay đổi chưa lưu → hỏi lại
  let settingsDirty = false;
  function leaveSettingsGuard() {
    if (!settingsDirty || location.hash.startsWith('#/settings')) return false;
    const target = location.hash;
    history.replaceState(null, '', '#/settings'); // giữ nguyên trang, không kích hoạt hashchange
    setActive('settings');
    confirmDialog('Các thay đổi bật/tắt lộ trình chưa được lưu sẽ bị bỏ.', { title: 'Rời trang mà không lưu?', confirmLabel: 'Bỏ thay đổi', destructive: true })
      .then((ok) => { if (ok) { settingsDirty = false; location.hash = target; } });
    return true;
  }
  window.addEventListener('beforeunload', (e) => { if (settingsDirty && location.hash.startsWith('#/settings')) { e.preventDefault(); e.returnValue = ''; } });

  function notFound() { crumbs([['Không tìm thấy', '#/']]); view().innerHTML = '<div class="empty"><div class="big">404</div>Không tìm thấy trang. <a href="#/">Về trang chủ</a></div>'; }

  // ------------------------------------------------------------------ router
  function route() {
    if (leaveSettingsGuard()) return;
    bindKeys(null);
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const seg = path.split('/').filter(Boolean);
    try {
      if (!seg.length) return pageHome();
      const target = seg[0] === 'track' ? S.tracks[seg[1]] : seg[0] === 'module' ? S.tracks[(S.modules[seg[1]] || {}).track] : null;
      if (target) setArea(areaOf(target));
      else if (seg[0] === 'code') setArea('dev');
      switch (seg[0]) {
        case 'track': return pageTrack(seg[1]);
        case 'module': return pageModule(seg[1], params.tab);
        case 'practice': return pagePractice(params);
        case 'code': return pageCode(params);
        case 'exam': return pageExam(params);
        case 'review': return pageReview();
        case 'bank': return pageBank(params);
        case 'progress': return pageProgress();
        case 'settings': return pageSettings();
        default: return notFound();
      }
    } catch (e) { console.error(e); view().innerHTML = `<div class="feedback bad">${tr('Lỗi hiển thị: {e}', { e: esc(e.message) })}</div>`; }
  }

  // ------------------------------------------------------------------ boot
  const themeToggle = $('#theme-toggle');
  function syncThemeToggle() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.querySelector('span').textContent = dark ? 'Chuyển sang giấy sáng' : 'Chuyển sang giấy tối';
  }
  syncThemeToggle();
  themeToggle.onclick = () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('bovabon.theme', next); } catch (e) {}
    syncThemeToggle();
  };
  syncMobileDrawer();
  mobileDrawerQuery.addEventListener('change', () => {
    if (!mobileDrawerQuery.matches) sidebar.classList.remove('open');
    syncMobileDrawer();
  });
  menuButton.onclick = () => {
    if (sidebar.classList.contains('open')) closeDrawer(true);
    else if (mobileDrawerQuery.matches) {
      sidebar.classList.add('open');
      syncMobileDrawer();
      drawerCloseButton.focus();
    }
  };
  drawerCloseButton.onclick = () => closeDrawer(true);
  sidebar.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#/"]');
    if (!link || !mobileDrawerQuery.matches || !sidebar.classList.contains('open')) return;
    e.preventDefault();
    const nextHash = link.hash;
    closeDrawer(false);
    if (nextHash === location.hash) {
      focusViewStart();
      return;
    }
    location.hash = nextHash;
    setTimeout(focusViewStart, 50);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileDrawerQuery.matches && sidebar.classList.contains('open')) {
      e.preventDefault();
      closeDrawer(true);
    }
  });
  document.addEventListener('click', (e) => {
    if (mobileDrawerQuery.matches && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuButton.contains(e.target)) closeDrawer(false);
  });
  Store.load();
  $$('#area-switch button').forEach((b) => {
    b.onclick = () => { if (!setArea(b.dataset.area)) return; if (location.hash.length > 2) location.hash = '#/'; else route(); };
  });
  syncAreaUI();
  const langToggle = $('#lang-toggle');
  if (langToggle && window.I18N) {
    $('#lang-label').textContent = UI_LANG === 'en' ? 'Tiếng Việt' : 'English';
    langToggle.onclick = () => window.I18N.set(UI_LANG === 'en' ? 'vi' : 'en');
  }
  loadCatalog().then(() => { renderNav(); renderTopStats(); route(); window.addEventListener('hashchange', route); if (Sync.on) Sync.syncNow(); })
    .catch((e) => { view().innerHTML = `<div class="feedback bad">${tr('Không tải được dữ liệu: {e}', { e: esc(e.message) })}</div>`; });
})();
