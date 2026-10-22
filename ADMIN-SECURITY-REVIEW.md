# 관리자 계정 보안 검토 — 2026-10-22

대상: 이메일·비밀번호 관리자 추가, 기존 Google 최고관리자, 사이트 API의 쿠키 인증. 현재 외부 인증 프로젝트 연결과 운영 배포는 완료 전입니다.

## 인증과 권한

- 최고관리자는 서버 ADMIN_EMAILS의 Google 계정 또는 기존 ADMIN_KEY 인증으로만 결정합니다. Google aud/iss/exp/email_verified를 검사합니다.
- 추가된 일반 관리자는 상담·게시판·성공 사례·사이트 정보를 관리합니다. 관리자 계정 목록·생성은 서버에서 403으로 거부합니다. 요청의 role이나 브라우저 저장소 값으로 승격할 수 없습니다.
- Cloudflare 무료 CPU 제약을 해결하기 위해 비밀번호 인증을 Firebase REST에 위임했습니다. 무거운 JavaScript PBKDF2와 의존성, 3,000ms 유료 CPU 설정을 제거했습니다. 단순한 해시로 약화하지 않았습니다.
- 비밀번호는 Google의 고정 HTTPS 엔드포인트 요청 본문에만 전달하고 리디렉션을 거부합니다. 오류 응답이나 로그에 원문·해시·ID/refresh 토큰을 넣지 않습니다. 브라우저에는 사이트의 HttpOnly 세션 쿠키만 전달합니다.
- 신뢰된 Google 서버 응답의 프로젝트·이메일·UID·만료를 확인한 후 D1의 동일 프로젝트/UID/이메일 허용 목록과 일치해야 로그인됩니다. 사용자 제출 Firebase 토큰을 인증 수단으로 받지 않습니다. 일반적인 Firebase 공개 가입은 사이트 권한을 부여하지 않습니다.
- 기존 Firebase 이메일의 재시도 등록은 올바른 현재 비밀번호를 확인해야 합니다. 사용자의 비밀번호를 임의로 변경하지 않습니다. 공급자 가입 성공 후 D1 실패도 재시도로 복구 가능합니다.
- 기존 로컬 admin_accounts 데이터는 보존하지만 새 인증의 허용 목록으로 사용하지 않습니다. 자동 해시 이전이나 계정 승격을 하지 않습니다.

## 세션과 요청

256비트 임의 세션과 D1 SHA-256 토큰 해시, 운영 HttpOnly/Secure/SameSite=Strict/__Host 쿠키, 서버 로그아웃·만료 거부를 유지했습니다. 운영 HTTP, 교차 출처, 비JSON 및 과대 스트리밍 요청은 거부합니다. 상담 조회의 URL 인증정보와 JavaScript 저장소의 관리자 토큰을 제거했습니다. 비밀번호 입력은 제출 즉시 정리합니다. 미설정 상태와 서버 장애에서는 실패를 표시합니다.

## 검증 상태

Node 테스트는 모의 Firebase와 메모리 D1만 사용합니다. 등록, 비밀번호·토큰 비저장, 최고관리자 허용, 일반 관리자 거부, UID·프로젝트 불일치, 잘못된 공급자 응답, 장애 시 닫힘, 가입 후 DB 실패 복구, 반복 로그인 제한, CSRF·쿠키·로그아웃, 상담·블로그·다국어 회귀를 확인합니다.

Cloudflare workerd + 격리 D1 + 모의 Firebase REST 통합에서 등록 201 / 로그인 200 / 최고관리자 목록 200 / 일반 관리자 목록·생성 403을 확인했습니다. 실제 Firebase 프로젝트의 등록·로그인과 배포 후 운영 확인은 아직 필요합니다. 로컬 테스트는 운영 CPU 한도나 외부 서비스 연결을 증명하지 않습니다. Windows Wrangler는 번들 출력 뒤 종료 코드가 비정상이라 생성 번들을 workerd로 따로 실행했습니다.

외부 침투 테스트나 보안 인증을 의미하지 않습니다. 실제 프로젝트 연결 및 Preview 검증을 끝내기 전 PR은 초안으로 유지합니다.

참고: [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth), [Cloudflare CPU 한도](https://developers.cloudflare.com/workers/platform/limits/), [OWASP 세션 관리](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
