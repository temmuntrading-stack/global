/* ════════════════════════════════════════════════════════════
   home-cases.js — 홈 "언어가 장벽이 되지 않도록" 슬라이더에
   관리자가 작성한 성공 사례(블로그) 글을 노출한다.
   · /api/blog 에 글이 있으면 슬라이더를 그 글들로 교체
   · 글이 없거나 API 미연결이면 기존 정적 카드를 그대로 둔다(폴백)
   site.css 의 .mag-card / .g1~g4 스타일을 재사용.
   ════════════════════════════════════════════════════════════ */
(function () {
  var track = document.querySelector(".mag-track");
  if (!track) return;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function tr(k, dflt) {
    var code = window.getLang ? window.getLang() : "ko";
    var dict = (window.I18N && window.I18N[code]) || {};
    var en = (window.I18N && window.I18N.en) || {};
    var ko = (window.I18N && window.I18N.ko) || {};
    return dict[k] || en[k] || ko[k] || dflt || k;
  }

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
  }

  fetch("/api/blog", { headers: { accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("api"); return r.json(); })
    .then(function (d) {
      var posts = (d && d.posts) || [];
      if (posts.length) build(posts); // 글 없으면 정적 카드 유지
    })
    .catch(function () { /* API 미연결/실패 → 정적 카드 유지 */ });
})();
