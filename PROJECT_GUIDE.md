# Vue-ASDB 프로젝트 통합 가이드

이 문서는 프로젝트의 검토 결과, 테스트 환경 구축 현황, 그리고 향후 안전한 개발을 위한 개발/운영 환경 분리 가이드를 통합한 문서입니다.

---

## 1. 프로젝트 현황 및 개선 제안 (Project Review)

### 개요
**Vue-ASDB**는 Vue 3와 Node.js 기반의 IT 자산 관리 시스템입니다. 현재 시스템의 안정성을 높이고 기능을 확장하기 위한 작업을 진행 중입니다.

### 주요 개선 필요 사항
1.  **안정성(Stability)**: 테스트 코드 부재 및 입력값 검증 로직 부족. -> **[완료] 테스트 환경 구축됨**
2.  **기능(Features)**: 종합 현황 대시보드 부재, 일괄 작업 기능 필요.
3.  **UI/UX**: 반응형 디자인 미흡, 로딩 처리 부족.

---

## 2. 테스트 환경 및 검증 로직 구축 결과 (Test & Validation)

시스템 안정성 확보를 위해 Frontend와 Backend에 테스트 프레임워크를 도입했습니다.

### Frontend (Vue + Vitest)
- **도구**: `vitest`, `happy-dom`, `@vue/test-utils`
- **테스트 방법**: `npm run test:frontend` (Watch Mode)
- **현재 상태**: 유틸리티(`src/utils/dateUtils.js`)에 대한 단위 테스트가 작성되어 있습니다.

### Backend (Node.js + Jest)
- **도구**: `jest`, `supertest`, `express-validator`
- **테스트 방법**: `npm run test:backend`
- **검증 로직**: `express-validator`를 도입하여 API 요청 시 필수값(예: `asset_number`) 누락을 차단합니다.
- **현재 상태**: 자산 API(`backend/tests/assets.test.js`)에 대한 통합 테스트(DB Mocking)가 작성되어 있습니다.

### 전체 테스트 실행
- **명령어**: `npm run test`
- **설명**: 프론트엔드와 백엔드 테스트를 한 번에 순차적으로 실행합니다.

---

## 3. 개발 및 배포 환경 분리 가이드 (Development Workflow)

운영 중인 서비스에 영향을 주지 않고 안전하게 기능을 추가하기 위해 **DB와 폴더를 분리**하는 전략입니다.

### 핵심 원칙
1.  **DB 분리**: 운영 DB(`assetdb`) vs 개발 DB(`assetdb_dev`)
2.  **폴더 분리**: 운영 폴더(`vue-asdb02`) vs 개발 폴더(`vue-asdb02-dev`)

### 구축 단계
1.  **DB 생성**: MySQL에서 `assetdb_dev` 데이터베이스 생성 후 테이블 스키마 적용.
2.  **폴더 복제**: `git clone` 또는 복사를 통해 `vue-asdb02-dev` 폴더 생성.
3.  **환경 설정**: 개발 폴더의 `.env` 파일 수정.
    ```ini
    DB_HOST=localhost
    DB_NAME=assetdb_dev
    SERVER_PORT=3005
    VITE_PORT=5175
    VITE_API_URL=http://localhost:3005
    ```

### 개발 사이클
1.  `vue-asdb02-dev` 폴더에서 코드 수정 및 `npm run test` 실행.
2.  `npm run dev:all`로 (3001번 포트, 개발 DB) 확인.
3.  검증 완료 후 `vue-asdb02`(운영 폴더)로 코드 병합(Git Pull) 또는 복사.
4.  운영 서버 재시작 (`pm2 restart all`).

---

> 이 문서는 기존의 `project_review.md`, `implementation_plan.md`, `walkthrough.md`, `development_workflow.md` 내용을 통합하여 작성되었습니다.
