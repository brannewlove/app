<script setup>
import { ref, onMounted, watch } from 'vue';
import AutocompleteSearch from './AutocompleteSearch.vue';
import WorkTypeSearch from './WorkTypeSearch.vue';
import UserDetailModal from './UserDetailModal.vue';
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
  assetNumber: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'success']);

const loading = ref(false);
const error = ref(null);
const trade = ref({
  work_type: '',
  asset_number: '',
  cj_id: '',
  cj_name: '',
  memo: '',
  asset_state: '',
  asset_in_user: '',
  asset_memo: '',
  new_day_of_start: '',
  new_day_of_end: '',
  new_unit_price: null
});

const successMessage = ref(null);

const currentAssetInfo = ref(null);
const isUserDetailOpen = ref(false);
const userDetailCjId = ref('');

const openUserDetail = (cjId) => {
  if (!cjId || cjId === 'cjenc_inno') return;
  emit('close'); // 현재 모달 닫기
  userDetailCjId.value = cjId;
  isUserDetailOpen.value = true;
};

const copyCurrentUserToInput = () => {
  if (currentAssetInfo.value && currentAssetInfo.value.in_user) {
    trade.value.cj_id = currentAssetInfo.value.in_user;
    trade.value.cj_name = currentAssetInfo.value.user_name || currentAssetInfo.value.in_user;
  }
};

const fetchAssetDetail = async () => {
  if (!props.assetNumber) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    const asset = await assetApi.getAssetByNumber(props.assetNumber);
    if (asset) {
      currentAssetInfo.value = {
        asset_number: asset.asset_number,
        category: asset.category,
        model: asset.model,
        state: asset.state,
        in_user: asset.in_user,
        user_name: asset.user_name || asset.in_user,
        user_part: asset.user_part,
        memo: asset.memo
      };
      
      trade.value.asset_number = asset.asset_number;
      trade.value.asset_state = asset.state;
      trade.value.asset_in_user = asset.in_user;
      trade.value.asset_memo = asset.memo;
      trade.value.ex_user = asset.in_user || '';
    } else {
      error.value = '자산 정보를 불러올 수 없습니다.';
    }
  } catch (err) {
    console.error('Failed to fetch asset detail:', err);
    error.value = '자산 정보 로드 오류: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const handleWorkTypeSelect = (item) => {
  trade.value.work_type = String(item.work_type || '');
  const config = getWorkTypeConfig(trade.value.work_type);
  if (config && config.fixedCjId) {
    if (config.fixedCjId === 'no-change') {
      trade.value.cj_id = trade.value.asset_in_user;
      trade.value.cj_name = ''; // 고정 사용자일 경우 이름 초기화 또는 필요시 처리
    } else {
      trade.value.cj_id = config.fixedCjId;
      trade.value.cj_name = config.displayFixedUser || '';
    }
  }
};

const handleUserSelect = (item) => {
  trade.value.cj_id = String(item.cj_id || '');
  trade.value.cj_name = String(item.name || '');
};

const validate = () => {
  const { work_type, cj_id, new_day_of_start, new_day_of_end } = trade.value;
  if (!work_type) return { valid: false, message: '작업 유형을 선택해주세요.' };

  const config = getWorkTypeConfig(work_type);
  if (config?.requiresDates) {
    if (!new_day_of_start) return { valid: false, message: '새로운 시작일을 입력해주세요.' };
    if (!new_day_of_end) return { valid: false, message: '새로운 종료일을 입력해주세요.' };
  }

  const assetCtx = {
    state: trade.value.asset_state,
    in_user: trade.value.asset_in_user
  };
  const tradeCtx = {
    work_type,
    cj_id
  };

  return validateTradeStrict(tradeCtx, assetCtx);
};

const submitTrade = async () => {
  const validation = validate();
  if (!validation.valid) {
    error.value = validation.message;
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    const tradeData = { ...trade.value };
    delete tradeData.cj_name;

    const response = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([tradeData])
    });

    const result = await response.json();
    if (result.success) {
      successMessage.value = '거래가 성공적으로 등록되었습니다.';
      emit('success');
      
      setTimeout(() => {
        successMessage.value = null;
        emit('close');
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
  if (newVal) {
    trade.value = {
      work_type: '',
      asset_number: '',
      cj_id: '',
      cj_name: '',
      memo: '',
      asset_state: '',
      asset_in_user: '',
      asset_memo: '',
      new_day_of_start: '',
      new_day_of_end: '',
      new_unit_price: null
    };
    fetchAssetDetail();
  }
});

onMounted(() => {
  if (props.isOpen) fetchAssetDetail();
});

const getWorkTypeFilter = () => {
  if (!currentAssetInfo.value) return null;
  const asset = { state: currentAssetInfo.value.state, in_user: currentAssetInfo.value.user_id || currentAssetInfo.value.user_name }; // Simplified
  // getAvailableWorkTypesForAsset uses state and in_user correctly
  return (wt) => getAvailableWorkTypesForAsset({
    state: currentAssetInfo.value.state,
    in_user: currentAssetInfo.value.in_user
  }).some(a => a.id === wt.id);
};
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
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
    <div class="modal-content trade-action-modal">
      <div class="modal-header">
        <h2>거래등록</h2>
        <button @click="emit('close')" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
        <div v-if="successMessage" class="alert alert-success">✅ {{ successMessage }}</div>
        <div v-if="loading && !successMessage" class="alert alert-info">⌛ 거래 정보를 등록하고 있습니다...</div>
        
        <!-- 자산 요약 배너 -->
        <div v-if="currentAssetInfo" class="asset-summary-banner">
          <div class="summary-item">
            <span class="summary-label">자산번호</span>
            <span class="summary-value">{{ currentAssetInfo.asset_number }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">분류/모델</span>
            <span class="summary-value">{{ currentAssetInfo.category }} / {{ currentAssetInfo.model }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">현재상태</span>
            <span class="summary-value">{{ currentAssetInfo.state }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">
              현재사용자
              <button 
                v-if="currentAssetInfo?.in_user && currentAssetInfo.in_user !== 'cjenc_inno'" 
                class="btn-user-copy-tiny" 
                @click="copyCurrentUserToInput"
                title="현재사용자를 입력란으로 복사"
              >
                <img src="/images/down_arrow.png" alt="copy user" class="copy-icon-tiny" />
              </button>
            </span>
            <span class="summary-value">{{ currentAssetInfo.user_name || '-' }} <small v-if="currentAssetInfo.user_part">({{ currentAssetInfo.user_part }})</small></span>
          </div>
          <div v-if="currentAssetInfo.memo" class="summary-item full-width">
            <span class="summary-label">자산메모</span>
            <span class="summary-value memo-text">{{ currentAssetInfo.memo }}</span>
          </div>
        </div>

        <div v-if="loading && !currentAssetInfo" class="loading-state">
           <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 정보를 불러오는 중...
        </div>

        <div v-else class="trade-form">
          <div class="form-row">
            <div class="form-group">
              <label>작업 유형</label>
              <WorkTypeSearch
                id="trade-work-type"
                :initial-value="trade.work_type"
                placeholder="유형 선택"
                :filter-fn="getWorkTypeFilter()"
                @select="handleWorkTypeSelect"
              />
            </div>
            <div class="form-group">
              <label>사용자 (ID/이름)</label>
              <div v-if="isCjIdDisabled(trade.work_type)" class="fixed-val">
                {{ getFixedCjIdDisplay(trade.work_type) }}
              </div>
              <AutocompleteSearch
                id="trade-user-search"
                v-else
                :initial-value="trade.cj_name || trade.cj_id"
                placeholder="사용자 검색"
                api-table="users"
                api-column="cj_id"
                @select="handleUserSelect"
              />
            </div>
          </div>

          <div v-if="getWorkTypeConfig(trade.work_type)?.requiresDates" class="recontract-section">
            <h4 class="section-title">재계약 정보</h4>
            <div class="form-row">
              <div class="form-group">
                <label>새 시작일</label>
                <input v-model="trade.new_day_of_start" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label>새 종료일</label>
                <input v-model="trade.new_day_of_end" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label>새 월단가</label>
                <input v-model="trade.new_unit_price" type="number" class="form-input" placeholder="월단가 입력" />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>거래 메모</label>
            <textarea v-model="trade.memo" placeholder="거래와 관련된 메모를 입력하세요 (선택 사항)" class="form-textarea"></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="emit('close')" class="btn btn-modal btn-cancel">취소</button>
        <button @click="submitTrade" :disabled="loading" class="btn btn-modal btn-submit">
          {{ loading ? '처리 중...' : '거래 등록' }}
        </button>
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
.trade-action-modal {
  max-width: 700px;
  width: 90%;
  border-radius: 12px;
}

.modal-body {
  padding: 30px;
}

.asset-summary-banner {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: #f1f3f5;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 30px;
  border: 1px solid #e9ecef;
}

.summary-item {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-item.full-width {
  flex-basis: 100%;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #ced4da;
}

.summary-label {
  font-size: 11px;
  font-weight: 700;
  color: #868e96;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 15px;
  font-weight: 600;
  color: #212529;
}

.memo-text {
  font-weight: normal;
  color: #495057;
  font-style: italic;
  font-size: 14px;
}

.trade-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.form-group {
  flex: 1;
  min-width: 250px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 700;
  color: #495057;
}

.fixed-val {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: #e9ecef;
  border-radius: 6px;
  border: 1px solid #ced4da;
  font-size: 14px;
  color: #6c757d;
}

.form-input, .form-textarea {
  padding: 10px 14px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--brand-blue, #0052cc);
}

.form-textarea {
  min-height: 80px;
  resize: vertical;
}

.recontract-section {
  background: #fff5f5;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #ffc9c9;
}

.section-title {
  margin: 0 0 15px 0;
  font-size: 15px;
  color: #c92a2a;
  font-weight: 700;
}

.btn-submit {
  background: var(--brand-blue, #0052cc);
  color: white;
  min-width: 120px;
}

.btn-submit:hover:not(:disabled) {
  background: var(--brand-blue-dark, #0747a6);
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: #868e96;
}

.loading-icon {
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin-right: 8px;
}
.btn-user-link-tiny {
  background: transparent;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 4px;
  vertical-align: middle;
  transition: opacity 0.2s;
}

.btn-user-link-tiny:hover {
  opacity: 0.7;
}

.link-icon-tiny {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0.6);
}

.btn-user-copy-tiny {
  background: transparent;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 6px;
  vertical-align: middle;
  transition: transform 0.2s, opacity 0.2s;
}

.btn-user-copy-tiny:hover {
  opacity: 0.7;
  transform: translateY(1px);
}

.copy-icon-tiny {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
/* 알림 스타일 */
.alert { padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; font-size: 14px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-success { background: #f1f8e9; color: #2e7d32; border-left: 4px solid #4CAF50; }
.alert-info { background: #e3f2fd; color: #1976d2; border-left: 4px solid #2196f3; }

</style>
