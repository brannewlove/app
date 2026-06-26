# ASDB 코드 수정 후 적용(배포) 가이드

소스 코드(`.vue`, `.js` 등)를 수정하고 저장했지만 실제 화면이나 백엔드 서버에 반영되지 않는 현상은, 운영 환경(Production)에서 구동되는 실행 파일 경로와 개발 중인 소스 파일 경로가 다르기 때문입니다.

현재 서버는 다음과 같이 분리되어 운영되고 있습니다:
- **프론트엔드 (Vue)**: 빌드된 결과물을 Nginx (`/var/www/asdb/`)에서 정적으로 서비스함
- **백엔드 (Node.js)**: `pm2`를 통해 백그라운드 프로세스로 서비스됨

따라서 각 영역을 수정했을 때 다음과 같은 절차로 적용해야 합니다.

---

## 1. 프론트엔드 (화면 / UI) 수정 시 적용 방법
경로: `src/` 디렉토리 하위 파일 (`.vue`, `src/api/*.js`, `src/constants/*.js` 등)을 수정한 경우

수정한 내용을 VITE로 빌드(`dist` 묶음)하고, 이를 Nginx가 바라보는 경로(`/var/www/asdb/`)로 복사해야 합니다. 해당 과정은 `package.json`의 `deploy` 명령어로 자동화되어 있습니다.

```bash
# 프로젝트 루트 폴더(/home/leejh87/app_asdb)에서 실행
npm run deploy
```
*💡 `npm run deploy` 내부 동작:*
1. `npm run build`: 소스 코드를 압축 및 번들링하여 `dist/` 폴더 생성
2. `sudo cp -r dist/* /var/www/asdb/`: 생성된 결과물을 Nginx 서비스 폴더로 복사
3. `sudo systemctl reload nginx`: Nginx 새로고침하여 캐시 갱신

> **주의:** 명령어 실행 시 `sudo` 권한이 필요하여 리눅스(`leejh87` 계정) 비밀번호를 물어볼 수 있습니다. (`dlwnsgml1!@` 입력)

---

## 2. 백엔드 (서버 / DB 로직) 수정 시 적용 방법
경로: `backend/` 하위 파일 및 `ecosystem.config.cjs` 등을 수정한 경우

서버가 이전 코드를 메모리에 올려두고 실행 중(`pm2`)이므로, 백엔드 프로세스를 재시작(Restart)하여 수정된 파일을 다시 읽어오도록 해야 합니다.

```bash
# 프로젝트 루트 폴더에서 pm2 데몬 재시작
npm run pm2:stop
npm run pm2:start

# 또는 pm2 명령어를 직접 이용할 수 있습니다.
pm2 restart asdb-app
```
*💡 적용 확인:* `npm run pm2:status` 명령어로 재시작 상태가 잘 구동 중(online)인지 확인할 수 있습니다.

---

## 3. 프론트/백엔드를 동시에 수정한 경우 (전체 반영)

```bash
# 1. 프론트 빌드 및 nginx 반영
npm run deploy

# 2. 백엔드 프로세스 재시작
npx pm2 restart asdb-app
```

### 요약 가이드
- 화면에서 새로고침해도 코드가 반영되지 않아요 👉 **프론트엔드 빌드가 필요합니다 (`npm run deploy`)**
- API 호출 결과나 DB를 다루는 로직이 안 바뀐 것 같아요 👉 **백엔드 재시작이 필요합니다 (`npx pm2 restart asdb-app`)**
