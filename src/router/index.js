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

const DEFAULT_PAGE_PERMISSIONS = {
  '/': 1,
  '/assets': 1,
  '/trades': 1,
  '/return-processing': 1,
  '/users': 1,
  '/data-management': 100
};

const getPagePermissions = () => {
  try {
    const saved = localStorage.getItem('page_access_permissions');
    if (saved) {
      return { ...DEFAULT_PAGE_PERMISSIONS, ...JSON.parse(saved) };
    }
  } catch (e) {}
  return DEFAULT_PAGE_PERMISSIONS;
};

// 라우터 가드 - 로그인 검증 및 동적 보안등급 권한 검사
router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('authToken');
  const requiresAuth = to.meta.requiresAuth !== false;

  if (requiresAuth && !isAuthenticated) {
    // 인증이 필요한데 토큰이 없으면 로그인 페이지로
    next('/login');
  } else if (to.path === '/login' && isAuthenticated) {
    // 이미 로그인되어 있으면 대시보드로
    next('/');
  } else if (requiresAuth && isAuthenticated) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userLevel = Number(user.sec_level || 1);
    const permissions = getPagePermissions();
    const requiredLevel = permissions[to.path] !== undefined ? Number(permissions[to.path]) : 1;

    if (userLevel >= requiredLevel) {
      next();
    } else {
      alert(`접근 권한이 없습니다. (필요 보안등급: ${requiredLevel}, 현재 보안등급: ${userLevel})`);
      const targetFallback = (from.path && from.path !== to.path) ? from.path : '/';
      next(targetFallback);
    }
  } else {
    next();
  }
});

export default router
