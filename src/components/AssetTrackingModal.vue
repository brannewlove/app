<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
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
  container.scrollLeft += event.deltaY > 0 ? 200 : -200;
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
    const response = await fetch(`/api/assetLogs?asset_id=${selectedAsset.value.asset_number}`);
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

        <div v-if="selectedAsset" style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
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
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; border-radius: 12px; max-width: 1200px; max-height: 85vh; overflow: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
.modal-content::-webkit-scrollbar { width: 12px; }
.modal-content::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
.modal-content::-webkit-scrollbar-thumb { background: #bbb; border-radius: 10px; border: 3px solid #f1f1f1; }
.modal-content::-webkit-scrollbar-thumb:hover { background: #999; }

.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 2px solid #f0f0f0; background: #f8f9fa; }
.modal-header h2 { margin: 0; color: #333; font-size: 1.4rem; }
.modal-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.modal-close-btn:hover { color: #333; background: #eee; }
.modal-body { padding: 24px; }
.alert { padding: 15px 20px; border-radius: 5px; margin-bottom: 20px; font-size: 16px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-info { background: #f5f5f5; color: #666; border-left: 4px solid #999; }
.tracking-flow { display: flex; gap: 20px; overflow-x: auto; padding: 20px 0; scroll-behavior: smooth; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; background: #fafafa; }
.tracking-flow::-webkit-scrollbar { height: 14px; }
.tracking-flow::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
.tracking-flow::-webkit-scrollbar-thumb { background: #bbb; border-radius: 10px; border: 3px solid #f1f1f1; }
.tracking-flow::-webkit-scrollbar-thumb:hover { background: #999; }
.flow-item { display: flex; align-items: center; gap: 10px; min-width: max-content; position: relative; }
.flow-content { padding: 15px 20px; background: white; border: 2px solid #e0e0e0; border-radius: 5px; min-width: 100px; flex-shrink: 0; }
.flow-header { display: flex; justify-content: space-between; margin-bottom: 5px; }
.flow-work-type { font-weight: bold; color: #5a6d8c; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; font-size: 12px; }
.flow-user { color: #3a424f; font-weight: bold; }
.flow-date { font-size: 12px; color: #999; }
.flow-arrow { font-size: 20px; color: #3a424f; flex-shrink: 0; min-width: 20px; text-align: center; }
.tracking-logs-empty { text-align: center; padding: 30px; color: #999; }
</style>
