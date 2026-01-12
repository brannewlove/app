# 배포 가이드

## 개발 환경 실행
```bash
# 프론트엔드 + 백엔드 동시 실행
npm run dev:all

# 또는 개별 실행
npm run dev:frontend  # Vite dev server (http://localhost:5173)
npm run dev:backend   # Express server (http://localhost:3000)
```

## 프로덕션 배포

### 1. 빌드
```bash
# Vue 프론트엔드 빌드 (dist 폴더 생성) + 백엔드 의존성 설치
npm run build:all
```

### 2. 환경변수 설정
`.env` 파일에서 프로덕션 DB 정보 확인:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=AssetDB
```

### 3. 서버 실행
```bash
# Windows
npm start

# Linux/Mac
NODE_ENV=production node backend/server.js
```

서버는 http://localhost:3000 에서 실행됩니다.
- API: http://localhost:3000/users, /assets, /trades 등
- 프론트엔드: http://localhost:3000/ (빌드된 Vue 앱)

### 4. PM2로 실행 (권장)
```bash
# PM2 설치 (전역)
npm install -g pm2

# 애플리케이션 시작
pm2 start backend/server.js --name vue-dbas --env production

# 상태 확인
pm2 status

# 로그 확인
pm2 logs vue-dbas

# 재시작
pm2 restart vue-dbas

# 정지
pm2 stop vue-dbas

# 부팅시 자동 시작 설정
pm2 startup
pm2 save
```

### 5. 포트 변경 (선택사항)
기본 포트 3000을 변경하려면 `backend/bin/www` 파일에서 수정:
```javascript
var port = normalizePort(process.env.PORT || '3000');
```

## 주의사항

1. **CORS 설정**: 프로덕션 환경에서는 `backend/app.js`의 CORS 설정을 특정 도메인만 허용하도록 변경 권장:
```javascript
res.header('Access-Control-Allow-Origin', 'https://yourdomain.com');
```

2. **데이터베이스**: 프로덕션 DB 접속 정보가 .env에 올바르게 설정되어 있는지 확인

3. **보안**: 
   - .env 파일은 절대 git에 커밋하지 않기
   - DB 비밀번호는 강력하게 설정
   - 프로덕션에서는 morgan 로거를 'combined' 모드로 변경 권장

4. **빌드 결과**: `dist` 폴더가 생성되고 Express가 해당 폴더의 파일을 서빙합니다

## 배포 체크리스트
- [ ] `npm run build:all` 실행 완료
- [ ] `.env` 파일에 프로덕션 DB 정보 설정
- [ ] `dist` 폴더 생성 확인
- [ ] DB 연결 테스트 (http://localhost:3000/db-test)
- [ ] 프론트엔드 접속 확인 (http://localhost:3000)
- [ ] API 엔드포인트 동작 확인
- [ ] PM2로 프로세스 관리 설정
