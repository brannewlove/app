<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import userApi from '../api/users';

const props = defineProps({
  isOpen: Boolean,
  cjId: String
});

const emit = defineEmits(['close']);

const router = useRouter();
const loading = ref(false);
const error = ref(null);
const user = ref(null);
const isCjIdCopied = ref(false);

const columnLabels = {
  'cj_id': 'CJ ID',
  'name': '사용자명',
  'part': '부서',
  'sec_level': '보안등급',
  'state': '상태',
  'is_temporary': '임시사용자',
};

const fetchUser = async (cjId) => {
  if (!cjId) return;
  loading.value = true;
  error.value = null;
  user.value = null;
  try {
    const data = await userApi.getUserByCjId(cjId);
    user.value = data;
  } catch (err) {
    error.value = '사용자 정보를 불러오는데 실패했습니다.';
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const copyCjId = (cjId) => {
  if (!cjId) return;
  navigator.clipboard.writeText(cjId).then(() => {
    isCjIdCopied.value = true;
    setTimeout(() => isCjIdCopied.value = false, 2000);
  });
};

watch(() => props.isOpen, (newVal) => {
  if (newVal && props.cjId) {
    fetchUser(props.cjId);
  }
});

const close = () => {
    emit('close');
}

const goToUserAssets = () => {
  const targetCjId = user.value?.cj_id || props.cjId;
  if (targetCjId) {
    console.log('Navigating to assets for user:', targetCjId);
    router.push({ path: '/assets', query: { q: targetCjId } });
    close();
  } else {
    alert('사용자 식별 정보(CJ ID)가 없습니다.');
  }
};

</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <div style="display: flex; align-items: baseline; gap: 10px;">
          <h2 style="margin: 0;">
              사용자 정보
              <span v-if="user?.is_temporary" class="temp-badge">임시</span>
          </h2>
          <button v-if="user || cjId" @click="goToUserAssets" class="btn-asset-link" title="자산 관리 페이지에서 보기">
            <img src="/images/boxes.png" alt="assets" class="header-icon-small" />
            자산 보기
          </button>
        </div>
        <button @click="close" class="close-btn">✕</button>
      </div>
      
      <div class="modal-body">
        <div v-if="loading" class="loading-container">
            <div class="spinner"></div> 로딩 중...
        </div>
        <div v-else-if="error" class="error-msg">
            {{ error }}
        </div>
        <div v-else-if="user">
          <div class="form-grid">
            <div v-for="(value, key) in user" :key="key" v-show="columnLabels[key]" class="form-group">
              <label>
                {{ columnLabels[key] }}
                <button v-if="key === 'cj_id' && value" @click.stop="copyCjId(value)" class="copy-btn-tiny" title="복사">
                  <img v-if="!isCjIdCopied" src="/images/clipboard.png" alt="copy" class="copy-icon" />
                  <img v-else src="/images/checkmark.png" alt="copied" class="checkmark-icon" />
                </button>
              </label>
              <div class="form-value">
                {{ value || (key === 'cj_id' ? '미정' : '-') }}
              </div>
            </div>
          </div>
          
          <div v-if="user.asset_counts?.length" class="asset-summary-box">
            <h3>보유 자산 현황</h3>
            <div class="asset-chips">
              <div v-for="item in user.asset_counts" :key="item.category" class="chip">
                <span class="chip-label">{{ item.category }}</span>
                <span class="chip-value">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-msg">
            사용자 정보를 찾을 수 없습니다. (ID: {{ cjId }})
        </div>
      </div>
      
      <div class="modal-footer">
        <button @click="close" class="btn btn-modal btn-close">닫기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: var(--radius-lg, 12px);
  padding: 0;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
}

.modal-header {
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 24px;
  max-height: 70vh;
  overflow-y: auto;
}

.modal-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  background: #f8f9fa;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  display: flex;
  align-items: center;
}

.form-value {
  padding: 8px 12px;
  background: #fcfcfc;
  border: 1px solid #eee;
  border-radius: 6px;
  font-size: 14px;
  min-height: 38px;
  display: flex;
  align-items: center;
}

.temp-badge {
  display: inline-block;
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  margin-left: 10px;
  vertical-align: middle;
}

.asset-summary-box {
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px dashed #ddd;
}

.asset-summary-box h3 {
  font-size: 15px;
  color: #666;
  margin-bottom: 12px;
}

.asset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: flex;
  background: #f0f4f8;
  border-radius: 4px;
  overflow: hidden;
  font-size: 12px;
  border: 1px solid #d1d9e6;
}

.chip-label { padding: 4px 8px; background: #e2e8f0; color: #4a5568; }
.chip-value { padding: 4px 8px; background: white; color: #2d3748; font-weight: 700; }

.copy-btn-tiny {
  background: transparent;
  border: none;
  padding: 0;
  margin-left: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.copy-icon, .checkmark-icon { width: 14px; height: 14px; }

.loading-container { text-align: center; padding: 20px; color: #666; }
.error-msg { color: #e74c3c; text-align: center; padding: 10px; }
.empty-msg { text-align: center; color: #999; padding: 20px; }

.spinner {
  width: 20px; height: 20px;
  border: 2px solid #ddd;
  border-top-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  display: inline-block;
  margin-right: 8px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.btn-close {
  background: #6c757d;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.close-btn { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }

.btn-asset-link {
  background: var(--brand-blue, #0052cc);
  color: white;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: none;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  transform: translateY(-2px);
}

.btn-asset-link:hover {
  filter: brightness(1.1);
}

.header-icon-small {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
</style>
