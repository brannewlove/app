<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import userApi from '../api/users';
import { useTable } from '../composables/useTable';
import TablePagination from '../components/TablePagination.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import { getTimestampFilename } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';

const users = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedUser = ref(null);

// 임시 사용자 모달 상태
const isTempUserModalOpen = ref(false);
const tempUserName = ref('');
const tempUserCount = ref(0);
const showOnlyTempUsers = ref(false);
const isTempUserListModalOpen = ref(false); // 임시 사용자 목록 모달
const modalError = ref(null); // 모달 내부 에러 메시지

// 임시 사용자 필터링을 위한 computed
const displayedUsers = computed(() => {
  if (showOnlyTempUsers.value) {
    return users.value.filter(u => u.is_temporary);
  }
  return users.value;
});

const {
  currentPage,
  searchQuery,
  filteredData: filteredUsers,
  paginatedData: paginatedUsers,
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
} = useTable(displayedUsers, {
  itemsPerPage: 20
});

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedUser = ref(null);
const isClickStartedOnOverlay = ref(false);

// 컨펌 모달 상태
const isConfirmModalOpen = ref(false);
const confirmMessage = ref('');
const confirmCallback = ref(null);

const showConfirm = (message, callback) => {
  confirmMessage.value = message;
  confirmCallback.value = callback;
  isConfirmModalOpen.value = true;
};

const handleConfirmYes = () => {
  if (confirmCallback.value) {
    confirmCallback.value();
  }
  isConfirmModalOpen.value = false;
  confirmCallback.value = null;
};

// 테이블 헤더 가져오기 (user_id, password, google_id, is_temporary 제외)
const getTableHeaders = (data) => {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter(key => !['user_id', 'password', 'google_id', 'is_temporary'].includes(key));
};

// 컬럼 라벨 매핑
const columnLabels = {
  'cj_id': 'CJ ID',
  'name': '사용자명',
  'part': '부서',
  'sec_level': '보안등급',
  'state': '상태',
  'is_temporary': '임시사용자',
};

// 모든 사용자 조회
const fetchUsers = async () => {
  loading.value = true;
  error.value = null;
  selectedUser.value = null;
  currentPage.value = 1;
  
  try {
    users.value = await userApi.getUsers();
    await fetchTempUserCount();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 임시 사용자 수 조회
const fetchTempUserCount = async () => {
  try {
    const result = await userApi.getTempUserCount();
    tempUserCount.value = result.count;
  } catch (err) {
    console.error('Failed to fetch temp user count:', err);
  }
};

// 특정 사용자 조회
const fetchUserById = async (id) => {
  loading.value = true;
  error.value = null;
  
  try {
    const data = await userApi.getUserById(id);
    selectedUser.value = data;
    editedUser.value = JSON.parse(JSON.stringify(data)); // 깊은 복사
    isModalOpen.value = true;
    isEditMode.value = false;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 행 클릭 핸들러
const handleRowClick = (user) => {
  if (user.user_id) {
    fetchUserById(user.user_id);
  } else {
    error.value = 'User ID를 찾을 수 없습니다.';
  }
};

// 모달 닫기
const closeModal = () => {
  isModalOpen.value = false;
  isEditMode.value = false;
  selectedUser.value = null;
  editedUser.value = null;
  isClickStartedOnOverlay.value = false;
};

const handleOverlayMouseDown = (e) => {
  isClickStartedOnOverlay.value = e.target.classList.contains('modal-overlay');
};

const handleOverlayMouseUp = (e, closeFn) => {
  if (isClickStartedOnOverlay.value && e.target.classList.contains('modal-overlay')) {
    closeFn();
  }
  isClickStartedOnOverlay.value = false;
};

// 수정 모드 토글
const toggleEditMode = () => {
  if (isEditMode.value) {
    // 수정 취소
    editedUser.value = JSON.parse(JSON.stringify(selectedUser.value));
    isEditMode.value = false;
  } else {
    // 수정 시작
    isEditMode.value = true;
  }
};

// 사용자 정보 저장
const saveUser = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    await userApi.updateUser(editedUser.value.user_id, editedUser.value);
    
    selectedUser.value = JSON.parse(JSON.stringify(editedUser.value));
    
    // 테이블의 사용자도 업데이트
    const userIndex = users.value.findIndex(u => u.user_id === editedUser.value.user_id);
    if (userIndex !== -1) {
      users.value[userIndex] = JSON.parse(JSON.stringify(editedUser.value));
    }
    
    isEditMode.value = false;
    error.value = null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 임시 사용자 등록 모달 열기
const openTempUserModal = () => {
  tempUserName.value = '';
  isTempUserModalOpen.value = true;
};

// 임시 사용자 등록 모달 닫기
const closeTempUserModal = () => {
  isTempUserModalOpen.value = false;
  tempUserName.value = '';
};

// 임시 사용자 생성
const createTempUser = async () => {
  if (!tempUserName.value.trim()) {
    error.value = '이름을 입력해주세요.';
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    
    await userApi.createTemporaryUser(tempUserName.value.trim());
    await fetchUsers();
    closeTempUserModal();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 모달 내에서 임시 사용자 생성 (목록 새로고침)
const createTempUserInline = async () => {
  if (!tempUserName.value.trim()) {
    error.value = '이름을 입력해주세요.';
    return;
  }

  try {
    loading.value = true;
    modalError.value = null;
    
    await userApi.createTemporaryUser(tempUserName.value.trim());
    await fetchUsers();
    tempUserName.value = ''; // 입력 필드 초기화
  } catch (err) {
    modalError.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 임시 사용자 정식 전환
const finalizeUser = async () => {
  if (!editedUser.value.cj_id || !editedUser.value.cj_id.trim()) {
    error.value = 'CJ ID를 입력해주세요.';
    return;
  }

  try {
    loading.value = true;
    error.value = null;
    
    await userApi.finalizeUser(editedUser.value.user_id, {
      cj_id: editedUser.value.cj_id.trim(),
      part: editedUser.value.part ? editedUser.value.part.trim() : null
    });
    
    await fetchUsers();
    closeModal();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 임시 사용자 목록 모달 열기
const openTempUserListModal = () => {
  isTempUserListModalOpen.value = true;
};

// 임시 사용자 목록 모달 닫기
const closeTempUserListModal = () => {
  isTempUserListModalOpen.value = false;
  modalError.value = null;
  tempUserName.value = '';
};

// 임시 사용자 목록에서 선택하여 편집
const editTempUser = async (user) => {
  closeTempUserListModal();
  
  // 사용자 정보 로드
  try {
    loading.value = true;
    error.value = null;
    
    const data = await userApi.getUserById(user.user_id);
    selectedUser.value = data;
    editedUser.value = JSON.parse(JSON.stringify(data)); // 깊은 복사
    isModalOpen.value = true;
    isEditMode.value = true; // 바로 수정 모드로 열기
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 임시 사용자 삭제
const deleteTempUser = async (user, event) => {
  // 이벤트 전파 중지 (클릭 이벤트가 편집 모달을 열지 않도록)
  event.stopPropagation();

  showConfirm(`"${user.name}" 사용자를 삭제하시겠습니까?`, async () => {
    try {
      loading.value = true;
      modalError.value = null;
      
      await userApi.deleteUser(user.user_id);
      await fetchUsers();
    } catch (err) {
      modalError.value = err.message;
    } finally {
      loading.value = false;
    }
  });
};

// 임시 사용자 필터 토글 (사용 안 함)
const filterTempUsers = () => {
  openTempUserListModal();
};

// CSV 다운로드
const downloadCSV = () => {
  if (users.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  const filename = getTimestampFilename('UsersPage');
  
  // CSV 헤더 생성
  const headers = getTableHeaders(users.value);
  const headerRow = headers.map(h => columnLabels[h] || h);
  
  // 데이터 행 생성
  const dataRows = users.value.map(user => 
    headers.map(header => user[header])
  );
  
  downloadCSVFile(filename, headerRow, dataRows);
};


// 컴포넌트 마운트 시 사용자 목록 조회
onMounted(() => {
  fetchUsers();
  // ESC 키로 모달 닫기
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      if (isModalOpen.value) closeModal();
      if (isTempUserModalOpen.value) closeTempUserModal();
      if (isTempUserListModalOpen.value) closeTempUserListModal();
      if (isConfirmModalOpen.value) isConfirmModalOpen.value = false;
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
  <div class="page-content">
    <h1>사용자 관리</h1>
    
    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="loading" class="alert alert-info">
      <img src="/images/hour-glass.png" alt="loading" class="loading-icon" /> 로딩 중...
    </div>
    
    <!-- 임시 사용자 관리 통합 모달 -->
    <div v-if="isTempUserListModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp($event, closeTempUserListModal)">
      <div class="modal-content temp-user-list-modal">
        <div class="modal-header">
          <h2>임시 사용자 관리</h2>
          <button @click="closeTempUserListModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <!-- 모달 내부 메시지 -->
          <div v-if="modalError" class="alert alert-error modal-alert">
            ❌ {{ modalError }}
          </div>

          <!-- 임시 사용자 추가 폼 -->
          <div class="add-temp-user-form">
            <h3>새 임시 사용자 추가</h3>
            <div class="form-group-inline">
              <input 
                v-model="tempUserName" 
                type="text" 
                class="form-input" 
                placeholder="사용자 이름 입력"
                @keyup.enter="createTempUserInline"
              />
              <button @click="createTempUserInline" class="btn btn-save" :disabled="loading">추가</button>
            </div>
          </div>
          
          <hr class="divider" />
          
          <!-- 임시 사용자 목록 -->
          <h3>임시 사용자 목록</h3>
          <div v-if="users.filter(u => u.is_temporary).length === 0" class="empty-state">
            임시 사용자가 없습니다.
          </div>
          <div v-else class="temp-user-list">
            <div 
              v-for="user in users.filter(u => u.is_temporary)" 
              :key="user.user_id" 
              class="temp-user-item"
              @click="editTempUser(user)"
            >
              <div class="user-info">
                <div class="user-name">{{ user.name }}</div>
                <div class="user-cjid">{{ user.cj_id }}</div>
              </div>
              <div class="item-actions">
                <button @click="deleteTempUser(user, $event)" class="btn-icon-delete" title="삭제">
                  <img src="/images/del.png" alt="삭제" class="del-btn-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeTempUserListModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <!-- 사용자 상세 모달 -->
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp($event, closeModal)">
      <div class="modal-content">
        <div class="modal-header">
          <h2>
            사용자 정보
            <span v-if="selectedUser?.is_temporary" class="temp-badge">임시</span>
          </h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedUser" class="form-grid">
            <div v-for="(value, key) in selectedUser" :key="key" v-show="!['user_id', 'password', 'google_id', 'is_temporary'].includes(key)" class="form-group">
              <label>{{ columnLabels[key] || key }}</label>
              <input 
                v-if="isEditMode"
                v-model="editedUser[key]"
                type="text"
                class="form-input"
                :disabled="key === 'user_id' || (key === 'cj_id' && !selectedUser.is_temporary)"
                :placeholder="key === 'cj_id' && !value ? '미정' : ''"
              />
              <div v-else class="form-value">
                {{ value || (key === 'cj_id' ? '미정' : '') }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="selectedUser?.is_temporary && isEditMode" @click="finalizeUser" class="btn btn-primary">정식 전환</button>
          <button v-if="!isEditMode" @click="toggleEditMode" class="btn btn-edit">수정</button>
          <button v-if="isEditMode" @click="saveUser" class="btn btn-save">저장</button>
          <button v-if="isEditMode" @click="toggleEditMode" class="btn btn-cancel">취소</button>
          <button @click="closeModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <ConfirmationModal 
      :is-open="isConfirmModalOpen"
      :message="confirmMessage"
      @confirm="handleConfirmYes"
      @cancel="isConfirmModalOpen = false"
    />
    
    <div v-if="users.length > 0" class="users-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>사용자 목록 ({{ filteredUsers.length }}명)</h2>
        <div style="display: flex; gap: 10px;">
          <!-- 임시 사용자 관리 통합 버튼 -->
          <button @click="openTempUserListModal" class="btn btn-temp-tracker">
            임시 사용자 관리 {{ tempUserCount > 0 ? `(${tempUserCount})` : '' }}
          </button>
          <button @click="downloadCSV" class="btn btn-csv">
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
        검색 결과: {{ filteredUsers.length }}명
      </div>
      
      <div class="table-wrapper">
        <table class="users-table">
          <thead>
            <tr>
              <th v-for="key in getTableHeaders(users)" :key="key" @click="handleSort(key)"
                class="sortable-header" :class="{ active: isManualSort && sortColumn === key }">
                <div class="header-content">
                  <span>{{ columnLabels[key] || key }}</span>
                  <span class="sort-icon">{{ getSortIcon(key) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(user, index) in paginatedUsers" :key="user.user_id"
              @click="handleRowClick(user)"
              :class="{ 'stripe': index % 2 === 1, active: selectedUser?.user_id === user.user_id, 'temp-user-row': user.is_temporary }"
              class="clickable-row">
              <td v-for="key in getTableHeaders(users)" :key="key">
                <span v-if="key === 'cj_id' && !user[key]" class="text-muted">미정</span>
                <span v-else-if="key === 'is_temporary'">
                  <span v-if="user[key]" class="temp-badge-small">임시</span>
                </span>
                <span v-else>{{ user[key] }}</span>
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
    
    <div v-else-if="!loading" class="empty-state">
      사용자가 없습니다.
    </div>
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

.users-section {
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
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 임시 사용자 배지 */
.temp-badge {
  display: inline-block;
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.temp-badge-small {
  display: inline-block;
  background: #ff9800;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

/* 임시 사용자 행 스타일 */
.temp-user-row {
  background-color: #fff3e0 !important;
}

.temp-user-row:hover {
  background-color: #ffe0b2 !important;
}

/* 임시 사용자 추가 버튼 */
.btn-add-temp {
  background: #ff9800;
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 15px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-add-temp:hover {
  background: #f57c00;
}

/* TSV 버튼 스타일 */
.btn-csv {
  background: var(--brand-blue);
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 15px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
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

.loading-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}

/* 임시 사용자 모달 */
.temp-user-modal {
  max-width: 400px;
}

.help-text {
  margin-top: 10px;
  font-size: 13px;
  color: #666;
}

.required {
  color: #ff4d4f;
}

.text-muted {
  color: #999;
  font-style: italic;
}

/* 정식 전환 버튼 */
.btn-primary {
  background: #52c41a;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: #389e0d;
}

/* 임시 사용자 추적 버튼 (컴팩트) */
.btn-temp-tracker {
  background: #794A8D;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-temp-tracker:hover {
  background: #603a70;
}

.btn-temp-tracker.active {
  background: #4caf50;
}

.btn-temp-tracker.active:hover {
  background: #388e3c;
}

.btn-temp-tracker .icon {
  font-size: 16px;
}

/* 임시 사용자 목록 모달 */
.temp-user-list-modal {
  max-width: 500px;
}

.temp-user-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

.temp-user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  background: white;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.2s;
}

.temp-user-item:last-child {
  border-bottom: none;
}

.temp-user-item:hover {
  background: #fff3e0;
}

.temp-user-item .user-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 15px;
}

.temp-user-item .user-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  min-width: 100px;
}

.temp-user-item .user-cjid {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

.temp-user-item .item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-icon-delete {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  opacity: 0.6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon-delete:hover {
  background: #ffebee;
  opacity: 1;
}

.del-btn-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

/* 임시 사용자 추가 폼 (모달 내) */
.add-temp-user-form {
  margin-bottom: 20px;
}

.add-temp-user-form h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.form-group-inline {
  display: flex;
  gap: 10px;
}

.form-group-inline .form-input {
  flex: 1;
}

.divider {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 20px 0;
}

.temp-user-list-modal h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

/* 모달 내부 알림 스타일 */
.modal-alert {
  margin-top: 0;
  margin-bottom: 15px;
  padding: 10px 15px;
  font-size: 14px;
}
</style>