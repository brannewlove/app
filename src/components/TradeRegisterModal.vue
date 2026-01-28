<script setup>
import { ref, onMounted, watch } from 'vue';
import AutocompleteSearch from './AutocompleteSearch.vue';
import WorkTypeSearch from './WorkTypeSearch.vue';
import { 
  isCjIdDisabled, 
  getFixedCjId, 
  getFixedCjIdDisplay, 
  validateTradeStrict, 
  getWorkTypeConfig,
  getAvailableWorkTypesForAsset
} from '../constants/workTypes';
import assetApi from '../api/assets';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  initialAssetNumber: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'success']);

const trades = ref([]);
const loading = ref(false);
const error = ref(null);
const successMessage = ref(null);
const registeredTrades = ref([]);

// 자산 선택 시 처리
const handleAssetSelect = (item, trade, index) => {
  if (item && typeof item === 'object') {
    const assetNumber = String(item.asset_number || '');
    trade.asset_number = assetNumber;
    trade.asset_state = String(item.state || '');
    trade.asset_in_user = String(item.in_user || '');
    trade.asset_memo = String(item.memo || '');

    // 보유자 유지 작업인 경우 cj_id 자동 채움
    const config = getWorkTypeConfig(trade.work_type);
    if (config && config.fixedCjId === 'no-change') {
      trade.cj_id = trade.asset_in_user;
    }
  }
};

// 초기 5개 행 생성
const initializeForm = async () => {
  if (props.initialAssetNumber) {
    trades.value = [{ asset_number: props.initialAssetNumber }];
    try {
      const asset = await assetApi.getAssetByNumber(props.initialAssetNumber);
      if (asset) {
        handleAssetSelect(asset, trades.value[0], 0);
      }
    } catch (err) {
      console.error('Failed to fetch initial asset:', err);
    }
  } else {
    trades.value = Array.from({ length: 5 }, () => ({}));
  }
  error.value = null;
  successMessage.value = null;
  registeredTrades.value = [];
};

// 입력 필드 추가 (5개씩)
const addRow = () => {
  for (let i = 0; i < 5; i++) {
    trades.value.push({});
  }
};

// 행 제거
const removeRow = (index) => {
  if (trades.value.length > 1) {
    trades.value.splice(index, 1);
  } else {
    trades.value[0] = {}; // 마지막 행은 초기화
  }
};

// ... (existing helper functions if any not replaced, but here we replace most validation logic)

// ... (existing helper functions if any not replaced, but here we replace most validation logic)

// 작업유형별 자산 유효성 검사
const validateAssetForWorkType = (item, workType) => {
  if (!workType || workType.trim() === '') {
    return { valid: true };
  }

  if (!item || typeof item !== 'object') {
    return { valid: false, message: 'invalid item' };
  }

  const assetMock = {
    state: item.state,
    in_user: item.in_user
  };
  
  // validateTradeStrict는 tradeData에 cj_id가 있어야 일부 검사를 수행하지만, 
  // 여기서는 자산 자체의 적합성(상태, 보유자)만 검사하면 되므로 cj_id는 pass
  // 단, validateTradeStrict 내부 구현이 cj_id를 요구하는 경우(출고 등)가 있음.
  // 자산 적합성만 체크하기 위해 mock tradeData 사용.
  const tradeMock = { work_type: workType, cj_id: 'dummy' }; 
  // Note: strict check might fail on cj_id if we don't provide it, but we only case about allowedStates/sourceType here?
  // validateTradeStrict logic checks cj_id existence. 
  // We should split asset validation vs trade complete validation?
  // validateTradeStrict implementation: returns error if asset_state mismatch OR cj_id missing.
  // For autocomplete validation, we mostly care about asset state mismatch.
  // Let's modify usage: ignore 'cj_id missing' error if our goal is just checking asset compatibility.
  
  const result = validateTradeStrict(tradeMock, assetMock);
  if (!result.valid) {
    if (result.message.includes('CJ ID')) return { valid: true };
    return result;
  }
  return { valid: true };
};

const getWorkTypeFilter = (trade) => {
  if (!trade.asset_number || !trade.asset_state) return null;
  const asset = { state: trade.asset_state, in_user: trade.asset_in_user };
  const available = getAvailableWorkTypesForAsset(asset);
  return (wt) => available.some(a => a.id === wt.id);
};

const getAssetApiParams = (workType) => {
  const config = getWorkTypeConfig(workType);
  if (!config) return { apiParams: { fields: 'memo' } };

  const params = {};
  
  // 1. Allowed States -> API 'state' param
  if (config.allowedStates && config.allowedStates.length > 0) {
    if (config.allowedStates.length === 1) {
      params.state = config.allowedStates[0];
    } else {
      // API가 multiple state 지원하는지 확인 필요. 보통 하나만 지원하면 첫번째꺼 혹은 필터링 안함.
      // 현재 로직상 wait, useable, rent, repair 하나씩만 매핑됨.
      params.state = config.allowedStates[0];
    }
  }

  // 2. Source Type -> API 'in_user' param
  if (config.sourceType === 'stock') {
    params.in_user = 'cjenc_inno';
  } 
  // 'user' type means NOT cjenc_inno, API might not support 'ne'. 
  // If so, we strictly rely on client-side validation logic (validateAssetForWorkType).

  // Default fallback for general query if no strict params
  if (Object.keys(params).length === 0) {
    return { apiParams: { fields: 'memo' } };
  }

  return params;
};

const validateTrade = (trade) => {
  const { work_type, asset_number, cj_id, asset_state, asset_in_user } = trade;
  if (!work_type) return { valid: false, message: '작업 유형을 선택해주세요.' };

  const config = getWorkTypeConfig(work_type);
  
  // 재계약 날짜 검증
  if (config?.requiresDates) {
    if (!trade.new_day_of_start) return { valid: false, message: '새로운 시작일을 입력해주세요.' };
    if (!trade.new_day_of_end) return { valid: false, message: '새로운 종료일을 입력해주세요.' };
  }

  trade.ex_user = asset_in_user || '';
  if (!asset_number) return { valid: false, message: '자산 ID를 선택해주세요.' };

  const assetCtx = {
    state: asset_state,
    in_user: asset_in_user
  };
  const tradeCtx = {
    work_type,
    cj_id
  };

  return validateTradeStrict(tradeCtx, assetCtx);
};

const submitTrades = async () => {
  const validTrades = [];
  let hasError = false;
  let errorMsg = '';

  for (let i = 0; i < trades.value.length; i++) {
    const trade = trades.value[i];
    if (!Object.values(trade).some(value => value && String(value).trim() !== '')) continue;

    const validation = validateTrade(trade);
    if (!validation.valid) {
      hasError = true;
      errorMsg = `${i + 1}번 행: ${validation.message}`;
      break;
    }

    const tradeForSubmit = { ...trade };
    // asset_state, asset_in_user, asset_memo 는 저장해야 함
    delete tradeForSubmit.cj_name;
    validTrades.push(tradeForSubmit);
  }

  if (hasError) {
    error.value = errorMsg;
    return;
  }

  if (validTrades.length === 0) {
    error.value = '등록할 거래 데이터가 없습니다.';
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    successMessage.value = null;

    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validTrades)
    });

    const result = await response.json();
    if (result.success) {
      successMessage.value = `${validTrades.length}건의 거래가 성공적으로 등록되었습니다.`;
      registeredTrades.value = validTrades;
      emit('success');
      
      setTimeout(() => {
        initializeForm();
      }, 2000);
    } else {
      error.value = '등록 실패: ' + (result.error || '알 수 없는 오류');
    }
  } catch (err) {
    error.value = '등록 중 오류 발생: ' + err.message;
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) initializeForm();
});

onMounted(() => {
  if (props.isOpen) initializeForm();
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @mousedown.self="emit('close')">
    <div class="modal-content register-modal">
      <div class="modal-header">
        <h2>거래 대량 등록</h2>
        <button @click="emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
        <div v-if="successMessage" class="alert alert-success"><img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ successMessage }}</div>
        <div v-if="loading" class="alert alert-info"><img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 등록 중...</div>

        <div class="register-section">
          <div class="table-container">
            <div class="table-wrapper">
            <table class="register-table">
              <thead>
                <tr>
                  <th class="row-number">#</th>
                  <th style="width: 220px;">작업 유형</th>
                  <th style="width: 180px;">자산 ID</th>
                  <th style="width: 150px;">CJ ID</th>
                  <th>거래메모 / 재계약 정보</th>
                  <th class="action">삭제</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(trade, index) in trades" :key="index" :class="{ 'stripe': index % 2 === 1 }">
                  <td class="row-number">{{ index + 1 }}</td>
                  <td>
                    <WorkTypeSearch
                      :initial-value="trade.work_type || ''"
                      placeholder="유형 선택"
                      :id="`work_type_${index}`"
                      :filter-fn="getWorkTypeFilter(trade)"
                      @select="(item) => {
                        trade.work_type = String(item.work_type || '');
                        const config = getWorkTypeConfig(trade.work_type);
                        if (config && config.fixedCjId === 'no-change' && trade.asset_in_user) {
                          trade.cj_id = trade.asset_in_user;
                        }
                      }"
                    />
                  </td>
                  <td>
                    <AutocompleteSearch
                      :initial-value="trade.asset_number || ''"
                      placeholder="자산번호"
                      api-table="assets"
                      api-column="asset_number"
                      :id="`asset_number_${index}`"
                      :api-params="getAssetApiParams(trade.work_type)"
                      :validate-item="(item) => validateAssetForWorkType(item, trade.work_type)"
                      @select="(item) => handleAssetSelect(item, trade, index)"
                    />
                  </td>
                  <td>
                    <div v-if="isCjIdDisabled(trade.work_type)" class="fixed-val">
                      {{ getFixedCjIdDisplay(trade.work_type) }}
                    </div>
                    <AutocompleteSearch
                      v-else
                      :initial-value="trade.cj_name || trade.cj_id || ''"
                      placeholder="이름/ID"
                      api-table="users"
                      api-column="cj_id"
                      :id="`cj_id_${index}`"
                      @select="(item) => {
                        trade.cj_id = String(item.cj_id || '');
                        trade.cj_name = String(item.name || '');
                      }"
                    />
                  </td>
                  <td>
                    <div class="memo-age-container">
                      <input v-model="trade.memo" type="text" placeholder="거래메모" class="form-input" />
                      <div v-if="getWorkTypeConfig(trade.work_type)?.requiresDates" class="recontract-fields">
                        <div class="field-item">
                          <span>시작:</span>
                          <input v-model="trade.new_day_of_start" type="date" class="form-input mini" />
                        </div>
                        <div class="field-item">
                          <span>종료:</span>
                          <input v-model="trade.new_day_of_end" type="date" class="form-input mini" />
                        </div>
                        <div class="field-item">
                          <span>단가:</span>
                          <input v-model="trade.new_unit_price" type="number" placeholder="월단가" class="form-input mini" />
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="action">
                    <button @click="removeRow(index)" class="btn-delete-row" title="삭제"><img src="/images/recyclebin.png" alt="delete" class="delete-icon" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div> <!-- table-wrapper close -->
        </div> <!-- table-container close -->

        <div class="button-group">
          <button @click="addRow" class="btn btn-modal btn-add">+ 행 추가</button>
          <button @click="submitTrades" :disabled="loading" class="btn btn-modal btn-submit">
            {{ loading ? '등록 중...' : '거래 등록' }}
          </button>
        </div>
      </div>

      <div v-if="registeredTrades.length > 0" class="registered-list">
        <h3>최근 등록 결과</h3>
        <div class="scroll-table">
          <table class="registered-table">
            <thead>
              <tr>
                <th>#</th>
                <th>유형</th>
                <th>자산번호</th>
                <th>CJ ID</th>
                <th>거래메모</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(trade, index) in registeredTrades" :key="index">
                <td>{{ index + 1 }}</td>
                <td>{{ trade.work_type }}</td>
                <td>{{ trade.asset_number }}</td>
                <td>{{ trade.cj_id }}</td>
                <td>{{ trade.memo || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center; /* 화면 정중앙 배치 */
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}

.register-modal {
  max-width: 1200px;
  width: 95%;
  height: 80vh; /* 높이 고정으로 행 추가 시 창 크기 변동 방지 */
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1; /* 남은 공간 차지 */
}

.table-container {
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
}

.table-wrapper {
  overflow: auto;
  max-height: calc(85vh - 300px); /* 모달 높이에 맞게 비례 조정 */
  min-height: 300px;
}

.register-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 800px;
}

.register-table thead {
  background: #4a4a4a;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.register-table th, .register-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.register-table th.row-number, .register-table td.row-number {
  width: 40px;
  text-align: center;
}

.register-table th.action, .register-table td.action {
  width: 50px;
  text-align: center;
}

.fixed-val {
  display: flex;
  align-items: center;
  height: 38px;
  padding: 0 10px;
  background-color: #f0f0f0;
  border-radius: 4px;
  border: 1px solid #d0d0d0;
  font-size: 12px;
  color: #666;
  white-space: nowrap;
}

.form-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
}

.form-input.mini {
  padding: 4px 6px;
  font-size: 11px;
}

.memo-age-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recontract-fields {
  display: flex;
  gap: 8px;
  background: #fdf2f2;
  padding: 6px;
  border-radius: 4px;
  border: 1px dashed #e74c3c;
}

.field-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #c0392b;
  flex: 1;
}

.field-item span {
  white-space: nowrap;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.btn-add { background: #777; color: white; }
.btn-submit { background: var(--brand-blue); color: white; }
.btn-submit:disabled { background: var(--border-color); cursor: not-allowed; }

.btn-delete-row {
  background: var(--error-color);
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.btn-delete-row:hover { 
  background: #c0392b;
}

.btn-delete-row .delete-icon {
  filter: brightness(0) invert(1);
}

.registered-list {
  margin-top: 30px;
  border-top: 2px solid #eee;
  padding-top: 20px;
}
.registered-list h3 { font-size: 16px; color: #666; margin-bottom: 10px; }

.scroll-table {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.registered-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.registered-table th { background: #f5f5f5; padding: 8px; text-align: left; }
.registered-table td { padding: 8px; border-bottom: 1px solid #eee; }

.alert { padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; font-size: 14px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-success { background: #f1f8e9; color: #558b2f; border-left: 4px solid #8bc34a; }
.alert-info { background: #e3f2fd; color: #1976d2; border-left: 4px solid #2196f3; }

.loading-icon, .delete-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
}

.loading-icon {
  margin-right: 4px;
}

.checkmark-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
}

/* 상태 오버레이 스타일 */
.status-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001;
  border-radius: 8px;
  backdrop-filter: blur(2px);
}

.status-box {
  background: white;
  padding: 30px 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
  text-align: center;
  min-width: 320px;
  border: 1px solid #eee;
}

.status-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.status-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.status-message {
  font-size: 16px;
  color: #555;
  margin-bottom: 25px;
  line-height: 1.5;
}

.loading-icon-large {
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
}

.checkmark-icon-large {
  width: 40px;
  height: 40px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.status-footer {
  display: flex;
  justify-content: center;
}
</style>
