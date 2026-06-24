/* ════════════════════════════════════════════════════════════
   admin.js — 글로벌 법률사무소 관리자 페이지
   · 배포 환경(Cloudflare Pages + D1): /api/board /api/blog /api/settings 사용
   · API가 없으면(로컬 미리보기 등) 자동으로 "데모 모드"(이 브라우저 localStorage)
   순수 바닐라 JS. 외부 라이브러리 없음.
   ════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── 저장소 키 ── */
  var KEY_ADMIN = "glo-admin-key";   // 관리자 키(쓰기 인증)
  var KEY_BOARD = "glo-board-v1";    // 데모 게시판 (board.js와 공유)
  var KEY_BLOG = "glo-blog-v1";      // 데모 블로그
  var KEY_SET = "glo-settings-v1";   // 데모 설정

  /* 데이터별 모드: 'api' 시도 → 실패 시 'local'로 강등(자동 폴백) */
  var mode = { board: "api", blog: "api", set: "api" };
  var demo = false; // 한 번이라도 데모로 강등되면 true → 배너 표시

  var root = document.getElementById("admin");
  if (!root) return;

  var state = { tab: "dash", boardId: null, q: "", filter: "all" };
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
  function adminKey() { return localStorage.getItem(KEY_ADMIN) || ""; }
  function isToday(ts) {
    var d = new Date(ts), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  function lLoad(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lSave(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function goDemo(area) { if (mode[area] === "api") mode[area] = "local"; demo = true; }

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
     쓰기 실패(403) → 호출부에서 alert 처리하도록 throw {status:403}
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
    // 데모 댓글엔 id가 없을 수 있어 index를 함께 노출(삭제용)
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
  // 댓글 삭제: API는 id 기반, 데모는 index 기반(c.idx) 폴백
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
        // 빈 응답이어도 기본값으로 폼을 채워줌
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
    root.innerHTML =
      '<div class="adm-login">' +
        '<div class="adm-login-card">' +
          '<div class="adm-login-icon">🔒</div>' +
          '<h1 class="adm-login-title">관리자 로그인</h1>' +
          '<p class="adm-login-sub">관리자 키를 입력하세요. 입력한 키는 이 브라우저에 저장되어 모든 변경 작업에 사용됩니다.</p>' +
          '<div class="field"><label>관리자 키</label><input id="adm-key" type="password" autocomplete="current-password" placeholder="관리자 키"></div>' +
          '<button class="btn btn--gold adm-login-btn" data-act="login">확인</button>' +
          '<p class="adm-login-note">키가 설정되지 않은(데모) 환경에서도 임의의 값으로 진입할 수 있습니다.</p>' +
        '</div>' +
      '</div>';
    var inp = $("#adm-key");
    if (inp) { inp.focus(); inp.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); }); }
  }
  function doLogin() {
    var k = val("#adm-key");
    if (!k) { alert("관리자 키를 입력하세요."); return; }
    localStorage.setItem(KEY_ADMIN, k);
    state.tab = "dash"; renderApp();
  }
  function logout() {
    if (!confirm("로그아웃 하시겠습니까? 저장된 관리자 키가 이 브라우저에서 삭제됩니다.")) return;
    localStorage.removeItem(KEY_ADMIN);
    renderLogin();
  }

  /* ════════════════════════════════════════════════════════════
     앱 셸 (탭 + 본문)
     ════════════════════════════════════════════════════════════ */
  var TABS = [
    { id: "dash", label: "대시보드", icon: "📊" },
    { id: "board", label: "게시판 관리", icon: "💬" },
    { id: "blog", label: "블로그 관리", icon: "📝" },
    { id: "settings", label: "사이트 정보", icon: "⚙️" }
  ];

  function demoBanner() {
    return demo ? '<div class="adm-demo">데모 모드 — 변경사항이 이 브라우저에만 저장됩니다. (Cloudflare 배포 후 실제 반영)</div>' : "";
  }

  function renderApp() {
    state.boardId = null;
    var tabs = TABS.map(function (t) {
      return '<button class="adm-tab' + (state.tab === t.id ? " active" : "") + '" data-tab="' + t.id + '">' +
        '<span class="adm-tab-ic">' + t.icon + '</span><span class="adm-tab-l">' + t.label + '</span></button>';
    }).join("");
    root.innerHTML =
      '<div class="adm-shell">' +
        '<aside class="adm-side">' +
          '<nav class="adm-tabs">' + tabs + '</nav>' +
          '<button class="adm-logout" data-act="logout">로그아웃</button>' +
        '</aside>' +
        '<main class="adm-main" id="adm-main"></main>' +
      '</div>';
    renderTab();
  }

  function setMain(html) {
    var m = $("#adm-main");
    if (m) m.innerHTML = demoBanner() + html;
  }
  function refreshBanner() {
    // 데모로 막 강등된 경우 배너가 보이도록 본문 상단에 보장
    var m = $("#adm-main");
    if (demo && m && !m.querySelector(".adm-demo")) m.insertAdjacentHTML("afterbegin", demoBanner());
  }

  function renderTab() {
    if (state.tab === "dash") return renderDash();
    if (state.tab === "board") return state.boardId ? renderBoardDetail() : renderBoardList();
    if (state.tab === "blog") return renderBlog();
    if (state.tab === "settings") return renderSettings();
  }

  /* ── 1) 대시보드 ── */
  function renderDash() {
    setMain('<h1 class="adm-h1">대시보드</h1><div class="adm-stats"><div class="adm-loading">불러오는 중…</div></div>');
    Promise.all([boardList(), blogList()]).then(function (res) {
      var posts = res[0], blog = res[1];
      var total = posts.length;
      var unanswered = posts.filter(function (p) { return !p.answered; }).length;
      var todayCnt = posts.filter(function (p) { return isToday(p.ts); }).length;
      var comments = posts.reduce(function (a, p) { return a + (p.commentCount || 0); }, 0);
      var cards = [
        { v: total, k: "총 글" },
        { v: unanswered, k: "미답변 글", warn: unanswered > 0 },
        { v: todayCnt, k: "오늘 작성 글" },
        { v: comments, k: "총 댓글" },
        { v: blog.length, k: "블로그 글" }
      ].map(function (c) {
        return '<div class="adm-stat' + (c.warn ? " warn" : "") + '"><div class="adm-stat-v">' + c.v + '</div><div class="adm-stat-k">' + c.k + '</div></div>';
      }).join("");
      setMain('<h1 class="adm-h1">대시보드</h1><div class="adm-stats">' + cards + '</div>' +
        '<div class="adm-dash-hint">미답변 글이 있으면 <b>게시판 관리</b> 탭에서 공식 답변을 등록하세요.</div>');
    });
  }

  /* ── 2) 게시판 관리: 목록 ── */
  function renderBoardList() {
    setMain('<h1 class="adm-h1">게시판 관리</h1>' +
      '<div class="adm-toolbar">' +
        '<input class="adm-search" id="bd-q" type="search" placeholder="제목·작성자 검색" value="' + esc(state.q) + '">' +
        '<div class="adm-seg">' +
          '<button class="adm-seg-b' + (state.filter === "all" ? " active" : "") + '" data-filter="all">전체</button>' +
          '<button class="adm-seg-b' + (state.filter === "unanswered" ? " active" : "") + '" data-filter="unanswered">미답변</button>' +
        '</div>' +
      '</div>' +
      '<div id="bd-list" class="adm-loading">불러오는 중…</div>');
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
      var html = '<table class="adm-table"><thead><tr><th>제목</th><th>작성자</th><th>날짜</th><th class="ce">댓글</th><th class="ce">상태</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (p) {
          return '<tr class="adm-row" data-open="' + esc(p.id) + '">' +
            '<td class="adm-td-title">' + esc(p.title) + '</td>' +
            '<td>' + esc(p.name) + '</td>' +
            '<td class="adm-td-date">' + fmt(p.ts) + '</td>' +
            '<td class="ce">' + (p.commentCount || 0) + '</td>' +
            '<td class="ce">' + (p.answered ? '<span class="adm-badge ok">답변완료</span>' : '<span class="adm-badge wait">미답변</span>') + '</td>' +
          '</tr>';
        }).join("") : '<tr><td colspan="5" class="adm-empty">해당하는 글이 없습니다.</td></tr>') +
        '</tbody></table>';
      var el = $("#bd-list"); if (el) { el.className = ""; el.innerHTML = html; }
      refreshBanner();
    });
  }

  /* ── 2) 게시판 관리: 상세 ── */
  function renderBoardDetail() {
    setMain('<button class="adm-back" data-act="bd-back">← 목록으로</button><div id="bd-detail" class="adm-loading">불러오는 중…</div>');
    boardGet(state.boardId).then(function (d) {
      if (!d) { state.boardId = null; return renderBoardList(); }
      var p = d.post, cs = d.comments || [];
      var comments = cs.length ? cs.map(function (c) {
        return '<div class="adm-comment' + (c.official ? " official" : "") + '">' +
          '<div class="adm-c-top"><span class="adm-c-name">' + esc(c.name) + (c.official ? '<span class="adm-badge ok sm">공식</span>' : '') + '</span>' +
          '<span class="adm-c-date">' + fmt(c.ts) + '</span>' +
          '<button class="adm-c-del" data-del-comment="' + (c.id != null ? esc(c.id) : "") + '" data-idx="' + (c.idx != null ? c.idx : "") + '" title="댓글 삭제">삭제</button></div>' +
          '<div class="adm-c-body">' + nl2br(c.body) + '</div></div>';
      }).join("") : '<div class="adm-empty" style="padding:18px;">아직 댓글이 없습니다.</div>';
      var html =
        '<article class="adm-post">' +
          '<div class="adm-post-head"><h1 class="adm-h1">' + esc(p.title) + '</h1>' +
          '<button class="btn btn--ghost adm-del-post" data-act="bd-del-post">글 삭제</button></div>' +
          '<div class="adm-post-meta"><span>' + esc(p.name) + '</span><span>' + fmt(p.ts) + '</span></div>' +
          '<div class="adm-post-body">' + nl2br(p.body) + '</div>' +
        '</article>' +
        '<div class="adm-comments"><h2 class="adm-h2">댓글 ' + cs.length + '</h2>' + comments + '</div>' +
        '<div class="adm-reply"><h2 class="adm-h2">공식 답변 작성</h2>' +
          '<div class="field"><textarea id="bd-reply" rows="4" placeholder="변호사사무실 공식 답변을 입력하세요"></textarea></div>' +
          '<div class="adm-actions"><button class="btn btn--gold" data-act="bd-reply">공식 답변 등록</button></div>' +
        '</div>';
      var el = $("#bd-detail"); if (el) { el.className = ""; el.innerHTML = html; }
      refreshBanner();
    });
  }

  /* ── 3) 블로그 관리 ── */
  function renderBlog() {
    setMain('<h1 class="adm-h1">블로그 관리</h1>' +
      '<div class="adm-blog-form">' +
        '<h2 class="adm-h2">새 글 작성</h2>' +
        '<div class="adm-grid2">' +
          '<div class="field"><label>제목</label><input id="bl-title" maxlength="160" placeholder="제목"></div>' +
          '<div class="field"><label>분류</label><input id="bl-cat" maxlength="40" placeholder="예: 칼럼, 소식"></div>' +
        '</div>' +
        '<div class="field"><label>내용</label><textarea id="bl-body" rows="6" placeholder="내용을 입력하세요"></textarea></div>' +
        '<div class="adm-actions"><button class="btn btn--gold" data-act="bl-add">등록</button></div>' +
      '</div>' +
      '<h2 class="adm-h2">글 목록</h2>' +
      '<div id="bl-list" class="adm-loading">불러오는 중…</div>');
    drawBlogList();
  }
  function drawBlogList() {
    blogList().then(function (posts) {
      var html = '<table class="adm-table"><thead><tr><th>제목</th><th>분류</th><th>날짜</th><th class="ce">관리</th></tr></thead><tbody>' +
        (posts.length ? posts.map(function (p) {
          return '<tr>' +
            '<td class="adm-td-title">' + esc(p.title) + '</td>' +
            '<td>' + (p.cat ? '<span class="adm-tag">' + esc(p.cat) + '</span>' : '<span class="muted">-</span>') + '</td>' +
            '<td class="adm-td-date">' + fmt(p.ts) + '</td>' +
            '<td class="ce"><button class="adm-c-del" data-del-blog="' + esc(p.id) + '">삭제</button></td>' +
          '</tr>';
        }).join("") : '<tr><td colspan="4" class="adm-empty">아직 블로그 글이 없습니다.</td></tr>') +
        '</tbody></table>';
      var el = $("#bl-list"); if (el) { el.className = ""; el.innerHTML = html; }
      refreshBanner();
    });
  }

  /* ── 4) 사이트 정보 ── */
  var SET_FIELDS = [
    { k: "phone", label: "전화", ph: "02 2277 2442" },
    { k: "email", label: "이메일", ph: "lawsqare@naver.com" },
    { k: "address", label: "주소", ph: "서울특별시 중구 …" },
    { k: "hours", label: "영업시간", ph: "평일 09:00 – 18:00" },
    { k: "kakao", label: "카카오톡", ph: "카카오 채널/오픈채팅 링크 또는 ID" },
    { k: "blogUrl", label: "네이버 블로그 URL", ph: "https://blog.naver.com/…" }
  ];
  function renderSettings() {
    setMain('<h1 class="adm-h1">사이트 정보</h1><div id="set-form" class="adm-loading">불러오는 중…</div>');
    setGet().then(function (s) {
      var fields = SET_FIELDS.map(function (f) {
        return '<div class="field"><label>' + f.label + '</label><input id="set-' + f.k + '" value="' + esc(s[f.k] || "") + '" placeholder="' + esc(f.ph) + '"></div>';
      }).join("");
      var html = '<div class="adm-set-form"><div class="adm-grid2">' + fields + '</div>' +
        '<p class="form-note">전화·이메일·주소·영업시간 등은 사이트 전반의 <code>data-set</code> 요소에 반영됩니다.</p>' +
        '<div class="adm-actions"><button class="btn btn--gold" data-act="set-save">저장</button></div></div>';
      var el = $("#set-form"); if (el) { el.className = ""; el.innerHTML = html; }
      refreshBanner();
    });
  }

  /* ════════════════════════════════════════════════════════════
     이벤트 위임
     ════════════════════════════════════════════════════════════ */
  function handleErr(e, fallbackMsg) {
    if (e && e.status === 403) {
      alert("관리자 키가 올바르지 않습니다. 다시 로그인해 주세요.");
    } else {
      alert(fallbackMsg || "처리 중 오류가 발생했습니다.");
    }
  }

  root.addEventListener("click", function (e) {
    // 로그인 화면
    var actEl = e.target.closest("[data-act]");
    var act = actEl && actEl.getAttribute("data-act");
    if (act === "login") { doLogin(); return; }
    if (act === "logout") { logout(); return; }

    // 탭 전환
    var tabEl = e.target.closest("[data-tab]");
    if (tabEl) { state.tab = tabEl.getAttribute("data-tab"); state.boardId = null; renderApp(); return; }

    // 게시판 필터
    var fEl = e.target.closest("[data-filter]");
    if (fEl) { state.filter = fEl.getAttribute("data-filter"); renderBoardList(); return; }

    // 게시판 글 열기
    var openEl = e.target.closest("[data-open]");
    if (openEl) { state.boardId = openEl.getAttribute("data-open"); renderBoardDetail(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }

    if (busy) return;

    // 게시판: 뒤로
    if (act === "bd-back") { state.boardId = null; renderBoardList(); return; }

    // 게시판: 공식 답변 등록
    if (act === "bd-reply") {
      var body = val("#bd-reply");
      if (!body) { alert("답변 내용을 입력하세요."); return; }
      busy = true;
      boardReply(state.boardId, body).then(function () { busy = false; renderBoardDetail(); })
        .catch(function (err) { busy = false; handleErr(err, "답변 등록에 실패했습니다."); });
      return;
    }

    // 게시판: 글 삭제
    if (act === "bd-del-post") {
      if (!confirm("이 글과 모든 댓글을 삭제하시겠습니까?")) return;
      busy = true;
      boardDelPost(state.boardId).then(function () { busy = false; state.boardId = null; renderBoardList(); })
        .catch(function (err) { busy = false; handleErr(err, "글 삭제에 실패했습니다."); });
      return;
    }

    // 게시판: 댓글 삭제
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

    // 블로그: 등록
    if (act === "bl-add") {
      var t = val("#bl-title"), cat = val("#bl-cat"), bd = val("#bl-body");
      if (!t) { alert("제목을 입력하세요."); return; }
      if (!bd) { alert("내용을 입력하세요."); return; }
      busy = true;
      blogAdd(t, cat, bd).then(function () {
        busy = false;
        var ti = $("#bl-title"), ci = $("#bl-cat"), bi = $("#bl-body");
        if (ti) ti.value = ""; if (ci) ci.value = ""; if (bi) bi.value = "";
        drawBlogList();
      }).catch(function (err) { busy = false; handleErr(err, "블로그 글 등록에 실패했습니다."); });
      return;
    }

    // 블로그: 삭제
    var delB = e.target.closest("[data-del-blog]");
    if (delB) {
      if (!confirm("이 블로그 글을 삭제하시겠습니까?")) return;
      busy = true;
      blogDel(delB.getAttribute("data-del-blog")).then(function () { busy = false; drawBlogList(); })
        .catch(function (err) { busy = false; handleErr(err, "블로그 글 삭제에 실패했습니다."); });
      return;
    }

    // 설정: 저장
    if (act === "set-save") {
      var s = {};
      SET_FIELDS.forEach(function (f) { var el = $("#set-" + f.k); s[f.k] = el ? el.value.trim() : ""; });
      busy = true;
      setSave(s).then(function () { busy = false; alert("저장되었습니다."); renderSettings(); })
        .catch(function (err) { busy = false; handleErr(err, "저장에 실패했습니다."); });
      return;
    }
  });

  // 검색 입력(디바운스) — 입력칸 포커스 유지를 위해 목록(#bd-list)만 다시 그림
  var qTimer = null;
  root.addEventListener("input", function (e) {
    if (e.target && e.target.id === "bd-q") {
      state.q = e.target.value.trim();
      clearTimeout(qTimer);
      qTimer = setTimeout(drawBoardRows, 220);
    }
  });

  /* ── 진입 ── */
  if (adminKey()) renderApp(); else renderLogin();
})();
