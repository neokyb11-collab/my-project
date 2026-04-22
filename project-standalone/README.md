# Perfect Sync - 로컬 실행 가이드

Manus 없이 개인 PC/서버에서 실행하는 버전입니다.

---

## 필요한 API 키

| 용도 | 서비스 | 가격 |
|------|--------|------|
| 음성 인식 | **Deepgram** | 무료 200시간/월 |
| 자막 생성 | **Claude** 또는 **Gemini** | 둘 중 하나만 있으면 됨 |

- Deepgram: https://console.deepgram.com (회원가입 후 바로 발급)
- Claude: https://console.anthropic.com
- Gemini: https://aistudio.google.com/app/apikey (무료)

> API 키는 앱 실행 후 **설정 페이지**에서 입력할 수 있습니다.

---

## 필요한 프로그램

- **Node.js** 18 이상 → https://nodejs.org
- **pnpm** → 터미널에서 `npm install -g pnpm`
- **MySQL** 8.0 이상 → https://dev.mysql.com/downloads/mysql/

---

## 설치 순서

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 메모장으로 열고 입력:

```
DATABASE_URL=mysql://root:내MySQL비밀번호@localhost:3306/perfect_sync
JWT_SECRET=아무문자열이나길게입력예시abc123xyz
```

### 2. MySQL에서 데이터베이스 만들기

MySQL Workbench 또는 터미널에서:
```sql
CREATE DATABASE perfect_sync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 패키지 설치

```bash
pnpm install
```

### 4. DB 테이블 생성

```bash
pnpm db:push
```

### 5. 서버 실행

```bash
pnpm dev
```

브라우저에서 http://localhost:3000 열기

### 6. API 키 설정

앱 우측 상단 **설정** 페이지에서 API 키 입력 후 저장

---

## 프로덕션 빌드 (선택)

```bash
pnpm build
pnpm start
```

---

## 문제 해결

**DB 연결 오류** → `DATABASE_URL` 형식 확인, MySQL 실행 여부 확인

**자막 생성 실패** → 설정 페이지에서 Claude 또는 Gemini API 키 확인

**음성 인식 실패** → 설정 페이지에서 Deepgram API 키 확인
