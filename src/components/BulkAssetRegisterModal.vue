<script setup>
import { ref, computed, watch } from 'vue';
import axios from 'axios';

import { getAllWorkTypes } from '../constants/workTypes';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['close', 'success']);

// State
const gridData = ref([]); // 2D array: [[cell, cell], [cell, cell]]
const headerMapping = ref([]); // Array of strings (dbColumn keys) matching grid columns
const rowWorkTypes = ref([]); // Array of work types for each row
const rowMemos = ref([]); // Array of memos for each row
const hasHeaderRow = ref(true);
const workType = ref('신규-계약'); // Global default
const loading = ref(false);
const error = ref(null);
const successMessage = ref(null);

const workTypeOptions = getAllWorkTypes()
  .filter(wt => wt.category === '신규')
  .map(wt => wt.work_type);
const dbColumns = [
  { val: 'asset_number', label: '자산번호(필수)' },
  { val: 'category', label: '분류(필수)' },
  { val: 'model', label: '모델(필수)' },
  { val: 'serial_number', label: '시리얼번호' },
  { val: 'in_user', label: '사용자ID' },
  { val: 'user_name', label: '사용자명' },
  { val: 'user_part', label: '부서' },
  { val: 'state', label: '상태' },
  { val: 'day_of_start', label: '시작일' },
  { val: 'day_of_end', label: '종료일' },
  { val: 'unit_price', label: '월단가' },
  { val: 'memo', label: '자산메모' }
];

// Paste Handler
const handlePaste = (e) => {
  e.preventDefault();
  const clipboardData = e.clipboardData || window.clipboardData;
  const pastedData = clipboardData.getData('Text');
  
  if (!pastedData) return;

  const rows = pastedData.trim().split(/\r\n|\n|\r/);
  const newGrid = rows.map(row => row.split('\t'));

  // Normalize column count
  const maxCols = Math.max(...newGrid.map(row => row.length));
  
  gridData.value = newGrid.map(row => {
    while (row.length < maxCols) row.push('');
    return row;
  });

  // Initialize per-row data
  rowWorkTypes.value = new Array(gridData.value.length).fill(workType.value);
  rowMemos.value = new Array(gridData.value.length).fill('');

  // Initialize header mapping if empty or count changed
  if (headerMapping.value.length !== maxCols) {
    headerMapping.value = new Array(maxCols).fill('');
    
    // Auto-map if header row exists
    if (hasHeaderRow.value && gridData.value.length > 0) {
      const firstRow = gridData.value[0];
      headerMapping.value = firstRow.map(headerText => {
        const text = headerText?.trim() || '';
        const match = dbColumns.find(col => 
          col.label === text || col.val === text || col.label.includes(text)
        );
        return match ? match.val : '';
      });
    }
  }
  
  error.value = null;
};

// Clear Grid
const clearGrid = () => {
  gridData.value = [];
  headerMapping.value = [];
  rowWorkTypes.value = [];
  rowMemos.value = [];
  error.value = null;
  successMessage.value = null;
};

// Create Submit Data
const previewData = computed(() => {
  if (gridData.value.length === 0) return [];
  
  const startIndex = hasHeaderRow.value ? 1 : 0;
  
  const relevantRows = gridData.value.slice(startIndex).map((row, idx) => ({
    row,
    originalIndex: startIndex + idx
  }));
  
  return relevantRows.map(({ row, originalIndex }) => {
    const rowObj = {
      work_type: rowWorkTypes.value[originalIndex] || workType.value,
      state: 'wait',       // Default
      in_user: 'cjenc_inno' // Default
    };
    
    const mappedMemoParts = [];

    row.forEach((cellValue, colIndex) => {
      const field = headerMapping.value[colIndex];
      if (field) {
        const val = String(cellValue || '').trim();
        if (field === 'memo') {
          if (val) mappedMemoParts.push(val);
        } else {
          rowObj[field] = val;
        }
      }
    });

    // Merge manual memo
    const manualMemo = rowMemos.value[originalIndex]?.trim();
    if (manualMemo) mappedMemoParts.push(manualMemo);
    
    rowObj.memo = mappedMemoParts.length > 0 ? mappedMemoParts.join(' / ') : null;
    
    return rowObj;
  }).filter(obj => {
    // Filter out completely empty rows (ignoring defaults)
    return Object.keys(obj).some(k => !['work_type', 'state', 'in_user', 'memo'].includes(k) && obj[k]);
  });
});

const submitBulk = async () => {
  if (previewData.value.length === 0) {
    error.value = '등록할 데이터가 없습니다.';
    return;
  }

  // Basic Validation
  const required = ['asset_number', 'category', 'model'];
  const mappedFields = headerMapping.value.filter(f => f);
  const missingRequired = required.filter(r => !mappedFields.includes(r));
  
  if (missingRequired.length > 0) {
    const labels = missingRequired.map(r => dbColumns.find(c => c.val === r)?.label || r);
    error.value = `필수 항목이 매핑되지 않았습니다: ${labels.join(', ')}`;
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    successMessage.value = null;

    const response = await axios.post('/api/assets/bulk', {
      items: previewData.value,
      default_work_type: workType.value
    });

    if (response.data.success) {
      const { message, errors } = response.data.data;
      let msg = message;
      if (errors && errors.length > 0) {
        msg += ` (일부 실패: ${errors.length}건)`;
      }
      successMessage.value = msg;
      
      setTimeout(() => {
        emit('success');
        clearGrid();
      }, 1500);
    } else {
      error.value = '등록 실패: ' + (response.data.error || '알 수 없는 오류');
    }
  } catch (err) {
    error.value = '요청 실패: ' + (err.response?.data?.error || err.message);
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    clearGrid();
  }
});

watch(workType, (newVal) => {
  if (rowWorkTypes.value.length > 0) {
    rowWorkTypes.value = rowWorkTypes.value.map(() => newVal);
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @mousedown.self="emit('close')">
      <div class="modal-content bulk-modal">
        <div class="modal-header">
          <h2>신규 자산등록 (TSV)</h2>
          <button @click="emit('close')" class="close-btn">✕</button>
        </div>

        <div class="modal-body" @paste="handlePaste">
          <div class="toolbar">
            <div class="left-tools">
              <label class="checkbox-label">
                <input type="checkbox" v-model="hasHeaderRow">
                첫 행은 헤더입니다 (포함 안 함)
              </label>
              <div class="split"></div>
              <label>기본 작업유형:</label>
              <select v-model="workType" class="work-type-select">
                <option v-for="opt in workTypeOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </div>
            <div class="right-tools">
              <button @click="clearGrid" class="btn btn-modal btn-secondary" v-if="gridData.length > 0">초기화</button>
            <button @click="submitBulk" class="btn btn-modal btn-submit" :disabled="loading || successMessage || gridData.length === 0">
              {{ loading ? '등록 중...' : '등록 실행' }}
            </button>
            </div>
          </div>

          <div v-if="error" class="alert alert-error">❌ {{ error }}</div>
          <div v-if="successMessage" class="alert alert-success">✅ {{ successMessage }}</div>

          <div class="grid-container" tabindex="0">
            <div v-if="gridData.length === 0" class="empty-placeholder">
              <div class="placeholder-content">
                <h3>데이터 붙여넣기</h3>
                <p>엑셀 파일에서 데이터를 복사(Ctrl+C)하여<br/>이곳에 붙여넣기(Ctrl+V) 하세요.</p>
                <div class="shortcut-hint">Ctrl + V</div>
              </div>
            </div>

            <div v-else class="table-wrapper">
              <table class="data-grid">
                <thead>
                  <tr>
                    <th class="row-num">#</th>
                    <th class="width-100">작업유형</th>
                    <th v-for="(colKey, index) in headerMapping" :key="'h-' + index" class="col-header">
                      <select v-model="headerMapping[index]" class="column-select" :class="{ 'mapped': headerMapping[index] }">
                        <option value="">(선택 안함)</option>
                        <option v-for="dbCol in dbColumns" :key="dbCol.val" :value="dbCol.val">
                          {{ dbCol.label }}
                        </option>
                      </select>
                    </th>
                    <th class="width-150">비고(메모)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIndex) in gridData" :key="'r-' + rIndex" :class="{ 'header-row-visual': hasHeaderRow && rIndex === 0 }">
                    <td class="row-num text-center">
                      {{ hasHeaderRow && rIndex === 0 ? 'H' : rIndex + (hasHeaderRow ? 0 : 1) }}
                    </td>
                    <td class="text-center">
                      <select v-if="!(hasHeaderRow && rIndex === 0)" v-model="rowWorkTypes[rIndex]" class="row-select">
                        <option v-for="opt in workTypeOptions" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                      <span v-else>-</span>
                    </td>
                    <td v-for="(cell, cIndex) in row" :key="'c-' + rIndex + '-' + cIndex">
                      <input 
                        v-model="gridData[rIndex][cIndex]" 
                        class="cell-input" 
                        :readonly="hasHeaderRow && rIndex === 0"
                      />
                    </td>
                    <td>
                      <input 
                        v-if="!(hasHeaderRow && rIndex === 0)"
                        v-model="rowMemos[rIndex]" 
                        class="cell-input" 
                        placeholder="메모 입력"
                      />
                      <span v-else class="text-center block">-</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="footer-info" v-if="gridData.length > 0">
            총 {{ previewData.length }}건 등록 가능
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
}
.modal-content.bulk-modal {
  width: 1200px;
  max-width: 95%;
  height: 85vh;
  background: white;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fdfdfd;
}
.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #f0f0f0;
}
.left-tools { display: flex; align-items: center; gap: 15px; }
.right-tools { display: flex; gap: 10px; }
.split { width: 1px; height: 20px; background: #ddd; }
.work-type-select { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; }
.checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; font-size: 14px; }
.btn-submit { background: #3f51b5; color: white; }
.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.grid-container { flex: 1; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; background: #f9f9f9; }
.empty-placeholder { flex: 1; display: flex; justify-content: center; align-items: center; color: #888; }
.placeholder-content { text-align: center; }
.shortcut-hint { display: inline-block; margin-top: 15px; padding: 5px 10px; background: #eee; border-radius: 4px; font-family: monospace; font-weight: bold; color: #555; }
.table-wrapper { flex: 1; overflow: auto; }
.data-grid { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; min-width: 100%; }
.data-grid th, .data-grid td { border: 1px solid #ddd; padding: 0; min-width: 120px; height: 32px; white-space: nowrap; overflow: hidden; }
.data-grid td { background: white; }
.data-grid th { background: #f0f0f0; position: sticky; top: 0; z-index: 10; padding: 4px; }
.data-grid .row-num { width: 40px; min-width: 40px; text-align: center; background: #f5f5f5; color: #666; position: sticky; left: 0; z-index: 11; }
.col-header select { width: 100%; border: 1px solid #ccc; border-radius: 2px; padding: 2px; font-size: 12px; }
.col-header select.mapped { border-color: #4caf50; background-color: #e8f5e9; font-weight: bold; }
.cell-input { width: 100%; height: 100%; border: none; padding: 0 8px; background: transparent; box-sizing: border-box; }
.cell-input:focus { outline: 2px solid #3f51b5; background: #fff; z-index: 2; position: relative; }
.row-select { width: 100%; border: none; background: transparent; padding: 0 4px; font-size: 12px; }
.width-100 { min-width: 100px; width: 100px; }
.width-150 { min-width: 150px; width: 150px; }
.header-row-visual td { background-color: #e3f2fd; color: #1565c0; font-weight: 500; }
.header-row-visual input { font-weight: bold; color: #1565c0; }
.alert { padding: 10px; margin-bottom: 15px; border-radius: 4px; }
.alert-error { background: #fee; color: #c00; }
.alert-success { background: #efe; color: #090; }
.footer-info { margin-top: 10px; font-size: 13px; color: #666; text-align: right; }
.block { display: block; }
.text-center { text-align: center; }
</style>
