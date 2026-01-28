<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import TradeList from '../components/TradeList.vue';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import ChangeExportModal from '../components/ChangeExportModal.vue';
import ReplacementExportModal from '../components/ReplacementExportModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import TradeRegisterModal from '../components/TradeRegisterModal.vue';
import { getTimestampFilename, formatDateTime } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';

const route = useRoute();
const initialSearch = computed(() => route.query.search || '');

const trades = ref([]);
const loading = ref(false);
const error = ref(null);

const isTrackingOpen = ref(false);
const trackingAssetNumber = ref('');
const trackingModel = ref('');
const trackingCategory = ref('');
const trackingMemo = ref('');
const isExportModalOpen = ref(false);
const isReplacementExportOpen = ref(false);
const isRegisterModalOpen = ref(false);
const registerAssetNumber = ref('');

const isConfirmModalOpen = ref(false);
const confirmMessage = ref('');
const confirmCallback = ref(null);
const confirmModalType = ref('confirm'); // 'confirm' or 'alert'
const changeExportCount = ref(0);
const replacementExportCount = ref(0);

const fetchExportCounts = async () => {
  try {
    // 1. 변경 Export 카운트 (Asset Logs Current Users - Confirmed Assets)
    const logsRes = await fetch('/api/assetLogs/currentUsers');
    const logsData = await logsRes.json();
    const confirmedRes = await fetch('/api/confirmedAssets');
    const confirmedData = await confirmedRes.json();
    
    if (logsData.success && confirmedData.success) {
      const confirmedPairs = new Set(confirmedData.data.map(item => `${item.asset_number}_${item.cj_id}`));
      const unconfirmedLogs = logsData.data.filter(log => !confirmedPairs.has(`${log.asset_number}_${log.cj_id}`));
      changeExportCount.value = unconfirmedLogs.length;
    }

    // 2. 교체 Export 카운트 (Replacement Assets - Confirmed Replacements)
    const replaceRes = await fetch('/api/assets?onlyReplacements=true');
    const replaceData = await replaceRes.json();
    const confirmedReplaceRes = await fetch('/api/confirmedReplacements');
    const confirmedReplaceData = await confirmedReplaceRes.json();

    if (replaceData.success && confirmedReplaceData.success) {
      const confirmedReplaceSet = new Set(confirmedReplaceData.data.map(item => String(item.asset_number)));
      const unconfirmedReplacements = replaceData.data.filter(asset => !confirmedReplaceSet.has(String(asset.asset_number)));
      replacementExportCount.value = unconfirmedReplacements.length;
    }
  } catch (err) {
    console.error('Export 카운트 로드 실패:', err);
  }
};

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
  trackingMemo.value = trade.asset_memo || '';
  isTrackingOpen.value = true;
};
const closeTrackingModal = () => {
  isTrackingOpen.value = false;
  trackingAssetNumber.value = '';
  trackingModel.value = '';
  trackingCategory.value = '';
  trackingMemo.value = '';
};

const handleRegisterTrade = (trade) => {
  registerAssetNumber.value = trade.asset_number;
  isRegisterModalOpen.value = true;
};

const closeRegisterModal = () => {
  isRegisterModalOpen.value = false;
  registerAssetNumber.value = '';
};

// formatDateTime is now imported

const downloadCSV = () => {
  const tradesData = trades.value || [];
  if (tradesData.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const filename = getTimestampFilename('TradePage');

  const headerKeys = [
    'trade_id', 'timestamp', 'work_type', 'asset_number', 'model',
    'ex_user', 'ex_user_name', 'ex_user_part',
    'cj_id', 'name', 'part', 'memo'
  ];

  const headerLabels = [
    '순번', '작업시간', '작업유형', '자산번호', '모델명',
    '이전 사용자ID', '이전 이름', '이전 부서',
    '사용자ID', '이름', '부서', '거래메모'
  ];

  const dataRows = tradesData.map(trade => 
    headerKeys.map(key => {
      let value = trade[key];
      if (key === 'timestamp') {
        value = formatDateTime(value);
      }
      return value;
    })
  );
  
  downloadCSVFile(filename, headerLabels, dataRows);
};

const showConfirm = (message, callback, type = 'confirm') => {
  confirmMessage.value = message;
  confirmCallback.value = callback;
  confirmModalType.value = type;
  isConfirmModalOpen.value = true;
};

const handleConfirmYes = () => {
  if (confirmCallback.value) {
    confirmCallback.value();
  }
  isConfirmModalOpen.value = false;
};

const handleCancelTrade = async (trade) => {
  showConfirm(
    `'${trade.asset_number}'의 [${trade.work_type}] 거래를 <span class="text-danger">취소</span>하시겠습니까?\n취소시 자산의 상태와 사용자 정보가 거래 전으로 <span class="font-bold text-danger">복구</span>됩니다.`,
    async () => {
      loading.value = true;
      try {
        const response = await fetch(`/api/trades/${trade.trade_id}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) {
          showConfirm('거래가 취소처리 성공.', () => {
             fetchTrades();
          }, 'alert');
        } else {
          error.value = result.message || '거래 취소처리 실패';
        }
      } catch (err) {
        error.value = '거래 취소 중 오류 발생: ' + err.message;
      } finally {
        loading.value = false;
      }
    }
  );
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
  fetchExportCounts();
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

    <TradeList v-if="!loading" :trades="trades" :initial-search="initialSearch" @download="downloadCSV" @track-asset="handleTrackAsset" @cancel-trade="handleCancelTrade" @register-trade="handleRegisterTrade">
      <template #actions>
        <div class="header-actions">
          <button @click="isRegisterModalOpen = true" class="btn btn-header btn-register">
            <img src="/images/edit.png" alt="add" class="btn-icon" />
            + 거래 등록
          </button>
          <button @click="isExportModalOpen = true" class="btn btn-header btn-export">
            변경 Export ({{ changeExportCount }})
          </button>
          <button @click="isReplacementExportOpen = true" class="btn btn-header btn-export-replacement">
            교체 Export ({{ replacementExportCount }})
          </button>
          <button @click="downloadCSV" class="btn btn-header btn-csv">
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
      :initial-memo="trackingMemo"
      @close="closeTrackingModal" 
    />
    <ChangeExportModal :is-open="isExportModalOpen" @close="() => { isExportModalOpen = false; fetchExportCounts(); }" />
    <ReplacementExportModal :is-open="isReplacementExportOpen" @close="() => { isReplacementExportOpen = false; fetchExportCounts(); }" />
    <ConfirmationModal 
      :is-open="isConfirmModalOpen"
      :message="confirmMessage"
      :type="confirmModalType"
      @confirm="handleConfirmYes"
      @cancel="isConfirmModalOpen = false"
    />
    <TradeRegisterModal 
      :is-open="isRegisterModalOpen" 
      :initial-asset-number="registerAssetNumber"
      @close="closeRegisterModal" 
      @success="fetchTrades"
    />
  </div>
</template>

<style scoped>
/* Redundant local styles removed to use global design system */
</style>