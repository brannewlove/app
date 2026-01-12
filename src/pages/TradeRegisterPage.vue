<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import AutocompleteSearch from '../components/AutocompleteSearch.vue';

const trades = ref([]);
const loading = ref(false);
const error = ref(null);
const successMessage = ref(null);
const registeredTrades = ref([]); // 등록된 기록 임시 저장

// 자산 선택 시 처리
const handleAssetSelect = (item, trade, index) => {
  if (item && typeof item === 'object') {
    const assetNumber = String(item.asset_number || '');
    console.log('선택된 자산:', item);
    trade.asset_id = assetNumber;
    trade.asset_state = String(item.state || '');
    trade.asset_in_user = String(item.in_user || '');
  }
};

// 초기 5개 행 생성
const initializeForm = () => {
  trades.value = Array.from({ length: 5 }, () => ({}));
};

// 입력 필드 추가
const addRow = () => {
  trades.value.push({});
};

// 행 제거
const removeRow = (index) => {
  trades.value.splice(index, 1);
};

// 작업유형별 자산 유효성 검사
const validateAssetForWorkType = (item, workType) => {
  // 작업유형이 선택되지 않으면 모든 자산 표시
  if (!workType || workType.trim() === '') {
    return { valid: true };
  }

  if (!item || typeof item !== 'object') {
    return { valid: false, message: 'invalid item' };
  }

  const { state, in_user, asset_number } = item;
  console.log('validateAssetForWorkType:', { 
    asset_number, 
    workType, 
    state, 
    in_user,
    itemKeys: Object.keys(item)
  });

  switch (workType) {
    case '이동':
      // 유효성체크: assets의 state가 useable
      if (state !== 'useable') {
        console.log(`❌ 이동: state="${state}", required="useable"`);
        return { valid: false, message: `상태가 "${state}"입니다. "useable" 상태인 자산만 이동 가능합니다.` };
      }
      console.log(`✅ 이동: valid`);
      break;

    case '대여':
      // 유효성체크: assets의 in_user가 cjenc_inno, assets의 state가 useable
      console.log('대여 체크 - in_user:', in_user, 'state:', state, 'match:', in_user === 'cjenc_inno' && state === 'useable');
      if (in_user !== 'cjenc_inno') {
        console.log(`❌ 대여: in_user="${in_user}", required="cjenc_inno"`);
        return { valid: false, message: `보유자가 "${in_user}"입니다. "cjenc_inno"만 대여 가능합니다.` };
      }
      if (state !== 'useable') {
        console.log(`❌ 대여: state="${state}", required="useable"`);
        return { valid: false, message: `상태가 "${state}"입니다. "useable" 상태인 자산만 대여 가능합니다.` };
      }
      console.log(`✅ 대여: valid`);
      break;

    case '수리반납':
      // 유효성체크: assets의 state가 repair
      if (state !== 'repair') {
        console.log(`❌ 수리반납: state="${state}", required="repair"`);
        return { valid: false, message: `상태가 "${state}"입니다. "repair" 상태인 자산만 수리반납 가능합니다.` };
      }
      console.log(`✅ 수리반납: valid`);
      break;

    case '대여반납':
      // 유효성체크: assets의 state가 rent
      if (state !== 'rent') {
        console.log(`❌ 대여반납: state="${state}", required="rent"`);
        return { valid: false, message: `상태가 "${state}"입니다. "rent" 상태인 자산만 대여반납 가능합니다.` };
      }
      console.log(`✅ 대여반납: valid`);
      break;

    case '입고':
    case '반납':
    case '수리':
    case '입고(재입사)':
      // 이 작업들은 모든 자산 허용
      return { valid: true };
  }

  return { valid: true };
};

// 작업유형별 고정 사용자값 매핑
const getFixedCjId = (workType) => {
  const fixedMap = {
    '입고': 'cjenc_inno',
    '입고(재입사)': 'cjenc_inno',
    '반납': 'aj_rent',
    '수리': 'no-change',  // 사용자 변경 안 함
    '대여반납': 'cjenc_inno',
    '수리반납': 'no-change'  // 사용자 변경 안 함
  };
  return fixedMap[workType] || '';
};

// 작업유형별 고정 사용자 표시명 매핑
const getFixedCjIdDisplay = (workType) => {
  const displayMap = {
    '입고': '회사 입고 (자동)',
    '입고(재입사)': '회사 입고 (재입사)',
    '반납': '반납처 (자동)',
    '수리': '수리 대기 (자동)',
    '대여반납': '회사 반납 (자동)',
    '수리반납': '수리 완료 (자동)'
  };
  return displayMap[workType] || '';
};

// 작업유형별 필드 비활성화 여부 확인
const isCjIdDisabled = (workType) => {
  const fixedFields = ['입고', '입고(재입사)', '반납', '수리', '대여반납', '수리반납'];
  return fixedFields.includes(workType);
};

// 작업유형별 검증
const validateTrade = (trade) => {
  const { work_type, asset_id, cj_id, asset_state, asset_in_user, asset_current_user } = trade;

  if (!work_type) {
    return { valid: false, message: '작업 유형을 선택해주세요.' };
  }

  // 반납, 수리는 자산 ID 선택 불필수
  if (!['반납', '수리'].includes(work_type) && !asset_id) {
    return { valid: false, message: '자산 ID를 선택해주세요.' };
  }

  // 작업유형별 유효성 검사
  switch (work_type) {
    case '이동':
      // 유효성체크: assets의 state가 useable
      if (asset_state !== 'useable') {
        return { valid: false, message: '이동 작업은 상태가 "useable"인 자산만 가능합니다.' };
      }
      if (!cj_id) {
        return { valid: false, message: '이동 작업은 CJ ID를 선택해주세요.' };
      }
      // 이동 작업: 현재 사용자와 다른 사용자 선택 필수
      if (asset_in_user && cj_id === asset_in_user) {
        return { valid: false, message: '이동 작업은 현재 사용자와 다른 사용자를 선택해야 합니다.' };
      }
      break;

    case '대여':
      // 유효성체크: assets의 in_user가 cjenc_inno, assets의 state가 useable
      if (asset_in_user !== 'cjenc_inno') {
        return { valid: false, message: '대여 작업은 in_user가 "cjenc_inno"인 자산만 가능합니다.' };
      }
      if (asset_state !== 'useable') {
        return { valid: false, message: '대여 작업은 상태가 "useable"인 자산만 가능합니다.' };
      }
      if (!cj_id) {
        return { valid: false, message: '대여 작업은 CJ ID를 선택해주세요.' };
      }
      break;

    case '수리반납':
      // 유효성체크: assets의 state가 repair
      if (asset_state !== 'repair') {
        return { valid: false, message: '수리반납 작업은 상태가 "repair"인 자산만 가능합니다.' };
      }
      break;

    case '대여반납':
      // 유효성체크: assets의 state가 rent
      if (asset_state !== 'rent') {
        return { valid: false, message: '대여반납 작업은 상태가 "rent"인 자산만 가능합니다.' };
      }
      break;
  }

  // 사용자 선택이 불필요한 작업 유형 처리
  if (isCjIdDisabled(work_type)) {
    // 반납, 대여반납은 고정값으로 설정
    if (['반납', '대여반납'].includes(work_type)) {
      const fixedValue = getFixedCjId(work_type);
      if (fixedValue) {
        trade.cj_id = fixedValue;
      }
    }
    // 수리, 수리반납은 현재 자산의 in_user로 유지
    else if (['수리', '수리반납'].includes(work_type)) {
      if (asset_in_user) {
        trade.cj_id = asset_in_user;
      }
    }
    // 입고/입고(재입사)는 고정값으로 설정
    else if (['입고', '입고(재입사)'].includes(work_type)) {
      const fixedValue = getFixedCjId(work_type);
      if (fixedValue) {
        trade.cj_id = fixedValue;
      }
    }
  }

  return { valid: true };
};

// 데이터 등록
const submitTrades = async () => {
  // 유효성 검사
  const validTrades = [];
  let hasError = false;
  let errorMsg = '';

  for (let i = 0; i < trades.value.length; i++) {
    const trade = trades.value[i];
    
    // 빈 행 무시
    if (!Object.values(trade).some(value => value && String(value).trim() !== '')) {
      continue;
    }

    // 각 거래 검증
    const validation = validateTrade(trade);
    if (!validation.valid) {
      hasError = true;
      errorMsg = `${i + 1}번 행: ${validation.message}`;
      break;
    }

    // 유효성 검사용 필드 제거 후 등록 데이터에 추가
    const tradeForSubmit = { ...trade };
    delete tradeForSubmit.asset_current_user;
    delete tradeForSubmit.asset_state;
    delete tradeForSubmit.asset_in_user;
    delete tradeForSubmit.cj_name;
    
    validTrades.push(tradeForSubmit);
  }

  if (hasError) {
    error.value = errorMsg;
    successMessage.value = null;
    return;
  }

  if (validTrades.length === 0) {
    error.value = '등록할 거래 데이터가 없습니다.';
    successMessage.value = null;
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    successMessage.value = null;

    const response = await fetch('http://localhost:3000/api/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validTrades)
    });

    const result = await response.json();

    if (result.success) {
      successMessage.value = result.message;
      error.value = null;
      // 등록된 기록 저장 (유지)
      registeredTrades.value = validTrades;
      // 폼 초기화
      setTimeout(() => {
        initializeForm();
        successMessage.value = null;
      }, 2000);
    } else {
      error.value = result.error || '등록 실패';
      successMessage.value = null;
    }
  } catch (err) {
    error.value = err.message;
    successMessage.value = null;
  } finally {
    loading.value = false;
  }
};

// 폼 초기화
const resetForm = () => {
  initializeForm();
  error.value = null;
  successMessage.value = null;
  registeredTrades.value = [];
};

// 마운트 시 초기 5개 행 생성
onMounted(() => {
  initializeForm();
});
</script>

<template>
  <div class="page-content">
    <h1>거래 등록</h1>

    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>

    <div v-if="successMessage" class="alert alert-success">
      ✅ {{ successMessage }}
    </div>

    <div v-if="loading" class="alert alert-info">
      ⏳ 등록 중...
    </div>

    <div class="register-section">
      <div class="form-info">
        <p>거래 정보를 입력하고 등록 버튼을 클릭하세요.</p>
        <p class="form-hint">빈 행은 무시되고, 입력된 행만 등록됩니다.</p>
      </div>

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
            <tr v-for="(trade, index) in trades" :key="index"
              :class="{ 'stripe': index % 2 === 1 }">
              <td class="row-number">{{ index + 1 }}</td>
              <td>
                <select
                  v-model="trade.work_type"
                  class="form-input"
                >
                  <option value="">-- 선택 --</option>
                  <option value="이동">이동</option>
                  <option value="입고">입고</option>
                  <option value="입고(재입사)">입고(재입사)</option>
                  <option value="반납">반납</option>
                  <option value="대여">대여</option>
                  <option value="수리">수리</option>
                  <option value="대여반납">대여반납</option>
                  <option value="수리반납">수리반납</option>
                </select>
              </td>
              <td>
                <AutocompleteSearch
                  :initial-value="trade.asset_id || ''"
                  placeholder="자산번호 선택"
                  api-table="assets"
                  api-column="asset_number"
                  :id="`asset_number_${index}`"
                  :validate-item="(item) => validateAssetForWorkType(item, trade.work_type)"
                  @select="(item) => handleAssetSelect(item, trade, index)"
                />
              </td>
              <td>
                <div v-if="isCjIdDisabled(trade.work_type)" style="display: flex; align-items: center; height: 40px; padding: 0 10px; background-color: #f0f0f0; border-radius: 4px; border: 1px solid #d0d0d0; font-size: 13px; color: #666;">
                  {{ getFixedCjIdDisplay(trade.work_type) }}
                </div>
                <AutocompleteSearch
                  v-else
                  :initial-value="trade.cj_name || trade.cj_id || ''"
                  placeholder="이름 선택"
                  api-table="users"
                  api-column="cj_id"
                  :id="`cj_id_${index}`"
                  @select="(item) => {
                    if (item && typeof item === 'object') {
                      // cj_id는 실제 ID, name은 표시명
                      trade.cj_id = String(item.cj_id || '');
                      trade.cj_name = String(item.name || '');
                      console.log('선택된 사용자:', { cj_id: trade.cj_id, cj_name: trade.cj_name });
                    }
                  }"
                />
              </td>
              <td>
                <input
                  v-model="trade.memo"
                  type="text"
                  placeholder="메모"
                  class="form-input"
                />
              </td>
              <td class="action">
                <button
                  @click="removeRow(index)"
                  class="btn btn-delete"
                  title="삭제"
                >
                  🗑️
                </button>
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

    <!-- 등록된 기록 표시 -->
    <div v-if="registeredTrades.length > 0" class="registered-trades-section">
      <h2>등록된 거래 기록</h2>
      <div class="registered-table-wrapper">
        <table class="registered-table">
          <thead>
            <tr>
              <th class="row-number">#</th>
              <th>작업 유형</th>
              <th>자산번호</th>
              <th>CJ ID</th>
              <th>메모</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(trade, index) in registeredTrades" :key="index"
              :class="{ 'stripe': index % 2 === 1 }">
              <td class="row-number">{{ index + 1 }}</td>
              <td>{{ trade.work_type }}</td>
              <td>{{ trade.asset_id }}</td>
              <td>{{ trade.cj_id }}</td>
              <td>{{ trade.memo || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="fade-notice">새로고침하면 사라집니다</p>
    </div>
  </div>
</template>

<style scoped>
.page-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
  border-bottom: 3px solid #999;
  padding-bottom: 10px;
}

.alert {
  padding: 15px 20px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 16px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.alert-error {
  background: #fef2f2;
  color: #e74c3c;
  border-left: 4px solid #e74c3c;
}

.alert-success {
  background: #f5f5f5;
  color: #666;
  border-left: 4px solid #999;
}

.alert-info {
  background: #f5f5f5;
  color: #666;
  border-left: 4px solid #999;
}

.register-section {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.form-info {
  background: #f5f5f5;
  padding: 15px 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  border-left: 4px solid #999;
}

.form-info p {
  margin: 8px 0;
  color: #555;
  font-size: 14px;
}

.form-hint {
  color: #999;
  font-size: 13px;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: scroll;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  -webkit-overflow-scrolling: touch;
  height: 500px;
}

.register-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  min-width: max-content;
  background: white;
}

.register-table thead {
  background: #4a4a4a;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.register-table th {
  padding: 12px;
  text-align: left;
  font-weight: bold;
  border-bottom: 2px solid #333;
}

.register-table th.row-number,
.register-table th.action {
  width: 50px;
  text-align: center;
}

.register-table td {
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.register-table td.row-number,
.register-table td.action {
  text-align: center;
  width: 50px;
}

.register-table tbody tr {
  transition: background 0.2s ease;
}

.register-table tbody tr.stripe {
  background: #f9f9f9;
}

.register-table tbody tr:hover {
  background: #f0f0f0;
}

.form-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 13px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #999;
  box-shadow: 0 0 0 2px rgba(153, 153, 153, 0.1);
  background: #fafbff;
}

.form-input:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
  color: #999;
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
  font-size: 14px;
}

.btn-add {
  background: #777;
  color: white;
}

.btn-add:hover {
  background: #666;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(119, 119, 119, 0.3);
}

.btn-reset {
  background: #95a5a6;
  color: white;
}

.btn-reset:hover {
  background: #7f8c8d;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(149, 165, 166, 0.3);
}

.btn-submit {
  background: #5e88af;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #4a6f8f;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(94, 136, 175, 0.3);
}

.btn-submit:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.7;
}

.btn-delete {
  background: #af5e5e;
  color: white;
  padding: 6px 10px;
  font-size: 12px;
  min-width: auto;
}

.btn-delete:hover {
  background: #8f4a4a;
  transform: translateY(-2px);
}

.registered-trades-section {
  margin-top: 40px;
  padding: 20px;
  background: #f5f5f5;
  border: 2px solid #999;
  border-radius: 8px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.registered-trades-section h2 {
  color: #666;
  margin: 0 0 15px 0;
  font-size: 18px;
}

.registered-table-wrapper {
  overflow-x: auto;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 15px;
}

.registered-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: white;
}

.registered-table thead {
  background: #777;
  color: white;
}

.registered-table th {
  padding: 10px;
  text-align: left;
  font-weight: bold;
  border-bottom: 1px solid #e0e0e0;
}

.registered-table td {
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.registered-table td.row-number {
  text-align: center;
  width: 50px;
  font-weight: bold;
}

.registered-table tbody tr {
  transition: background 0.2s ease;
}

.registered-table tbody tr.stripe {
  background: #f9f9f9;
}

.registered-table tbody tr:hover {
  background: #f0f0f0;
}

.fade-notice {
  text-align: center;
  color: #999;
  font-size: 13px;
  margin: 0;
  font-weight: bold;
}
</style>
