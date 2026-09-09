<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  },
  trade: {
    type: Object,
    default: null
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'confirm']);

const cancelReason = ref('');
const textareaRef = ref(null);

watch(() => props.isOpen, (val) => {
  if (val) {
    cancelReason.value = '';
    setTimeout(() => {
      if (textareaRef.value) {
        textareaRef.value.focus();
      }
    }, 100);
  }
});

const isRevertCancel = computed(() => {
  return props.trade && props.trade.work_type && props.trade.work_type.startsWith('취소-');
});

const isNewRegistration = computed(() => {
  if (!props.trade) return false;
  return ['신규-계약', '신규-고장교체', '신규-기타'].includes(props.trade.work_type);
});

const modalTitle = computed(() => {
  if (isRevertCancel.value) return '거래 취소 철회 (재실행)';
  return '거래 취소 처리';
});

const actionGuideMessage = computed(() => {
  if (!props.trade) return '';
  if (isRevertCancel.value) {
    return `이전 취소 거래 [${props.trade.work_type}]를 철회하고 자산 상태를 다시 취소 이전으로 복구합니다.`;
  }
  if (isNewRegistration.value) {
    return `신규 등록 자산('${props.trade.asset_number}')의 등록을 취소하고 자산(assets) 레코드를 삭제합니다.`;
  }
  return `거래 발생 전 상태/소유자로 원복하며, 새로운 [취소-${props.trade.work_type}] 거래 로그가 생성됩니다.`;
});

const handleConfirm = () => {
  emit('confirm', {
    trade: props.trade,
    reason: cancelReason.value.trim()
  });
};

const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    emit('close');
  }
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')" @keydown="handleKeyDown">
    <div class="modal-card">
      <div class="modal-header">
        <h3>{{ modalTitle }}</h3>
        <button class="btn-close" @click="emit('close')">✕</button>
      </div>

      <div class="modal-body" v-if="trade">
        <!-- 거래 요약 정보 박스 -->
        <div class="trade-summary-card">
          <div class="summary-row">
            <span class="label">자산번호:</span>
            <span class="value font-bold">{{ trade.asset_number }}</span>
          </div>
          <div class="summary-row">
            <span class="label">작업유형:</span>
            <span class="value badge-work-type">{{ trade.work_type }}</span>
          </div>
          <div class="summary-row" v-if="trade.name || trade.cj_id">
            <span class="label">거래 대상자:</span>
            <span class="value">{{ trade.name || trade.cj_id }}</span>
          </div>
          <div class="summary-row" v-if="trade.memo">
            <span class="label">기존 메모:</span>
            <span class="value text-muted">{{ trade.memo }}</span>
          </div>
        </div>

        <!-- 안내 문구 -->
        <div class="alert-box" :class="{ 'alert-danger': isNewRegistration, 'alert-info': !isNewRegistration }">
          <span class="icon">ℹ️</span>
          <span>{{ actionGuideMessage }}</span>
        </div>

        <!-- 취소 사유 입력창 -->
        <div class="form-group">
          <label for="cancel-reason-input">
            {{ isRevertCancel ? '취소 철회 사유 (거래 메모)' : '취소 사유 (거래 메모)' }}
            <span class="optional-text">(선택 사항)</span>
          </label>
          <textarea
            id="cancel-reason-input"
            ref="textareaRef"
            v-model="cancelReason"
            placeholder="취소 사유나 특이사항을 입력해주세요. 새 거래 로그의 메모에 기록됩니다."
            rows="3"
            class="reason-textarea"
            :disabled="loading"
            @keydown.ctrl.enter="handleConfirm"
          ></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn-secondary" @click="emit('close')" :disabled="loading">닫기</button>
        <button 
          class="btn-primary-danger" 
          @click="handleConfirm" 
          :disabled="loading"
        >
          <span v-if="loading" class="spinner-sm"></span>
          {{ isRevertCancel ? '취소 철회 확정' : '취소 처리 확정' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-card {
  background: var(--card-bg, #ffffff);
  border-radius: var(--radius-md, 8px);
  width: 100%;
  max-width: 480px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-appear 0.2s ease-out;
}

@keyframes modal-appear {
  from { opacity: 0; transform: translateY(-10px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-main, #1e293b);
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-muted, #64748b);
  padding: 0 4px;
}

.modal-body {
  padding: 20px;
}

.trade-summary-card {
  background: var(--bg-hover, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-sm, 6px);
  padding: 12px 14px;
  margin-bottom: 14px;
}

.summary-row {
  display: flex;
  margin-bottom: 6px;
  font-size: 13px;
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-row .label {
  width: 90px;
  color: var(--text-muted, #64748b);
  flex-shrink: 0;
}

.summary-row .value {
  color: var(--text-main, #334155);
  word-break: break-all;
}

.badge-work-type {
  background: var(--bg-card, #e0f2fe);
  color: var(--brand-blue, #0284c7);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.alert-box {
  padding: 10px 12px;
  border-radius: var(--radius-sm, 6px);
  font-size: 12.5px;
  line-height: 1.4;
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.alert-info {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.alert-danger {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #334155);
}

.optional-text {
  font-size: 11px;
  font-weight: normal;
  color: var(--text-muted, #94a3b8);
}

.reason-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--border-color, #cbd5e1);
  border-radius: var(--radius-sm, 6px);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 70px;
}

.reason-textarea:focus {
  outline: none;
  border-color: var(--brand-blue, #0052cc);
  box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.15);
}

.modal-footer {
  padding: 12px 20px;
  background: var(--bg-hover, #f8fafc);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-secondary {
  padding: 8px 14px;
  background: #ffffff;
  border: 1px solid var(--border-color, #cbd5e1);
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #475569);
  cursor: pointer;
}

.btn-primary-danger {
  padding: 8px 16px;
  background: #556B2F;
  color: #ffffff;
  border: none;
  border-radius: var(--radius-sm, 4px);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: filter 0.2s;
}

.btn-primary-danger:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn-primary-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-sm {
  width: 12px;
  height: 12px;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
