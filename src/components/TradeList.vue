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
  currentPage: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 50
  },
  totalItems: {
    type: Number,
    default: 0
  },
  sortColumn: {
    type: String,
    default: 'trade_id'
  },
  sortDirection: {
    type: String,
    default: 'desc'
  },
  isManualSort: {
    type: Boolean,
    default: false
  }
});

import { formatDateTime } from '../utils/dateUtils';
import TablePagination from './TablePagination.vue';

const emit = defineEmits(['download', 'track-asset', 'cancel-trade', 'register-trade', 'user-detail', 'asset-info', 'user-assets-search', 'page-change', 'search-change', 'sort-change']);

const tradesRef = toRef(props, 'trades');

const handleSort = (column) => {
  let direction = 'desc';
  if (props.sortColumn === column) {
    direction = props.sortDirection === 'asc' ? 'desc' : 'asc';
  }
  emit('sort-change', { column, direction });
};

const getSortIcon = (column) => {
  if (!props.isManualSort || props.sortColumn !== column) return '⇳';
  return props.sortDirection === 'asc' ? '⇧' : '⇩';
};

const searchQuery = ref(props.initialSearch);

// 프로퍼티로 받은 초기 검색어 적용 및 감시
watch(() => props.initialSearch, (newVal) => {
  if (newVal !== undefined) {
    searchQuery.value = newVal;
  }
}, { immediate: true });

// 검색어 변경시 상위로 알림 (서버 사이드 필터링용)
watch(searchQuery, (newVal) => {
  emit('search-change', newVal);
});

const paginatedTrades = computed(() => props.trades);
const totalPages = computed(() => Math.ceil(props.totalItems / props.pageSize));

const pageNumbers = computed(() => {
  const nums = [];
  const maxPages = 5;
  let start = Math.max(1, props.currentPage - Math.floor(maxPages / 2));
  let end = Math.min(totalPages.value, start + maxPages - 1);
  
  if (end - start + 1 < maxPages) {
    start = Math.max(1, end - maxPages + 1);
  }
  
  for (let i = start; i <= end; i++) nums.push(i);
  return nums;
});

const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('page-change', page);
  }
};

const prevPage = () => goToPage(props.currentPage - 1);
const nextPage = () => goToPage(props.currentPage + 1);


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
    'cj_id', 'name', 'part', 'category', 'state',
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

// 각 자산별 최신 거래 ID 맵핑
const latestTradeIdsPerAsset = computed(() => {
  const map = {};
  props.trades.forEach(t => {
    if (!map[t.asset_number] || t.trade_id > map[t.asset_number]) {
      map[t.asset_number] = t.trade_id;
    }
  });
  return map;
});

const isLatestTrade = (trade) => {
  return latestTradeIdsPerAsset.value[trade.asset_number] === trade.trade_id;
};

// 자산 메뉴 관련
const menuVisible = ref(false);
const menuPos = ref({ x: 0, y: 0 });
const selectedTradeForMenu = ref(null);

const getAdjustedPosition = (x, y, width = 180, height = 220) => {
  const padding = 10;
  let adjustedX = x + padding;
  let adjustedY = y - 10; // Slightly above to avoid cursor overlap

  if (adjustedX + width > window.innerWidth) {
    adjustedX = x - width - padding;
  }
  if (adjustedY + height > window.innerHeight) {
    adjustedY = window.innerHeight - height - padding;
  }
  if (adjustedY < 0) {
    adjustedY = padding;
  }
  
  return { x: adjustedX, y: adjustedY };
};

const openAssetMenu = (event, trade) => {
  event.preventDefault();
  event.stopPropagation();
  
  selectedTradeForMenu.value = trade;
  const pos = getAdjustedPosition(event.clientX, event.clientY, 180, 220);
  menuPos.value = pos;
  
  // 다른 메뉴 닫기
  userMenuVisible.value = false;
  menuVisible.value = true;
  
  // 클릭 외부 시 모든 메뉴 닫기
  const closeAllMenus = () => {
    menuVisible.value = false;
    userMenuVisible.value = false;
    window.removeEventListener('click', closeAllMenus);
  };
  setTimeout(() => window.addEventListener('click', closeAllMenus), 0);
};

const handleMenuAction = (action) => {
  if (!selectedTradeForMenu.value) return;
  
  const trade = selectedTradeForMenu.value;
  if (action === 'info') {
    emit('asset-info', trade.asset_number);
  } else if (action === 'trade') {
    emit('register-trade', trade);
  } else if (action === 'track') {
    emit('track-asset', trade);
  } else if (action === 'copy') {
    navigator.clipboard.writeText(trade.asset_number).then(() => {
      // Optional: Show toast or alert
    });
  } else if (action === 'filter') {
    searchQuery.value = trade.asset_number;
  }
  menuVisible.value = false;
};

// 사용자 메뉴 관련
const userMenuVisible = ref(false);
const userMenuPos = ref({ x: 0, y: 0 });
const selectedUserForMenu = ref(null);

const openUserMenu = (event, type, trade) => {
  event.preventDefault();
  event.stopPropagation();
  
  const cjId = type === 'ex' ? trade.ex_user : trade.cj_id;
  const name = type === 'ex' ? trade.ex_user_name : trade.name;
  
  const isPublic = !cjId || ['cjenc_inno', 'aj_rent', '-'].includes(cjId);
  const displayId = cjId || '-';

  selectedUserForMenu.value = { cjId: displayId, name, isPublic };
  const pos = getAdjustedPosition(event.clientX, event.clientY, 180, isPublic ? 60 : 150);
  userMenuPos.value = pos;
  
  // 다른 메뉴 닫기
  menuVisible.value = false;
  userMenuVisible.value = true;
  
  const closeAllMenus = () => {
    menuVisible.value = false;
    userMenuVisible.value = false;
    window.removeEventListener('click', closeAllMenus);
  };
  setTimeout(() => window.addEventListener('click', closeAllMenus), 0);
};

const handleUserMenuAction = (action) => {
  if (!selectedUserForMenu.value) return;
  
  const user = selectedUserForMenu.value;
  if (action === 'info') {
    emit('user-detail', user.cjId);
  } else if (action === 'search') {
    searchQuery.value = user.cjId;
  } else if (action === 'assets') {
    emit('user-assets-search', user.cjId);
  }
  userMenuVisible.value = false;
};
</script>

<template>
  <div class="trades-section">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>거래 목록 ({{ totalItems }}개)</h2>
      <slot name="actions"></slot>
    </div>


    <!-- 검색창 추가 (자산관리페이지와 동일 방식) -->
    <div class="search-container">
      <input v-model="searchQuery" type="text" placeholder="거래 내역 검색..." class="search-input" />
      <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">✕</button>
    </div>
    <div v-if="searchQuery" class="search-result">
      검색 결과: {{ totalItems }}개
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
                <div style="line-height: 1.4;" class="user-info-cell" @click="openUserMenu($event, 'ex', trade)">
                   <strong class="clickable-filter" v-if="trade.ex_user_name">{{ trade.ex_user_name }}</strong> 
                   <span class="clickable-user" v-if="trade.ex_user">({{ trade.ex_user }})</span>
                  <div class="user-part-text" v-if="trade.ex_user_part">{{ trade.ex_user_part }}</div>
                </div>
              </template>
              <template v-else-if="header === 'new_user_info'">
                <div style="line-height: 1.4;" class="user-info-cell" @click="openUserMenu($event, 'new', trade)">
                   <strong class="clickable-filter" v-if="trade.name">{{ trade.name }}</strong> 
                   <span class="clickable-user" v-if="trade.cj_id">({{ trade.cj_id }})</span>
                  <div class="user-part-text" v-if="trade.part">{{ trade.part }}</div>
                </div>
              </template>
              <template v-else-if="header === 'asset_number'">
                <span class="bold-text clickable-asset" @click="openAssetMenu($event, trade)">{{ trade[header] || '-' }}</span>
              </template>
              <template v-else-if="header === 'work_type' || header === 'model'">
                <span class="clickable-filter" @click="searchQuery = trade[header]">{{ trade[header] || '-' }}</span>
              </template>
              <template v-else>{{ trade[header] || '-' }}</template>
            </td>
            <td class="action-cell">
              <div style="display: flex; gap: 4px; justify-content: center;">
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

      <!-- 에셋 툴팁 메뉴 -->
      <div v-if="menuVisible" class="asset-tooltip-menu" :style="{ top: menuPos.y + 'px', left: menuPos.x + 'px' }">
        <div class="menu-item" @click="handleMenuAction('info')">
          <img src="/images/infor.png" alt="info" class="menu-icon" />
          정보
        </div>
        <div class="menu-item" @click="handleMenuAction('trade')" :class="{ disabled: !selectedTradeForMenu || !isLatestTrade(selectedTradeForMenu) || selectedTradeForMenu.state === 'termination' || selectedTradeForMenu.state === 'process-ter' }">
          <img src="/images/edit.png" alt="trade" class="menu-icon" />
          거래
        </div>
        <div class="menu-item" @click="handleMenuAction('track')">
          <img src="/images/go.png" alt="track" class="menu-icon" />
          추적
        </div>
        <div class="menu-item" @click="handleMenuAction('copy')">
          <img src="/images/clipboard.png" alt="copy" class="menu-icon" />
          복사
        </div>
        <div class="menu-item" @click="handleMenuAction('filter')">
          <img src="/images/filter.png" alt="filter" class="menu-icon" />
          검색
        </div>
      </div>

      <!-- 사용자 툴팁 메뉴 -->
      <div v-if="userMenuVisible" class="asset-tooltip-menu" :style="{ top: userMenuPos.y + 'px', left: userMenuPos.x + 'px' }">
        <template v-if="selectedUserForMenu && !selectedUserForMenu.isPublic">
          <div class="menu-item" @click="handleUserMenuAction('info')">
            <img src="/images/infor.png" alt="info" class="menu-icon" />
            정보
          </div>
          <div class="menu-item" @click="handleUserMenuAction('search')">
            <img src="/images/filter.png" alt="search" class="menu-icon" />
            검색
          </div>
          <div class="menu-item" @click="handleUserMenuAction('assets')">
            <img src="/images/boxes.png" alt="assets" class="menu-icon" />
            소유
          </div>
        </template>
        <template v-else>
          <div class="menu-item disabled" style="color: var(--text-muted); font-size: 11px; padding: 10px 15px;">
            <img src="/images/warning.png" alt="warning" class="menu-icon" />
            공용/랜탈 계정 안내 대상 제외
          </div>
        </template>
      </div>
    </div>
    <div v-else class="empty-state">
      거래가 없습니다.
    </div>
  </div>
</template>

<style scoped>
.user-info-cell {
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.user-info-cell:hover {
  background: var(--bg-hover, #f5f7fa);
}

.user-info-cell:hover .clickable-filter,
.user-info-cell:hover .clickable-user {
  color: var(--brand-blue, #0052cc);
  text-decoration: underline;
}

.user-part-text {
  font-size: 0.85em; 
  color: #666;
}

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
  position: sticky;
  top: 0;
  z-index: 10;
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

.btn-action:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.btn-action:disabled {
  background: #ccc !important;
  cursor: not-allowed;
  opacity: 0.6;
}

.bold-text {
  font-weight: 700;
  color: var(--text-main);
}

.clickable-asset {
  cursor: pointer;
  transition: opacity 0.2s;
}

.clickable-asset:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.8;
}

.clickable-filter {
  cursor: pointer;
  transition: color 0.2s;
}

.clickable-filter:hover {
  color: var(--brand-blue, #0052cc);
  text-decoration: underline;
}

.asset-tooltip-menu {
  position: fixed;
  background: white;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  padding: 8px 0;
  z-index: 2000;
  min-width: 160px;
  border: 1px solid var(--border-color, #eee);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #333);
  cursor: pointer;
  transition: background 0.2s;
}

.menu-item:hover {
  background: var(--bg-hover, #f5f7fa);
  color: var(--brand-blue, #0052cc);
}

.menu-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.menu-icon {
  width: 14px;
  height: 14px;
  opacity: 0.7;
}

.menu-item:hover .menu-icon {
  opacity: 1;
  filter: sepia(1) saturate(5) hue-rotate(180deg);
}

.clickable-user {
  cursor: pointer;
  transition: opacity 0.2s;
}
.clickable-user:hover {
  opacity: 0.7;
  text-decoration: underline;
}
</style>
