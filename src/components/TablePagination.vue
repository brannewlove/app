<script setup>
defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  pageNumbers: {
    type: Array,
    required: true
  }
});

defineEmits(['prev', 'next', 'go-to']);
</script>

<template>
  <div class="pagination" v-if="totalPages > 1">
    <button @click="$emit('prev')" :disabled="currentPage === 1" class="pagination-btn">← 이전</button>
    <div class="page-numbers">
      <button v-if="pageNumbers[0] > 1" @click="$emit('go-to', 1)" class="page-number">1</button>
      <span v-if="pageNumbers[0] > 2" class="ellipsis">...</span>
      <button v-for="page in pageNumbers" :key="page" @click="$emit('go-to', page)"
        :class="['page-number', { active: currentPage === page }]">
        {{ page }}
      </button>
      <span v-if="pageNumbers[pageNumbers.length - 1] < totalPages - 1" class="ellipsis">...</span>
      <button v-if="pageNumbers[pageNumbers.length - 1] < totalPages"
        @click="$emit('go-to', totalPages)" class="page-number">
        {{ totalPages }}
      </button>
    </div>
    <button @click="$emit('next')" :disabled="currentPage === totalPages" class="pagination-btn">다음 →</button>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.pagination-btn {
  padding: 10px 15px;
  background: #777;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: #666;
  transform: translateY(-2px);
}

.pagination-btn:disabled {
  background: var(--border-color);
  cursor: not-allowed;
  opacity: 0.6;
}

.page-numbers {
  display: flex;
  align-items: center;
  gap: 5px;
}

.page-number {
  padding: 8px 12px;
  background: #f0f0f0;
  color: #333;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 40px;
}

.page-number:hover {
  background: var(--border-color);
}

.page-number.active {
  background: #777;
  color: white;
  border-color: #777;
  font-weight: bold;
}

.ellipsis {
  color: #999;
  padding: 0 5px;
}
</style>
