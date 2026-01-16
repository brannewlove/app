<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import AutocompleteSearch from '../components/AutocompleteSearch.vue';

const trades = ref([]);
const loading = ref(false);
const error = ref(null);
const currentPage = ref(1);
const itemsPerPage = 20;
const sortColumn = ref(null); // 기본은 trade_id desc 정렬 (헤더 하이라이트 없음)
const sortDirection = ref('desc');
const searchQuery = ref('');

// 테이블 컬럼 순서 정의
const columnOrder = [
  'trade_id',
  'timestamp', 
  'work_type', 
  'asset_id', 
  'model',
  'ex_user_info', // 통합 컬럼 추가
  'cj_id', 
  'name',
  'part'
];

const columnLabels = {
  'trade_id' : '순번',
  'timestamp' : '작업시간',
  'work_type': '작업유형',
  'asset_id': '자산번호',
  'model': '모델명',
  'ex_user_info': '이전 사용자 정보', // 라벨 추가
  'ex_user_name': '이전 이름',
  'ex_user': '이전 사용자ID',
  'ex_user_part': '이전 부서',
  'cj_id': '사용자ID',
  'name': '이름',
  'part': '부서',
  'memo': '메모'
};

// 추적 기능 관련
const isTrackingOpen = ref(false);
const selectedAsset = ref(null);
const trackingLogs = ref([]);
const trackingLoading = ref(false);
const trackingError = ref(null);

// 변경 Export 관련
const isExportModalOpen = ref(false);
const exportAssets = ref([]);
const exportLoading = ref(false);
const exportError = ref(null);
// excludedAssets: { assetId: { checked: true, cj_id: 'user' } } (메모리에만 유지)
const excludedAssets = ref({});

// 확인 모달 관련
const isConfirmModalOpen = ref(false);
const confirmMessage = ref('');
const confirmCallback = ref(null);

const filteredTrades = computed(() => {
  if (!searchQuery.value) {
    return sortedTrades.value;
  }
  
  // 공백으로 구분된 여러 키워드를 모두 포함하는 행만 검색 (AND 검색)
  const keywords = searchQuery.value
    .toLowerCase()
    .split(/\s+/)
    .filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    return sortedTrades.value;
  }
  
  return sortedTrades.value.filter(trade => {
    const tradeString = Object.values(trade)
      .map(value => String(value).toLowerCase())
      .join(' ');
    
    // 모든 키워드가 포함되어야 함
    return keywords.every(keyword => tradeString.includes(keyword));
  });
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

const sortedTrades = computed(() => {
  // sortColumn이 null이면 trade_id 기준으로 내림차순 정렬 (헤더 강조 없음)
  const activeSort = sortColumn.value || 'trade_id';
  const sortDir = sortColumn.value ? sortDirection.value : 'desc';
  
  const sorted = [...trades.value].sort((a, b) => {
    let aValue = a[activeSort];
    let bValue = b[activeSort];
    
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    
    if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
      return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    
    if (sortDir === 'asc') {
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
  currentPage.value = 1;
};

const getSortIcon = (column) => {
  if (sortColumn.value !== column) {
    return '⇳';
  }
  return sortDirection.value === 'asc' ? '⇧' : '⇩';
};

// 정렬된 컬럼 리스트 (columnOrder 순서 + 나머지 컬럼, memo는 맨뒤)
const orderedColumns = computed(() => {
  if (!trades.value[0]) return [];
  
  // 1. columnOrder를 기반으로 하되, 실제 데이터에 있거나 가상 컬럼(ex_user_info)인 경우 포함
  const ordered = columnOrder.filter(h => h in trades.value[0] || h === 'ex_user_info');
  
  // 2. UI에서 숨길 원본 컬럼들 정의
  const hiddenColumns = ['ex_user', 'ex_user_name', 'ex_user_part', 'memo'];
  
  // 3. columnOrder에도 없고 숨김 대상도 아닌 나머지 컬럼들
  const allHeaders = Object.keys(trades.value[0]);
  const remaining = allHeaders.filter(h => !columnOrder.includes(h) && !hiddenColumns.includes(h));
  
  if (allHeaders.includes('memo')) {
    remaining.push('memo');
  }
  return [...ordered, ...remaining];
});

const paginatedTrades = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredTrades.value.slice(start, end);
});

const totalPages = computed(() => {
  return Math.ceil(filteredTrades.value.length / itemsPerPage);
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

const fetchTrades = async () => {
  loading.value = true;
  error.value = null;
  currentPage.value = 1;
  
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

const openTrackingModal = () => {
  isTrackingOpen.value = true;
};

const closeTrackingModal = () => {
  isTrackingOpen.value = false;
  selectedAsset.value = null;
  trackingLogs.value = [];
  trackingError.value = null;
};

// DB API에서 확인된 자산 로드
const loadConfirmedAssets = async () => {
  try {
    const response = await fetch('/api/confirmedAssets');
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      // API 데이터를 excludedAssets 객체 형태로 변환
      excludedAssets.value = {};
      result.data.forEach(item => {
        excludedAssets.value[String(item.asset_id)] = {
          checked: true,
          cj_id: item.cj_id
        };
      });
    } else {
      excludedAssets.value = {};
    }
  } catch (err) {
    console.error('확인된 자산 로드 실패:', err);
    excludedAssets.value = {};
  }
};

// DB에 자산 확인 저장
const saveConfirmedAsset = async (assetId, cj_id) => {
  try {
    const response = await fetch('/api/confirmedAssets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        asset_id: assetId,
        cj_id: cj_id
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error('자산 확인 저장 실패:', result.error);
    }
  } catch (err) {
    console.error('자산 확인 저장 에러:', err);
  }
};

// DB에서 자산 확인 삭제
const deleteConfirmedAsset = async (assetId, cj_id) => {
  try {
    const response = await fetch(`/api/confirmedAssets/${assetId}/${cj_id}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error('자산 확인 삭제 실패:', result.error);
    }
  } catch (err) {
    console.error('자산 확인 삭제 에러:', err);
  }
};

// localStorage 호환성 유지 (레거시 함수는 제거)
const saveExcludedAssets = () => {
  // DB 기반으로 변경되었으므로 사용 안 함
};

const loadExcludedAssets = async () => {
  await loadConfirmedAssets();
};

const openExportModal = async () => {
  isExportModalOpen.value = true;
  await fetchExportAssets();
};

const closeExportModal = () => {
  isExportModalOpen.value = false;
  exportError.value = null;
};

const fetchExportAssets = async () => {
  exportLoading.value = true;
  exportError.value = null;

  try {
    const response = await fetch('/api/assetLogs/currentUsers');
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '데이터 조회 실패');
    }
    
    // 시간 오래된 순으로 정렬 (오름차순)
    const sortedData = (data.data || []).sort((a, b) => {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // 사용자 변경 감지: 저장된 사용자와 현재 사용자가 다른 경우 체크 해제
    for (const current of sortedData) {
      const savedInfo = excludedAssets.value[current.asset_id];
      if (savedInfo?.checked) {
        if (savedInfo.cj_id !== current.cj_id) {
          // 메모리에서 삭제
          delete excludedAssets.value[current.asset_id];
          // DB에서도 삭제
          await deleteConfirmedAsset(current.asset_id, savedInfo.cj_id);
        }
      }
    }
    
    // 모든 데이터 표시
    exportAssets.value = sortedData;
  } catch (err) {
    console.error('Export 데이터 조회 에러:', err);
    exportError.value = err.message || 'Export 데이터 조회 중 오류 발생';
  } finally {
    exportLoading.value = false;
  }
};

const toggleAssetExclude = (assetId) => {
  try {
    const asset = exportAssets.value.find(a => a.asset_id === assetId);
    if (!asset) return;
    
    if (excludedAssets.value[assetId]?.checked) {
      // 체크 해제 - DB에서 삭제
      const cj_id = excludedAssets.value[assetId].cj_id;
      delete excludedAssets.value[assetId];
      deleteConfirmedAsset(assetId, cj_id);
    } else {
      // 체크 - DB에 저장
      excludedAssets.value[assetId] = {
        checked: true,
        cj_id: asset.cj_id
      };
      saveConfirmedAsset(assetId, asset.cj_id);
    }
  } catch (err) {
    console.error('toggleAssetExclude 에러:', err);
  }
};

const toggleAllExclude = (event) => {
  try {
    if (event.target.checked) {
      // 모두 체크
      exportAssets.value.forEach(asset => {
        if (!excludedAssets.value[asset.asset_id]?.checked) {
          excludedAssets.value[asset.asset_id] = {
            checked: true,
            cj_id: asset.cj_id
          };
          saveConfirmedAsset(asset.asset_id, asset.cj_id);
        }
      });
    } else {
      // 모두 해제
      Object.entries(excludedAssets.value).forEach(([assetId, info]) => {
        if (info.checked) {
          deleteConfirmedAsset(assetId, info.cj_id);
        }
      });
      excludedAssets.value = {};
    }
  } catch (err) {
    console.error('toggleAllExclude 에러:', err);
  }
};

const handleConfirmYes = () => {
  if (confirmCallback.value) {
    confirmCallback.value();
  }
  isConfirmModalOpen.value = false;
};

const handleConfirmNo = () => {
  isConfirmModalOpen.value = false;
};

const handleTrackingWheel = (event) => {
  const container = event.currentTarget;
  container.scrollLeft += event.deltaY > 0 ? 200 : -200;
};

const downloadExportData = () => {
  // 체크된 asset만 필터링해서 다운로드 (체크 안 된 것들만 다운로드)
  const filteredAssets = exportAssets.value.filter(asset => 
    !excludedAssets.value[asset.asset_id]?.checked
  );
  
  if (filteredAssets.length === 0) {
    alert('다운로드할 데이터가 없습니다.');
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${date}_${hours}${minutes}${seconds}`;
  const filename = `AssetCurrentUsers_${timestamp}.csv`;

  const headers = ['자산ID', '사용자ID', '사용자명', '최종변경시간'];
  const csvContent = [
    headers.join(','),
    ...filteredAssets.map(asset => {
      const dateStr = new Date(asset.timestamp).toLocaleString('ko-KR');
      return [
        asset.asset_id || '',
        asset.cj_id || '',
        asset.user_name || '',
        dateStr
      ].map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const fetchTrackingLogs = async () => {
  if (!selectedAsset.value || !selectedAsset.value.asset_number) {
    trackingError.value = '자산을 선택해주세요.';
    return;
  }

  trackingLoading.value = true;
  trackingError.value = null;

  try {
    const response = await fetch(`/api/assetLogs?asset_id=${selectedAsset.value.asset_number}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || '추적 로그 조회 실패');
    }
    
    trackingLogs.value = data.data || [];
  } catch (err) {
    console.error('추적 로그 조회 에러:', err);
    trackingError.value = err.message || '추적 로그 조회 중 오류 발생';
  } finally {
    trackingLoading.value = false;
  }
};

const downloadCSV = () => {
  if (trades.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${date}_${hours}${minutes}${seconds}`;
  const filename = `TradePage_${timestamp}.csv`;
  // [수정 부분] 직접 원하는 컬럼 순서대로 배열을 정의합니다.
  const headers = [
    'trade_id', 
    'timestamp', 
    'work_type', 
    'asset_id', 
    'model', 
    'ex_user', 
    'ex_user_name', 
    'ex_user_part', 
    'cj_id', 
    'name', 
    'part',
    'memo'
  ];
  const csvContent = [
    headers.join(','),
    ...trades.value.map(trade => 
      headers.map(header => {
        const value = trade[header] || '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 날짜 및 시간 포맷팅
const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

onMounted(async () => {
  fetchTrades();
  await loadExcludedAssets();
});
</script>

<template>
  <div class="page-content">
    <h1>거래 관리</h1>
    
    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="loading" class="alert alert-info">
      ⏳ 로딩 중...
    </div>
    
    <div v-if="trades.length > 0" class="trades-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>거래 목록 ({{ filteredTrades.length }}개)</h2>
        <div style="display: flex; gap: 10px;">
          <button @click="openTrackingModal" class="btn btn-tracking">추적</button>
          <button @click="openExportModal" class="btn btn-export">변경 Export</button>
          <button @click="downloadCSV" class="btn btn-csv">csv</button>
        </div>
      </div>

      <div class="search-container">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="검색..." 
          class="search-input"
        />
      </div>

      <table class="trades-table">
        <thead>
          <tr>
            <th 
              v-for="header in orderedColumns"
              :key="header"
              @click="handleSort(header)"
              class="sortable-header" 
              :class="{ active: sortColumn === header }"
            >
              <div class="header-content">
                <span>{{ columnLabels[header] || header }}</span>              
                <span class="sort-icon">{{ getSortIcon(header) }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(trade, index) in paginatedTrades" 
            :key="`${trade.trade_id}-${index}`"
            :class="{ 'stripe': index % 2 === 1 }"
          >
            <td v-for="header in orderedColumns" :key="header">
              <template v-if="header === 'timestamp'">
                {{ formatDateTime(trade[header]) }}
              </template>
              <template v-else-if="header === 'ex_user_info'">
                <div style="line-height: 1.4;">
                  <strong>{{ trade.ex_user_name || '-' }}</strong> ({{ trade.ex_user || '-' }})
                  <div style="font-size: 0.85em; color: #666;">{{ trade.ex_user_part || '-' }}</div>
                </div>
              </template>
              <template v-else>
                {{ trade[header] || '-' }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 20px; text-align: center;">
        <button 
          v-if="currentPage > 1" 
          @click="prevPage"
          class="btn btn-pagination"
        >
          이전
        </button>
        <button 
          v-for="page in pageNumbers"
          :key="page"
          @click="goToPage(page)"
          :class="{ active: currentPage === page }"
          class="btn btn-page"
        >
          {{ page }}
        </button>
        <button 
          v-if="currentPage < totalPages"
          @click="nextPage"
          class="btn btn-pagination"
        >
          다음
        </button>
      </div>
    </div>

    <div v-else-if="!loading" class="empty-state">
      거래가 없습니다.
    </div>

    <!-- 추적 모달 -->
    <div v-if="isTrackingOpen" class="modal-overlay" @click.self="closeTrackingModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>자산 추적</h2>
          <button class="modal-close-btn" @click="closeTrackingModal">✕</button>
        </div>

        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: bold;">자산 선택</label>
            <AutocompleteSearch 
              :initial-value="selectedAsset?.asset_number || ''"
              placeholder="자산번호로 검색..."
              api-table="assets"
              api-column="asset_number"
              @select="(item) => {
                if (item && typeof item === 'object') {
                  selectedAsset = {
                    asset_id: item.asset_id,
                    asset_number: item.asset_number,
                    model: item.model,
                    state: item.state
                  };
                  fetchTrackingLogs();
                }
              }"
            />
          </div>

          <div v-if="selectedAsset" style="margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
            <p><strong>자산번호:</strong> {{ selectedAsset.asset_number }}</p>
            <p><strong>모델:</strong> {{ selectedAsset.model || '-' }}</p>
          </div>

          <div v-if="trackingError" class="alert alert-error">
            ❌ {{ trackingError }}
          </div>

          <div v-if="trackingLoading" class="alert alert-info">
            ⏳ 로딩 중...
          </div>

          <div v-else-if="trackingLogs.length > 0">
            <h3>사용자 변경 로그</h3>
            <div class="tracking-flow" @wheel.prevent="handleTrackingWheel">
              <div v-for="(log, index) in trackingLogs" :key="`${log.trade_id}-${log.timestamp}`" class="flow-item">
                <div class="flow-content">
                  <div class="flow-header">
                    <span class="flow-work-type">{{ log.work_type }}</span>
                    <span class="flow-user">{{ log.user_name || log.cj_id || '-' }}</span>
                  </div>
                  <div class="flow-date">{{ new Date(log.timestamp).toLocaleString('ko-KR') }}</div>
                </div>
                <div v-if="index < trackingLogs.length - 1" class="flow-arrow">→</div>
              </div>
            </div>
          </div>

          <div v-else-if="selectedAsset && !trackingLoading" class="tracking-logs-empty">
            추적 로그가 없습니다.
          </div>
        </div>
      </div>
    </div>

    <!-- 변경 Export 모달 -->
    <div v-if="isExportModalOpen" class="modal-overlay" @click.self="closeExportModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>변경 Export</h2>
          <button class="modal-close-btn" @click="closeExportModal">✕</button>
        </div>

        <div class="modal-body">
          <div v-if="exportLoading" class="alert alert-info">
            ⏳ 데이터 로딩 중...
          </div>

          <div v-else-if="exportError" class="alert alert-error">
            ❌ {{ exportError }}
          </div>

          <div v-else-if="exportAssets.length > 0">
            <div style="margin-bottom: 15px;">
              <p style="color: #666; font-size: 14px;">
                총 {{ exportAssets.length }}개 자산 (제외: {{ excludedAssets.size }})
              </p>
            </div>

            <table class="export-table">
              <thead>
                <tr>
                  <th style="width: 40px;">
                    <input 
                      type="checkbox" 
                      :checked="Object.keys(excludedAssets).length > 0 && Object.keys(excludedAssets).length === exportAssets.length"
                      @change="toggleAllExclude"
                    />
                  </th>
                  <th>자산ID</th>
                  <th>사용자ID</th>
                  <th>사용자명</th>
                  <th>최종변경시간</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="asset in exportAssets" 
                  :key="asset.asset_id"
                  :class="{ excluded: excludedAssets[asset.asset_id]?.checked }"
                >
                  <td style="text-align: center;">
                    <input 
                      type="checkbox"
                      :checked="excludedAssets[asset.asset_id]?.checked || false"
                      @change="(e) => toggleAssetExclude(asset.asset_id)"
                    />
                  </td>
                  <td>{{ asset.asset_id }}</td>
                  <td>{{ asset.cj_id }}</td>
                  <td>{{ asset.user_name || '-' }}</td>
                  <td>{{ new Date(asset.timestamp).toLocaleString('ko-KR') }}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
              <button 
                class="btn btn-secondary"
                @click="closeExportModal"
              >
                취소
              </button>
              <button 
                class="btn btn-primary"
                @click="downloadExportData"
                :disabled="exportAssets.length === 0"
              >
                CSV 다운로드
              </button>
            </div>
          </div>

          <div v-else class="tracking-logs-empty">
            데이터가 없습니다.
          </div>
        </div>
      </div>
    </div>

    <!-- 확인 모달 -->
    <div v-if="isConfirmModalOpen" class="modal-overlay" @click.self="handleConfirmNo">
      <div class="confirm-modal-content">
        <div class="confirm-modal-body">
          <p>{{ confirmMessage }}</p>
        </div>
        <div class="confirm-modal-footer">
          <button class="btn btn-secondary" @click="handleConfirmNo">
            취소
          </button>
          <button class="btn btn-primary" @click="handleConfirmYes">
            확인
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-content {
  padding: 20px;
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

.trades-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #666;
  color: white;
}

.btn-primary:hover {
  background: #555;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-secondary {
  background: white;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-tracking {
  background: #777;
  color: white;
}

.btn-tracking:hover {
  background: #555;
}

.btn-export {
  background: #777;
  color: white;
}

.btn-export:hover {
  background: #555;
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

.btn-pagination, .btn-page {
  padding: 10px 15px;
  margin: 0 2px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  font-size: 14px;
}

.btn-pagination:hover:not(:disabled), .btn-page:hover {
  background: #e0e0e0;
}

.btn-pagination:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-page.active {
  background: #777;
  color: white;
  border-color: #777;
  font-weight: bold;
}

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: white;
  table-layout: auto;
  margin: 20px 0;
}

.trades-table thead {
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

.trades-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #d8d8d8;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  vertical-align: middle;
}

.trades-table tbody tr {
  transition: all 0.2s ease;
  background: #ffffff;
}

.trades-table tbody tr.stripe {
  background: #f0f0f0;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 1200px;
  max-height: 80vh;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.confirm-modal-content {
  background: white;
  border-radius: 8px;
  min-width: 350px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.confirm-modal-body {
  padding: 30px 20px;
  text-align: center;
  color: #333;
  font-size: 16px;
  line-height: 1.5;
}

.confirm-modal-footer {
  padding: 20px;
  display: flex;
  gap: 10px;
  justify-content: center;
  border-top: 1px solid #eee;
}

.confirm-modal-footer .btn {
  padding: 10px 30px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.modal-header h2 {
  margin: 0;
  color: #333;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 16px;
}

.tracking-flow {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  padding: 20px 0;
  scroll-behavior: smooth;
}

.tracking-flow::-webkit-scrollbar {
  height: 8px;
}

.tracking-flow::-webkit-scrollbar-track {
  background: #f0f0f0;
  border-radius: 4px;
}

.tracking-flow::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
}

.tracking-flow::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: max-content;
  position: relative;
}

.flow-content {
  padding: 15px 20px;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 5px;
  min-width: 100px;
  flex-shrink: 0;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.flow-work-type {
  font-weight: bold;
  color: #5a6d8c;
  padding: 3px 8px;
  background: #f0f0f0;
  border-radius: 3px;
  font-size: 12px;
}

.flow-user {
  color: #3a424f;
  font-weight: bold;
}

.flow-date {
  font-size: 12px;
  color: #999;
}

.flow-arrow {
  font-size: 20px;
  color: #3a424f;
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
}

.tracking-logs-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.tracking-logs-table thead {
  background: #f5f5f5;
}

.tracking-logs-table th {
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid #ddd;
}

.tracking-logs-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.tracking-logs-table tr:hover {
  background: #f5f5f5;
}

.tracking-logs-empty {
  text-align: center;
  padding: 30px;
  color: #999;
}

/* Export 테이블 스타일 */
.export-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 14px;
}

.export-table th {
  background: #f5f5f5;
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid #ddd;
  font-weight: bold;
  color: #333;
}

.export-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.export-table tbody tr {
  transition: background-color 0.2s;
}

.export-table tbody tr:hover {
  background: #f9f9f9;
}

.export-table tbody tr.excluded {
  opacity: 0.6;
  text-decoration: line-through;
}

.export-table input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}
</style>
