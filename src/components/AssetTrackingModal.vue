<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AutocompleteSearch from './AutocompleteSearch.vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  initialAssetNumber: {
    type: String,
    default: '',
  },
  initialModel: {
    type: String,
    default: '',
  },
  initialCategory: {
    type: String,
    default: '',
  },
  initialState: {
    type: String,
    default: '',
  },
  initialMemo: {
    type: String,
    default: '',
  }
});

const emit = defineEmits(['close']);

const router = useRouter();

const selectedAsset = ref(null);
const trackingLogs = ref([]);
const trackingLoading = ref(false);
const trackingError = ref(null);
const isDragging = ref(false);
const isCopied = ref(false);

// 모달이 열릴 때 초기 자산 번호가 있으면 로그 조회
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.initialAssetNumber) {
    selectedAsset.value = { 
      asset_number: props.initialAssetNumber,
      model: props.initialModel,
      category: props.initialCategory,
      state: props.initialState,
      memo: props.initialMemo
    };
    fetchTrackingLogs();
  }
});

const closeModal = () => {
  selectedAsset.value = null;
  trackingLogs.value = [];
  trackingError.value = null;
  emit('close');
};

const handleTrackingWheel = (event) => {
  const container = event.currentTarget;
  container.scrollLeft += event.deltaY > 0 ? 400 : -400;
};

// 드래그 시작 시 호출
const handleMouseDown = () => {
  isDragging.value = true;
};

// 드래그 종료 시 호출
const handleMouseUp = () => {
  isDragging.value = false;
};

const fetchTrackingLogs = async () => {
  if (!selectedAsset.value || !selectedAsset.value.asset_number) {
    trackingError.value = '자산을 선택해주세요.';
    return;
  }

  trackingLoading.value = true;
  trackingError.value = null;

  try {
    const response = await fetch(`/api/assetLogs?asset_number=${selectedAsset.value.asset_number}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '추적 로그 조회 실패');
    }
    
    trackingLogs.value = data.data || [];
  } catch (err) {
    console.error('추적 로그 조회 에러:', err);
    trackingError.value = err.message || '추적 로그 조회 중 오류 발생';
  } finally {
    trackingLoading.value = false;
  }
};

const copyAssetInfo = () => {
  if (!selectedAsset.value) return;

  const { asset_number, category, model, state, memo } = selectedAsset.value;
  
  // HTML 버전 (요청하신 스타일 적용)
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 12px; width: 100%; font-family: sans-serif; border: 1px solid #000000;">
      <thead>
        <tr style="font-weight: bold; color: #000000;">
          <th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">자산번호</th>
          <th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">분류</th>
          <th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">모델</th>
          <th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">상태</th>
          <th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">자산메모</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #000000; padding: 10px; color: #000000;">${asset_number || '-'}</td>
          <td style="border: 1px solid #000000; padding: 10px; color: #000000;">${category || '-'}</td>
          <td style="border: 1px solid #000000; padding: 10px; color: #000000;">${model || '-'}</td>
          <td style="border: 1px solid #000000; padding: 10px; color: #000000;">${state || '-'}</td>
          <td style="border: 1px solid #000000; padding: 10px; color: #000000;">${memo || '-'}</td>
        </tr>
      </tbody>
    </table>
  `;

  // 텍스트 버전 (Fallback)
  const plainText = `자산번호: ${asset_number}\n분류: ${category || '-'}\n모델: ${model || '-'}\n상태: ${state || '-'}\n자산메모: ${memo || '-'}`;

  const blobHtml = new Blob([htmlTable], { type: 'text/html' });
  const blobText = new Blob([plainText], { type: 'text/plain' });
  const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

  navigator.clipboard.write(data).then(() => {
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
  });
};

const goToTradeSearch = () => {
  if (!selectedAsset.value || !selectedAsset.value.asset_number) return;
  router.push({
    name: 'Trades',
    query: { search: selectedAsset.value.asset_number }
  });
  closeModal();
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="!isDragging && closeModal()">
    <div class="modal-content" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
      <div class="modal-header">
        <h2>자산 추적</h2>
        <div class="header-buttons">
          <button v-if="selectedAsset" class="btn-trade-search" @click="goToTradeSearch">
            <img src="/images/go.png" alt="search" class="btn-icon-custom" />
            거래검색
          </button>
          <button class="modal-close-btn" @click="closeModal">✕</button>
        </div>
      </div>

      <div class="modal-body">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-weight: bold;">자산 선택</label>
          <AutocompleteSearch 
            :initial-value="selectedAsset?.asset_number || ''"
            placeholder="자산번호로 검색..."
            api-table="assets"
            api-column="asset_number"
            @select="(item) => {
              if (item && typeof item === 'object') {
                selectedAsset = {
                  asset_id: item.asset_id,
                  asset_number: item.asset_number,
                  model: item.model,
                  category: item.category,
                  state: item.state,
                  memo: item.memo
                };
                fetchTrackingLogs();
              }
            }"
          />
        </div>

        <div v-if="selectedAsset">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <h3 style="margin: 0; font-size: 16px; color: #333;">자산 정보</h3>
            <button class="copy-btn-small" @click="copyAssetInfo" title="클립보드 복사">
              <img v-if="!isCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
              <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
            </button>
          </div>
          <div class="asset-info-summary">
            <p><strong>자산번호:</strong> {{ selectedAsset.asset_number }}</p>
            <p><strong>분류:</strong> {{ selectedAsset.category || '-' }}</p>
            <p><strong>모델:</strong> {{ selectedAsset.model || '-' }}</p>
            <p><strong>상태:</strong> {{ selectedAsset.state || '-' }}</p>
            <p><strong>자산메모:</strong> {{ selectedAsset.memo || '-' }}</p>
          </div>
        </div>

        <div v-if="trackingError" class="alert alert-error">
          ❌ {{ trackingError }}
        </div>

        <div v-if="trackingLoading" class="alert alert-info">
          <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...
        </div>

        <div v-else-if="trackingLogs.length > 0">
          <h3>사용자 변경 로그</h3>
          <div class="tracking-flow" @wheel.prevent="handleTrackingWheel">
            <div v-for="(log, index) in trackingLogs" :key="`${log.trade_id}-${log.timestamp}`" class="flow-item">
              <div class="flow-content">
                <div class="flow-header">
                  <span class="flow-work-type">{{ log.work_type }}</span>
                  <span class="flow-user">{{ log.user_name || log.cj_id || '-' }}</span>
                </div>
                <div class="flow-date">{{ new Date(log.timestamp).toLocaleString('ko-KR') }}</div>
              </div>
              <div v-if="index < trackingLogs.length - 1" class="flow-arrow"><img src="/images/right-arrow.png" alt="arrow" class="arrow-icon" /></div>
            </div>
          </div>
        </div>

        <div v-else-if="selectedAsset && !trackingLoading" class="tracking-logs-empty">
          추적 로그가 없습니다.
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
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  max-height: calc(100vh - 120px);
  overflow: auto;
}
.modal-content::-webkit-scrollbar { width: 12px; }
.modal-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
.modal-content::-webkit-scrollbar-thumb { background: #bbb; border-radius: 10px; border: 3px solid #f1f1f1; }
.modal-content::-webkit-scrollbar-thumb:hover { background: #999; }

/* Component specific overrides or additional styles */
.asset-info-summary { margin-bottom: 24px; padding: 18px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02); }
.asset-info-summary p { margin: 8px 0; font-size: 14px; color: #444; }
.asset-info-summary strong { color: #2c3e50; margin-right: 8px; }

.tracking-flow { display: flex; gap: 20px; overflow-x: auto; padding: 24px; scroll-behavior: smooth; border: 1px solid #eef2f7; border-radius: 12px; background: #f1f3f5; box-shadow: inset 0 2px 4px rgba(0,0,0,0.03); }
.tracking-flow::-webkit-scrollbar { height: 14px; }
.tracking-flow::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
.tracking-flow::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 10px; border: 3px solid #f1f1f1; }
.tracking-flow::-webkit-scrollbar-thumb:hover { background: #bbb; }

.flow-item { display: flex; align-items: center; gap: 12px; min-width: max-content; }
.flow-content { padding: 16px 20px; background: white; border: 1px solid #d1d9e6; border-radius: 10px; min-width: 140px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); transition: transform 0.2s; }
.flow-content:hover { transform: translateY(-3px); border-color: #3498db; }
.flow-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 15px; }
.flow-work-type { font-weight: bold; color: white; padding: 4px 10px; background: #5a6d8c; border-radius: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.flow-user { color: #2c3e50; font-weight: 700; font-size: 14px; }
.flow-date { font-size: 11px; color: #8a99af; font-weight: 500; }
.flow-arrow { font-size: 24px; color: #a5b1c2; font-weight: bold; }
.tracking-logs-empty { text-align: center; padding: 50px; color: #999; font-style: italic; }

/* 복사 버튼 스타일 */
.copy-btn-small {
  background: transparent;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.copy-btn-small:hover {
  opacity: 0.7;
}

.copy-icon {
  filter: brightness(0);
}

.check-mark-black {
  color: #333;
  font-size: 16px;
  font-weight: bold;
}

.loading-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}

.arrow-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  vertical-align: middle;
}

.checkmark-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
}

.checkmark-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
}

.header-buttons {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-trade-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--brand-blue, #0052CC);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-trade-search:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-icon-custom {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}
</style>
