/* Bovabon Edu — SPA (vanilla JS, không cần build). Tiến độ lưu localStorage, không cần đăng nhập. */
(function () {
  'use strict';

  // ------------------------------------------------------------------ helpers
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = () => $('#view');
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
      const g = t.group || 'Khác';
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
    return slug.split('~')[0] + ' › ' + (segs.length ? segs.slice(-2).join('/') : 'tổng quan') + (anchor ? ' #' + anchor : '');
  }
  function refLinks(paths, label) {
    if (!paths || !paths.length) return '';
    return `<div class="refs"><span class="refs-label">${label || 'Tài liệu tham khảo DevDocs'}</span>${paths.map((p) =>
      `<a href="https://devdocs.io/${encodeURI(p)}" target="_blank" rel="noopener noreferrer">${esc(docTitle(p))} ↗</a>`).join('')}</div>`;
  }
  const today = () => new Date().toISOString().slice(0, 10);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const stripHtml = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent || ''; };
  const diffStars = (d) => '<span class="diff" title="Độ khó ' + d + '/3">' + '★'.repeat(d) + '<span class="muted">' + '★'.repeat(Math.max(0, 3 - d)) + '</span></span>';

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
        <h2 id="confirm-title">${esc(config.title)}</h2>
        <p id="confirm-message">${esc(message)}</p>
        <div class="confirm-actions"><button class="btn secondary" value="cancel">Huỷ</button><button class="btn ${config.destructive ? 'danger' : ''}" value="confirm">${esc(config.confirmLabel)}</button></div>
      </form>`;
      dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'confirm'); dialog.remove(); }, { once: true });
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close('cancel'); });
      document.body.append(dialog);
      dialog.showModal();
      dialog.querySelector('[value="cancel"]').focus();
    });
  }

  const api = {
    async get(p) { const r = await fetch(p); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r.json(); },
    async post(p, body) {
      const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
      return r.json();
    },
  };

  // ------------------------------------------------------------------ progress store (localStorage)
  const KEY = 'bovabon.progress.v1';
  const Store = {
    data: null,
    empty() { return { answers: {}, code: {}, bookmarks: [], exams: [], activity: {}, created: Date.now() }; },
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
      return data;
    },
    load() {
      try { this.data = this.normalize(JSON.parse(localStorage.getItem(KEY) || '{}'), false) || this.empty(); }
      catch (e) { this.data = this.empty(); }
      return this.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
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
  const S = { catalog: null, tracks: {}, modules: {}, qmeta: {}, qcache: {} };
  async function loadCatalog() {
    S.catalog = await api.get('/api/catalog');
    for (const t of S.catalog.tracks) {
      S.tracks[t.id] = t;
      for (const m of t.modules) { S.modules[m.id] = Object.assign({ track: t.id }, m); }
    }
    const all = await api.get('/api/questions');
    for (const q of all) { S.qmeta[q.id] = q; S.qcache[q.id] = q; }
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
      return `<a href="#/track/${t.id}" data-route="track-${t.id}"><span class="nav-index" aria-hidden="true">${String(index).padStart(2, '0')}</span>${esc(t.title)}</a>`;
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
    const drawerWasOpen = mobileDrawerQuery.matches && sidebar.classList.contains('open');
    closeDrawer(false);
    if (drawerWasOpen) setTimeout(focusViewStart, 50);
  }
  function crumbs(parts) {
    $('#crumbs').innerHTML = parts.map((p, i) => (i === parts.length - 1 ? `<b>${esc(p[0])}</b>` : `<a href="${p[1]}">${esc(p[0])}</a>`)).join(' / ');
    document.title = (parts.length ? parts[parts.length - 1][0] + ' · ' : '') + 'Bovabon Edu';
  }
  function renderTopStats() {
    if (!S.catalog) return;
    const ids = Object.keys(S.qmeta);
    const done = ids.filter((id) => Store.done(id)).length;
    $('#top-stats').innerHTML = `<span class="top-stat"><b>${done}</b> / ${ids.length} câu hoàn thành</span><span class="top-separator" aria-hidden="true">·</span><span class="top-stat">${Store.streak()} ngày học liên tiếp</span>`;
  }

  // ------------------------------------------------------------------ pages
  function pageHome() {
    setActive('home'); crumbs([['Lộ trình học', '#/']]);
    const ids = Object.keys(S.qmeta);
    const codeIds = ids.filter((id) => S.qmeta[id].type === 'code');
    const codePassed = codeIds.filter((id) => Store.data.code[id] && Store.data.code[id].passed).length;
    const wrong = ids.filter((id) => ['bad', 'partial'].includes(Store.status(id))).length;
    const done = ids.filter((id) => Store.done(id)).length;
    const attempted = new Set(Object.keys(Store.data.answers).concat(Object.keys(Store.data.code)).filter((id) => S.qmeta[id]));
    const startedTracks = S.catalog.tracks.filter((t) => trackQs(t.id).some((q) => attempted.has(q.id))).length;
    const last = Object.entries(Store.data.answers).concat(Object.entries(Store.data.code))
      .filter(([id, v]) => S.qmeta[id] && v.last).sort((a, b) => b[1].last - a[1].last)[0];
    const lastQ = last && S.qmeta[last[0]];
    const firstTrack = S.catalog.tracks[0];
    let trackIndex = 0;
    const groups = trackGroups().map((g) => {
      const rows = g.tracks.map((t) => {
        const number = String(++trackIndex).padStart(2, '0');
        const pr = progressOf(trackQs(t.id).map((q) => q.id));
        return `<a class="course-row" href="#/track/${t.id}">
          <span class="course-index" aria-hidden="true">${number}</span>
          <span class="course-detail"><strong>${esc(t.title)}</strong><small>${esc(t.description)}</small><span class="course-meta">${t.modules.length} module · ${t.total} câu · ${t.counts.code || 0} bài code</span></span>
          <span class="course-record"><span>${pr.done}/${pr.total}</span><span class="course-progress" aria-hidden="true"><span style="width:${pr.p}%"></span></span><span>${pr.p}% hoàn thành</span></span>
        </a>`;
      }).join('');
      return `<section class="catalog-group"><div class="catalog-heading"><h2>${esc(g.name)}</h2><span>${g.tracks.length} lộ trình</span></div><div class="course-list">${rows}</div></section>`;
    }).join('');
    const nextHref = lastQ ? `#/practice?ids=${lastQ.id}` : `#/track/${firstTrack.id}`;
    const nextLabel = lastQ ? `Tiếp tục: ${esc(qTitle(lastQ)).slice(0, 42)}…` : `Bắt đầu với ${esc(firstTrack.title)}`;

    view().innerHTML = `
      <section class="home-heading">
        <div><h1>Lộ trình học</h1><p>Chọn một dòng để xem bài học, câu hỏi và bài code theo chủ đề.</p></div>
        <div class="home-counts" aria-label="Quy mô kho học"><span><b>${S.catalog.tracks.length}</b> lộ trình</span><span class="count-rule" aria-hidden="true"></span><span><b>${ids.length}</b> câu hỏi</span></div>
      </section>
      <div class="home-columns">
        <div class="home-catalog">
          ${groups}
          <section class="quick-section"><div class="catalog-heading"><h2>Luyện tập nhanh</h2></div><div class="quick-links">
            <a href="#/practice?mode=random&count=10"><strong>10 câu ngẫu nhiên</strong><span>Trộn câu hỏi từ mọi lộ trình</span></a>
            <a href="#/code"><strong>Code Lab</strong><span>${codeIds.length} bài code có unit test</span></a>
            <a href="#/review"><strong>Ôn câu sai</strong><span>${wrong} câu cần xem lại</span></a>
            <a href="#/practice?type=essay"><strong>Tự luận</strong><span>Trả lời theo ý chính và đáp án mẫu</span></a>
          </div></section>
        </div>
        <aside class="study-note" aria-label="Ghi chú tiến độ">
          <h2>Ghi chú</h2>
          <p>Tiến độ học được lưu cục bộ trên trình duyệt này.</p>
          <dl class="study-facts">
            <div><dt>Lộ trình đã bắt đầu</dt><dd>${startedTracks} / ${S.catalog.tracks.length}</dd></div>
            <div><dt>Câu đã hoàn thành</dt><dd>${done} / ${ids.length}</dd></div>
            <div><dt>Bài code đã qua</dt><dd>${codePassed} / ${codeIds.length}</dd></div>
            <div><dt>Chuỗi ngày học</dt><dd>${Store.streak()} ngày</dd></div>
          </dl>
          <a class="continue-link" href="${nextHref}">${nextLabel}</a>
          <a class="note-link" href="#/exam">Mở bài thi thử</a>
        </aside>
      </div>`;
  }

  function pageTrack(tid) {
    const t = S.tracks[tid];
    if (!t) return notFound();
    setActive('track-' + tid); crumbs([['Tổng quan', '#/'], [t.title, '#/track/' + tid]]);
    const all = trackQs(tid).map((q) => q.id);
    const pr = progressOf(all);
    view().innerHTML = `
      <section class="track-heading">
        <div class="track-intro"><h1>${esc(t.title)}</h1><p class="muted">${esc(t.description)}</p></div>
          <a class="btn" href="#/practice?track=${tid}">Luyện toàn bộ (${t.total})</a>
          <a class="btn secondary" href="#/exam?track=${tid}">Thi thử</a>
        <div class="track-progress"><div class="progress"><span style="width:${pr.p}%"></span></div><p class="small muted">${pr.done}/${pr.total} câu hoàn thành · ${Object.entries(t.counts).map(([k, v]) => `${TYPE_LABEL[k]}: ${v}`).join(' · ')}</p></div>
        ${t.docs && t.docs.length ? refLinks(t.docs, 'Tài liệu gốc trên DevDocs') : ''}
      </section>
      <div class="section-title"><h2>Các module</h2></div>
      <div class="stack">
        ${t.modules.map((m, i) => {
          const p = progressOf(m.question_ids);
          return `<a class="module-row" href="#/module/${m.id}">
            <span class="module-num">${String(i + 1).padStart(2, '0')}</span>
            <span class="module-detail"><strong>${esc(m.title)}</strong><small>${esc(m.description)}</small><span class="module-types">${Object.entries(m.counts).map(([k, v]) => `${TYPE_LABEL[k]} · ${v}`).join(' / ')}</span></span>
            <span class="module-status">${p.done}/${p.total}<small>${p.p}% hoàn thành</small><span class="progress"><span style="width:${p.p}%"></span></span></span>
          </a>`;
        }).join('')}
      </div>`;
  }

  function questionList(ids, href) {
    if (!ids.length) return `<div class="empty">Không có câu hỏi nào.</div>`;
    return `<div class="card" style="padding:0"><div class="qlist">${ids.map((id, i) => {
      const q = S.qmeta[id];
      return `<a class="qitem" href="${href(id, i)}"><span class="dot ${Store.status(id)}"></span>
        <span class="chip">${TYPE_LABEL[q.type]}</span>
        <span class="qt">${esc(qTitle(q))}</span>${diffStars(q.difficulty)}
        ${Store.data.bookmarks.includes(id) ? '<span title="Đã đánh dấu">★</span>' : ''}</a>`;
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
        <a class="btn" href="#/practice?module=${mid}">Luyện tập module (${m.question_ids.length})</a></div>
      <p class="muted">${esc(m.description)} · ${p.done}/${p.total} hoàn thành</p>
      <div class="tabs" role="tablist">
        <button data-tab="lesson" class="${tab === 'lesson' ? 'active' : ''}">Bài học tóm tắt</button>
        <button data-tab="questions" class="${tab === 'questions' ? 'active' : ''}">Câu hỏi (${m.question_ids.length})</button>
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
        region.setAttribute('aria-label', `Bảng ${index + 1}: ${m.title}. Cuộn ngang để xem đủ cột.`);
        table.parentNode.insertBefore(region, table);
        region.appendChild(table);
        if (region.scrollWidth > region.clientWidth + 1) {
          const hint = document.createElement('p');
          hint.className = 'table-hint';
          hint.textContent = 'Cuộn ngang để xem đủ cột.';
          region.before(hint);
        }
      });
    } else {
      body.innerHTML = questionList(m.question_ids, (id) => `#/practice?module=${mid}&start=${id}`);
    }
    $$('.tabs button').forEach((b) => (b.onclick = () => { location.hash = `#/module/${mid}${b.dataset.tab === 'lesson' ? '' : '?tab=' + b.dataset.tab}`; }));
  }

  // ------------------------------------------------------------------ practice session
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function pagePractice(params) {
    let ids;
    let title = 'Luyện tập';
    const crumbsBase = [['Tổng quan', '#/']];
    if (params.ids) { ids = params.ids.split(',').filter((id) => S.qmeta[id]); title = ids.length === 1 ? qTitle(S.qmeta[ids[0]]) : 'Bộ câu hỏi tuỳ chọn'; }
    else {
      ids = Object.values(S.qmeta)
        .filter((q) => !params.track || q.track === params.track)
        .filter((q) => !params.module || q.module === params.module)
        .filter((q) => !params.type || params.type.split(',').includes(q.type))
        .map((q) => q.id);
      if (params.module) { const m = S.modules[params.module]; crumbsBase.push([S.tracks[m.track].title, '#/track/' + m.track], [m.title, '#/module/' + m.id]); title = 'Luyện tập'; }
      else if (params.track) { crumbsBase.push([S.tracks[params.track].title, '#/track/' + params.track]); }
      if (params.type) title = 'Luyện ' + params.type.split(',').map((t) => TYPE_LABEL[t]).join(', ');
      if (params.mode === 'random') { ids = shuffle(ids.filter((id) => S.qmeta[id].type !== 'code')).slice(0, +params.count || 10); title = 'Ngẫu nhiên ' + ids.length + ' câu'; }
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
        <p class="tiny muted" style="margin:12px 0 0">Phím tắt: <span class="kbd">1</span>–<span class="kbd">6</span> chọn, <span class="kbd">Enter</span> kiểm tra / câu tiếp, <span class="kbd">←</span><span class="kbd">→</span> chuyển câu.</p></div>`;
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
        <p class="muted">Bạn đã làm ${done.length}/${ids.length} câu trong phiên này.</p>
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
      ${opts.total ? `<span class="chip accent">Câu ${opts.index + 1}/${opts.total}</span>` : ''}
      <span class="chip">${TYPE_LABEL[q.type]}</span>
      <span class="chip">${esc(m.title)}</span>${diffStars(q.difficulty)}
      <span class="spacer"></span><span class="muted tiny">#${q.id}</span>
      ${opts.exam ? '' : `<button class="bookmark ${bm ? 'on' : ''}" data-bm title="Đánh dấu để ôn lại" aria-label="Đánh dấu">${bm ? '★' : '☆'}</button>`}
    </div>`;
  }
  function wireBookmark(host, q) {
    const b = $('[data-bm]', host);
    if (b) b.onclick = () => { const on = Store.toggleBookmark(q.id); b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; toast(on ? 'Đã đánh dấu câu hỏi' : 'Đã bỏ đánh dấu'); };
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
      inner = `<div class="options" role="${q.type === 'single' ? 'radiogroup' : 'group'}">${q.options_html.map((o, i) =>
        `<button type="button" class="opt ${q.type === 'multiple' ? 'multi' : ''}" data-i="${i}" role="${q.type === 'single' ? 'radio' : 'checkbox'}" aria-checked="false"><span class="key">${q.type === 'multiple' ? '' : String.fromCharCode(65 + i)}</span><span class="body">${o}</span></button>`).join('')}</div>
        ${q.type === 'multiple' ? '<p class="muted small" style="margin-top:10px">Chọn <b>tất cả</b> đáp án đúng.</p>' : ''}`;
    } else if (q.type === 'essay') {
      inner = `<textarea class="essay" placeholder="Viết câu trả lời của bạn… (chấm theo các ý chính)">${esc(answer)}</textarea>`;
    }
    host.innerHTML = `<div class="card">${qHeader(q, opts)}<div class="qprompt">${q.prompt_html}</div>${inner}
      <div id="fb"></div>
      <div class="actions">
        ${opts.onPrev ? '<button class="btn ghost" data-prev>← Trước</button>' : ''}
        <span class="spacer"></span>
        ${opts.exam ? '' : '<button class="btn" data-check>Kiểm tra</button>'}
        ${opts.onNext ? `<button class="btn secondary" data-next>${opts.exam ? 'Câu tiếp →' : opts.last ? 'Kết thúc' : 'Bỏ qua →'}</button>` : ''}
      </div></div>`;
    wireBookmark(host, q);
    const blanks = $$('input.blank', host);

    function syncUI() {
      $$('.opt', host).forEach((b) => {
        const on = answer.includes(+b.dataset.i);
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
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
        btn.textContent = opts.onNext ? (opts.last ? 'Hoàn thành ✓' : 'Câu tiếp →') : 'Đã chấm ✓';
        const skip = $('[data-next]', host); if (skip) skip.remove();
        if (!opts.onNext) btn.disabled = true;
        const retry = document.createElement('button'); retry.className = 'btn ghost'; retry.textContent = '↺ Làm lại';
        retry.onclick = () => mountQuestion(host, q, Object.assign({}, opts, { initial: q.type === 'essay' ? answer : [] }));
        btn.before(retry);
        if (opts.onResult) opts.onResult(res);
      } catch (e) { btn.disabled = false; toast('Lỗi: ' + e.message); }
    }
    const cb = $('[data-check]', host); if (cb) cb.onclick = check;
    const nb = $('[data-next]', host); if (nb) nb.onclick = () => opts.onNext();
    const pb = $('[data-prev]', host); if (pb) pb.onclick = () => opts.onPrev();

    // phím tắt
    host._keys = (e) => {
      if (e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT')) return;
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
    const verdict = res.correct ? '✓ Chính xác!' : res.score > 0 ? `◐ Đúng một phần (${Math.round(res.score * 100)}%)` : '✗ Chưa đúng';
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
          const s = document.createElement('span'); s.className = 'blank-fix'; s.textContent = '→ ' + res.blank_answers[i]; inp.after(s);
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
      <div class="code-layout" style="margin-top:16px">
        <div class="stack" style="min-width:0">
          <div class="panel-title">Bộ unit test có sẵn <span class="chip">${testCount(q.tests)} test</span></div>
          <details><summary>Xem mã nguồn test (${langOf(q).label})</summary><pre><code>${esc(q.tests.trim())}</code></pre></details>
          <div id="hints"></div>
          <div id="solution"></div>
        </div>
        <div style="min-width:0">
          <div class="row" style="margin-bottom:8px">
            <div class="panel-title" style="margin:0">Code của bạn <span class="chip lang-${esc(q.lang || 'javascript')}">${langOf(q).label}</span></div><span class="spacer"></span>
            <button class="btn ghost sm" data-reset title="Khôi phục code khởi đầu">↺ Reset</button>
          </div>
          <div class="editor"><div class="gutter" aria-hidden="true"></div><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Trình soạn code"></textarea></div>
          <div class="actions" style="margin-top:12px">
            ${opts.onPrev ? '<button class="btn ghost" data-prev>←</button>' : ''}
            <button class="btn ok" data-run>Chạy test <span class="kbd">⌘/Ctrl ↵</span></button>
            <button class="btn secondary" data-hint>Gợi ý</button>
            <button class="btn ghost" data-sol>Lời giải</button>
            <span class="spacer"></span>
            ${opts.onNext ? `<button class="btn secondary" data-next>${opts.last ? 'Kết thúc' : 'Bài tiếp →'}</button>` : ''}
          </div>
          <div id="run-out" style="margin-top:14px"></div>
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
      out.innerHTML = `<div class="muted">Đang chạy test trên server…${q.lang === 'go' ? ' (Go cần biên dịch, có thể mất vài giây)' : ''}</div>`;
      announcement.textContent = 'Đang chạy kiểm thử.';
      Store.saveDraft(q.id, ta.value);
      try {
        const rep = await api.post(`/api/questions/${q.id}/run`, { code: ta.value });
        Store.recordCode(q.id, rep, ta.value);
        out.innerHTML = renderRun(rep, q);
        announcement.textContent = rep.error
          ? `Kiểm thử gặp lỗi: ${rep.error.trim().split(/\r?\n/, 1)[0]}. Xem chi tiết bên dưới.`
          : rep.all_passed
            ? `Đã chạy ${rep.total} kiểm thử; tất cả đều đạt.`
            : `Đã chạy ${rep.total} kiểm thử; ${rep.passed} đạt, ${rep.total - rep.passed} chưa đạt.`;
        if (opts.onResult) opts.onResult({ correct: rep.all_passed, score: rep.total ? rep.passed / rep.total : 0 });
        if (rep.all_passed) toast('Tất cả test đều pass.');
      } catch (e) {
        out.innerHTML = `<div class="feedback bad">Lỗi: ${esc(e.message)}</div>`;
        announcement.textContent = `Không thể chạy kiểm thử: ${e.message}`;
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
      $('#hints', host).insertAdjacentHTML('beforeend', `<div class="feedback partial"><div class="verdict">Gợi ý ${h.index + 1}/${h.total}</div>${h.html}</div>`);
    };
    $('[data-sol]', host).onclick = async () => {
      if (!(Store.data.code[q.id] && Store.data.code[q.id].attempts) && !await confirmDialog('Bạn chưa chạy thử bài này lần nào.', { title: 'Xem lời giải trước khi thử?', confirmLabel: 'Xem lời giải' })) return;
      const s = await api.get(`/api/questions/${q.id}/solution`);
      $('#solution', host).innerHTML = `<details open><summary>Lời giải tham khảo</summary><pre><code>${esc(s.solution.trim())}</code></pre>
        <div style="margin-top:10px">${s.explanation_html}</div><button class="btn secondary sm" data-use style="margin-top:8px">Chép vào editor</button></details>`;
      $('[data-use]', host).onclick = () => { ta.value = s.solution.trim() + '\n'; ta.dispatchEvent(new Event('input')); };
    };
    const nb = $('[data-next]', host); if (nb) nb.onclick = () => opts.onNext();
    const pb = $('[data-prev]', host); if (pb) pb.onclick = () => opts.onPrev();
    bindKeys(null);
    if (st.attempts) $('#run-out', host).innerHTML = `<p class="muted small">Đã chạy ${st.attempts} lần · tốt nhất ${Math.round((st.best || 0) * 100)}% ${st.passed ? '· <span class="chip ok">ĐÃ PASS</span>' : ''}</p>`;
  }

  function renderRun(rep, q) {
    const ok = rep.all_passed;
    return `<div class="run-summary ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${rep.passed}/${rep.total} test pass <span class="spacer"></span><span class="tiny" style="font-weight:500">${rep.duration_ms} ms · ${q ? langOf(q).engine : 'Rust'}</span></div>
      ${rep.error ? `<div class="feedback bad" style="margin:0 0 10px"><div class="verdict">Lỗi</div><code style="white-space:pre-wrap">${esc(rep.error)}</code></div>` : ''}
      <div class="test-results">${rep.results.map((r) => `<div class="tres ${r.passed ? 'ok' : 'bad'}"><span class="mark">${r.passed ? '✓' : '✗'}</span><div style="min-width:0"><div>${esc(r.name)}</div>${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}</div></div>`).join('')}</div>
      ${rep.logs.length ? `<div class="panel-title" style="margin-top:14px">Console</div><div class="console">${esc(rep.logs.join('\n'))}</div>` : ''}`;
  }

  // ------------------------------------------------------------------ code lab
  function pageCode(params) {
    setActive('code'); crumbs([['Tổng quan', '#/'], ['Code Lab', '#/code']]);
    const all = Object.values(S.qmeta).filter((q) => q.type === 'code');
    const tf = params.track || '';
    const list = all.filter((q) => !tf || q.track === tf);
    const passed = list.filter((q) => Store.data.code[q.id] && Store.data.code[q.id].passed).length;
    const selectedTrack = tf && S.tracks[tf] ? S.tracks[tf].title : '';
    view().innerHTML = `
      <section class="code-heading">
        <div><h1>Code Lab</h1><p>Chọn bài để viết lời giải và chạy bộ unit test có sẵn.</p></div>
        <div class="code-count" aria-label="Tiến độ bài code"><strong>${passed}/${list.length}</strong><span>bài đã pass${selectedTrack ? ` trong ${esc(selectedTrack)}` : ''}</span></div>
      </section>
      <details class="code-help"><summary>Môi trường chạy unit test</summary>
        <p><b>JavaScript</b> chạy trong sandbox Boa với bộ test theo cú pháp Jest; <b>Python</b> chạy qua <code>python3 -I</code>; <b>Go</b> chạy bằng <code>go run</code>; <b>Rust</b> chạy bằng <code>rustc</code>. Mỗi bài có bộ test riêng hiển thị trong phần làm bài.</p>
      </details>
      <div class="code-filter"><label for="code-track">Lọc theo lộ trình</label>
        <select id="code-track"><option value="" ${tf ? '' : 'selected'}>Tất cả lộ trình</option>
          ${S.catalog.tracks.filter((t) => t.counts.code).map((t) => `<option value="${t.id}" ${tf === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
        </select>
      </div>
      <p class="code-list-summary">${list.length} bài code${selectedTrack ? ` trong ${esc(selectedTrack)}` : ' trong toàn bộ kho'}</p>
      <div class="code-list">${list.map((q, index) => {
        const c = Store.data.code[q.id];
        const t = S.tracks[q.track];
        const state = c && c.passed ? 'ok' : c && c.attempts ? 'partial' : '';
        const stateLabel = c && c.passed ? 'Đã pass' : c && c.attempts ? `Đã thử · ${Math.round((c.best || 0) * 100)}%` : 'Chưa làm';
        const preview = stripHtml(q.prompt_html).trim();
        return `<a class="code-row" href="#/practice?type=code${tf ? '&track=' + tf : ''}&start=${q.id}">
          <span class="code-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
          <span class="code-row-main"><strong>${esc(q.title)}</strong><small>${esc(t.title)} · ${esc(S.modules[q.module].title)}</small><span class="code-preview">${esc(preview.slice(0, 150))}${preview.length > 150 ? '…' : ''}</span></span>
          <span class="code-row-meta"><span class="code-state ${state}">${stateLabel}</span><span>${langOf(q).label} · ${testCount(q.tests)} test</span>${diffStars(q.difficulty)}</span>
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
      ${saved ? `<div class="feedback partial" style="margin-bottom:16px"><div class="verdict">Bạn có một bài thi đang làm dở</div><div class="row"><button class="btn" id="resume">Tiếp tục làm</button><button class="btn ghost" id="discard">Huỷ bài đó</button></div></div>` : ''}
      <div class="grid cols-2">
        <form class="card stack" id="exam-form">
          <h3>Tạo đề thi</h3>
          <label class="stack" style="display:block"><span class="small muted">Lộ trình</span><br>
            <select name="track" style="width:100%"><option value="all">Tất cả lộ trình</option>${trackGroups().map((g) => `<optgroup label="${esc(g.name)}">${g.tracks.map((t) => `<option value="${t.id}" ${params.track === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <div class="grid cols-2">
            <label><span class="small muted">Số câu</span><br><select name="count" style="width:100%">${[10, 20, 30, 40].map((n) => `<option ${n === 20 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label><span class="small muted">Thời gian (phút)</span><br><select name="minutes" style="width:100%">${[10, 15, 20, 30, 45, 60].map((n) => `<option ${n === 20 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          </div>
          <div><span class="small muted">Dạng câu hỏi</span><div class="row" style="margin-top:6px">
            ${['single', 'multiple', 'fill', 'essay'].map((t) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="types" value="${t}" ${t !== 'essay' ? 'checked' : ''}> ${TYPE_LABEL[t]}</label>`).join('')}
          </div></div>
          <button class="btn" type="submit">Bắt đầu làm bài</button>
        </form>
        <div class="card"><h3>Lịch sử thi</h3>
          ${hist.length ? `<table><tr><th>Ngày</th><th>Lộ trình</th><th>Điểm</th><th>Thời gian</th></tr>${hist.slice(0, 10).map((x) => `<tr><td>${new Date(x.date).toLocaleString('vi-VN')}</td><td>${esc(x.track === 'all' ? 'Tất cả' : (S.tracks[x.track] || {}).title || x.track)}</td><td><b>${x.score.toFixed(1)}</b>/10 <span class="muted small">(${x.correct}/${x.total})</span></td><td>${Math.round(x.seconds / 60)} phút</td></tr>`).join('')}</table>` : '<p class="muted">Chưa có bài thi nào.</p>'}
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
      const data = await api.get(`/api/exam?track=${f.get('track')}&count=${f.get('count')}&types=${types.join(',')}`);
      if (!data.questions.length) { toast('Không đủ câu hỏi'); return; }
      runExam({ track: f.get('track'), ids: data.questions.map((q) => q.id), answers: {}, started: Date.now(), limit: +f.get('minutes') * 60, idx: 0 });
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
        <p class="small muted" style="margin:12px 0">${ex.ids.filter(answered).length}/${ex.ids.length} câu đã trả lời</p>
        <button class="btn" style="width:100%" id="submit">Nộp bài</button></div></aside></div>`;
      $$('.qnav-grid button').forEach((b) => (b.onclick = () => { ex.idx = +b.dataset.i; persist(); draw(); }));
      $('#submit').onclick = async () => { const un = ex.ids.length - ex.ids.filter(answered).length; if (un && !await confirmDialog(`Còn ${un} câu chưa trả lời.`, { title: 'Nộp bài thi?', confirmLabel: 'Nộp bài' })) return; submit(); };
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
    view().innerHTML = `<div class="card"><div class="row" style="gap:28px">
        <div class="score-ring" style="--p:${p};--ring:${p >= 70 ? 'var(--ok)' : p >= 40 ? 'var(--warn)' : 'var(--bad)'}"><div><div><b>${score.toFixed(1)}</b><span class="muted small">/ 10 điểm</span></div></div></div>
        <div style="flex:1;min-width:220px"><h1>${p >= 80 ? 'Kết quả xuất sắc' : p >= 50 ? 'Kết quả khá tốt' : 'Cần ôn thêm'}</h1>
          <p class="muted">${correct}/${ex.ids.length} câu đúng hoàn toàn · làm trong ${Math.floor(seconds / 60)} phút ${seconds % 60} giây</p>
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
    const wrong = Object.keys(S.qmeta).filter((id) => ['bad', 'partial'].includes(Store.status(id)));
    const bms = Store.data.bookmarks.filter((id) => S.qmeta[id]);
    view().innerHTML = `<h1>Ôn tập</h1><p class="muted">Học lại những câu chưa đúng và câu bạn đã đánh dấu ★.</p>
      <div class="section-title"><h2>Câu làm sai / chưa trọn vẹn</h2><span class="chip bad">${wrong.length}</span><span class="spacer"></span>${wrong.length ? `<a class="btn sm" href="#/practice?ids=${wrong.join(',')}">Ôn tất cả</a>` : ''}</div>
      ${wrong.length ? questionList(wrong, (id) => `#/practice?ids=${wrong.join(',')}&start=${id}`) : '<div class="card empty">Không có câu sai nào.</div>'}
      <div class="section-title"><h2>Đã đánh dấu</h2><span class="chip warn">${bms.length}</span><span class="spacer"></span>${bms.length ? `<a class="btn sm" href="#/practice?ids=${bms.join(',')}">Ôn tất cả</a>` : ''}</div>
      ${bms.length ? questionList(bms, (id) => `#/practice?ids=${bms.join(',')}&start=${id}`) : '<div class="card empty">Bấm ☆ trên câu hỏi để đánh dấu.</div>'}`;
  }

  function pageBank(params) {
    setActive('bank'); crumbs([['Tổng quan', '#/'], ['Kho câu hỏi', '#/bank']]);
    view().innerHTML = `<h1>Kho câu hỏi</h1>
      <p class="muted">${S.catalog.total} câu hỏi; các bài code có bộ unit test để chấm tự động.</p>
      <div class="filters">
        <input type="search" id="f-q" placeholder="Tìm theo nội dung, tag…" style="flex:1;min-width:200px" value="${esc(params.q || '')}">
        <select id="f-track"><option value="">Mọi lộ trình</option>${S.catalog.tracks.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
        <select id="f-type"><option value="">Mọi dạng</option>${Object.keys(TYPE_LABEL).map((t) => `<option value="${t}">${TYPE_LABEL[t]}</option>`).join('')}</select>
        <select id="f-diff"><option value="">Mọi độ khó</option><option value="1">★ Dễ</option><option value="2">★★ Trung bình</option><option value="3">★★★ Khó</option></select>
        <select id="f-status"><option value="">Mọi trạng thái</option><option value="new">Chưa làm</option><option value="ok">Đã đúng</option><option value="wrong">Sai / một phần</option></select>
      </div>
      <div class="row" style="margin-bottom:10px"><span class="muted small" id="f-count"></span><span class="spacer"></span><a class="btn sm secondary" id="f-practice">Luyện các câu đang lọc</a></div>
      <div id="f-list"></div>`;
    const apply = () => {
      const qv = $('#f-q').value.trim().toLowerCase(), tr = $('#f-track').value, ty = $('#f-type').value, df = $('#f-diff').value, stt = $('#f-status').value;
      const ids = Object.values(S.qmeta).filter((q) => (!tr || q.track === tr) && (!ty || q.type === ty) && (!df || String(q.difficulty) === df)
        && (!stt || (stt === 'new' ? !Store.status(q.id) : stt === 'ok' ? Store.status(q.id) === 'ok' : ['bad', 'partial'].includes(Store.status(q.id))))
        && (!qv || (q.title + ' ' + stripHtml(q.prompt_html) + ' ' + q.tags.join(' ') + ' ' + q.id).toLowerCase().includes(qv))).map((q) => q.id);
      $('#f-count').textContent = ids.length + ' câu hỏi';
      $('#f-list').innerHTML = questionList(ids, (id) => `#/practice?ids=${id}`);
      $('#f-practice').href = ids.length ? `#/practice?ids=${ids.join(',')}` : '#/bank';
    };
    ['#f-q', '#f-track', '#f-type', '#f-diff', '#f-status'].forEach((s) => $(s).addEventListener('input', apply));
    apply();
  }

  function pageProgress() {
    setActive('progress'); crumbs([['Tổng quan', '#/'], ['Tiến độ', '#/progress']]);
    const days = [];
    for (let i = 89; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0, 10); const n = Store.data.activity[k] || 0; days.push(`<span title="${k}: ${n} lượt" data-l="${n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3}"></span>`); }
    const types = Object.keys(TYPE_LABEL).map((ty) => {
      const ids = Object.values(S.qmeta).filter((q) => q.type === ty).map((q) => q.id);
      const p = progressOf(ids);
      return `<div><div class="row small"><span>${TYPE_LABEL[ty]}</span><span class="spacer"></span><span class="muted">${p.done}/${p.total}</span></div><div class="progress"><span style="width:${p.p}%"></span></div></div>`;
    }).join('');
    view().innerHTML = `<h1>Tiến độ học tập</h1>
      <p class="muted">Bovabon Edu không cần đăng nhập: tiến độ được lưu trên trình duyệt này. Hãy xuất file để sao lưu hoặc chuyển sang máy khác.</p>
      <div class="grid cols-2">
        <div class="card"><h3>Hoạt động 90 ngày</h3><div class="heat">${days.join('')}</div><p class="small muted" style="margin:10px 0 0">Chuỗi hiện tại: ${Store.streak()} ngày</p></div>
        <div class="card stack"><h3>Theo dạng bài</h3>${types}</div>
      </div>
      ${trackGroups().map((g) => `<div class="section-title"><h2>${esc(g.name)}</h2></div><div class="grid cols-3">${g.tracks.map((t) => {
        return `<div class="card"><h3>${esc(t.title)}</h3><div class="stack">${t.modules.map((m) => { const p = progressOf(m.question_ids); return `<div><div class="row small"><a href="#/module/${m.id}">${esc(m.title)}</a><span class="spacer"></span><span class="muted">${p.p}%</span></div><div class="progress ${p.p === 100 ? 'ok' : ''}"><span style="width:${p.p}%"></span></div></div>`; }).join('')}</div></div>`;
      }).join('')}</div>`).join('')}
      <div class="card" style="margin-top:16px"><h3>Sao lưu dữ liệu</h3><div class="row">
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
      try { const d = Store.normalize(JSON.parse(await f.text()), true); if (!d) throw new Error('File không hợp lệ'); Store.data = d; Store.save(); toast('Đã nhập tiến độ'); renderTopStats(); pageProgress(); }
      catch (err) { toast('Lỗi: ' + err.message); }
    };
    $('#rst').onclick = async () => { if (await confirmDialog('Toàn bộ tiến độ lưu trên trình duyệt này sẽ bị xoá và không thể khôi phục.', { title: 'Xoá toàn bộ tiến độ?', confirmLabel: 'Xoá tiến độ', destructive: true })) { Store.data = Store.empty(); Store.save(); renderTopStats(); pageProgress(); toast('Đã xoá tiến độ'); } };
  }

  function notFound() { crumbs([['Không tìm thấy', '#/']]); view().innerHTML = '<div class="empty"><div class="big">404</div>Không tìm thấy trang. <a href="#/">Về trang chủ</a></div>'; }

  // ------------------------------------------------------------------ router
  function route() {
    bindKeys(null);
    const raw = location.hash.slice(1) || '/';
    const [path, qs] = raw.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    const seg = path.split('/').filter(Boolean);
    try {
      if (!seg.length) return pageHome();
      switch (seg[0]) {
        case 'track': return pageTrack(seg[1]);
        case 'module': return pageModule(seg[1], params.tab);
        case 'practice': return pagePractice(params);
        case 'code': return pageCode(params);
        case 'exam': return pageExam(params);
        case 'review': return pageReview();
        case 'bank': return pageBank(params);
        case 'progress': return pageProgress();
        default: return notFound();
      }
    } catch (e) { console.error(e); view().innerHTML = `<div class="feedback bad">Lỗi hiển thị: ${esc(e.message)}</div>`; }
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
  loadCatalog().then(() => { renderNav(); renderTopStats(); route(); window.addEventListener('hashchange', route); })
    .catch((e) => { view().innerHTML = `<div class="feedback bad">Không tải được dữ liệu: ${esc(e.message)}</div>`; });
})();
