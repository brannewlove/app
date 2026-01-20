<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import AssetTrackingModal from '../components/AssetTrackingModal.vue';
import TablePagination from '../components/TablePagination.vue';
import AutocompleteSearch from '../components/AutocompleteSearch.vue';
import WorkTypeSearch from '../components/WorkTypeSearch.vue';
import assetApi from '../api/assets';
import { useTable } from '../composables/useTable';
import axios from 'axios';

const assets = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedAsset = ref(null);

const activeFilter = ref(null); // null, 'available', 'rent', 'repair'

const assetsFilterFn = (asset) => {
  // Common filter for excluding 'termination' when not searching (original logic)
  const isExcluded = !searchQuery.value && asset.state === 'termination';
  if (isExcluded) return false;

  // Active status filters
  if (activeFilter.value === 'available') {
    return asset.state === 'useable' && asset.in_user === 'cjenc_inno';
  } else if (activeFilter.value === 'rent') {
    return asset.state === 'rent';
  } else if (activeFilter.value === 'repair') {
    return asset.state === 'repair';
  }
  return true;
};

const itemsPerPage = computed(() => {
  return activeFilter.value === 'available' ? 50 : 20;
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
  sortDirection
} = useTable(assets, {
  itemsPerPage: itemsPerPage,
  filterFn: assetsFilterFn,
  searchFields: [
    'category', 'model', 'asset_number', 'serial_number',
    'in_user', 'user_name', 'user_part', 'state',
    'day_of_start', 'day_of_end', 'contract_month'
  ]
});

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedAsset = ref(null);
const isClickStartedOnOverlay = ref(false);
const isTrackingOpen = ref(false); // 추적 모달 상태 추가
const isAssetCopied = ref(false);
const assetModalFields = [
  'category', 'model', 'asset_number', 'serial_number',
  'day_of_start', 'day_of_end', 'contract_month',
  'in_user', 'user_name', 'user_part', 'state', 'replacement'
];
const stateOptions = ['useable', 'rent', 'repair', 'termination', 'process-ter'];

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
const isCjIdDisabled = (workType) => {
  const fixedFields = [
    '입고-노후교체', '입고-불량교체', '입고-퇴사반납', '입고-휴직반납',
    '입고-재입사예정', '입고-임의반납', '입고-대여반납', '입고-수리반납',
    '반납','반납-노후반납', '반납-고장교체', '반납-조기반납', '반납-폐기',
    '출고-수리'
  ];
  return fixedFields.includes(workType);
};

const getFixedCjId = (workType) => {
  const fixedMap = {
    '입고-노후교체': 'cjenc_inno',
    '입고-불량교체': 'cjenc_inno',
    '입고-퇴사반납': 'cjenc_inno',
    '입고-휴직반납': 'no-change',
    '입고-재입사예정': 'no-change',
    '입고-임의반납': 'cjenc_inno',
    '입고-대여반납': 'cjenc_inno',
    '입고-수리반납': 'no-change',
    '반납-노후반납': 'aj_rent',
    '반납-고장교체': 'aj_rent',
    '반납-조기반납': 'aj_rent',
    '반납-폐기': 'aj_rent',
    '반납': 'aj_rent',
    '출고-수리': 'no-change'
  };
  return fixedMap[workType] || '';
};

const getFixedCjIdDisplay = (workType) => {
  const displayMap = {
    '입고-노후교체': '회사 입고 (자동)',
    '입고-불량교체': '회사 입고 (자동)',
    '입고-퇴사반납': '회사 입고 (자동)',
    '입고-휴직반납': '현재 보유자 유지 (자동)',
    '입고-재입사예정': '현재 보유자 유지 (자동)',
    '입고-임의반납': '회사 입고 (자동)',
    '입고-대여반납': '회사 입고 (자동)',
    '입고-수리반납': '현재 보유자 유지 (자동)',
    '반납-노후반납': '반납처 (자동)',
    '반납-고장교체': '반납처 (자동)',
    '반납-조기반납': '반납처 (자동)',
    '반납-폐기': '반납처 (자동)',
    '반납': '반납처 (자동)',
    '출고-수리': '현재 보유자 유지 (자동)'
  };
  return displayMap[workType] || '';
};

const validateTradeForQuick = (trade, asset) => {
  const { work_type, cj_id } = trade;
  const { state: asset_state, in_user: asset_in_user } = asset;

  if (!work_type) return { valid: false, message: '작업 유형을 선택해주세요.' };

  // 작업유형별 유효성 검사 (TradeRegisterPage 로직)
  switch (work_type) {
    // 출고 그룹
    case '출고-신규지급':
    case '출고-신규교체':
      if (asset_state !== 'wait') return { valid: false, message: `상태가 "${asset_state}"입니다. "wait" 상태만 가능합니다.` };
      if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
      break;

    case '출고-사용자변경':
      if (asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
      if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
      if (asset_in_user && cj_id === asset_in_user) return { valid: false, message: '현재 사용자와 다른 사용자를 선택해야 합니다.' };
      break;

    case '출고-재고교체':
    case '출고-재고지급':
    case '출고-대여':
      if (asset_in_user !== 'cjenc_inno') return { valid: false, message: `보유자가 "${asset_in_user}"입니다. "cjenc_inno"여야 합니다.` };
      if (asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
      if (!cj_id) return { valid: false, message: '사용자(CJ ID)를 선택해주세요.' };
      break;

    case '출고-수리':
      if (asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
      break;

    // 입고 그룹
    case '입고-노후교체':
    case '입고-불량교체':
    case '입고-퇴사반납':
    case '입고-임의반납':
    case '입고-휴직반납':
    case '입고-재입사예정':
      if (asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
      if (asset_state !== 'useable') return { valid: false, message: `상태가 "${asset_state}"입니다. "useable" 상태만 가능합니다.` };
      break;

    case '입고-대여반납':
      if (asset_in_user === 'cjenc_inno') return { valid: false, message: `이미 회사 입고 상태(cjenc_inno)입니다.` };
      if (asset_state !== 'rent') return { valid: false, message: `상태가 "${asset_state}"입니다. "rent" 상태만 가능합니다.` };
      break;

    case '입고-수리반납':
      if (asset_state !== 'repair') return { valid: false, message: `상태가 "${asset_state}"입니다. "repair" 상태만 가능합니다.` };
      break;
  }

  if (isCjIdDisabled(work_type)) {
    const fixedValue = getFixedCjId(work_type);
    if (fixedValue === 'no-change') {
      trade.cj_id = asset_in_user;
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

    const tradeForSubmit = {
      work_type: trade.work_type,
      asset_number: trade.asset_number,
      cj_id: trade.cj_id,
      ex_user: trade.ex_user,
      memo: trade.memo
    };

    const response = await axios.post('/api/trades', [tradeForSubmit]);

    if (response.data.success) {
      quickTradeSuccess.value = '거래가 성공적으로 등록되었습니다.';
      // 자산 정보 다시 불러오기 (상태/보유자 변경 반영)
      fetchAssetById(asset.asset_id);
      fetchAssets(); // 목록도 업데이트
      setTimeout(() => {
        closeQuickTrade();
      }, 1500);
    } else {
      quickTradeError.value = response.data.error || '등록 실패';
    }
  } finally {
    loading.value = false;
  }
};

// 작업 유형 필터링 로직 (자산 상태 및 보유자에 따라)
const currentWorkTypeFilter = computed(() => {
  const asset = selectedAsset.value;
  if (!asset) return () => true;

  const { state, in_user } = asset;
  
  return (wt) => {
    const type = wt.work_type;
    
    // 1. 상태가 'wait' (신규/대기)인 경우
    if (state === 'wait') {
      return ['출고-신규지급', '출고-신규교체'].includes(type);
    }
    
    // 2. 상태가 'useable' (사용가능/사용중)인 경우
    if (state === 'useable') {
      if (in_user === 'cjenc_inno') {
        // 전산실 재고: 타인에게 출고하거나 렌탈사 반납
        return [
          '출고-재고지급', '출고-재고교체', '출고-대여', '출고-수리',
          '반납', '반납-노후반납', '반납-고장교체', '반납-조기반납', '반납-폐기'
        ].includes(type);
      } else {
        // 사용자 보유: 타인에게 변경하거나 전산실 입고
        return [
          '출고-사용자변경', '출고-수리',
          '입고-노후교체', '입고-불량교체', '입고-퇴사반납', '입고-임의반납', '입고-휴직반납', '입고-재입사예정'
        ].includes(type);
      }
    }
    
    // 3. 상태가 'rent' (대여중)인 경우
    if (state === 'rent') {
      return type === '입고-대여반납';
    }
    
    // 4. 상태가 'repair' (수리중)인 경우
    if (state === 'repair') {
      return type === '입고-수리반납';
    }
    
    return false;
  };
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
    'replacement': '불량교체'
  };
  return headerMap[columnName] || columnName;
};

const downloadTSV = () => {
  if (filteredAssets.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:T]/g, '_').split('.')[0];
  const filename = `AssetsPage_${timestamp}.tsv`;
  
  const headers = getTableHeaders(filteredAssets.value);
  const tsvContent = [
    headers.map(h => getHeaderDisplayName(h)).join('\t'),
    ...filteredAssets.value.map(asset => 
      headers.map(header => {
        let value = asset[header] || '';
        if ((header === 'day_of_start' || header === 'day_of_end') && value) {
          const date = new Date(value);
          if (!isNaN(date.getTime())) value = date.toISOString().split('T')[0];
        }
        if (typeof value === 'string') return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
        return value;
      }).join('\t')
    )
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const copyAssetInfoDetailed = () => {
  if (!selectedAsset.value) return;

  const fields = assetModalFields.filter(key => selectedAsset.value[key] !== undefined);
  
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
  if (activeFilter.value !== 'available' || !asset.day_of_end) return '';

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

  // 가용재고 필터 시 복합 정렬 적용
  watch(activeFilter, (newFilter) => {
    if (newFilter === 'available') {
      sortColumn.value = ['category', 'model'];
      sortDirection.value = 'asc';
    } else {
      // 필터 해제 시 기본 정렬로 복구 (필요시)
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
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown));
});
</script>

<template>
  <div class="page-content">
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
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="margin: 0;">자산 정보</h2>
            <button class="copy-btn-small" @click="copyAssetInfoDetailed" title="클립보드 복사">
              <img v-if="!isAssetCopied" src="/images/clipboard.png" alt="copy" class="btn-icon-black" />
              <span v-else class="check-mark-black">✓</span>
            </button>
          </div>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedAsset" class="form-grid">
            <template v-for="key in assetModalFields" :key="key">
              <div v-if="selectedAsset[key] !== undefined" class="form-group">
                <label>{{ getHeaderDisplayName(key) }}</label>
                <select v-if="isEditMode && key === 'state'" v-model="editedAsset[key]" class="form-input">
                  <option v-for="opt in stateOptions" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input v-else-if="isEditMode" v-model="editedAsset[key]" type="text" class="form-input" :disabled="['asset_id', 'asset_number', 'unit_price'].includes(key)" />
                <div v-else class="form-value"> {{ formatCellValue(selectedAsset[key], key, selectedAsset) }} </div>
              </div>
            </template>
          </div>

          <!-- 퀵 거래 등록 섹션 -->
          <div v-if="isQuickTradeOpen" class="quick-trade-section">
            <h3>거래 등록</h3>
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
              <div class="form-group mt-15">
                <label>메모</label>
                <input v-model="quickTradeForm.memo" type="text" class="form-input" placeholder="거래 메모 입력" />
              </div>
              <div class="quick-trade-actions mt-15">
                <button @click="submitQuickTrade" class="btn btn-save" :disabled="loading">등록</button>
                <button @click="isQuickTradeOpen = false" class="btn btn-cancel">취소</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="!isEditMode && !isQuickTradeOpen && selectedAsset" @click="isQuickTradeOpen = true" class="btn btn-trade">거래</button>
          <button v-if="!isEditMode && !isQuickTradeOpen && selectedAsset" @click="isTrackingOpen = true" class="btn btn-tracking">추적</button>
          <button v-if="!isEditMode && !isQuickTradeOpen" @click="toggleEditMode" class="btn btn-edit">수정</button>
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
          <button v-if="returnModalType === 'confirm'" @click="confirmReturn" class="btn btn-confirm" :disabled="loading">
            {{ loading ? '처리 중...' : '확인' }}
          </button>
          <button v-if="returnModalType === 'confirm'" @click="closeReturnModal" class="btn btn-cancel">취소</button>
          <button v-if="returnModalType === 'success' || returnModalType === 'error'" @click="closeReturnModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <div v-if="assets.length > 0" class="assets-section">
      <div class="assets-header-actions">
        <h2>자산 목록 ({{ filteredAssets.length }}개)</h2>
        <div class="filter-actions">
          <button @click="activeFilter = activeFilter === 'available' ? null : 'available'" :class="{ active: activeFilter === 'available' }" class="btn btn-filter">가용재고</button>
          <button @click="activeFilter = activeFilter === 'rent' ? null : 'rent'" :class="{ active: activeFilter === 'rent' }" class="btn btn-filter">대여중</button>
          <button @click="activeFilter = activeFilter === 'repair' ? null : 'repair'" :class="{ active: activeFilter === 'repair' }" class="btn btn-filter">수리중</button>
          <button @click="downloadTSV" class="btn btn-csv">
            <img src="/images/down.png" alt="download" class="btn-icon" />
            tsv
          </button>
        </div>
      </div>
      
      <div class="search-container">
        <input v-model="searchQuery" type="text" placeholder="검색..." class="search-input" />
        <button v-if="searchQuery" @click="searchQuery = ''" class="clear-btn">✕</button>
      </div>
      
      <div v-if="searchQuery" class="search-result"> 검색 결과: {{ filteredAssets.length }}개 </div>
      
      <div class="table-wrapper">
        <table class="assets-table">
          <thead>
            <tr>
              <th v-for="key in getTableHeaders(assets)" :key="key" @click="handleSort(key)" class="sortable-header" :class="{ active: sortColumn === key }">
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

.assets-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  box-sizing: border-box;
}

.assets-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.filter-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

h2 {
  color: #555;
  margin: 0;
  font-size: 20px;
}

.btn-filter {
  background: #999;
  color: white;
}

.btn-filter:hover { background: #888; }
.btn-filter.active { background: #666; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2); }

.btn-tracking { background: #777; color: white; }
.btn-tracking:hover { background: #555; }

.btn-action-small {
  transform: scale(0.85);
  font-size: 12px;
  padding: 8px 12px;
}

.btn-return-process { background: #6b8e6f; color: white; }
.btn-returned { background: #6c757d; color: white; cursor: not-allowed; }

.expiration-badge {
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
}

.expire-warning-60 { background-color: #fff9c4; color: #856404; font-weight: bold; }
.expire-warning-30 { background-color: #ffe0b2; color: #e65100; font-weight: bold; }
.expire-passed { background-color: #f8bbd0; color: #c2185b; font-weight: bold; }

.return-modal { max-width: 500px; }
.return-message { font-size: 16px; line-height: 1.6; color: #333; text-align: center; padding: 20px 0; }

.btn-confirm { background: #27ae60; color: white; padding: 10px 24px; }
.btn-confirm:hover:not(:disabled) { background: #229954; }

/* 퀵 거래 등록 스타일 */
.btn-trade { background: var(--brand-blue); color: white; }
.btn-trade:hover {
  background: var(--brand-blue-dark);
 }

.btn-csv {
  background: var(--brand-blue);
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
}

.btn-csv:hover { background: #4a6d8d; }

.btn-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* 흰색으로 변경 */
}

.quick-trade-section {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 2px dashed #eee;
}

.quick-trade-section h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.quick-trade-section h3::before {
  content: '📝';
}

.quick-trade-form {
  background: #fdfdfd;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.form-row {
  display: flex;
  gap: 15px;
}

.flex-1 { flex: 1; }
.mt-15 { margin-top: 15px; }

.fixed-user-display {
  height: 40px;
  padding: 0 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  font-size: 13px;
  color: #666;
  display: flex;
  align-items: center;
}

.quick-trade-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.alert-small {
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 10px;
  border-radius: 4px;
}

/* 복사 버튼 스타일 */
.copy-btn-small {
  background: transparent;
  border: none;
  border-radius: 4px;
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
  filter: brightness(0); /* 검은색으로 변경 */
}

.check-mark-black {
  color: #333;
  font-size: 16px;
  font-weight: bold;
}
</style>
