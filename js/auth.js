/* ════════════════════════════════════════════════════════════
   auth.js — Google 로그인 래퍼 (Google Identity Services / GIS)
   window.AuthGoogle 노출.
   · GOOGLE_CLIENT_ID 설정 시  → 실제 구글 로그인(GIS)
   · 미설정(빈 문자열) 또는 GIS 미로드 시 → 이름 입력 폴백
   외부 라이브러리 금지(GIS 스크립트만 허용), 순수 바닐라 JS.
   ════════════════════════════════════════════════════════════ */
(function () {
  /* ★ 사장님: Google Cloud Console에서 발급한 OAuth 2.0 Client ID(웹)를 아래 따옴표 안에 붙여넣으세요.
     빈 문자열이면 이름 입력 폴백으로 동작합니다. 자세한 방법은 GOOGLE-LOGIN-SETUP.md 참고. */
  var GOOGLE_CLIENT_ID = "";

  var STORE = "glo-user";

  /* ── i18n helper (board.js와 동일 구조) ── */
  function tr(k) {
    var code = window.getLang ? window.getLang() : "ko";
    var dict = (window.I18N && window.I18N[code]) || {};
    var en = (window.I18N && window.I18N.en) || {};
    var ko = (window.I18N && window.I18N.ko) || {};
    return dict[k] || en[k] || ko[k] || k;
  }
  function lang() { return window.getLang ? window.getLang() : "ko"; }

  /* ── localStorage ── */
  function getUser() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (!u || !u.name) return null;
      return u;
    } catch (e) { return null; }
  }
  function setUser(u) {
    try { localStorage.setItem(STORE, JSON.stringify(u)); } catch (e) {}
  }
  function signOut() {
    try { localStorage.removeItem(STORE); } catch (e) {}
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
  }

  /* ── JWT(credential) base64url 디코드 → payload ── */
  function decodeJwt(token) {
    try {
      var part = token.split(".")[1];
      var b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      var pad = b64.length % 4;
      if (pad) b64 += "====".slice(pad);
      var json = decodeURIComponent(
        atob(b64).split("").map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        }).join("")
      );
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function gisReady() {
    return !!(window.google && google.accounts && google.accounts.id);
  }

  /* ── 모달 ── (close(result)는 사용자가 닫았는지/콜백이 닫았는지 구분) */
  function buildModal(onUserCancel) {
    var back = document.createElement("div");
    back.className = "auth-modal";
    back.innerHTML =
      '<div class="auth-card" role="dialog" aria-modal="true">'
      + '<button class="auth-close" aria-label="' + esc(tr("auth.cancel")) + '">&times;</button>'
      + '<h3 class="auth-title">' + esc(tr("auth.modalTitle")) + "</h3>"
      + '<p class="auth-desc">' + esc(tr("auth.modalDesc")) + "</p>"
      + '<div class="auth-body"></div>'
      + '<div class="auth-foot"><button class="btn btn--ghost auth-cancel">' + esc(tr("auth.cancel")) + "</button></div>"
      + "</div>";
    document.body.appendChild(back);

    var closed = false;
    // close(true) = 사용자가 취소(ESC/바깥/취소버튼). close(false) = 코드가 정리 목적으로 닫음.
    function close(byUser) {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      if (back.parentNode) back.parentNode.removeChild(back);
      if (byUser && typeof onUserCancel === "function") onUserCancel();
    }
    function onKey(e) { if (e.key === "Escape") close(true); }
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", function (e) { if (e.target === back) close(true); });
    back.querySelector(".auth-close").addEventListener("click", function () { close(true); });
    back.querySelector(".auth-cancel").addEventListener("click", function () { close(true); });

    return { el: back, body: back.querySelector(".auth-body"), close: close };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── 폴백: 이름 입력 prompt ── */
  function fallbackSignIn(modal, done) {
    var name = "";
    try { name = window.prompt(tr("auth.namePrompt"), ""); } catch (e) { name = null; }
    if (name == null) { done(null); return; }
    name = String(name).trim();
    if (!name) { done(null); return; }
    var u = { name: name, email: "", picture: "", idToken: "" };
    setUser(u);
    done(u);
  }

  /* ── 실제 GIS 로그인 ── */
  function gisSignIn(modal, done) {
    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: function (resp) {
          var payload = decodeJwt(resp && resp.credential);
          if (!payload) { done(null); return; }
          var u = {
            name: payload.name || payload.email || tr("board.anonymous"),
            email: payload.email || "",
            picture: payload.picture || "",
            idToken: (resp && resp.credential) || ""
          };
          setUser(u);
          done(u);
        }
      });

      var slot = document.createElement("div");
      slot.className = "auth-gbtn";
      modal.body.appendChild(slot);
      google.accounts.id.renderButton(slot, {
        theme: "outline", size: "large", type: "standard",
        text: "continue_with", shape: "pill", logo_alignment: "left",
        width: 280, locale: lang()
      });
      // 원탭 프롬프트도 함께 시도(현재 언어).
      try { google.accounts.id.prompt(); } catch (e) {}
    } catch (e) {
      // GIS 초기화 실패 시 폴백.
      fallbackSignIn(modal, done);
    }
  }

  /* ── signIn(): Promise<user|null> ── */
  function signIn() {
    return new Promise(function (resolve) {
      var settled = false;
      // 로그인 성공/폴백 완료 시: 모달 정리(byUser=false) 후 resolve.
      function done(u) {
        if (settled) return;
        settled = true;
        modal.close(false);
        resolve(u);
      }
      // 사용자가 모달을 닫으면(취소): null resolve.
      function onUserCancel() {
        if (settled) return;
        settled = true;
        resolve(null);
      }

      var modal = buildModal(onUserCancel);

      if (!!GOOGLE_CLIENT_ID && gisReady()) {
        gisSignIn(modal, done);
      } else {
        fallbackSignIn(modal, done);
      }
    });
  }

  window.AuthGoogle = {
    getUser: getUser,
    signIn: signIn,
    signOut: signOut,
    isConfigured: function () { return !!GOOGLE_CLIENT_ID; }
  };
})();
