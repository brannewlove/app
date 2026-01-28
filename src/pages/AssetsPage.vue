<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import BulkAssetRegisterModal from '../components/BulkAssetRegisterModal.vue';
import TablePagination from '../components/TablePagination.vue';
import AutocompleteSearch from '../components/AutocompleteSearch.vue';
import WorkTypeSearch from '../components/WorkTypeSearch.vue';
import assetApi from '../api/assets';
import filterApi from '../api/filters';
import { useTable } from '../composables/useTable';
import axios from 'axios';
import { getTimestampFilename } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';
import { parseAndFilter } from '../utils/QueryParser';
import { 
  isCjIdDisabled, 
  getFixedCjId, 
  getFixedCjIdDisplay, 
  validateTradeStrict, 
  getAvailableWorkTypesForAsset 
} from '../constants/workTypes';

const router = useRouter();
const route = useRoute();

const assets = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedAsset = ref(null);

const activeFilter = ref(null); // null, 'available', 'rent', 'repair'

// 1인 다기기 보유자 계산 (노트북 or 데스크탑이 2개 이상이면서 useable 상태)
const multiPcUserIds = computed(() => {
  const pcAssets = assets.value.filter(a => 
    (a.category === '노트북' || a.category === '데스크탑') && a.state === 'useable'
  );
  const userCounts = {};
  pcAssets.forEach(a => {
    if (a.in_user && a.in_user !== 'cjenc_inno') {
      userCounts[a.in_user] = (userCounts[a.in_user] || 0) + 1;
    }
  });
  return new Set(Object.keys(userCounts).filter(id => userCounts[id] >= 2));
});

const getRawQuery = (query) => {
  if (!query) return '';
  const match = query.match(/^.+ \((.+)\)$/);
  return match ? match[1] : query;
};

const activeSavedFilter = ref(null);

const activeSavedFilterQuery = computed(() => {
  if (!activeSavedFilter.value) return '';
  const data = typeof activeSavedFilter.value.filter_data === 'string'
    ? JSON.parse(activeSavedFilter.value.filter_data)
    : activeSavedFilter.value.filter_data;
  return data.searchQuery || '';
});

const searchPlaceholder = computed(() => {
  if (activeSavedFilter.value) {
    return `필터 적용: ${activeSavedFilter.value.name}`;
  }
  return "검색...";
});

const clearSearch = () => {
  searchQuery.value = '';
  activeSavedFilter.value = null;
};

const assetsFilterFn = (asset) => {
  // 1. 저장된 필터 적용
  const savedQuery = activeSavedFilterQuery.value;
  if (savedQuery) {
    if (savedQuery === '가용재고') {
      if (!(asset.state === 'useable' && asset.in_user === 'cjenc_inno')) return false;
    } else if (savedQuery === '1인 다PC 보유자') {
      if (!(multiPcUserIds.value.has(asset.in_user) && 
            (asset.category === '노트북' || asset.category === '데스크탑') && 
            asset.state === 'useable')) return false;
    } else {
      if (!parseAndFilter(asset, savedQuery, filterColumns.map(c => c.val))) return false;
    }
  }

  // 2. 추가 검색어 적용 (특수 예약어 처리)
  if (searchQuery.value === '가용재고') {
    if (!(asset.state === 'useable' && asset.in_user === 'cjenc_inno')) return false;
  } else if (searchQuery.value === '1인 다PC 보유자') {
    if (!(multiPcUserIds.value.has(asset.in_user) && 
          (asset.category === '노트북' || asset.category === '데스크탑') && 
          asset.state === 'useable')) return false;
  }

  // 3. 기본 제외 로직 (검색어가 없을 때만 termination 제외)
  const isExcluded = !searchQuery.value && !savedQuery && asset.state === 'termination';
  if (isExcluded) return false;

  return true;
};

const itemsPerPage = computed(() => {
  return (activeSavedFilterQuery.value === '가용재고' || searchQuery.value === '가용재고') ? 50 : 20;
});

const {
  currentPage,
  searchQuery,
  filteredData: filteredAssets,
  paginatedData: paginatedAssets,
  totalPages,
  pageNumbers,
  handleSort,
  getSortIcon,
  prevPage,
  nextPage,
  goToPage,
  sortColumn,
  sortDirection,
  isManualSort
} = useTable(assets, {
  itemsPerPage: itemsPerPage,
  filterFn: assetsFilterFn,
  searchFields: [
    'category', 'model', 'asset_number', 'serial_number',
    'in_user', 'user_name', 'user_part', 'state',
    'day_of_start', 'day_of_end', 'contract_month'
  ]
});

// 분류별 상세 개수 계산
const categoryBreakdown = computed(() => {
  const stats = {};
  filteredAssets.value.forEach(asset => {
    const cat = asset.category || '기타';
    stats[cat] = (stats[cat] || 0) + 1;
  });
  return Object.entries(stats)
    .sort((a, b) => b[1] - a[1]) // 개수 많은 순 정렬
    .map(([category, count]) => ({ category, count }));
});

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedAsset = ref(null);
const isClickStartedOnOverlay = ref(false);
const isTrackingOpen = ref(false); // 추적 모달 상태 추가
const isBulkRegisterOpen = ref(false); // 대량 등록 모달 상태
const isAssetCopied = ref(false);
const assetModalFields = [
  'category', 'model', 'asset_number', 'serial_number',
  'day_of_start', 'day_of_end', 'contract_month',
  'in_user', 'user_name', 'user_part', 'state', 'replacement', 'memo'
];
const stateOptions = ['useable', 'wait', 'hold', 'rent', 'repair', 'termination', 'process-ter'];

// 반납 처리 모달 상태
const isReturnModalOpen = ref(false);
const returnModalMessage = ref('');
const returnModalType = ref('confirm'); // 'confirm', 'success', 'error'
const pendingReturnAsset = ref(null);

// 퀵 거래 등록 상태
const isQuickTradeOpen = ref(false);
const quickTradeForm = ref({
  work_type: '',
  cj_id: '',
  cj_name: '',
  memo: ''
});
const quickTradeSuccess = ref(null);
const quickTradeError = ref(null);

// Saved Filters 상태
const savedFilters = ref([]);
const isSaveModalOpen = ref(false);
const newFilterName = ref('');
const isFilterDropdownOpen = ref(false);
const filterDropdownRef = ref(null);
const guideContainerRef = ref(null);

const handleClickOutside = (event) => {
  // 필터 드롭다운 닫기
  if (filterDropdownRef.value && !filterDropdownRef.value.contains(event.target)) {
    isFilterDropdownOpen.value = false;
  }
  // 가이드 팝업 닫기
  if (guideContainerRef.value && !guideContainerRef.value.contains(event.target)) {
    filterGuideOpen.value = false;
  }
};

// Filter Builder 상태
const isBuilderOpen = ref(false);
const builderConfig = ref({
  column: 'category',
  operator: ':',
  value: ''
});
const filterGuideOpen = ref(false);

const filterColumns = [
  { val: 'category', label: '분류' },
  { val: 'model', label: '모델' },
  { val: 'asset_number', label: '자산번호' },
  { val: 'serial_number', label: '시리얼번호' },
  { val: 'in_user', label: '사용자ID' },
  { val: 'user_name', label: '사용자명' },
  { val: 'user_part', label: '부서' },
  { val: 'state', label: '상태' },
  { val: 'unit_price', label: '월단가' },
  { val: 'contract_month', label: '계약월' }
];

const operators = [
  { val: ':', label: '포함' },
  { val: '=', label: '일치' },
  { val: '!=', label: '불일치' },
  { val: '>', label: '초과' },
  { val: '<', label: '미만' },
  { val: '>=', label: '이상' },
  { val: '<=', label: '이하' }
];

const addCondition = (type) => {
  const { column, operator, value } = builderConfig.value;
  if (!value) return;

  const condition = `${column}${operator}${value}`;
  if (!searchQuery.value) {
    searchQuery.value = condition;
  } else {
    searchQuery.value += ` ${type} ${condition}`;
  }
  builderConfig.value.value = '';
};

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
      handover_date: null,
      remarks: null
    };

    await assetApi.returnAsset(returnedAssetData);
    
    // 로컬 상태 업데이트
    const assetIndex = assets.value.findIndex(a => a.asset_id === asset.asset_id);
    if (assetIndex !== -1) {
      assets.value[assetIndex].state = 'process-ter';
    }
    
    // 성공 메시지 표시
    returnModalMessage.value = '자산이 반납 처리 페이지에 추가되었습니다.';
    returnModalType.value = 'success';
    
  } catch (err) {
    returnModalMessage.value = '자산 반납 처리에 실패했습니다: ' + err.message;
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

const fetchAssets = async () => {
  loading.value = true;
  error.value = null;
  selectedAsset.value = null;
  currentPage.value = 1;
  
  try {    
    assets.value = await assetApi.getAssets();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchSavedFilters = async () => {
  try {
    const filters = await filterApi.getFilters('assets');
    
    // DB 필터 데이터 파싱
    savedFilters.value = filters.map(f => {
      let data = {};
      try {
        data = (typeof f.filter_data === 'string' ? JSON.parse(f.filter_data) : f.filter_data) || {};
      } catch (e) {
        console.error('Failed to parse filter_data:', e);
      }
      return {
        ...f,
        is_protected: !!data.is_protected
      };
    });
  } catch (err) {
    console.error('Failed to fetch saved filters:', err);
  }
};

const openSaveFilterModal = () => {
  if (!searchQuery.value && !activeFilter.value) {
    alert('저장할 검색어나 필터가 없습니다.');
    return;
  }
  newFilterName.value = '';
  isSaveModalOpen.value = true;
};

const saveCurrentFilter = async () => {
  if (!newFilterName.value.trim()) {
    alert('필터 이름을 입력해주세요.');
    return;
  }

  try {
    loading.value = true;
    const filterData = {
      searchQuery: searchQuery.value,
      activeFilter: activeFilter.value,
      is_protected: false // 초기화 시 보호 해제 상태로 저장
    };
    await filterApi.saveFilter({
      name: newFilterName.value,
      page_context: 'assets',
      filter_data: filterData
    });
    isSaveModalOpen.value = false;
    await fetchSavedFilters();
  } catch (err) {
    alert('필터 저장 실패: ' + err.message);
  } finally {
    loading.value = false;
  }
};

const applySavedFilter = (filter) => {
  const data = typeof filter.filter_data === 'string' 
    ? JSON.parse(filter.filter_data) 
    : filter.filter_data;
  
  activeSavedFilter.value = filter;
  searchQuery.value = ""; 
  activeFilter.value = data.activeFilter || null;
  isFilterDropdownOpen.value = false;
};

const deleteSavedFilter = async (id) => {
  if (!confirm('이 필터를 삭제하시겠습니까?')) return;
  
  try {
    await filterApi.deleteFilter(id);
    await fetchSavedFilters();
  } catch (err) {
    alert('필터 삭제 실패: ' + err.message);
  }
};

const fetchAssetById = async (id) => {
  loading.value = true;
  error.value = null;
  
  try {
    const data = await assetApi.getAssetById(id);
    selectedAsset.value = data;
    editedAsset.value = JSON.parse(JSON.stringify(data));
    isModalOpen.value = true;
    isEditMode.value = false;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const handleRowClick = (asset) => {
  if (asset.asset_id) {
    selectedAsset.value = asset;
    editedAsset.value = JSON.parse(JSON.stringify(asset));
    isModalOpen.value = true;
    isEditMode.value = false;
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
  closeQuickTrade();
};

const closeQuickTrade = () => {
  isQuickTradeOpen.value = false;
  quickTradeForm.value = {
    work_type: '',
    cj_id: '',
    cj_name: '',
    memo: ''
  };
  quickTradeSuccess.value = null;
  quickTradeError.value = null;
};

// 퀵 거래 등록 관련 로직 (TradeRegisterPage에서 차용)

const validateTradeForQuick = (trade, asset) => {
  const { work_type } = trade;
  if (!work_type) return { valid: false, message: '작업 유형을 선택해주세요.' };

  // 1. 공통 유효성 검사 (Centralized)
  const validation = validateTradeStrict(trade, asset);
  if (!validation.valid) {
    return validation;
  }

  // 2. 고정 사용자 자동 할당 체크 (유효성 검사 통과 후 할당)
  if (isCjIdDisabled(work_type)) {
    const fixedValue = getFixedCjId(work_type);
    if (fixedValue === 'no-change') {
      trade.cj_id = asset.in_user;
    } else if (fixedValue) {
      trade.cj_id = fixedValue;
    }
  }

  return { valid: true };
};

const submitQuickTrade = async () => {
  const asset = selectedAsset.value;
  if (!asset) return;

  const trade = { ...quickTradeForm.value };
  trade.asset_number = asset.asset_number;
  trade.ex_user = asset.in_user || '';

  const validation = validateTradeForQuick(trade, asset);
  if (!validation.valid) {
    quickTradeError.value = validation.message;
    return;
  }

  try {
    loading.value = true;
    quickTradeError.value = null;
    quickTradeSuccess.value = null;

    // 모달을 통해 등록 중임을 표시
    returnModalMessage.value = '거래를 등록하고 있습니다. 잠시만 기다려 주세요...';
    returnModalType.value = 'confirm'; // 'confirm' 상태에서 확인 버튼은 loading 중이면 비활성화됨
    isReturnModalOpen.value = true;

    const tradeForSubmit = {
      work_type: trade.work_type,
      asset_number: trade.asset_number,
      cj_id: trade.cj_id,
      ex_user: trade.ex_user,
      memo: trade.memo,
      asset_state: asset.state,
      asset_in_user: asset.in_user,
      asset_memo: asset.memo
    };

    const response = await axios.post('/api/trades', [tradeForSubmit]);

    if (response.data.success) {
      // 성공 상채로 업데이트
      returnModalMessage.value = '거래가 성공적으로 등록 되었습니다.';
      returnModalType.value = 'success';

      // 자산 정보 다시 불러오기 (상태/보유자 변경 반영)
      fetchAssetById(asset.asset_id);
      fetchAssets(); 
      
      // 퀵 거래 입력창은 닫음
      closeQuickTrade();
    } else {
      returnModalMessage.value = '등록 실패: ' + (response.data.error || '알 수 없는 오류');
      returnModalType.value = 'error';
    }
  } catch (err) {
    returnModalMessage.value = '등록 중 오류 발생: ' + (err.response?.data?.error || err.message);
    returnModalType.value = 'error';
  } finally {
    loading.value = false;
  }
};

// 작업 유형 필터링 로직 (자산 상태 및 보유자에 따라)
const currentWorkTypeFilter = computed(() => {
  const asset = selectedAsset.value;
  if (!asset) return () => true;

  const availableTypes = getAvailableWorkTypesForAsset(asset);
  const availableTypeIds = new Set(availableTypes.map(wt => wt.id));

  return (wt) => availableTypeIds.has(wt.work_type);
});

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
    
    await assetApi.updateAsset(editedAsset.value.asset_id, editedAsset.value);
    
    selectedAsset.value = JSON.parse(JSON.stringify(editedAsset.value));
    
    const assetIndex = assets.value.findIndex(a => a.asset_id === editedAsset.value.asset_id);
    if (assetIndex !== -1) {
      assets.value[assetIndex] = JSON.parse(JSON.stringify(editedAsset.value));
    }
    
    isEditMode.value = false;
    error.value = null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};


const goToTradeSearch = () => {
  if (!selectedAsset.value || !selectedAsset.value.asset_number) return;
  router.push({
    name: 'Trades',
    query: { search: selectedAsset.value.asset_number }
  });
  closeModal();
};

const getTableHeaders = (data) => {
  if (data.length === 0) return [];
  
  const headers = Object.keys(data[0]);
  const filtered = headers.filter(h => !['asset_id', 'user_cj_id', 'user_name', 'user_part', 'unit_price', 'replacement'].includes(h));
  
  const result = [];
  for (let header of filtered) {
    if (header === 'in_user') {
      if (!result.includes('state')) result.push('state');
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
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
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
    'contract_month': '계약월',
    'replacement': '고장교체',
    'memo': '자산메모'
  };
  return headerMap[columnName] || columnName;
};

const downloadCSV = () => {
  if (filteredAssets.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const filename = getTimestampFilename('AssetsPage');
  
  // 요청된 순서에 맞춰 헤더 목록 정의 (월단가 제외)
  const headers = [
    'category', 'model', 'asset_number', 'serial_number', 
    'day_of_start', 'day_of_end', 'contract_month', 
    'in_user', 'user_name', 'user_part', 'state', 
    'replacement', 'memo'
  ];
  const headerRow = headers.map(h => getHeaderDisplayName(h));
  
  const dataRows = filteredAssets.value.map(asset => 
    headers.map(header => {
      let value = asset[header] || '';
      if ((header === 'day_of_start' || header === 'day_of_end') && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) value = date.toISOString().split('T')[0];
      }
      return value;
    })
  );
  
  downloadCSVFile(filename, headerRow, dataRows);
};

const copyAssetInfoDetailed = () => {
  if (!selectedAsset.value) return;

  const fields = assetModalFields.filter(key => selectedAsset.value[key] !== undefined && key !== 'replacement');
  
  // HTML 버전 (요청하신 스타일 적용: 12px, 헤더 회색배경, 검은색 텍스트, 1px 검은색 테두리)
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 12px; width: 100%; font-family: sans-serif; border: 1px solid #000000;">
      <thead>
        <tr style="font-weight: bold; color: #000000;">
          ${fields.map(field => `<th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000;">${getHeaderDisplayName(field)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          ${fields.map(field => `<td style="border: 1px solid #000000; padding: 10px; color: #000000;">${formatCellValue(selectedAsset.value[field], field, selectedAsset.value) || '-'}</td>`).join('')}
        </tr>
      </tbody>
    </table>
  `;

  // 텍스트 버전 (Fallback)
  const plainText = fields.map(field => `${getHeaderDisplayName(field)}: ${formatCellValue(selectedAsset.value[field], field, selectedAsset.value) || '-'}`).join('\n');

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

const getExpirationClass = (asset) => {
  const isAvailableStockFilter = getRawQuery(searchQuery.value) === '가용재고' || activeSavedFilterQuery.value === '가용재고';
  if (!isAvailableStockFilter || !asset.day_of_end) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(asset.day_of_end);
  endDate.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expire-passed';
  if (diffDays <= 30) return 'expire-warning-30';
  if (diffDays <= 60) return 'expire-warning-60';
  return '';
};


onMounted(() => {
  fetchAssets();
  fetchSavedFilters();

  if (route.query.q) {
    searchQuery.value = route.query.q;
  }

  // 가용재고 필터 시 복합 정렬 적용
  watch([activeFilter, activeSavedFilterQuery], ([newFilter, newSavedQuery]) => {
    if (newFilter === 'available' || newSavedQuery === '가용재고') {
      sortColumn.value = ['category', 'model'];
      sortDirection.value = 'asc';
    } else if (!newFilter && !newSavedQuery && searchQuery.value !== '1인 다PC 보유자') {
      // 필터 해제 시 기본 정렬로 복구
      sortColumn.value = 'asset_id';
      sortDirection.value = 'asc';
    }
  });

  // 특수 필터 검색 시 정렬 적용
  watch([searchQuery, activeSavedFilterQuery], ([newQuery, newSavedQuery]) => {
    if (newQuery === '1인 다PC 보유자' || newSavedQuery === '1인 다PC 보유자') {
      sortColumn.value = 'in_user';
      sortDirection.value = 'asc';
    } else if (newQuery === '가용재고' || newSavedQuery === '가용재고') {
      sortColumn.value = ['category', 'model'];
      sortDirection.value = 'asc';
    } else if (!newQuery && !newSavedQuery) {
      sortColumn.value = 'asset_id';
      sortDirection.value = 'asc';
    }
  });

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (isTrackingOpen.value) isTrackingOpen.value = false;
      else if (isReturnModalOpen.value) isReturnModalOpen.value = false;
      else if (isModalOpen.value) closeModal();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('click', handleClickOutside);
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('click', handleClickOutside);
  });
});
</script>

<template>
  <div class="page-content">
    <h1>자산 관리</h1>
    
    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="loading" class="alert alert-info">
      <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...
    </div>
    
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
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
            <button v-if="selectedAsset" class="btn-trade-search" @click="goToTradeSearch">
              <img src="/images/go.png" alt="search" class="btn-icon-custom" />
              거래검색
            </button>
            <button @click="closeModal" class="close-btn">✕</button>
          </div>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedAsset" class="form-grid">
            <template v-for="key in assetModalFields" :key="key">
              <div v-if="selectedAsset[key] !== undefined" class="form-group">
                <label>{{ getHeaderDisplayName(key) }}</label>
                <select v-if="isEditMode && key === 'state'" v-model="editedAsset[key]" class="form-input">
                  <option v-for="opt in stateOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input v-else-if="isEditMode" v-model="editedAsset[key]" type="text" class="form-input" :disabled="['asset_id', 'category', 'asset_number', 'in_user', 'contract_month', 'unit_price', 'replacement'].includes(key)" />
                <div v-else class="form-value"> {{ formatCellValue(selectedAsset[key], key, selectedAsset) }} </div>
              </div>
            </template>
          </div>

          <!-- 퀵 거래 등록 섹션 -->
          <div v-if="isQuickTradeOpen" class="quick-trade-section">
            <h3><img src="/images/edit.png" alt="edit" class="header-icon-small" /> 거래 등록</h3>
            <div v-if="quickTradeError" class="alert-small alert-error">{{ quickTradeError }}</div>
            <div v-if="quickTradeSuccess" class="alert-small alert-success">{{ quickTradeSuccess }}</div>
            
            <div class="quick-trade-form">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label>작업 유형</label>
                  <WorkTypeSearch
                    id="quick-work-type"
                    :initial-value="quickTradeForm.work_type"
                    placeholder="작업 유형 선택"
                    :filter-fn="currentWorkTypeFilter"
                    @select="(item) => quickTradeForm.work_type = item.work_type"
                  />
                </div>
                <div class="form-group flex-1">
                  <label>CJ ID (사용자)</label>
                  <div v-if="isCjIdDisabled(quickTradeForm.work_type)" class="fixed-user-display">
                    {{ getFixedCjIdDisplay(quickTradeForm.work_type) }}
                  </div>
                  <AutocompleteSearch
                    v-else
                    id="quick-cj-id"
                    :initial-value="quickTradeForm.cj_name || quickTradeForm.cj_id"
                    placeholder="사용자 검색"
                    api-table="users"
                    api-column="cj_id"
                    @select="(item) => {
                      quickTradeForm.cj_id = item.cj_id;
                      quickTradeForm.cj_name = item.name;
                    }"
                  />
                </div>
              </div>
              <div class="form-group">
                <label>거래메모</label>
                <input v-model="quickTradeForm.memo" type="text" class="form-input" placeholder="거래 메모 입력" />
              </div>
              <div class="quick-trade-actions">
                <button @click="submitQuickTrade" class="btn btn-modal btn-save" :disabled="loading">등록</button>
                <button @click="isQuickTradeOpen = false" class="btn btn-modal btn-cancel">취소</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="!isEditMode && !isQuickTradeOpen && selectedAsset" @click="isQuickTradeOpen = true" class="btn btn-modal btn-trade">거래</button>
          <button v-if="!isEditMode && !isQuickTradeOpen && selectedAsset" @click="isTrackingOpen = true" class="btn btn-modal btn-tracking">추적</button>
          <button v-if="!isEditMode && !isQuickTradeOpen" @click="toggleEditMode" class="btn btn-modal btn-edit">수정</button>
          <button v-if="isEditMode" @click="saveAsset" class="btn btn-modal btn-save">저장</button>
          <button v-if="isEditMode" @click="toggleEditMode" class="btn btn-modal btn-cancel">취소</button>
          <button @click="closeModal" class="btn btn-modal btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <!-- 반납 처리 확인 모달 -->
    <div v-if="isReturnModalOpen" class="modal-overlay" @click.self="closeReturnModal">
      <div class="modal-content return-modal">
        <div class="modal-header">
          <h2>
            <span v-if="returnModalType === 'confirm'">
              <img v-if="loading" src="/images/hour-glass.png" alt="loading" class="loading-icon" />
              {{ loading ? '처리 중...' : (quickTradeForm.work_type ? '거래 등록' : '반납 처리 확인') }}
            </span>
            <span v-else-if="returnModalType === 'success'"><img src="/images/checkmark.png" alt="success" class="checkmark-icon" /> 완료</span>
            <span v-else>❌ 오류</span>
          </h2>
          <button @click="closeReturnModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body" style="text-align: center; padding: 30px 20px;">
          <p class="return-message" style="font-size: 16px; line-height: 1.6;">{{ returnModalMessage }}</p>
        </div>
        
        <div class="modal-footer">
          <button v-if="returnModalType === 'confirm'" @click="confirmReturn" class="btn btn-modal btn-confirm" :disabled="loading">
            {{ loading ? '처리 중...' : '확인' }}
          </button>
          <button v-if="returnModalType === 'confirm'" @click="closeReturnModal" class="btn btn-modal btn-cancel">취소</button>
          <button v-if="returnModalType === 'success' || returnModalType === 'error'" @click="closeReturnModal" class="btn btn-modal btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <div v-if="assets.length > 0" class="assets-section">
      <div class="assets-header-actions">
        <div class="header-title-group">
          <h2>자산 목록 ({{ filteredAssets.length }}개)</h2>
        </div>
        <div class="filter-actions-group">
          <div class="filter-actions">
            <!-- New +add button -->
            <button @click="isBulkRegisterOpen = true" class="btn btn-header btn-csv" title="신규 자산 등록">
              <img src="/images/edit.png" alt="add" class="btn-icon" />
              + add
            </button>
            <button @click="downloadCSV" class="btn btn-header btn-csv">
              <img src="/images/down.png" alt="download" class="btn-icon" />
              csv
            </button>
          </div>
          <div class="filter-builder-actions">
            <button @click="isBuilderOpen = !isBuilderOpen" class="btn btn-header btn-builder" :class="{ active: isBuilderOpen }" title="단계별 필터 설정">
              <img src="/images/setting.png" alt="settings" class="builder-icon" />
              필터 빌더
            </button>
            <div ref="guideContainerRef" class="guide-wrapper">
              <button @click="filterGuideOpen = !filterGuideOpen" class="btn-guide-trigger" title="검색 가이드">
                <img src="/images/infor.png" alt="guide" class="guide-icon" />
              </button>
              <div v-if="filterGuideOpen" class="search-guide-popup">
                <h4>고급 검색 문법 가이드</h4>
                <ul>
                  <li><strong>컬럼 지정</strong>: <code>model:ThinkPad</code></li>
                  <li><strong>논리 연산</strong>: <code>A AND B</code>, <code>A OR B</code></li>
                  <li><strong>비교 연산</strong>: <code>unit_price > 50000</code></li>
                  <li><strong>우선 순위</strong>: <code>(A OR B) AND C</code></li>
                  <li><strong>일반 검색</strong>: 단어만 입력 시 전체 필드 검색</li>
                </ul>
                <button @click="filterGuideOpen = false" class="guide-close">닫기</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 필터 빌더 UI -->
      <div v-if="isBuilderOpen" class="filter-builder-panel">
        <div class="builder-row">
          <select v-model="builderConfig.column" class="builder-input">
            <option v-for="col in filterColumns" :key="col.val" :value="col.val">{{ col.label }}</option>
          </select>
          <select v-model="builderConfig.operator" class="builder-input small">
            <option v-for="op in operators" :key="op.val" :value="op.val">{{ op.label }}</option>
          </select>
          <input v-model="builderConfig.value" type="text" placeholder="값 입력..." class="builder-input flex-1" @keyup.enter="addCondition('AND')" />
          <div class="builder-actions">
            <button @click="addCondition('AND')" class="btn btn-and">AND 추가</button>
            <button @click="addCondition('OR')" class="btn btn-or">OR 추가</button>
          </div>
        </div>
      </div>

      <div class="search-container">
        <div ref="filterDropdownRef" class="filter-dropdown-wrapper">
          <button @click="isFilterDropdownOpen = !isFilterDropdownOpen" class="btn btn-saved-filters" title="저장된 필터">
            <img src="/images/filter_list.png" alt="filter" class="btn-icon-small" />
            저장된 필터
          </button>
          <div v-if="isFilterDropdownOpen" class="filter-dropdown-menu">
            <div v-if="savedFilters.length === 0" class="dropdown-item empty">저장된 필터가 없습니다.</div>
            <div v-for="filter in savedFilters" :key="filter.id" class="dropdown-item" @click="applySavedFilter(filter)">
              <span class="filter-name">{{ filter.name }}</span>
              <button v-if="!filter.is_protected" @click.stop="deleteSavedFilter(filter.id)" class="btn-delete-filter">✕</button>
            </div>
          </div>
        </div>
        <div class="search-input-wrapper">
          <input v-model="searchQuery" type="text" :placeholder="searchPlaceholder" class="search-input" />
          <button v-if="searchQuery || activeSavedFilter" @click="clearSearch" class="clear-btn">✕</button>
        </div>
        <button @click="openSaveFilterModal" class="btn btn-save-filter" title="현재 필터 저장">
          <svg class="btn-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          저장
        </button>
      </div>
      
      <!-- 필터 저장 모달 -->
      <div v-if="isSaveModalOpen" class="modal-overlay" @click.self="isSaveModalOpen = false">
        <div class="modal-content save-filter-modal">
          <div class="modal-header">
            <h2>현재 필터 저장</h2>
            <button @click="isSaveModalOpen = false" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>필터 이름</label>
              <input v-model="newFilterName" type="text" class="form-input" placeholder="예: 가용 노트북, 퇴사자 검색 등" @keyup.enter="saveCurrentFilter" />
            </div>
            <div class="filter-preview mt-15">
              <p><strong>저장될 조건:</strong></p>
              <ul>
                <li v-if="searchQuery">검색어: "{{ searchQuery }}"</li>
                <li v-if="activeFilter">상태 필터: {{ getHeaderDisplayName(activeFilter) }}</li>
              </ul>
            </div>
          </div>
          <div class="modal-footer">
            <button @click="saveCurrentFilter" class="btn btn-modal btn-save" :disabled="loading">저장</button>
            <button @click="isSaveModalOpen = false" class="btn btn-modal btn-cancel">취소</button>
          </div>
        </div>
      </div>
      
      <div v-if="searchQuery || activeSavedFilter || activeFilter" class="filter-summary-area">
        <span class="total-count">검색 결과 <strong>{{ filteredAssets.length }}</strong>건</span>
        <div class="category-divider"></div>
        <div class="category-chips">
          <div v-for="item in categoryBreakdown" :key="item.category" class="chip">
            <span class="chip-label">{{ item.category }}</span>
            <span class="chip-value">{{ item.count }}</span>
          </div>
        </div>
      </div>
      
      <div class="table-wrapper">
        <table class="assets-table">
          <thead>
            <tr>
              <th v-for="key in getTableHeaders(assets)" :key="key" @click="handleSort(key)" class="sortable-header" :class="{ active: isManualSort && sortColumn === key }">
                <div class="header-content">
                  <span>{{ getHeaderDisplayName(key) }}</span>
                  <span class="sort-icon">{{ getSortIcon(key) }}</span>
                </div>
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(asset, index) in paginatedAssets" :key="asset.asset_id" @click="handleRowClick(asset)" :class="[{ 'stripe': index % 2 === 1, active: selectedAsset?.asset_id === asset.asset_id }, 'clickable-row']">
              <td v-for="key in getTableHeaders(assets)" :key="key">
                <span v-if="key === 'day_of_end'" :class="getExpirationClass(asset)" class="expiration-badge">
                  {{ formatCellValue(asset[key], key, asset) }}
                </span>
                <span v-else-if="['category', 'asset_number', 'user_name', 'state'].includes(key)" class="bold-text">
                  {{ formatCellValue(asset[key], key, asset) }}
                </span>
                <template v-else> {{ formatCellValue(asset[key], key, asset) }} </template>
              </td>
              <td>
                <button @click.stop="handleReturn(asset)" class="btn btn-action-small" :class="{ 'btn-return-process': !isAssetProcessedForReturn(asset), 'btn-returned': isAssetProcessedForReturn(asset) }" :disabled="isAssetProcessedForReturn(asset)">
                  {{ asset.state === 'process-ter' ? '처리중' : (asset.state === 'termination' ? '반납완료' : '반납처리') }}
                </button>
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
    
    <div v-else-if="!loading" class="empty-state"> 자산이 없습니다. </div>

    <AssetTrackingModal 
      :is-open="isTrackingOpen" 
      :initial-asset-number="selectedAsset?.asset_number || ''"
      :initial-model="selectedAsset?.model || ''"
      :initial-category="selectedAsset?.category || ''"
      :initial-memo="selectedAsset?.memo || ''"
      @close="isTrackingOpen = false" 
    />
    
    <BulkAssetRegisterModal
      :is-open="isBulkRegisterOpen"
      @close="isBulkRegisterOpen = false"
      @success="fetchAssets"
    />
  </div>
</template>

<style scoped>
.assets-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  width: 100%;
  box-sizing: border-box;
}

.assets-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

.header-title-group {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.category-summary {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: normal;
  margin-left: 8px;
}

.filter-summary-area {
  margin-bottom: 20px;
  padding: 10px 15px;
  background: var(--bg-muted);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: nowrap;
  overflow-x: auto;
}

.total-count {
  font-size: 13px;
  color: var(--text-light);
  white-space: nowrap;
}

.category-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  flex-shrink: 0;
}

.total-count strong {
  color: var(--brand-blue);
  font-size: 16px;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-actions-group {
  display: flex;
  gap: 20px;
  align-items: center;
}

.filter-actions, .filter-builder-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-filter {
  background: var(--secondary-color);
  color: white;
}

.btn-filter:hover { background: #666; }
.btn-filter.active { background: var(--primary-color); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); }

.btn-tracking { background: var(--secondary-color); color: white; }
.btn-tracking:hover { background: var(--primary-color); }

.btn-action-small {
  transform: scale(0.85);
  font-size: 12px;
  padding: 8px 12px;
}

.btn-return-process { background: #6b8e6f; color: white; }
.btn-returned { background: var(--border-color); color: white; cursor: not-allowed; }

.expiration-badge {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  display: inline-block;
}

.expire-warning-60 { background-color: #fff9c4; color: #856404; font-weight: bold; }
.expire-warning-30 { background-color: #fff176; color: #856404; font-weight: bold; }
.expire-passed { background-color: #f8bbd0; color: #c2185b; font-weight: bold; }

.return-modal { max-width: 500px; }
.return-message { font-size: 16px; line-height: 1.6; color: var(--text-main); text-align: center; padding: 20px 0; }

.btn-confirm { background: #27ae60; color: white; }
.btn-confirm:hover:not(:disabled) { background: #229954; }

/* 퀵 거래 등록 스타일 */
.btn-trade { background: var(--brand-blue); color: white; }
.btn-trade:hover {
  background: var(--brand-blue-dark);
}

.quick-trade-section {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 2px dashed var(--border-color);
}

.quick-trade-section h3 {
  font-size: 18px;
  color: var(--text-main);
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-trade-form {
  background: var(--bg-muted);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  width: 100%;
}

.fixed-user-display {
  height: 40px;
  padding: 0 10px;
  background-color: var(--bg-color);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}

.mt-15 { margin-top: 15px; }
.mt-20 { margin-top: 20px; }

.quick-trade-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px; /* 명시적 마진 추가 */
}

.alert-small {
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 10px;
  border-radius: var(--radius-sm);
}

/* 복사 버튼 스타일 */
.copy-btn-small {
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.copy-btn-small:hover {
  opacity: 0.7;
}

.btn-icon-black {
  width: 18px;
  height: 18px;
  object-fit: contain;
  filter: brightness(0);
}

.check-mark-black {
  color: var(--text-main);
  font-size: 16px;
  font-weight: bold;
}

.btn-icon-small, .header-icon-small {
  width: 18px;
  height: 18px;
  object-fit: contain;
  vertical-align: middle;
}

/* 저장된 필터 관련 스타일 */
.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.filter-dropdown-wrapper {
  position: relative;
}

.btn-saved-filters, .btn-save-filter {
  background: #eee;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border-color);
  white-space: nowrap;
}

.btn-saved-filters:hover, .btn-save-filter:hover {
  background: #e0e0e0;
}

.btn-save-filter {
  background: var(--bg-muted);
}

.btn-saved-filters .btn-icon-svg, .btn-save-filter .btn-icon-svg {
  width: 16px;
  height: 16px;
}

.filter-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 400px;
  margin-top: 5px;
  max-height: 300px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--border-light);
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: var(--bg-muted);
}

.dropdown-item.empty {
  color: var(--text-light);
  font-size: 13px;
  cursor: default;
}

.filter-name {
  font-size: 14px;
  color: var(--text-main);
}

.btn-delete-filter {
  background: transparent;
  border: none;
  color: var(--text-light);
  font-size: 16px;
  cursor: pointer;
  padding: 0 5px;
}

.btn-delete-filter:hover {
  color: var(--error-color);
}

.save-filter-modal {
  max-width: 400px;
}

.filter-preview {
  background: var(--bg-muted);
  padding: 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.filter-preview ul {
  margin: 5px 0 0 20px;
  padding: 0;
}

/* 고급 검색 UI 스타일 */
.btn-builder {
  background: #f0f4f8;
  border: 1px solid #d1d9e6;
  color: #4a5568;
}

.btn-builder.active {
  background: #e2e8f0;
  border-color: #cbd5e0;
}

.btn-builder img {
  filter: brightness(0);
}

.btn-guide-trigger {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  transition: background 0.2s;
}

.btn-guide-trigger:hover {
  background: #f0f0f0;
}

.guide-icon {
  width: 20px;
  height: 20px;
  display: block;
  object-fit: contain;
}

.search-guide-popup {
  position: absolute;
  top: 100%;
  right: 0;
  width: 280px;
  background: white;
  border: 1px solid var(--border-color);
  padding: 15px;
  border-radius: var(--radius-md);
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  z-index: 1001;
  margin-top: 5px;
}

.search-guide-popup h4 {
  margin: 0 0 10px 0;
  color: var(--text-main);
  font-size: 15px;
}

.search-guide-popup ul {
  padding-left: 15px;
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-muted);
}

.guide-close {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 5px;
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.filter-builder-panel {
  background: var(--bg-muted);
  border: 1px solid var(--border-light);
  padding: 12px;
  border-radius: var(--radius-md);
  margin-bottom: 15px;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.builder-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.builder-input {
  padding: 8px;
  border: 1px solid #cbd5e0;
  border-radius: var(--radius-sm);
  background: white;
  font-size: 14px;
}

.builder-input.small { width: 80px; }

.builder-actions {
  display: flex;
  gap: 5px;
}

.btn-and { background: #4a5568; color: white; padding: 8px 12px; border: none; border-radius: var(--radius-sm); cursor: pointer; }
.btn-or { background: #718096; color: white; padding: 8px 12px; border: none; border-radius: var(--radius-sm); cursor: pointer; }

.btn-and:hover { background: #2d3748; }
.btn-or:hover { background: #4a5568; }

.btn-trade-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--brand-blue, #0052CC);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-trade-search:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-icon-custom {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.bold-text {
  font-weight: 700;
  color: #2c3e50;
}
</style>
