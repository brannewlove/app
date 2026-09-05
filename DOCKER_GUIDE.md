
# 🐳 자산 관리 시스템(ASDB) Docker 설치 및 배포 가이드

본 문서는 **현재 PC(개발 환경)**에서 작업한 내용을 **다른 PC(서버 또는 운영 환경)**에 Docker를 통해 간편하게 설치하고 운영하는 전체 절차를 안내합니다.

---

## 🏗️ 전체 워크플로우 개요

```text
[ 현재 PC (개발 환경) ]                           [ 다른 PC (운영/실행 환경) ]
 1. 코드 수정 및 개발                             1. Docker / Docker Desktop 설치
 2. 로컬 테스트 완료                               2. Git Clone (최초 1회)
 3. GitHub로 Push          ──────────────────>    3. Docker Compose 빌드 & 실행
    (git push origin main)                           (docker compose up -d --build)
```

---

## 1. 사전 준비 (다른 PC에서 진행)

다른 PC에 아래 프로그램이 설치되어 있어야 합니다:

1. **Docker** (Windows/Mac은 [Docker Desktop](https://www.docker.com/products/docker-desktop/), Linux는 Docker Engine & Docker Compose)
2. **Git** ([Git 공식 다운로드](https://git-scm.com/))

---

## 2. [현재 PC] 변경 사항 GitHub에 업로드 (Push)

현재 PC에서 새로 추가된 Docker 관련 파일들을 GitHub에 푸시합니다.

```powershell
# 1. 파일 상태 확인
git status

# 2. 추가된 Docker 설정 파일 스테이징 및 커밋
git add .
git commit -m "feat: Add Docker and docker-compose configuration"

# 3. GitHub에 푸시
git push origin main
```

---

## 3. [다른 PC] 프로젝트 최초 설치 및 실행

### Step 1. 저장소 클론 (다운로드)

다른 PC의 터미널(PowerShell 또는 bash)에서 원하는 폴더로 이동 후 실행합니다.

```bash
git clone https://github.com/brannewlove/app.git
cd app
```

### Step 2. 환경 변수 파일 생성 (.env)

템플릿 파일(`.env.example`)을 복사하여 `.env`를 만듭니다.

* **Windows (PowerShell):**

  ```powershell
  Copy-Item .env.example .env
  ```

* **Linux / macOS:**

  ```bash
  cp .env.example .env
  ```

*(필요 시 `.env` 파일을 열어 `DB_PASSWORD`나 `APP_PORT`를 수정하세요. 기본값으로도 바로 작동합니다.)*

### Step 3. Docker 컨테이너 빌드 및 실행

```bash
docker compose up -d --build
```

* **자동 처리되는 항목:**
  * 프론트엔드(Vue 3) 자동 빌드
  * 백엔드(Express) 서버 설정
  * MySQL 8.0 데이터베이스 컨테이너 구동
  * `DB_SCHEMA.sql`을 읽어와 **초기 데이터베이스 및 테이블 자동 생성**

### Step 4. 접속 확인

* 웹 브라우저에서 `http://localhost:3000` (또는 `http://[다른PC의_IP]:3000`)에 접속합니다.

---

## 4. [이후 업데이트 방법] 개발 PC에서 수정한 내용 배포하기

앞으로 현재 PC에서 코드를 수정한 뒤 다른 PC에 반영할 때는 다음 과정만 거치면 됩니다.

### 1) 현재 PC (개발 PC)

```powershell
git add .
git commit -m "수정 내용 설명"
git push origin main
```

### 2) 다른 PC (운영 PC)

```bash
# 최신 코드 가져오기
git pull origin main

# 도커 컨테이너 재빌드 및 재시작 (무중단 갱신)
docker compose up -d --build
```

---

## 5. 🛠️ 유용한 Docker 관리 명령어

| 작업 | 명령어 |
| :--- | :--- |
| **실행 상태 확인** | `docker compose ps` |
| **실시간 로그 확인** | `docker compose logs -f` |
| **특정 서비스 로그 확인** | `docker compose logs -f app` (또는 `db`) |
| **서비스 중지** | `docker compose stop` |
| **서비스 시작** | `docker compose start` |
| **서비스 종료 및 삭제** | `docker compose down` |
| **DB 데이터까지 완전 초기화** | `docker compose down -v` *(⚠️ DB 데이터가 모두 삭제되므로 주의)* |

---

## 6. 💾 데이터 백업 및 보존 안내

* MySQL 데이터는 Docker 볼륨(`mysql_data`)에 영구 보존되므로, 컨테이너를 재시작하거나 재빌드(`docker compose up -d --build`)해도 **데이터가 사라지지 않습니다.**
* DB 수동 덤프 백업이 필요한 경우:

  ```bash
  docker compose exec db mysqldump -u root -proot1234 assetdb > backup.sql
  ```
