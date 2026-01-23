<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const authToken = ref(localStorage.getItem('authToken'));

// 알림 관련 상태
const notifications = ref([]);
const showNotifications = ref(false);
const hasUnreadNotifications = computed(() => notifications.value.some(n => !n.read));

// localStorage에서 유저 정보를 안전하게 가져오는 함수
const getSafeUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr || userStr === 'undefined') return null;
  try {
    return JSON.parse(userStr);
  } catch (err) {
    console.error('User data parsing error:', err);
    return null;
  }
};

const currentUser = ref(getSafeUser());

// 현재 로그인 상태 확인
const isLoggedIn = computed(() => {
  return !!authToken.value;
});

// 로그아웃
const handleLogout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  authToken.value = null;
  currentUser.value = null;
  router.push('/login');
};

const updateAuthState = () => {
  authToken.value = localStorage.getItem('authToken');
  currentUser.value = getSafeUser();
};

// 컴포넌트 마운트 시 사용자 정보 로드 및 storage 이벤트 감시
onMounted(() => {
  updateAuthState();
  checkBackupStatus(); // 백업 상태 확인
  
  // 다른 탭에서 localStorage 변경 감시
  window.addEventListener('storage', updateAuthState);
  
  // 동일 탭 내 상태 변경 감시 (커스텀 이벤트)
  window.addEventListener('auth-change', updateAuthState);
  
  // 외부 클릭 시 알림 드롭다운 닫기
  document.addEventListener('click', handleOutsideClick);
  
  // 주기적으로 백업 상태 확인 (5분마다)
  const intervalId = setInterval(checkBackupStatus, 5 * 60 * 1000);
  
  // cleanup
  return () => {
    window.removeEventListener('storage', updateAuthState);
    window.removeEventListener('auth-change', updateAuthState);
    document.removeEventListener('click', handleOutsideClick);
    clearInterval(intervalId);
  };
});

// 외부 클릭 처리
const handleOutsideClick = (event) => {
  const wrapper = document.querySelector('.notification-wrapper');
  if (wrapper && !wrapper.contains(event.target)) {
    showNotifications.value = false;
  }
};

// 백업 상태 확인
const checkBackupStatus = async () => {
  if (!authToken.value) return;
  
  try {
    const response = await axios.get('/api/backup/status');
    const status = response.data.data;
    
    // 기존 백업 관련 알림 제거
    notifications.value = notifications.value.filter(n => n.type !== 'backup');
    
    if (!status.valid) {
      notifications.value.unshift({
        id: Date.now(),
        type: 'backup',
        title: '구글 인증 만료',
        message: status.message,
        read: false,
        timestamp: new Date()
      });
    }
  } catch (err) {
    console.error('백업 상태 확인 실패:', err);
  }
};

// 알림 토글
const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value;
  if (showNotifications.value) {
    // 알림 읽음 처리
    notifications.value.forEach(n => n.read = true);
  }
};

// 외부 클릭 시 닫기
const closeNotifications = () => {
  showNotifications.value = false;
};

// 라우트 변경 시도 감시
watch(() => router.currentRoute.value.path, () => {
  updateAuthState();
});
</script>

<template>
  <div id="app" class="app-layout">
    <!-- 로그인 상태일 때만 네비게이션 표시 -->
    <nav v-if="isLoggedIn" class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <router-link to="/" class="brand-link">
            <h1>관리 시스템_dev</h1>
          </router-link>
        </div>
        <ul class="navbar-menu">
          <li>
            <router-link to="/users" class="nav-link" :class="{ active: $route.path === '/users' }">
               사용자 관리
            </router-link>
          </li>
          <li>
            <router-link to="/assets" class="nav-link" :class="{ active: $route.path === '/assets' }">
               자산 관리
            </router-link>
          </li>
          <li>
            <router-link to="/trades" class="nav-link" :class="{ active: $route.path === '/trades' }">
               거래 관리
            </router-link>
          </li>
          <li>
            <router-link to="/return-processing" class="nav-link" :class="{ active: $route.path === '/return-processing' }">
               반납처리
            </router-link>
          </li>
          <li v-if="currentUser && Number(currentUser.sec_level) === 100">
            <router-link to="/data-management" class="nav-link" :class="{ active: $route.path === '/data-management' }">
               데이터관리
            </router-link>
          </li>
        </ul>
        <div class="navbar-right">
          <span class="user-info" v-if="currentUser">{{ currentUser.name?.trim() }}</span>
          
          <!-- 알림 버튼 -->
          <div class="notification-wrapper" v-if="currentUser && Number(currentUser.sec_level) === 100">
            <button @click="toggleNotifications" class="notification-btn">
              <img src="/images/alram.png" alt="Notification" class="notification-icon" />
              <span v-if="hasUnreadNotifications" class="notification-badge">{{ notifications.filter(n => !n.read).length }}</span>
            </button>
            <div v-if="showNotifications" class="notification-dropdown" @click.stop>
              <div class="notification-header">시스템 알림</div>
              <div v-if="notifications.length === 0" class="notification-empty">
                알림이 없습니다.
              </div>
              <div v-else class="notification-list">
                <div v-for="n in notifications" :key="n.id" class="notification-item" :class="{ unread: !n.read }">
                  <div class="notification-title"><img src="/images/warning.png" alt="warning" class="warning-icon" /> {{ n.title }}</div>
                  <div class="notification-message">{{ n.message }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <button @click="handleLogout" class="logout-btn">로그아웃</button>
        </div>
      </div>
    </nav>

    <!-- 메인 콘텐츠 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f5f5f5;
}

.navbar {
  background: #4a4a4a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.navbar-container {
  max-width: 100%;
  margin: 0;
  padding: 0 20px;
  display: flex;
  align-items: center;
  height: 70px;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
}

.navbar-brand {
  flex-shrink: 0;
  white-space: nowrap;
  min-width: 150px;
}

.navbar-brand h1 {
  color: white;
  font-size: 24px;
  font-weight: bold;
  margin: 0;
}

.brand-link {
  text-decoration: none;
  cursor: pointer;
}

.navbar-menu {
  display: flex;
  list-style: none;
  gap: 0;
  flex: 1;
  height: 100%;
  margin: 0;
  padding: 0;
}

.navbar-menu li {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-link {
  color: white;
  text-decoration: none;
  padding: 10px 15px;
  border-radius: 6px;
  transition: all 0.3s ease;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  position: relative;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.nav-link.active {
  background: rgba(255, 255, 255, 0.3);
  border-bottom: 3px solid white;
  border-radius: 6px 6px 0 0;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-shrink: 0;
  margin-left: auto;
}

.user-info {
  color: white;
  font-weight: 500;
  padding: 0 15px;
  border-right: 1px solid rgba(255, 255, 255, 0.3);
}

.logout-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.main-content {
  flex: 1;
  width: 100%;
  padding: 20px;
}

@media (max-width: 768px) {
  .navbar-container {
    flex-direction: column;
    height: auto;
    padding: 15px 20px;
  }

  .navbar-menu {
    flex-direction: column;
    gap: 10px;
    margin-top: 15px;
  }

  .main-content {
    padding: 10px;
  }
}

/* 알림 버튼 스타일 */
.notification-wrapper {
  position: relative;
}

.notification-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 5px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  filter: brightness(0) invert(1); /* 이미지를 흰색으로 변경 */
}

.warning-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  vertical-align: middle;
  margin-right: 4px;
}

.notification-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #e74c3c;
  color: white;
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.notification-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 300px;
  z-index: 1000;
  overflow: hidden;
}

.notification-header {
  background: #4a4a4a;
  color: white;
  padding: 12px 15px;
  font-weight: 600;
  font-size: 14px;
}

.notification-empty {
  padding: 30px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.notification-list {
  max-height: 300px;
  overflow-y: auto;
}

.notification-item {
  padding: 12px 15px;
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: #f8f9fa;
}

.notification-item.unread {
  background: #fff8e1;
}

.notification-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
}

.notification-message {
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}
</style>
