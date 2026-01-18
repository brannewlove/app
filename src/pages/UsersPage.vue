<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import userApi from '../api/users';
import { useTable } from '../composables/useTable';
import TablePagination from '../components/TablePagination.vue';

const users = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedUser = ref(null);

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
  sortDirection
} = useTable(users, {
  itemsPerPage: 20
});

const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedUser = ref(null);
const isClickStartedOnOverlay = ref(false);

// 테이블 헤더 가져오기 (user_id, password, google_id 제외)
const getTableHeaders = (data) => {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter(key => !['user_id', 'password', 'google_id'].includes(key));
};

// 컬럼 라벨 매핑
const columnLabels = {
  'name': '이름',
  'part': '부서',
  'sec_level': '보안등급',
  'state': '상태',
};

// 모든 사용자 조회
const fetchUsers = async () => {
  loading.value = true;
  error.value = null;
  selectedUser.value = null;
  currentPage.value = 1;
  
  try {
    users.value = await userApi.getUsers();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
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
  isClickStartedOnOverlay.value = e.target === e.currentTarget;
};

const handleOverlayMouseUp = (e) => {
  if (isClickStartedOnOverlay.value && e.target === e.currentTarget) {
    closeModal();
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

// TSV 다운로드
const downloadTSV = () => {
  if (users.value.length === 0) {
    error.value = '다운로드할 데이터가 없습니다.';
    return;
  }
  
  // 현재 시간 포맷팅
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${date}_${hours}${minutes}${seconds}`;
  const filename = `UsersPage_${timestamp}.tsv`;
  
  // TSV 헤더 생성 (실제 출력되는 컬럼들만)
  const headers = getTableHeaders(users.value);
  const tsvContent = [
    headers.join('\t'),
    ...users.value.map(user => 
      headers.map(header => {
        const value = user[header] || '';
        // 탭이나 줄바꿈을 포함한 값 처리
        if (typeof value === 'string') {
          return value.replace(/\t/g, ' ').replace(/\n/g, ' ');
        }
        return value;
      }).join('\t')
    )
  ].join('\n');
  
  // UTF-8 BOM과 함께 TSV 파일 생성
  const blob = new Blob(['\uFEFF' + tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};


// 컴포넌트 마운트 시 사용자 목록 조회
onMounted(() => {
  fetchUsers();
  // ESC 키로 모달 닫기
  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && isModalOpen.value) {
      closeModal();
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
      ⏳ 로딩 중...
    </div>
    
    <div v-if="isModalOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
      <div class="modal-content">
        <div class="modal-header">
          <h2>사용자 정보</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedUser" class="form-grid">
            <div v-for="(value, key) in selectedUser" :key="key" v-show="!['user_id', 'password', 'google_id'].includes(key)" class="form-group">
              <label>{{ columnLabels[key] || key }}</label>
              <input 
                v-if="isEditMode"
                v-model="editedUser[key]"
                type="text"
                class="form-input"
                :disabled="['user_id', 'cj_id'].includes(key)"
              />
              <div v-else class="form-value">
                {{ value }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="!isEditMode" @click="toggleEditMode" class="btn btn-edit">수정</button>
          <button v-if="isEditMode" @click="saveUser" class="btn btn-save">저장</button>
          <button v-if="isEditMode" @click="toggleEditMode" class="btn btn-cancel">취소</button>
          <button @click="closeModal" class="btn btn-close">닫기</button>
        </div>
      </div>
    </div>
    
    <div v-if="users.length > 0" class="users-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2>사용자 목록 ({{ filteredUsers.length }}명)</h2>
        <button @click="downloadTSV" class="btn btn-csv">tsv</button>
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
                class="sortable-header" :class="{ active: sortColumn === key }">
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
              :class="{ 'stripe': index % 2 === 1, active: selectedUser?.user_id === user.user_id }"
              class="clickable-row">
              <td v-for="key in getTableHeaders(users)" :key="key">
                {{ user[key] }}
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
}
</style>