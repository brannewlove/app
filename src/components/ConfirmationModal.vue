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
});

const emit = defineEmits(['confirm', 'cancel']);
const isDragging = ref(false); // 드래그 상태 추적

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
};

// 드래그 시작 시 호출
const handleMouseDown = () => {
  isDragging.value = true;
};

// 드래그 종료 시 호출
const handleMouseUp = () => {
  isDragging.value = false;
};
</script>

<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="!isDragging && handleCancel()">
    <div class="confirm-modal-content" @mousedown="handleMouseDown" @mouseup="handleMouseUp">
      <div class="confirm-modal-body">
        <p>{{ message }}</p>
      </div>
      <div class="confirm-modal-footer">
        <button class="btn btn-secondary" @click="handleCancel">취소</button>
        <button class="btn btn-primary" @click="handleConfirm">확인</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.confirm-modal-content { background: white; border-radius: 8px; min-width: 350px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
@keyframes slideIn { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.confirm-modal-body { padding: 30px 20px; text-align: center; color: #333; font-size: 16px; line-height: 1.5; }
.confirm-modal-footer { padding: 20px; display: flex; gap: 10px; justify-content: center; border-top: 1px solid #eee; }
.btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.3s ease; }
.btn-primary { background: #666; color: white; }
.btn-primary:hover { background: #555; }
.btn-secondary { background: white; color: #333; border: 1px solid #ddd; }
.btn-secondary:hover { background: #f5f5f5; }
.confirm-modal-footer .btn { padding: 10px 30px; }
</style>
