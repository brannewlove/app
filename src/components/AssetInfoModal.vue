<script setup>
import { ref, watch } from 'vue';
import assetApi from '../api/assets';

const props = defineProps({
  isOpen: Boolean,
  assetNumber: String,
  showEdit: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'user-detail', 'trade-search', 'edit', 'updated', 'track', 'quick-trade']);

const loading = ref(false);
const error = ref(null);
const asset = ref(null);
const isAssetCopied = ref(false);

const isEditMode = ref(false);
const editedAsset = ref(null);

const assetModalFields = [
  'category', 'model', 'asset_number', 'serial_number',
  'day_of_start', 'day_of_end', 'contract_month',
  'in_user', 'user_name', 'user_part', 'state', 'replacement', 'memo'
];

const stateOptions = ['useable', 'wait', 'hold', 'rent', 'repair', 'termination', 'process-ter'];

const getHeaderDisplayName = (columnName) => {
  const headerMap = {
    'asset_id': '자산ID',
    'asset_number': '자산번호',
    'model': '모델',
    'category': '분류',
    'serial_number': '시리얼번호',
    'state': '상태',
    'in_user': '사용자ID',
    'user_name': '사용자명',
    'user_part': '부서',
    'day_of_start': '시작일',
    'day_of_end': '종료일',
    'unit_price': '월단가',
    'contract_month': '계약월',
    'replacement': '고장교체',
    'memo': '자산메모'
  };
  return headerMap[columnName] || columnName;
};

const formatCellValue = (value, columnName, item) => {
  if (columnName === 'user_name') return item.user_name || '-';
  if (columnName === 'user_part') return item.user_part || '-';
  if (!value) return value;
  if (columnName === 'day_of_start' || columnName === 'day_of_end') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  return value;
};

const fetchAsset = async () => {
  if (!props.assetNumber) return;
  loading.value = true;
  error.value = null;
  try {
    const data = await assetApi.getAssetByNumber(props.assetNumber);
    asset.value = data;
    editedAsset.value = JSON.parse(JSON.stringify(data));
  } catch (err) {
    error.value = '자산 정보를 불러오는 데 실패했습니다.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    isEditMode.value = false;
    fetchAsset();
  } else {
    asset.value = null;
    editedAsset.value = null;
  }
});

const toggleEditMode = () => {
  if (isEditMode.value) {
    editedAsset.value = JSON.parse(JSON.stringify(asset.value));
    isEditMode.value = false;
  } else {
    isEditMode.value = true;
  }
};

const saveAsset = async () => {
  try {
    loading.value = true;
    error.value = null;
    await assetApi.updateAsset(editedAsset.value.asset_id, editedAsset.value);
    asset.value = JSON.parse(JSON.stringify(editedAsset.value));
    isEditMode.value = false;
    emit('updated', asset.value);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const copyAssetInfoDetailed = () => {
  if (!asset.value) return;

  const fields = assetModalFields.filter(key => asset.value[key] !== undefined && key !== 'replacement');
  
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 12px; width: 100%; font-family: sans-serif; border: 1px solid #000000;">
      <thead>
        <tr style="font-weight: bold; color: #000000;">
          ${fields.map(field => `<th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">${getHeaderDisplayName(field)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${fields.map(field => `<td style="border: 1px solid #000000; padding: 10px; color: #000000;">${formatCellValue(asset.value[field], field, asset.value) || '-'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;

  const plainText = fields.map(field => `${getHeaderDisplayName(field)}: ${formatCellValue(asset.value[field], field, asset.value) || '-'}`).join('\n');

  const blobHtml = new Blob([htmlTable], { type: 'text/html' });
  const blobText = new Blob([plainText], { type: 'text/plain' });
  const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

  navigator.clipboard.write(data).then(() => {
    isAssetCopied.value = true;
    setTimeout(() => {
      isAssetCopied.value = false;
    }, 2000);
  }).catch(err => {
    console.error('클립보드 복사 실패:', err);
  });
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h2 style="margin: 0;">자산 정보</h2>
          <button class="copy-btn-small" @click="copyAssetInfoDetailed" title="클립보드 복사">
            <img v-if="!isAssetCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
            <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
          </button>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button v-if="asset" class="btn-trade-search" @click="emit('trade-search', asset.asset_number)">
            <img src="/images/go.png" alt="search" class="btn-icon-custom" />
            거래검색
          </button>
          <button @click="emit('close')" class="close-btn">✕</button>
        </div>
      </div>
      
      <div class="modal-body">
        <div v-if="loading && !asset" class="loading-state">
          <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...
        </div>
        <div v-else-if="error" class="alert alert-error">
          {{ error }}
        </div>
        <div v-else-if="asset" class="form-grid">
          <template v-for="key in assetModalFields" :key="key">
            <div v-if="asset[key] !== undefined" class="form-group" :class="{ 'span-2': key === 'memo' }">
              <label>
                {{ getHeaderDisplayName(key) }}
                <button 
                  v-if="key === 'user_name' && asset.in_user && asset.in_user !== 'cjenc_inno'" 
                  class="btn-user-link-tiny" 
                  @click="emit('user-detail', asset.in_user)"
                  title="사용자 정보 보기"
                >
                  <img src="/images/link.png" alt="user info" class="link-icon-tiny" />
                </button>
              </label>
              
              <select v-if="isEditMode && key === 'state'" v-model="editedAsset[key]" class="form-input">
                <option v-for="opt in stateOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input v-else-if="isEditMode" v-model="editedAsset[key]" type="text" class="form-input" :disabled="['asset_id', 'category', 'asset_number', 'in_user', 'contract_month', 'unit_price', 'replacement'].includes(key)" />
              <div v-else class="form-value"> {{ formatCellValue(asset[key], key, asset) }} </div>
            </div>
          </template>
        </div>
      </div>

      <div class="modal-footer" v-if="asset">
        <template v-if="!isEditMode">
          <button @click="emit('quick-trade', asset)" class="btn btn-modal btn-trade">+ 거래</button>
          <button @click="emit('track', asset)" class="btn btn-modal btn-tracking">추적</button>
          <button v-if="showEdit" @click="toggleEditMode" class="btn btn-modal btn-edit">수정</button>
        </template>
        <template v-else>
          <button @click="saveAsset" class="btn btn-modal btn-save" :disabled="loading">저장</button>
          <button @click="toggleEditMode" class="btn btn-modal btn-cancel">취소</button>
        </template>
        <button @click="emit('close')" class="btn btn-modal btn-close">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--card-bg, #fff);
  padding: 24px;
  border-radius: var(--radius-lg, 12px);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1));
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color, #eee);
  padding-bottom: 15px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color, #eee);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-muted, #666);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.span-2 {
  grid-column: span 2;
}

@media (max-width: 600px) {
  .form-group.span-2 {
    grid-column: span 1;
  }
}

.form-group label {
  font-weight: 600;
  color: var(--text-muted, #666);
  font-size: 13px;
  display: flex;
  align-items: center;
}

.form-value {
  padding: 10px;
  background: var(--bg-main, #f9f9f9);
  border-radius: var(--radius-sm, 4px);
  border: 1px solid var(--border-color, #eee);
  font-size: 14px;
  min-height: 40px;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: white;
  font-size: 14px;
}

.form-input:disabled {
  background: var(--bg-muted);
  color: var(--text-light);
  cursor: not-allowed;
}

.btn-modal {
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-close { background: var(--bg-muted); color: var(--text-main); }
.btn-save { background: var(--brand-blue); color: white; }
.btn-cancel { background: var(--bg-muted); color: var(--text-main); }
.btn-edit { background: var(--secondary-color); color: white; }
.btn-trade { background: var(--brand-blue); color: white; }
.btn-tracking { background: var(--secondary-color, #4a5568); color: white; }

.btn-modal:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.copy-btn-small {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}

.copy-icon, .checkmark-icon {
  width: 16px;
  height: 16px;
}

.btn-trade-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--brand-blue, #0052cc);
  color: white;
  border: none;
  border-radius: var(--radius-md, 6px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.btn-icon-custom {
  width: 14px;
  height: 14px;
  filter: brightness(0) invert(1);
}

.btn-user-link-tiny {
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 5px;
  padding: 0;
  display: flex;
}

.link-icon-tiny {
  width: 12px;
  height: 12px;
  opacity: 0.6;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 10px;
  color: var(--text-muted);
}

.loading-icon {
  width: 20px;
  height: 20px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
