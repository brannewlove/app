<template>
  <div class="page-content">
    <h1>반납 처리 관리</h1>
    <div v-if="loading" class="alert alert-info">⏳ 로딩 중...</div>
    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>

    <div class="assets-section">
      <div class="section-header">
        <h2>반납 처리 목록 ({{ filteredReturnedAssets.length }}개)</h2>
        <div class="header-actions">
          <button @click="openExportModal" class="btn btn-export">
            반납메일 Export ({{ exportAssets.length }})
          </button>
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

      <div v-if="searchQuery" class="search-result">
        검색 결과: {{ filteredReturnedAssets.length }}개
      </div>

      <div class="table-wrapper">
        <table class="returns-table">
          <thead>
            <tr>
              <th @click="handleSort('return_type')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'return_type' }">
                <div class="header-content"><span>반납유형</span><span class="sort-icon">{{ getSortIcon('return_type') }}</span></div>
              </th>
              <th @click="handleSort('end_date')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'end_date' }">
                <div class="header-content"><span>종료일</span><span class="sort-icon">{{ getSortIcon('end_date') }}</span></div>
              </th>
              <th @click="handleSort('model')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'model' }">
                <div class="header-content"><span>모델</span><span class="sort-icon">{{ getSortIcon('model') }}</span></div>
              </th>
              <th @click="handleSort('asset_number')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'asset_number' }">
                <div class="header-content"><span>자산번호</span><span class="sort-icon">{{ getSortIcon('asset_number') }}</span></div>
              </th>
              <th @click="handleSort('return_reason')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'return_reason' }">
                <div class="header-content"><span>반납사유</span><span class="sort-icon">{{ getSortIcon('return_reason') }}</span></div>
              </th>
              <th @click="handleSort('user_name')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'user_name' }">
                <div class="header-content"><span>사용자 정보</span><span class="sort-icon">{{ getSortIcon('user_name') }}</span></div>
              </th>
              <th @click="handleSort('handover_date')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'handover_date' }">
                <div class="header-content"><span>인계일</span><span class="sort-icon">{{ getSortIcon('handover_date') }}</span></div>
              </th>
              <th class="vertical-header"><div>출고여부</div></th>
              <th class="vertical-header"><div>전산실입고</div></th>
              <th class="vertical-header"><div>로우포맷</div></th>
              <th class="vertical-header"><div>전산반납</div></th>
              <th class="vertical-header"><div>메일반납</div></th>
              <th class="vertical-header"><div>실재반납</div></th>
              <th @click="handleSort('remarks')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'remarks' }">
                <div class="header-content"><span>비고</span><span class="sort-icon">{{ getSortIcon('remarks') }}</span></div>
              </th>
              <th @click="handleSort('created_at')" class="sortable-header" :class="{ active: isManualSort && sortColumn === 'created_at' }">
                <div class="header-content"><span>생성일</span><span class="sort-icon">{{ getSortIcon('created_at') }}</span></div>
              </th>
              <th class="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(asset, index) in filteredReturnedAssets" :key="asset.return_id" 
                :class="{ 'stripe': index % 2 === 1 }">
              <td>
                <input type="text" v-model="asset.return_type" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="유형" />
              </td>
              <td>
                <span :class="{ 'expired-date': isEndDateExpired(asset.end_date) }">{{ asset.end_date }}</span>
              </td>
              <td :title="asset.model" class="truncate">{{ asset.model }}</td>
              <td>{{ asset.asset_number }}</td>
              <td>
                <input type="text" v-model="asset.return_reason" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="사유" />
              </td>
              <td>
                <div style="line-height: 1.4;">
                  <strong>{{ asset.user_name || '-' }}</strong> ({{ asset.user_id || '-' }})
                  <div style="font-size: 0.85em; color: #666;">{{ asset.department || '-' }}</div>
                </div>
              </td>
              <td>
                <input type="date" v-model="asset.handover_date" @change="updateReturnedAsset(asset)" 
                       :class="['inline-input', { 'warning-highlight': shouldHighlight(asset.handover_date) }]" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.release_status }">
                <input type="checkbox" v-model="asset.release_status" @change="handleReleaseStatusChange(asset)" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.it_room_stock }">
                <input type="checkbox" v-model="asset.it_room_stock" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.low_format }">
                <input type="checkbox" v-model="asset.low_format" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.it_return }">
                <input type="checkbox" v-model="asset.it_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.mail_return }">
                <input type="checkbox" v-model="asset.mail_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center" :class="{ 'status-checked': asset.actual_return }">
                <input type="checkbox" v-model="asset.actual_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td>
                <input type="text" v-model="asset.remarks" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="비고" />
              </td>
              <td>{{ formatDateTime(asset.created_at) }}</td>
              <td class="action-cell">
                <div class="action-buttons">
                  <button @click="openActionChoiceModal(asset)" class="btn-action btn-process" :disabled="asset.processing" title="처리 선택">
                    처리
                  </button>
                  <button @click="cancelReturn(asset)" class="btn-action btn-cancel-return" :disabled="asset.processing" title="취소">
                    취소
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredReturnedAssets.length === 0">
                <td colspan="18" class="empty-state">반납된 자산이 없습니다.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- 반납메일 Export 모달 -->
    <div v-if="isExportModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeExportModal)">
      <div class="modal-content export-modal">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 15px;">
            <h2>반납 메일 추출</h2>
            <button 
              class="header-copy-btn" 
              @click="copyToClipboard" 
              :title="isCopied ? '복사 완료!' : '클립보드 복사'"
              :disabled="exportAssets.length === 0"
            >
              <img v-if="!isCopied" src="/images/clipboard.png" alt="copy" style="width: 20px; height: 20px; object-fit: contain;" />
              <span v-else style="color: #27ae60; font-size: 14px; font-weight: bold;">✓</span>
            </button>
          </div>
          <button @click="closeExportModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <p class="export-desc">렌탈사 반납요청메일 필요 건.</p>
          
          <div v-if="exportAssets.length > 0" class="export-table-container">
            <table class="export-data-table">
              <thead>
                <tr>
                  <th>반납유형</th>
                  <th>자산번호</th>
                  <th>반납사유</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in exportAssets" :key="asset.return_id">
                  <td>{{ asset.return_type }}</td>
                  <td>{{ asset.asset_number }}</td>
                  <td>{{ asset.return_reason }}</td>
                  <td>{{ asset.remarks }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-export"> 추출할 자산이 없습니다. </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeExportModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>

    <!-- 액션 확인 및 알림 모달 -->
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeModal)">
      <div class="modal-content">
        <div class="modal-header">
          <h2>
            <span v-if="modalType === 'confirm'">확인</span>
            <span v-else-if="modalType === 'success'">완료</span>
            <span v-else>오류</span>
          </h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <p class="modal-message">{{ modalMessage }}</p>
        </div>
        
        <div class="modal-footer">
          <button v-if="modalType === 'confirm'" @click="confirmAction" class="btn btn-save" :disabled="pendingAsset?.processing">
            {{ pendingAsset?.processing ? '처리 중...' : '확인' }}
          </button>
          <button v-if="modalType === 'confirm'" @click="closeModal" class="btn btn-cancel" :disabled="pendingAsset?.processing"> 취소 </button>
          <button v-if="modalType === 'success' || modalType === 'error'" @click="closeModal" class="btn btn-close"> 닫기 </button>
        </div>
      </div>
    </div>

    <!-- 처리 선택 모달 추가 -->
    <div v-if="isActionChoiceModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeActionChoiceModal)">
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2>처리 선택</h2>
          <button @click="closeActionChoiceModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body" style="text-align: center; padding: 30px 20px;">
          <p style="margin-bottom: 25px; font-weight: 500; font-size: 16px;">
            '{{ selectedAssetForAction?.asset_number }}' 자산에 대해 어떤 처리를 원하십니까?
          </p>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button @click="handleActionChoice('complete')" class="btn btn-confirm" style="background: var(--confirm-color); width: 100%;">반납 완료 (렌탈사 반납)</button>
            <button @click="handleActionChoice('replacement')" class="btn btn-confirm" style="background: var(--confirm-color); width: 100%;">고장교체 처리 (렌탈사 교체)</button>
            <button @click="handleActionChoice('reuse')" class="btn btn-confirm" style="background: var(--brand-blue); width: 100%;">재사용 처리 (사내 재고)</button>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeActionChoiceModal" class="btn btn-close">취소 (Escape)</button>
        </div>
      </div>
    </div>

    <!-- 고장교체 자산 입력 모달 추가 -->
    <div v-if="isReplacementModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeReplacementModal)">
      <div class="modal-content" style="max-width: 450px;">
        <div class="modal-header">
          <h2>교체 자산 입력</h2>
          <button @click="closeReplacementModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body" style="padding: 25px;">
          <p style="margin-bottom: 15px; font-weight: 500;">'{{ selectedAssetForAction?.asset_number }}'를 교체할 자산번호를 입력하세요.</p>
          <div class="form-group">
            <label>교체 자산번호</label>
            <AutocompleteSearch 
              id="replacement-asset"
              apiTable="assets"
              apiColumn="asset_number"
              placeholder="자산번호 검색..."
              @select="(val) => replacementAssetNumber = val.asset_number"
              :initialValue="replacementAssetNumber"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="confirmReplacement" class="btn btn-save" :disabled="!replacementAssetNumber">확인</button>
          <button @click="closeReplacementModal" class="btn btn-cancel">취소</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import returnedAssetsApi from '../api/returnedAssets';
import axios from 'axios';
import { useTable } from '../composables/useTable';
import AutocompleteSearch from '../components/AutocompleteSearch.vue';

const returnedAssets = ref([]);
const loading = ref(false);
const error = ref(null);

const isModalOpen = ref(false);
const modalMessage = ref('');
const modalType = ref('confirm'); // 'confirm', 'success', 'error'
const modalAction = ref(null);    // 'complete', 'reuse', 'cancel', 'replacement'
const pendingAsset = ref(null);

const isExportModalOpen = ref(false);
const isCopied = ref(false);
const isClickStartedOnOverlay = ref(false);

const isActionChoiceModalOpen = ref(false);
const isReplacementModalOpen = ref(false);
const selectedAssetForAction = ref(null);
const replacementAssetNumber = ref('');

const {
  filteredData: filteredReturnedAssets,
  handleSort,
  getSortIcon,
  sortColumn,
  sortDirection,
  isManualSort,
  searchQuery
} = useTable(returnedAssets, {
  itemsPerPage: 1000,
  initialSortColumn: 'handover_date',
  initialSortDirection: 'desc',
  nullsFirst: true,
  stableSort: true
});

const exportAssets = computed(() => {
  return returnedAssets.value
    .filter(asset => asset.it_return && !asset.mail_return)
    .sort((a, b) => {
      const typeA = a.return_type || '';
      const typeB = b.return_type || '';
      return typeA.localeCompare(typeB);
    });
});

const fetchReturnedAssets = async () => {
  loading.value = true;
  try {
    // 확실한 캐시 무력화
    const data = await returnedAssetsApi.getReturnedAssets(`?t=${new Date().getTime()}`);
    returnedAssets.value = data.map(asset => ({
      ...asset,
      release_status: !!asset.release_status,
      it_room_stock: !!asset.it_room_stock,
      low_format: !!asset.low_format,
      it_return: !!asset.it_return,
      mail_return: !!asset.mail_return,
      actual_return: !!asset.actual_return,
      processing: false,
      handover_date: asset.handover_date ? asset.handover_date.split('T')[0] : null,
      end_date: asset.end_date ? asset.end_date.split('T')[0] : null,
    }));
  } catch (err) {
    error.value = '반납 자산 정보를 가져오는 데 실패했습니다: ' + err.message;
  } finally {
    loading.value = false;
  }
};

const updateReturnedAsset = async (asset) => {
  if (asset.processing) return;
  
  asset.processing = true;
  try {
    await returnedAssetsApi.updateReturnedAsset(asset.return_id, asset);
    // 업데이트 성공 후 최신 데이터를 다시 불러와서 화면 동기화
    const freshData = await returnedAssetsApi.getReturnedAssets(`?t=${Date.now()}`);
    const updatedItem = freshData.find(d => d.return_id === asset.return_id);
    if (updatedItem) {
      // 해당 자산의 정보만 최신으로 교체
      Object.assign(asset, {
        ...updatedItem,
        release_status: !!updatedItem.release_status,
        it_room_stock: !!updatedItem.it_room_stock,
        low_format: !!updatedItem.low_format,
        it_return: !!updatedItem.it_return,
        mail_return: !!updatedItem.mail_return,
        actual_return: !!updatedItem.actual_return,
        processing: false,
        handover_date: updatedItem.handover_date ? updatedItem.handover_date.substring(0, 10) : null,
        end_date: updatedItem.end_date ? updatedItem.end_date.substring(0, 10) : null,
      });
    }
  } catch (err) {
    error.value = '반납 자산 정보를 업데이트하는 데 실패했습니다: ' + err.message;
  } finally {
    asset.processing = false;
  }
};

const completeReturn = (asset) => {
  pendingAsset.value = asset;
  modalAction.value = 'complete';
  modalMessage.value = `'${asset.asset_number}' 자산의 반납을 완료하시겠습니까?`;
  modalType.value = 'confirm';
  isModalOpen.value = true;
};

const reuseAsset = (asset) => {
  pendingAsset.value = asset;
  modalAction.value = 'reuse';
  modalMessage.value = `'${asset.asset_number}' 자산을 재사용 처리하시겠습니까? (사내 재고로 입고됩니다)`;
  modalType.value = 'confirm';
  isModalOpen.value = true;
};

const cancelReturn = (asset) => {
  pendingAsset.value = asset;
  modalAction.value = 'cancel';
  modalMessage.value = `'${asset.asset_number}' 자산의 반납 처리를 취소하시겠습니까? (이전 상태로 복구됩니다)`;
  modalType.value = 'confirm';
  isModalOpen.value = true;
};

// 처리 선택 모달 열기
const openActionChoiceModal = (asset) => {
  selectedAssetForAction.value = asset;
  isActionChoiceModalOpen.value = true;
};

const closeActionChoiceModal = () => {
  isActionChoiceModalOpen.value = false;
  selectedAssetForAction.value = null;
  isClickStartedOnOverlay.value = false;
};

const handleActionChoice = (choice) => {
  const asset = selectedAssetForAction.value;
  // Choice modal은 닫고 다음 단계로 이동
  closeActionChoiceModal();
  
  if (choice === 'complete') {
    completeReturn(asset);
  } else if (choice === 'reuse') {
    reuseAsset(asset);
  } else if (choice === 'replacement') {
    openReplacementModal(asset);
  }
};

const openReplacementModal = (asset) => {
  selectedAssetForAction.value = asset;
  replacementAssetNumber.value = '';
  isReplacementModalOpen.value = true;
};

const closeReplacementModal = () => {
  isReplacementModalOpen.value = false;
  selectedAssetForAction.value = null;
  replacementAssetNumber.value = '';
};

const confirmReplacement = () => {
  if (!replacementAssetNumber.value) return;
  pendingAsset.value = selectedAssetForAction.value;
  modalAction.value = 'replacement';
  modalMessage.value = `'${pendingAsset.value.asset_number}' 자산을 '${replacementAssetNumber.value}' 자산으로 고장교체 처리하시겠습니까?`;
  modalType.value = 'confirm';
  isReplacementModalOpen.value = false;
  isModalOpen.value = true;
};

const confirmAction = async () => {
  const asset = pendingAsset.value;
  if (!asset) return;
  asset.processing = true;
  
  try {
    if (modalAction.value === 'complete') {
      const memoParts = [];
      if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
      if (asset.remarks) memoParts.push(asset.remarks);
      const tradeData = [{
        work_type: '반납',
        asset_number: asset.asset_number,
        cj_id: 'aj_rent',
        ex_user: asset.user_id,
        memo: memoParts.length > 0 ? memoParts.join(' ') : null
      }];
      await axios.post('/api/trades', tradeData);
      await returnedAssetsApi.deleteReturnedAsset(asset.return_id);
      removeAssetFromList(asset.return_id);
      showModal('반납이 완료되었습니다.', 'success');
    } else if (modalAction.value === 'reuse') {
      const memoParts = ['[반납후재사용]'];
      if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
      if (asset.remarks) memoParts.push(asset.remarks);
      const tradeData = [{
        work_type: '입고-재사용',
        asset_number: asset.asset_number,
        cj_id: 'cjenc_inno',
        ex_user: asset.user_id,
        memo: memoParts.join(' ')
      }];
      await axios.post('/api/trades', tradeData);
      await returnedAssetsApi.deleteReturnedAsset(asset.return_id);
      removeAssetFromList(asset.return_id);
      showModal('재사용 처리가 완료되었습니다.', 'success');
    } else if (modalAction.value === 'replacement') {
      const memoParts = [`[교체자산: ${replacementAssetNumber.value}]`];
      if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
      if (asset.remarks) memoParts.push(asset.remarks);
      
      const tradeData = [{
        work_type: '반납-고장교체',
        asset_number: asset.asset_number,
        cj_id: 'aj_rent',
        ex_user: asset.user_id,
        memo: memoParts.join(' ')
      }];
      
      // 1. 거래 내역 생성
      await axios.post('/api/trades', tradeData);
      
      // 2. 본 자산에 교체 자산 정보 기록 (replacement 컬럼 업데이트)
      // asset.asset_id 를 찾아서 업데이트해야 하므로 returnedAsset 정보에 asset_id가 있는지 확인 필요
      // fetch 시점에 asset_id가 포함되어 있음
      if (asset.asset_id) {
          await axios.put(`/api/assets/${asset.asset_id}`, { replacement: replacementAssetNumber.value });
      }
      
      // 3. 반납 대기 목록에서 삭제
      await returnedAssetsApi.deleteReturnedAsset(asset.return_id);
      removeAssetFromList(asset.return_id);
      showModal('고장교체 처리가 완료되었습니다.', 'success');
    } else if (modalAction.value === 'cancel') {
      await returnedAssetsApi.cancelReturnedAsset(asset.return_id);
      removeAssetFromList(asset.return_id);
      showModal('반납 처리가 취소되었습니다.', 'success');
    }
  } catch (err) {
    showModal(`처리에 실패했습니다: ${err.message}`, 'error');
  } finally {
    asset.processing = false;
  }
};

const removeAssetFromList = (returnId) => {
  const index = returnedAssets.value.findIndex(a => a.return_id === returnId);
  if (index !== -1) returnedAssets.value.splice(index, 1);
};

const showModal = (message, type) => {
  modalMessage.value = message;
  modalType.value = type;
  isModalOpen.value = true;
};

const closeModal = () => {
  const needsRefresh = modalType.value === 'success';
  isModalOpen.value = false;
  pendingAsset.value = null;
  modalAction.value = null;
  isClickStartedOnOverlay.value = false;
  
  if (needsRefresh) {
    fetchReturnedAssets();
  }
};

const handleOverlayMouseDown = (e) => {
  isClickStartedOnOverlay.value = e.target === e.currentTarget;
};

const handleOverlayMouseUp = (e, targetCloseFunc) => {
  if (isClickStartedOnOverlay.value && e.target === e.currentTarget) targetCloseFunc();
  isClickStartedOnOverlay.value = false;
};

const openExportModal = () => { isExportModalOpen.value = true; };
const closeExportModal = () => { 
  isExportModalOpen.value = false; 
  isClickStartedOnOverlay.value = false;
  isCopied.value = false; // 모달 닫을 때 상태 초기화
};

const copyToClipboard = () => {
  const dataToCopy = exportAssets.value;
  if (dataToCopy.length === 0) return;

  const headers = ['반납유형', '자산번호', '반납사유', '비고'];
  
  // HTML 버전 (요청하신 스타일 적용: 1px 검정 테두리, 회색 헤더 배경, 폰트 12px)
  const htmlTable = `
    <table border="1" cellspacing="0" cellpadding="8" style="border-collapse: collapse; font-size: 12px; font-family: sans-serif; border: 1px solid #000000; width: 100%;">
      <thead>
        <tr style="background-color: #bbbbbb;">
          ${headers.map(h => `<th bgcolor="#bbbbbb" style="border: 1px solid #000000; padding: 10px; text-align: left; background-color: #bbbbbb; color: #000000; font-weight: bold;">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${dataToCopy.map(asset => `
          <tr style="color: #000000;">
            <td style="border: 1px solid #000000; padding: 8px;">${asset.return_type || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.asset_number || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.return_reason || ''}</td>
            <td style="border: 1px solid #000000; padding: 8px;">${asset.remarks || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // 텍스트 버전 (Fallback)
  const plainText = [
    headers.join('\t'),
    ...dataToCopy.map(asset => [
      asset.return_type || '',
      asset.asset_number || '',
      asset.return_reason || '',
      asset.remarks || ''
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

const handleReleaseStatusChange = (asset) => {
  if (asset.release_status) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    asset.handover_date = `${year}-${month}-${day}`;
  } else {
    asset.handover_date = null;
  }
  updateReturnedAsset(asset);
};

const shouldHighlight = (handoverDate) => {
  if (!handoverDate) return false;
  const handover = new Date(handoverDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil(Math.abs(today.getTime() - handover.getTime()) / (1000 * 60 * 60 * 24)) >= 14 && handover.getTime() < today.getTime();
};

const formatDateTime = (datetime) => {
  if (!datetime) return '';
  const date = new Date(datetime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const isEndDateExpired = (endDate) => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
};

const downloadTSV = () => {
    if (returnedAssets.value.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
    }

    const tsvHeaders = [
        '반납유형', '종료일', '모델', '자산번호', '반납사유', 
        '사용자ID', '사용자명', '부서', '인계일', 
        '출고여부', '전산실입고', '로우포맷', '전산반납', '메일반납', '실재반납',
        '비고', '생성일'
    ];

    const tsvData = returnedAssets.value.map(asset => [
        asset.return_type || '',
        asset.end_date || '',
        asset.model || '',
        asset.asset_number || '',
        asset.return_reason || '',
        asset.user_id || '',
        asset.user_name || '',
        asset.department || '',
        asset.handover_date || '',
        asset.release_status ? 'O' : 'X',
        asset.it_room_stock ? 'O' : 'X',
        asset.low_format ? 'O' : 'X',
        asset.it_return ? 'O' : 'X',
        asset.mail_return ? 'O' : 'X',
        asset.actual_return ? 'O' : 'X',
        asset.remarks || '',
        formatDateTime(asset.created_at)
    ]);

    const tsvContent = [
        tsvHeaders.join('\t'),
        ...tsvData.map(row => row.map(val => String(val).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:T]/g, '_').split('.')[0];
    link.href = url;
    link.setAttribute('download', `ReturnProcessing_${timestamp}.tsv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    if (isModalOpen.value) closeModal();
    else if (isExportModalOpen.value) closeExportModal();
    else if (isActionChoiceModalOpen.value) closeActionChoiceModal();
    else if (isReplacementModalOpen.value) closeReplacementModal();
  }
};

onMounted(() => {
  fetchReturnedAssets();
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

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

.assets-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.table-wrapper {
  overflow-x: visible; /* sticky 작동을 위해 visible로 변경하거나 height 고정 필요 */
  width: 100%;
  margin-top: 10px;
}

.btn-export { 
  background: #556B2F; 
  color: white; 
  border: none; 
  padding: 8px 15px; 
  border-radius: 4px; 
  cursor: pointer; 
  font-size: 14px; 
  font-weight: 600; 
  transition: background 0.2s; 
  display: flex;
  align-items: center;
  justify-content: center;
}
.btn-export:hover { background: #33401C; }

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

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

/* TSV 버튼 스타일 */
.btn-csv {
  background: var(--brand-blue);
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.btn-csv:hover {
  background: #4a6d8d;
}

.btn-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* 흰색으로 변경 */
}

.returns-table {
  width: 100%;
  min-width: 1400px; /* 모든 컬럼이 보이도록 최소 너비 설정 */
  border-collapse: separate;
  border-spacing: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h2 {
  margin: 0;
  font-size: 20px;
  color: #555;
}

.warning-highlight { 
  background-color: #fff3cd !important; 
  color: #856404 !important; 
  font-weight: bold;
}

.expired-date {
  background: linear-gradient(180deg, transparent 40%, #ffeaea 40%) !important;
  color: #ff4444 !important;
  font-weight: bold;
  padding: 0 2px;
}
.truncate {
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.center { text-align: center !important; }

.inline-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 13px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.btn-action {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 52px; /* 텍스트 변경시에도 크기 유지 */
}

.btn-complete { background: var(--confirm-color); }
.btn-reuse { background: var(--brand-blue); }
.btn-process { background: var(--brand-blue); } /* 처리 버튼 색상 */
.btn-cancel-return { background: #556B2F; }

.btn-action:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.btn-action:disabled { background: var(--border-color); cursor: not-allowed; }

.vertical-header { height: 100px; padding: 10px 5px !important; text-align: center !important; }
.vertical-header div { writing-mode: vertical-rl; white-space: nowrap; margin: 0 auto; }

.export-modal { max-width: 700px; }
.export-desc { color: #666; margin-bottom: 15px; }
.export-table-container { max-height: 400px; overflow-y: auto; }

.export-data-table { width: auto; border-collapse: collapse; border: 1px solid #333; font-size: 12px; }
.export-data-table th, .export-data-table td { border: 1px solid #333; padding: 8px; }
.export-data-table th { background: #eee; color: #333; text-align: center; }
.export-data-table td { text-align: left; }

.btn-copy { background: #535c68; color: white; }

input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.expired-date {
  color: #ff4444 !important;
  font-weight: bold;
}

.status-checked {
  background-color: #e6ffed !important; /* 연한 녹색 배경 */
  border-bottom-color: #b7eb8f !important;
}
</style>
