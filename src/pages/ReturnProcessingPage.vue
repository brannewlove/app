<template>
  <div class="page-content">
    <h1>반납 처리 관리</h1>
    <div v-if="loading" class="alert alert-info"><img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...</div>
    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>

    <div class="assets-section">
      <div class="section-header">
        <h2>반납 처리 목록 ({{ filteredReturnedAssets.length }}개)</h2>
        <div class="header-actions">
          <button @click="openExportModal" class="btn btn-header btn-export">
            반납메일 Export ({{ exportAssets.length }})
          </button>
          <button @click="downloadCSV" class="btn btn-header btn-csv">
            <img src="/images/down.png" alt="download" class="btn-icon" />
            csv
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
              <td :class="{ 'status-checked': asset.release_status }">
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
              <img v-if="!isCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
              <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
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
          <button @click="closeExportModal" class="btn btn-modal btn-close">닫기</button>
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
          <button v-if="modalType === 'confirm'" @click="confirmAction" class="btn btn-modal btn-save" :disabled="pendingAsset?.processing">
            {{ pendingAsset?.processing ? '처리 중...' : '확인' }}
          </button>
          <button v-if="modalType === 'confirm'" @click="closeModal" class="btn btn-modal btn-cancel" :disabled="pendingAsset?.processing"> 취소 </button>
          <button v-if="modalType === 'success' || modalType === 'error'" @click="closeModal" class="btn btn-modal btn-close"> 닫기 </button>
        </div>
      </div>
    </div>

    <!-- 처리 선택 모달 개선 -->
    <div v-if="isActionChoiceModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeActionChoiceModal)">
      <div class="modal-content" style="max-width: 550px;">
        <div class="modal-header">
          <h2>자산 반납 처리</h2>
          <button @click="closeActionChoiceModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body" style="padding: 25px;">
          <div class="asset-summary-box">
            <p><strong>자산번호:</strong> <span class="bold-text">{{ selectedAssetForAction?.asset_number }}</span></p>
            <p><strong>사용자:</strong> {{ selectedAssetForAction?.user_name }} ({{ selectedAssetForAction?.user_id }})</p>
            <p><strong>반납사유:</strong> {{ selectedAssetForAction?.return_reason || '-' }}</p>
          </div>

          <div class="process-form-group">
            <label>작업 유형 선택</label>
            <WorkTypeSearch 
              :initial-value="tradeForm.work_type"
              placeholder="작업 유형을 검색/선택하세요"
              :filter-fn="workTypeFilter"
              @select="handleWorkTypeSelect"
            />
          </div>

          <div v-if="tradeForm.work_type" class="process-form-group mt-15">
            <label>CJ ID (보유자 변경)</label>
            <div v-if="isCjIdDisabled(tradeForm.work_type)" class="fixed-val">
              {{ getFixedCjIdDisplay(tradeForm.work_type) }}
            </div>
            <AutocompleteSearch 
              v-else
              :initial-value="tradeForm.cj_name || tradeForm.cj_id"
              placeholder="이름/ID 검색"
              api-table="users"
              api-column="cj_id"
              @select="(item) => {
                tradeForm.cj_id = String(item.cj_id || '');
                tradeForm.cj_name = String(item.name || '');
              }"
            />
          </div>

          <div class="process-form-group mt-15">
            <label>메모</label>
            <input v-model="tradeForm.memo" type="text" class="inline-input" placeholder="거래 메모 입력..." />
          </div>

          <div v-if="tradeForm.work_type === '반납-고장교체'" class="process-form-group mt-15">
            <label>교체 자산번호 (본체에 기록됨)</label>
            <AutocompleteSearch 
              :initial-value="tradeForm.replacement_asset"
              placeholder="교체될 자산번호 검색"
              api-table="assets"
              api-column="asset_number"
              @select="(val) => tradeForm.replacement_asset = val.asset_number"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button @click="submitTradeAction" class="btn btn-modal btn-save" :disabled="!tradeForm.work_type || loading">
            {{ loading ? '처리 중...' : '확인 및 거래 등록' }}
          </button>
          <button @click="closeActionChoiceModal" class="btn btn-modal btn-cancel">취소</button>
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
          <button @click="confirmReplacement" class="btn btn-modal btn-save" :disabled="!replacementAssetNumber">확인</button>
          <button @click="closeReplacementModal" class="btn btn-modal btn-cancel">취소</button>
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
import WorkTypeSearch from '../components/WorkTypeSearch.vue';
import { getTimestampFilename, formatDateTime } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';
import { 
  isCjIdDisabled, 
  getFixedCjId, 
  getFixedCjIdDisplay, 
  requiresReplacementAsset 
} from '../constants/workTypes';

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
const isReplacementModalOpen = ref(false); // 기존 고장교체 전용 모달 (유지하되 거의 안 쓰게 될 수 있음)
const selectedAssetForAction = ref(null);

// 새로운 거래 폼 데이터
const tradeForm = ref({
  work_type: '',
  cj_id: '',
  cj_name: '',
  memo: '',
  replacement_asset: ''
});

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
  // 기존 반납 사유 및 비고를 기본 메모로 설정
  const memoParts = [];
  if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
  if (asset.remarks) memoParts.push(`[비고: ${asset.remarks}]`);

  tradeForm.value = {
    work_type: '',
    cj_id: '',
    cj_name: '',
    memo: memoParts.join(' '),
    replacement_asset: ''
  };
  isActionChoiceModalOpen.value = true;
};

const closeActionChoiceModal = () => {
  isActionChoiceModalOpen.value = false;
  selectedAssetForAction.value = null;
};

// ... (existing imports, but remove axios import duplicate if present, otherwise ignore)

// ... (existing imports, but remove axios import duplicate if present, otherwise ignore)

// 작업 유형 필터 (입고 및 반납 관련만 표시)
const workTypeFilter = (wt) => {
  return wt.category === '입고' || wt.category === '반납';
};

const handleWorkTypeSelect = (item) => {
  tradeForm.value.work_type = item.work_type;
  
  if (isCjIdDisabled(item.work_type)) {
    const fixedId = getFixedCjId(item.work_type);
    if (fixedId === 'no-change') {
       tradeForm.value.cj_id = selectedAssetForAction.value?.user_id || '';
    } else {
       tradeForm.value.cj_id = fixedId;
    }
  }
};

const submitTradeAction = async () => {
  const asset = selectedAssetForAction.value;
  if (!asset || !tradeForm.value.work_type) return;

  loading.value = true;
  try {
    // 1. 거래 데이터 구성
    const tradeData = {
      work_type: tradeForm.value.work_type,
      asset_number: asset.asset_number,
      cj_id: tradeForm.value.cj_id,
      ex_user: asset.user_id,
      memo: tradeForm.value.memo || null,
      asset_state: 'useable', // 반납 프로세스로 들어오기 전의 일반적인 상태
      asset_in_user: asset.user_id,
      asset_memo: asset.asset_memo
    };

    // 2. 거래 등록 API 호출
    await axios.post('/api/trades', [tradeData]);

    // 3. 고장교체인 경우 자산 정보의 replacement 필드 업데이트
    // requiresReplacementAsset(tradeForm.value.work_type) 사용
    if (requiresReplacementAsset(tradeForm.value.work_type) && tradeForm.value.replacement_asset) {
      if (asset.asset_id) {
        await axios.put(`/api/assets/${asset.asset_id}`, { replacement: tradeForm.value.replacement_asset });
      }
    }

    // 4. 반납 대기 목록에서 삭제
    await returnedAssetsApi.deleteReturnedAsset(asset.return_id);

    // 5. 로컬 목록에서 제거 및 종료
    removeAssetFromList(asset.return_id);
    closeActionChoiceModal();
    showModal('처리가 성공적으로 완료되었습니다.', 'success');
  } catch (err) {
    showModal(`처리 중 오류 발생: ${err.message}`, 'error');
  } finally {
    loading.value = false;
  }
};

const confirmAction = async () => {
  const asset = pendingAsset.value;
  if (!asset) return;
  asset.processing = true;
  
  try {
    if (modalAction.value === 'complete') {
      const memoParts = [];
      if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
      if (asset.remarks) memoParts.push(`[비고: ${asset.remarks}]`);
      const tradeData = [{
        work_type: '반납',
        asset_number: asset.asset_number,
        cj_id: 'aj_rent',
        ex_user: asset.user_id,
        memo: memoParts.length > 0 ? memoParts.join(' ') : null,
        asset_state: 'useable',
        asset_in_user: asset.user_id,
        asset_memo: asset.asset_memo
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

// formatDateTime is now imported

const isEndDateExpired = (endDate) => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return end < today;
};

const downloadCSV = () => {
    if (returnedAssets.value.length === 0) {
        alert('다운로드할 데이터가 없습니다.');
        return;
    }
    
    const filename = getTimestampFilename('ReturnProcessing');

    const csvHeaders = [
        '반납유형', '종료일', '모델', '자산번호', '반납사유', 
        '사용자ID', '사용자명', '부서', '인계일', 
        '출고여부', '전산실입고', '로우포맷', '전산반납', '메일반납', '실재반납',
        '비고', '생성일'
    ];

    const csvData = returnedAssets.value.map(asset => [
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

    downloadCSVFile(filename, csvHeaders, csvData);
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
.assets-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.returns-table {
  width: 100%;
  min-width: 1400px;
  border-collapse: separate;
  border-spacing: 0;
}

.warning-highlight { 
  background-color: #fff3cd !important; 
  color: #856404 !important; 
}

.expired-date {
  color: var(--confirm-color) !important;
  font-weight: 700;
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
  border-radius: var(--radius-sm);
  font-size: 13px;
  background-color: white;
}

.status-checked {
  background-color: #556B2F !important;
  color: white;
}

.status-checked input:not([type="checkbox"]) {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border-color: rgba(255, 255, 255, 0.3);
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.btn-action {
  padding: 6px 10px;
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.2s;
}

.btn-process { background: var(--brand-blue); }
.btn-cancel-return { background: var(--text-muted); }

.btn-action:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.btn-action:disabled { background: var(--border-color); cursor: not-allowed; }

.vertical-header { height: 100px; padding: 10px 5px !important; text-align: center !important; }
.vertical-header div { writing-mode: vertical-rl; white-space: nowrap; margin: 0 auto; }

.export-modal { max-width: 700px; }
.export-desc { color: var(--text-muted); margin-bottom: 15px; }

.export-data-table { border-collapse: collapse; border: 1px solid var(--text-main); font-size: 12px; }
.export-data-table th, .export-data-table td { border: 1px solid var(--text-main); padding: 8px; }
.export-data-table th { background: var(--bg-muted); color: var(--text-main); }

input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.asset-summary-box {
  background-color: var(--bg-muted);
  border: 1px solid var(--border-light);
  padding: 15px;
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}

.process-form-group {
  margin-bottom: 20px;
}

.process-form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-muted);
}

.fixed-val {
  padding: 10px 12px;
  background-color: var(--bg-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 14px;
  color: var(--text-muted);
}

.bold-text {
  font-weight: 700;
  color: var(--text-main);
}

.header-copy-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.2s;
  border-radius: var(--radius-sm);
}

.header-copy-btn:hover:not(:disabled) {
  background: var(--bg-muted);
}
</style>
