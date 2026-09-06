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

const isMobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};

// 라우트 변경 시도 감시
watch(() => router.currentRoute.value.path, () => {
  updateAuthState();
  closeMobileMenu();
});

const navigateTo = (path) => {
  closeMobileMenu();
  if (router.currentRoute.value.path === path) {
    window.location.href = path; // 혹은 window.location.reload()
  } else {
    router.push(path);
  }
};
</script>

<template>
  <div id="app" class="app-layout">
    <!-- 로그인 상태일 때만 네비게이션 표시 -->
    <nav v-if="isLoggedIn" class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <a href="/" class="brand-link" @click.prevent="navigateTo('/')">
            <h1>관리 시스템</h1>
          </a>
        </div>

        <!-- 모바일 햄버거 버튼 및 알림 바로가기 -->
        <div class="mobile-header-actions">
          <!-- 모바일 알림 버튼 -->
          <div class="notification-wrapper mobile-only" v-if="currentUser && Number(currentUser.sec_level) === 100">
            <button @click="toggleNotifications" class="notification-btn" aria-label="알림">
              <img src="/images/alram.png" alt="Notification" class="notification-icon" />
              <span v-if="hasUnreadNotifications" class="notification-badge">{{ notifications.filter(n => !n.read).length }}</span>
            </button>
          </div>

          <button class="hamburger-btn" @click="toggleMobileMenu" :class="{ open: isMobileMenuOpen }" aria-label="메뉴 열기">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </button>
        </div>

        <!-- 네비게이션 메뉴 (데스크톱 및 모바일 반응형) -->
        <div class="navbar-collapse" :class="{ 'show-mobile': isMobileMenuOpen }">
          <ul class="navbar-menu">
            <li>
              <a href="/users" class="nav-link" :class="{ active: $route.path === '/users' }" @click.prevent="navigateTo('/users')">
                 사용자 관리
              </a>
            </li>
            <li>
              <a href="/assets" class="nav-link" :class="{ active: $route.path === '/assets' }" @click.prevent="navigateTo('/assets')">
                 자산 관리
              </a>
            </li>
            <li>
              <a href="/trades" class="nav-link" :class="{ active: $route.path === '/trades' }" @click.prevent="navigateTo('/trades')">
                 거래 관리
              </a>
            </li>
            <li>
              <a href="/return-processing" class="nav-link" :class="{ active: $route.path === '/return-processing' }" @click.prevent="navigateTo('/return-processing')">
                 반납처리
              </a>
            </li>
            <li v-if="currentUser && Number(currentUser.sec_level) === 100">
              <a href="/data-management" class="nav-link" :class="{ active: $route.path === '/data-management' }" @click.prevent="navigateTo('/data-management')">
                 데이터관리
              </a>
            </li>
          </ul>

          <div class="navbar-right">
            <span class="user-info" v-if="currentUser">{{ currentUser.name?.trim() }}</span>
            
            <!-- 데스크톱 알림 버튼 -->
            <div class="notification-wrapper desktop-only" v-if="currentUser && Number(currentUser.sec_level) === 100">
              <button @click="toggleNotifications" class="notification-btn" aria-label="알림">
                <img src="/images/alram.png" alt="Notification" class="notification-icon" />
                <span v-if="hasUnreadNotifications" class="notification-badge">{{ notifications.filter(n => !n.read).length }}</span>
              </button>
            </div>
            
            <button @click="handleLogout" class="logout-btn">로그아웃</button>
          </div>
        </div>

        <!-- 알림 드롭다운 (공통) -->
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
    </nav>

    <!-- 모바일 메뉴 배경 오버레이 -->
    <div v-if="isMobileMenuOpen" class="mobile-backdrop" @click="closeMobileMenu"></div>

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
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  background: #4a4a4a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
}

.navbar-container {
  max-width: 100%;
  margin: 0;
  padding: 0 20px;
  display: flex;
  align-items: center;
  height: 70px;
  gap: 20px;
  width: 100%;
  box-sizing: border-box;
  position: relative;
}

.navbar-brand {
  flex-shrink: 0;
  white-space: nowrap;
}

.navbar-brand h1 {
  color: white;
  font-size: 22px;
  font-weight: bold;
  margin: 0;
  border-bottom: none;
}

.brand-link {
  text-decoration: none;
  cursor: pointer;
}

.navbar-collapse {
  display: flex;
  align-items: center;
  flex: 1;
  width: 100%;
}

.navbar-menu {
  display: flex;
  list-style: none;
  gap: 6px;
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
  color: #f1f5f9;
  text-decoration: none;
  padding: 10px 14px;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  position: relative;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.15);
}

.nav-link.active {
  background: rgba(255, 255, 255, 0.25);
  font-weight: 700;
  color: white;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  margin-left: auto;
}

.user-info {
  color: white;
  font-weight: 500;
  font-size: 14px;
  padding: 0 10px;
  border-right: 1px solid rgba(255, 255, 255, 0.3);
}

.logout-btn {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.25);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s ease;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.mobile-header-actions {
  display: none;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.mobile-only {
  display: none;
}

.desktop-only {
  display: block;
}

/* 햄버거 버튼 스타일 */
.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 30px;
  height: 22px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 110;
}

.hamburger-btn .bar {
  width: 100%;
  height: 3px;
  background-color: white;
  border-radius: 3px;
  transition: all 0.3s ease-in-out;
}

.hamburger-btn.open .bar:nth-child(1) {
  transform: translateY(9.5px) rotate(45deg);
}

.hamburger-btn.open .bar:nth-child(2) {
  opacity: 0;
}

.hamburger-btn.open .bar:nth-child(3) {
  transform: translateY(-9.5px) rotate(-45deg);
}

.mobile-backdrop {
  display: none;
}

.main-content {
  flex: 1;
  width: 100%;
  padding: 20px;
}

/* 📱 스마트폰/모바일 반응형 스타일 (768px 이하) */
@media (max-width: 768px) {
  .navbar-container {
    height: 60px;
    padding: 0 15px;
  }

  .mobile-header-actions {
    display: flex;
  }

  .mobile-only {
    display: block;
  }

  .desktop-only {
    display: none;
  }

  .navbar-collapse {
    display: none;
    position: absolute;
    top: 60px;
    left: 0;
    right: 0;
    background: #3f3f3f;
    flex-direction: column;
    padding: 15px 20px 20px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
    z-index: 100;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    animation: slideDown 0.25s ease-out;
  }

  .navbar-collapse.show-mobile {
    display: flex;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .navbar-menu {
    flex-direction: column;
    width: 100%;
    gap: 6px;
    margin-bottom: 15px;
  }

  .navbar-menu li {
    width: 100%;
  }

  .nav-link {
    width: 100%;
    justify-content: flex-start;
    padding: 12px 16px;
    font-size: 16px;
    border-radius: 8px;
  }

  .nav-link.active {
    background: rgba(255, 255, 255, 0.2);
    border-bottom: none;
    border-left: 4px solid var(--brand-blue, #4682B4);
  }

  .navbar-right {
    width: 100%;
    padding-top: 15px;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    justify-content: space-between;
    margin-left: 0;
  }

  .user-info {
    border-right: none;
    padding: 0;
    font-size: 15px;
  }

  .logout-btn {
    padding: 10px 18px;
    font-size: 14px;
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 90;
    backdrop-filter: blur(2px);
  }

  .main-content {
    padding: 10px 8px;
  }

  .notification-dropdown {
    right: 15px !important;
    left: 15px !important;
    width: auto !important;
    top: 65px !important;
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
