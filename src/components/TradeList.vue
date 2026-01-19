<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  trades: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['download', 'track-asset']);

const currentPage = ref(1);
const itemsPerPage = 20;
const sortColumn = ref(null);
const sortDirection = ref('desc');
const searchQuery = ref('');

// 테이블 컬럼 순서 및 라벨 정의
const columnOrder = [
  'trade_id', 'timestamp', 'work_type', 'asset_number', 'model',
  'ex_user_info', 'new_user_info'
];
const columnLabels = {
  'trade_id': '순번', 'timestamp': '작업시간', 'work_type': '작업유형',
  'asset_number': '자산번호', 'model': '모델명', 'ex_user_info': '이전 사용자 정보',
  'ex_user_name': '이전 이름', 'ex_user': '이전 사용자ID', 'ex_user_part': '이전 부서',
  'new_user_info': '변경 사용자 정보',
  'cj_id': '사용자ID', 'name': '이름', 'part': '부서', 'memo': '메모'
};

const filteredTrades = computed(() => {
  if (!searchQuery.value) {
    return sortedTrades.value;
  }
  const keywords = searchQuery.value.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  if (keywords.length === 0) {
    return sortedTrades.value;
  }
  return sortedTrades.value.filter(trade => {
    const tradeString = Object.values(trade).map(value => String(value).toLowerCase()).join(' ');
    return keywords.every(keyword => tradeString.includes(keyword));
  });
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

const sortedTrades = computed(() => {
  const activeSort = sortColumn.value || 'trade_id';
  const sortDir = sortColumn.value ? sortDirection.value : 'desc';
  return [...props.trades].sort((a, b) => {
    let aValue = a[activeSort];
    let bValue = b[activeSort];
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
      return sortDir === 'asc' ? parseFloat(aValue) - parseFloat(bValue) : parseFloat(bValue) - parseFloat(aValue);
    }
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    return sortDir === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
  });
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
  if (sortColumn.value !== column) return '⇳';
  return sortDirection.value === 'asc' ? '⇧' : '⇩';
};

const orderedColumns = computed(() => {
  if (!props.trades[0]) return [];
  const ordered = columnOrder.filter(h => h in props.trades[0] || h === 'ex_user_info' || h === 'new_user_info');
  const hiddenColumns = [
    'asset_id', 'ex_user', 'ex_user_name', 'ex_user_part', 
    'cj_id', 'name', 'part', 'category', 
    'asset_state', 'asset_on_user', 'asset_in_user', 'asset_onn_user',
    'created_at', 'updated_at'
  ];
  const allHeaders = Object.keys(props.trades[0]);
  const remaining = allHeaders.filter(h => !columnOrder.includes(h) && !hiddenColumns.includes(h));
  return [...ordered, ...remaining];
});

const paginatedTrades = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredTrades.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(filteredTrades.value.length / itemsPerPage));

const pageNumbers = computed(() => {
  const pages = [];
  const maxPages = 5;
  let start = Math.max(1, currentPage.value - 2);
  let end = Math.min(totalPages.value, start + maxPages - 1);
  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1);
  }
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

const prevPage = () => { if (currentPage.value > 1) currentPage.value--; };
const nextPage = () => { if (currentPage.value < totalPages.value) currentPage.value++; };
const goToPage = (page) => { currentPage.value = page; };

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

const download = () => {
    emit('download', props.trades);
}
</script>

<template>
  <div v-if="trades.length > 0" class="trades-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>거래 목록 ({{ filteredTrades.length }}개)</h2>
      <slot name="actions"></slot>
    </div>

    <!-- 검색창 추가 (자산관리페이지와 동일 방식) -->
    <div class="search-container">
      <input v-model="searchQuery" type="text" placeholder="거래 내역 검색..." class="search-input" />
      <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">✕</button>
    </div>
    <div v-if="searchQuery" class="search-result">
      검색 결과: {{ filteredTrades.length }}개
    </div>

    <div class="table-wrapper">
      <table class="trades-table">
      <thead>
        <tr>
          <th v-for="header in orderedColumns" :key="header" @click="handleSort(header)" class="sortable-header" :class="{ active: sortColumn === header }">
            <div class="header-content">
              <span>{{ columnLabels[header] || header }}</span>
              <span class="sort-icon">{{ getSortIcon(header) }}</span>
            </div>
          </th>
          <th class="actions-header">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(trade, index) in paginatedTrades" :key="`${trade.trade_id}-${index}`" :class="{ 'stripe': index % 2 === 1 }">
          <td v-for="header in orderedColumns" :key="header">
            <template v-if="header === 'timestamp'">{{ formatDateTime(trade[header]) }}</template>
            <template v-else-if="header === 'ex_user_info'">
              <div style="line-height: 1.4;">
                <strong>{{ trade.ex_user_name || '-' }}</strong> ({{ trade.ex_user || '-' }})
                <div style="font-size: 0.85em; color: #666;">{{ trade.ex_user_part || '-' }}</div>
              </div>
            </template>
            <template v-else-if="header === 'new_user_info'">
              <div style="line-height: 1.4;">
                <strong>{{ trade.name || '-' }}</strong> ({{ trade.cj_id || '-' }})
                <div style="font-size: 0.85em; color: #666;">{{ trade.part || '-' }}</div>
              </div>
            </template>
            <template v-else>{{ trade[header] || '-' }}</template>
          </td>
          <td class="action-cell">
            <button @click="emit('track-asset', trade)" class="btn-action btn-track">추적</button>
          </td>
        </tr>
      </tbody>
      </table>
    </div>

    <div style="margin-top: 20px; text-align: center;">
      <button v-if="currentPage > 1" @click="prevPage" class="btn btn-pagination">이전</button>
      <button v-for="page in pageNumbers" :key="page" @click="goToPage(page)" :class="{ active: currentPage === page }" class="btn btn-page">{{ page }}</button>
      <button v-if="currentPage < totalPages" @click="nextPage" class="btn btn-pagination">다음</button>
    </div>
  </div>
   <div v-else class="empty-state">
      거래가 없습니다.
    </div>
</template>

<style scoped>
.trades-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
h2 { color: #555; margin: 0; font-size: 20px; }
/* 검색 관련 스타일은 global.css를 따르되 필요한 경우 여기서 조정 */
.search-container { margin-bottom: 20px; }
.btn-pagination, .btn-page { padding: 10px 15px; margin: 0 2px; background: #f0f0f0; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-weight: 500; transition: all 0.2s ease; font-size: 14px; }
.btn-pagination:hover:not(:disabled), .btn-page:hover { background: #e0e0e0; }
.btn-pagination:disabled { background: #ccc; cursor: not-allowed; opacity: 0.6; }
.trades-table { 
  width: 100%; 
  border-collapse: separate; 
  border-spacing: 0; 
  font-size: 14px; 
  background: white; 
  table-layout: auto; 
}
.trades-table thead { background: var(--primary-color); color: white; }
.sortable-header { 
  padding: 0; 
  cursor: pointer; 
  user-select: none; 
  position: sticky; /* position: relative에서 sticky로 변경 */
  top: 0;
  z-index: 10;
  transition: background 0.3s ease; 
  color: white; 
  background: var(--primary-color); 
}
.sortable-header:hover:not(.active) { background: rgba(255,255,255,0.15); }
.sortable-header.active { background: rgba(0,0,0,0.2); color: var(--accent-color); }
.actions-header { 
  background: var(--primary-color); 
  color: white; 
  padding: 12px; 
  font-weight: 600; 
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 10;
}
.action-cell { text-align: center; }
.btn-action { padding: 6px 12px; border: none; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s; }
.btn-track { background: #777; color: white; }
.btn-track:hover { background: #555; transform: translateY(-1px); }
.empty-state { text-align: center; padding: 60px 20px; color: #999; font-size: 16px; }
</style>
