# 자유게시판 — Cloudflare 연동 가이드

이 사이트는 **Cloudflare Pages + D1**로 배포하면 게시판이 "모두가 공유하는 실제 게시판"이 됩니다.
배포 전(로컬 미리보기)에는 자동으로 **데모 모드(브라우저 저장)** 로 동작하니 항상 확인은 가능합니다.

구성:
- 프런트: 이 저장소 전체(정적 파일)
- API: `functions/api/board.js` (Pages Function)
- DB: Cloudflare **D1** (`schema.sql`)
- 설정: `wrangler.toml`

---

## 사전 준비
1. Cloudflare 계정
2. Node.js 설치 후 Wrangler 로그인
   ```
   npm i -g wrangler
   wrangler login
   ```

## 1) D1 데이터베이스 생성
```
wrangler d1 create global-board
```
→ 출력된 `database_id` 를 **wrangler.toml** 의 `database_id = "..."` 에 붙여넣기.

## 2) 테이블 생성(스키마 적용)
```
wrangler d1 execute global-board --remote --file=./schema.sql
```

## 3) 배포
```
wrangler pages deploy .
```
처음이면 프로젝트 이름을 물어봅니다(예: global-law-office). 완료되면 `*.pages.dev` 주소가 나옵니다.

> GitHub 연동 자동배포를 쓰는 경우: Cloudflare 대시보드 → Pages → 프로젝트 →
> **Settings → Functions → D1 database bindings** 에서 변수명 `DB` 로 `global-board` 를 연결하세요.
> (wrangler.toml 의 바인딩과 동일)

## 4) 관리자 키 (ADMIN_KEY) — 게시판 답변/삭제, 블로그, 설정 공통
관리자 페이지의 모든 쓰기 작업(공식 답변, 글/댓글 삭제, 블로그 작성/삭제, 사이트 정보 저장)과
"변호사사무실 답변"은 이 키로 검증됩니다.
- 대시보드 → Pages → 프로젝트 → **Settings → Environment variables** 에
  `ADMIN_KEY = 원하는비밀키` 추가 후 재배포.
- 관리자 페이지(`/admin.html`) 첫 진입 시 이 키를 입력하면 브라우저에 저장되어 이후 작업에 사용됩니다.
- `ADMIN_KEY` 미설정 시 누구나 쓰기가 가능합니다(테스트 전용 — 운영 시 반드시 설정).

## 5) 관리자 페이지 & 블로그
- **관리자 페이지**: `https(도메인)/admin.html`
  - 대시보드(통계) · 게시판 관리(공식 답변·삭제·미답변 필터) · 블로그 관리(글 작성/삭제) · 사이트 정보 편집(전화·주소·영업시간 등)
  - 사이트 정보를 저장하면 전 페이지 **푸터의 전화/이메일/주소/영업시간**이 자동으로 바뀝니다(`/api/settings` → `[data-set]`).
- **블로그(공개)**: `/blog.html` — 관리자가 올린 글을 누구나 열람. 상단 메뉴 "블로그"로 연결됨.

### `/admin.html` 접근 보호 (강력 권장)
관리자 페이지 자체를 외부인이 못 열게 하려면 **Cloudflare Access**로 경로를 보호하세요(코드 불필요).
- 대시보드 → **Zero Trust → Access → Applications → Add application → Self-hosted**
- Application URL: `도메인/admin.html` (또는 `/admin*`)
- 정책: 허용할 이메일(예: 사무실 직원 Gmail)만 지정 → 그 외 접근 시 로그인 차단.
- (ADMIN_KEY는 쓰기 API 검증용, Cloudflare Access는 페이지 접근 차단용 — 함께 쓰면 2중 보호)

---

## 동작 방식
- 페이지가 열리면 `/api/board` 를 호출합니다.
  - 응답 OK → **실제 게시판(D1)** 모드
  - 실패(로컬 등) → **데모 모드**(상단에 안내 배너 표시, 글은 브라우저에만 저장)
- 코드 수정 없이, 배포만 하면 자동으로 실제 게시판으로 전환됩니다.

## 로컬에서 실제 API까지 테스트하려면(선택)
```
wrangler pages dev .
```
→ D1 바인딩까지 포함해 로컬에서 실제 API로 확인할 수 있습니다.
(단순 정적 서버로 열면 데모 모드로만 보입니다.)

## 참고
- 글/댓글 신고·삭제, 스팸 방지(예: Cloudflare Turnstile), 페이지네이션 등은 추후 추가 가능합니다.
- 첫 화면의 예시 글 3개는 데모 모드에서만 자동 생성됩니다. 실제(D1) 모드는 빈 게시판에서 시작합니다.
