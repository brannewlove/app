# 환경변수 설정 가이드

## 개요
민감한 정보(DB 비밀번호, API 설정 등)는 `.env` 파일에서 관리합니다.

## 파일 설명

### .env (실제 설정)
- **Git에 업로드되지 않음** (`.gitignore`에 등록)
- 실제 환경변수 값 포함
- 로컬 개발/서버 환경에서만 관리

### .env.example (템플릿)
- **Git에 업로드됨** (샘플 목적)
- 민감정보는 `your_password_here` 같은 플레이스홀더로 표시
- 새로운 개발자가 참고용으로 사용

## 새 PC에서 설정하는 방법

### 1단계: 저장소 클론
```bash
git clone <repository-url>
cd vue-asdb02
```

### 2단계: .env 파일 생성
`.env.example`을 참고해서 `.env` 파일을 생성하고 실제 값 입력:
```bash
cp .env.example .env
# .env 파일 편집 후 실제 값 입력
```

### 3단계: 의존성 설치
```bash
# 프런트엔드
npm install

# 백엔드
cd backend
npm install
```

## .env 파일 내용 예시

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=실제_비밀번호
DB_NAME=assetdb

# Server Configuration
NODE_ENV=development
SERVER_PORT=3000

# Vue Configuration
VITE_API_URL=http://localhost:3000
```

## 변수 설명

| 변수 | 설명 | 예시 |
|------|------|------|
| DB_HOST | MySQL 서버 주소 | localhost |
| DB_PORT | MySQL 포트 | 3306 |
| DB_USER | MySQL 사용자명 | root |
| DB_PASSWORD | MySQL 비밀번호 | IClwx6F2VTbLZsEx |
| DB_NAME | 데이터베이스명 | assetdb |
| NODE_ENV | 실행 환경 | development, production |
| SERVER_PORT | Node.js 서버 포트 | 3000 |
| VITE_API_URL | API 엔드포인트 URL | http://localhost:3000 |

## 주의사항

⚠️ **.env 파일은 절대 Git에 커밋하지 마세요!**
- `.gitignore`에 이미 등록되어 있으므로 자동으로 제외됩니다.
- 실수로 업로드된 경우, 비밀번호를 즉시 변경하세요.

## 환경별 설정

### 개발 환경 (NODE_ENV=development)
```env
NODE_ENV=development
DB_HOST=localhost
VITE_API_URL=http://localhost:3000
```

### 프로덕션 환경 (NODE_ENV=production)
```env
NODE_ENV=production
DB_HOST=production.server.ip
VITE_API_URL=https://your-domain.com
```
