/* ════════════════════════════════════════════════════════════
   blog.js — 블로그 (법률 정보 · 사무소 소식)
   · 배포 환경(Cloudflare Pages + D1): /api/blog 를 통해 공개 글 목록/상세
   · API가 없으면(로컬 미리보기 등) 자동으로 "데모 모드"(이 브라우저 localStorage)로 전환
   ════════════════════════════════════════════════════════════ */
(function () {
  var API = "/api/blog";
  var LKEY = "glo-blog-v1"; // 데모 모드 저장소
  var blog = document.getElementById("blog");
  if (!blog) return;

  var mode = "api"; // 'api' | 'local'
  var view = { mode: "list", id: null };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function nl2br(s) { return esc(s).replace(/\n/g, "<br>"); }
  function uid() { return "b" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function fmt(ts) { var d = new Date(ts); function p(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()); }

  /* ── 데모(로컬) 저장소 ── */
  function lLoad() { try { return JSON.parse(localStorage.getItem(LKEY)); } catch (e) { return null; } }
  function lSave(p) { try { localStorage.setItem(LKEY, JSON.stringify(p)); } catch (e) {} }
  function lSeed() {
    var n = Date.now();
    return [
      { id: uid(), cat: "칼럼", title: "외국인 근로자가 꼭 알아야 할 산업재해 보상 절차",
        excerpt: "일하다 다쳤을 때 회사 동의 없이도 산재 신청이 가능합니다. 신청 자격부터 필요한 서류, 보상 범위까지 핵심만 정리했습니다.",
        body: "일을 하다 다치거나 병을 얻으면 누구나 당황하게 됩니다. 특히 한국어가 익숙하지 않거나 절차를 잘 모르는 외국인 근로자분들은 \"내가 산재 신청을 할 수 있을까?\" 막막해하시는 경우가 많습니다.\n\n결론부터 말씀드리면, 산업재해 보상은 근로자의 법적 권리입니다. 회사의 동의나 협조가 없어도 근로복지공단에 직접 신청할 수 있습니다. 체류 자격이나 비자 종류와 관계없이, 실제로 근로를 제공했다면 보호받을 수 있습니다.\n\n[신청 전 준비할 것]\n· 사고 경위를 적은 메모(언제·어디서·어떻게 다쳤는지)\n· 병원 진료기록과 진단서\n· 근무 사실을 보여줄 수 있는 자료(급여 내역, 출퇴근 기록 등)\n\n[보상 범위]\n치료비(요양급여)뿐 아니라 일을 못 한 기간의 임금(휴업급여), 장해가 남았을 때의 장해급여 등이 포함됩니다.\n\n혼자 진행하기 어렵다면 무료 상담을 이용해 주세요. 저희는 10개 언어로 상담을 지원합니다.",
        ts: n - 36e5 * 24 * 6 },
      { id: uid(), cat: "소식", title: "글로벌 법률사무소, 다국어 무료 법률 상담 확대 안내",
        excerpt: "더 많은 분들이 언어 장벽 없이 법률 도움을 받으실 수 있도록 무료 상담 운영 시간과 지원 언어를 확대했습니다.",
        body: "안녕하세요, 글로벌 법률사무소입니다.\n\n그동안 많은 분들께서 \"상담을 받고 싶어도 한국어가 어려워 망설였다\"는 말씀을 전해 주셨습니다. 저희는 언어 때문에 정당한 권리를 포기하는 일이 없어야 한다고 믿습니다.\n\n이에 무료 법률 상담을 다음과 같이 확대합니다.\n\n· 지원 언어: 한국어를 포함해 영어, 베트남어, 러시아어, 중국어 등 총 10개 언어\n· 상담 분야: 산업재해·체불임금, 비자·체류, 불법체류·출국명령, 난민 신청, 민사·형사 등\n· 비용: 1차 상담 무료\n\n전화(02-2277-2442) 또는 온라인 문의로 편하게 연락 주세요. 작은 고민이라도 함께 살펴 드리겠습니다.\n\n앞으로도 이주민과 외국인 여러분 곁에서 든든한 법률 동반자가 되겠습니다. 감사합니다.",
        ts: n - 36e5 * 24 * 2 },
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
      .map(function (p) { return { id: p.id, title: p.title, cat: p.cat, excerpt: p.excerpt, ts: p.ts }; });
  }
  async function getPost(id) {
    if (mode === "api") {
      try { return (await apiGet("?id=" + encodeURIComponent(id))).post; } catch (e) { mode = "local"; }
    }
    var p = lEnsure().filter(function (x) { return x.id === id; })[0];
    return p ? { id: p.id, title: p.title, cat: p.cat, body: p.body, ts: p.ts } : null;
  }

  function demoNote() {
    return mode === "local"
      ? '<div class="bd-demo">※ 데모 모드 — 예시 글이 표시됩니다. Cloudflare 배포 후에는 실제 블로그 글이 노출됩니다.</div>'
      : "";
  }

  /* ── 렌더 ── */
  function render() {
    if (view.mode === "detail") return renderDetail();
    return renderList();
  }

  async function renderList() {
    blog.innerHTML = '<div class="bd-empty">불러오는 중…</div>';
    var posts = await listPosts();
    var rows = posts.map(function (p) {
      return '<button class="bd-row" data-open="' + p.id + '">'
        + '<div class="bd-row-main">'
        + (p.cat ? '<span class="bd-answered">' + esc(p.cat) + "</span>" : "")
        + '<span class="bd-row-title">' + esc(p.title) + "</span></div>"
        + (p.excerpt ? '<div class="bd-c-body" style="color:var(--muted);">' + esc(p.excerpt) + "</div>" : "")
        + '<div class="bd-row-meta"><span>' + fmt(p.ts) + "</span></div></button>";
    }).join("");
    blog.innerHTML = demoNote()
      + '<div class="bd-head"><div class="bd-note">실제 상담과 해결 경험에서 나온 <b>성공 사례</b>를 전해 드립니다.</div></div>'
      + '<div class="bd-list">' + (rows || '<div class="bd-empty">아직 등록된 글이 없습니다.</div>') + "</div>";
  }

  async function renderDetail() {
    blog.innerHTML = '<div class="bd-empty">불러오는 중…</div>';
    var p = await getPost(view.id);
    if (!p) { view.mode = "list"; return render(); }
    blog.innerHTML =
      '<button class="bd-back" data-act="back">← 목록</button>'
      + '<article class="bd-post"><h2 class="bd-post-title">' + esc(p.title) + "</h2>"
      + '<div class="bd-post-meta">'
      + (p.cat ? "<span>" + esc(p.cat) + "</span>" : "")
      + "<span>" + fmt(p.ts) + "</span></div>"
      + '<div class="bd-post-body">' + nl2br(p.body) + "</div></article>";
  }

  /* ── 이벤트 ── */
  blog.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) { view.mode = "detail"; view.id = open.getAttribute("data-open"); render(); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var act = e.target.closest("[data-act]"); if (!act) return;
    if (act.getAttribute("data-act") === "back") { view.mode = "list"; render(); }
  });

  // URL ?id=… 로 진입하면 해당 글 상세를 바로 연다(홈 성공사례 카드 딥링크).
  try {
    var qid = new URLSearchParams(location.search).get("id");
    if (qid) { view.mode = "detail"; view.id = qid; }
  } catch (e) {}

  render();
})();
