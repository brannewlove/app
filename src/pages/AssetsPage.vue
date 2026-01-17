<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';

const assets = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedAsset = ref(null);
const currentPage = ref(1);
const itemsPerPage = 20;
const sortColumn = ref(null);
const sortDirection = ref('asc');
const searchQuery = ref('');
const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedAsset = ref(null);
const activeFilter = ref(null); // null, 'available', 'rent', 'repair'
const isClickStartedOnOverlay = ref(false);
const isTrackingOpen = ref(false); // 추적 모달 상태 추가
const stateOptions = ['useable', 'rent', 'repair', 'termination', 'process-ter'];

// 반납 처리 모달 상태
const isReturnModalOpen = ref(false);
const returnModalMessage = ref('');
const returnModalType = ref('confirm'); // 'confirm', 'success', 'error'
const pendingReturnAsset = ref(null);

const isAssetProcessedForReturn = (asset) => {
  return asset.state === 'process-ter' || asset.state === 'termination';
};

// 반납 처리 모달 열기
const handleReturn = (asset) => {
  pendingReturnAsset.value = asset;
  returnModalMessage.value = `'${asset.asset_number}' 자산을 반납 처리하시겠습니까?`;
  returnModalType.value = 'confirm';
  isReturnModalOpen.value = true;
};

// 반납 처리 확인
const confirmReturn = async () => {
  const asset = pendingReturnAsset.value;
  if (!asset) return;
  
  try {
    loading.value = true;
    
    // 날짜를 MySQL DATE 형식(YYYY-MM-DD)으로 변환하는 헬퍼 함수
    const formatDateForMySQL = (dateValue) => {
      if (!dateValue) return null;
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    };
    
    // 현재 날짜를 YYYY-MM-DD 형식으로 가져오기
    const getCurrentDate = () => {
      return new Date().toISOString().split('T')[0];
    };
    
    // 반납 자산 데이터 구성
    const returnedAssetData = {
      asset_number: asset.asset_number,
      model: asset.model,
      serial_number: asset.serial_number,
      return_type: null,
      end_date: formatDateForMySQL(asset.day_of_end),
      user_id: asset.in_user,
      user_name: asset.user_name,
      department: asset.user_part,
      handover_date: getCurrentDate(),
      remarks: null
    };

    await axios.post('/api/returned-assets', returnedAssetData);
    
    // 로컬 상태 업데이트
    const assetIndex = assets.value.findIndex(a => a.asset_id === asset.asset_id);
    if (assetIndex !== -1) {
      assets.value[assetIndex].state = 'process-ter';
    }
    
    // 성공 메시지 표시
    returnModalMessage.value = '자산이 반납 처리 페이지에 추가되었습니다.';
    returnModalType.value = 'success';
    
  } catch (err) {
    if (err.response && err.response.status === 409) {
      returnModalMessage.value = err.response.data.error;
    } else {
      returnModalMessage.value = '자산 반납 처리에 실패했습니다: ' + (err.response?.data?.error || err.message);
    }
    returnModalType.value = 'error';
    console.error('Error returning asset:', err);
  } finally {
    loading.value = false;
  }
};

// 반납 처리 모달 닫기
const closeReturnModal = () => {
  isReturnModalOpen.value = false;
  pendingReturnAsset.value = null;
  returnModalMessage.value = '';
  returnModalType.value = 'confirm';
};



// 모든 가능한 컬럼 정의
const allColumns = [
  'asset_id',
  'asset_number',
  'model',
  'category',
  'serial_number',
  'state',
  'in_user',
  'day_of_start',
  'day_of_end',
  'cjenc_inno',
  'aj_rent'
];

const filteredAssets = computed(() => {
  let result = sortedAssets.value;

  // [추가] 검색어가 없을 때만 'termination' 상태 제외
  if (!searchQuery.value) {
    result = result.filter(asset => asset.state !== 'termination');
  }
  
  // 필터 적용 (상호 배타적)
  if (activeFilter.value === 'available') {
    // 가용재고: state가 'useable'이고 in_user가 'cjenc_inno'
    result = result.filter(asset => asset.state === 'useable' && asset.in_user === 'cjenc_inno');
  } else if (activeFilter.value === 'rent') {
    // 대여중: state가 'rent'
    result = result.filter(asset => asset.state === 'rent');
  } else if (activeFilter.value === 'repair') {
    // 수리중: state가 'repair'
    result = result.filter(asset => asset.state === 'repair');
  }
  
  // 검색어 필터 적용
  if (!searchQuery.value) {
    return result;
  }
  
  // 공백으로 구분된 여러 키워드를 모두 포함하는 행만 검색 (AND 검색)
  const keywords = searchQuery.value
    .toLowerCase()
    .split(/\s+/)
    .filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    return result;
  }
  
  return result.filter(asset => {
    const assetString = Object.values(asset)
      .map(value => String(value).toLowerCase())
      .join(' ');
    
    // 모든 키워드가 포함되어야 함
    return keywords.every(keyword => assetString.includes(keyword));
  });
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

const sortedAssets = computed(() => {
  if (!sortColumn.value) {
    return assets.value;
  }
  
  const sorted = [...assets.value].sort((a, b) => {
    let aValue = a[sortColumn.value];
    let bValue = b[sortColumn.value];
    
    // null/undefined 처리
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    
    // 숫자 비교
    if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
      return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // 문자열 비교
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    
    if (sortDirection.value === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });
  
  return sorted;
});

const handleSort = (column) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
  currentPage.value = 1; // 정렬 후 첫 페이지로 이동
};

const getSortIcon = (column) => {
  if (sortColumn.value !== column) {
    return '⇳';
  }
  return sortDirection.value === 'asc' ? '⇧' : '⇩';
};

const paginatedAssets = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredAssets.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredAssets.value.length / itemsPerPage);
});

const pageNumbers = computed(() => {
  const pages = [];
  const maxPages = 5;
  let start = Math.max(1, currentPage.value - 2);
  let end = Math.min(totalPages.value, start + maxPages - 1);
  
  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const goToPage = (page) => {
  currentPage.value = page;
};

const fetchAssets = async () => {
  loading.value = true;
  error.value = null;
  selectedAsset.value = null;
  currentPage.value = 1;
  
  try {    
    const response = await fetch('/api/assets');
    const result = await response.json();
    
    if (result.success) {
      assets.value = result.data;
    } else {
      error.value = result.error;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchAssetById = async (id) => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await fetch(`/api/assets/${id}`);
    const result = await response.json();
    
    if (result.success) {
      selectedAsset.value = result.data;
      editedAsset.value = JSON.parse(JSON.stringify(result.data));
      isModalOpen.value = true;
      isEditMode.value = false;
    } else {
      error.value = result.error;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (asset) => {
  if (asset.asset_id) {
    fetchAssetById(asset.asset_id);
  } else {
    error.value = 'Asset ID를 찾을 수 없습니다.';
  }
};

const closeModal = () => {
  isModalOpen.value = false;
  isEditMode.value = false;
  selectedAsset.value = null;
  editedAsset.value = null;
  isClickStartedOnOverlay.value = false;
};

const handleOverlayMouseDown = (e) => {
  isClickStartedOnOverlay.value = e.target === e.currentTarget;
};

const handleOverlayMouseUp = (e) => {
  if (isClickStartedOnOverlay.value && e.target === e.currentTarget) {
    closeModal();
  }
  isClickStartedOnOverlay.value = false;
};

const toggleEditMode = () => {
  if (isEditMode.value) {
    editedAsset.value = JSON.parse(JSON.stringify(selectedAsset.value));
    isEditMode.value = false;
  } else {
    isEditMode.value = true;
  }
};

const saveAsset = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const response = await fetch(`/api/assets/${editedAsset.value.asset_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editedAsset.value)
    });
    
    const result = await response.json();
    
    if (result.success) {
      selectedAsset.value = JSON.parse(JSON.stringify(editedAsset.value));
      
      const assetIndex = assets.value.findIndex(a => a.asset_id === editedAsset.value.asset_id);
      if (assetIndex !== -1) {
        assets.value[assetIndex] = JSON.parse(JSON.stringify(editedAsset.value));
      }
      
      isEditMode.value = false;
      error.value = null;
    } else {
      error.value = result.error || '저장 실패';
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const getTableHeaders = (data) => {
  if (data.length === 0) {
    return allColumns.filter(h => h !== 'asset_id');
  }
  
  const headers = Object.keys(data[0]);
  const filtered = headers.filter(h => !['asset_id', 'user_cj_id', 'user_name', 'user_part'].includes(h));
  
  // 컬럼 순서 재정렬: state를 in_user 앞으로
  const result = [];
  for (let header of filtered) {
    if (header === 'in_user') {
      // in_user 바로 앞에 state 추가 (아직 추가되지 않았으면)
      if (!result.includes('state')) {
        result.push('state');
      }
      result.push(header);
      result.push('user_name');
      result.push('user_part');
    } else if (header !== 'state') {
      result.push(header);
    }
  }
  
  return result;
};

const formatCellValue = (value, columnName, item) => {
  if (columnName === 'user_name') return item.user_name || '-';
  if (columnName === 'user_part') return item.user_part || '-';
  if (!value) return value;
  if (columnName === 'day_of_start' || columnName === 'day_of_end') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  return value;
};

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
    'contract_month': '계약월'
  };
  return headerMap[columnName] || columnName;
};

// TSV 다운로드
const downloadTSV = () => {
  if (filteredAssets.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  // 현재 시간 포맷팅 (년도월일_시간분초)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${date}_${hours}${minutes}${seconds}`;
  const filename = `AssetsPage_${timestamp}.tsv`;
  
  // TSV 헤더 생성 (실제 출력되는 컬럼들만)
  const headers = getTableHeaders(filteredAssets.value);
  const tsvContent = [
    headers.map(h => getHeaderDisplayName(h)).join('\t'),
    ...filteredAssets.value.map(asset => 
      headers.map(header => {
        let value = asset[header] || '';
        // 날짜 필드 포맷팅 (YYYY-MM-DD)
        if ((header === 'day_of_start' || header === 'day_of_end') && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            value = date.toISOString().split('T')[0];
          }
        }
        // 탭이나 줄바꿈을 포함한 값 처리 (탭을 공백으로 변환하거나 제거)
        if (typeof value === 'string') {
          return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
        }
        return value;
      }).join('\t')
    )
  ].join('\n');
  
  // UTF-8 BOM과 함께 TSV 파일 생성
  const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 만료일 기준 행 클래스 결정
const getExpirationClass = (asset) => {
  if (activeFilter.value !== 'available' || !asset.day_of_end) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(asset.day_of_end);
  endDate.setHours(0, 0, 0, 0);

  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expire-passed';
  if (diffDays <= 30) return 'expire-warning-30';
  if (diffDays <= 60) return 'expire-warning-60';
  
  return '';
};

onMounted(() => {
  fetchAssets();
  // ESC 키로 모달 닫기
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (isTrackingOpen.value) {
        isTrackingOpen.value = false;
      } else if (isReturnModalOpen.value) {
        isReturnModalOpen.value = false;
      } else if (isModalOpen.value) {
        closeModal();
      }
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  
  // cleanup
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
});
</script>

<template>
  <div class="page-content" style="display: block; padding: 20px;">
    <h1>자산 관리</h1>
    
    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="loading" class="alert alert-info">
      ⏳ 로딩 중...
    </div>
    
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
      <div class="modal-content">
        <div class="modal-header">
          <h2>자산 정보</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedAsset" class="form-grid">
            <div v-for="(value, key) in selectedAsset" :key="key" class="form-group">
              <label>{{ key }}</label>
              <select
                v-if="isEditMode && key === 'state'"
                v-model="editedAsset[key]"
                class="form-input"
              >
                <option v-for="opt in stateOptions" :key="opt" :value="opt">{{ opt }}</option>
              </select>
              <input 
                v-else-if="isEditMode"
                v-model="editedAsset[key]"
                type="text"
                class="form-input"
                :disabled="['asset_id', 'asset_number'].includes(key)"
              />
              <div v-else class="form-value">
                {{ value }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="!isEditMode && selectedAsset" @click="isTrackingOpen = true" class="btn btn-tracking">추적</button>
          <button v-if="!isEditMode" @click="toggleEditMode" class="btn btn-edit">수정</button>
          <button v-if="isEditMode" @click="saveAsset" class="btn btn-save">저장</button>
          <button v-if="isEditMode" @click="toggleEditMode" class="btn btn-cancel">취소</button>
          <button @click="closeModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <!-- 반납 처리 확인 모달 -->
    <div v-if="isReturnModalOpen" class="modal-overlay" @click.self="closeReturnModal">
      <div class="modal-content return-modal">
        <div class="modal-header">
          <h2>
            <span v-if="returnModalType === 'confirm'">반납 처리 확인</span>
            <span v-else-if="returnModalType === 'success'">✅ 처리 완료</span>
            <span v-else>❌ 오류 발생</span>
          </h2>
          <button @click="closeReturnModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <p class="return-message">{{ returnModalMessage }}</p>
        </div>
        
        <div class="modal-footer">
          <button 
            v-if="returnModalType === 'confirm'" 
            @click="confirmReturn" 
            class="btn btn-confirm"
            :disabled="loading"
          >
            {{ loading ? '처리 중...' : '확인' }}
          </button>
          <button 
            v-if="returnModalType === 'confirm'" 
            @click="closeReturnModal" 
            class="btn btn-cancel"
          >
            취소
          </button>
          <button 
            v-if="returnModalType === 'success' || returnModalType === 'error'" 
            @click="closeReturnModal" 
            class="btn btn-close"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="assets.length > 0" class="assets-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>자산 목록 ({{ filteredAssets.length }}개)</h2>
        <div style="display: flex; gap: 10px; align-items: center;">
          <button 
            @click="activeFilter = activeFilter === 'available' ? null : 'available'"
            :class="{ active: activeFilter === 'available' }"
            class="btn btn-filter">
            가용재고
          </button>
          <button 
            @click="activeFilter = activeFilter === 'rent' ? null : 'rent'"
            :class="{ active: activeFilter === 'rent' }"
            class="btn btn-filter">
            대여중
          </button>
          <button 
            @click="activeFilter = activeFilter === 'repair' ? null : 'repair'"
            :class="{ active: activeFilter === 'repair' }"
            class="btn btn-filter">
            수리중
          </button>
          <button @click="downloadTSV" class="btn btn-csv">tsv</button>
        </div>
      </div>
      
      <div class="search-container">
        <input v-model="searchQuery" type="text" placeholder="검색..." class="search-input" />
        <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">✕</button>
      </div>
      
      <div v-if="searchQuery" class="search-result">
        검색 결과: {{ filteredAssets.length }}개
      </div>
      
                <div class="table-wrapper">
                  <table class="assets-table">
                    <thead>
                      <tr>
                        <th v-for="key in getTableHeaders(assets)" :key="key" @click="handleSort(key)"
                          class="sortable-header" :class="{ active: sortColumn === key }">
                          <div class="header-content">
                            <span>{{ getHeaderDisplayName(key) }}</span>
                            <span class="sort-icon">{{ getSortIcon(key) }}</span>
                          </div>
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(asset, index) in paginatedAssets" :key="asset.asset_id"
                        @click="handleRowClick(asset)"
                        :class="[{ 'stripe': index % 2 === 1, active: selectedAsset?.asset_id === asset.asset_id }, 'clickable-row']"
                      >
                        <td v-for="key in getTableHeaders(assets)" :key="key">
                          <template v-if="key === 'day_of_end'">
                            <span :class="getExpirationClass(asset)" style="padding: 2px 6px; border-radius: 4px; display: inline-block;">
                              {{ formatCellValue(asset[key], key, asset) }}
                            </span>
                          </template>
                          <template v-else>
                            {{ formatCellValue(asset[key], key, asset) }}
                          </template>
                        </td>
                        <td>
                          <button
                            @click.stop="handleReturn(asset)"
                            class="btn"
                            :class="{ 'btn-return-process': !isAssetProcessedForReturn(asset), 'btn-returned': isAssetProcessedForReturn(asset) }"
                            :disabled="isAssetProcessedForReturn(asset)"
                          >
                            {{ asset.state === 'process-ter' ? '처리중' : (asset.state === 'termination' ? '반납완료' : '반납처리') }}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>      
      <div class="pagination">
        <button @click="prevPage" :disabled="currentPage === 1" class="pagination-btn">← 이전</button>
        <div class="page-numbers">
          <button v-if="pageNumbers[0] > 1" @click="goToPage(1)" class="page-number">1</button>
          <span v-if="pageNumbers[0] > 2" class="ellipsis">...</span>
          <button v-for="page in pageNumbers" :key="page" @click="goToPage(page)"
            :class="['page-number', { active: currentPage === page }]">
            {{ page }}
          </button>
          <span v-if="pageNumbers[pageNumbers.length - 1] < totalPages - 1" class="ellipsis">...</span>
          <button v-if="pageNumbers[pageNumbers.length - 1] < totalPages"
            @click="goToPage(totalPages)" class="page-number">
            {{ totalPages }}
          </button>
        </div>
        <button @click="nextPage" :disabled="currentPage === totalPages" class="pagination-btn">다음 →</button>
      </div>
    </div>
    
    <div v-else-if="!loading" class="empty-state">
      자산이 없습니다.
    </div>

    <!-- 자산 추적 모달 -->
    <AssetTrackingModal 
      :is-open="isTrackingOpen" 
      :initial-asset-number="selectedAsset?.asset_number || ''"
      :initial-model="selectedAsset?.model || ''"
      :initial-category="selectedAsset?.category || ''"
      @close="isTrackingOpen = false" 
    />
  </div>
</template>

<style scoped>
.page-content {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

h1 {
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
  border-bottom: 3px solid #999;
  padding-bottom: 10px;
}

.alert {
  padding: 15px 20px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 16px;
}

.alert-error {
  background: #fef2f2;
  color: #e74c3c;
  border-left: 4px solid #e74c3c;
}

.alert-info {
  background: #f5f5f5;
  color: #666;
  border-left: 4px solid #999;
}

.assets-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
}

h2 {
  color: #555;
  margin: 0 0 15px 0;
  font-size: 20px;
}

.search-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #999;
  box-shadow: 0 0 0 3px rgba(153, 153, 153, 0.1);
}

.clear-btn {
  padding: 10px 14px;
  background: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s ease;
  color: #666;
}

.clear-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.search-result {
  padding: 8px 12px;
  background: #f0f4f8;
  border-left: 3px solid #5e88af;
  color: #4a6b8a;
  margin-bottom: 15px;
  border-radius: 3px;
  font-size: 14px;
}

.table-wrapper {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
  display: block;
}

.assets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: white;
  table-layout: auto;
}

.assets-table thead {
  background: #4a4a4a;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.sortable-header {
  padding: 0;
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background 0.3s ease;
  color: white;
  background: #4a4a4a;
}

.sortable-header:hover:not(.active) {
  background: rgba(255, 255, 255, 0.15);
}

.sortable-header.active {
  background: #3a3a3a;
  color: #ffeb3b;
}

.sortable-header.active:hover {
  background: #3a3a3a;
}

.header-content {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sort-icon {
  opacity: 0.6;
  font-size: 12px;
  min-width: 16px;
  text-align: right;
}

.sortable-header.active .sort-icon {
  opacity: 1;
  font-weight: bold;
}

.assets-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #d8d8d8;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 150px;
  vertical-align: middle;
}

.assets-table tbody tr {
  transition: all 0.2s ease;
  background: #ffffff;
}

.assets-table tbody tr.stripe {
  background: #f0f0f0;
}

.assets-table tbody tr:hover {
  background: #e5e5e5;
  box-shadow: inset 0 0 0 1px #d0d0d0;
}

.assets-table tbody tr.stripe:hover {
  background: #e5e5e5;
}

.assets-table tbody tr.active {
  background: #d8d8d8;
  font-weight: 500;
}

.assets-table tbody tr.active:hover {
  background: #c8c8c8;
}

/* Expiration Warning Styles (Only for available filter, applied to span) */
.expire-warning-60 {
  background-color: #fff9c4 !important; /* 연노랑 */
  color: #856404 !important;
  font-weight: bold;
}

.expire-warning-30 {
  background-color: #ffe0b2 !important; /* 연한 주황 */
  color: #e65100 !important;
  font-weight: bold;
}

.expire-passed {
  background-color: #f8bbd0 !important; /* 연분홍 (만료) */
  color: #c2185b !important;
  font-weight: bold;
}

.clickable-row {
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination-btn {
  padding: 10px 15px;
  background: #777;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #666;
  transform: translateY(-2px);
}

.pagination-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 5px;
}

.page-number {
  padding: 8px 12px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 40px;
}

.page-number:hover {
  background: #e0e0e0;
}

.page-number.active {
  background: #777;
  color: white;
  border-color: #777;
  font-weight: bold;
}

.ellipsis {
  color: #999;
  padding: 0 5px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 18px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
  background: #f8f8f8;
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 22px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.modal-body {
  padding: 30px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: bold;
  color: #333;
  font-size: 14px;
}

.form-input {
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-value {
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.modal-footer {
  padding: 20px;
  border-top: 2px solid #f0f0f0;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  background: #f8f8f8;
  border-radius: 0 0 12px 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
}

.btn-edit {
  background: #667eea;
  color: white;
}

.btn-edit:hover {
  background: #5568d3;
  transform: translateY(-2px);
}

.btn-save {
  background: #27ae60;
  color: white;
}

.btn-save:hover {
  background: #229954;
  transform: translateY(-2px);
}

.btn-cancel {
  background: #f39c12;
  color: white;
}

.btn-cancel:hover {
  background: #d68910;
  transform: translateY(-2px);
}

.btn-close {
  background: #95a5a6;
  color: white;
}

.btn-close:hover {
  background: #7f8c8d;
  transform: translateY(-2px);
}

.btn-csv {
  background: #6b8e6f;
  color: white;
}

.btn-csv:hover {
  background: #5a7a5e;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(107, 142, 111, 0.4);
}

.btn-filter {
  background: #999;
  color: white;
}

.btn-filter:hover {
  background: #888;
  transform: translateY(-2px);
}

.btn-tracking {
  background: #777;
  color: white;
}

.btn-tracking:hover {
  background: #555;
  transform: translateY(-2px);
}

.btn-filter.active {
  background: #666;
  box-shadow: 0 5px 15px rgba(102, 102, 102, 0.4);
}

/* New styles for return process button */
.btn-return-process {
  background: #6b8e6f; /* Match with CSV button */
  color: white;
  transform: scale(0.8);
  font-size: 12px;
  padding: 8px 12px;
}
.btn-return-process:hover:not(:disabled) {
  background: #5a7a5e;
  transform: scale(0.8) translateY(-2px);
  box-shadow: 0 5px 15px rgba(107, 142, 111, 0.4);
}

.btn-returned {
  background: #6c757d; /* Gray */
  color: white;
  cursor: not-allowed;
  transform: scale(0.8);
  font-size: 12px;
  padding: 8px 12px;
}
.btn-returned:hover {
  background: #6c757d; /* No hover effect for disabled */
  transform: none;
  box-shadow: none;
}

/* 반납 처리 모달 스타일 */
.return-modal {
  max-width: 500px;
}

.return-message {
  font-size: 16px;
  line-height: 1.6;
  color: #333;
  text-align: center;
  padding: 20px 0;
  margin: 0;
}

.btn-confirm {
  background: #27ae60;
  color: white;
  padding: 10px 24px;
  font-weight: 600;
}

.btn-confirm:hover:not(:disabled) {
  background: #229954;
  transform: translateY(-2px);
}

.btn-confirm:disabled {
  background: #95a5a6;
  cursor: not-allowed;
  transform: none;
}

</style>

