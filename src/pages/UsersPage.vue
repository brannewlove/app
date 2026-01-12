<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const users = ref([]);
const loading = ref(false);
const error = ref(null);
const selectedUser = ref(null);
const currentPage = ref(1);
const itemsPerPage = 20;
const sortColumn = ref(null);
const sortDirection = ref('asc');
const searchQuery = ref('');
const isModalOpen = ref(false);
const isEditMode = ref(false);
const editedUser = ref(null);

// 테이블 헤더 가져오기 (user_id와 password 제외)
const getTableHeaders = (data) => {
  if (data.length === 0) return [];
  return Object.keys(data[0]).filter(key => !['user_id', 'password'].includes(key));
};

// 검색 필터링된 사용자 목록
const filteredUsers = computed(() => {
  if (!searchQuery.value) {
    return sortedUsers.value;
  }
  
  // 공백으로 구분된 여러 키워드를 모두 포함하는 행만 검색 (AND 검색)
  const keywords = searchQuery.value
    .toLowerCase()
    .split(/\s+/)
    .filter(k => k.length > 0);
  
  if (keywords.length === 0) {
    return sortedUsers.value;
  }
  
  return sortedUsers.value.filter(user => {
    const userString = Object.values(user)
      .map(value => String(value).toLowerCase())
      .join(' ');
    
    // 모든 키워드가 포함되어야 함
    return keywords.every(keyword => userString.includes(keyword));
  });
});

// 검색어 변경 시 페이지 리셋
watch(searchQuery, () => {
  currentPage.value = 1;
});

// 정렬된 사용자 목록
const sortedUsers = computed(() => {
  if (!sortColumn.value) {
    return users.value;
  }
  
  const sorted = [...users.value].sort((a, b) => {
    let aValue = a[sortColumn.value];
    let bValue = b[sortColumn.value];
    
    // null/undefined 처리
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';
    
    // 숫자 비교
    if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
      aValue = parseFloat(aValue);
      bValue = parseFloat(bValue);
      return sortDirection.value === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // 문자열 비교
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();
    
    if (sortDirection.value === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });
  
  return sorted;
});

// 정렬 헤더 클릭 핸들러
const handleSort = (column) => {
  if (sortColumn.value === column) {
    // 같은 열을 클릭하면 정렬 방향 토글
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // 다른 열을 클릭하면 새로운 열로 정렬 (오름차순)
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
  currentPage.value = 1; // 정렬 후 첫 페이지로 이동
};

// 정렬 아이콘 반환
const getSortIcon = (column) => {
  if (sortColumn.value !== column) {
    return '⇳'; // 정렬되지 않음
  }
  return sortDirection.value === 'asc' ? '⇧' : '⇩';
};

// 페이지네이션된 사용자 목록
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  return filteredUsers.value.slice(start, end);
});

// 전체 페이지 수
const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage);
});

// 페이지 번호 목록 (최대 5개 페이지 표시)
const pageNumbers = computed(() => {
  const pages = [];
  const maxPages = 5;
  let start = Math.max(1, currentPage.value - 2);
  let end = Math.min(totalPages.value, start + maxPages - 1);
  
  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// 이전 페이지
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

// 다음 페이지
const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

// 특정 페이지로 이동
const goToPage = (page) => {
  currentPage.value = page;
};

// 모든 사용자 조회
const fetchUsers = async () => {
  loading.value = true;
  error.value = null;
  selectedUser.value = null;
  currentPage.value = 1;
  
  try {
<<<<<<< HEAD
    const response = await fetch('http://localhost:3000/users');
=======
    const response = await fetch('http://localhost:3000/api/users');
>>>>>>> 7fff1db (회사설치)
    const result = await response.json();
    
    if (result.success) {
      users.value = result.data;
    } else {
      error.value = result.error;
    }
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
<<<<<<< HEAD
    const response = await fetch(`http://localhost:3000/users/${id}`);
=======
    const response = await fetch(`http://localhost:3000/api/users/${id}`);
>>>>>>> 7fff1db (회사설치)
    const result = await response.json();
    
    if (result.success) {
      selectedUser.value = result.data;
      editedUser.value = JSON.parse(JSON.stringify(result.data)); // 깊은 복사
      isModalOpen.value = true;
      isEditMode.value = false;
    } else {
      error.value = result.error;
    }
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
    
<<<<<<< HEAD
    const response = await fetch(`http://localhost:3000/users/${editedUser.value.user_id}`, {
=======
    const response = await fetch(`http://localhost:3000/api/users/${editedUser.value.user_id}`, {
>>>>>>> 7fff1db (회사설치)
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editedUser.value)
    });
    
    const result = await response.json();
    
    if (result.success) {
      selectedUser.value = JSON.parse(JSON.stringify(editedUser.value));
      
      // 테이블의 사용자도 업데이트
      const userIndex = users.value.findIndex(u => u.user_id === editedUser.value.user_id);
      if (userIndex !== -1) {
        users.value[userIndex] = JSON.parse(JSON.stringify(editedUser.value));
      }
      
      isEditMode.value = false;
      error.value = null;
    } else {
      error.value = result.error || '저장 실패';
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// CSV 다운로드
const downloadCSV = () => {
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
  const filename = `UsersPage_${timestamp}.csv`;
  
  // CSV 헤더 생성 (실제 출력되는 컬럼들만)
  const headers = getTableHeaders(users.value);
  const csvContent = [
    headers.join(','),
    ...users.value.map(user => 
      headers.map(header => {
        const value = user[header] || '';
        // 쉼표나 줄바꿈을 포함한 값을 큰따옴표로 감싸기
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
<<<<<<< HEAD
  // Blob 생성 및 다운로드
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
=======
  // Blob 생성 및 다운로드 (UTF-8 BOM 추가로 엑셀 한글 깨짐 방지)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
>>>>>>> 7fff1db (회사설치)
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
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
  <div class="page-content" style="display: block; padding: 20px;">
    <h1>사용자 관리</h1>
    
    <div v-if="error" class="alert alert-error">
      ❌ {{ error }}
    </div>
    
    <div v-if="loading" class="alert alert-info">
      ⏳ 로딩 중...
    </div>
    
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>사용자 정보</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        
        <div class="modal-body">
          <div v-if="selectedUser" class="form-grid">
            <div v-for="(value, key) in selectedUser" :key="key" v-show="!['user_id', 'password'].includes(key)" class="form-group">
              <label>{{ key }}</label>
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
        <button @click="downloadCSV" class="btn btn-csv">csv</button>
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
                  <span>{{ key }}</span>
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
      
      <div class="pagination">
        <button @click="prevPage" :disabled="currentPage === 1" class="pagination-btn">← 이전</button>
        <div class="page-numbers">
          <button v-if="pageNumbers[0] > 1" @click="goToPage(1)" class="page-number">1</button>
          <span v-if="pageNumbers[0] > 2" class="ellipsis">...</span>
          <button v-for="page in pageNumbers" :key="page" @click="goToPage(page)"
            :class="['page-number', { active: currentPage === page }]">
            {{ page }}
          </button>
          <span v-if="pageNumbers[pageNumbers.length - 1] < totalPages - 1" class="ellipsis">...</span>
          <button v-if="pageNumbers[pageNumbers.length - 1] < totalPages"
            @click="goToPage(totalPages)" class="page-number">
            {{ totalPages }}
          </button>
        </div>
        <button @click="nextPage" :disabled="currentPage === totalPages" class="pagination-btn">다음 →</button>
      </div>
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

.alert {
  padding: 15px 20px;
  border-radius: 5px;
  margin-bottom: 20px;
  font-size: 16px;
}

.alert-error {
  background: #fef2f2;
  color: #e74c3c;
  border-left: 4px solid #e74c3c;
}

.alert-info {
  background: #f5f5f5;
  color: #666;
  border-left: 4px solid #999;
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

.search-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.search-input:focus {
  outline: none;
  border-color: #999;
  box-shadow: 0 0 0 3px rgba(153, 153, 153, 0.1);
}

.clear-btn {
  padding: 10px 14px;
  background: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s ease;
  color: #666;
}

.clear-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.search-result {
  padding: 8px 12px;
  background: #f0f4f8;
  border-left: 3px solid #5e88af;
  color: #4a6b8a;
  margin-bottom: 15px;
  border-radius: 3px;
  font-size: 14px;
}

.table-wrapper {
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;
  display: block;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: white;
  table-layout: auto;
}

.users-table thead {
  background: #4a4a4a;
  color: white;
  position: sticky;
  top: 0;
  z-index: 10;
}

.sortable-header {
  padding: 0;
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background 0.3s ease;
  color: white;
  background: #4a4a4a;
}

.sortable-header:hover:not(.active) {
  background: rgba(255, 255, 255, 0.15);
}

.sortable-header.active {
  background: #3a3a3a;
  color: #ffeb3b;
}

.sortable-header.active:hover {
  background: #3a3a3a;
}

.header-content {
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sort-icon {
  opacity: 0.6;
  font-size: 12px;
  min-width: 16px;
  text-align: right;
}

.sortable-header.active .sort-icon {
  opacity: 1;
  font-weight: bold;
}

.users-table td {
  padding: 14px 12px;
  border-bottom: 1px solid #d8d8d8;
  word-wrap: break-word;
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 150px;
  vertical-align: middle;
}

.users-table tbody tr {
  transition: all 0.2s ease;
  background: #ffffff;
}

.users-table tbody tr.stripe {
  background: #f0f0f0;
}

.users-table tbody tr:hover {
  background: #e5e5e5;
  box-shadow: inset 0 0 0 1px #d0d0d0;
}

.users-table tbody tr.stripe:hover {
  background: #e5e5e5;
}

.users-table tbody tr.active {
  background: #d8d8d8;
  font-weight: 500;
}

.users-table tbody tr.active:hover {
  background: #c8c8c8;
}

.clickable-row {
  cursor: pointer;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pagination-btn {
  padding: 10px 15px;
  background: #777;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #666;
  transform: translateY(-2px);
}

.pagination-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 5px;
}

.page-number {
  padding: 8px 12px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 40px;
}

.page-number:hover {
  background: #e0e0e0;
}

.page-number.active {
  background: #777;
  color: white;
  border-color: #777;
  font-weight: bold;
}

.ellipsis {
  color: #999;
  padding: 0 5px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 18px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #f0f0f0;
  background: #f8f8f8;
  border-radius: 12px 12px 0 0;
}

.modal-header h2 {
  margin: 0;
  font-size: 22px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.modal-body {
  padding: 30px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: bold;
  color: #333;
  font-size: 14px;
}

.form-input {
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-value {
  padding: 10px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.modal-footer {
  padding: 20px;
  border-top: 2px solid #f0f0f0;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  background: #f8f8f8;
  border-radius: 0 0 12px 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
}

.btn-edit {
  background: #667eea;
  color: white;
}

.btn-edit:hover {
  background: #5568d3;
  transform: translateY(-2px);
}

.btn-save {
  background: #27ae60;
  color: white;
}

.btn-save:hover {
  background: #229954;
  transform: translateY(-2px);
}

.btn-cancel {
  background: #f39c12;
  color: white;
}

.btn-cancel:hover {
  background: #d68910;
  transform: translateY(-2px);
}

.btn-close {
  background: #95a5a6;
  color: white;
}

.btn-close:hover {
  background: #7f8c8d;
  transform: translateY(-2px);
}

.btn-csv {
  background: #6b8e6f;
  color: white;
}

.btn-csv:hover {
  background: #5a7a5e;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(107, 142, 111, 0.4);
}
</style>