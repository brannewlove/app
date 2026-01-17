<script setup>
import { ref, defineProps, defineEmits, onMounted } from 'vue';

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const exportAssets = ref([]);
const exportLoading = ref(false);
const exportError = ref(null);
const excludedAssets = ref({});
const isDragging = ref(false); // 드래그 상태 추적

const closeModal = () => {
  emit('close');
};

// 드래그 시작 시 호출
const handleMouseDown = () => {
  isDragging.value = true;
};

// 드래그 종료 시 호출
const handleMouseUp = () => {
  isDragging.value = false;
};

const loadConfirmedAssets = async () => {
  try {
    const response = await fetch('/api/confirmedAssets');
    const result = await response.json();
    if (result.success && result.data) {
      excludedAssets.value = result.data.reduce((acc, item) => {
        acc[String(item.asset_id)] = { checked: true, cj_id: item.cj_id };
        return acc;
      }, {});
    }
  } catch (err) {
    console.error('확인된 자산 로드 실패:', err);
  }
};

const saveConfirmedAsset = async (assetId, cj_id) => {
  try {
    await fetch('/api/confirmedAssets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, cj_id: cj_id }),
    });
  } catch (err) {
    console.error('자산 확인 저장 에러:', err);
  }
};

const deleteConfirmedAsset = async (assetId, cj_id) => {
  try {
    await fetch(`/api/confirmedAssets/${assetId}/${cj_id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('자산 확인 삭제 에러:', err);
  }
};

const fetchExportAssets = async () => {
  exportLoading.value = true;
  exportError.value = null;
  try {
    const response = await fetch('/api/assetLogs/currentUsers');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '데이터 조회 실패');
    
    const sortedData = (data.data || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const current of sortedData) {
      const savedInfo = excludedAssets.value[current.asset_id];
      if (savedInfo?.checked && savedInfo.cj_id !== current.cj_id) {
        delete excludedAssets.value[current.asset_id];
        await deleteConfirmedAsset(current.asset_id, savedInfo.cj_id);
      }
    }
    exportAssets.value = sortedData;
  } catch (err) {
    exportError.value = err.message;
  } finally {
    exportLoading.value = false;
  }
};

const toggleAssetExclude = (assetId) => {
  const asset = exportAssets.value.find(a => a.asset_id === assetId);
  if (!asset) return;
  if (excludedAssets.value[assetId]?.checked) {
    const cj_id = excludedAssets.value[assetId].cj_id;
    delete excludedAssets.value[assetId];
    deleteConfirmedAsset(assetId, cj_id);
  } else {
    excludedAssets.value[assetId] = { checked: true, cj_id: asset.cj_id };
    saveConfirmedAsset(assetId, asset.cj_id);
  }
};

const toggleAllExclude = (event) => {
  if (event.target.checked) {
    exportAssets.value.forEach(asset => {
      if (!excludedAssets.value[asset.asset_id]?.checked) {
        excludedAssets.value[asset.asset_id] = { checked: true, cj_id: asset.cj_id };
        saveConfirmedAsset(asset.asset_id, asset.cj_id);
      }
    });
  } else {
    Object.entries(excludedAssets.value).forEach(([assetId, info]) => {
      if (info.checked) deleteConfirmedAsset(assetId, info.cj_id);
    });
    excludedAssets.value = {};
  }
};

const downloadExportData = () => {
  const filteredAssets = exportAssets.value.filter(asset => !excludedAssets.value[asset.asset_id]?.checked);
  if (filteredAssets.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
  const filename = `AssetCurrentUsers_${timestamp}.tsv`;
  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];
  const tsvContent = [
    headers.join('\t'),
    ...filteredAssets.map(asset => {
      const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
      return [asset.asset_id || '', asset.cj_id || '', asset.user_name || '', dateStr]
        .map(value => {
          if (typeof value === 'string') {
            return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
          }
          return value;
        })
        .join('\t');
    })
  ].join('\n');
  const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(async () => {
    await loadConfirmedAssets();
    await fetchExportAssets();
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="!isDragging && closeModal()">
    <div class="modal-content" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
      <div class="modal-header">
        <h2>변경 Export</h2>
        <button class="modal-close-btn" @click="closeModal">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="exportLoading" class="alert alert-info">⏳ 데이터 로딩 중...</div>
        <div v-else-if="exportError" class="alert alert-error">❌ {{ exportError }}</div>
        <div v-else-if="exportAssets.length > 0">
          <p style="color: #666; font-size: 14px;">총 {{ exportAssets.length }}개 자산</p>
          <table class="export-table">
            <thead>
              <tr>
                <th style="width: 40px;">
                  <input type="checkbox" :checked="Object.keys(excludedAssets).length > 0 && Object.keys(excludedAssets).length === exportAssets.length" @change="toggleAllExclude" />
                </th>
                <th>자산ID</th>
                <th>사용자ID</th>
                <th>사용자명</th>
                <th>최종변경시간</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asset in exportAssets" :key="asset.asset_id" :class="{ excluded: excludedAssets[asset.asset_id]?.checked }">
                <td style="text-align: center;">
                  <input type="checkbox" :checked="excludedAssets[asset.asset_id]?.checked || false" @change="() => toggleAssetExclude(asset.asset_id)" />
                </td>
                <td>{{ asset.asset_id }}</td>
                <td>{{ asset.cj_id }}</td>
                <td>{{ asset.user_name || '-' }}</td>
                <td>{{ new Date(asset.timestamp).toLocaleString('ko-KR') }}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-secondary" @click="closeModal">취소</button>
            <button class="btn btn-primary" @click="downloadExportData" :disabled="exportAssets.length === 0">TSV 다운로드</button>
          </div>
        </div>
        <div v-else class="tracking-logs-empty">데이터가 없습니다.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; border-radius: 8px; max-width: 1200px; max-height: 80vh; overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #eee; background: #f9f9f9; }
.modal-header h2 { margin: 0; color: #333; }
.modal-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
.modal-close-btn:hover { color: #333; }
.modal-body { padding: 20px; }
.alert { padding: 15px 20px; border-radius: 5px; margin-bottom: 20px; font-size: 16px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-info { background: #f5f5f5; color: #666; border-left: 4px solid #999; }
.btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; }
.btn-primary { background: #666; color: white; }
.btn-primary:hover { background: #555; }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; opacity: 0.6; }
.btn-secondary { background: white; color: #333; border: 1px solid #ddd; }
.btn-secondary:hover { background: #f5f5f5; }
.export-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
.export-table th { background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: bold; color: #333; }
.export-table td { padding: 12px; border-bottom: 1px solid #eee; }
.export-table tbody tr:hover { background: #f9f9f9; }
.export-table tbody tr.excluded { opacity: 0.6; text-decoration: line-through; }
.export-table input[type="checkbox"] { cursor: pointer; width: 18px; height: 18px; }
.tracking-logs-empty { text-align: center; padding: 30px; color: #999; }
</style>
