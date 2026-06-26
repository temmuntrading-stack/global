/* SEO metadata for Global Law Office.
   Canonical domain: update BASE_URL if the production domain changes. */
(function(){
  var BASE_URL = "https://globallaw.co.kr";
  var LANGS = [
    { code:"ko", hreflang:"ko-KR", name:"한국어" },
    { code:"en", hreflang:"en", name:"English" },
    { code:"vi", hreflang:"vi", name:"Tiếng Việt" },
    { code:"ru", hreflang:"ru", name:"Русский" },
    { code:"zh", hreflang:"zh-CN", name:"中文" },
    { code:"uz", hreflang:"uz", name:"Oʻzbekcha" },
    { code:"th", hreflang:"th", name:"ไทย" },
    { code:"km", hreflang:"km", name:"ខ្មែរ" },
    { code:"si", hreflang:"si", name:"සිංහල" },
    { code:"ne", hreflang:"ne", name:"नेपाली" },
    { code:"mn", hreflang:"mn", name:"Монгол" }
  ];
  var COMMON_KEYWORDS = {
    ko:"법률상담, 무료 법률상담, 변호사 상담, 외국인 법률상담, 다국어 법률상담, 서울 변호사, 을지로 변호사, 민사소송, 형사소송, 가사소송, 행정소송, 비자 상담, 출입국 상담",
    en:"legal consultation Korea, free legal consultation, lawyer consultation Seoul, multilingual lawyer Korea, foreigner legal help Korea, civil litigation Korea, criminal defense Korea, immigration lawyer Korea, visa lawyer Korea",
    vi:"tư vấn pháp luật Hàn Quốc, luật sư Hàn Quốc, tư vấn pháp luật miễn phí, luật sư tiếng Việt tại Hàn Quốc, kiện dân sự, hình sự, visa Hàn Quốc, người nước ngoài tại Hàn Quốc",
    ru:"юридическая консультация Корея, адвокат в Корее, бесплатная юридическая консультация, гражданский иск, уголовное дело, виза Корея, иммиграционный адвокат",
    zh:"韩国法律咨询, 韩国律师, 免费法律咨询, 中文律师韩国, 民事诉讼, 刑事诉讼, 韩国签证, 出入境律师",
    uz:"Koreyada yuridik maslahat, Koreyada advokat, bepul yuridik maslahat, fuqarolik da'vosi, jinoyat ishi, Koreya vizasi, immigratsiya huquqi",
    th:"ปรึกษากฎหมายเกาหลี, ทนายความเกาหลี, ปรึกษากฎหมายฟรี, คดีแพ่ง, คดีอาญา, วีซ่าเกาหลี, กฎหมายคนต่างชาติ",
    km:"ប្រឹក្សាច្បាប់កូរ៉េ, មេធាវីកូរ៉េ, ប្រឹក្សាច្បាប់ឥតគិតថ្លៃ, បណ្តឹងរដ្ឋប្បវេណី, ក្តីព្រហ្មទណ្ឌ, វីសាកូរ៉េ",
    si:"කොරියාවේ නීති උපදෙස්, කොරියානු නීතිඥ, නොමිලේ නීති උපදෙස්, සිවිල් නඩු, අපරාධ නඩු, කොරියානු වීසා",
    ne:"कोरियामा कानुनी परामर्श, कोरियामा वकिल, निःशुल्क कानुनी परामर्श, देवानी मुद्दा, फौजदारी मुद्दा, कोरिया भिसा",
    mn:"Солонгост хуулийн зөвлөгөө, Солонгос өмгөөлөгч, үнэгүй хуулийн зөвлөгөө, иргэний хэрэг, эрүүгийн хэрэг, Солонгос виз"
  };
  var PAGES = {
    "index.html": {
      ko:["글로벌 법률사무소 | 다국어 법률상담·민사·형사·비자 상담","서울 중구 을지로의 글로벌 법률사무소입니다. 한국어, 영어, 베트남어, 러시아어, 중국어, 몽골어 등 10개 언어로 민사소송, 형사소송, 가사소송, 행정소송, 비자·출입국 상담을 제공합니다."],
      en:["Global Law Office Korea | Multilingual Legal Consultation in Seoul","Global Law Office in Seoul provides multilingual legal consultation for civil litigation, criminal defense, family, administrative, visa and immigration matters in Korea."],
      vi:["Văn phòng Luật Global | Tư vấn pháp luật đa ngôn ngữ tại Hàn Quốc","Tư vấn pháp luật tại Seoul cho người nước ngoài về dân sự, hình sự, gia đình, hành chính, visa và xuất nhập cảnh bằng nhiều ngôn ngữ."],
      ru:["Global Law Office | Юридическая консультация в Корее","Многоязычная юридическая помощь в Сеуле по гражданским, уголовным, семейным, административным, визовым и иммиграционным вопросам."],
      zh:["全球法律事务所 | 韩国多语言法律咨询","首尔律师事务所，为外国人提供民事诉讼、刑事案件、家事、行政、签证与出入境法律咨询。"],
      uz:["Global Law Office | Koreyada ko'p tilli yuridik maslahat","Seuldagi yuridik firma fuqarolik, jinoyat, oila, ma'muriy, viza va immigratsiya masalalarida maslahat beradi."],
      th:["Global Law Office | ปรึกษากฎหมายหลายภาษาในเกาหลี","สำนักงานกฎหมายในโซล ให้คำปรึกษาคดีแพ่ง อาญา ครอบครัว ปกครอง วีซ่าและตรวจคนเข้าเมืองสำหรับชาวต่างชาติ"],
      km:["Global Law Office | ប្រឹក្សាច្បាប់ច្រើនភាសានៅកូរ៉េ","ការិយាល័យច្បាប់នៅសេអ៊ូល ផ្តល់ប្រឹក្សារឿងរដ្ឋប្បវេណី ព្រហ្មទណ្ឌ គ្រួសារ រដ្ឋបាល វីសា និងអន្តោប្រវេសន៍។"],
      si:["Global Law Office | කොරියාවේ බහුභාෂා නීති උපදෙස්","සෝල් නීති කාර්යාලය සිවිල්, අපරාධ, පවුල්, පරිපාලන, වීසා සහ ආගමන කරුණු පිළිබඳ උපදෙස් සපයයි."],
      ne:["Global Law Office | कोरियामा बहुभाषी कानुनी परामर्श","सोलस्थित कानुनी कार्यालयले देवानी, फौजदारी, पारिवारिक, प्रशासनिक, भिसा र अध्यागमन विषयमा परामर्श दिन्छ।"],
      mn:["Global Law Office | Солонгост олон хэлний хуулийн зөвлөгөө","Сөүл дэх хуулийн товчоо иргэн, эрүү, гэр бүл, захиргаа, виз болон цагаачлалын асуудлаар олон хэлээр зөвлөгөө өгнө."]
    },
    "civil.html": {
      ko:["민사소송 변호사 상담 | 계약·손해배상·부동산 분쟁","민사소송, 금전청구, 계약분쟁, 손해배상, 부동산·임대차 문제를 변호사가 직접 상담합니다. 외국인도 10개 언어로 문의할 수 있습니다."],
      en:["Civil Litigation Lawyer Korea | Contract, Damages and Real Estate Disputes","Legal consultation for civil lawsuits in Korea including contract disputes, debt recovery, damages, real estate and lease disputes."],
      vi:["Tư vấn kiện dân sự tại Hàn Quốc | Hợp đồng, bồi thường, bất động sản","Luật sư tư vấn tranh chấp dân sự, hợp đồng, đòi tiền, bồi thường thiệt hại, nhà đất và thuê nhà tại Hàn Quốc."],
      ru:["Гражданские споры в Корее | Договоры, ущерб, недвижимость","Консультация адвоката по гражданским искам, договорам, взысканию денег, компенсации ущерба и спорам по недвижимости."],
      zh:["韩国民事诉讼律师 | 合同、赔偿、房地产纠纷","提供韩国民事诉讼、合同纠纷、金钱请求、损害赔偿、房地产及租赁纠纷法律咨询。"],
      uz:["Koreyada fuqarolik da'vosi | Shartnoma, zarar va ko'chmas mulk nizolari","Fuqarolik sud ishlari, qarz undirish, shartnoma nizolari, zarar qoplash va ijara masalalari bo'yicha maslahat."],
      th:["คดีแพ่งในเกาหลี | สัญญา ค่าเสียหาย อสังหาริมทรัพย์","ปรึกษาทนายความเรื่องคดีแพ่ง สัญญา เรียกเงิน ค่าเสียหาย อสังหาริมทรัพย์ และสัญญาเช่าในเกาหลี"],
      km:["បណ្តឹងរដ្ឋប្បវេណីនៅកូរ៉េ | កិច្ចសន្យា សំណង អចលនទ្រព្យ","ប្រឹក្សាមេធាវីសម្រាប់បណ្តឹងរដ្ឋប្បវេណី កិច្ចសន្យា ទាមទារប្រាក់ សំណង និងជម្លោះអចលនទ្រព្យ។"],
      si:["කොරියාවේ සිවිල් නඩු | ගිවිසුම්, හානිපූරණ, ඉඩම් ගැටළු","ගිවිසුම් ආරවුල්, මුදල් අයකිරීම, හානිපූරණ, ඉඩම් සහ කුලී ගැටළු සඳහා නීති උපදෙස්."],
      ne:["कोरियामा देवानी मुद्दा | सम्झौता, क्षतिपूर्ति, घरजग्गा विवाद","सम्झौता विवाद, पैसा असुली, क्षतिपूर्ति, घरजग्गा र भाडा विवादमा वकिल परामर्श।"],
      mn:["Солонгост иргэний хэрэг | Гэрээ, нөхөн төлбөр, үл хөдлөх маргаан","Гэрээний маргаан, мөнгө нэхэмжлэх, хохирол нөхөн төлүүлэх, үл хөдлөх болон түрээсийн асуудлаар зөвлөгөө."]
    },
    "criminal.html": {
      ko:["형사소송 변호사 상담 | 고소·고발·경찰조사 동행","형사 고소, 피의자 조사, 경찰조사 동행, 공판 대응까지 초기 대응부터 변호사가 함께합니다. 외국인 형사사건도 다국어 상담 가능합니다."],
      en:["Criminal Defense Lawyer Korea | Police Investigation and Trial Support","Criminal defense consultation in Korea for complaints, suspect questioning, police investigation attendance and trial representation."],
      vi:["Luật sư hình sự tại Hàn Quốc | Điều tra cảnh sát và phiên tòa","Tư vấn vụ án hình sự, tố cáo, điều tra cảnh sát, bảo vệ quyền lợi của người nước ngoài tại Hàn Quốc."],
      ru:["Уголовный адвокат в Корее | Полиция и суд","Защита по уголовным делам, сопровождение на допросе, жалобы, следствие и судебное представительство в Корее."],
      zh:["韩国刑事律师 | 报案、警察调查、刑事审判","韩国刑事案件、报警告诉、嫌疑人调查、警察陪同和审判应对法律咨询。"]
    },
    "divorce.html": { ko:["가사소송·이혼·상속 상담 | 외국인 가족 사건","이혼, 양육권, 재산분할, 상속, 후견 등 가사소송을 다국어로 상담합니다."], en:["Family, Divorce and Inheritance Lawyer Korea","Consultation for divorce, custody, property division, inheritance and family litigation in Korea."] },
    "administrative.html": { ko:["행정소송 변호사 상담 | 영업정지·처분 취소","행정처분, 영업정지, 과징금, 체류 관련 처분 등 행정소송과 취소소송 상담."], en:["Administrative Litigation Lawyer Korea","Consultation for administrative sanctions, business suspension, penalties and cancellation lawsuits in Korea."] },
    "traffic-accident.html": { ko:["교통사고·형사합의 변호사 상담 | 손해배상·처벌 대응","교통사고 손해배상, 형사합의, 보험사 대응, 음주운전·무면허 사건 상담."], en:["Traffic Accident and Criminal Settlement Lawyer Korea","Legal help for traffic accident compensation, criminal settlement, insurance claims and DUI cases."] },
    "industrial-accident.html": { ko:["산업재해·체불임금 상담 | 외국인 근로자 산재보상","산재보상, 체불임금, 퇴직금, 부당해고 등 근로자 권리구제 상담. 외국인 근로자도 지원합니다."], en:["Industrial Accident and Unpaid Wages Lawyer Korea","Consultation for workers' compensation, unpaid wages, severance pay and wrongful dismissal in Korea."] },
    "visa-invitation.html": { ko:["체류 VISA 연장·변경 상담 | 외국인 비자 변호사","한국 체류비자 연장, 체류자격 변경, 초청장, 등록·번역 등 출입국 상담."], en:["Korea Visa Extension and Change Consultation","Legal consultation for Korean visa extension, change of status, invitation letters and immigration documents."] },
    "immigration-overstay.html": { ko:["출국명령·체류자격 변경불허 구제 상담","출국명령, 강제퇴거, 체류자격 변경불허, 불법체류 관련 이의신청과 행정구제 상담."], en:["Departure Order and Immigration Appeal Lawyer Korea","Legal help for departure orders, deportation risk, visa denial and immigration appeals in Korea."] },
    "admin-appeal.html": { ko:["행정심판·음주운전·영업정지 구제 상담","음주운전 면허취소, 영업정지, 과징금 등 행정심판과 처분 구제 상담."], en:["Administrative Appeal Lawyer Korea | DUI and Business Suspension","Consultation for administrative appeals, DUI license cancellation, business suspension and sanctions."] },
    "investment-visa.html": { ko:["D-8 기업투자 비자 상담 | 외국인 창업·법인설립","D-8 기업투자 비자, 외국인 법인설립, 투자금 송금, 사업계획서와 체류자격 상담."], en:["D-8 Investment Visa Korea | Foreign Startup and Company Setup","Consultation for D-8 investment visa, foreign company formation, investment transfer and business plans in Korea."] },
    "practice.html": { ko:["업무분야 | 민사·형사·가사·행정·비자 법률상담","글로벌 법률사무소의 민사소송, 형사소송, 가사소송, 행정소송, 산업재해, 비자·출입국 업무분야 안내."], en:["Practice Areas | Civil, Criminal, Family, Immigration Lawyer Korea","Explore legal practice areas including civil, criminal, family, administrative, labor, visa and immigration matters."] },
    "about.html": { ko:["글로벌 소개 | 10개 언어 법률상담 법률사무소","글로벌 법률사무소는 외국인과 국내 의뢰인을 위해 10개 언어로 법률상담을 제공하는 서울 중구 법률사무소입니다."], en:["About Global Law Office | Multilingual Law Firm in Seoul","About Global Law Office, a Seoul law firm providing multilingual legal consultation for Korean and foreign clients."] },
    "contact.html": { ko:["상담 예약·연락처 | 글로벌 법률사무소","서울 중구 을지로 글로벌 법률사무소 상담 예약, 전화, 이메일, 위치 안내. 10개 언어로 문의하세요."], en:["Contact Global Law Office | Book a Legal Consultation","Contact Global Law Office in Seoul for multilingual legal consultation by phone, email or online form."] },
    "resources.html": { ko:["자유게시판 | 법률 질문과 공식 답변","개인정보를 제외하고 법률 질문을 남기면 글로벌 법률사무소가 확인 후 답변합니다."], en:["Community Board | Legal Questions and Answers","Ask legal questions on the community board and receive replies from Global Law Office."] },
    "blog.html": { ko:["성공 사례 | 글로벌 법률사무소 법률 인사이트","실제 상담과 사건 경험에서 나온 성공 사례, 법률 정보, 외국인 법률상담 안내."], en:["Success Stories and Legal Insights | Global Law Office","Read success stories, legal insights and practical information from Global Law Office."] },
    "privacy.html": { ko:["개인정보처리방침 | 글로벌 법률사무소","글로벌 법률사무소 개인정보처리방침."], en:["Privacy Policy | Global Law Office","Privacy Policy of Global Law Office."] },
    "terms.html": { ko:["이용약관 | 글로벌 법률사무소","글로벌 법률사무소 웹사이트 이용약관."], en:["Terms of Use | Global Law Office","Terms of Use for the Global Law Office website."] }
  };
  var DEFAULT_PAGE = PAGES["index.html"];
  function cleanPath(){
    var p = location.pathname.split("/").pop() || "index.html";
    return p === "" ? "index.html" : p;
  }
  function validLang(code){
    return LANGS.some(function(l){ return l.code === code; }) ? code : "ko";
  }
  function currentLang(){
    var q = new URLSearchParams(location.search).get("lang");
    if(q) return validLang(q);
    try { return validLang(localStorage.getItem("glo-lang") || "ko"); } catch(e){ return "ko"; }
  }
  function langUrl(page, lang){
    return BASE_URL + "/" + (page === "index.html" ? "" : page) + (lang === "ko" ? "" : "?lang=" + encodeURIComponent(lang));
  }
  function upsertMeta(attr, key, content){
    if(!content) return;
    var sel = "meta[" + attr + "=\"" + key + "\"]";
    var el = document.head.querySelector(sel);
    if(!el){ el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute("content", content);
  }
  function upsertLink(rel, attrs){
    var sel = 'link[rel="' + rel + '"]';
    if(attrs.hreflang) sel += '[hreflang="' + attrs.hreflang + '"]';
    var el = document.head.querySelector(sel);
    if(!el){ el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
    Object.keys(attrs).forEach(function(k){ el.setAttribute(k, attrs[k]); });
  }
  function setJsonLd(id, data){
    var el = document.getElementById(id);
    if(!el){ el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data);
  }
  function pageText(page, lang){
    var p = PAGES[page] || DEFAULT_PAGE;
    return p[lang] || p.en || p.ko || DEFAULT_PAGE.ko;
  }
  function applySeo(lang){
    lang = validLang(lang || currentLang());
    var page = cleanPath();
    var text = pageText(page, lang);
    var title = text[0], desc = text[1], url = langUrl(page, lang);
    var isAdmin = page === "admin.html";
    document.documentElement.lang = lang;
    document.title = title;
    upsertMeta("name", "description", desc);
    upsertMeta("name", "keywords", COMMON_KEYWORDS[lang] || COMMON_KEYWORDS.ko);
    upsertMeta("name", "robots", isAdmin ? "noindex,nofollow" : "index,follow,max-image-preview:large");
    upsertMeta("name", "naver-site-verification", "");
    upsertMeta("name", "google-site-verification", "");
    upsertLink("canonical", { href: url });
    LANGS.forEach(function(l){ upsertLink("alternate", { hreflang: l.hreflang, href: langUrl(page, l.code) }); });
    upsertLink("alternate", { hreflang: "x-default", href: langUrl(page, "ko") });
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", "글로벌 법률사무소");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:locale", lang === "ko" ? "ko_KR" : lang);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", desc);
    if(!isAdmin){
      setJsonLd("seo-legal-service", {
        "@context":"https://schema.org",
        "@type":"LegalService",
        "@id":BASE_URL + "/#legalservice",
        "name":"글로벌 법률사무소",
        "url":BASE_URL + "/",
        "telephone":"+82-2-2277-2442",
        "email":"lawsqare@naver.com",
        "address":{"@type":"PostalAddress","streetAddress":"서울특별시 중구 을지로 254, 3층 301호","addressLocality":"서울","addressCountry":"KR"},
        "areaServed":["KR","Seoul"],
        "availableLanguage":LANGS.map(function(l){ return l.name; }),
        "priceRange":"Consultation",
        "sameAs":["https://blog.naver.com/lawsqare"]
      });
      setJsonLd("seo-website", {
        "@context":"https://schema.org",
        "@type":"WebSite",
        "@id":BASE_URL + "/#website",
        "name":"글로벌 법률사무소",
        "url":BASE_URL + "/",
        "inLanguage":LANGS.map(function(l){ return l.hreflang; })
      });
    }
  }
  window.GLOBAL_SEO = { baseUrl: BASE_URL, langs: LANGS, pages: PAGES, apply: applySeo, langUrl: langUrl };
  applySeo();
  document.addEventListener("langchange", function(e){ applySeo(e.detail && e.detail.code); });
})();
