<script setup>
import { ref, onMounted } from 'vue';
import TradeList from '../components/TradeList.vue';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import ChangeExportModal from '../components/ChangeExportModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';

const trades = ref([]);
const loading = ref(false);
const error = ref(null);

const isTrackingOpen = ref(false);
const isExportModalOpen = ref(false);

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

const openTrackingModal = () => isTrackingOpen.value = true;
const openExportModal = () => isExportModalOpen.value = true;

const downloadTSV = (data) => {
  if (data.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
  const filename = `TradePage_${timestamp}.tsv`;
  const headers = [
    'trade_id', 'timestamp', 'work_type', 'asset_id', 'model',
    'ex_user', 'ex_user_name', 'ex_user_part',
    'cj_id', 'name', 'part', 'memo'
  ];
  const tsvContent = [
    headers.join('\t'),
    ...data.map(trade => 
      headers.map(header => {
        const value = trade[header] || '';
        // 탭이나 줄바꿈을 포함한 값 처리
        if (typeof value === 'string') {
          return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
        }
        return value;
      }).join('\t')
    )
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

onMounted(fetchTrades);
</script>

<template>
  <div class="page-content">
    <h1>거래 관리</h1>
    
    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
    <div v-if="loading" class="alert alert-info">⏳ 로딩 중...</div>

    <TradeList v-if="!loading" :trades="trades" @download="downloadTSV">
      <template #actions>
        <div style="display: flex; gap: 10px;">
          <button @click="openTrackingModal" class="btn btn-tracking">추적</button>
          <button @click="openExportModal" class="btn btn-export">변경 Export</button>
          <button @click="downloadTSV(trades)" class="btn btn-csv">tsv</button>
        </div>
      </template>
    </TradeList>

    <AssetTrackingModal :is-open="isTrackingOpen" @close="isTrackingOpen = false" />
    <ChangeExportModal :is-open="isExportModalOpen" @close="isExportModalOpen = false" />
    <ConfirmationModal 
      :is-open="isConfirmModalOpen"
      :message="confirmMessage"
      @confirm="handleConfirmYes"
      @cancel="isConfirmModalOpen = false"
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
.btn-tracking { background: #777; color: white; }
.btn-tracking:hover { background: #555; }
.btn-export { background: #777; color: white; }
.btn-export:hover { background: #555; }
.btn-csv { background: #6b8e6f; color: white; }
.btn-csv:hover { background: #5a7a5e; }
</style>