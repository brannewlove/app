<script setup>
import { ref, onMounted, computed } from 'vue';

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
const isCopied = ref(false);

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
        acc[String(item.asset_number)] = { checked: true, cj_id: item.cj_id };
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
      body: JSON.stringify({ asset_number: assetId, cj_id: cj_id }),
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
      const savedInfo = excludedAssets.value[current.asset_number];
      if (savedInfo?.checked && savedInfo.cj_id !== current.cj_id) {
        delete excludedAssets.value[current.asset_number];
        await deleteConfirmedAsset(current.asset_number, savedInfo.cj_id);
      }
    }
    exportAssets.value = sortedData;
  } catch (err) {
    exportError.value = err.message;
  } finally {
    exportLoading.value = false;
  }
};

const toggleAssetExclude = (assetNumber) => {
  const asset = exportAssets.value.find(a => a.asset_number === assetNumber);
  if (!asset) return;
  if (excludedAssets.value[assetNumber]?.checked) {
    const cj_id = excludedAssets.value[assetNumber].cj_id;
    delete excludedAssets.value[assetNumber];
    deleteConfirmedAsset(assetNumber, cj_id);
  } else {
    excludedAssets.value[assetNumber] = { checked: true, cj_id: asset.cj_id };
    saveConfirmedAsset(assetNumber, asset.cj_id);
  }
};

const toggleAllExclude = (event) => {
  if (event.target.checked) {
    exportAssets.value.forEach(asset => {
      if (!excludedAssets.value[asset.asset_number]?.checked) {
        excludedAssets.value[asset.asset_number] = { checked: true, cj_id: asset.cj_id };
        saveConfirmedAsset(asset.asset_number, asset.cj_id);
      }
    });
  } else {
    Object.entries(excludedAssets.value).forEach(([assetId, info]) => {
      if (info.checked) deleteConfirmedAsset(assetId, info.cj_id);
    });
    excludedAssets.value = {};
  }
};

const visibleAssets = computed(() => {
  return exportAssets.value.filter(asset => !excludedAssets.value[asset.asset_number]?.checked);
});

const copyToClipboard = () => {
  // 체크 여부와 상관없이 '모든' 자산 포함 (사용자 요청 반영)
  const dataToCopy = exportAssets.value;
  
  if (dataToCopy.length === 0) return;

  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];
  const tsvContent = [
    headers.join('\t'),
    ...dataToCopy.map(asset => {
      const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
      return [asset.asset_number || '', asset.cj_id || '', asset.user_name || '', dateStr]
        .map(value => String(value).replace(/\t/g, ' ').replace(/\n/g, ' '))
        .join('\t');
    })
  ].join('\n');

  navigator.clipboard.writeText(tsvContent).then(() => {
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
  });
};

const downloadExportData = () => {
  // TSV 다운로드 시에는 체크 여부와 상관없이 '모든' 자산 포함 (사용자 요청)
  const dataToDownload = exportAssets.value;
  
  if (dataToDownload.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
  const filename = `AssetCurrentUsers_${timestamp}.tsv`;
  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];
  const tsvContent = [
    headers.join('\t'),
    ...dataToDownload.map(asset => {
      const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
      return [asset.asset_number || '', asset.cj_id || '', asset.user_name || '', dateStr]
        .map(value => String(value).replace(/\t/g, ' ').replace(/\n/g, ' '))
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <p style="color: #666; font-size: 14px;">대상: {{ visibleAssets.length }}개 (총 {{ exportAssets.length }}개 중)</p>
            <p v-if="exportAssets.length > visibleAssets.length" style="color: #e67e22; font-size: 12px; font-weight: bold;">* 체크 완료된 {{ exportAssets.length - visibleAssets.length }}개 자산 숨김 처리됨</p>
          </div>
          <table class="export-table">
            <thead>
              <tr>
                <th style="width: 40px;">
                  <input type="checkbox" :checked="visibleAssets.length > 0 && visibleAssets.every(a => excludedAssets[a.asset_number]?.checked)" @change="toggleAllExclude" />
                </th>
                <th>자산ID</th>
                <th>사용자ID</th>
                <th>사용자명</th>
                <th>최종변경시간</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asset in visibleAssets" :key="asset.asset_number" :class="{ excluded: excludedAssets[asset.asset_number]?.checked }">
                <td style="text-align: center;">
                  <input type="checkbox" :checked="excludedAssets[asset.asset_number]?.checked || false" @change="() => toggleAssetExclude(asset.asset_number)" />
                </td>
                <td>{{ asset.asset_number }}</td>
                <td>{{ asset.cj_id }}</td>
                <td>{{ asset.user_name || '-' }}</td>
                <td>{{ new Date(asset.timestamp).toLocaleString('ko-KR') }}</td>
              </tr>
            </tbody>
          </table>
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-secondary" @click="closeModal">닫기</button>
            <button class="btn btn-primary btn-copy" @click="copyToClipboard" :disabled="exportAssets.length === 0">
              {{ isCopied ? '✓' : '복사' }}
            </button>
            <button class="btn btn-primary btn-tsv" @click="downloadExportData" :disabled="exportAssets.length === 0">
              <img src="/images/down.png" alt="download" class="btn-icon" />
              tsv
            </button>
          </div>
        </div>
        <div v-else class="tracking-logs-empty">데이터가 없습니다.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; border-radius: 8px; width: 90%; max-width: 800px; max-height: 80vh; overflow: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
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

.btn-tsv, .btn-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.btn-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* 흰색으로 변경 */
}

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
