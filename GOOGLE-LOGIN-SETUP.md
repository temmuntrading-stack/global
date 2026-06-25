# 구글 로그인 설정 가이드 (자유게시판)

자유게시판에서 **글/댓글을 쓸 때만** 로그인이 필요합니다. 읽기는 누구나 가능합니다.

> **지금 당장 Client ID가 없어도 사이트는 동작합니다.**
> Client ID를 설정하지 않으면, 로그인 시 "표시할 이름"을 입력받는 **이름 입력 폴백**으로 동작합니다.
> 실제 구글 로그인을 쓰려면 아래 3단계를 따라 하세요.

---

## 1. Google Cloud Console에서 OAuth 2.0 Client ID(웹) 발급

1. <https://console.cloud.google.com/> 접속 → 로그인
2. 상단에서 프로젝트 선택(없으면 **새 프로젝트** 생성)
3. 왼쪽 메뉴 **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부(External)** 선택 → 만들기
   - 앱 이름, 지원 이메일 등 필수 항목만 입력 후 저장
4. 왼쪽 메뉴 **API 및 서비스 → 사용자 인증 정보(Credentials)**
   - 상단 **+ 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 JavaScript 원본(Authorized JavaScript origins)** 에 아래 두 개를 추가:
     ```
     https://global-3z6.pages.dev
     http://localhost:8091
     ```
     (다른 도메인/포트를 쓰면 그 주소도 추가하세요. `https://`/`http://`, 포트까지 정확히 일치해야 합니다.)
   - **만들기** → 발급된 **클라이언트 ID** 를 복사 (형식: `xxxxxxxx.apps.googleusercontent.com`)

---

## 2. 프런트엔드에 Client ID 붙여넣기

`js/auth.js` 파일 상단의 다음 줄을 찾아, 따옴표 안에 발급한 Client ID를 붙여넣습니다.

```js
var GOOGLE_CLIENT_ID = "";   // ← 여기에 붙여넣기
```

예시:

```js
var GOOGLE_CLIENT_ID = "1234567890-abcdefg.apps.googleusercontent.com";
```

저장 후 배포하면, 로그인 모달에 **구글 로그인 버튼**이 표시됩니다.

---

## 3. (서버 검증용) Cloudflare Pages 환경 변수 추가

서버에서 로그인 토큰을 검증해 이름을 위조하지 못하게 하려면, Cloudflare에도 동일한 값을 넣습니다.

1. Cloudflare 대시보드 → 해당 Pages 프로젝트 선택
2. **Settings → Variables and Secrets (환경 변수)**
3. 변수 추가:
   - 이름: `GOOGLE_CLIENT_ID`
   - 값: **2단계에서 쓴 것과 동일한** Client ID
4. 저장 후 **재배포(Retry deployment / 새 배포)**

> `GOOGLE_CLIENT_ID` 가 Cloudflare에 설정되면, 서버는 글/댓글 작성 시 구글 토큰을
> `https://oauth2.googleapis.com/tokeninfo` 로 검증하고, 작성자 이름을 **검증된 구글 계정 이름**으로 덮어씁니다.
> 검증에 실패하면 401 오류로 거부됩니다.
> 설정하지 않으면 서버 검증은 생략되고, 클라이언트가 보낸 이름을 그대로 사용합니다(개발/테스트용).

---

## 동작 요약

| 상태 | 프런트엔드(js/auth.js) | 서버(Cloudflare GOOGLE_CLIENT_ID) | 결과 |
|------|------------------------|-----------------------------------|------|
| 둘 다 미설정 | 빈 문자열 | 없음 | 이름 입력 폴백, 서버 검증 생략 |
| 프런트만 설정 | Client ID | 없음 | 실제 구글 로그인, 서버 검증 생략 |
| 둘 다 설정(권장) | Client ID | 동일 Client ID | 실제 구글 로그인 + 서버 토큰 검증 |

- 변호사사무실 **공식 답변(official)** 은 기존 `ADMIN_KEY` 방식을 그대로 사용합니다(구글 로그인과 무관).
- 로컬 개발 시에는 보통 Client ID 없이 **이름 입력 폴백**으로 테스트하면 됩니다.
