# 1단계: 프론트엔드 빌드 스테이지
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# 프론트엔드 패키지 파일 복사 및 설치
COPY package*.json ./
RUN npm install --ignore-scripts

# 소스 코드 복사 및 빌드 (dist 폴더 생성)
COPY . .
RUN npm run build

# 2단계: 프로덕션 런타임 스테이지
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV SERVER_PORT=3000

# 백엔드 의존성 설치
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# 백엔드 코드 복사
COPY backend ./backend

# 1단계에서 빌드된 프론트엔드 정적 파일(dist) 복사
COPY --from=frontend-builder /app/dist ./dist

# 포트 노출
EXPOSE 3000

# 서버 실행
CMD ["node", "backend/server.js"]
