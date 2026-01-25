<template>
  <div class="login-container">
    <div class="login-header-bg"></div>
    <div class="login-box">
      <div class="login-logo">
        <img src="/images/boxes.png" alt="Logo" class="logo-img" />
      </div>
      <h1>ASSETS DB</h1>
      <p class="login-subtitle">자산 관리 시스템</p>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="cj_id">아이디</label>
          <input 
            id="cj_id"
            v-model="form.cj_id"
            type="text"
            class="form-input"
            placeholder="CJ ID를 입력하세요"
            autocomplete="username"
            @keyup.enter="handleLogin"
          />
        </div>
        
        <div class="form-group">
          <label for="password">비밀번호</label>
          <input 
            id="password"
            v-model="form.password"
            type="password"
            class="form-input"
            placeholder="비밀번호를 입력하세요"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
        
        <button 
          type="submit"
          class="login-btn"
          :disabled="loading"
        >
          <span v-if="loading" class="btn-spinner"></span>
          {{ loading ? '처리 중...' : '로그인' }}
        </button>
      </form>
      
      <div class="login-footer">
        © 2025 CJ ENM INNO. All rights reserved.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const form = ref({
  cj_id: '',
  password: ''
});
const loading = ref(false);
const error = ref('');

const handleLogin = async () => {
  error.value = '';
  
  if (!form.value.cj_id || !form.value.password) {
    error.value = '아이디와 비밀번호를 입력하세요.';
    return;
  }
  
  loading.value = true;
  
  try {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cj_id: form.value.cj_id,
        password: form.value.password
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      const loginData = result.data || {};
      localStorage.setItem('authToken', loginData.token);
      localStorage.setItem('user', JSON.stringify(loginData.user));
      window.dispatchEvent(new Event('auth-change'));
      window.dispatchEvent(new Event('storage'));
      router.push('/dashboard'); // 대시보드로 이동
    } else {
      error.value = result.message || result.error || '로그인 실패';
    }
  } catch (err) {
    error.value = '로그인 중 오류가 발생했습니다.';
    console.error('로그인 오류:', err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f0f4f8;
  position: relative;
  overflow: hidden;
}

.login-header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40vh;
  background: linear-gradient(135deg, var(--brand-blue), var(--brand-purple));
  z-index: 0;
  border-bottom-left-radius: 50% 20%;
  border-bottom-right-radius: 50% 20%;
}

.login-box {
  background: white;
  padding: 50px 40px;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
  position: relative;
  z-index: 1;
  text-align: center;
}

.login-logo {
  width: 80px;
  height: 80px;
  background: #f8fafc;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: var(--shadow-sm);
}

.logo-img {
  width: 40px;
  height: 40px;
}

.login-box h1 {
  color: var(--text-main);
  margin-bottom: 8px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
}

.login-subtitle {
  color: var(--text-muted);
  font-size: 16px;
  margin-bottom: 40px;
  font-weight: 500;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  text-align: left;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-weight: 600;
  color: var(--text-main);
  font-size: 14px;
}

.form-input {
  padding: 14px 16px;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 15px;
  transition: all 0.2s;
  background-color: #fcfcfc;
}

.form-input:focus {
  outline: none;
  border-color: var(--brand-blue);
  background-color: white;
  box-shadow: 0 0 0 4px rgba(78, 126, 255, 0.1);
}

.error-message {
  background: #fff5f5;
  border: 1px solid #feb2b2;
  color: #c53030;
  padding: 12px;
  border-radius: var(--radius-md);
  font-size: 14px;
  text-align: center;
  font-weight: 500;
}

.login-btn {
  padding: 14px;
  background: linear-gradient(135deg, var(--brand-blue), #3b66ff);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(78, 126, 255, 0.3);
  filter: brightness(1.1);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.login-footer {
  margin-top: 40px;
  font-size: 12px;
  color: var(--text-light);
}
</style>
