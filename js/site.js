/* ════════════════════════════════════════════════════════════
   site.js — chrome injection, language switcher, motion
   ════════════════════════════════════════════════════════════ */
(function(){
  var BLOG = "https://blog.naver.com/lawsqare";
  var NAV = [
    { key:"home",      href:"index.html",    i:"nav.home" },
    { key:"about",     href:"about.html",     i:"nav.about" },
    { key:"practice",  href:"practice.html",  i:"nav.practice" },
    { key:"resources", href:"resources.html", i:"nav.resources" },
    { key:"blog",      href:"blog.html", i:"nav.blog" },
    { key:"contact",   href:"contact.html",   i:"nav.contact" },
  ];
  /* 업무분야 10개 카테고리 → 페이지 매핑 (ncat.1 … ncat.10) */
  var NCAT_HREF = [
    "civil.html",                /* 1 민사소송 */
    "criminal.html",             /* 2 형사소송 */
    "divorce.html",              /* 3 가사소송 */
    "administrative.html",       /* 4 행정소송 */
    "traffic-accident.html",     /* 5 교통사고 및 형사합의 */
    "industrial-accident.html",  /* 6 산업재해·체불임금 */
    "visa-invitation.html",      /* 7 체류 VISA 연장·변경 */
    "immigration-overstay.html", /* 8 출국명령·체류자격 변경불허 */
    "admin-appeal.html",         /* 9 행정심판·처분 구제 */
    "investment-visa.html"       /* 10 D-8 기업투자 비자 */
  ];
  var page = document.body.getAttribute("data-page") || "home";

  function navLinks(mobile){
    return NAV.map(function(n, idx){
      var active = n.key === page ? " active" : "";
      var ext = n.ext ? ' target="_blank" rel="noopener"' : "";
      if(mobile){
        if(n.key === "practice"){
          var msub = "";
          for(var j = 1; j <= 10; j++){ var hj = NCAT_HREF[j-1] || "practice.html"; msub += '<a href="'+hj+'" data-i18n="ncat.'+j+'"></a>'; }
          msub += '<a href="practice.html" class="more" data-i18n="home.cat.more"></a>';
          return '<div class="m-acc">'
            + '<button class="m-acc-btn" type="button" aria-expanded="false">'
              + '<span data-i18n="'+n.i+'"></span>'
              + '<span class="m-acc-r"><span class="idx">0'+(idx+1)+'</span>'+CHEV+'</span></button>'
            + '<div class="m-sub"><div class="m-sub-in">'+msub+'</div></div></div>';
        }
        return '<a href="'+n.href+'"'+ext+'><span data-i18n="'+n.i+'"></span>'
          + '<span class="idx">0'+(idx+1)+'</span></a>';
      }
      var sub = "";
      if(n.key === "practice"){
        var items = "";
        for(var i = 1; i <= 10; i++){ var h = NCAT_HREF[i-1] || "practice.html"; items += '<a href="'+h+'" data-i18n="ncat.'+i+'"></a>'; }
        sub = '<div class="nav-sub">' + items
          + '<a href="practice.html" class="more" data-i18n="home.cat.more"></a></div>';
      }
      return '<div class="nav-item'+(sub ? ' has-sub' : '')+'">'
        + '<a href="'+n.href+'" class="navlink'+active+'"'+ext+'>'
        + '<span data-i18n="'+n.i+'"></span><span class="dot"></span></a>'
        + sub + '</div>';
    }).join("");
  }

  var CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  var GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><path d="M12 2.5c3 3.4 3 15.6 0 19M12 2.5c-3 3.4-3 15.6 0 19"/><path d="M4.2 6.6c2.3 1.3 13.3 1.3 15.6 0M4.2 17.4c2.3-1.3 13.3-1.3 15.6 0"/></svg>';

  function flagImg(l, id){
    var idAttr = id ? ' id="'+id+'"' : '';
    return '<img class="flag-img"'+idAttr+' src="https://flagcdn.com/w40/'+l.cc+'.png" srcset="https://flagcdn.com/w80/'+l.cc+'.png 2x" alt="'+l.label+'" width="22" height="16" loading="lazy">';
  }

  function langSwitcher(){
    var opts = window.LANGS.map(function(l){
      return '<button class="lang-opt" data-lang="'+l.code+'">'
        + flagImg(l) + '<span>'+l.label+'</span>'
        + '<span class="native">'+l.native+'</span></button>';
    }).join("");
    return '<div class="lang" id="lang">'
      + '<button class="lang-btn" id="langBtn" aria-label="Language">'
        + flagImg(window.LANGS[0],'langFlag')+'<span class="code" id="langCode">KO</span>'+CHEV+'</button>'
      + '<div class="lang-menu" role="menu">'+opts+'</div></div>';
  }

  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

  /* ── header (lawtalk-style: logo + search row, menu row) ── */
  var head = document.getElementById("site-head");
  if(head){
    head.className = "site-head";
    head.innerHTML =
      '<div class="head-top"><div class="head-inner">'
        + '<a class="brand" href="index.html" aria-label="Home">'
          + '<span class="brand-mark">'+GLOBE+'</span>'
          + '<span class="brand-ko" data-i18n="brand.name"></span></a>'
        + '<form class="head-search" role="search" onsubmit="event.preventDefault();window.location.href=\'practice.html\';">'
          + SEARCH + '<input type="search" data-i18n-ph="home.searchTitle" aria-label="search">'
        + '</form>'
        + '<div class="head-actions">'+langSwitcher()
          + '<a class="login-btn" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20a7 7 0 0114 0"/></svg><span data-i18n="nav.login"></span></a>'
          + '<button class="burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>'
        + '</div>'
      + '</div></div>'
      + '<nav class="head-nav"><div class="head-inner"><div class="nav">'+navLinks(false)+'</div></div></nav>';
  }

  /* ── mobile drawer ── */
  var drawer = document.createElement("div");
  drawer.className = "drawer";
  drawer.innerHTML = '<nav>'+navLinks(true)+'</nav>'
    + '<div class="drawer-foot">'
      + '<span class="num" data-set="phone">02 2277 2442</span>'
      + '<span data-set="email">lawsqare@naver.com</span>'
      + '<span data-i18n="ci.addr.v" data-set="address"></span></div>';
  document.body.appendChild(drawer);

  /* ── mobile drawer: accordion submenus ── */
  drawer.querySelectorAll(".m-acc-btn").forEach(function(btn){
    btn.addEventListener("click", function(){
      var acc = btn.parentNode;
      var open = acc.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  /* ── footer ── */
  var foot = document.getElementById("site-foot");
  if(foot){
    foot.className = "site-foot";
    foot.innerHTML =
      '<div class="wrap"><div class="foot-top">'
      + '<div class="foot-brand">'
        + '<a class="brand" href="index.html"><span class="brand-mark">'+GLOBE+'</span>'
        + '<span class="brand-ko" data-i18n="brand.name"></span></a>'
        + '<p data-i18n="foot.tag"></p></div>'
      + '<div class="foot-col"><h4 data-i18n="foot.menu"></h4><ul>'
        + '<li><a href="about.html" data-i18n="nav.about"></a></li>'
        + '<li><a href="practice.html" data-i18n="nav.practice"></a></li>'
        + '<li><a href="resources.html" data-i18n="nav.resources"></a></li>'
        + '<li><a href="blog.html" data-i18n="nav.blog"></a></li>'
        + '<li><a href="contact.html" data-i18n="nav.contact"></a></li></ul></div>'
      + '<div class="foot-col"><h4 data-i18n="foot.contact"></h4><ul>'
        + '<li><a href="tel:+82222772442" class="num" data-set="phone" data-set-tel>02 2277 2442</a></li>'
        + '<li><a href="mailto:lawsqare@naver.com" data-set="email" data-set-mail>lawsqare@naver.com</a></li>'
        + '<li data-i18n="ci.addr.v" data-set="address"></li>'
        + '<li data-i18n="ci.hours.v" data-set="hours"></li></ul></div>'
      + '</div>'
      + '<div class="foot-bar"><span data-i18n="foot.rights"></span>'
        + '<span class="foot-legal"><a href="privacy.html" data-i18n="foot.privacy"></a><span aria-hidden="true"> · </span><a href="terms.html" data-i18n="foot.terms"></a></span>'
        + '<span data-i18n="foot.disclaimer"></span></div></div>';
  }

  /* ── floating quick menu (consult / online inquiry) ── */
  var fab = document.createElement("div");
  fab.className = "quickfab";
  fab.innerHTML =
    '<a class="qf-primary" href="contact.html">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>'
      + '<span data-i18n="home.qa1.t"></span></a>'
    + '<a class="qf-secondary" href="contact.html">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8 9 9 0 01-4-1L3 20l1.5-4.5a8.4 8.4 0 01-1-4A8.5 8.5 0 0121 11.5z"/><path d="M9 11h6M9 14h4"/></svg>'
      + '<span data-i18n="home.qa2.t"></span></a>';
  document.body.appendChild(fab);

  /* ── mobile bottom tab bar (app-style: 홈 / 업무분야 / 자료실 / 상담 / 메뉴) ── */
  var page = document.body.getAttribute("data-page") || "";
  var mtabs = [
    { href:"index.html",    i:"mtab.home",      act:["home"],
      svg:'<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9.5h12V10"/><path d="M10 19.5v-5h4v5"/>' },
    { href:"practice.html", i:"mtab.practice",  act:["practice"],
      svg:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 12h18"/>' },
    { href:"resources.html",i:"mtab.resources", act:["resources"],
      svg:'<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>' },
    { href:"contact.html",  i:"mtab.consult",   act:["contact"],
      svg:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8 9 9 0 0 1-4-1L3 20l1.5-4.5a8.4 8.4 0 0 1-1-4A8.5 8.5 0 0 1 21 11.5z"/><path d="M9 11h6M9 14h4"/>' },
    { href:"#menu",         i:"mtab.menu",      act:["about"], menu:true,
      svg:'<path d="M4 7h16M4 12h16M4 17h16"/>' }
  ];
  var mtab = document.createElement("nav");
  mtab.className = "mtabbar";
  mtab.setAttribute("aria-label", "모바일 메뉴");
  mtab.innerHTML = mtabs.map(function(t){
    var on = t.act.indexOf(page) > -1 ? " is-active" : "";
    return '<a class="mtab'+on+'" href="'+t.href+'"'+(t.menu ? ' data-menu="1"' : '')+'>'
      + '<span class="mt-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+t.svg+'</svg></span>'
      + '<span class="mt-l" data-i18n="'+t.i+'"></span></a>';
  }).join("");
  document.body.appendChild(mtab);

  /* 메뉴 탭 → 드로어 열기 */
  var menuTab = mtab.querySelector("[data-menu]");
  if(menuTab){
    menuTab.addEventListener("click", function(e){ e.preventDefault(); document.body.classList.toggle("menu-open"); });
  }

  /* ── language switcher behavior ── */
  function syncLangBtn(code){
    var l = window.LANGS.find(function(x){return x.code===code;}) || window.LANGS[0];
    var f = document.getElementById("langFlag"), c = document.getElementById("langCode");
    if(f){ f.src = "https://flagcdn.com/w40/"+l.cc+".png"; f.srcset = "https://flagcdn.com/w80/"+l.cc+".png 2x"; f.alt = l.label; }
    if(c) c.textContent = l.native;
    document.querySelectorAll(".lang-opt").forEach(function(o){
      o.classList.toggle("active", o.getAttribute("data-lang")===code);
    });
  }
  var lang = document.getElementById("lang");
  var langBtn = document.getElementById("langBtn");
  if(langBtn){
    langBtn.addEventListener("click", function(e){ e.stopPropagation(); lang.classList.toggle("open"); });
    document.addEventListener("click", function(e){ if(!lang.contains(e.target)) lang.classList.remove("open"); });
    document.querySelectorAll(".lang-opt").forEach(function(o){
      o.addEventListener("click", function(){
        var code = o.getAttribute("data-lang");
        window.applyLang(code); syncLangBtn(code); lang.classList.remove("open");
      });
    });
  }

  /* ── apply saved language ── */
  var cur = window.getLang();
  window.applyLang(cur);
  syncLangBtn(cur);

  /* ── mobile menu ── */
  var burger = document.getElementById("burger");
  if(burger){
    burger.addEventListener("click", function(){ document.body.classList.toggle("menu-open"); });
    drawer.querySelectorAll("a").forEach(function(a){
      a.addEventListener("click", function(){ document.body.classList.remove("menu-open"); });
    });
  }

  /* ── header scroll state ── */
  var sh = document.getElementById("site-head");
  function onScroll(){ if(sh) sh.classList.toggle("scrolled", window.scrollY > 24); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive:true });

  /* ── reveal on scroll ── */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold:0.12, rootMargin:"0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach(function(el){ io.observe(el); });

  /* ── count-up stats ([data-count] animates 0 → value on first view) ── */
  var reduceMo = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function runCount(el){
    var target = parseFloat(el.getAttribute("data-count"));
    if(isNaN(target)){ return; }
    var decimals = (el.getAttribute("data-decimals") | 0);
    var dur = parseInt(el.getAttribute("data-dur"), 10) || 1400;
    if(reduceMo){ el.textContent = target.toFixed(decimals); return; }
    var start = null;
    function frame(ts){
      if(start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
      el.textContent = (target * eased).toFixed(decimals);
      if(p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toFixed(decimals);
    }
    requestAnimationFrame(frame);
  }
  var countIO = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){ runCount(en.target); countIO.unobserve(en.target); }
    });
  }, { threshold:0.4 });
  document.querySelectorAll("[data-count]").forEach(function(el){ countIO.observe(el); });

  /* ── hero intro (timer-based: fires even when iframe isn't painting) ── */
  var hero = document.querySelector(".hero");
  if(hero){
    setTimeout(function(){ hero.classList.add("in"); }, 60);
    /* failsafe: never leave the hero hidden */
    setTimeout(function(){ hero.classList.add("in"); }, 1200);
    window.addEventListener("load", function(){ hero.classList.add("in"); });
  }

  /* ── auto-scrolling carousels ── */
  document.querySelectorAll("[data-carousel]").forEach(function(car){
    var track = car.querySelector(".hb-track");
    var slides = car.querySelectorAll(".hb-slide");
    var dots = car.querySelector(".hb-dots");
    var prev = car.querySelector(".prev");
    var next = car.querySelector(".next");
    var n = slides.length, i = 0, timer = null;
    var interval = parseInt(car.getAttribute("data-interval"), 10) || 4800;
    function go(k){
      i = (k % n + n) % n;
      track.style.transform = "translateX(-" + (i * 100) + "%)";
      if(dots) dots.textContent = (i + 1) + " / " + n;
    }
    function play(){ stop(); timer = setInterval(function(){ go(i + 1); }, interval); }
    function stop(){ if(timer){ clearInterval(timer); timer = null; } }
    if(next) next.addEventListener("click", function(e){ e.preventDefault(); go(i + 1); play(); });
    if(prev) prev.addEventListener("click", function(e){ e.preventDefault(); go(i - 1); play(); });
    car.addEventListener("mouseenter", stop);
    car.addEventListener("mouseleave", play);
    go(0);
    if(n > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) play();
  });

  /* ── hero banner (hbx): progress, counter, autoplay ── */
  document.querySelectorAll("[data-hbx]").forEach(function(root){
    var track = root.querySelector(".hbx-track");
    if(!track) return;
    var total = track.children.length;
    var fill = root.querySelector(".hbx-fill");
    var cur = root.querySelector(".hbx-count .cur");
    var tot = root.querySelector(".hbx-count .tot");
    var prev = root.querySelector(".hbx-prev");
    var next = root.querySelector(".hbx-next");
    var pause = root.querySelector(".hbx-pause");
    var timer = null, playing = false;
    if(tot) tot.textContent = total;
    function step(){ var c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 20 : 280; }
    function atEnd(){ return track.scrollLeft + track.clientWidth >= track.scrollWidth - 8; }
    function upd(){
      var max = track.scrollWidth - track.clientWidth;
      var p = max > 0 ? track.scrollLeft / max : 0;
      if(fill) fill.style.width = (18 + p * 82) + "%";
      if(cur) cur.textContent = Math.min(total, Math.round(track.scrollLeft / step()) + 1);
    }
    function go(dir){
      if(dir > 0 && atEnd()) track.scrollTo({ left:0, behavior:"smooth" });
      else track.scrollBy({ left: dir * step(), behavior:"smooth" });
    }
    if(next) next.addEventListener("click", function(){ go(1); });
    if(prev) prev.addEventListener("click", function(){ go(-1); });
    track.addEventListener("scroll", upd, { passive:true });
    function play(){ stop(); timer = setInterval(function(){ go(1); }, 4600); playing = true; root.classList.remove("paused"); }
    function stop(){ if(timer) clearInterval(timer); timer = null; }
    if(pause) pause.addEventListener("click", function(){
      if(playing){ stop(); playing = false; root.classList.add("paused"); } else { play(); }
    });
    root.addEventListener("mouseenter", function(){ if(playing) stop(); });
    root.addEventListener("mouseleave", function(){ if(playing) play(); });
    upd();
    if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches) play();
  });

  /* ── horizontal sliders (arrow nav) ── */
  document.querySelectorAll("[data-hslider]").forEach(function(wrap){
    var track = wrap.querySelector(".hslider");
    if(!track) return;
    var prev = wrap.querySelector(".prev"), next = wrap.querySelector(".next");
    function amt(){ var c = track.firstElementChild; return c ? c.getBoundingClientRect().width + 16 : 320; }
    function upd(){
      if(prev) prev.disabled = track.scrollLeft < 8;
      if(next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }
    if(next) next.addEventListener("click", function(){ track.scrollBy({ left: amt(), behavior:"smooth" }); });
    if(prev) prev.addEventListener("click", function(){ track.scrollBy({ left: -amt(), behavior:"smooth" }); });
    track.addEventListener("scroll", upd, { passive:true });
    upd();
  });

  /* ── contact form (demo) ── */
  var form = document.getElementById("consultForm");
  if(form){
    form.addEventListener("submit", function(e){
      e.preventDefault();
      var ok = document.getElementById("formOk");
      if(ok) ok.classList.add("show");
      form.reset();
      if(ok) ok.scrollIntoView ? null : null;
    });
  }

  /* ── 카테고리 아이콘: assets/icons/<페이지이름>.png|svg 가 있으면 이모지 대신 사용 ── */
  document.querySelectorAll(".cat-item:not(.more)").forEach(function(item){
    var href = item.getAttribute("href") || "";
    if(!/\.html$/.test(href)) return;
    var ic = item.querySelector(".cat-ic"); if(!ic) return;
    var base = "assets/icons/" + href.replace(/\.html$/, "");
    var img = document.createElement("img");
    img.className = "cat-img"; img.alt = ""; img.setAttribute("aria-hidden", "true");
    img.onload = function(){ ic.classList.add("has-img"); };
    img.onerror = function(){
      if(img.getAttribute("data-tri") !== "1"){ img.setAttribute("data-tri", "1"); img.src = base + ".svg"; }
      else { img.remove(); } /* 파일 없으면 기존 이모지 유지 */
    };
    img.src = base + ".png";
    ic.insertBefore(img, ic.firstChild);
  });

  /* ── 사이트 정보(설정) 적용: /api/settings → [data-set] 요소 ── */
  fetch("/api/settings").then(function(r){ return r.ok ? r.json() : null; }).then(function(d){
    if(!d || !d.settings) return;
    var s = d.settings;
    document.querySelectorAll("[data-set]").forEach(function(el){
      var k = el.getAttribute("data-set"); var v = s[k];
      if(v == null || v === "") return;
      el.textContent = v;
      if(el.hasAttribute("data-set-tel")) el.setAttribute("href", "tel:" + String(v).replace(/[^0-9+]/g, ""));
      if(el.hasAttribute("data-set-mail")) el.setAttribute("href", "mailto:" + v);
    });
  }).catch(function(){});
})();
