<script setup>
import { ref, watch } from 'vue';
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
  }
});

const emit = defineEmits(['close']);

const selectedAsset = ref(null);
const trackingLogs = ref([]);
const trackingLoading = ref(false);
const trackingError = ref(null);
const isDragging = ref(false);

// 모달이 열릴 때 초기 자산 번호가 있으면 로그 조회
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.initialAssetNumber) {
    selectedAsset.value = { 
      asset_number: props.initialAssetNumber,
      model: props.initialModel,
      category: props.initialCategory
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
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="!isDragging && closeModal()">
    <div class="modal-content" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
      <div class="modal-header">
        <h2>자산 추적</h2>
        <button class="modal-close-btn" @click="closeModal">✕</button>
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
                  state: item.state
                };
                fetchTrackingLogs();
              }
            }"
          />
        </div>

        <div v-if="selectedAsset" class="asset-info-summary">
          <p><strong>자산번호:</strong> {{ selectedAsset.asset_number }}</p>
          <p><strong>분류:</strong> {{ selectedAsset.category || '-' }}</p>
          <p><strong>모델:</strong> {{ selectedAsset.model || '-' }}</p>
        </div>

        <div v-if="trackingError" class="alert alert-error">
          ❌ {{ trackingError }}
        </div>

        <div v-if="trackingLoading" class="alert alert-info">
          ⏳ 로딩 중...
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
              <div v-if="index < trackingLogs.length - 1" class="flow-arrow">→</div>
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
.modal-content { max-width: 1200px; max-height: 85vh; overflow: auto; }
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
.tracking-flow::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; border: 3px solid #f1f1f1; }
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
</style>
