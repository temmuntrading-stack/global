/* ════════════════════════════════════════════════════════════
   admin.js — 글로벌 법률사무소 관리자 (Modernize 스타일)
   · 배포 환경(Cloudflare Pages + D1): /api/board /api/blog /api/settings 사용
   · API가 없으면(로컬 미리보기 등) 자동으로 "데모 모드"(이 브라우저 localStorage)
   순수 바닐라 JS. 외부 라이브러리 없음.
   ════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── 저장소 키 ── */
  var KEY_ADMIN = "glo-admin-key";   // 관리자 비밀번호(쓰기 인증)
  var KEY_ADMIN_ID = "glo-admin-id"; // 관리자 아이디(표시용)
  var KEY_BOARD = "glo-board-v1";    // 데모 게시판 (board.js와 공유)
  var KEY_BLOG = "glo-blog-v1";      // 데모 블로그
  var KEY_SET = "glo-settings-v1";   // 데모 설정

  /* 데이터별 모드: 'api' 시도 → 실패 시 'local'로 강등(자동 폴백) */
  var mode = { board: "api", blog: "api", set: "api" };
  var demo = false; // 한 번이라도 데모로 강등되면 true → 배너 표시

  var root = document.getElementById("admin");
  if (!root) return;

  var state = { tab: "dash", boardId: null, q: "", filter: "all", dashAll: false, blogMode: "list", _rows: [] };
  var busy = false;

  /* ── 헬퍼 ── */
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return (s == null ? "" : String(s)).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function val(s) { var el = $(s); return el ? el.value.trim() : ""; }
  function uid() { return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function fmt(ts) {
    var d = new Date(ts); function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function fmtKDate(ts) { var d = new Date(ts); return d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일"; }
  function adminKey() { return localStorage.getItem(KEY_ADMIN) || ""; }
  function isToday(ts) {
    var d = new Date(ts), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function lLoad(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function goDemo(area) { if (mode[area] === "api") mode[area] = "local"; demo = true; }

  /* ── 아바타 ── */
  var AVA = [["#E9F0FE", "#2D5BE3"], ["#E4F5EA", "#1E8E50"], ["#FDECEC", "#D63A3F"], ["#F3ECFD", "#7C4DD6"], ["#FBEFD8", "#B7791F"], ["#E6F6F6", "#168B86"]];
  function avaColor(s) { s = String(s || ""); var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVA[h % AVA.length]; }
  function initials(name) {
    name = String(name || "").trim();
    if (!name) return "?";
    if (/^[\x00-\x7F\s]+$/.test(name)) {
      var parts = name.split(/\s+/);
      if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    return name.slice(0, 2);
  }

  /* ── 아이콘(인라인 SVG) ── */
  var IP = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8M8 9h2"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>'
  };
  function icon(name, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.9) + '" stroke-linecap="round" stroke-linejoin="round">' + (IP[name] || "") + '</svg>'; }
  var LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + IP.scale + '</svg>';

  /* ════════════════════════════════════════════════════════════
     데모(로컬) 시드 데이터
     ════════════════════════════════════════════════════════════ */
  function boardSeed() {
    var n = Date.now();
    return [
      { id: uid(), name: "이주노동자", title: "산재 신청을 회사가 거부하는데 가능한가요?",
        body: "공장에서 일하다 손을 다쳤는데 회사가 산재 신청을 안 해준다고 합니다. 제가 직접 신청할 수 있나요?", ts: n - 36e5 * 26,
        comments: [{ name: "글로벌 법률사무소", official: true, ts: n - 36e5 * 25, body: "산재보상은 근로자의 법적 권리로, 회사 동의가 없어도 근로복지공단에 직접 신청할 수 있습니다. 무료 상담 02-2277-2442 로 연락 주세요." }] },
      { id: uid(), name: "Anna", title: "비자 연장이 거절됐어요 ㅠㅠ",
        body: "체류 연장이 거절됐는데 다시 신청할 수 있을까요? 한국어가 서툴러서 걱정입니다.", ts: n - 36e5 * 5,
        comments: [{ name: "글로벌 법률사무소", official: true, ts: n - 36e5 * 4, body: "거절 사유에 따라 서류 보완 후 재신청하거나 이의 절차를 밟을 수 있습니다." }] },
      { id: uid(), name: "익명", title: "월급을 두 달째 못 받고 있습니다",
        body: "사장님이 계속 미루기만 합니다. 어떻게 해야 받을 수 있을까요?", ts: n - 36e5 / 2, comments: [] }
    ];
  }
  function boardEnsure() { var p = lLoad(KEY_BOARD); if (!p) { p = boardSeed(); lSave(KEY_BOARD, p); } return p; }

  function blogSeed() {
    var n = Date.now();
    return [
      { id: "b" + n.toString(36) + "a", title: "외국인 근로자의 산재 보상, 이렇게 받으세요", cat: "칼럼",
        body: "산업재해는 국적과 무관하게 보호받는 권리입니다. 사고 발생 시 즉시 진료기록을 확보하고, 근로복지공단에 직접 요양급여를 신청할 수 있습니다. 회사의 동의는 필요하지 않습니다.", ts: n - 86400000 * 3 },
      { id: "b" + n.toString(36) + "b", title: "글로벌 법률사무소, 10개 언어 무료 상담 시작", cat: "소식",
        body: "이주민·외국인 주민을 위해 베트남어, 중국어, 러시아어 등 10개 언어로 무료 법률 상담을 제공합니다. 전화 또는 방문 예약으로 이용하실 수 있습니다.", ts: n - 86400000 * 9 }
    ];
  }
  function blogEnsure() { var p = lLoad(KEY_BLOG); if (!p) { p = blogSeed(); lSave(KEY_BLOG, p); } return p; }

  function setDefaults() {
    return { phone: "02 2277 2442", email: "lawsqare@naver.com", address: "서울특별시 중구 을지로 254, 3층 301호", hours: "평일 09:00 – 18:00", kakao: "", blogUrl: "https://blog.naver.com/lawsqare" };
  }
  function setEnsure() { var s = lLoad(KEY_SET); if (!s) { s = setDefaults(); lSave(KEY_SET, s); } return s; }

  /* ════════════════════════════════════════════════════════════
     데이터 계층 (API 우선, 실패 시 데모)
     ════════════════════════════════════════════════════════════ */
  function jget(path, area) {
    return fetch(path, { headers: { accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("api " + r.status);
      return r.json();
    });
  }
  function jwrite(path, method, body) {
    return fetch(path, { method: method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 403) { var e = new Error("forbidden"); e.status = 403; throw e; }
        if (!r.ok) { var e2 = new Error("api " + r.status); e2.status = r.status; throw e2; }
        return r.json().catch(function () { return {}; });
      });
  }

  /* ── 게시판 ── */
  function boardList() {
    if (mode.board === "api") {
      return jget("/api/board", "board").then(function (d) { return d.posts || []; })
        .catch(function () { goDemo("board"); return boardListLocal(); });
    }
    return Promise.resolve(boardListLocal());
  }
  function boardListLocal() {
    return boardEnsure().slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (p) {
      return { id: p.id, name: p.name, title: p.title, ts: p.ts, commentCount: (p.comments || []).length, answered: (p.comments || []).some(function (c) { return c.official; }) };
    });
  }
  function boardGet(id) {
    if (mode.board === "api") {
      return jget("/api/board?id=" + encodeURIComponent(id), "board")
        .catch(function () { goDemo("board"); return boardGetLocal(id); });
    }
    return Promise.resolve(boardGetLocal(id));
  }
  function boardGetLocal(id) {
    var p = boardEnsure().filter(function (x) { return x.id === id; })[0];
    if (!p) return null;
    var comments = (p.comments || []).map(function (c, i) { return { id: c.id, idx: i, name: c.name, body: c.body, official: !!c.official, ts: c.ts }; });
    return { post: { id: p.id, name: p.name, title: p.title, body: p.body, ts: p.ts }, comments: comments };
  }
  function boardReply(postId, body) {
    if (mode.board === "api") {
      return jwrite("/api/board", "POST", { type: "comment", postId: postId, name: "글로벌 법률사무소", body: body, official: true, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("board"); return boardReplyLocal(postId, body); });
    }
    return Promise.resolve(boardReplyLocal(postId, body));
  }
  function boardReplyLocal(postId, body) {
    var p = boardEnsure(), t = p.filter(function (x) { return x.id === postId; })[0];
    if (t) { (t.comments = t.comments || []).push({ name: "글로벌 법률사무소", official: true, body: body, ts: Date.now() }); lSave(KEY_BOARD, p); }
    return true;
  }
  function boardDelPost(id) {
    if (mode.board === "api") {
      return jwrite("/api/board", "DELETE", { type: "post", id: id, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("board"); return boardDelPostLocal(id); });
    }
    return Promise.resolve(boardDelPostLocal(id));
  }
  function boardDelPostLocal(id) {
    var p = boardEnsure().filter(function (x) { return x.id !== id; }); lSave(KEY_BOARD, p); return true;
  }
  function boardDelComment(postId, c) {
    if (mode.board === "api" && c.id) {
      return jwrite("/api/board", "DELETE", { type: "comment", id: c.id, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("board"); return boardDelCommentLocal(postId, c); });
    }
    return Promise.resolve(boardDelCommentLocal(postId, c));
  }
  function boardDelCommentLocal(postId, c) {
    var p = boardEnsure(), t = p.filter(function (x) { return x.id === postId; })[0];
    if (t && t.comments) {
      if (typeof c.idx === "number") t.comments.splice(c.idx, 1);
      else if (c.id) t.comments = t.comments.filter(function (x) { return x.id !== c.id; });
      lSave(KEY_BOARD, p);
    }
    return true;
  }

  /* ── 블로그 ── */
  function blogList() {
    if (mode.blog === "api") {
      return jget("/api/blog", "blog").then(function (d) { return d.posts || []; })
        .catch(function () { goDemo("blog"); return blogListLocal(); });
    }
    return Promise.resolve(blogListLocal());
  }
  function blogListLocal() {
    return blogEnsure().slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (p) {
      return { id: p.id, title: p.title, cat: p.cat || "", ts: p.ts, excerpt: String(p.body || "").replace(/\s+/g, " ").slice(0, 110) };
    });
  }
  function blogAdd(title, cat, body) {
    if (mode.blog === "api") {
      return jwrite("/api/blog", "POST", { title: title, cat: cat, body: body, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return blogAddLocal(title, cat, body); });
    }
    return Promise.resolve(blogAddLocal(title, cat, body));
  }
  function blogAddLocal(title, cat, body) {
    var p = blogEnsure(); p.push({ id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: title, cat: cat, body: body, ts: Date.now() }); lSave(KEY_BLOG, p); return true;
  }
  function blogDel(id) {
    if (mode.blog === "api") {
      return jwrite("/api/blog", "DELETE", { id: id, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return blogDelLocal(id); });
    }
    return Promise.resolve(blogDelLocal(id));
  }
  function blogDelLocal(id) { var p = blogEnsure().filter(function (x) { return x.id !== id; }); lSave(KEY_BLOG, p); return true; }

  /* ── 설정 ── */
  function setGet() {
    if (mode.set === "api") {
      return jget("/api/settings", "set").then(function (d) {
        var s = (d && d.settings) || {};
        var def = setDefaults(); Object.keys(def).forEach(function (k) { if (s[k] == null) s[k] = ""; });
        return s;
      }).catch(function () { goDemo("set"); return setEnsure(); });
    }
    return Promise.resolve(setEnsure());
  }
  function setSave(s) {
    if (mode.set === "api") {
      return jwrite("/api/settings", "POST", { settings: s, key: adminKey() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("set"); lSave(KEY_SET, s); return true; });
    }
    lSave(KEY_SET, s); return Promise.resolve(true);
  }

  /* ════════════════════════════════════════════════════════════
     인증 화면 / 로그아웃
     ════════════════════════════════════════════════════════════ */
  function renderLogin() {
    var savedId = localStorage.getItem(KEY_ADMIN_ID) || "";
    root.innerHTML =
      '<div class="ax-login">' +
        '<div class="ax-login-card">' +
          '<div class="ax-login-logo">' + LOGO + '</div>' +
          '<h1>관리자 로그인</h1>' +
          '<p>아이디와 비밀번호를 입력하세요.</p>' +
          '<div class="ax-field"><label>아이디</label><input id="adm-id" type="text" autocomplete="username" value="' + esc(savedId) + '" placeholder="아이디"></div>' +
          '<div class="ax-field"><label>비밀번호</label><input id="adm-key" type="password" autocomplete="current-password" placeholder="비밀번호"></div>' +
          '<button class="ax-btn pri ax-login-btn" data-act="login">로그인</button>' +
          '<p class="ax-login-note" id="adm-login-msg">아이디·비밀번호는 Cloudflare 환경변수(ADMIN_ID·ADMIN_KEY)로 설정합니다. 미설정 시(데모) 임의 값으로 진입됩니다.</p>' +
        '</div>' +
      '</div>';
    var idEl = $("#adm-id"), keyEl = $("#adm-key");
    function onEnter(e) { if (e.key === "Enter") doLogin(); }
    if (idEl) idEl.addEventListener("keydown", onEnter);
    if (keyEl) keyEl.addEventListener("keydown", onEnter);
    (savedId ? keyEl : idEl || keyEl).focus();
  }
  function doLogin() {
    var id = val("#adm-id"), k = val("#adm-key");
    if (!k) { alert("비밀번호를 입력하세요."); return; }
    var btn = $('[data-act="login"]');
    if (btn) { btn.disabled = true; btn.textContent = "확인 중…"; }
    function fail(msg) {
      if (btn) { btn.disabled = false; btn.textContent = "로그인"; }
      var m = $("#adm-login-msg"); if (m) { m.textContent = msg; m.style.color = "var(--ax-red)"; }
    }
    function enter() {
      localStorage.setItem(KEY_ADMIN, k);
      if (id) localStorage.setItem(KEY_ADMIN_ID, id); else localStorage.removeItem(KEY_ADMIN_ID);
      state.tab = "dash"; renderApp();
    }
    fetch("/api/admin-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: id, key: k }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (d.ok === true) { enter(); return; }
        if (d.ok === false) { fail(d.error || "아이디 또는 비밀번호가 올바르지 않습니다."); return; }
        // 엔드포인트 없음(로컬 정적 서버 등) → 데모 진입 허용
        demo = true; enter();
      })
      .catch(function () {
        // 검증 API 네트워크 오류(로컬 미리보기 등) → 데모 진입 허용
        demo = true; enter();
      });
  }
  function logout() {
    if (!confirm("로그아웃 하시겠습니까? 저장된 로그인 정보가 이 브라우저에서 삭제됩니다.")) return;
    localStorage.removeItem(KEY_ADMIN);
    localStorage.removeItem(KEY_ADMIN_ID);
    renderLogin();
  }

  /* ════════════════════════════════════════════════════════════
     앱 셸 (사이드바 + 상단바 + 콘텐츠)
     ════════════════════════════════════════════════════════════ */
  var NAV = [
    { id: "dash", label: "대시보드", icon: "grid" },
    { id: "board", label: "상담", icon: "chat" },
    { id: "blog", label: "성공 사례", icon: "doc" }
  ];

  function demoBanner() {
    return demo ? '<div class="adm-demo">데모 모드 — 변경사항이 이 브라우저에만 저장됩니다. (Cloudflare + D1 연결 후 실제 반영)</div>' : "";
  }

  function navBtn(n) {
    return '<button class="ax-nav-i' + (state.tab === n.id ? " active" : "") + '" data-tab="' + n.id + '">' + icon(n.icon) + '<span>' + n.label + '</span></button>';
  }

  function renderApp() {
    root.innerHTML =
      '<div class="ax-app">' +
        '<aside class="ax-side">' +
          '<div class="ax-brand"><span class="ax-logo">' + LOGO + '</span>' +
            '<span class="ax-brand-txt"><b>글로벌 법률 사무소</b><small>GLOBAL LAW FIRM</small></span></div>' +
          '<nav class="ax-nav">' + NAV.map(navBtn).join("") + '</nav>' +
          '<div class="ax-side-foot">' +
            '<a class="ax-nav-i" href="index.html" target="_blank" rel="noopener">' + icon("help") + '<span>지원 센터</span></a>' +
            '<button class="ax-nav-i ax-logout" data-act="logout">' + icon("logout") + '<span>로그아웃</span></button>' +
          '</div>' +
        '</aside>' +
        '<div class="ax-main">' +
          '<header class="ax-top">' +
            '<div class="ax-search">' + icon("search") + '<input id="ax-q" type="search" placeholder="사건, 문서 또는 고객 검색…" value="' + esc(state.q) + '"></div>' +
            '<div class="ax-top-right">' +
              '<button class="ax-icon" data-act="notif" title="알림">' + icon("bell") + '</button>' +
              '<button class="ax-icon' + (state.tab === "settings" ? " active" : "") + '" data-tab="settings" title="사이트 정보">' + icon("gear") + '</button>' +
              '<div class="ax-user"><span class="ax-ava">관</span><span class="nm">관리자 사용자</span></div>' +
            '</div>' +
          '</header>' +
          '<div class="ax-content" id="adm-main"></div>' +
        '</div>' +
      '</div>';
    renderTab();
    updateNotif();
  }

  function setMain(html) {
    var m = $("#adm-main");
    if (m) m.innerHTML = demoBanner() + html;
  }
  function refreshBanner() {
    var m = $("#adm-main");
    if (demo && m && !m.querySelector(".adm-demo")) m.insertAdjacentHTML("afterbegin", demoBanner());
  }
  function updateNotif() {
    boardList().then(function (posts) {
      var un = posts.filter(function (p) { return !p.answered; }).length;
      var btn = $('.ax-icon[data-act="notif"]'); if (!btn) return;
      var dot = btn.querySelector(".ax-dot");
      if (un > 0 && !dot) btn.insertAdjacentHTML("beforeend", '<span class="ax-dot"></span>');
      else if (un === 0 && dot) dot.remove();
    });
  }

  function renderTab() {
    if (state.tab === "dash") return renderDash();
    if (state.tab === "board") return state.boardId ? renderBoardDetail() : renderBoardList();
    if (state.tab === "blog") return state.blogMode === "write" ? renderBlogWrite() : renderBlog();
    if (state.tab === "settings") return renderSettings();
  }

  /* ── 상태 배지 매핑 ── */
  function statusOf(p) {
    if (p.answered) return { l: "답변완료", c: "ok" };
    if (p.commentCount > 0) return { l: "검토 중", c: "review" };
    return { l: "대기 중", c: "wait" };
  }

  /* ════════ 1) 대시보드 ════════ */
  function renderDash() {
    setMain(
      '<div class="ax-card">' +
        '<div class="ax-card-h">' +
          '<div><h2>최근 상담 요청</h2><p>승인 대기 및 변호사 배정 현황</p></div>' +
          '<button class="ax-btn" data-act="csv">' + icon("download") + 'CSV 내보내기</button>' +
        '</div>' +
        '<div id="dash-body"><div class="ax-loading">불러오는 중…</div></div>' +
      '</div>');
    drawDash();
  }
  function drawDash() {
    boardList().then(function (posts) {
      var q = state.q.toLowerCase();
      var all = posts.filter(function (p) {
        if (!q) return true;
        return (p.title || "").toLowerCase().indexOf(q) >= 0 || (p.name || "").toLowerCase().indexOf(q) >= 0;
      });
      state._rows = all;
      var body = $("#dash-body"); if (!body) return;
      if (!all.length) { body.innerHTML = '<div class="ax-empty">표시할 상담 요청이 없습니다.</div>'; refreshBanner(); return; }
      var rows = state.dashAll ? all : all.slice(0, 5);
      var trs = rows.map(function (p) {
        var st = statusOf(p), pal = avaColor(p.name);
        return '<tr>' +
          '<td><div class="ax-cust"><span class="ax-ava2" style="background:' + pal[0] + ';color:' + pal[1] + '">' + esc(initials(p.name)) + '</span><b>' + esc(p.name) + '</b></div></td>' +
          '<td>일반 상담</td>' +
          '<td class="ax-date">' + fmtKDate(p.ts) + '</td>' +
          '<td><span class="ax-st ' + st.c + '">' + st.l + '</span></td>' +
          '<td class="ax-muted-c">미배정</td>' +
          '<td class="ax-r"><button class="ax-detail" data-open="' + esc(p.id) + '">상세 보기</button></td>' +
        '</tr>';
      }).join("");
      var more = (!state.dashAll && all.length > 5)
        ? '<div class="ax-card-f" data-act="more">더 많은 요청 보기 ' + icon("chev") + '</div>' : "";
      body.innerHTML =
        '<div class="ax-tbl-wrap"><table class="ax-tbl"><thead><tr>' +
          '<th>고객명</th><th>분류</th><th>요청 날짜</th><th>상태</th><th>담당 변호사</th><th></th>' +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>' + more;
      refreshBanner();
    });
  }
  function exportCsv() {
    var rows = state._rows || [];
    var head = ["고객명", "분류", "요청 날짜", "상태", "담당 변호사"];
    var lines = [head.join(",")];
    rows.forEach(function (p) {
      var st = statusOf(p).l;
      lines.push([csv(p.name), csv("일반 상담"), csv(fmtKDate(p.ts)), csv(st), csv("미배정")].join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "consultations.csv"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 100);
  }
  function csv(s) { s = String(s == null ? "" : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  /* ════════ 2) 상담(게시판) 목록 ════════ */
  function renderBoardList() {
    setMain(
      '<div class="ax-card">' +
        '<div class="ax-card-h">' +
          '<div><h2>상담</h2><p>고객 상담 요청 및 공식 답변 관리</p></div>' +
          '<div class="ax-seg">' +
            '<button class="ax-seg-b' + (state.filter === "all" ? " active" : "") + '" data-filter="all">전체</button>' +
            '<button class="ax-seg-b' + (state.filter === "unanswered" ? " active" : "") + '" data-filter="unanswered">미답변</button>' +
          '</div>' +
        '</div>' +
        '<div id="bd-list"><div class="ax-loading">불러오는 중…</div></div>' +
      '</div>');
    drawBoardRows();
  }
  function drawBoardRows() {
    boardList().then(function (posts) {
      var q = state.q.toLowerCase();
      var rows = posts.filter(function (p) {
        if (state.filter === "unanswered" && p.answered) return false;
        if (!q) return true;
        return (p.title || "").toLowerCase().indexOf(q) >= 0 || (p.name || "").toLowerCase().indexOf(q) >= 0;
      });
      var trs = rows.length ? rows.map(function (p) {
        var st = statusOf(p), pal = avaColor(p.name);
        return '<tr>' +
          '<td><div class="ax-cust"><span class="ax-ava2" style="background:' + pal[0] + ';color:' + pal[1] + '">' + esc(initials(p.name)) + '</span><b>' + esc(p.name) + '</b></div></td>' +
          '<td class="ax-ttl">' + esc(p.title) + '</td>' +
          '<td class="ax-date">' + fmtKDate(p.ts) + '</td>' +
          '<td><span class="ax-st ' + st.c + '">' + st.l + '</span></td>' +
          '<td class="ax-r"><button class="ax-detail" data-open="' + esc(p.id) + '">상세 보기</button></td>' +
        '</tr>';
      }).join("") : '<tr><td colspan="5"><div class="ax-empty">해당하는 상담이 없습니다.</div></td></tr>';
      var el = $("#bd-list"); if (el) el.innerHTML =
        '<div class="ax-tbl-wrap"><table class="ax-tbl"><thead><tr>' +
          '<th>고객명</th><th>제목</th><th>요청 날짜</th><th>상태</th><th></th>' +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
      refreshBanner();
    });
  }

  /* ════════ 2) 상담 상세 ════════ */
  function renderBoardDetail() {
    setMain('<button class="ax-back" data-act="bd-back">' + icon("back") + '목록으로</button><div id="bd-detail"><div class="ax-loading">불러오는 중…</div></div>');
    boardGet(state.boardId).then(function (d) {
      if (!d) { state.boardId = null; return renderBoardList(); }
      var p = d.post, cs = d.comments || [], pal = avaColor(p.name);
      var comments = cs.length ? cs.map(function (c) {
        return '<div class="ax-msg' + (c.official ? " own" : "") + '">' +
          '<div class="ax-msg-bubble">' + nl2br(c.body) + '</div>' +
          '<div class="ax-msg-meta"><span>' + esc(c.official ? "글로벌 법률사무소" : c.name) + '</span><span>' + fmt(c.ts) + '</span>' +
          '<button class="ax-cmt-del" data-del-comment="' + (c.id != null ? esc(c.id) : "") + '" data-idx="' + (c.idx != null ? c.idx : "") + '">삭제</button></div>' +
        '</div>';
      }).join("") : '<div class="ax-empty">아직 답변이나 댓글이 없습니다.</div>';
      var html =
        '<div class="ax-consult-layout">' +
          '<section class="ax-card ax-chat-panel">' +
            '<div class="ax-chat-head">' +
              '<div class="ax-cust"><span class="ax-ava2" style="background:' + pal[0] + ';color:' + pal[1] + '">' + esc(initials(p.name)) + '</span><div><b>' + esc(p.name) + '</b><small>상담 요청 · ' + fmt(p.ts) + '</small></div></div>' +
              '<button class="ax-btn danger" data-act="bd-del-post">글 삭제</button>' +
            '</div>' +
            '<div class="ax-chat-day">오늘</div>' +
            '<div class="ax-chat-body">' +
              '<div class="ax-msg"><div class="ax-msg-bubble"><strong>' + esc(p.title) + '</strong><br>' + nl2br(p.body) + '</div><div class="ax-msg-meta"><span>' + esc(p.name) + '</span><span>' + fmt(p.ts) + '</span></div></div>' +
              comments +
            '</div>' +
            '<div class="ax-chat-compose">' +
              '<textarea id="bd-reply" rows="2" placeholder="공식 답변을 입력하세요"></textarea>' +
              '<button class="ax-send" data-act="bd-reply" title="공식 답변 등록">▶</button>' +
            '</div>' +
          '</section>' +
          '<aside class="ax-card ax-client-panel">' +
            '<div class="ax-client-avatar" style="background:' + pal[0] + ';color:' + pal[1] + '">' + esc(initials(p.name)) + '</div>' +
            '<h2>' + esc(p.name) + '</h2><p>상담 요청자</p>' +
            '<div class="ax-client-tags"><span>일반 상담</span><span>' + statusOf({ answered: cs.some(function(c){ return c.official; }), commentCount: cs.length }).l + '</span></div>' +
            '<div class="ax-client-block"><h3>요청 정보</h3><dl><dt>제목</dt><dd>' + esc(p.title) + '</dd><dt>요청일</dt><dd>' + fmtKDate(p.ts) + '</dd><dt>댓글</dt><dd>' + cs.length + '개</dd></dl></div>' +
          '</aside>' +
        '</div>';
      var el = $("#bd-detail"); if (el) el.innerHTML = html;
      refreshBanner();
    });
  }

  /* ════════ 3) 블로그 ════════ */
  function renderBlog() {
    setMain(
      '<div class="ax-card">' +
        '<div class="ax-page-h"><div><h1>성공 사례 관리</h1><p>성공 사례·법률 인사이트 글을 작성하면 홈과 성공 사례 페이지에 노출됩니다.</p></div>' +
          '<div class="ax-page-actions"><button class="ax-btn">' + icon("download") + '데이터 내보내기</button><button class="ax-btn">카테고리 관리</button><button class="ax-btn pri" data-act="bl-new">+ 새 글 작성</button></div></div>' +
        '<div class="ax-bulkbar"><label><input type="checkbox"> 전체 선택</label><span></span><button>발행</button><button class="danger">삭제</button><i></i></div>' +
        '<div id="bl-list"><div class="ax-loading">불러오는 중…</div></div>' +
      '</div>');
    drawBlogList();
  }
  function drawBlogList() {
    blogList().then(function (posts) {
      var trs = posts.length ? posts.map(function (p) {
        return '<tr>' +
          '<td class="ax-check"><input type="checkbox"></td>' +
          '<td><div class="ax-blog-title"><span class="ax-blog-thumb"></span><div><b>' + esc(p.title) + '</b><small>작성자: 관리자</small></div></div></td>' +
          '<td><span class="ax-st ok">발행됨</span></td>' +
          '<td class="ax-muted-c">--</td>' +
          '<td class="ax-date">' + fmtKDate(p.ts) + '</td>' +
          '<td class="ax-r"><button class="ax-cmt-del" data-del-blog="' + esc(p.id) + '">삭제</button></td>' +
        '</tr>';
      }).join("") : '<tr><td colspan="6"><div class="ax-empty">아직 발행한 글이 없습니다.</div></td></tr>';
      var el = $("#bl-list"); if (el) el.innerHTML =
        '<div class="ax-tbl-wrap"><table class="ax-tbl"><thead><tr>' +
          '<th></th><th>제목</th><th>상태</th><th>조회수</th><th>날짜</th><th></th>' +
        '</tr></thead><tbody>' + trs + '</tbody></table></div>';
      refreshBanner();
    });
  }

  function renderBlogWrite() {
    setMain(
      '<div class="ax-editor-page">' +
        '<div class="ax-page-h"><div><h1>새 글 작성</h1><p>글로벌 법률 사무소의 블로그에 새로운 전문 지식을 공유하세요.</p></div>' +
          '<div class="ax-page-actions"><button class="ax-btn" data-act="bl-cancel-write">목록으로</button><button class="ax-btn">임시 저장</button><button class="ax-btn pri" data-act="bl-add">발행하기</button></div></div>' +
        '<div class="ax-editor-grid">' +
          '<main>' +
            '<section class="ax-card ax-form">' +
              '<div class="ax-field"><label>제목</label><input id="bl-title" maxlength="160" placeholder="포스트 제목을 입력하세요"></div>' +
              '<div class="ax-grid2"><div class="ax-field"><label>카테고리</label><input id="bl-cat" maxlength="40" value="성공사례" placeholder="예: 성공사례, 법률정보"></div>' +
              '<div class="ax-field"><label>태그 (쉼표로 구분)</label><input id="bl-tags" placeholder="예: 상속, 증여, 자문"></div></div>' +
            '</section>' +
            '<section class="ax-card ax-editor">' +
              '<div class="ax-toolbar"><button>B</button><button><i>I</i></button><button><u>U</u></button><button>≡</button><button>❝</button><button>▧</button><button>↔</button></div>' +
              '<textarea id="bl-body" rows="18" placeholder="본문 내용을 입력하세요..."></textarea>' +
            '</section>' +
          '</main>' +
          '<aside>' +
            '<section class="ax-card ax-preview"><h3>미리보기</h3><div class="ax-preview-img"></div><h4>여기에 제목이 표시됩니다...</h4><p>본문 내용이 여기에 요약되어 노출됩니다.</p></section>' +
            '<section class="ax-card ax-publish"><h3>발행 설정</h3><label>공개 여부 <select><option>전체 공개</option><option>비공개</option></select></label><label>댓글 허용 <input type="checkbox" checked></label><label>발행 예약 <button type="button">날짜 선택</button></label></section>' +
            '<section class="ax-card ax-seo"><h3>SEO 최적화</h3><p>검색엔진에서 더 잘 노출될 수 있도록 메타 설명을 추가하세요.</p><textarea rows="4" placeholder="검색 결과에 표시될 설명을 입력하세요..."></textarea></section>' +
          '</aside>' +
        '</div>' +
      '</div>');
  }

  /* ════════ 4) 사이트 정보(설정) ════════ */
  var SET_FIELDS = [
    { k: "phone", label: "전화", ph: "02 2277 2442" },
    { k: "email", label: "이메일", ph: "lawsqare@naver.com" },
    { k: "address", label: "주소", ph: "서울특별시 중구 …" },
    { k: "hours", label: "영업시간", ph: "평일 09:00 – 18:00" },
    { k: "kakao", label: "카카오톡", ph: "카카오 채널/오픈채팅 링크 또는 ID" },
    { k: "blogUrl", label: "네이버 블로그 URL", ph: "https://blog.naver.com/…" }
  ];
  function renderSettings() {
    setMain(
      '<div class="ax-card">' +
        '<div class="ax-card-h"><div><h2>사이트 정보</h2><p>사이트 전반의 연락처·정보에 반영됩니다</p></div></div>' +
        '<div id="set-form" class="ax-form"><div class="ax-loading">불러오는 중…</div></div>' +
      '</div>');
    setGet().then(function (s) {
      var fields = SET_FIELDS.map(function (f) {
        return '<div class="ax-field"><label>' + f.label + '</label><input id="set-' + f.k + '" value="' + esc(s[f.k] || "") + '" placeholder="' + esc(f.ph) + '"></div>';
      }).join("");
      var html = '<div class="ax-grid2">' + fields + '</div>' +
        '<p class="ax-note">전화·이메일·주소·영업시간 등은 사이트 전반의 <code>data-set</code> 요소에 반영됩니다.</p>' +
        '<div class="ax-actions"><button class="ax-btn pri" data-act="set-save">저장</button></div>';
      var el = $("#set-form"); if (el) el.innerHTML = html;
      refreshBanner();
    });
  }

  /* ════════════════════════════════════════════════════════════
     이벤트 위임
     ════════════════════════════════════════════════════════════ */
  function handleErr(e, fallbackMsg) {
    if (e && e.status === 403) alert("관리자 키가 올바르지 않습니다. 다시 로그인해 주세요.");
    else alert(fallbackMsg || "처리 중 오류가 발생했습니다.");
  }

  root.addEventListener("click", function (e) {
    var actEl = e.target.closest("[data-act]");
    var act = actEl && actEl.getAttribute("data-act");
    if (act === "login") { doLogin(); return; }
    if (act === "logout") { logout(); return; }

    // 탭/설정 전환
    var tabEl = e.target.closest("[data-tab]");
    if (tabEl) { state.tab = tabEl.getAttribute("data-tab"); state.boardId = null; state.dashAll = false; state.blogMode = "list"; renderApp(); return; }

    // 알림 → 상담 탭
    if (act === "notif") { state.tab = "board"; state.boardId = null; renderApp(); return; }

    // 상담 필터
    var fEl = e.target.closest("[data-filter]");
    if (fEl) { state.filter = fEl.getAttribute("data-filter"); renderBoardList(); return; }

    // 대시보드 더 보기
    if (act === "more") { state.dashAll = true; drawDash(); return; }

    // CSV 내보내기
    if (act === "csv") { exportCsv(); return; }

    if (act === "bl-new") { state.blogMode = "write"; renderTab(); return; }
    if (act === "bl-cancel-write") { state.blogMode = "list"; renderTab(); return; }

    // 상담 글 열기(대시보드/목록 공용)
    var openEl = e.target.closest("[data-open]");
    if (openEl) { state.tab = "board"; state.boardId = openEl.getAttribute("data-open"); renderApp(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    if (busy) return;

    if (act === "bd-back") { state.boardId = null; renderBoardList(); return; }

    if (act === "bd-reply") {
      var body = val("#bd-reply");
      if (!body) { alert("답변 내용을 입력하세요."); return; }
      busy = true;
      boardReply(state.boardId, body).then(function () { busy = false; renderBoardDetail(); })
        .catch(function (err) { busy = false; handleErr(err, "답변 등록에 실패했습니다."); });
      return;
    }

    if (act === "bd-del-post") {
      if (!confirm("이 글과 모든 댓글을 삭제하시겠습니까?")) return;
      busy = true;
      boardDelPost(state.boardId).then(function () { busy = false; state.boardId = null; renderBoardList(); })
        .catch(function (err) { busy = false; handleErr(err, "글 삭제에 실패했습니다."); });
      return;
    }

    var delC = e.target.closest("[data-del-comment]");
    if (delC) {
      if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
      var cid = delC.getAttribute("data-del-comment");
      var idxAttr = delC.getAttribute("data-idx");
      var c = { id: cid || null, idx: idxAttr !== "" && idxAttr != null ? parseInt(idxAttr, 10) : null };
      busy = true;
      boardDelComment(state.boardId, c).then(function () { busy = false; renderBoardDetail(); })
        .catch(function (err) { busy = false; handleErr(err, "댓글 삭제에 실패했습니다."); });
      return;
    }

    if (act === "bl-add") {
      var t = val("#bl-title"), cat = val("#bl-cat"), bd = val("#bl-body");
      if (!t) { alert("제목을 입력하세요."); return; }
      if (!bd) { alert("내용을 입력하세요."); return; }
      busy = true;
      blogAdd(t, cat, bd).then(function () {
        busy = false;
        var ti = $("#bl-title"), ci = $("#bl-cat"), bi = $("#bl-body");
        if (ti) ti.value = ""; if (ci) ci.value = ""; if (bi) bi.value = "";
        state.blogMode = "list"; renderBlog();
      }).catch(function (err) { busy = false; handleErr(err, "블로그 글 등록에 실패했습니다."); });
      return;
    }

    var delB = e.target.closest("[data-del-blog]");
    if (delB) {
      if (!confirm("이 블로그 글을 삭제하시겠습니까?")) return;
      busy = true;
      blogDel(delB.getAttribute("data-del-blog")).then(function () { busy = false; drawBlogList(); })
        .catch(function (err) { busy = false; handleErr(err, "블로그 글 삭제에 실패했습니다."); });
      return;
    }

    if (act === "set-save") {
      var s = {};
      SET_FIELDS.forEach(function (f) { var el = $("#set-" + f.k); s[f.k] = el ? el.value.trim() : ""; });
      busy = true;
      setSave(s).then(function () { busy = false; alert("저장되었습니다."); renderSettings(); })
        .catch(function (err) { busy = false; handleErr(err, "저장에 실패했습니다."); });
      return;
    }
  });

  // 검색(디바운스) — 현재 탭의 목록만 다시 그림(입력 포커스 유지)
  var qTimer = null;
  root.addEventListener("input", function (e) {
    if (e.target && e.target.id === "ax-q") {
      state.q = e.target.value.trim();
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        if (state.tab === "dash") drawDash();
        else if (state.tab === "board" && !state.boardId) drawBoardRows();
      }, 220);
    }
  });

  /* ── 진입 ── */
  if (adminKey()) renderApp(); else renderLogin();
})();
