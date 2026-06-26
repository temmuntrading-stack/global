/* ════════════════════════════════════════════════════════════
   home-cases.js — 홈 "성공 사례" 슬라이더에
   관리자가 작성한 성공 사례(블로그) 글을 노출한다.
   · 현재 언어에 해당하는 글이 있으면 슬라이더를 그 글들로 채운다
   · 글이 없거나 API 미연결이면 섹션 전체를 숨긴다
     (옛 하드코딩 카드를 다시 보여주지 않음 — 로딩 중엔 스켈레톤만)
   · 언어 변경(langchange) 시 다시 불러온다
   site.css 의 .mag-card / .g1~g4 / .mag-card--img 스타일을 재사용.
   ════════════════════════════════════════════════════════════ */
(function () {
  var track = document.querySelector(".mag-track");
  if (!track) return;
  var section = track.closest("section");

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function tr(k, dflt) {
    var code = window.getLang ? window.getLang() : "ko";
    var dict = (window.I18N && window.I18N[code]) || {};
    var en = (window.I18N && window.I18N.en) || {};
    var ko = (window.I18N && window.I18N.ko) || {};
    return dict[k] || en[k] || ko[k] || dflt || k;
  }

  function showSection() { if (section) section.style.display = ""; }
  function hideSection() { if (section) section.style.display = "none"; }

  function build(posts) {
    var grad = ["g1", "g2", "g3", "g4"];
    var catDflt = tr("blog.cat", "성공 사례");
    track.innerHTML = posts.slice(0, 8).map(function (p, i) {
      var n = (i + 1 < 10 ? "0" : "") + (i + 1);
      var hasImg = !!p.image;
      var cls = "mag-card" + (hasImg ? " mag-card--img" : " " + grad[i % 4]);
      var style = hasImg ? ' style="background-image:url(' + esc(p.image) + ')"' : "";
      return '<a class="' + cls + '"' + style + ' href="blog.html?id=' + encodeURIComponent(p.id) + '">'
        + '<span class="mag-scrim" aria-hidden="true"></span>'
        + '<div class="mag-body">'
        + '<span class="mag-cat">' + esc(p.cat || catDflt) + "</span>"
        + '<h3 class="mag-title">' + esc(p.title) + "</h3>"
        + (p.excerpt ? '<p class="mag-desc">' + esc(p.excerpt) + "</p>" : "")
        + "</div>"
        + '<span class="mag-num">' + n + "</span></a>";
    }).join("");
    showSection();
  }

  function load() {
    var lang = window.getLang ? window.getLang() : "ko";
    fetch("/api/blog?lang=" + encodeURIComponent(lang), { headers: { accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("api"); return r.json(); })
      .then(function (d) {
        var posts = (d && d.posts) || [];
        if (posts.length) build(posts);
        else hideSection(); // 해당 언어에 성공 사례가 없으면 섹션 숨김
      })
      .catch(function () { hideSection(); }); // API 미연결/실패 → 섹션 숨김
  }

  load();
  document.addEventListener("langchange", load);
})();
