<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const currentUser = ref(null);
const authToken = ref(localStorage.getItem('authToken'));

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

// localStorage 변화 감시
const updateAuthState = () => {
  authToken.value = localStorage.getItem('authToken');
  const userStr = localStorage.getItem('user');
  if (userStr) {
    currentUser.value = JSON.parse(userStr);
  } else {
    currentUser.value = null;
  }
};

// 컴포넌트 마운트 시 사용자 정보 로드 및 storage 이벤트 감시
onMounted(() => {
  updateAuthState();
  
  // 다른 탭에서 localStorage 변경 감시
  window.addEventListener('storage', updateAuthState);
  
  // cleanup
  return () => {
    window.removeEventListener('storage', updateAuthState);
  };
});

// 라우트 변경 시도 감시
watch(() => router.currentRoute.value.path, () => {
  authToken.value = localStorage.getItem('authToken');
});
</script>

<template>
  <div id="app" class="app-layout">
    <!-- 로그인 상태일 때만 네비게이션 표시 -->
    <nav v-if="isLoggedIn" class="navbar">
      <div class="navbar-container">
        <div class="navbar-brand">
          <h1>관리 시스템</h1>
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
            <router-link to="/trade-register" class="nav-link" :class="{ active: $route.path === '/trade-register' }">
               거래 등록
            </router-link>
          </li>
          <li>
            <router-link to="/return-processing" class="nav-link" :class="{ active: $route.path === '/return-processing' }">
               반납처리
            </router-link>
          </li>
        </ul>
        <div class="navbar-right">
          <span class="user-info" v-if="currentUser">{{ currentUser.name }}</span>
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
</style>
