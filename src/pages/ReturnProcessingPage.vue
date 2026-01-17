<template>
  <div class="page-content">
    <div v-if="loading" class="alert alert-info">⏳ 로딩 중...</div>
    <div v-if="error" class="alert alert-error">❌ {{ error }}</div>

    <div class="assets-section">
      <div class="section-header">
        <h2>반납 처리 목록 ({{ returnedAssets.length }}개)</h2>
        <div class="header-actions">
          <button @click="openExportModal" class="btn btn-export">
            반납메일 Export ({{ exportAssets.length }})
          </button>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="assets-table">
          <thead>
            <tr>
              <th>반납유형</th>
              <th>모델</th>
              <th>자산번호</th>
              <th>반납사유</th>
              <th>종료일</th>
              <th>사용자ID</th>
              <th>사용자명</th>
              <th>부서</th>
              <th>인계일</th>
              <th class="vertical-header"><div>출고여부</div></th>
              <th class="vertical-header"><div>전산실입고</div></th>
              <th class="vertical-header"><div>로우포맷</div></th>
              <th class="vertical-header"><div>전산반납</div></th>
              <th class="vertical-header"><div>메일반납</div></th>
              <th class="vertical-header"><div>실재반납</div></th>
              <th>비고</th>
              <th>생성일</th>
              <th class="actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(asset, index) in returnedAssets" :key="asset.return_id" 
                :class="{ 'stripe': index % 2 === 1, 'highlight-row': shouldHighlight(asset.handover_date) }">
              <td>
                <input type="text" v-model="asset.return_type" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="유형" />
              </td>
              <td :title="asset.model" class="truncate">{{ asset.model }}</td>
              <td>{{ asset.asset_number }}</td>
              <td>
                <input type="text" v-model="asset.return_reason" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="사유" />
              </td>
              <td>{{ asset.end_date }}</td>
              <td>{{ asset.user_id }}</td>
              <td>{{ asset.user_name }}</td>
              <td :title="asset.department" class="truncate">{{ asset.department }}</td>
              <td>
                <input type="date" v-model="asset.handover_date" @change="updateReturnedAsset(asset)" class="inline-input" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.release_status" @change="handleReleaseStatusChange(asset)" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.it_room_stock" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.low_format" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.it_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.mail_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td class="center">
                <input type="checkbox" v-model="asset.actual_return" @change="updateReturnedAsset(asset)" />
              </td>
              <td>
                <input type="text" v-model="asset.remarks" @change="updateReturnedAsset(asset)" class="inline-input" placeholder="비고" />
              </td>
              <td>{{ formatDateTime(asset.created_at) }}</td>
              <td class="action-cell">
                <div class="action-buttons">
                  <button 
                    @click="completeReturn(asset)" 
                    class="btn-complete"
                    :disabled="asset.processing"
                    title="반납 완료 (aj_rent로 반납)"
                  >
                    {{ asset.processing ? '...' : '반납' }}
                  </button>
                  <button 
                    @click="reuseAsset(asset)" 
                    class="btn-reuse"
                    :disabled="asset.processing"
                    title="재사용 (사내 재고로 입고됩니다)"
                  >
                    {{ asset.processing ? '...' : '재사용' }}
                  </button>
                  <button 
                    @click="cancelReturn(asset)" 
                    class="btn-cancel-return"
                    :disabled="asset.processing"
                    title="반납 취소 (사용 가능 상태로 복구)"
                  >
                    {{ asset.processing ? '...' : '취소' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="returnedAssets.length === 0">
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
          <h2>반납 메일 추출</h2>
          <button @click="closeExportModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <p class="export-desc">전산반납(O), 메일반납(X)인 자산입니다.</p>
          
          <div v-if="exportAssets.length > 0" class="export-table-container">
            <table 
              id="exportTable" 
              style="width: auto; border-collapse: collapse; border: 1px solid #333; font-family: sans-serif; font-size: 12px; white-space: nowrap;"
            >
              <thead>
                <tr style="background-color: #eeeeee;">
                  <th style="border: 1px solid #333; padding: 8px; font-weight: bold; text-align: center;">반납유형</th>
                  <th style="border: 1px solid #333; padding: 8px; font-weight: bold; text-align: center;">자산번호</th>
                  <th style="border: 1px solid #333; padding: 8px; font-weight: bold; text-align: center;">반납사유</th>
                  <th style="border: 1px solid #333; padding: 8px; font-weight: bold; text-align: center;">비고</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in exportAssets" :key="asset.return_id">
                  <td style="border: 1px solid #333; padding: 8px; text-align: left;">{{ asset.return_type }}</td>
                  <td style="border: 1px solid #333; padding: 8px; text-align: center;">{{ asset.asset_number }}</td>
                  <td style="border: 1px solid #333; padding: 8px; text-align: left;">{{ asset.return_reason }}</td>
                  <td style="border: 1px solid #333; padding: 8px; text-align: left;">{{ asset.remarks }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty-export">
            추출할 자산이 없습니다.
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="exportAssets.length > 0" @click="copyTable" class="btn btn-copy">전체 복사</button>
          <button @click="closeExportModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>

    <!-- 액션 확인 및 알림 모달 -->
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="e => handleOverlayMouseUp(e, closeModal)">
      <div class="modal-content action-modal">
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
          <button 
            v-if="modalType === 'confirm'" 
            @click="confirmAction" 
            class="btn btn-confirm"
            :disabled="pendingAsset?.processing"
          >
            {{ pendingAsset?.processing ? '처리 중...' : '확인' }}
          </button>
          <button 
            v-if="modalType === 'confirm'" 
            @click="closeModal" 
            class="btn btn-cancel"
            :disabled="pendingAsset?.processing"
          >
            취소
          </button>
          <button 
            v-if="modalType === 'success' || modalType === 'error'" 
            @click="closeModal" 
            class="btn btn-close"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'ReturnProcessingPage',
  data() {
    return {
      returnedAssets: [],
      loading: false,
      error: null,
      // 모달 상태 추가
      isModalOpen: false,
      modalMessage: '',
      modalType: 'confirm', // 'confirm', 'success', 'error'
      modalAction: null,    // 'complete', 'reuse', 'cancel'
      pendingAsset: null,
      // Export 모달 상태
      isExportModalOpen: false,
      isClickStartedOnOverlay: false,
    };
  },
  computed: {
    exportAssets() {
      // 전산반납(it_return)은 되어있고, 메일반납(mail_return)은 안되어있는 자산 필터링
      return this.returnedAssets.filter(asset => asset.it_return && !asset.mail_return);
    }
  },
  created() {
    this.fetchReturnedAssets();
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeyDown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (this.isModalOpen) {
          this.closeModal();
        } else if (this.isExportModalOpen) {
          this.closeExportModal();
        }
      }
    },
    async fetchReturnedAssets() {
      this.loading = true;
      try {
        const response = await axios.get('/api/returned-assets');
        this.returnedAssets = response.data.data.map(asset => ({
          ...asset,
          release_status: !!asset.release_status,
          it_room_stock: !!asset.it_room_stock,
          low_format: !!asset.low_format,
          it_return: !!asset.it_return,
          mail_return: !!asset.mail_return,
          actual_return: !!asset.actual_return,
          processing: false, // 처리 중 상태 추가
          // Ensure date fields are in 'YYYY-MM-DD' format for date input type
          handover_date: asset.handover_date ? new Date(asset.handover_date).toISOString().split('T')[0] : null,
          end_date: asset.end_date ? new Date(asset.end_date).toISOString().split('T')[0] : null,
        }));
      } catch (err) {
        this.error = '반납 자산 정보를 가져오는 데 실패했습니다: ' + err.message;
        console.error('Error fetching returned assets:', err);
      } finally {
        this.loading = false;
      }
    },
    async completeReturn(asset) {
      this.pendingAsset = asset;
      this.modalAction = 'complete';
      this.modalMessage = `'${asset.asset_number}' 자산의 반납을 완료하시겠습니까?`;
      this.modalType = 'confirm';
      this.isModalOpen = true;
    },
    async reuseAsset(asset) {
      this.pendingAsset = asset;
      this.modalAction = 'reuse';
      this.modalMessage = `'${asset.asset_number}' 자산을 재사용 처리하시겠습니까? (사내 재고로 입고됩니다)`;
      this.modalType = 'confirm';
      this.isModalOpen = true;
    },
    async cancelReturn(asset) {
      this.pendingAsset = asset;
      this.modalAction = 'cancel';
      this.modalMessage = `'${asset.asset_number}' 자산의 반납 처리를 취소하시겠습니까? (이전 상태로 복구됩니다)`;
      this.modalType = 'confirm';
      this.isModalOpen = true;
    },
    async confirmAction() {
      const asset = this.pendingAsset;
      if (!asset) return;

      asset.processing = true;
      
      try {
        if (this.modalAction === 'complete') {
          // 1. 거래 등록 API에 "반납" 작업유형으로 데이터 전송
          const memoParts = [];
          if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
          if (asset.remarks) memoParts.push(asset.remarks);
          
          const tradeData = [{
            work_type: '반납',
            asset_id: asset.asset_number,
            cj_id: 'aj_rent',
            ex_user: asset.user_id,
            memo: memoParts.length > 0 ? memoParts.join(' ') : null
          }];

          const tradeResponse = await axios.post('/api/trades', tradeData);
          if (!tradeResponse.data.success) throw new Error('거래 등록에 실패했습니다.');

          // 2. returned_assets 테이블에서 삭제
          const deleteResponse = await axios.delete(`/api/returned-assets/${asset.return_id}`);
          if (!deleteResponse.data.success) throw new Error('반납 자산 삭제에 실패했습니다.');

          // 3. 로컬 상태 업데이트
          this.removeAssetFromList(asset.return_id);
          
          this.showModal('반납이 완료되었습니다.', 'success');

        } else if (this.modalAction === 'reuse') {
          // 1. 거래 등록 API에 "입고-재사용" 작업유형으로 데이터 전송
          const memoParts = ['[반납후재사용]'];
          if (asset.return_reason) memoParts.push(`[사유: ${asset.return_reason}]`);
          if (asset.remarks) memoParts.push(asset.remarks);

          const tradeData = [{
            work_type: '입고-재사용',
            asset_id: asset.asset_number,
            cj_id: 'cjenc_inno',
            ex_user: asset.user_id,
            memo: memoParts.join(' ')
          }];

          const tradeResponse = await axios.post('/api/trades', tradeData);
          if (!tradeResponse.data.success) throw new Error('거래 등록에 실패했습니다.');

          // 2. returned_assets 테이블에서 삭제
          const deleteResponse = await axios.delete(`/api/returned-assets/${asset.return_id}`);
          if (!deleteResponse.data.success) throw new Error('반납 자산 삭제에 실패했습니다.');

          // 3. 로컬 상태 업데이트
          this.removeAssetFromList(asset.return_id);
          
          this.showModal('재사용 처리가 완료되었습니다. (사내 재고로 입고됨)', 'success');

        } else if (this.modalAction === 'cancel') {
          // 백엔드 반납 취소 API 호출
          const response = await axios.post(`/api/returned-assets/cancel/${asset.return_id}`);
          if (!response.data.success) throw new Error('반납 취소에 실패했습니다.');

          // 로컬 상태 업데이트
          this.removeAssetFromList(asset.return_id);
          
          this.showModal('반납 처리가 취소되었습니다. (자산 상태 복구됨)', 'success');
        }
      } catch (err) {
        const errorMsg = (err.response?.data?.error || err.message);
        this.showModal(`${this.getActionName()}에 실패했습니다: ${errorMsg}`, 'error');
        console.error(`Error during ${this.modalAction}:`, err);
      } finally {
        asset.processing = false;
      }
    },
    removeAssetFromList(returnId) {
      const index = this.returnedAssets.findIndex(a => a.return_id === returnId);
      if (index !== -1) {
        this.returnedAssets.splice(index, 1);
      }
    },
    showModal(message, type) {
      this.modalMessage = message;
      this.modalType = type;
      this.isModalOpen = true;
    },
    closeModal() {
      this.isModalOpen = false;
      this.pendingAsset = null;
      this.modalAction = null;
      this.isClickStartedOnOverlay = false;
    },
    handleOverlayMouseDown(e) {
      this.isClickStartedOnOverlay = e.target === e.currentTarget;
    },
    handleOverlayMouseUp(e, targetCloseFunc) {
      if (this.isClickStartedOnOverlay && e.target === e.currentTarget) {
        targetCloseFunc();
      }
      this.isClickStartedOnOverlay = false;
    },
    getActionName() {
      const names = {
        complete: '반납 완료 처리',
        reuse: '재사용 처리',
        cancel: '반납 취소 처리'
      };
      return names[this.modalAction] || '처리';
    },
    openExportModal() {
      this.isExportModalOpen = true;
    },
    closeExportModal() {
      this.isExportModalOpen = false;
      this.isClickStartedOnOverlay = false;
    },
    async copyTable() {
      const el = document.getElementById('exportTable');
      if (!el) return;

      try {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        
        const success = document.execCommand('copy');
        window.getSelection().removeAllRanges();
        
        if (!success) {
          throw new Error('복사 실패');
        }
      } catch (err) {
        console.error('Copy failed:', err);
      }
    },
    async updateReturnedAsset(asset) {
      try {
        await axios.put(`/api/returned-assets/${asset.return_id}`, asset);
        // Optionally, show a success message or refetch data
        console.log('Asset updated:', asset);
      } catch (err) {
        this.error = '반납 자산 정보를 업데이트하는 데 실패했습니다: ' + err.message;
        console.error('Error updating returned asset:', err);
      }
    },
    handleReleaseStatusChange(asset) {
      if (asset.release_status) {
        // 출고여부 체크 시 현재 날짜를 인계일로 설정
        asset.handover_date = new Date().toISOString().split('T')[0];
      }
      this.updateReturnedAsset(asset);
    },
    shouldHighlight(handoverDate) {
      if (!handoverDate) return false;
      const handover = new Date(handoverDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison

      const diffTime = Math.abs(today.getTime() - handover.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays >= 14 && handover.getTime() < today.getTime(); // Highlight if 14+ days old and in the past
    },
    formatDateTime(datetime) {
      if (!datetime) return '';
      const date = new Date(datetime);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
  }
};
</script>

<style scoped>
.page-content {
  display: block;
  padding: 20px;
}

.assets-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.05);
  padding: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
  font-weight: 700;
}

.alert {
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-weight: 500;
}

.alert-info {
  background: #e3f2fd;
  color: #1976d2;
}

.alert-error {
  background: #ffebee;
  color: #c62828;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.assets-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  background: white;
}

.assets-table thead {
  background: #4a4a4a;
  color: white;
}

.assets-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 14px;
  border-bottom: 2px solid #333;
}

.assets-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  color: #444;
  vertical-align: middle;
}

.assets-table tbody tr {
  transition: all 0.2s ease;
}

.assets-table tbody tr.stripe {
  background: #f0f0f0;
}

.assets-table tbody tr:hover {
  background: #e5e5e5;
  box-shadow: inset 0 0 0 1px #d0d0d0;
}

.highlight-row {
  background-color: #fff3cd !important; /* Warning highlighting */
}

.truncate {
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.center {
  text-align: center !important;
}

.assets-table td input[type="checkbox"] {
  transform: scale(1.5);
  cursor: pointer;
  margin: 0;
}

.inline-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.inline-input:focus {
  border-color: #3498db;
  outline: none;
}

.empty-state {
  text-align: center;
  padding: 40px !important;
  color: #999;
  font-size: 16px;
}

.btn-complete {
  background: #A52A2A;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-complete:hover:not(:disabled) {
  background: #8B0000;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(165, 42, 42, 0.3);
}

.btn-reuse {
  background: #4682B4;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-reuse:hover:not(:disabled) {
  background: #36648B;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(70, 130, 180, 0.3);
}

.btn-cancel-return {
  background: #556B2F;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-cancel-return:hover:not(:disabled) {
  background: #3B4A20;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(85, 107, 47, 0.3);
}

.btn-export {
  background: #794A8D;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-export:hover {
  background: #633d74;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(121, 74, 141, 0.3);
}

.btn-copy {
  background: #535c68;
  color: white;
}

.btn-copy:hover {
  background: #30336b;
}

.btn-complete:disabled, .btn-reuse:disabled, .btn-cancel-return:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.action-cell {
  padding: 0 12px !important;
  vertical-align: middle !important;
  min-width: 180px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  height: 100%;
  min-height: 40px; /* 최소 높이 확보 */
}

/* 세로 헤더 스타일 */
.vertical-header {
  height: 100px;
  padding: 10px 5px !important;
  vertical-align: middle !important;
  text-align: center !important;
}

.vertical-header div {
  writing-mode: vertical-rl;
  white-space: nowrap;
  margin: 0 auto;
}

/* 모달 스타일 유지 및 보강 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: white;
  padding: 0;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: modalIn 0.3s ease;
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.export-modal {
  max-width: 700px;
}

.export-desc {
  margin-top: 0;
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 20px;
  background: #f1f2f6;
  padding: 10px 15px;
  border-radius: 6px;
  border-left: 4px solid #6c5ce7;
}

.export-table-container {
  max-height: 400px;
  overflow-y: auto;
  padding: 5px;
}

.empty-export {
  padding: 60px 0;
  text-align: center;
  color: #999;
  font-size: 1.1rem;
}

.modal-header {
  padding: 20px 24px;
  background: #f8f9fa;
  border-bottom: 2px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.4rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #eee;
}

.modal-body {
  padding: 30px 24px;
}

.modal-message {
  margin: 0;
  line-height: 1.6;
  font-size: 1.15rem;
  color: #444;
  text-align: center;
}

.modal-footer {
  padding: 20px 24px;
  background: #f8f9fa;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  font-size: 14px;
}

.btn-confirm {
  background: #535c68;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #2d3436;
  /* Removed transform */
}

.btn-cancel {
  background: #bdc3c7;
  color: #333;
}

.btn-cancel:hover {
  background: #95a5a6;
}

.btn-close {
  background: #95a5a6;
  color: white;
}

.btn-close:hover {
  background: #7f8c8d;
}

</style>
