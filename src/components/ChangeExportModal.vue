<script setup>
import { ref, onMounted, computed } from 'vue';
import { getTimestampFilename } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';

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
const showHidden = ref(false); // 체크된(숨겨진) 자산 표시 여부

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
  if (showHidden.value) return exportAssets.value;
  return exportAssets.value.filter(asset => !excludedAssets.value[asset.asset_number]?.checked);
});

const copyToClipboard = () => {
  // 현재 가시성 상태에 관계없이 '보이는' 자산만 포함 (사용자 최신 요청 반영)
  const dataToCopy = visibleAssets.value;
  
  if (dataToCopy.length === 0) return;

  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];
  
  // HTML 버전 (요청하신 스타일 적용)
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 13px; font-family: sans-serif; border: 1px solid #000000; width: 100%;">
      <thead>
        <tr style="background-color: #bbbbbb;">
          ${headers.map(h => `<th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000; font-weight: bold;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${dataToCopy.map(asset => {
          const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
          return `
            <tr style="color: #000000;">
              <td style="border: 1px solid #000000; padding: 8px;">${asset.asset_number || ''}</td>
              <td style="border: 1px solid #000000; padding: 8px;">${asset.cj_id || ''}</td>
              <td style="border: 1px solid #000000; padding: 8px;">${asset.user_name || ''}</td>
              <td style="border: 1px solid #000000; padding: 8px;">${dateStr}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  // 텍스트 버전 (Fallback)
  const plainText = [
    headers.join('\t'),
    ...dataToCopy.map(asset => {
      const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
      return [asset.asset_number || '', asset.cj_id || '', asset.user_name || '', dateStr].join('\t');
    })
  ].join('\n');

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

const downloadCSV = () => {
  const dataToDownload = exportAssets.value;
  
  if (dataToDownload.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  
  const filename = getTimestampFilename('AssetCurrentUsers');
  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];

  const dataRows = dataToDownload.map(asset => {
    const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
    return [asset.asset_number || '', asset.cj_id || '', asset.user_name || '', dateStr];
  });
  
  downloadCSVFile(filename, headers, dataRows);
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
        <div style="display: flex; align-items: center; gap: 15px;">
          <h2>변경 Export</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              class="header-copy-btn" 
              @click="copyToClipboard" 
              :title="isCopied ? '복사 완료!' : '클립보드 복사'"
              :disabled="exportAssets.length === 0"
            >
              <img v-if="!isCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
              <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
            </button>
            
            <button 
              class="btn-toggle-hidden" 
              @click="showHidden = !showHidden"
              :class="{ active: showHidden }"
              :title="showHidden ? '체크된 항목 숨기기' : '체크된 항목 표시'"
            >
              {{ showHidden ? '숨김 항목 제외' : '모든 항목 표시' }}
            </button>
          </div>
        </div>
        <button class="modal-close-btn" @click="closeModal">✕</button>
      </div>
      <div class="modal-body">
        <div v-if="exportLoading" class="alert alert-info"><img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 데이터 로딩 중...</div>
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
            <button class="btn btn-modal btn-secondary" @click="closeModal">닫기</button>
            <button class="btn btn-modal btn-primary btn-tsv" @click="downloadCSV" :disabled="exportAssets.length === 0">
              <img src="/images/down.png" alt="download" class="btn-icon" />
              csv
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
.header-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--brand-blue);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border-radius: 4px;
  transition: all 0.2s;
}
.header-copy-btn:hover:not(:disabled) {
  transform: scale(1.1);
  opacity: 0.8;
}
.header-copy-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.btn-toggle-hidden {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  background: #fdfdfd;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}
.btn-toggle-hidden:hover {
  background: #f5f5f5;
  border-color: var(--border-color);
}
.btn-toggle-hidden.active {
  background: var(--brand-blue);
  color: white;
  border-color: #4a6f8f;
}
.modal-body { padding: 20px; }
.alert { padding: 15px 20px; border-radius: 5px; margin-bottom: 20px; font-size: 16px; }
.alert-error { background: #fef2f2; color: #e74c3c; border-left: 4px solid #e74c3c; }
.alert-info { background: #f5f5f5; color: #666; border-left: 4px solid #999; }
.btn-primary:disabled { background: var(--border-color); cursor: not-allowed; opacity: 0.6; }

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
  filter: brightness(0) invert(1);
}

.btn-secondary { background: white; color: #333; border: 1px solid var(--border-color); }
.btn-secondary:hover { background: #f5f5f5; }
.export-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
.export-table th { background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color); font-weight: bold; color: #333; }
.export-table td { padding: 12px; border-bottom: 1px solid #eee; }
.export-table tbody tr:hover { background: #f9f9f9; }
.export-table tbody tr.excluded { opacity: 0.6; text-decoration: line-through; }
.export-table input[type="checkbox"] { cursor: pointer; width: 18px; height: 18px; }
.tracking-logs-empty { text-align: center; padding: 30px; color: #999; }

.loading-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}

.checkmark-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
}
</style>
