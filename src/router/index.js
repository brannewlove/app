import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('../pages/LoginPage.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/users',
      name: 'Users',
      component: () => import('../pages/UsersPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/assets',
      name: 'Assets',
      component: () => import('../pages/AssetsPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/trades',
      name: 'Trades',
      component: () => import('../pages/TradePage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/return-processing',
      name: 'ReturnProcessing',
      component: () => import('../pages/ReturnProcessingPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/data-management',
      name: 'DataManagement',
      component: () => import('../pages/DataManagementPage.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      name: 'Dashboard',
      component: () => import('../pages/DashboardPage.vue'),
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
