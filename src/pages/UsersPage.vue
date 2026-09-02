<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import userApi from '../api/users';
import { useTable } from '../composables/useTable';
import TablePagination from '../components/TablePagination.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import { getTimestampFilename } from '../utils/dateUtils';
import { downloadCSVFile } from '../utils/exportUtils';
import { copyToClipboard } from '../utils/clipboardUtils';

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

// 임시 사용자 테이블 인라인 수정을 위한 상태 변수
const localTempUsers = ref([]);
const selectedTempUserIds = ref([]);
const isAllTempUsersSelected = computed({
  get() {
    const tempUsers = localTempUsers.value;
    if (tempUsers.length === 0) return false;
    return tempUsers.every(u => selectedTempUserIds.value.includes(u.user_id));
  },
  set(value) {
    if (value) {
      selectedTempUserIds.value = localTempUsers.value.map(u => u.user_id);
    } else {
      selectedTempUserIds.value = [];
    }
  }
});

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

const router = useRouter();
const isCjIdCopied = ref(false);

const goToUserAssets = () => {
  if (selectedUser.value?.cj_id) {
    router.push({ path: '/assets', query: { q: selectedUser.value.cj_id } });
  } else {
    alert('CJ ID가 없는 사용자입니다.');
  }
};

const copyCjId = async (cjId) => {
  if (!cjId) return;
  const success = await copyToClipboard(cjId);
  if (success) {
    isCjIdCopied.value = true;
    setTimeout(() => isCjIdCopied.value = false, 2000);
  }
};

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
  return Object.keys(data[0]).filter(key => !['user_id', 'password', 'google_id', 'is_temporary', 'asset_counts'].includes(key));
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
    
    const dataToUpdate = { ...editedUser.value };
    delete dataToUpdate.asset_counts; // DB 컬럼이 아니므로 제외

    await userApi.updateUser(editedUser.value.user_id, dataToUpdate);
    
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
  localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)));
  selectedTempUserIds.value = [];
  isTempUserListModalOpen.value = true;
};

// 임시 사용자 목록 모달 닫기
const closeTempUserListModal = () => {
  isTempUserListModalOpen.value = false;
  modalError.value = null;
  tempUserName.value = '';
  localTempUsers.value = [];
  selectedTempUserIds.value = [];
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

// 임시 사용자 개별 삭제
const deleteTempUser = async (user, event) => {
  if (event) event.stopPropagation();

  showConfirm(`"${user.name || '새 사용자'}" 사용자를 삭제하시겠습니까?`, async () => {
    try {
      loading.value = true;
      modalError.value = null;
      
      if (user.is_new) {
        // DB에 없으므로 로컬에서만 삭제
        localTempUsers.value = localTempUsers.value.filter(u => u.user_id !== user.user_id);
        selectedTempUserIds.value = selectedTempUserIds.value.filter(id => id !== user.user_id);
      } else {
        await userApi.deleteUser(user.user_id);
        await fetchUsers();
        localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)));
        selectedTempUserIds.value = selectedTempUserIds.value.filter(id => id !== user.user_id);
      }
    } catch (err) {
      modalError.value = err.message;
    } finally {
      loading.value = false;
    }
  });
};

// 신규 임시 사용자 행 추가
const addTempUserRow = () => {
  localTempUsers.value.push({
    user_id: 'new_' + Date.now(), // 로컬 전용 가상 ID
    name: '',
    cj_id: '',
    part: '',
    is_new: true,
    is_temporary: true
  });
};

// 임시 사용자 한 명 저장 (로직 캡슐화)
const saveSingleTempUser = async (user) => {
  if (!user.name || !user.name.trim()) {
    throw new Error('이름은 필수 입력 항목입니다.');
  }

  if (user.is_new) {
    // 1. 임시 사용자 생성
    const result = await userApi.createTemporaryUser(user.name.trim());
    const newUserId = result.user_id;

    // 2. 부서 정보가 입력된 경우 추가 업데이트
    if (user.part) {
      await userApi.updateUser(newUserId, {
        name: user.name.trim(),
        part: user.part ? user.part.trim() : null
      });
    }
  } else {
    // 기존 사용자 업데이트
    await userApi.updateUser(user.user_id, {
      name: user.name.trim(),
      part: user.part ? user.part.trim() : null
    });
  }
};

// 임시 사용자 개별 저장 (인라인 저장 버튼용)
const saveTempUserInline = async (user) => {
  if (!user.name || !user.name.trim()) {
    modalError.value = '이름을 입력해주세요.';
    return;
  }

  loading.value = true;
  modalError.value = null;

  try {
    await saveSingleTempUser(user);
    await fetchUsers();
    localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)));
    selectedTempUserIds.value = [];
  } catch (err) {
    modalError.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 선택된 임시 사용자 일괄 저장
const saveSelectedTempUsers = async () => {
  if (selectedTempUserIds.value.length === 0) {
    modalError.value = '선택된 사용자가 없습니다.';
    return;
  }

  const selectedUsers = localTempUsers.value.filter(u => selectedTempUserIds.value.includes(u.user_id));
  const invalidUser = selectedUsers.find(u => !u.name || !u.name.trim());
  if (invalidUser) {
    modalError.value = '선택된 사용자 중 이름이 비어있는 사용자가 있습니다.';
    return;
  }

  loading.value = true;
  modalError.value = null;

  try {
    await Promise.all(selectedUsers.map(u => saveSingleTempUser(u)));
    await fetchUsers();
    localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)));
    selectedTempUserIds.value = [];
    alert('선택된 임시 사용자의 정보가 저장되었습니다.');
  } catch (err) {
    modalError.value = err.message;
  } finally {
    loading.value = false;
  }
};

// 선택된 임시 사용자 일괄 삭제
const deleteSelectedTempUsers = async () => {
  if (selectedTempUserIds.value.length === 0) {
    modalError.value = '선택된 사용자가 없습니다.';
    return;
  }

  showConfirm(`선택한 ${selectedTempUserIds.value.length}명의 사용자를 삭제하시겠습니까?`, async () => {
    loading.value = true;
    modalError.value = null;

    try {
      const idsToDelete = [];
      const localOnlyIds = [];

      selectedTempUserIds.value.forEach(id => {
        if (typeof id === 'string' && id.startsWith('new_')) {
          localOnlyIds.push(id);
        } else {
          idsToDelete.push(id);
        }
      });

      if (idsToDelete.length > 0) {
        await Promise.all(idsToDelete.map(id => userApi.deleteUser(id)));
      }

      await fetchUsers();
      
      // 로컬 데이터 최신화 및 아직 저장안된 로컬 제거
      localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)))
        .filter(u => !localOnlyIds.includes(u.user_id));
      selectedTempUserIds.value = [];
      alert('선택된 사용자가 삭제되었습니다.');
    } catch (err) {
      modalError.value = err.message;
    } finally {
      loading.value = false;
    }
  });
};

// 선택된 임시 사용자 일괄 정식 전환
const finalizeSelectedTempUsers = async () => {
  if (selectedTempUserIds.value.length === 0) {
    modalError.value = '선택된 사용자가 없습니다.';
    return;
  }

  const selectedUsers = localTempUsers.value.filter(u => selectedTempUserIds.value.includes(u.user_id));
  
  const hasNewUser = selectedUsers.some(u => u.is_new);
  if (hasNewUser) {
    modalError.value = '저장되지 않은 신규 행은 먼저 저장(추가)해야 정식 전환이 가능합니다.';
    return;
  }

  const invalidUser = selectedUsers.find(u => !u.cj_id || !u.cj_id.trim() || u.cj_id.toUpperCase().startsWith('TEMP_'));
  if (invalidUser) {
    modalError.value = `"${invalidUser.name}" 사용자의 CJ ID를 올바르게 입력해주세요. (TEMP_ 형식은 불가)`;
    return;
  }

  showConfirm(`선택한 ${selectedUsers.length}명의 사용자를 정식 사용자로 전환하시겠습니까?`, async () => {
    loading.value = true;
    modalError.value = null;

    try {
      for (const u of selectedUsers) {
        await userApi.finalizeUser(u.user_id, {
          cj_id: u.cj_id.trim(),
          part: u.part ? u.part.trim() : null
        });
      }

      await fetchUsers();
      localTempUsers.value = JSON.parse(JSON.stringify(users.value.filter(u => u.is_temporary)));
      selectedTempUserIds.value = [];
      alert('선택된 사용자가 정식 사용자로 전환되었습니다.');
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
      <div class="modal-content temp-user-list-modal wide-modal">
        <div class="modal-header">
          <h2>임시 사용자 관리</h2>
          <button @click="closeTempUserListModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <!-- 모달 내부 메시지 -->
          <div v-if="modalError" class="alert alert-error modal-alert">
            ❌ {{ modalError }}
          </div>

          <!-- 테이블 상단 제어 버튼 및 다중 선택 액션 -->
          <div class="temp-user-controls">
            <button @click="addTempUserRow" class="btn btn-add-row">
              ➕ 행 추가
            </button>
            <div class="bulk-actions">
              <button @click="saveSelectedTempUsers" class="btn btn-bulk-save" :disabled="selectedTempUserIds.length === 0 || loading">
                💾 선택 저장
              </button>
              <button @click="finalizeSelectedTempUsers" class="btn btn-bulk-finalize" :disabled="selectedTempUserIds.length === 0 || loading">
                🎓 선택 정식 전환
              </button>
              <button @click="deleteSelectedTempUsers" class="btn btn-bulk-delete" :disabled="selectedTempUserIds.length === 0 || loading">
                🗑️ 선택 삭제
              </button>
            </div>
          </div>
          
          <!-- 임시 사용자 목록 테이블 -->
          <div v-if="localTempUsers.length === 0" class="empty-state">
            임시 사용자가 없습니다. "행 추가" 버튼을 눌러 새 임시 사용자를 등록해 주세요.
          </div>
          <div v-else class="temp-user-table-wrapper">
            <table class="temp-user-table">
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">
                    <input type="checkbox" v-model="isAllTempUsersSelected" />
                  </th>
                  <th>이름</th>
                  <th>CJ ID (임시 ID)</th>
                  <th>부서</th>
                  <th style="width: 90px; text-align: center;">관리</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in localTempUsers" :key="user.user_id" :class="{ 'new-row': user.is_new }">
                  <td style="text-align: center;">
                    <input type="checkbox" :value="user.user_id" v-model="selectedTempUserIds" />
                  </td>
                  <td>
                    <input type="text" class="table-input" v-model="user.name" placeholder="이름 입력 (필수)" />
                  </td>
                  <td>
                    <input type="text" class="table-input" v-model="user.cj_id" placeholder="사번(전환 시 필수 입력)" />
                  </td>
                  <td>
                    <input type="text" class="table-input" v-model="user.part" placeholder="부서 입력" />
                  </td>
                  <td style="text-align: center;">
                    <div class="row-actions">
                      <button @click="saveTempUserInline(user)" class="btn-table-action btn-save-row" title="저장">
                        💾
                      </button>
                      <button @click="deleteTempUser(user)" class="btn-table-action btn-delete-row" title="삭제">
                        ❌
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div class="modal-footer">
          <button @click="closeTempUserListModal" class="btn btn-modal btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <!-- 사용자 상세 모달 -->
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp($event, closeModal)">
      <div class="modal-content">
        <div class="modal-header">
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <h2 style="margin-bottom: 0;">
              사용자 정보
              <span v-if="selectedUser?.is_temporary" class="temp-badge">임시</span>
            </h2>
            <button @click="goToUserAssets" class="btn-asset-link" title="자산 관리 페이지에서 보기">
              <img src="/images/boxes.png" alt="assets" class="header-icon-small" />
              자산 보기
            </button>
          </div>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedUser" class="form-grid">
            <div v-for="(value, key) in selectedUser" :key="key" v-show="!['user_id', 'password', 'google_id', 'is_temporary', 'asset_counts'].includes(key)" class="form-group">
              <label>
                {{ columnLabels[key] || key }}
                <button v-if="key === 'cj_id' && value" @click.stop="copyCjId(value)" class="copy-btn-tiny" title="복사" style="margin-left: 5px; vertical-align: middle;">
                  <img v-if="!isCjIdCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
                  <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
                </button>
              </label>
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
          
          <div v-if="selectedUser?.asset_counts?.length" class="asset-summary-box">
            <h3>보유 자산 현황</h3>
            <div class="asset-chips">
              <div v-for="item in selectedUser.asset_counts" :key="item.category" class="chip">
                <span class="chip-label">{{ item.category }}</span>
                <span class="chip-value">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="selectedUser?.is_temporary && isEditMode" @click="finalizeUser" class="btn btn-modal btn-primary">정식 전환</button>
          <button v-if="!isEditMode" @click="toggleEditMode" class="btn btn-modal btn-edit">수정</button>
          <button v-if="isEditMode" @click="saveUser" class="btn btn-modal btn-save">저장</button>
          <button v-if="isEditMode" @click="toggleEditMode" class="btn btn-modal btn-cancel">취소</button>
          <button @click="closeModal" class="btn btn-modal btn-close">닫기</button>
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
        <div class="header-actions">
          <!-- 임시 사용자 관리 통합 버튼 -->
          <button @click="openTempUserListModal" class="btn btn-header btn-temp-tracker">
            임시 사용자 관리 {{ tempUserCount > 0 ? `(${tempUserCount})` : '' }}
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
.users-section {
  background: var(--card-bg);
  padding: 20px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  width: 100%;
}

.users-header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 15px;
}

/* 임시 사용자 배지 */
.temp-badge {
  display: inline-block;
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
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

/* TSV 버튼 스타일 */
.btn-temp-tracker { background: var(--brand-purple); color: white; }
.btn-temp-tracker:hover { background: var(--brand-purple-dark); }
.btn-csv:hover { background: #4a6d8d; }

.btn-temp-tracker.active {
  background: var(--success-color);
}

.btn-temp-tracker.active:hover {
  background: #6da081;
}

/* 임시 사용자 목록 모달 */
.temp-user-list-modal.wide-modal {
  max-width: 950px;
  width: 90%;
}

.temp-user-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  gap: 10px;
  flex-wrap: wrap;
}

.btn-add-row {
  background: var(--brand-purple);
  color: white;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-add-row:hover {
  background: var(--brand-purple-dark);
}

.bulk-actions {
  display: flex;
  gap: 8px;
}

.bulk-actions .btn {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-bulk-save {
  background: var(--brand-blue);
  color: white;
}
.btn-bulk-save:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-bulk-finalize {
  background: var(--success-color);
  color: white;
}
.btn-bulk-finalize:hover:not(:disabled) {
  background: #3e8e41;
}

.btn-bulk-delete {
  background: var(--danger-color);
  color: white;
}
.btn-bulk-delete:hover:not(:disabled) {
  background: #d32f2f;
}

.bulk-actions .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.temp-user-table-wrapper {
  max-height: 450px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

.temp-user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.temp-user-table th {
  background: #f8f9fa;
  color: var(--text-muted);
  font-weight: 600;
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 1;
}

.temp-user-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.temp-user-table tr:hover {
  background: var(--border-light);
}

.temp-user-table tr.new-row {
  background-color: #e8f5e9;
}

.temp-user-table tr.new-row:hover {
  background-color: #c8e6c9;
}

.table-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: white;
  color: var(--text-main);
  box-sizing: border-box;
}

.table-input:focus {
  border-color: var(--brand-purple);
  outline: none;
}

.table-select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: white;
  color: var(--text-main);
}

.table-select:focus {
  border-color: var(--brand-purple);
  outline: none;
}

.row-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.btn-table-action {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-table-action:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.btn-delete-row:hover {
  background-color: #ffebee;
}

.btn-save-row:hover {
  background-color: #e8f5e9;
}

.header-icon-small {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

/* 자산 연결 버튼 */
.btn-asset-link {
  background: var(--brand-blue);
  color: white;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  transform: translateY(-2px);
}
.btn-asset-link:hover {
  filter: brightness(1.1);
}

/* 복사 버튼 */
.copy-btn-tiny {
  background: transparent;
  border: none;
  padding: 0;
  margin-left: 8px;
  cursor: pointer;
  vertical-align: middle;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.copy-btn-tiny:hover {
  transform: scale(1.1);
  opacity: 0.8;
}

/* 자산 현황 칩 스타일 */
.asset-summary-box {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);
}
.asset-summary-box h3 {
  font-size: 15px;
  color: var(--text-muted);
  margin-bottom: 12px;
  font-weight: 600;
}
.asset-chips { display: flex; flex-wrap: wrap; gap: 8px; }
</style>