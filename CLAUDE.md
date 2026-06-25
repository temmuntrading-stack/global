# 글로벌 법률사무소 — 프로젝트 메모

## 디자인 규칙 (사용자 지정)
- **하단 "지금 상담하세요" 류의 CTA 배너를 만들지 말 것.** 상담 예약·온라인 문의는 전 페이지 공통 플로팅 퀵메뉴(우측 고정, 데스크톱)와 모바일 하단 탭바의 "상담" 탭에 이미 있으므로 별도 하단 상담 배너는 불필요하다.

## 모바일 네비게이션 (앱 스타일) — `site.js` + `site.css`
모든 페이지의 모바일 네비게이션은 `site.js`가 자동 주입한다(페이지별로 따로 만들지 말 것).
- **하단 탭바**(`.mtabbar`, ≤640px): 홈 / 업무분야 / 자료실 / 상담 / 메뉴 (5탭). 모바일의 주 네비게이션.
  - 활성 탭은 `<body data-page="...">` 값으로 자동 결정된다: `home`→홈, `practice`→업무분야, `resources`→자료실, `contact`→상담, `about`→메뉴.
  - **새 페이지를 만들 땐 반드시 알맞은 `data-page`를 지정**해야 해당 탭이 활성화된다(업무분야 하위 페이지는 `data-page="practice"`).
  - "메뉴" 탭은 풀스크린 드로어(`.drawer`)를 연다 → 소개·블로그·세부 업무분야 접근.
  - 탭 라벨 i18n 키: `mtab.home/practice/resources/consult/menu`. 새 키는 `ko`·`en` 딕셔너리에만 넣으면 나머지 언어는 영어로 자동 폴백(applyLang: dict→en→ko).
- **플로팅 퀵메뉴**(`.quickfab`)는 데스크톱 전용 — 모바일(≤640px)에서는 `display:none`(하단 "상담" 탭이 대체, 본문 가림 방지).

## 메뉴 페이지 디자인 시스템 — `css/practice.css` (`px-*`)
모든 업무분야/메뉴 페이지는 **동일한 디자인**을 유지한다. 새 페이지를 만들거나 기존 페이지를 개선할 때는
인라인 `<style>`을 새로 복제하지 말고 `css/practice.css`의 `px-` 컴포넌트를 재사용한다.
기준 구현체: [industrial-accident.html](industrial-accident.html) (산업재해·체불임금).

**페이지 head:** `site.css` 다음에 `practice.css`를 링크한다.
```html
<link rel="stylesheet" href="css/site.css">
<link rel="stylesheet" href="css/practice.css">
```

**표준 섹션 순서(레시피):**
1. `.px-hero` — 오로라 그라데이션 + 글래스 칩 히어로. `.px-eyebrow`(pulse) · `.px-title`(`.grad` 그라데이션 텍스트) · `.px-sub` · `.px-cta`(btn) · `.px-trust` · `.px-illu`(`image-slot` + `.px-chip.c1/c2/c3`).
2. `.px-stats` — 신뢰 지표 4개. 숫자에 `<span data-count="10">0</span>` 사용 → 스크롤 시 자동 카운트업(site.js). 과장·허위 수치 금지, 사실 기반만.
3. `.px-pains` — 고민 체크리스트(3열). 항목에 `.teal` 추가 시 청록 강조.
4. `.px-bento` — 6열 벤토. 큰 카드 `.px-card.feat.span4`(+`.teal`), 그라데이션 노트 타일 `.px-card.px-note-tile.span2`(`.brand`/`.teal`/`.violet`).
5. 왜 전문가 — site.css의 `.areas`/`.area` 재사용.
6. `.px-steps` — 상담 절차 타임라인(노드 `.node` + 연결선 `.line`).
7. `.px-faq` — `<details class="px-q">` 아코디언.

**공통 재사용:** `.wrap` `.section`/`.section--tight` `.bg-soft` `.sec-head`+`.eyebrow`+`.h2` `.btn` `.reveal`(스크롤 등장, `data-d="1|2|3"` 지연).
**색 토큰:** 브랜드 시안 `--brand`, 청록 `--teal`, 보조 바이올렛 `--px-violet`. 섹션 배경은 흰색/`.bg-soft` 교차.
**제약:** 위 "하단 상담 CTA 배너 금지" 규칙 준수 — 상담 유도는 히어로 버튼과 플로팅 퀵메뉴로 충분.

### 업무분야 10개 카테고리 ↔ 페이지 (모두 `px-*` 디자인 통일 완료)
nav 드롭다운/홈 카테고리 그리드의 순서(`ncat.1`~`ncat.10`)와 파일 매핑. 링크는 `site.js`의 `NCAT_HREF` 배열로 관리(한 곳만 고치면 데스크톱·모바일 동시 반영). 홈 그리드 링크는 `index.html`에 하드코딩.
1. 민사소송 → [civil.html](civil.html)
2. 형사소송 → [criminal.html](criminal.html)
3. 가사소송 → [divorce.html](divorce.html) (이혼·재산분할 + 상속·후견 등 가사 전반)
4. 행정소송 → [administrative.html](administrative.html)
5. 교통사고 및 형사합의 → [traffic-accident.html](traffic-accident.html)
6. 산업재해·체불임금 → [industrial-accident.html](industrial-accident.html) (기준 템플릿)
7. 체류 VISA 연장·변경 → [visa-invitation.html](visa-invitation.html)
8. 출국명령·체류자격 변경불허 → [immigration-overstay.html](immigration-overstay.html)
9. 행정심판(음주·영업정지) → [admin-appeal.html](admin-appeal.html)
10. D-8 기업투자 비자 → [investment-visa.html](investment-visa.html)

- 2026-06 개편(1차): 민사/형사 분리, 이혼/행정 분리, 난민신청 삭제, 인허가·법인설립 → D-8 투자비자 교체 (9→10개).
- 2026-06 개편(2차): 이혼소송 → **가사소송**(가사 전반 확장), 교통사고·손해배상 → **교통사고 및 형사합의**, 체류비자·초청·통역 → **체류 VISA 연장·변경**, 불법체류·출국명령 → **출국명령·체류자격 변경불허**, 외국인 D-8 투자비자 → **D-8 기업투자 비자**. 순서상 산업재해는 6번(교통사고 뒤), 체류VISA(7)·출국명령(8) 순. 파일명(divorce/traffic-accident/visa-invitation/immigration-overstay/investment-visa)은 그대로 유지(라벨·본문만 변경).
- 신뢰 지표 4번째는 전 페이지 공통 "0원 / 1차 상담 무료"(산재만 "6종 급여" 유지).
- `practice.html`은 10개 카테고리 허브 — 본문 `.cat-grid`가 위 10개 페이지로 링크(라벨은 `ncat.*`라 자동 다국어). (litigation/cta 섹션은 옛 디자인 잔존, 추후 정리 가능)

### 카테고리 페이지 다국어(i18n)
- 9개 카테고리 페이지는 **전 11개 언어**(ko·en·vi·ru·zh·uz·th·km·si·ne·mn) 지원. 본문 텍스트는 `data-i18n`(텍스트) / `data-i18n-html`(인라인 HTML 포함: 히어로 title의 `.grad`, 칩의 `<small>`, note-tile의 `<br>`)로 키 처리되어 **비어 있고**, 값은 페이지별 파일에서 채운다.
- 페이지별 번역 파일: `js/i18n-<slug>.js` (slug = cv/cr/dv/ad/ta/ia/io/vi/aa/iv). 각 파일이 언어 사전을 `window.I18N`에 `Object.assign`으로 병합. 로드 순서: `i18n.js` → `i18n-<slug>.js` → `site.js`. 신규 4개 분리 페이지(civil/criminal/divorce/administrative)와 투자비자(investment-visa)는 현재 ko·en만 채워짐(나머지 언어는 en으로 자동 폴백) — 추후 11개 언어 채우기 권장. (en/vi/ru/zh/uz/th/km/si/ne/mn 번역은 AI 생성 — 게시 전 검수 권장)
- 누락 키는 `applyLang`이 dict→en→ko로 폴백. 새 키 추가 시 11개 언어 모두 채우는 것이 원칙.
- `data-i18n-html` 지원은 `i18n.js`의 `applyLang`에 추가됨(값을 `innerHTML`로 주입 — 신뢰된 콘텐츠 전용).
- 키 네이밍 컨벤션(기준: `js/i18n-ia.js`): `<slug>.eyebrow/title/sub/cta1/trust1~3/chip1~3/u1~4/k1~4/h2.{check,scope,why,process,faq}/pain1~N/b1.*/cap1/b1.t*/note1.{t,d}/note2.{t,d}/b2.*/cap2/b2.t*/a1~a3.{h3,p}/s1~s4.{h3,p}/q1~q5/a1faq~a5faq`.
