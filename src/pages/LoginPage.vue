<template>
  <div class="login-container">
    <div class="login-box">
      <h1>자산 관리 시스템</h1>
      
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="cj_id">아이디</label>
          <input 
            id="cj_id"
            v-model="form.cj_id"
            type="text"
            class="form-input"
            placeholder="아이디를 입력하세요"
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
          {{ loading ? '로그인 중...' : '로그인' }}
        </button>
      </form>
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
    const response = await fetch('http://localhost:3000/users/login', {
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
      // 로그인 성공 - 로컬스토리지에 토큰 저장
      localStorage.setItem('authToken', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      
      // storage 이벤트 발생 (App.vue가 감지하도록)
      window.dispatchEvent(new Event('storage'));
      
      // 다음 페이지로 이동
      router.push('/users');
    } else {
      error.value = result.message || '로그인 실패';
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #f5f5f5;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
  border: 1px solid #e0e0e0;
}

.login-box h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
  font-size: 28px;
  font-weight: bold;
}

.login-form {
  display: flex;
  flex-direction: column;
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
  padding: 12px 15px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s ease;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #999;
  box-shadow: 0 0 0 3px rgba(153, 153, 153, 0.1);
}

.form-input::placeholder {
  color: #999;
}

.error-message {
  background: #fef2f2;
  border: 2px solid #e74c3c;
  color: #e74c3c;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
}

.login-btn {
  padding: 12px;
  background: #4a4a4a;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: bold;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(74, 74, 74, 0.3);
  background: #333;
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
