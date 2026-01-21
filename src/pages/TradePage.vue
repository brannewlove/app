<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import TradeList from '../components/TradeList.vue';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import ChangeExportModal from '../components/ChangeExportModal.vue';
import ReplacementExportModal from '../components/ReplacementExportModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import TradeRegisterModal from '../components/TradeRegisterModal.vue';
import { getTimestampFilename, formatDateTime } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';

const trades = ref([]);
const loading = ref(false);
const error = ref(null);

const isTrackingOpen = ref(false);
const trackingAssetNumber = ref('');
const trackingModel = ref('');
const trackingCategory = ref('');
const isExportModalOpen = ref(false);
const isReplacementExportOpen = ref(false);
const isRegisterModalOpen = ref(false);

const isConfirmModalOpen = ref(false);
const confirmMessage = ref('');
const confirmCallback = ref(null);

const fetchTrades = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/trades');
    const result = await response.json();
    if (result.success) {
      trades.value = result.data;
    } else {
      error.value = result.message || '거래 로드 실패';
    }
  } catch (err) {
    error.value = '거래 로드 중 오류 발생: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const openExportModal = () => isExportModalOpen.value = true;

const handleTrackAsset = (trade) => {
  trackingAssetNumber.value = trade.asset_number;
  trackingModel.value = trade.model || '';
  trackingCategory.value = trade.category || '';
  isTrackingOpen.value = true;
};

const closeTrackingModal = () => {
  isTrackingOpen.value = false;
  trackingAssetNumber.value = '';
  trackingModel.value = '';
  trackingCategory.value = '';
};

// formatDateTime is now imported

const downloadCSV = () => {
  const tradesData = trades.value || [];
  if (tradesData.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const filename = getTimestampFilename('TradePage');

  const headers = [
    'trade_id', 'timestamp', 'work_type', 'asset_number', 'model',
    'ex_user', 'ex_user_name', 'ex_user_part',
    'cj_id', 'name', 'part', 'memo'
  ];

  const dataRows = tradesData.map(trade => 
    headers.map(header => {
      let value = trade[header];
      if (header === 'timestamp') {
        value = formatDateTime(value);
      }
      return value;
    })
  );
  
  downloadCSVFile(filename, headers, dataRows);
};

const showConfirm = (message, callback) => {
  confirmMessage.value = message;
  confirmCallback.value = callback;
  isConfirmModalOpen.value = true;
};

const handleConfirmYes = () => {
  if (confirmCallback.value) {
    confirmCallback.value();
  }
  isConfirmModalOpen.value = false;
};

const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    if (isConfirmModalOpen.value) {
      isConfirmModalOpen.value = false;
    } else if (isRegisterModalOpen.value) {
      isRegisterModalOpen.value = false;
    } else if (isTrackingOpen.value) {
      isTrackingOpen.value = false;
    } else if (isExportModalOpen.value) {
      isExportModalOpen.value = false;
    } else if (isReplacementExportOpen.value) {
      isReplacementExportOpen.value = false;
    }
  }
};

onMounted(() => {
  fetchTrades();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="page-content">
    <h1>거래 관리</h1>
    
    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
    <div v-if="loading" class="alert alert-info"><img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...</div>

    <TradeList v-if="!loading" :trades="trades" @download="downloadCSV" @track-asset="handleTrackAsset">
      <template #actions>
        <div style="display: flex; gap: 10px;">
          <button @click="isRegisterModalOpen = true" class="btn btn-register">거래 등록</button>
          <button @click="openExportModal" class="btn btn-export">변경 Export</button>
          <button @click="isReplacementExportOpen = true" class="btn btn-export-replacement">교체 Export</button>
          <button @click="downloadCSV" class="btn btn-csv">
            <img src="/images/down.png" alt="download" class="btn-icon" />
            csv
          </button>
        </div>
      </template>
    </TradeList>

    <AssetTrackingModal 
      :is-open="isTrackingOpen" 
      :initial-asset-number="trackingAssetNumber"
      :initial-model="trackingModel"
      :initial-category="trackingCategory"
      @close="closeTrackingModal" 
    />
    <ChangeExportModal :is-open="isExportModalOpen" @close="isExportModalOpen = false" />
    <ReplacementExportModal :is-open="isReplacementExportOpen" @close="isReplacementExportOpen = false" />
    <ConfirmationModal 
      :is-open="isConfirmModalOpen"
      :message="confirmMessage"
      @confirm="handleConfirmYes"
      @cancel="isConfirmModalOpen = false"
    />
    <TradeRegisterModal 
      :is-open="isRegisterModalOpen" 
      @close="isRegisterModalOpen = false" 
      @success="fetchTrades"
    />
  </div>
</template>

<style scoped>
.page-content { padding: 20px; }
h1 { color: #333; margin-bottom: 30px; font-size: 28px; border-bottom: 3px solid #999; padding-bottom: 10px; }
.alert { padding: 15px 20px; border-radius: 5px; margin-bottom: 20px; font-size: 16px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-info { background: #f5f5f5; color: #666; border-left: 4px solid #999; }
.btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; }
.btn-register { background: var(--brand-blue); color: white; }
.btn-register:hover { background: #4a6f8f; }
.btn-export-replacement { background: #794A8D; color: white; }
.btn-export-replacement:hover { background: #603a70; }

/* TSV 버튼 스타일 */
.btn-csv {
  background: var(--brand-blue);
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 10px 15px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-csv:hover {
  background: #4a6d8d;
}

.btn-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* 흰색으로 변경 */
}

.loading-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}
</style>