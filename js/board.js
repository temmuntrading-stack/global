/* Board page: public community posts backed by /api/board. */
(function () {
  var API = "/api/board";
  var board = document.getElementById("board");
  if (!board) return;

  var PENCIL = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var view = { mode: "list", id: null };
  var busy = false;

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function val(s) { var el = $(s); return el ? el.value.trim() : ""; }
  function fmt(ts) {
    var d = new Date(ts);
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function tr(k) {
    var code = window.getLang ? window.getLang() : "ko";
    var dict = (window.I18N && window.I18N[code]) || {};
    var en = (window.I18N && window.I18N.en) || {};
    var ko = (window.I18N && window.I18N.ko) || {};
    return dict[k] || en[k] || ko[k] || k;
  }
  function errorMessage(err, fallbackKey) {
    if (err && err.message) return err.message;
    return tr(fallbackKey || "board.error");
  }

  async function request(path, options) {
    var r = await fetch(path, options || { headers: { accept: "application/json" } });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || tr("board.error"));
    return data;
  }
  async function listPosts() {
    var data = await request(API, { headers: { accept: "application/json" } });
    return data.posts || [];
  }
  async function getPost(id) {
    return request(API + "?id=" + encodeURIComponent(id), { headers: { accept: "application/json" } });
  }
  async function addPost(name, title, body, idToken) {
    await request(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "post", name: name || tr("board.anonymous"), title: title, body: body, idToken: idToken || "" })
    });
  }
  async function addComment(postId, name, body, idToken) {
    await request(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "comment", postId: postId, name: name || tr("board.anonymous"), body: body, idToken: idToken || "" })
    });
  }

  /* ── 로그인 헬퍼 ── */
  function currentUser() {
    return (window.AuthGoogle && AuthGoogle.getUser()) || null;
  }
  // 로그인 보장: 이미 로그인돼 있으면 그 user, 아니면 signIn 모달. 취소 시 null.
  async function ensureUser() {
    var u = currentUser();
    if (u) return u;
    if (!window.AuthGoogle) return null;
    u = await AuthGoogle.signIn();
    return u || null;
  }

  // 로그인 상태 표시줄 (항상 노출 — 로그인 시 이름+로그아웃, 비로그인 시 로그인 버튼).
  function loginBar() {
    var u = currentUser();
    if (u) {
      return '<div class="bd-auth"><span class="bd-auth-who">' + esc(tr("auth.loggedInAs"))
        + ' <b>' + esc(u.name) + "</b></span>"
        + '<button class="bd-auth-out" data-act="logout">' + esc(tr("auth.logout")) + "</button></div>";
    }
    return '<div class="bd-auth"><span class="bd-auth-who">' + esc(tr("auth.guest")) + "</span>"
      + '<button class="btn btn--gold bd-auth-in" data-act="login">' + esc(tr("auth.login")) + "</button></div>";
  }

  async function render() {
    if (view.mode === "detail") return renderDetail();
    if (view.mode === "write") return renderWrite();
    return renderList();
  }

  async function renderList() {
    // 헤더(로그인 바 + 글쓰기)는 목록 로딩 성공/실패와 무관하게 항상 표시한다.
    board.innerHTML =
      loginBar()
      + '<div class="bd-head"><div class="bd-note">' + esc(tr("board.note")) + "</div>"
      + '<button class="btn btn--gold" data-act="write">' + PENCIL + " " + esc(tr("board.write")) + "</button></div>"
      + '<div class="bd-list"><div class="bd-empty">' + esc(tr("board.loading")) + "</div></div>";
    var list = board.querySelector(".bd-list");
    try {
      var posts = await listPosts();
      var rows = posts.map(function (p) {
        return '<button class="bd-row" data-open="' + esc(p.id) + '">'
          + '<div class="bd-row-main"><span class="bd-row-title">' + esc(p.title) + "</span>"
          + (p.commentCount ? '<span class="bd-cc">' + p.commentCount + "</span>" : "")
          + (p.answered ? '<span class="bd-answered">' + esc(tr("board.answered")) + "</span>" : "")
          + "</div>"
          + '<div class="bd-row-meta"><span>' + esc(p.name) + "</span><span>" + fmt(p.ts) + "</span></div></button>";
      }).join("");
      if (list) list.innerHTML = rows || '<div class="bd-empty">' + esc(tr("board.empty")) + "</div>";
    } catch (err) {
      if (list) list.innerHTML = '<div class="bd-empty">' + esc(errorMessage(err, "board.error")) + "</div>";
    }
  }

  function renderWrite() {
    var u = currentUser();
    var who = u ? u.name : "";
    board.innerHTML =
      '<button class="bd-back" data-act="back">' + esc(tr("board.back")) + "</button>"
      + '<div class="bd-form-wrap"><h3 class="bd-form-title">' + esc(tr("board.write")) + "</h3>"
      + '<div class="field"><label>' + esc(tr("board.name")) + '</label><input id="w-name" value="' + esc(who) + '" readonly></div>'
      + '<div class="field"><label>' + esc(tr("board.postTitle")) + '</label><input id="w-title" maxlength="80" placeholder="' + esc(tr("board.titlePh")) + '"></div>'
      + '<div class="field"><label>' + esc(tr("board.body")) + '</label><textarea id="w-body" rows="7" placeholder="' + esc(tr("board.bodyPh")) + '"></textarea></div>'
      + '<div class="bd-actions"><button class="btn btn--ghost" data-act="cancel">' + esc(tr("board.cancel")) + '</button><button class="btn btn--gold" data-act="submit">' + esc(tr("board.submit")) + "</button></div></div>";
  }

  async function renderDetail() {
    board.innerHTML = '<div class="bd-empty">' + esc(tr("board.loading")) + "</div>";
    try {
      var d = await getPost(view.id);
      var p = d.post, cs = d.comments || [];
      var comments = cs.length ? cs.map(function (c) {
        return '<div class="bd-comment' + (c.official ? " official" : "") + '">'
          + '<div class="bd-c-top"><span class="bd-c-name">' + esc(c.official ? tr("board.officialName") : c.name) + (c.official ? '<span class="bd-badge">' + esc(tr("board.official")) + "</span>" : "") + "</span>"
          + '<span class="bd-c-date">' + fmt(c.ts) + "</span></div>"
          + '<div class="bd-c-body">' + nl2br(c.body) + "</div></div>";
      }).join("") : '<div class="bd-empty" style="padding:24px;">' + esc(tr("board.commentEmpty")) + "</div>";
      board.innerHTML =
        '<button class="bd-back" data-act="back">' + esc(tr("board.back")) + "</button>"
        + '<article class="bd-post"><h2 class="bd-post-title">' + esc(p.title) + "</h2>"
        + '<div class="bd-post-meta"><span>' + esc(p.name) + "</span><span>" + fmt(p.ts) + "</span></div>"
        + '<div class="bd-post-body">' + nl2br(p.body) + "</div></article>"
        + '<div class="bd-comments"><h3 class="bd-c-h">' + esc(tr("board.comments")) + " " + cs.length + "</h3>" + comments + "</div>"
        + '<div class="bd-cform"><div class="field"><textarea id="c-body" rows="3" placeholder="' + esc(tr("board.commentPh")) + '"></textarea></div>'
        + '<div class="bd-actions"><button class="btn btn--gold" data-act="comment">' + esc(tr("board.commentSubmit")) + "</button></div></div>";
    } catch (err) {
      board.innerHTML = '<button class="bd-back" data-act="back">' + esc(tr("board.back")) + '</button><div class="bd-empty">' + esc(errorMessage(err, "board.error")) + "</div>";
    }
  }

  board.addEventListener("click", async function (e) {
    var open = e.target.closest("[data-open]");
    if (open) {
      view.mode = "detail";
      view.id = open.getAttribute("data-open");
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    var act = e.target.closest("[data-act]");
    if (!act || busy) return;
    var a = act.getAttribute("data-act");
    if (a === "write") {
      // 글쓰기는 로그인 필요 → 모달 후 폼 표시.
      var wu = await ensureUser();
      if (!wu) return;
      view.mode = "write";
    }
    else if (a === "login") {
      // 로그인/회원가입 버튼 → 구글 로그인 모달.
      await ensureUser();
    }
    else if (a === "cancel" || a === "back") view.mode = "list";
    else if (a === "logout") {
      if (window.AuthGoogle) AuthGoogle.signOut();
    }
    else if (a === "submit") {
      var u = currentUser();
      if (!u) { u = await ensureUser(); if (!u) return; render(); return; }
      var title = val("#w-title"), body = val("#w-body");
      if (!title) { alert(tr("board.needTitle")); return; }
      if (!body) { alert(tr("board.needBody")); return; }
      busy = true;
      try {
        await addPost(u.name, title, body, u.idToken);
        view.mode = "list";
      } catch (err) {
        alert(errorMessage(err, "board.saveError"));
      } finally {
        busy = false;
      }
    } else if (a === "comment") {
      var cb = val("#c-body");
      if (!cb) { alert(tr("board.needComment")); return; }
      // 댓글도 로그인 필요.
      var cu = await ensureUser();
      if (!cu) return;
      busy = true;
      try {
        await addComment(view.id, cu.name, cb, cu.idToken);
      } catch (err) {
        alert(errorMessage(err, "board.commentError"));
      } finally {
        busy = false;
      }
    }
    render();
  });

  document.addEventListener("langchange", render);
  render();
})();
