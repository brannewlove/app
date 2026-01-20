<script setup>
import { ref, onMounted, watch } from 'vue';
import AutocompleteSearch from './AutocompleteSearch.vue';
import WorkTypeSearch from './WorkTypeSearch.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
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
    console.log('선택된 자산:', item);
    trade.asset_number = assetNumber;
    trade.asset_state = String(item.state || '');
    trade.asset_in_user = String(item.in_user || '');
  }
};

// 초기 5개 행 생성
const initializeForm = () => {
  trades.value = Array.from({ length: 5 }, () => ({}));
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

// 작업유형별 자산 유효성 검사
const validateAssetForWorkType = (item, workType) => {
  if (!workType || workType.trim() === '') {
    return { valid: true };
  }

  if (!item || typeof item !== 'object') {
    return { valid: false, message: 'invalid item' };
  }

  const { state, in_user } = item;

  switch (workType) {
    case '출고-신규지급':
    case '출고-신규교체':
      if (state !== 'wait') {
        return { valid: false, message: `상태가 "${state}"입니다. "wait" 상태만 가능합니다.` };
      }
      break;
    case '출고-사용자변경':
    case '출고-수리':
      if (state !== 'useable') {
        return { valid: false, message: `상태가 "${state}"입니다. "useable" 상태만 가능합니다.` };
      }
      break;
    case '출고-재고교체':
    case '출고-재고지급':
    case '출고-대여':
      if (in_user !== 'cjenc_inno') {
        return { valid: false, message: `보유자가 "${in_user}"입니다. "cjenc_inno"만 가능합니다.` };
      }
      if (state !== 'useable') {
        return { valid: false, message: `상태가 "${state}"입니다. "useable" 상태만 가능합니다.` };
      }
      break;
    case '입고-노후교체':
    case '입고-불량교체':
    case '입고-퇴사반납':
    case '입고-임의반납':
    case '입고-휴직반납':
    case '입고-재입사예정':
      if (in_user === 'cjenc_inno') {
        return { valid: false, message: `보유자가 "${in_user}"입니다. "cjenc_inno"가 아닌 자산만 가능합니다.` };
      }
      if (state !== 'useable') {
        return { valid: false, message: `상태가 "${state}"입니다. "useable" 상태만 가능합니다.` };
      }
      break;
    case '입고-대여반납':
      if (in_user === 'cjenc_inno') {
        return { valid: false, message: `보유자가 "${in_user}"입니다. "cjenc_inno"가 아닌 자산만 가능합니다.` };
      }
      if (state !== 'rent') {
        return { valid: false, message: `상태가 "${state}"입니다. "rent" 상태만 가능합니다.` };
      }
      break;
    case '입고-수리반납':
      if (state !== 'repair') {
        return { valid: false, message: `상태가 "${state}"입니다. "repair" 상태만 가능합니다.` };
      }
      break;
  }
  return { valid: true };
};

const getFixedCjId = (workType) => {
  const fixedMap = {
    '입고-노후교체': 'cjenc_inno',
    '입고-불량교체': 'cjenc_inno',
    '입고-퇴사반납': 'cjenc_inno',
    '입고-휴직반납': 'no-change',
    '입고-재입사예정': 'no-change',
    '입고-임의반납': 'cjenc_inno',
    '입고-대여반납': 'cjenc_inno',
    '입고-수리반납': 'no-change',
    '반납-노후반납': 'aj_rent',
    '반납-고장교체': 'aj_rent',
    '반납-조기반납': 'aj_rent',
    '반납-폐기': 'aj_rent',
    '반납': 'aj_rent',
    '출고-수리': 'no-change'
  };
  return fixedMap[workType] || '';
};

const getFixedCjIdDisplay = (workType) => {
  const displayMap = {
    '입고-노후교체': '회사 입고 (자동)',
    '입고-불량교체': '회사 입고 (자동)',
    '입고-퇴사반납': '회사 입고 (자동)',
    '입고-휴직반납': '현재 보유자 유지 (자동)',
    '입고-재입사예정': '현재 보유자 유지 (자동)',
    '입고-임의반납': '회사 입고 (자동)',
    '입고-대여반납': '회사 입고 (자동)',
    '입고-수리반납': '현재 보유자 유지 (자동)',
    '반납-노후반납': '반납처 (자동)',
    '반납-고장교체': '반납처 (자동)',
    '반납-조기반납': '반납처 (자동)',
    '반납-폐기': '반납처 (자동)',
    '반납': '반납처 (자동)',
    '출고-수리': '현재 보유자 유지 (자동)'
  };
  return displayMap[workType] || '';
};

const isCjIdDisabled = (workType) => {
  const fixedFields = [
    '입고-노후교체', '입고-불량교체', '입고-퇴사반납', '입고-휴직반납',
    '입고-재입사예정', '입고-임의반납', '입고-대여반납', '입고-수리반납',
    '반납','반납-노후반납', '반납-고장교체', '반납-조기반납', '반납-폐기',
    '출고-수리'
  ];
  return fixedFields.includes(workType);
};

const getAssetApiParams = (workType) => {
  if (!workType) return {};
  switch (workType) {
    case '출고-신규지급':
    case '출고-신규교체':
      return { state: 'wait' };
    case '출고-사용자변경':
    case '출고-수리':
    case '입고-노후교체':
    case '입고-불량교체':
    case '입고-퇴사반납':
    case '입고-임의반납':
    case '입고-휴직반납':
    case '입고-재입사예정':
      return { state: 'useable' };
    case '출고-재고교체':
    case '출고-재고지급':
    case '출고-대여':
      return { state: 'useable', in_user: 'cjenc_inno' };
    case '입고-대여반납':
      return { state: 'rent' };
    case '입고-수리반납':
      return { state: 'repair' };
    default:
      return {};
  }
};

const validateTrade = (trade) => {
  const { work_type, asset_number, cj_id, asset_state, asset_in_user } = trade;
  if (!work_type) return { valid: false, message: '작업 유형을 선택해주세요.' };

  trade.ex_user = asset_in_user || '';
  if (!asset_number) return { valid: false, message: '자산 ID를 선택해주세요.' };

  switch (work_type) {
    case '출고-신규지급':
      if (asset_state !== 'wait') return { valid: false, message: '신규지급은 상태가 "wait"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '신규지급은 CJ ID를 선택해주세요.' };
      break;
    case '출고-사용자변경':
      if (asset_state !== 'useable') return { valid: false, message: '사용자변경은 상태가 "useable"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '사용자변경은 CJ ID를 선택해주세요.' };
      if (asset_in_user && cj_id === asset_in_user) return { valid: false, message: '사용자변경은 현재 사용자와 다른 사용자를 선택해야 합니다.' };
      break;
    case '출고-재고교체':
      if (asset_in_user !== 'cjenc_inno') return { valid: false, message: '재고교체는 in_user가 "cjenc_inno"인 자산만 가능합니다.' };
      if (asset_state !== 'useable') return { valid: false, message: '재고교체은 상태가 "useable"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '재고교체는 CJ ID를 선택해주세요.' };
      break;
    case '출고-신규교체':
      if (asset_state !== 'wait') return { valid: false, message: '신규교체는 상태가 "wait"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '신규교체는 CJ ID를 선택해주세요.' };
      break;
    case '출고-재고지급':
      if (asset_in_user !== 'cjenc_inno') return { valid: false, message: '재고지급은 in_user가 "cjenc_inno"인 자산만 가능합니다.' };
      if (asset_state !== 'useable') return { valid: false, message: '재고지급은 상태가 "useable"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '재고지급은 CJ ID를 선택해주세요.' };
      break;
    case '출고-대여':
      if (asset_in_user !== 'cjenc_inno') return { valid: false, message: '대여는 in_user가 "cjenc_inno"인 자산만 가능합니다.' };
      if (asset_state !== 'useable') return { valid: false, message: '대여는 상태가 "useable"인 자산만 가능합니다.' };
      if (!cj_id) return { valid: false, message: '대여는 CJ ID를 선택해주세요.' };
      break;
    case '출고-수리':
      if (asset_state !== 'useable') return { valid: false, message: '수리는 상태가 "useable"인 자산만 가능합니다.' };
      break;
    case '입고-노후교체':
    case '입고-불량교체':
    case '입고-퇴사반납':
    case '입고-임의반납':
    case '입고-휴직반납':
    case '입고-재입사예정':
      if (asset_in_user === 'cjenc_inno') return { valid: false, message: `${work_type}은 in_user가 "cjenc_inno"가 아닌 자산만 가능합니다.` };
      if (asset_state !== 'useable') return { valid: false, message: `${work_type}은 상태가 "useable"인 자산만 가능합니다.` };
      break;
    case '입고-대여반납':
      if (asset_in_user === 'cjenc_inno') return { valid: false, message: '대여반납은 in_user가 "cjenc_inno"가 아닌 자산만 가능합니다.' };
      if (asset_state !== 'rent') return { valid: false, message: '대여반납은 상태가 "rent"인 자산만 가능합니다.' };
      break;
    case '입고-수리반납':
      if (asset_state !== 'repair') return { valid: false, message: '수리반납은 상태가 "repair"인 자산만 가능합니다.' };
      break;
  }

  if (isCjIdDisabled(work_type)) {
    const fixedValue = getFixedCjId(work_type);
    if (fixedValue === 'no-change') {
      if (asset_in_user) trade.cj_id = asset_in_user;
    } else if (fixedValue) {
      trade.cj_id = fixedValue;
    }
  }

  return { valid: true };
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
    delete tradeForSubmit.asset_state;
    delete tradeForSubmit.asset_in_user;
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

    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validTrades)
    });

    const result = await response.json();
    if (result.success) {
      successMessage.value = result.message;
      registeredTrades.value = validTrades;
      emit('success');
      setTimeout(() => {
        initializeForm();
      }, 2000);
    } else {
      error.value = result.error || '등록 실패';
    }
  } catch (err) {
    error.value = err.message;
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
        <div v-if="successMessage" class="alert alert-success">✅ {{ successMessage }}</div>
        <div v-if="loading" class="alert alert-info">⏳ 등록 중...</div>

        <div class="register-section">
          <div class="table-wrapper">
            <table class="register-table">
              <thead>
                <tr>
                  <th class="row-number">#</th>
                  <th>작업 유형</th>
                  <th>자산 ID</th>
                  <th>CJ ID</th>
                  <th>메모</th>
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
                      @select="(item) => trade.work_type = String(item.work_type || '')"
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
                    <input v-model="trade.memo" type="text" placeholder="메모" class="form-input" />
                  </td>
                  <td class="action">
                    <button @click="removeRow(index)" class="btn-delete-row" title="삭제">🗑️</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="button-group">
            <button @click="addRow" class="btn btn-add">+ 행 추가</button>
            <button @click="submitTrades" :disabled="loading" class="btn btn-submit">
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
                  <th>메모</th>
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

.table-wrapper {
  overflow: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  height: 500px; /* 높이 고정으로 아래 버튼 위치 고정 및 초기 범위 확보 */
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

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-add { background: #777; color: white; }
.btn-submit { background: var(--brand-blue); color: white; }
.btn-submit:disabled { background: var(--border-color); cursor: not-allowed; }

.btn-delete-row {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 5px;
  border-radius: 4px;
}
.btn-delete-row:hover { background: #f0f0f0; }

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
</style>
