# ASDB 프로젝트 타 PC 설정 가이드

본 프로젝트를 다른 PC에서 구동하기 위해 필요한 설정 단계입니다.

## 1. 환경 준비
- **Node.js 설치**: v18 이상의 LTS 버전 권장
- **MySQL 설치**: v8.0 이상 설치 및 `DB_SETUP.sql`을 실행하여 초기 데이터베이스 구축

## 2. 프로젝트 내려받기 및 의존성 설치
```powershell
# 프로젝트 폴더로 이동 후
cd vue-asdb02
npm install

cd backend
npm install
```

## 3. 환경 변수 설정 (.env)
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 필수 항목을 입력합니다.

```env
# Database 설정
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=as_db

# Google Sheets Backup 설정
GOOGLE_BACKUP_FOLDER_ID=구글드라이브_폴더_아이디
GOOGLE_CLIENT_ID=구글_클라우드_클라이언트_아이디
GOOGLE_CLIENT_SECRET=구글_클라우드_클라이언트_시크릿
GOOGLE_REFRESH_TOKEN=발급받은_리프레시_토큰

# [중요] 백업 스케줄러 실행 여부 (멀티 PC 중복 방지)
# 해당 PC에서 매일 13:00에 자동 백업을 실행하려면 true로 설정
ENABLE_BACKUP_SCHEDULER=false
```

## 4. 구글 백업용 리프레시 토큰 발급 및 갱신
구글 인증이 만료되었거나 처음 설정하는 경우 다음 과정을 따릅니다:

### A. OAuth2 Playground를 통한 발급
1. **[Google OAuth2 Playground](https://developers.google.com/oauthplayground/)** 접속
2. 우측 상단 **Settings(⚙️)** 클릭 -> **"Use your own OAuth credentials"** 체크
3. `.env`에 적힌 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET` 입력 후 Close
4. 좌측 **Step 1**의 `Select & authorize APIs` 입력칸에 다음 두 권한 입력 후 **Authorize APIs** 클릭:
   - `https://www.googleapis.com/auth/drive`
   - `https://www.googleapis.com/auth/spreadsheets`
5. 구글 계정 로그인 및 권한 허용
6. **Step 2**에서 **Exchange authorization code for tokens** 클릭
7. 화면에 표시된 **Refresh Token** 값을 복사하여 `.env`의 `GOOGLE_REFRESH_TOKEN`에 업데이트
8. **백엔드 서버 재시작**

### B. 정상 작동 확인 방법
- **알림 확인**: 시스템 상단 네비바의 **🔔 아이콘**에 빨간 뱃지가 사라졌는지 확인 (자동 체크 5분 주기)
- **수동 백업**: [데이터관리] 메뉴의 **"지금 즉시 백업하기"** 버튼을 눌러 "성공" 메시지가 뜨는지 확인

## 5. 실행 방법
### 개발 모드
- **통합 실행**: 루트 폴더에서 `npm run dev:all`
- **개별 실행**:
  - Frontend: `npm run dev` (Port 5173)
  - Backend: `cd backend` -> `npm run dev:backend` (Port 3000)

### 프로덕션 모드
1. `npm run build` 실행
2. `cd backend` -> `npm start`
3. 브라우저에서 `http://localhost:3000` 접속
