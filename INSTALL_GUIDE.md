# 자산 관리 시스템 서비스 설치 매뉴얼

이 문서는 새로운 환경에서 자산 관리 시스템(ASDB)을 설치하고 실행하기 위한 가이드를 제공합니다.

---

## 1. 필수 요구 사양

시스템 실행을 위해 다음 소프트웨어가 설치되어 있어야 합니다.

*   **Node.js**: v20.19.0 이상 또는 v22.12.0 이상 권장
*   **MySQL**: 8.0 이상 권장
*   **Git**: 소스 코드 관리를 위해 필요

---

## 2. 데이터베이스 설정

1.  **데이터베이스 생성**
    MySQL에 접속하여 시스템에서 사용할 데이터베이스를 생성합니다.
    ```sql
    CREATE DATABASE assetdb;
    ```

2.  **스키마(구조) 가져오기**
    프로젝트 루트에 있는 `DB_SCHEMA.sql` 파일을 실행하여 테이블 구조를 생성합니다.
    ```bash
    # MySQL CLI 사용 시
    mysql -u [사용자명] -p assetdb < DB_SCHEMA.sql
    ```

---

## 3. 환경 변수 설정 (.env)

프로젝트 루트의 `.env.example` 파일을 복사하여 `.env` 파일을 생성하고 환경에 맞게 수정합니다.

```bash
cp .env.example .env
```

### 주요 설정 항목:
*   `DB_PASSWORD`: 설치된 MySQL의 비밀번호를 입력합니다.
*   `VITE_API_URL`: 프론트엔드가 백엔드와 통신할 주소입니다. (예: http://localhost:3001)
*   `GOOGLE_...`: 자동 백업 기능을 사용하려면 구글 OAuth 2.0 클라이언트 정보를 입력해야 합니다.

---

## 4. 의존성 설치

프로젝트 루트에서 다음 명령어를 실행하여 프론트엔드와 백엔드의 라이브러리를 한 번에 설치합니다.

```bash
npm run install:all
```

---

## 5. 애플리케이션 실행

### 개발 환경 (Development)
프론트엔드(Vite)와 백엔드(Express)를 동시에 실행합니다.
```bash
npm run dev:all
```
*   **프론트엔드 접속**: http://localhost:5173 (기본값)
*   **백엔드 API**: http://localhost:3001 (기본값)

### 프로덕션 환경 (Production)
빌드 후 백엔드 서버를 직접 구동합니다.
```bash
# 1. 빌드 수행 (frontend 빌드 포함)
npm run build:all

# 2. 서버 실행
npm start
```

---

## 6. 기타 유용한 명령어

*   **DB 스키마 동기화**: `DB_SCHEMA.sql`의 최신 내용을 현재 DB에 반영(컬럼 추가 등)하려면 다음 명령어를 실행합니다.
    ```bash
    npm run db:sync
    ```
*   **백업 상태 확인**: 서버가 실행 중일 때 `GET /api/backup/status`를 통해 구글 인증 상태를 확인할 수 있습니다.

---

## 7. 문제 해결 (Troubleshooting)

*   **포트 충돌**: 포트 3000, 3001, 5173이 이미 사용 중인 경우 `.env`에서 포트 번호를 수정하세요.
*   **DB 연결 실패**: MySQL 서비스가 실행 중인지, 비밀번호 및 DB 이름이 `.env`와 일치하는지 확인하세요.
*   **권한 문제**: Windows 환경에서 스크립트 실행이 제한된 경우 PowerShell을 관리자 권한으로 실행하세요.
