# 관리자 계정

최고관리자가 **관리자 계정 → 새 관리자 추가**에서 이메일·비밀번호·비밀번호 확인을 입력하면 담당자를 추가합니다. 추가된 담당자는 이메일과 비밀번호로 로그인합니다. 비밀번호는 12~128자이며 다른 서비스와 겹치지 않는 값을 사용합니다. 로그인 정보는 담당자에게 직접 전달합니다.

서버 `ADMIN_EMAILS`의 기존 Google 계정과 `ADMIN_KEY` 인증만 최고관리자입니다. 추가된 이메일 계정은 상담·게시판·성공 사례·사이트 정보를 관리하는 일반 관리자이며, 관리자 계정 목록과 추가 API는 사용할 수 없습니다. 권한은 서버에서 매 요청 확인합니다.

## 무료 플랜용 인증

Cloudflare Workers Free의 요청당 CPU 10ms 한도를 직접 확인했습니다. 비밀번호 저장·검증은 Firebase Authentication에 위임하고, Cloudflare에서는 무거운 비밀번호 해시를 계산하지 않습니다. 기존 PBKDF2 번들·의존성·유료 CPU 설정을 제거했습니다. 별도 Firebase 프로젝트의 Email/Password 제공자를 활성화하고 아래 설정을 연결해야 실제 계정을 추가할 수 있습니다.

Cloudflare Pages의 Production과 Preview 환경에 각각 설정합니다.

- `FIREBASE_PROJECT_ID`: Firebase 프로젝트 ID.
- `FIREBASE_API_KEY`: 해당 프로젝트의 Web API Key. 서버에서만 사용하며 관리자 UI/로그에 표시하지 않습니다. 서비스 계정 비밀 키나 관리자 SDK 권한은 필요하지 않습니다.
- 기존 `ADMIN_EMAILS`, `GOOGLE_CLIENT_ID`, `ADMIN_KEY`, `DB`, `MEDIA`는 유지합니다.

관리자가 입력한 비밀번호는 HTTPS 요청 본문으로 Cloudflare를 거쳐 Google Identity Toolkit의 고정 HTTPS 엔드포인트에만 전달합니다. 리디렉션을 따라가지 않고 10초 타임아웃을 적용합니다. 비밀번호, Firebase ID/refresh 토큰을 브라우저 저장소·D1·API 응답에 저장하지 않습니다.

D1 `managed_admin_accounts`에는 이메일, Firebase UID와 프로젝트 ID, 등록일·등록자만 저장합니다. Firebase 계정이 있다는 사실만으로 사이트 관리자 권한을 받지 않습니다. 인증 결과의 프로젝트·이메일·UID를 확인한 후 D1 허용 목록과 일치해야 로그인됩니다. Firebase 프로젝트가 바뀌면 기존 일반 관리자 세션도 거부합니다.

프로젝트 연결이 없거나 제공자가 오류를 반환하면 이메일 등록/로그인은 실패로 표시합니다. 기존 Google 최고관리자는 계속 사용할 수 있습니다. Firebase 가입 직후 D1 저장에 실패하면 같은 이메일과 올바른 기존 비밀번호로 재시도해 복구할 수 있습니다. 기존 Firebase 비밀번호를 임의로 재설정하지 않습니다.

이전 로컬 미리보기의 `admin_accounts` 테이블은 삭제하지 않습니다. 그 테이블의 비밀번호 해시는 새 인증에 사용하지 않으며, 기존 로컬 이메일 계정은 최고관리자가 새 방식으로 다시 등록해야 합니다. 이 기능은 아직 운영에 배포되지 않아 운영 관리자 계정의 자동 이전은 없습니다.

## 세션과 검증

로그인 세션은 256비트 무작위 토큰이며 D1에는 SHA-256 해시만 보관합니다. 브라우저에는 `HttpOnly; Secure; SameSite=Strict` 쿠키로 전달합니다. 로그아웃 시 서버 세션을 폐기하며, 만료·교차 출처·운영 HTTP 요청을 거부합니다. 로그인은 IP당 15분 내 20회, IP·이메일당 5회로 제한합니다. 폼의 비밀번호는 제출 직후 지웁니다.

`npm test`로 모의 Firebase와 격리 D1을 검증합니다. 실제 Firebase 프로젝트 연결·Preview 배포에서 등록/로그인을 확인한 뒤 운영에 병합해야 합니다. 모의 테스트가 실제 서비스 연결 완료를 의미하지 않습니다.

로컬 서버는 `PORT=8083` 환경변수와 `node tools/dev-import.mjs`로 실행합니다. 기본 공용 키 `local-preview-only`는 로컬 전용입니다. 실제 Firebase 연결은 환경변수로 전달하며, 연결하지 않은 상태에서는 추가 버튼이 비활성화됩니다. 로컬 DB는 `imports/dev/preview.sqlite`이며 운영 DB에 접속하지 않습니다.

참고: [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth), [Firebase 인증 한도](https://firebase.google.com/docs/auth/limits).
