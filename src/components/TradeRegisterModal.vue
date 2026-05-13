<script setup>
import { ref, onMounted, watch } from 'vue';
import UserDetailModal from './UserDetailModal.vue';
import { 
  isCjIdDisabled, 
  getFixedCjId, 
  getFixedCjIdDisplay, 
  validateTradeStrict, 
  getWorkTypeConfig
} from '../constants/workTypes';
import assetApi from '../api/assets';
import { getUserByCjId } from '../api/users'; 

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

const rawTsvData = ref('');
const parsedTrades = ref([]);
const loading = ref(false);
const error = ref(null);
const successMessage = ref(null);
const registeredTrades = ref([]);

const isUserDetailOpen = ref(false);
const userDetailCjId = ref('');

const openUserDetail = (cjId) => {
  if (!cjId || cjId === 'cjenc_inno') return;
  userDetailCjId.value = cjId;
  isUserDetailOpen.value = true;
};

const initializeForm = () => {
  rawTsvData.value = '';
  parsedTrades.value = [];
  error.value = null;
  successMessage.value = null;
  registeredTrades.value = [];
  
  // 단일 자산 번호가 있을때 기본 템플릿 제공
  if (props.initialAssetNumber) {
    rawTsvData.value = `작업유형\t자산번호\tCJ ID\t메모\t시작일\t종료일\t단가\n\t${props.initialAssetNumber}\t\t\t\t\t`;
    parseTsvData();
  }
};

const parseTsvData = () => {
  error.value = null;
  successMessage.value = null;
  if (!rawTsvData.value.trim()) {
    parsedTrades.value = [];
    return;
  }
  
  const lines = rawTsvData.value.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length === 0) {
    parsedTrades.value = [];
    return;
  }
  
  const trades = [];
  
  // 첫 줄 헤더 체크 ('작업' 혹은 '유형' 포함)
  const startIndex = (lines[0].includes('작업') || lines[0].includes('유형') || lines[0].includes('자산')) ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    
    // 열 구조: [0]작업유형, [1]자산번호, [2]CJ ID, [3]메모, [4]시작일, [5]종료일, [6]단가
    let work_type = cols[0] || '';
    let asset_number = cols[1] || '';
    let cj_id = cols[2] || '';
    let memo = cols[3] || '';
    let new_day_of_start = cols[4] || '';
    let new_day_of_end = cols[5] || '';
    let new_unit_price = cols[6] || '';

    // 고정 CJ ID 강제 적용 확인
    const config = getWorkTypeConfig(work_type);
    if (config?.fixedCjId && config?.fixedCjId !== 'no-change') {
      cj_id = config.fixedCjId;
    }

    trades.push({
      work_type,
      asset_number,
      cj_id,
      memo,
      new_day_of_start,
      new_day_of_end,
      new_unit_price,
      isValid: false,
      isValidationDone: false,
      validationMessage: '검사 대기중',
      asset_state: '',
      asset_in_user: '',
      ex_user: '',
      cj_name: ''
    });
  }
  
  parsedTrades.value = trades;
};

// 상태 가져오기 요약 등
const getAssetDisplayName = (state) => {
  const stateMap = {
    'useable': '가용',
    'wait': '대기',
    'hold': '홀드',
    'rent': '대여중',
    'repair': '수리중',
    'termination': '반납완료',
    'process-ter': '처리중'
  };
  return stateMap[state] || state;
};

const validateAllTrades = async () => {
  error.value = null;
  loading.value = true;
  successMessage.value = null;

  try {
    for (let i = 0; i < parsedTrades.value.length; i++) {
      const trade = parsedTrades.value[i];
      let rowValid = true;
      let rowMsg = '유효';

      // 1. 필수값 체크
      if (!trade.work_type) {
        rowValid = false;
        rowMsg = '작업유형 누락';
      } else if (!trade.asset_number) {
        rowValid = false;
        rowMsg = '자산번호 누락';
      }

      // 작업유형 설정 가져오기
      const config = getWorkTypeConfig(trade.work_type);
      if (rowValid && !config) {
        rowValid = false;
        rowMsg = '존재하지 않는 작업유형';
      }

      // 2. 외부 데이터 조회 (자산 조회)
      let assetData = null;
      if (rowValid && trade.asset_number) {
        try {
          assetData = await assetApi.getAssetByNumber(trade.asset_number);
          if (!assetData) {
            rowValid = false;
            rowMsg = '존재하지 않는 자산번호';
          } else {
            trade.asset_state = assetData.state;
            trade.asset_in_user = assetData.in_user;
            trade.ex_user = assetData.in_user;
            
            if (config?.fixedCjId === 'no-change') {
               // 보유자가 그대로 유지되는 경우 기본 할당
               trade.cj_id = trade.asset_in_user;
            }
          }
        } catch(e) {
             rowValid = false;
             rowMsg = '자산 정보 조회 실패';
        }
      }

      // 3. CJ ID 검증 (필요한 경우)
      if (rowValid && trade.cj_id && config?.fixedCjId !== 'no-change' && trade.cj_id !== 'cjenc_inno') {
         try {
             // 임직원 정보 조회
             const userResponse = await getUserByCjId(trade.cj_id);
             trade.cj_name = userResponse.name || trade.cj_id;
         } catch(e) {
             // 404 등 사용자가 없으면 실패
             rowValid = false;
             rowMsg = '사용자 정보 없음(CJ ID 확인)';
         }
      }

      // cjenc_inno 등 고정일때는 이름 처리
      if(trade.cj_id === 'cjenc_inno') trade.cj_name = '재고';

      // 4. 모의 검사 (validateTradeStrict)
      if (rowValid) {
        const assetCtx = {
          state: trade.asset_state,
          in_user: trade.asset_in_user
        };
        const tradeCtx = {
          work_type: trade.work_type,
          cj_id: trade.cj_id
        };

        const result = validateTradeStrict(tradeCtx, assetCtx);
        if (!result.valid) {
          rowValid = false;
          rowMsg = result.message || '상태 및 보유자 충돌';
        }
      }

      // 재계약 등 날짜 검토
      if (rowValid && config?.requiresDates) {
        if (!trade.new_day_of_start || !trade.new_day_of_end) {
           rowValid = false;
           rowMsg = '시작/종료일 누락';
        }
      }

      trade.validationMessage = rowMsg;
      trade.isValid = rowValid;
      trade.isValidationDone = true;
    }
  } catch (err) {
    error.value = '유효성 검사 중 시스템 오류: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const submitValidTrades = async () => {
  const validTradesToSubmit = parsedTrades.value.filter(t => t.isValid && t.isValidationDone);
  
  if (validTradesToSubmit.length === 0) {
    error.value = '등록할 유효한 거래가 없거나 유효성 검사가 완료되지 않았습니다.';
    return;
  }

  // 중복 거래 검사 (같은 자산번호에 여러 개의 통과된 거래가 있는지)
  const dedupMap = {};
  for(const t of validTradesToSubmit){
    if(dedupMap[t.asset_number]){
      error.value = `동일 자산(${t.asset_number})에 대한 처리 요청이 중복되었습니다. 하나만 남겨주세요.`;
      return;
    }
    dedupMap[t.asset_number] = true;
  }

  const payload = validTradesToSubmit.map(t => {
      const data = { ...t };
      delete data.isValid;
      delete data.validationMessage;
      delete data.isValidationDone;
      delete data.cj_name;
      return data;
  });

  try {
    loading.value = true;
    error.value = null;

    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.success) {
      successMessage.value = `${payload.length}건의 거래가 성공적으로 등록되었습니다.`;
      registeredTrades.value = payload;
      emit('success');
      
      // 등록 성공한 행 삭제 
      parsedTrades.value = parsedTrades.value.filter(t => !t.isValid || !t.isValidationDone);
      
    } else {
      error.value = '등록 실패: ' + (result.error || '알 수 없는 오류');
    }
  } catch (err) {
    error.value = '등록 중 통신 오류: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const removeRow = (idx) => {
  parsedTrades.value.splice(idx, 1);
};

// ... 모달 오버레이 처리
const isClickStartedOnOverlay = ref(false);

const handleOverlayMouseDown = (e) => {
  isClickStartedOnOverlay.value = e.target.classList.contains('modal-overlay');
};

const handleOverlayMouseUp = (e) => {
  if (isClickStartedOnOverlay.value && e.target.classList.contains('modal-overlay')) {
    emit('close');
  }
  isClickStartedOnOverlay.value = false;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) initializeForm();
});

onMounted(() => {
  if (props.isOpen) initializeForm();
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
    <div class="modal-content register-modal">
      <div class="modal-header">
        <h2>거래 대량 등록 (TSV 붙여넣기)</h2>
        <button @click="emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
        <div v-if="successMessage" class="alert alert-success">
          <img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> {{ successMessage }}
        </div>
        <div v-if="loading" class="alert alert-info">
          <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 
          작업을 진행 중입니다...
        </div>

        <!-- 텍스트 입력 영역 -->
        <div class="paste-section">
          <label class="paste-label">
            엑셀 데이터를 화면에 붙여넣고 파싱 버튼을 누르세요. 
            (형식: 작업유형 / 자산번호 / CJ ID / 메모 / 시작일 / 종료일 / 단가)
          </label>
          <textarea 
            v-model="rawTsvData" 
            class="tsv-textarea" 
            placeholder="여기에 엑셀 데이터를 붙여넣으세요...&#13;&#10;신규-지급&#9;ABC1234&#9;my_user&#9;지급메모&#13;&#10;반납-퇴사&#9;XYZ9876&#9;&#9;반납메모"
          ></textarea>
          <div class="button-group-left">
            <button @click="parseTsvData" class="btn btn-parse">📝 파싱하기</button>
          </div>
        </div>

        <div class="register-section" v-if="parsedTrades.length > 0">
          <h4>미리보기 및 상태 (총 {{ parsedTrades.length }}건)</h4>
          <div class="table-container">
            <div class="table-wrapper">
            <table class="register-table">
              <thead>
                <tr>
                  <th class="row-number">#</th>
                  <th>작업 유형</th>
                  <th>자산번호</th>
                  <th>보유/상태</th>
                  <th>CJ ID</th>
                  <th>메모</th>
                  <th v-if="parsedTrades.some(t => getWorkTypeConfig(t.work_type)?.requiresDates)">날짜/단가</th>
                  <th>유효성</th>
                  <th class="action">삭제</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(trade, index) in parsedTrades" :key="index" :class="{ 'stripe': index % 2 === 1, 'invalid-row': trade.isValidationDone && !trade.isValid }">
                  <td class="row-number">{{ index + 1 }}</td>
                  <td><b>{{ trade.work_type }}</b></td>
                  <td>{{ trade.asset_number }}</td>
                  
                  <td>
                     <span v-if="trade.isValidationDone && trade.asset_state">
                       {{ trade.asset_in_user }}<br/><small style="color:#666">({{ getAssetDisplayName(trade.asset_state) }})</small>
                     </span>
                     <span v-else style="color:#aaa">-</span>
                  </td>
                  
                  <td>
                    <div v-if="trade.cj_name && trade.cj_id">
                      {{ trade.cj_name }} <small>({{ trade.cj_id }})</small>
                    </div>
                    <div v-else>
                      {{ isCjIdDisabled(trade.work_type) ? getFixedCjIdDisplay(trade.work_type) : trade.cj_id }}
                    </div>
                  </td>
                  <td>{{ trade.memo }}</td>
                  <td v-if="parsedTrades.some(t => getWorkTypeConfig(t.work_type)?.requiresDates)">
                     <div v-if="getWorkTypeConfig(trade.work_type)?.requiresDates" style="font-size:11px">
                       {{ trade.new_day_of_start }} ~ {{ trade.new_day_of_end }}<br/>{{ trade.new_unit_price }}
                     </div>
                  </td>
                  <td class="validation-status">
                    <span v-if="!trade.isValidationDone" class="status wait">대기</span>
                    <span v-else-if="trade.isValid" class="status valid">✔️ {{ trade.validationMessage }}</span>
                    <span v-else class="status invalid">❌ {{ trade.validationMessage }}</span>
                  </td>
                  <td class="action">
                    <button @click="removeRow(index)" class="btn-delete-row" title="삭제">
                      <img src="/images/recyclebin.png" alt="delete" class="delete-icon" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <div class="button-group" v-if="parsedTrades.length > 0">
          <button @click="validateAllTrades" :disabled="loading" class="btn btn-modal btn-check">
            🔍 유효성 검사
          </button>
          <button 
            @click="submitValidTrades" 
            :disabled="loading || parsedTrades.filter(t => t.isValid && t.isValidationDone).length === 0" 
            class="btn btn-modal btn-submit"
          >
            ✅ 유효한 거래 등록 ({{ parsedTrades.filter(t => t.isValid && t.isValidationDone).length }}건)
          </button>
        </div>

      </div>

      <div v-if="registeredTrades.length > 0" class="registered-list">
        <h3 style="margin-left: 20px;">최근 등록 결과</h3>
        <div class="scroll-table" style="margin: 0 20px 20px 20px;">
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
    <UserDetailModal
      :is-open="isUserDetailOpen"
      :cj-id="userDetailCjId"
      @close="isUserDetailOpen = false"
    />
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white; border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex; flex-direction: column;
}

.register-modal {
  max-width: 1200px;
  width: 95%;
  height: 85vh; /* 높은 높이를 가져 정보 보기 좋게 설정 */
}

/* Header */
.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

/* Paste Section */
.paste-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  background: #fafafa;
  border: 1px solid #e0e0e0;
  padding: 15px;
  border-radius: 6px;
}

.paste-label {
  font-size: 13px;
  color: #555;
  font-weight: 600;
}

.tsv-textarea {
  width: 100%;
  height: 120px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 10px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 12px;
  resize: vertical;
  background: #fff;
}

.tsv-textarea:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.button-group-left {
  display: flex;
  justify-content: flex-end;
}

/* Table Section */
.table-container {
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--border-color);
}

.table-wrapper {
  overflow: auto;
  max-height: calc(85vh - 420px);
  min-height: 200px;
}

.register-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
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
  vertical-align: middle;
}

.register-table th.row-number, .register-table td.row-number {
  width: 40px;
  text-align: center;
}

.register-table th.action, .register-table td.action {
  width: 50px;
  text-align: center;
}

.invalid-row td {
  background-color: #ffebee;
}

/* Statuses */
.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}
.status.wait { background: #eee; color: #666; }
.status.valid { background: #e8f5e9; color: #2e7d32; }
.status.invalid { background: #ffebee; color: #c62828; }

/* Buttons */
.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-parse { background: #455a64; color: white; margin-top: 5px;}
.btn-parse:hover { background: #37474f; }

.btn-check { background: #1976d2; color: white; }
.btn-check:hover:not(:disabled) { background: #1565c0; }

.btn-submit { background: #2e7d32; color: white; }
.btn-submit:hover:not(:disabled) { background: #1b5e20; }
.btn-submit:disabled, .btn-check:disabled { background: #ccc; cursor: not-allowed; }

.btn-delete-row {
  background: var(--error-color, #e74c3c);
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-delete-row .delete-icon {
  width: 14px; height: 14px; filter: brightness(0) invert(1);
}

/* Extras */
.registered-list {
  border-top: 2px solid #eee;
  padding-top: 20px;
}

.registered-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.registered-table th { background: #f5f5f5; padding: 8px; text-align: left; }
.registered-table td { padding: 8px; border-bottom: 1px solid #eee; }
.scroll-table {
  max-height: 200px; overflow-y: auto;
  border: 1px solid #eee; border-radius: 4px;
}

.alert { padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; }
.alert-error { background: #fef2f2; color: #c62828; border-left: 4px solid #c62828; }
.alert-success { background: #f1f8e9; color: #2e7d32; border-left: 4px solid #2e7d32; }
.alert-info { background: #e3f2fd; color: #1565c0; border-left: 4px solid #1976d2; }
.loading-icon, .checkmark-icon { width: 16px; height: 16px; margin-right: 4px; vertical-align: middle; }
</style>
