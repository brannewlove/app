<script setup>
import { ref, computed, watch, toRef } from 'vue';

const props = defineProps({
  trades: {
    type: Array,
    required: true,
  },
  initialSearch: {
    type: String,
    default: '',
  },
});

import { useTable } from '../composables/useTable';
import { formatDateTime } from '../utils/dateUtils';
import TablePagination from './TablePagination.vue';

const emit = defineEmits(['download', 'track-asset', 'cancel-trade', 'register-trade']);

const tradesRef = toRef(props, 'trades');

const {
  filteredData: filteredTrades,
  paginatedData: paginatedTrades,
  searchQuery,
  sortColumn,
  sortDirection,
  isManualSort,
  handleSort,
  getSortIcon,
  currentPage,
  totalPages,
  pageNumbers,
  prevPage,
  nextPage,
  goToPage
} = useTable(tradesRef, {
  itemsPerPage: 20,
  initialSortColumn: 'trade_id',
  initialSortDirection: 'desc' 
});

// 프로퍼티로 받은 초기 검색어 적용 및 감시
watch(() => props.initialSearch, (newVal) => {
  if (newVal !== undefined) {
    searchQuery.value = newVal;
  }
}, { immediate: true });

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
  'cj_id': '사용자ID', 'name': '이름', 'part': '부서', 'memo': '거래메모'
};

const orderedColumns = computed(() => {
  if (!props.trades || props.trades.length === 0) {
    return columnOrder; // 기본 순서 반환
  }
  const ordered = columnOrder.filter(h => h in props.trades[0] || h === 'ex_user_info' || h === 'new_user_info');
  const hiddenColumns = [
    'asset_id', 'ex_user', 'ex_user_name', 'ex_user_part', 
    'cj_id', 'name', 'part', 'category', 
    'asset_state', 'asset_on_user', 'asset_in_user', 'asset_onn_user', 'asset_memo',
    'created_at', 'updated_at'
  ];
  const allHeaders = Object.keys(props.trades[0]);
  // props.trades[0] might change if list updates, but computed tracks dependencies
  const remaining = allHeaders.filter(h => !columnOrder.includes(h) && !hiddenColumns.includes(h));
  return [...ordered, ...remaining];
});

const download = () => {
    emit('download', props.trades);
}
</script>

<template>
  <div class="trades-section">
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

    <div v-if="trades.length > 0">
      <div class="table-wrapper">
        <table class="trades-table">
        <thead>
          <tr>
            <th v-for="header in orderedColumns" :key="header" @click="handleSort(header)" class="sortable-header" :class="{ active: isManualSort && sortColumn === header }">
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
              <template v-else-if="header === 'asset_number'">
                <span class="bold-text">{{ trade[header] || '-' }}</span>
              </template>
              <template v-else>{{ trade[header] || '-' }}</template>
            </td>
            <td class="action-cell">
              <div style="display: flex; gap: 4px; justify-content: center;">
                <button @click="emit('track-asset', trade)" class="btn-action btn-track">추적</button>
                <button @click="emit('register-trade', trade)" class="btn-action btn-trade-action" title="신규 거래 등록">거래</button>
                <button @click="emit('cancel-trade', trade)" class="btn-action btn-cancel">취소</button>
              </div>
            </td>
          </tr>
        </tbody>
        </table>
      </div>

      <TablePagination 
        :current-page="currentPage" 
        :total-pages="totalPages" 
        :page-numbers="pageNumbers"
        @prev="prevPage"
        @next="nextPage"
        @go-to="goToPage"
      />
    </div>
    <div v-else class="empty-state">
      거래가 없습니다.
    </div>
  </div>
</template>

<style scoped>
.trades-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.search-container { margin-bottom: 20px; }

.trades-table { 
  width: 100%; 
  border-collapse: separate; 
  border-spacing: 0; 
  font-size: 14px; 
}

.sortable-header { 
  padding: 0; 
  cursor: pointer; 
  user-select: none; 
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--primary-color);
  color: white;
}

.sortable-header.active {
  background: var(--brand-blue);
}

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

/* Rounding for table headers */
.trades-table thead tr:first-child th:first-child {
  border-top-left-radius: var(--radius-md);
}
.trades-table thead tr:first-child th:last-child {
  border-top-right-radius: var(--radius-md);
}

.btn-action {
  padding: 6px 10px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
  color: white;
}

.btn-track { background: var(--secondary-color); }
.btn-trade-action { background: var(--brand-blue, #0052CC); }
.btn-cancel { background: #556B2F; }

.btn-icon-white-mini {
  width: 12px;
  height: 12px;
  vertical-align: middle;
  margin-right: 4px;
  filter: brightness(0) invert(1);
}

.btn-action:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.bold-text {
  font-weight: 700;
  color: var(--text-main);
}
</style>
