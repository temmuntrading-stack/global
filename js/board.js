/* ════════════════════════════════════════════════════════════
   board.js — 자유게시판
   · 배포 환경(Cloudflare Pages + D1): /api/board 를 통해 모두가 공유하는 실제 게시판
   · API가 없으면(로컬 미리보기 등) 자동으로 "데모 모드"(이 브라우저 localStorage)로 전환
   ════════════════════════════════════════════════════════════ */
(function () {
  var API = "/api/board";
  var LKEY = "glo-board-v1";       // 데모 모드 저장소
  var AKEY = "glo-board-adminkey"; // 변호사사무실 공식답변 키(브라우저 기억)
  var board = document.getElementById("board");
  if (!board) return;

  var PENCIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var mode = "api"; // 'api' | 'local'
  var view = { mode: "list", id: null };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function val(s) { var el = $(s); return el ? el.value.trim() : ""; }
  function uid() { return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function fmt(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }

  /* ── 데모(로컬) 저장소 ── */
  function lLoad() { try { return JSON.parse(localStorage.getItem(LKEY)); } catch (e) { return null; } }
  function lSave(p) { try { localStorage.setItem(LKEY, JSON.stringify(p)); } catch (e) {} }
  function lSeed() {
    var n = Date.now();
    return [
      { id: uid(), name: "이주노동자", title: "산재 신청을 회사가 거부하는데 가능한가요?",
        body: "공장에서 일하다 손을 다쳤는데 회사가 산재 신청을 안 해준다고 합니다. 제가 직접 신청할 수 있나요?", ts: n - 36e5 * 26,
        comments: [{ name: "글로벌 법률사무소", official: true, ts: n - 36e5 * 25, body: "산재보상은 근로자의 법적 권리로, 회사 동의가 없어도 근로복지공단에 직접 신청할 수 있습니다. 진료기록과 사고 경위 자료를 준비해 두시면 도움이 됩니다. 무료 상담 02-2277-2442 로 연락 주세요." }] },
      { id: uid(), name: "Anna", title: "비자 연장이 거절됐어요 ㅠㅠ",
        body: "체류 연장이 거절됐는데 다시 신청할 수 있을까요? 한국어가 서툴러서 걱정입니다.", ts: n - 36e5 * 5,
        comments: [{ name: "글로벌 법률사무소", official: true, ts: n - 36e5 * 4, body: "거절 사유에 따라 서류 보완 후 재신청하거나 이의 절차를 밟을 수 있습니다. 저희는 10개 언어로 상담을 지원하니 편하게 문의 주세요." }] },
      { id: uid(), name: "익명", title: "월급을 두 달째 못 받고 있습니다",
        body: "사장님이 계속 미루기만 합니다. 어떻게 해야 받을 수 있을까요?", ts: n - 36e5 / 2, comments: [] },
    ];
  }
  function lEnsure() { var p = lLoad(); if (!p) { p = lSeed(); lSave(p); } return p; }

  /* ── 데이터 계층 (API 우선, 실패 시 데모) ── */
  async function apiGet(qs) {
    var r = await fetch(API + (qs || ""), { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("api " + r.status);
    return r.json();
  }
  async function listPosts() {
    if (mode === "api") {
      try { return (await apiGet("")).posts; } catch (e) { mode = "local"; }
    }
    return lEnsure().slice().sort(function (a, b) { return b.ts - a.ts; })
      .map(function (p) { return { id: p.id, name: p.name, title: p.title, ts: p.ts, commentCount: p.comments.length, answered: p.comments.some(function (c) { return c.official; }) }; });
  }
  async function getPost(id) {
    if (mode === "api") {
      try { return await apiGet("?id=" + encodeURIComponent(id)); } catch (e) { mode = "local"; }
    }
    var p = lEnsure().filter(function (x) { return x.id === id; })[0];
    return p ? { post: { id: p.id, name: p.name, title: p.title, body: p.body, ts: p.ts }, comments: p.comments } : null;
  }
  async function addPost(name, title, body) {
    if (mode === "api") {
      try {
        var r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "post", name: name, title: title, body: body }) });
        if (!r.ok) throw new Error("api"); return;
      } catch (e) { mode = "local"; }
    }
    var p = lEnsure(); p.push({ id: uid(), name: name || "익명", title: title, body: body, ts: Date.now(), comments: [] }); lSave(p);
  }
  async function addComment(postId, name, body, official) {
    if (mode === "api") {
      var key = "";
      if (official) { key = localStorage.getItem(AKEY) || prompt("변호사사무실 관리자 키를 입력하세요") || ""; }
      try {
        var r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "comment", postId: postId, name: name, body: body, official: !!official, key: key }) });
        if (r.status === 403) { localStorage.removeItem(AKEY); alert("관리자 키가 올바르지 않습니다."); return false; }
        if (!r.ok) throw new Error("api");
        if (official && key) { try { localStorage.setItem(AKEY, key); } catch (e) {} }
        return true;
      } catch (e) { mode = "local"; }
    }
    var p = lEnsure(); var t = p.filter(function (x) { return x.id === postId; })[0];
    if (t) { t.comments.push({ name: official ? "글로벌 법률사무소" : (name || "익명"), official: !!official, body: body, ts: Date.now() }); lSave(p); }
    return true;
  }

  function demoNote() {
    return mode === "local"
      ? '<div class="bd-demo">※ 데모 모드 — 글이 이 브라우저에만 저장됩니다. Cloudflare 배포 후에는 모두가 공유합니다.</div>'
      : "";
  }

  /* ── 렌더 ── */
  async function render() {
    if (view.mode === "detail") return renderDetail();
    if (view.mode === "write") return renderWrite();
    return renderList();
  }

  async function renderList() {
    board.innerHTML = '<div class="bd-empty">불러오는 중…</div>';
    var posts = await listPosts();
    var rows = posts.map(function (p) {
      return '<button class="bd-row" data-open="' + p.id + '">'
        + '<div class="bd-row-main"><span class="bd-row-title">' + esc(p.title) + "</span>"
        + (p.commentCount ? '<span class="bd-cc">' + p.commentCount + "</span>" : "")
        + (p.answered ? '<span class="bd-answered">답변완료</span>' : "")
        + "</div>"
        + '<div class="bd-row-meta"><span>' + esc(p.name) + "</span><span>" + fmt(p.ts) + "</span></div></button>";
    }).join("");
    board.innerHTML = demoNote()
      + '<div class="bd-head"><div class="bd-note">누구나 편하게 질문을 남겨 주세요. <b>변호사사무실에서 직접 답변</b>해 드립니다.</div>'
      + '<button class="btn btn--gold" data-act="write">' + PENCIL + " 글쓰기</button></div>"
      + '<div class="bd-list">' + (rows || '<div class="bd-empty">아직 글이 없습니다. 첫 글을 남겨보세요.</div>') + "</div>";
  }

  function renderWrite() {
    board.innerHTML =
      '<button class="bd-back" data-act="back">← 목록으로</button>'
      + '<div class="bd-form-wrap"><h3 class="bd-form-title">글쓰기</h3>'
      + '<div class="field"><label>닉네임</label><input id="w-name" maxlength="20" placeholder="표시할 이름 (미입력 시 익명)"></div>'
      + '<div class="field"><label>제목</label><input id="w-title" maxlength="80" placeholder="제목을 입력하세요"></div>'
      + '<div class="field"><label>내용</label><textarea id="w-body" rows="7" placeholder="궁금한 점을 자유롭게 적어주세요"></textarea></div>'
      + '<div class="bd-actions"><button class="btn btn--ghost" data-act="cancel">취소</button><button class="btn btn--gold" data-act="submit">등록</button></div></div>';
  }

  async function renderDetail() {
    board.innerHTML = '<div class="bd-empty">불러오는 중…</div>';
    var d = await getPost(view.id);
    if (!d) { view.mode = "list"; return render(); }
    var p = d.post, cs = d.comments || [];
    var comments = cs.length ? cs.map(function (c) {
      return '<div class="bd-comment' + (c.official ? " official" : "") + '">'
        + '<div class="bd-c-top"><span class="bd-c-name">' + esc(c.name) + (c.official ? '<span class="bd-badge">변호사사무실</span>' : "") + "</span>"
        + '<span class="bd-c-date">' + fmt(c.ts) + "</span></div>"
        + '<div class="bd-c-body">' + nl2br(c.body) + "</div></div>";
    }).join("") : '<div class="bd-empty" style="padding:24px;">첫 댓글을 남겨보세요.</div>';
    board.innerHTML =
      '<button class="bd-back" data-act="back">← 목록으로</button>'
      + '<article class="bd-post"><h2 class="bd-post-title">' + esc(p.title) + "</h2>"
      + '<div class="bd-post-meta"><span>' + esc(p.name) + "</span><span>" + fmt(p.ts) + "</span></div>"
      + '<div class="bd-post-body">' + nl2br(p.body) + "</div></article>"
      + '<div class="bd-comments"><h3 class="bd-c-h">댓글 ' + cs.length + "</h3>" + comments + "</div>"
      + '<div class="bd-cform"><div class="field"><input id="c-name" maxlength="20" placeholder="닉네임"></div>'
      + '<div class="field"><textarea id="c-body" rows="3" placeholder="댓글을 남겨주세요"></textarea></div>'
      + '<label class="bd-official-opt"><input type="checkbox" id="c-official"> 변호사사무실 답변으로 등록</label>'
      + '<div class="bd-actions"><button class="btn btn--gold" data-act="comment">댓글 등록</button></div></div>';
  }

  /* ── 이벤트 ── */
  var busy = false;
  board.addEventListener("click", async function (e) {
    var open = e.target.closest("[data-open]");
    if (open) { view.mode = "detail"; view.id = open.getAttribute("data-open"); render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var act = e.target.closest("[data-act]"); if (!act || busy) return;
    var a = act.getAttribute("data-act");
    if (a === "write") { view.mode = "write"; render(); }
    else if (a === "cancel" || a === "back") { view.mode = "list"; render(); }
    else if (a === "submit") {
      var title = val("#w-title"), body = val("#w-body");
      if (!title) { alert("제목을 입력해주세요."); return; }
      if (!body) { alert("내용을 입력해주세요."); return; }
      busy = true; await addPost(val("#w-name"), title, body); busy = false;
      view.mode = "list"; render();
    }
    else if (a === "comment") {
      var cb = val("#c-body"); if (!cb) { alert("댓글 내용을 입력해주세요."); return; }
      var off = $("#c-official") && $("#c-official").checked;
      busy = true; var ok = await addComment(view.id, val("#c-name"), cb, off); busy = false;
      if (ok !== false) render();
    }
  });

  render();
})();
