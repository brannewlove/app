<script setup>
import { ref, onMounted, computed } from 'vue';

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['close']);

const replacementAssets = ref([]);
const excludedReplacements = ref({}); // { [asset_number]: { checked: true } }
const loading = ref(false);
const error = ref(null);
const isCopied = ref(false);
const showHidden = ref(false); // 체크된(숨겨진) 자산 표시 여부
const isDragging = ref(false);

const closeModal = () => {
  emit('close');
};

const handleMouseDown = () => { isDragging.value = true; };
const handleMouseUp = () => { isDragging.value = false; };

const loadConfirmedReplacements = async () => {
  try {
    const response = await fetch('/api/confirmedReplacements');
    const result = await response.json();
    if (result.success && result.data) {
      excludedReplacements.value = result.data.reduce((acc, item) => {
        acc[String(item.asset_number)] = { checked: true };
        return acc;
      }, {});
    }
  } catch (err) {
    console.error('교체 확인 로드 실패:', err);
  }
};

const saveConfirmedReplacement = async (assetNumber) => {
  try {
    await fetch('/api/confirmedReplacements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_number: assetNumber }),
    });
  } catch (err) {
    console.error('교체 확인 저장 에러:', err);
  }
};

const deleteConfirmedReplacement = async (assetNumber) => {
  try {
    await fetch(`/api/confirmedReplacements/${assetNumber}`, { method: 'DELETE' });
  } catch (err) {
    console.error('교체 확인 삭제 에러:', err);
  }
};

const fetchReplacementAssets = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch('/api/assets?onlyReplacements=true');
    const result = await response.json();
    if (result.success && result.data) {
      replacementAssets.value = result.data.sort((a, b) => b.asset_id - a.asset_id);
    } else {
      throw new Error(result.message || '데이터 로드 실패');
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const toggleAssetExclude = (assetNumber) => {
  if (excludedReplacements.value[assetNumber]?.checked) {
    delete excludedReplacements.value[assetNumber];
    deleteConfirmedReplacement(assetNumber);
  } else {
    excludedReplacements.value[assetNumber] = { checked: true };
    saveConfirmedReplacement(assetNumber);
  }
};

const toggleAllExclude = (event) => {
  if (event.target.checked) {
    visibleAssets.value.forEach(asset => {
      if (!excludedReplacements.value[asset.asset_number]?.checked) {
        excludedReplacements.value[asset.asset_number] = { checked: true };
        saveConfirmedReplacement(asset.asset_number);
      }
    });
  } else {
    // 현재 보이는 자산들만 체크 해제 (이미 숨겨진 것들은 유지됨)
    visibleAssets.value.forEach(asset => {
        if (excludedReplacements.value[asset.asset_number]?.checked) {
            delete excludedReplacements.value[asset.asset_number];
            deleteConfirmedReplacement(asset.asset_number);
        }
    });
  }
};

const visibleAssets = computed(() => {
  if (showHidden.value) return replacementAssets.value;
  return replacementAssets.value.filter(asset => !excludedReplacements.value[asset.asset_number]?.checked);
});

const copyToClipboard = () => {
  const dataToCopy = visibleAssets.value;
  if (dataToCopy.length === 0) return;

  const headers = ['교체전 자산', '교체후 자산', '모델명', '제조번호', '사용자명', '부서'];
  
  // HTML 버전 (요청하신 스타일 적용)
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 13px; font-family: sans-serif; border: 1px solid #000000; width: 100%;">
      <thead>
        <tr style="background-color: #bbbbbb;">
          ${headers.map(h => `<th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000; font-weight: bold;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${dataToCopy.map(asset => `
          <tr style="color: #000000;">
            <td style="border: 1px solid #000000; padding: 8px;">${asset.asset_number || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.replacement || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.model || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.serial_number || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.replacement_user_name || '-'}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.replacement_user_part || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // 텍스트 버전 (Fallback)
  const plainText = [
    headers.join('\t'),
    ...dataToCopy.map(asset => [
      asset.asset_number || '', 
      asset.replacement || '', 
      asset.model || '', 
      asset.serial_number || '',
      asset.replacement_user_name || '-', 
      asset.replacement_user_part || '-'
    ].join('\t'))
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
  const dataToDownload = visibleAssets.value;
  if (dataToDownload.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, '');
  const filename = `AssetReplacements_${timestamp}.csv`;
  const headers = ['교체전 자산', '교체후 자산', '모델명', '제조번호', '사용자명', '부서'];

  const escapeCSV = (val) => {
    let s = String(val === null || val === undefined ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csvContent = [
    headers.map(h => escapeCSV(h)).join(','),
    ...dataToDownload.map(asset => {
      return [
        asset.asset_number || '', 
        asset.replacement || '', 
        asset.model || '', 
        asset.serial_number || '',
        asset.replacement_user_name || '-', 
        asset.replacement_user_part || '-'
      ].map(value => escapeCSV(value)).join(',');
    })
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

onMounted(async () => {
    await loadConfirmedReplacements();
    await fetchReplacementAssets();
});
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="!isDragging && closeModal()">
    <div class="modal-content" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 15px;">
          <h2>교체 Export</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              class="header-copy-btn" 
              @click="copyToClipboard" 
              :title="isCopied ? '복사 완료!' : '클립보드 복사'"
              :disabled="replacementAssets.length === 0"
            >
              <img v-if="!isCopied" src="/images/clipboard.png" alt="copy" style="width: 20px; height: 20px; object-fit: contain;" />
              <span v-else style="color: #27ae60; font-size: 14px; font-weight: bold;">✓</span>
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
        <div v-if="loading" class="alert alert-info">⏳ 데이터 로딩 중...</div>
        <div v-else-if="error" class="alert alert-error">❌ {{ error }}</div>
        <div v-else-if="replacementAssets.length > 0">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <p style="color: #666; font-size: 14px;">대상: {{ visibleAssets.length }}개 (총 {{ replacementAssets.length }}개 중)</p>
            <p v-if="replacementAssets.length > visibleAssets.length" style="color: #e67e22; font-size: 12px; font-weight: bold;">* 체크된 항목 숨김 처리됨</p>
          </div>
          <div class="table-container">
            <table class="export-table">
              <thead>
                <tr>
                  <th style="width: 40px;">
                    <input type="checkbox" :checked="visibleAssets.length > 0 && visibleAssets.every(a => excludedReplacements[a.asset_number]?.checked)" @change="toggleAllExclude" />
                  </th>
                  <th>교체전 자산</th>
                  <th>교체후 자산</th>
                  <th>모델명</th>
                  <th>제조번호</th>
                  <th>사용자명</th>
                  <th>부서</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in visibleAssets" :key="asset.asset_id">
                   <td style="text-align: center;">
                    <input type="checkbox" :checked="excludedReplacements[asset.asset_number]?.checked || false" @change="() => toggleAssetExclude(asset.asset_number)" />
                  </td>
                  <td>{{ asset.asset_number }}</td>
                  <td style="font-weight: bold; color: var(--brand-blue);">{{ asset.replacement }}</td>
                  <td>{{ asset.model }}</td>
                  <td style="font-size: 0.9em; color: #666;">{{ asset.serial_number || '-' }}</td>
                  <td>{{ asset.replacement_user_name || '-' }}</td>
                  <td>{{ asset.replacement_user_part || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-secondary" @click="closeModal">닫기</button>
            <button class="btn btn-primary btn-tsv" @click="downloadCSV" :disabled="visibleAssets.length === 0">
              <img src="/images/down.png" alt="download" class="btn-icon" />
              csv
            </button>
          </div>
        </div>
        <div v-else class="empty-state">교체 처리된 자산이 없습니다.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; border-radius: 8px; width: 90%; max-width: 850px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #eee; background: #f9f9f9; flex-shrink: 0; }
.modal-header h2 { margin: 0; color: #333; }
.modal-close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
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
  background: #f0f0f0;
  color: #4a6f8f;
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
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.table-container { border: 1px solid #eee; border-radius: 4px; overflow: hidden; }
.export-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.export-table th { background: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid var(--border-color); font-weight: bold; color: #333; }
.export-table td { padding: 12px; border-bottom: 1px solid #eee; }
.export-table tbody tr:hover { background: #f9f9f9; }

.btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; }
.btn-primary { background: var(--brand-blue); color: white; }
.btn-primary:hover { background: #4a6f8f; }
.btn-secondary { background: white; color: #333; border: 1px solid var(--border-color); }
.btn-copy, .btn-tsv { display: flex; align-items: center; justify-content: center; gap: 5px; }
.btn-icon { width: 14px; height: 14px; filter: brightness(0) invert(1); }
.alert { padding: 15px; border-radius: 5px; margin-bottom: 15px; }
.alert-info { background: #f0f7ff; color: #004085; }
.alert-error { background: #fff5f5; color: #c53030; }
.empty-state { text-align: center; padding: 50px; color: #999; }
</style>
