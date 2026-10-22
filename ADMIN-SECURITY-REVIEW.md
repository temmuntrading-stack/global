# 관리자 계정 보안 검토 — 2026-10-22

대상: 추가 중인 이메일 관리자 기능과 공용 관리자 인증 경로. 로컬 수정이며 운영 미배포.

## 수정한 문제

- 관리자 인증이 없을 때 쓰기를 허용하던 기존 데모 인증을 거부하도록 변경.
- Google 공개 Client ID에 의존한 세션 서명을 폐기하고 256비트 무작위 토큰 + 서버 SHA-256 해시 저장으로 변경. 비밀 세션은 JSON 응답이나 브라우저 JavaScript 저장소에 남기지 않음.
- 운영 쿠키에 HttpOnly, Secure, SameSite=Strict, __Host 접두사를 적용. 로그아웃 시 서버 세션도 삭제하고 만료 세션을 거부.
- 같은 출처 검사와 cross-site 요청 거부. 운영 HTTP 거부, 루프백 로컬 미리보기만 예외.
- 상담 접수 조회에 URL의 key/session/idToken을 사용하지 않도록 변경. 쿠키 인증을 상담·게시판·블로그·이미지 업로드·설정에도 연결.
- 관리자 생성 및 로그인 요청은 스트리밍 중 크기 제한. 응답 오류에 입력값이나 내부 DB 오류를 포함하지 않음.
- 관리자 추가 요청을 보내기 직전에 비밀번호·확인 필드를 지우며, 로그인 비밀번호도 제출 즉시 정리. 실패해도 브라우저 폼에 남지 않음.
- 로컬 서버에서 imports 데이터베이스와 테스트·서버 소스 경로를 차단. 계정 테이블을 공개 settings API와 분리.

## 확인한 보호

비밀번호는 무작위 salt가 있는 PBKDF2 해시로만 저장하고 생성·목록·로그인 응답에서 원문과 해시를 제외한다. SQL은 바인딩을 사용한다. 이메일 중복 등록을 막고 계정 관리 API에 관리자 인증을 요구한다. 존재하지 않는 이메일과 비밀번호 불일치의 로그인 오류를 통일하고 반복 시도를 제한한다. Google 계정의 aud/iss/exp/email_verified와 관리자 이메일 허용 목록을 검사한다.

## 해시 강도 보강 및 배포 조건

**비밀번호 해시 강도 보강 완료:** PBKDF2-HMAC-SHA256을 600,000회로 변경했다. 고정 버전 @noble/hashes 2.2.0을 사용하며 임의의 체인 해시는 만들지 않았다. Node 기본 PBKDF2 결과와 비교 검증했고, Cloudflare workerd에서 실제 등록·로그인·쿠키 목록 조회를 확인했다. 기존 로컬 100,000회 해시는 올바른 로그인 시에만 자동 갱신한다.

**배포 전 확인할 조건:** JavaScript로 계산하므로 무료 Workers의 10ms CPU 한도로는 지원할 수 없다. Workers Paid/Standard 플랜 확인과 CPU 상한 3,000ms가 필요하다. wrangler.toml은 플랜을 변경하거나 결제를 시작하지 않는다. 운영 Cloudflare CLI 인증이 만료되어 실제 플랜·CPU 한도를 확인하지 못했다. PR 미리보기에서 실제 로그인까지 확인한 후 병합한다. 로컬 Miniflare는 운영 CPU 제한을 강제하지 않으므로 이 결과가 무료 플랜 호환성을 증명하지 않는다.

## 검증 범위

`node --test tests/*.test.mjs`: 20개 테스트 통과. 계정 생성/로그인/중복/오류 응답/CSRF/HTTPS/요청 크기/쿠키/DB 세션 해시/로그아웃·만료/프런트엔드 실패 후 정리를 포함한다. 상담 접수 및 기존 블로그 가져오기 회귀 테스트 포함. 600,000회 결과를 Node 기본 구현과 비교하고 100,000회 해시의 로그인 후 승격도 검증했다.

Cloudflare workerd + 격리 D1 통합 확인: 관리자 생성 201, 이메일 로그인 200, HttpOnly 쿠키로 관리자 목록 조회 200, 목록 비밀번호 비노출. Windows Wrangler는 번들 파일을 출력한 뒤 프로세스 정리 시 비정상 종료해, 생성된 번들을 Miniflare 3 workerd에서 별도로 실행하여 검증했다.

운영 환경, Cloudflare 로그·접근권한, 계정 복구 정책에 대한 외부 침투 테스트 또는 보안 인증을 의미하지 않는다. 기존 운영 사이트에는 이 변경이 아직 배포되지 않았다.

참고: [OWASP 비밀번호 저장](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [OWASP 세션 관리](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Cloudflare PBKDF2 제한 논의](https://github.com/cloudflare/workerd/issues/1346).
