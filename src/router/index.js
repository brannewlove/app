import { createRouter, createWebHistory } from 'vue-router'
import LoginPage from '../pages/LoginPage.vue'
import DashboardPage from '../pages/DashboardPage.vue'
import UsersPage from '../pages/UsersPage.vue'
import AssetsPage from '../pages/AssetsPage.vue'
import TradePage from '../pages/TradePage.vue'
import ReturnProcessingPage from '../pages/ReturnProcessingPage.vue'
import DataManagementPage from '../pages/DataManagementPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: LoginPage,
      meta: { requiresAuth: false }
    },
    {
      path: '/users',
      name: 'Users',
      component: UsersPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/assets',
      name: 'Assets',
      component: AssetsPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/trades',
      name: 'Trades',
      component: TradePage,
      meta: { requiresAuth: true }
    },
    {
      path: '/return-processing',
      name: 'ReturnProcessing',
      component: ReturnProcessingPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/data-management',
      name: 'DataManagement',
      component: DataManagementPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      name: 'Dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true }
    }
  ],
})

// 라우터 가드 - 로그인 검증
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('authToken');
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !isAuthenticated) {
    // 인증이 필요한데 토큰이 없으면 로그인 페이지로
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    // 이미 로그인되어 있으면 대시보드로
    next('/');
  } else if (to.name === 'DataManagement') {
    // 데이터 관리 페이지는 sec_level 100 필수
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.sec_level === 100) {
      next();
    } else {
      alert('접근 권한이 없습니다.');
      next(from.path || '/');
    }
  } else {
    next();
  }
});

export default router
