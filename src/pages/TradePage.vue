<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TradeList from '../components/TradeList.vue';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import ChangeExportModal from '../components/ChangeExportModal.vue';
import ReplacementExportModal from '../components/ReplacementExportModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import TradeRegisterModal from '../components/TradeRegisterModal.vue';
import TradeActionModal from '../components/TradeActionModal.vue';
import UserDetailModal from '../components/UserDetailModal.vue';
import AssetInfoModal from '../components/AssetInfoModal.vue';
import { getTimestampFilename, formatDateTime } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';

const route = useRoute();
const router = useRouter();
const initialSearch = computed(() => route.query.search || '');

const trades = ref([]);
const loading = ref(false);
const error = ref(null);

const isTrackingOpen = ref(false);
const trackingAssetNumber = ref('');
const trackingModel = ref('');
const trackingCategory = ref('');
const trackingState = ref('');
const trackingMemo = ref('');
const isExportModalOpen = ref(false);
const isReplacementExportOpen = ref(false);
const isRegisterModalOpen = ref(false); // 대량 등록용
const isSingleRegisterOpen = ref(false); // 단일 등록용
const registerAssetNumber = ref('');

// 사용자 상세 모달 관련
const isUserDetailOpen = ref(false);
const userDetailCjId = ref('');

const openUserDetail = (cj_id) => {
  if (!cj_id || cj_id === '-' || cj_id === 'cjenc_inno' || cj_id === 'aj_rent') return;
  userDetailCjId.value = cj_id;
  isUserDetailOpen.value = true;
};

// 자산 정보 모달 관련
const isAssetInfoOpen = ref(false);
const infoAssetNumber = ref('');

const openAssetInfo = (assetNumber) => {
  infoAssetNumber.value = assetNumber;
  isAssetInfoOpen.value = true;
};

const handleTradeSearchFromInfo = (assetNumber) => {
  isAssetInfoOpen.value = false;
  searchQuery.value = assetNumber;
  currentPage.value = 1;
  fetchTrades();
  router.push({ query: { ...route.query, search: assetNumber } });
};

const handleUserAssetsSearch = (cjId) => {
  router.push({ name: 'Assets', query: { q: cjId } });
};

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

const currentPage = ref(1);
const pageSize = ref(50);
const totalItems = ref(0);
const searchQuery = ref(initialSearch.value);
const sortColumn = ref('trade_id');
const sortDirection = ref('desc');
const isManualSort = ref(false);

const fetchTrades = async () => {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value,
      sort: sortColumn.value,
      direction: sortDirection.value
    });
    
    const response = await fetch(`/api/trades?${params.toString()}`);
    const result = await response.json();
    if (result.success) {
      trades.value = result.data.data;
      totalItems.value = result.data.total;
    } else {
      error.value = result.message || '거래 로드 실패';
    }
  } catch (err) {
    error.value = '거래 로드 중 오류 발생: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const handlePageChange = (page) => {
  currentPage.value = page;
  fetchTrades();
};

const handleSearchChange = (query) => {
  searchQuery.value = query;
  currentPage.value = 1;
  fetchTrades();
};

const handleSortChange = ({ column, direction }) => {
  sortColumn.value = column;
  sortDirection.value = direction;
  isManualSort.value = true;
  currentPage.value = 1; // 정렬 변경 시 첫 페이지로 이동
  fetchTrades();
};

const openExportModal = () => isExportModalOpen.value = true;

const handleTrackAsset = (trade) => {
  trackingAssetNumber.value = trade.asset_number;
  trackingModel.value = trade.model || '';
  trackingCategory.value = trade.category || '';
  trackingState.value = trade.state || '';
  trackingMemo.value = trade.asset_memo || '';
  isTrackingOpen.value = true;
};
const closeTrackingModal = () => {
  isTrackingOpen.value = false;
  trackingAssetNumber.value = '';
  trackingModel.value = '';
  trackingCategory.value = '';
  trackingState.value = '';
  trackingMemo.value = '';
};

const handleRegisterTrade = (trade) => {
  isAssetInfoOpen.value = false;
  registerAssetNumber.value = trade.asset_number;
  isSingleRegisterOpen.value = true;
};

const closeRegisterModal = () => {
  isRegisterModalOpen.value = false;
  registerAssetNumber.value = '';
};

// formatDateTime is now imported

const downloadCSV = async () => {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams({
      page: 1,
      limit: 1000000,
      search: searchQuery.value,
      sort: sortColumn.value,
      direction: sortDirection.value
    });
    
    const response = await fetch(`/api/trades?${params.toString()}`);
    const result = await response.json();
    
    if (!result.success || !result.data || !result.data.data) {
      error.value = 'CSV 데이터를 가져오는 데 실패했습니다.';
      return;
    }
    
    const tradesData = result.data.data;
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
  } catch (err) {
    error.value = 'CSV 다운로드 중 오류 발생: ' + err.message;
  } finally {
    loading.value = false;
  }
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
    } else if (isSingleRegisterOpen.value) {
      isSingleRegisterOpen.value = false;
    } else if (isTrackingOpen.value) {
      isTrackingOpen.value = false;
    } else if (isExportModalOpen.value) {
      isExportModalOpen.value = false;
    } else if (isReplacementExportOpen.value) {
      isReplacementExportOpen.value = false;
    } else if (isUserDetailOpen.value) {
      isUserDetailOpen.value = false;
    } else if (isAssetInfoOpen.value) {
      isAssetInfoOpen.value = false;
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


    <TradeList 
      :trades="trades" 
      :loading="loading" 
      :initial-search="initialSearch" 
      :current-page="currentPage"
      :page-size="pageSize"
      :total-items="totalItems"
      :sort-column="sortColumn"
      :sort-direction="sortDirection"
      :is-manual-sort="isManualSort"
      @download="downloadCSV" 
      @track-asset="handleTrackAsset" 
      @cancel-trade="handleCancelTrade" 
      @register-trade="handleRegisterTrade" 
      @user-detail="openUserDetail" 
      @asset-info="openAssetInfo" 
      @user-assets-search="handleUserAssetsSearch"
      @page-change="handlePageChange"
      @search-change="handleSearchChange"
      @sort-change="handleSortChange"
    >
      <template #actions>
        <div class="header-actions">
          <button @click="isRegisterModalOpen = true" class="btn btn-header btn-register">
            <img src="/images/edit.png" alt="add" class="btn-icon" />
            + 거래
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
      :initial-state="trackingState"
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
      @close="isRegisterModalOpen = false" 
      @success="fetchTrades"
    />
    <TradeActionModal
      :is-open="isSingleRegisterOpen"
      :asset-number="registerAssetNumber"
      @close="isSingleRegisterOpen = false"
      @success="fetchTrades"
    />
    <UserDetailModal 
      :is-open="isUserDetailOpen" 
      :cj-id="userDetailCjId" 
      @close="isUserDetailOpen = false" 
    />
    <AssetInfoModal
      :is-open="isAssetInfoOpen"
      :asset-number="infoAssetNumber"
      :show-edit="true"
      @close="isAssetInfoOpen = false"
      @user-detail="openUserDetail"
      @trade-search="handleTradeSearchFromInfo"
      @updated="fetchTrades"
      @track="(asset) => { 
        trackingAssetNumber = asset.asset_number; 
        trackingModel = asset.model || '';
        trackingCategory = asset.category || '';
        trackingState = asset.state || '';
        trackingMemo = asset.memo || '';
        isTrackingOpen = true; 
        isAssetInfoOpen = false; 
      }"
      @quick-trade="handleRegisterTrade"
    />
  </div>
</template>

<style scoped>
/* Redundant local styles removed to use global design system */
</style>