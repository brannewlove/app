# 변경 Export 기능 구현 완료

## 기능 개요
사용자가 자산의 현재 사용자를 확인(Export)하면서, 확인된 항목을 추적하고 사용자 변경 시 자동으로 확인 상태를 초기화하는 기능입니다.

## 아키텍처

### 1. 데이터베이스 (`confirmed_assets` 테이블)
```
id: INT AUTO_INCREMENT
asset_id: VARCHAR(100) - 자산ID
cj_id: VARCHAR(50) - 확인 시점의 사용자ID
confirmed_at: TIMESTAMP - 확인 시간
UNIQUE KEY (asset_id, cj_id)
```

### 2. 백엔드 API (`/api/confirmedAssets`)

#### GET `/api/confirmedAssets`
- 모든 확인된 자산 조회
- 응답: `{ success: true, data: [{ id, asset_id, cj_id, confirmed_at }, ...] }`

#### POST `/api/confirmedAssets`
- 자산 확인 저장
- 요청: `{ asset_id, cj_id }`
- 동일한 asset_id-cj_id 쌍이 존재하면 confirmed_at 업데이트

#### DELETE `/api/confirmedAssets/:assetId/:cj_id`
- 특정 자산의 특정 사용자 확인 삭제

#### DELETE `/api/confirmedAssets/:assetId`
- 자산의 모든 확인 기록 삭제

### 3. 프론트엔드 상태 관리

#### 메모리 상태 (excludedAssets)
```javascript
{
  "자산ID": {
    checked: boolean,
    cj_id: string  // 확인 시점의 사용자
  }
}
```

#### 주요 함수

**loadConfirmedAssets()**
- 모달 오픈 시 호출
- DB에서 확인된 자산 로드
- excludedAssets 메모리에 복구

**fetchExportAssets()**
- API에서 현재 사용자 정보 조회
- 각 자산의 현재 사용자와 저장된 사용자 비교
- 사용자 변경 감지 시:
  - 메모리에서 해당 항목 삭제
  - DB에서도 해당 항목 삭제 (`deleteConfirmedAsset` 호출)

**toggleAssetExclude(assetId)**
- 체크: DB에 저장 (`saveConfirmedAsset`)
- 언체크: DB에서 삭제 (`deleteConfirmedAsset`)

**toggleAllExclude(event)**
- 모두 선택: 체크되지 않은 항목들을 모두 DB에 저장
- 모두 해제: 모든 확인 기록을 DB에서 삭제

**downloadExportData()**
- 체크되지 않은 자산들만 CSV로 다운로드

## 워크플로우

1. **모달 오픈**
   - "변경 Export" 버튼 클릭 → `openExportModal()` 호출
   - `fetchExportAssets()` 실행
   - DB에서 확인된 자산 로드: `loadConfirmedAssets()`

2. **사용자 변경 감지** (fetchExportAssets에서)
   - 저장된 cj_id ≠ 현재 cj_id → 자동 삭제
   - 콘솔: "자산 변경 감지! 체크 해제 및 DB에서 삭제"

3. **체크박스 조작**
   - 체크: DB INSERT (asset_id, cj_id)
   - 언체크: DB DELETE (asset_id, cj_id)

4. **CSV 다운로드**
   - 체크된 항목 제외
   - 미확인 자산들만 다운로드

## localStorage 제거 완료
- 기존: localStorage에 `{ assetId: cj_id }` 형태로 저장 (용량 문제)
- 현재: DB 저장만 사용, localStorage 미사용
- 이점: 용량 제한 없음, 영구 저장, 다중 사용자 공유 가능

## 테이블 구조
```sql
CREATE TABLE confirmed_assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id VARCHAR(100) NOT NULL,
  cj_id VARCHAR(50) NOT NULL,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_asset_user (asset_id, cj_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_cj_id (cj_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 주요 파일
- `/backend/routes/confirmedAssets.js` - API 엔드포인트
- `/backend/app.js` - 라우트 등록
- `/src/pages/TradePage.vue` - 프론트엔드 UI & 로직
- `/DB_SETUP.sql` - 테이블 정의

## 테스트 시나리오
1. "변경 Export" 클릭 → 자산 목록 표시
2. 자산 1개 체크 → 해당 자산과 사용자ID가 DB에 저장됨
3. DB에서 해당 자산의 사용자를 다른 사용자로 변경
4. "변경 Export" 다시 클릭 → 해당 자산의 체크 자동 해제
5. CSV 다운로드 → 체크된 항목 제외하고 다운로드
