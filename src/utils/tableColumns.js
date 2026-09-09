// 기본 테이블 컬럼 설정 정의 및 유틸리티

export const DEFAULT_TABLE_COLUMNS = {
  assets: [
    { key: 'category', label: '분류', visible: true },
    { key: 'model', label: '모델', visible: true },
    { key: 'asset_number', label: '자산번호', visible: true },
    { key: 'serial_number', label: '시리얼번호', visible: true },
    { key: 'state', label: '상태', visible: true },
    { key: 'in_user', label: '사용자ID', visible: true },
    { key: 'user_name', label: '사용자명', visible: true },
    { key: 'user_part', label: '부서', visible: true },
    { key: 'day_of_start', label: '시작일', visible: true },
    { key: 'day_of_end', label: '종료일', visible: true },
    { key: 'unit_price', label: '월단가', visible: true },
    { key: 'contract_month', label: '계약월', visible: true },
    { key: 'memo', label: '자산메모', visible: true },
  ],
  trades: [
    { key: 'trade_id', label: '순번', visible: true },
    { key: 'timestamp', label: '작업시간', visible: true },
    { key: 'work_type', label: '작업유형', visible: true },
    { key: 'asset_number', label: '자산번호', visible: true },
    { key: 'model', label: '모델명', visible: true },
    { key: 'ex_user_info', label: '이전 사용자 정보', visible: true },
    { key: 'new_user_info', label: '변경 사용자 정보', visible: true },
    { key: 'memo', label: '거래메모', visible: true },
  ],
  users: [
    { key: 'cj_id', label: 'CJ ID', visible: true },
    { key: 'name', label: '사용자명', visible: true },
    { key: 'part', label: '부서', visible: true },
    { key: 'sec_level', label: '보안등급', visible: true },
    { key: 'state', label: '상태', visible: true },
  ],
  returns: [
    { key: 'return_type', label: '반납유형', visible: true },
    { key: 'end_date', label: '종료일', visible: true },
    { key: 'model', label: '모델', visible: true },
    { key: 'asset_number', label: '자산번호', visible: true },
    { key: 'return_reason', label: '반납사유', visible: true },
    { key: 'user_name', label: '사용자 정보', visible: true },
    { key: 'handover_date', label: '인계일', visible: true },
    { key: 'release_status', label: '출고여부', visible: true },
    { key: 'it_room_stock', label: '전산실입고', visible: true },
    { key: 'low_format', label: '로우포맷', visible: true },
    { key: 'it_return', label: '전산반납', visible: true },
    { key: 'mail_return', label: '메일반납', visible: true },
    { key: 'actual_return', label: '실재반납', visible: true },
    { key: 'remarks', label: '비고', visible: true },
    { key: 'created_at', label: '생성일', visible: true },
  ],
};

/**
 * 저장된 설정과 기본 설정을 병합하여 누락된 컬럼을 보존하고 순서/표시 여부를 반환
 */
export function mergeTableColumns(tableKey, savedConfig) {
  const defaults = DEFAULT_TABLE_COLUMNS[tableKey] || [];
  if (!Array.isArray(savedConfig) || savedConfig.length === 0) {
    return defaults.map(col => ({ ...col }));
  }

  const defaultMap = new Map(defaults.map(c => [c.key, c]));
  const result = [];
  const visitedKeys = new Set();

  // 1. 저장된 컬럼 순서 및 가시성 적용
  for (const item of savedConfig) {
    if (defaultMap.has(item.key)) {
      const def = defaultMap.get(item.key);
      result.push({
        key: item.key,
        label: def.label, // 최신 라벨 유지
        visible: item.visible !== false,
      });
      visitedKeys.add(item.key);
    }
  }

  // 2. 저장된 설정에 없는 신규 컬럼은 뒤에 추가
  for (const def of defaults) {
    if (!visitedKeys.has(def.key)) {
      result.push({ ...def });
    }
  }

  return result;
}
