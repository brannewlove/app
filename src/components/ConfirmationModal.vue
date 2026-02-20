<script setup>
import { ref } from 'vue';

defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  message: {
    type: String,
    default: 'Are you sure?',
  },
  type: {
    type: String,
    default: 'confirm', // 'confirm' or 'alert'
  }
});

const emit = defineEmits(['confirm', 'cancel']);

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
};

const isClickStartedOnOverlay = ref(false);

const handleOverlayMouseDown = (e) => {
  isClickStartedOnOverlay.value = e.target.classList.contains('modal-overlay');
};

const handleOverlayMouseUp = (e) => {
  if (isClickStartedOnOverlay.value && e.target.classList.contains('modal-overlay')) {
    handleCancel();
  }
  isClickStartedOnOverlay.value = false;
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @mousedown="handleOverlayMouseDown" @mouseup="handleOverlayMouseUp">
    <div class="confirm-modal-content">
      <div class="confirm-modal-body">
        <p v-html="message"></p>
      </div>
      <div class="confirm-modal-footer">
        <button v-if="type === 'confirm'" class="btn btn-modal btn-secondary" @click="handleCancel">취소</button>
        <button class="btn btn-modal btn-primary" @click="handleConfirm">확인</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.confirm-modal-content { background: white; border-radius: 8px; min-width: 350px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
@keyframes slideIn { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.confirm-modal-body { 
  padding: 30px 20px; 
  text-align: center; 
  color: #333; 
  font-size: 16px; 
  line-height: 1.6; 
  white-space: pre-line; 
}
:deep(.text-danger) { color: #e74c3c; }
:deep(.font-bold) { font-weight: 700; }
.confirm-modal-footer { padding: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px solid #eee; }
.confirm-modal-footer { padding: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px solid #eee; }
.btn-primary { background: #666; color: white; }
.btn-primary:hover { background: #555; }
.btn-secondary { background: white; color: #333; border: 1px solid var(--border-color); }
.btn-secondary:hover { background: #f5f5f5; }
</style>
