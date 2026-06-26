/* ════════════════════════════════════════════════════════════
   admin.js — 글로벌 법률사무소 관리자 (Modernize 스타일)
   · 배포 환경(Cloudflare Pages + D1): /api/board /api/blog /api/settings 사용
   · API가 없으면(로컬 미리보기 등) 자동으로 "데모 모드"(이 브라우저 localStorage)
   순수 바닐라 JS. 외부 라이브러리 없음.
   ════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── 저장소 키 ── */
  var KEY_ADMIN = "glo-admin-key";       // 관리자 비밀번호(쓰기 인증)
  var KEY_ADMIN_ID = "glo-admin-id";     // 관리자 아이디(표시용)
  var KEY_ADMIN_TOKEN = "glo-admin-tok"; // 구글 로그인 idToken(쓰기 인증)
  var KEY_ADMIN_SESSION = "glo-admin-sess"; // 서버 발급 세션 토큰(만료 7일)
  var KEY_ADMIN_NAME = "glo-admin-name"; // 로그인한 관리자 표시 이름
  var KEY_BOARD = "glo-board-v1";    // 데모 게시판 (board.js와 공유)
  var KEY_BLOG = "glo-blog-v1";      // 데모 블로그
  var KEY_SET = "glo-settings-v1";   // 데모 설정

  /* 데이터별 모드: 'api' 시도 → 실패 시 'local'로 강등(자동 폴백) */
  var mode = { board: "api", blog: "api", set: "api" };
  var demo = false; // 한 번이라도 데모로 강등되면 true → 배너 표시

  var root = document.getElementById("admin");
  if (!root) return;

  var state = { tab: "dash", boardId: null, q: "", filter: "all", dashAll: false, blogMode: "list", editorImage: "", editId: null, blogQ: "", blogFilterCat: "all", heroImgs: {}, _rows: [] };
  var busy = false;
  var quill = null; // Quill 에디터 인스턴스

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
  function adminToken() { return localStorage.getItem(KEY_ADMIN_TOKEN) || ""; }
  function adminSession() { return localStorage.getItem(KEY_ADMIN_SESSION) || ""; }
  /* 쓰기 요청에 함께 보낼 관리자 인증(세션 우선, 비밀번호/구글 토큰 보조) */
  function adminAuth() { return { key: adminKey(), idToken: adminToken(), session: adminSession() }; }
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
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
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
      return jwrite("/api/board", "POST", { type: "comment", postId: postId, name: "글로벌 법률사무소", body: body, official: true, key: adminKey(), idToken: adminToken(), session: adminSession() })
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
      return jwrite("/api/board", "DELETE", { type: "post", id: id, key: adminKey(), idToken: adminToken(), session: adminSession() })
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
      return jwrite("/api/board", "DELETE", { type: "comment", id: c.id, key: adminKey(), idToken: adminToken(), session: adminSession() })
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
      return jget("/api/blog?all=1", "blog").then(function (d) { return d.posts || []; })
        .catch(function () { goDemo("blog"); return blogListLocal(); });
    }
    return Promise.resolve(blogListLocal());
  }
  function blogListLocal() {
    return blogEnsure().slice().sort(function (a, b) { return b.ts - a.ts; }).map(function (p) {
      return { id: p.id, title: p.title, cat: p.cat || "", ts: p.ts, image: p.image || "", status: p.status || "published", lang: p.lang || "ko", excerpt: String(p.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 110) };
    });
  }
  function blogGet(id) {
    if (mode.blog === "api") {
      return jget("/api/blog?id=" + encodeURIComponent(id), "blog").then(function (d) { return d.post || null; })
        .catch(function () { goDemo("blog"); return blogGetLocal(id); });
    }
    return Promise.resolve(blogGetLocal(id));
  }
  function blogGetLocal(id) { return blogEnsure().filter(function (x) { return x.id === id; })[0] || null; }
  // post = { id?, title, cat, body, image, status, lang }
  function blogSave(post) {
    if (mode.blog === "api") {
      var payload = { title: post.title, cat: post.cat, body: post.body, image: post.image || "", status: post.status || "published", lang: post.lang || "ko", key: adminKey(), idToken: adminToken(), session: adminSession() };
      if (post.id) payload.id = post.id;
      return jwrite("/api/blog", "POST", payload)
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return blogSaveLocal(post); });
    }
    return Promise.resolve(blogSaveLocal(post));
  }
  function blogSaveLocal(post) {
    var p = blogEnsure();
    if (post.id) {
      var t = p.filter(function (x) { return x.id === post.id; })[0];
      if (t) { t.title = post.title; t.cat = post.cat; t.body = post.body; t.image = post.image || ""; t.status = post.status || "published"; t.lang = post.lang || "ko"; }
    } else {
      p.push({ id: "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: post.title, cat: post.cat, body: post.body, image: post.image || "", status: post.status || "published", lang: post.lang || "ko", ts: Date.now() });
    }
    lSave(KEY_BLOG, p); return true;
  }
  /* 언어 목록(코드→표시명). window.LANGS(i18n.js) 사용, 없으면 기본값. */
  function langOptions() {
    var L = (window.LANGS && window.LANGS.length) ? window.LANGS : [{ code: "ko", label: "한국어" }, { code: "en", label: "English" }];
    return L.map(function (l) { return { code: l.code, label: (l.label || l.native || l.code) }; });
  }
  function langLabel(code) {
    code = code || "ko";
    var f = langOptions().filter(function (l) { return l.code === code; })[0];
    return f ? f.label : code.toUpperCase();
  }
  function blogDel(id) {
    if (mode.blog === "api") {
      return jwrite("/api/blog", "DELETE", { id: id, key: adminKey(), idToken: adminToken(), session: adminSession() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return blogDelLocal(id); });
    }
    return Promise.resolve(blogDelLocal(id));
  }
  function blogDelLocal(id) { var p = blogEnsure().filter(function (x) { return x.id !== id; }); lSave(KEY_BLOG, p); return true; }

  /* ── 카테고리 ── */
  var KEY_CATS = "glo-blog-cats-v1";
  function catEnsureLocal() { var c = lLoad(KEY_CATS); if (!c) { c = ["성공사례"]; lSave(KEY_CATS, c); } return c; }
  function catList() {
    if (mode.blog === "api") {
      return jget("/api/blog?cats=1", "blog").then(function (d) { return d.cats || []; })
        .catch(function () { goDemo("blog"); return catEnsureLocal(); });
    }
    return Promise.resolve(catEnsureLocal());
  }
  function catAdd(name) {
    if (mode.blog === "api") {
      return jwrite("/api/blog", "POST", { kind: "cat", name: name, key: adminKey(), idToken: adminToken(), session: adminSession() })
        .then(function (d) { return (d && d.cats) || null; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return catAddLocal(name); });
    }
    return Promise.resolve(catAddLocal(name));
  }
  function catAddLocal(name) { var c = catEnsureLocal(); if (c.indexOf(name) < 0) { c.push(name); lSave(KEY_CATS, c); } return c; }
  function catDel(name) {
    if (mode.blog === "api") {
      return jwrite("/api/blog", "DELETE", { kind: "cat", name: name, key: adminKey(), idToken: adminToken(), session: adminSession() })
        .then(function (d) { return (d && d.cats) || null; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("blog"); return catDelLocal(name); });
    }
    return Promise.resolve(catDelLocal(name));
  }
  function catDelLocal(name) { var c = catEnsureLocal().filter(function (x) { return x !== name; }); lSave(KEY_CATS, c); return c; }

  /* ── 이미지 → webp(브라우저 리사이즈+압축) Blob 생성 ── */
  function fileToWebpBlob(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error("이미지 파일이 아닙니다.")); return; }
      var img = new Image(), urlObj = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(urlObj);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("변환에 실패했습니다.")); }, "image/webp", quality);
      };
      img.onerror = function () { URL.revokeObjectURL(urlObj); reject(new Error("이미지를 불러오지 못했습니다.")); };
      img.src = urlObj;
    });
  }
  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result)); };
      fr.onerror = function () { reject(new Error("읽기 실패")); };
      fr.readAsDataURL(blob);
    });
  }
  /* 이미지 업로드: webp로 변환 → R2(/api/upload)에 저장하고 URL 반환.
     base64 폴백 없음 — 실패 시 명확한 오류를 던진다(원인을 바로 알리기). */
  function uploadImage(file) {
    return fileToWebpBlob(file, 1280, 0.82).then(function (blob) {
      var fd = new FormData();
      fd.append("file", blob, "image.webp");
      fd.append("key", adminKey());
      fd.append("idToken", adminToken());
      fd.append("session", adminSession());
      return fetch("/api/upload", { method: "POST", body: fd }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (r.ok && d && d.url) return d.url;
          var m = (r.status === 503) ? "이미지 저장소(R2)가 연결되지 않았습니다. Cloudflare에서 R2 바인딩(MEDIA)을 추가하고 재배포하세요."
            : (r.status === 403 || r.status === 401) ? "관리자 인증이 만료되었습니다. 다시 로그인해 주세요."
            : ((d && d.error) || ("이미지 업로드 실패 (" + r.status + ")"));
          throw new Error(m);
        });
      });
    });
  }

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
      return jwrite("/api/settings", "POST", { settings: s, key: adminKey(), idToken: adminToken(), session: adminSession() })
        .then(function () { return true; })
        .catch(function (e) { if (e.status === 403) throw e; goDemo("set"); lSave(KEY_SET, s); return true; });
    }
    lSave(KEY_SET, s); return Promise.resolve(true);
  }

  /* ════════════════════════════════════════════════════════════
     인증 화면 / 로그아웃
     ════════════════════════════════════════════════════════════ */
  var GBTN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.6-.05-1.2-.16-1.7H12v3.4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/><path fill="#34A853" d="M12 22c2.7 0 5-0.9 6.6-2.4l-3.2-2.5c-.9.6-2 .95-3.4.95-2.6 0-4.8-1.75-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 13.95a6 6 0 0 1 0-3.9V7.45H3.1a10 10 0 0 0 0 9.1z"/><path fill="#EA4335" d="M12 6.2c1.5 0 2.8.5 3.8 1.5l2.85-2.85A10 10 0 0 0 3.1 7.45L6.4 10.05C7.2 7.7 9.4 6.2 12 6.2z"/></svg>';
  function renderLogin() {
    root.innerHTML =
      '<div class="ax-login">' +
        '<div class="ax-login-card">' +
          '<div class="ax-login-logo">' + LOGO + '</div>' +
          '<h1>관리자 로그인</h1>' +
          '<p>구글 계정으로 로그인하세요.</p>' +
          '<button class="ax-btn ax-glogin" data-act="glogin">' + GBTN + '<span>Google로 로그인</span></button>' +
          '<div class="ax-login-or"><span>또는 비밀번호</span></div>' +
          '<div class="ax-field"><input id="adm-key" type="password" autocomplete="current-password" placeholder="비밀번호"></div>' +
          '<button class="ax-btn pri ax-login-btn" data-act="login">비밀번호로 로그인</button>' +
          '<p class="ax-login-note" id="adm-login-msg" aria-live="polite"></p>' +
        '</div>' +
      '</div>';
    var keyEl = $("#adm-key");
    if (keyEl) { keyEl.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); }); }
  }
  function loginFail(msg) {
    var lb = $('[data-act="login"]'); if (lb) { lb.disabled = false; lb.textContent = "비밀번호로 로그인"; }
    var gb = $('[data-act="glogin"]'); if (gb) { gb.disabled = false; }
    var m = $("#adm-login-msg"); if (m) { m.textContent = msg; m.style.color = "var(--ax-red)"; }
  }
  function enterAdmin(payload, name, session) {
    if (payload.key) localStorage.setItem(KEY_ADMIN, payload.key);
    if (payload.idToken) localStorage.setItem(KEY_ADMIN_TOKEN, payload.idToken);
    if (session) localStorage.setItem(KEY_ADMIN_SESSION, session);
    if (name) localStorage.setItem(KEY_ADMIN_NAME, name); else localStorage.removeItem(KEY_ADMIN_NAME);
    state.tab = "dash"; renderApp();
  }
  // 서버 검증(/api/admin-login) 후 진입. 엔드포인트 없음/네트워크 오류면 데모 진입.
  function verifyAndEnter(payload, name) {
    fetch("/api/admin-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (d.ok === true) { enterAdmin(payload, name || d.name, d.token); return; }
        if (d.ok === false) { loginFail(d.error || "로그인에 실패했습니다."); return; }
        demo = true; enterAdmin(payload, name); // 엔드포인트 없음(로컬)
      })
      .catch(function () { demo = true; enterAdmin(payload, name); });
  }
  function doLogin() {
    var k = val("#adm-key");
    if (!k) { loginFail("비밀번호를 입력하세요."); return; }
    var btn = $('[data-act="login"]'); if (btn) { btn.disabled = true; btn.textContent = "확인 중…"; }
    verifyAndEnter({ key: k });
  }
  function doGoogleLogin() {
    if (!window.AuthGoogle || !AuthGoogle.signIn) { loginFail("구글 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."); return; }
    var gb = $('[data-act="glogin"]'); if (gb) { gb.disabled = true; }
    AuthGoogle.signIn().then(function (u) {
      if (!u) { if (gb) gb.disabled = false; return; } // 사용자가 취소
      if (!u.idToken) { loginFail("구글 로그인이 필요합니다.(이름 입력 방식은 관리자 로그인에 사용할 수 없습니다)"); return; }
      verifyAndEnter({ idToken: u.idToken }, u.name);
    });
  }
  function logout() {
    if (!confirm("로그아웃 하시겠습니까? 저장된 로그인 정보가 이 브라우저에서 삭제됩니다.")) return;
    localStorage.removeItem(KEY_ADMIN);
    localStorage.removeItem(KEY_ADMIN_ID);
    localStorage.removeItem(KEY_ADMIN_TOKEN);
    localStorage.removeItem(KEY_ADMIN_SESSION);
    localStorage.removeItem(KEY_ADMIN_NAME);
    if (window.AuthGoogle && AuthGoogle.signOut) { try { AuthGoogle.signOut(); } catch (e) {} }
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
              '<div class="ax-user"><span class="ax-ava">' + esc((localStorage.getItem(KEY_ADMIN_NAME) || "관리자").slice(0, 1)) + '</span><span class="nm">' + esc(localStorage.getItem(KEY_ADMIN_NAME) || "관리자 사용자") + '</span></div>' +
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
    if (state.tab === "blog") return state.blogMode === "write" ? renderBlogWrite() : (state.blogMode === "cats" ? renderCats() : renderBlog());
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

  /* ════════ 3) 매거진(성공 사례) ════════ */
  function blogTabs(active) {
    return '<div class="ax-mag-tabs">' +
      '<button class="ax-mag-tab' + (active === "list" ? " active" : "") + '" data-act="bl-tab-list">매거진 목록</button>' +
      '<button class="ax-mag-tab' + (active === "cats" ? " active" : "") + '" data-act="bl-cats">카테고리 관리</button>' +
    '</div>';
  }
  function renderBlog() {
    setMain(
      blogTabs("list") +
      '<div class="ax-mag-toolbar">' +
        '<div class="ax-search ax-mag-search">' + icon("search") + '<input id="mag-q" type="search" placeholder="매거진 제목 검색" value="' + esc(state.blogQ) + '"></div>' +
        '<select id="mag-filter" class="ax-mag-filter"><option value="all">전체 카테고리</option></select>' +
        '<button class="ax-btn pri ax-mag-new" data-act="bl-new">+ 매거진 작성</button>' +
      '</div>' +
      '<div id="bl-list"><div class="ax-loading">불러오는 중…</div></div>');
    catList().then(function (cats) {
      var sel = $("#mag-filter"); if (!sel) return;
      sel.innerHTML = '<option value="all">전체 카테고리</option>' + (cats || []).map(function (c) { return '<option value="' + esc(c) + '"' + (state.blogFilterCat === c ? " selected" : "") + '>' + esc(c) + "</option>"; }).join("");
    });
    drawMagGrid();
  }
  function drawMagGrid() {
    blogList().then(function (posts) {
      var q = (state.blogQ || "").toLowerCase(), fc = state.blogFilterCat || "all";
      var shown = posts.filter(function (p) {
        if (fc !== "all" && (p.cat || "") !== fc) return false;
        if (q && (p.title || "").toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      var cards = shown.length ? shown.map(function (p) {
        var st = p.status === "draft" ? '<span class="ax-mag-badge draft">임시저장</span>' : '<span class="ax-mag-badge pub">발행됨</span>';
        var cover = p.image ? ' style="background-image:url(' + esc(p.image) + ')"' : "";
        return '<div class="ax-mag-card">' +
          '<div class="ax-mag-cover' + (p.image ? "" : " noimg") + '"' + cover + '>' + st + '</div>' +
          '<div class="ax-mag-info">' +
            '<h3>' + esc(p.title) + '</h3>' +
            '<div class="ax-mag-meta">' +
              (p.cat ? '<span class="ax-mag-cat">' + esc(p.cat) + '</span>' : '<span class="ax-mag-cat muted">미분류</span>') +
              '<span class="ax-mag-lang">' + esc(langLabel(p.lang)) + '</span>' +
            '</div>' +
            '<div class="ax-mag-actions">' +
              '<button class="ax-icon-btn" data-edit-blog="' + esc(p.id) + '" title="수정">' + icon("pencil") + '</button>' +
              '<button class="ax-icon-btn danger" data-del-blog="' + esc(p.id) + '" title="삭제">' + icon("trash") + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("") : '<div class="ax-empty">매거진이 없습니다. “+ 매거진 작성”으로 첫 글을 만들어 보세요.</div>';
      var el = $("#bl-list"); if (el) el.innerHTML = '<div class="ax-mag-grid">' + cards + '</div>';
      refreshBanner();
    });
  }

  /* ── Quill 에디터 ── */
  function initEditor() {
    quill = null;
    if (typeof Quill === "undefined") {
      var host = $("#bl-editor"); if (host) host.innerHTML = '<textarea id="bl-body" rows="14" style="width:100%;box-sizing:border-box;border:0;outline:none;font:inherit;padding:14px;resize:vertical" placeholder="본문 내용을 입력하세요..."></textarea>';
      return;
    }
    registerImageLayout();
    quill = new Quill("#bl-editor", {
      theme: "snow",
      placeholder: "본문 내용을 입력하세요...",
      modules: {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            ["blockquote"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            ["link", "image", "video"],
            ["clean"],
          ],
          handlers: { image: editorImageHandler },
        },
      },
    });
  }
  // 레이아웃(class)을 보존하는 커스텀 이미지 blot 등록(1회)
  function registerImageLayout() {
    if (typeof Quill === "undefined" || Quill.__layoutImgDone) return;
    var BaseImage = Quill.import("formats/image");
    class LayoutImage extends BaseImage {
      static create(value) {
        var src = (value && typeof value === "object") ? value.src : value;
        var node = super.create(src);
        var layout = (value && typeof value === "object") ? value.layout : "";
        if (layout) node.setAttribute("class", "ql-img-" + layout);
        return node;
      }
      static value(node) {
        var m = (node.getAttribute("class") || "").match(/ql-img-([a-z]+)/);
        return { src: node.getAttribute("src"), layout: m ? m[1] : "" };
      }
    }
    LayoutImage.blotName = "image";
    LayoutImage.tagName = "IMG";
    Quill.register(LayoutImage, true);
    Quill.__layoutImgDone = true;
  }

  // 이미지 배치 선택 팝업
  var IMG_LAYOUTS = [
    { k: "center", label: "기본 (가운데)", ic: '<rect x="6" y="7" width="12" height="10" rx="1.5"/>' },
    { k: "full", label: "전체 너비", ic: '<rect x="3" y="7" width="18" height="10" rx="1.5"/>' },
    { k: "left", label: "좌측 정렬 (글 감싸기)", ic: '<rect x="3" y="7" width="9" height="10" rx="1.5"/><path d="M14 9h7M14 12h7M14 15h7"/>' },
    { k: "right", label: "우측 정렬 (글 감싸기)", ic: '<rect x="12" y="7" width="9" height="10" rx="1.5"/><path d="M3 9h7M3 12h7M3 15h7"/>' },
    { k: "half", label: "2장 나란히", ic: '<rect x="3" y="7" width="8" height="10" rx="1.5"/><rect x="13" y="7" width="8" height="10" rx="1.5"/>' },
  ];
  function openImageLayoutPicker(cb) {
    var back = document.createElement("div");
    back.className = "ax-imgpick";
    back.innerHTML = '<div class="ax-imgpick-card"><h3>이미지 배치 선택</h3><div class="ax-imgpick-opts">' +
      IMG_LAYOUTS.map(function (o) {
        return '<button class="ax-imgpick-opt" data-layout="' + o.k + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + o.ic + '</svg>' +
          '<span>' + o.label + '</span></button>';
      }).join("") +
      '</div><button class="ax-imgpick-x" data-act="imgpick-close">취소</button></div>';
    document.body.appendChild(back);
    function close() { if (back.parentNode) back.parentNode.removeChild(back); }
    back.addEventListener("click", function (e) {
      if (e.target === back) { close(); return; }
      var x = e.target.closest("[data-act='imgpick-close']"); if (x) { close(); return; }
      var opt = e.target.closest("[data-layout]");
      if (opt) { var layout = opt.getAttribute("data-layout"); close(); cb(layout); }
    });
  }
  function editorImageHandler() {
    if (!quill) return;
    openImageLayoutPicker(function (layout) {
      var input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      if (layout === "half") input.multiple = true;
      input.onchange = function () {
        var files = [].slice.call(input.files || []); if (!files.length) return;
        var range = quill.getSelection(true);
        var idx = range ? range.index : quill.getLength();
        (function next(i) {
          if (i >= files.length) { quill.setSelection(idx, 0); return; }
          uploadImage(files[i]).then(function (url) {
            quill.insertEmbed(idx, "image", { src: url, layout: layout }, "user");
            idx++; next(i + 1);
          }).catch(function (e) { alert((e && e.message) || "이미지 업로드에 실패했습니다."); });
        })(0);
      };
      input.click();
    });
  }
  function getEditorHtml() {
    if (quill) { var h = quill.root.innerHTML; return (h === "<p><br></p>") ? "" : h; }
    return val("#bl-body");
  }

  function renderBlogWrite() {
    setMain(
      '<div class="ax-editor-page">' +
        '<div class="ax-page-h"><div><h1>' + (state.editId ? "매거진 수정" : "새 글 작성") + '</h1><p>제목·본문·대표 이미지·카테고리를 작성하세요.</p></div>' +
          '<div class="ax-page-actions"><button class="ax-btn" data-act="bl-cancel-write">목록으로</button><button class="ax-btn" data-act="bl-draft">임시 저장</button><button class="ax-btn pri" data-act="bl-publish">발행하기</button></div></div>' +
        '<div class="ax-editor-grid">' +
          '<main>' +
            '<section class="ax-card ax-form">' +
              '<div class="ax-field"><input id="bl-title" class="ax-title-input" maxlength="160" placeholder="제목을 입력하세요"></div>' +
              '<div class="ax-grid2">' +
                '<div class="ax-field"><label>카테고리</label><select id="bl-cat"></select></div>' +
                '<div class="ax-field"><label>언어 <span class="ax-muted-c">(이 언어 화면에 노출)</span></label><select id="bl-lang"></select></div>' +
              '</div>' +
              '<div class="ax-field"><label>대표 이미지 <span class="ax-muted-c">(자동 webp · R2 저장)</span></label>' +
                '<div class="ax-img-up">' +
                  '<button type="button" class="ax-btn" data-act="bl-pick-img">' + icon("download") + '이미지 선택</button>' +
                  '<input id="bl-img-input" type="file" accept="image/*" style="display:none">' +
                  '<button type="button" class="ax-btn danger" data-act="bl-img-clear" id="bl-img-clear" style="display:none">제거</button>' +
                  '<span id="bl-img-name" class="ax-muted-c">선택된 파일 없음</span>' +
                '</div>' +
                '<div id="bl-img-prev" class="ax-img-prev" style="display:none"></div>' +
              '</div>' +
            '</section>' +
            '<section class="ax-card ax-editor-card"><div id="bl-editor"></div></section>' +
          '</main>' +
          '<aside>' +
            '<section class="ax-card ax-publish"><h3>발행 안내</h3><p class="ax-note">선택한 <b>언어</b> 화면(홈 성공 사례 슬라이더·성공 사례 페이지)에만 노출됩니다. 각 언어로 보이게 하려면 그 언어를 선택해 글을 따로 올리세요. 임시 저장은 공개되지 않습니다. 대표 이미지는 R2에 저장됩니다.</p></section>' +
          '</aside>' +
        '</div>' +
      '</div>');
    initEditor();
    // 언어 옵션(기본: 현재 사이트 언어)
    var lsel = $("#bl-lang");
    if (lsel) {
      var cur = window.getLang ? window.getLang() : "ko";
      lsel.innerHTML = langOptions().map(function (l) { return '<option value="' + esc(l.code) + '"' + (l.code === cur ? " selected" : "") + '>' + esc(l.label) + "</option>"; }).join("");
    }
    catList().then(function (cats) {
      var sel = $("#bl-cat"); var list = (cats && cats.length) ? cats : ["성공사례"];
      if (sel) sel.innerHTML = list.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + "</option>"; }).join("");
      if (state.editId) loadEditing(); else { state.editorImage = ""; }
      refreshBanner();
    });
  }
  function loadEditing() {
    blogGet(state.editId).then(function (p) {
      if (!p) return;
      var ti = $("#bl-title"); if (ti) ti.value = p.title || "";
      var sel = $("#bl-cat"); if (sel && p.cat) { sel.value = p.cat; }
      var lsel = $("#bl-lang"); if (lsel && p.lang) { lsel.value = p.lang; }
      if (quill) { try { quill.setContents([]); quill.clipboard.dangerouslyPasteHTML(0, p.body || ""); } catch (e) { quill.root.innerHTML = p.body || ""; } }
      else { var bt = $("#bl-body"); if (bt) bt.value = p.body || ""; }
      state.editorImage = p.image || "";
      if (p.image) {
        var nm = $("#bl-img-name"); if (nm) nm.textContent = "기존 대표 이미지";
        var pv = $("#bl-img-prev"); if (pv) { pv.style.display = "block"; pv.innerHTML = '<img src="' + p.image + '" alt="">'; }
        var cb = $("#bl-img-clear"); if (cb) cb.style.display = "";
      }
    });
  }
  function saveBlog(status) {
    var t = val("#bl-title"); if (!t) { alert("제목을 입력하세요."); return; }
    var cat = ($("#bl-cat") || {}).value || "";
    var lang = ($("#bl-lang") || {}).value || "ko";
    var body = getEditorHtml();
    if (status === "published" && !body) { alert("내용을 입력하세요."); return; }
    // 본문에 R2 미업로드 이미지(base64)가 있으면 경고 — R2 미연결 시 저장이 불안정/잘릴 수 있음
    if (/(<img[^>]+src=["']data:image)|src=["']data:image/.test(body) || /^data:image/.test(state.editorImage || "")) {
      if (!confirm("이미지가 서버(R2)에 업로드되지 않고 임시(base64)로만 들어가 있습니다.\nR2가 연결되지 않으면 저장 시 이미지가 사라질 수 있습니다.\n\nR2 연결을 권장합니다. 그래도 계속할까요?")) return;
    }
    busy = true;
    blogSave({ id: state.editId || null, title: t, cat: cat, body: body, image: state.editorImage, status: status, lang: lang })
      .then(function () { busy = false; state.editId = null; state.editorImage = ""; state.blogMode = "list"; renderBlog(); })
      .catch(function (err) { busy = false; handleErr(err, "저장에 실패했습니다."); });
  }

  /* ════════ 카테고리 관리 ════════ */
  function renderCats() {
    setMain(
      blogTabs("cats") +
      '<div class="ax-card">' +
        '<div class="ax-card-h"><div><h2>카테고리 관리</h2><p>성공 사례 글을 분류할 카테고리를 만들고 삭제합니다.</p></div></div>' +
        '<div class="ax-form">' +
          '<div class="ax-cat-add"><input id="cat-new" maxlength="40" placeholder="새 카테고리 이름"><button class="ax-btn pri" data-act="cat-add">추가</button></div>' +
          '<div id="cat-list"><div class="ax-loading">불러오는 중…</div></div>' +
        '</div>' +
      '</div>');
    drawCats();
  }
  function drawCats() {
    catList().then(function (cats) {
      var el = $("#cat-list"); if (!el) return;
      if (!cats || !cats.length) { el.innerHTML = '<div class="ax-empty">카테고리가 없습니다. 위에서 추가하세요.</div>'; refreshBanner(); return; }
      el.innerHTML = '<ul class="ax-cat-ul">' + cats.map(function (c) {
        return '<li><span>' + esc(c) + '</span><button class="ax-cmt-del" data-del-cat="' + esc(c) + '">삭제</button></li>';
      }).join("") + "</ul>";
      refreshBanner();
    });
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
    setMain('<div id="set-root"><div class="ax-loading">불러오는 중…</div></div>');
    setGet().then(function (s) {
      state.heroImgs = { hero1: s.hero1 || "", hero2: s.hero2 || "", hero3: s.hero3 || "", hero4: s.hero4 || "", hero5: s.hero5 || "" };
      var fields = SET_FIELDS.map(function (f) {
        return '<div class="ax-field"><label>' + f.label + '</label><input id="set-' + f.k + '" value="' + esc(s[f.k] || "") + '" placeholder="' + esc(f.ph) + '"></div>';
      }).join("");
      var heroSlots = "";
      for (var i = 1; i <= 5; i++) {
        var u = state.heroImgs["hero" + i];
        heroSlots += '<div class="ax-hero-slot">' +
          '<div class="ax-hero-prev' + (u ? "" : " empty") + '" id="hero-prev-' + i + '"' + (u ? ' style="background-image:url(' + esc(u) + ')"' : "") + '><b>' + i + '</b></div>' +
          '<button type="button" class="ax-btn" data-hero-pick="' + i + '">' + icon("download") + '이미지 변경</button>' +
          '<input id="hero-input-' + i + '" type="file" accept="image/*" style="display:none">' +
        '</div>';
      }
      var html =
        '<div class="ax-card">' +
          '<div class="ax-card-h"><div><h2>사이트 정보</h2><p>사이트 전반의 연락처·정보에 반영됩니다</p></div></div>' +
          '<div class="ax-form"><div class="ax-grid2">' + fields + '</div>' +
          '<p class="ax-note">전화·이메일·주소·영업시간 등은 사이트 전반의 <code>data-set</code> 요소에 반영됩니다.</p>' +
          '<div class="ax-actions"><button class="ax-btn pri" data-act="set-save">저장</button></div></div>' +
        '</div>' +
        '<div class="ax-card">' +
          '<div class="ax-card-h"><div><h2>히어로 배너 이미지</h2><p>홈 상단 배너 5칸의 이미지를 업로드합니다(자동 webp · R2 저장). 변경 후 <b>저장</b>을 눌러야 사이트에 반영됩니다.</p></div></div>' +
          '<div class="ax-form"><div class="ax-hero-grid">' + heroSlots + '</div>' +
          '<div class="ax-actions"><button class="ax-btn pri" data-act="set-save">저장</button></div></div>' +
        '</div>';
      var el = $("#set-root"); if (el) el.innerHTML = html;
      refreshBanner();
    });
  }

  /* ════════════════════════════════════════════════════════════
     이벤트 위임
     ════════════════════════════════════════════════════════════ */
  function handleErr(e, fallbackMsg) {
    if (e && (e.status === 403 || e.status === 401)) {
      alert("로그인이 만료되었거나 권한이 없습니다. 다시 로그인해 주세요.");
      // 만료된 인증 정리 후 로그인 화면으로
      localStorage.removeItem(KEY_ADMIN_SESSION);
      localStorage.removeItem(KEY_ADMIN_TOKEN);
      renderLogin();
    } else {
      alert(fallbackMsg || "처리 중 오류가 발생했습니다.");
    }
  }

  root.addEventListener("click", function (e) {
    var actEl = e.target.closest("[data-act]");
    var act = actEl && actEl.getAttribute("data-act");
    if (act === "login") { doLogin(); return; }
    if (act === "glogin") { doGoogleLogin(); return; }
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

    if (act === "bl-tab-list") { state.blogMode = "list"; renderTab(); return; }
    if (act === "bl-new") { state.editId = null; state.editorImage = ""; state.blogMode = "write"; renderTab(); return; }
    if (act === "bl-cancel-write") { state.editId = null; state.editorImage = ""; state.blogMode = "list"; renderTab(); return; }
    if (act === "bl-cats") { state.blogMode = "cats"; renderTab(); return; }
    if (act === "bl-pick-img") { var fi = $("#bl-img-input"); if (fi) fi.click(); return; }

    var heroPick = e.target.closest("[data-hero-pick]");
    if (heroPick) { var hin = $("#hero-input-" + heroPick.getAttribute("data-hero-pick")); if (hin) hin.click(); return; }
    if (act === "bl-img-clear") {
      state.editorImage = "";
      var nm = $("#bl-img-name"); if (nm) nm.textContent = "선택된 파일 없음";
      var pv = $("#bl-img-prev"); if (pv) { pv.style.display = "none"; pv.innerHTML = ""; }
      var cb = $("#bl-img-clear"); if (cb) cb.style.display = "none";
      var fi2 = $("#bl-img-input"); if (fi2) fi2.value = "";
      return;
    }
    if (act === "cat-add") {
      var nm2 = val("#cat-new"); if (!nm2) { alert("카테고리 이름을 입력하세요."); return; }
      busy = true;
      catAdd(nm2).then(function () { busy = false; var i = $("#cat-new"); if (i) i.value = ""; drawCats(); })
        .catch(function (err) { busy = false; handleErr(err, "카테고리 추가에 실패했습니다."); });
      return;
    }
    var delCat = e.target.closest("[data-del-cat]");
    if (delCat) {
      if (!confirm("이 카테고리를 삭제하시겠습니까? (해당 카테고리로 작성된 글은 그대로 유지됩니다)")) return;
      busy = true;
      catDel(delCat.getAttribute("data-del-cat")).then(function () { busy = false; drawCats(); })
        .catch(function (err) { busy = false; handleErr(err, "카테고리 삭제에 실패했습니다."); });
      return;
    }

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

    if (act === "bl-draft") { saveBlog("draft"); return; }
    if (act === "bl-publish") { saveBlog("published"); return; }

    var editB = e.target.closest("[data-edit-blog]");
    if (editB) { state.editId = editB.getAttribute("data-edit-blog"); state.editorImage = ""; state.blogMode = "write"; renderTab(); return; }

    var delB = e.target.closest("[data-del-blog]");
    if (delB) {
      if (!confirm("이 매거진 글을 삭제하시겠습니까?")) return;
      busy = true;
      blogDel(delB.getAttribute("data-del-blog")).then(function () { busy = false; drawMagGrid(); })
        .catch(function (err) { busy = false; handleErr(err, "매거진 글 삭제에 실패했습니다."); });
      return;
    }

    if (act === "set-save") {
      var s = {};
      SET_FIELDS.forEach(function (f) { var el = $("#set-" + f.k); if (el) s[f.k] = el.value.trim(); });
      for (var hi = 1; hi <= 5; hi++) { s["hero" + hi] = (state.heroImgs && state.heroImgs["hero" + hi]) || ""; }
      busy = true;
      setSave(s).then(function () { busy = false; alert("저장되었습니다."); renderSettings(); })
        .catch(function (err) { busy = false; handleErr(err, "저장에 실패했습니다."); });
      return;
    }
  });

  // 검색(디바운스) — 현재 탭의 목록만 다시 그림(입력 포커스 유지)
  var qTimer = null, magTimer = null;
  root.addEventListener("input", function (e) {
    if (e.target && e.target.id === "ax-q") {
      state.q = e.target.value.trim();
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        if (state.tab === "dash") drawDash();
        else if (state.tab === "board" && !state.boardId) drawBoardRows();
      }, 220);
    } else if (e.target && e.target.id === "mag-q") {
      state.blogQ = e.target.value.trim();
      clearTimeout(magTimer);
      magTimer = setTimeout(drawMagGrid, 200);
    }
  });

  // 카테고리 필터(select) 변경
  root.addEventListener("change", function (e) {
    if (e.target && e.target.id === "mag-filter") { state.blogFilterCat = e.target.value; drawMagGrid(); }
  });

  // 대표 이미지 선택 → 브라우저에서 webp 변환·리사이즈 후 미리보기
  root.addEventListener("change", function (e) {
    if (!e.target || e.target.id !== "bl-img-input") return;
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var nm = $("#bl-img-name"); if (nm) nm.textContent = "업로드 중…";
    uploadImage(file).then(function (url) {
      state.editorImage = url;
      if (nm) nm.textContent = (file.name || "이미지") + (/^data:/.test(url) ? " · webp(임시)" : " · 업로드됨");
      var pv = $("#bl-img-prev"); if (pv) { pv.style.display = "block"; pv.innerHTML = '<img src="' + url + '" alt="대표 이미지 미리보기">'; }
      var cb = $("#bl-img-clear"); if (cb) cb.style.display = "";
    }).catch(function (e) {
      if (nm) nm.textContent = "업로드 실패";
      alert((e && e.message) || "이미지 업로드에 실패했습니다.");
    });
  });

  // 히어로 배너 이미지 선택 → webp 변환·R2 업로드 후 해당 칸 미리보기 갱신
  root.addEventListener("change", function (e) {
    if (!e.target || !/^hero-input-(\d)$/.test(e.target.id)) return;
    var n = e.target.id.replace("hero-input-", "");
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var prev = $("#hero-prev-" + n);
    if (prev) { prev.classList.remove("empty"); prev.classList.add("loading"); }
    uploadImage(file).then(function (url) {
      state.heroImgs["hero" + n] = url;
      if (prev) { prev.classList.remove("loading"); prev.classList.remove("empty"); prev.style.backgroundImage = "url(" + url + ")"; }
    }).catch(function (err) {
      if (prev) { prev.classList.remove("loading"); if (!state.heroImgs["hero" + n]) prev.classList.add("empty"); }
      alert((err && err.message) || "이미지 업로드에 실패했습니다.");
    });
  });

  /* ── 진입 ── */
  if (adminSession() || adminKey() || adminToken()) renderApp(); else renderLogin();
})();
