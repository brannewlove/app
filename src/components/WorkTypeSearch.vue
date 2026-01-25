<template>
  <div class="autocomplete-container">
    <input
      ref="inputRef"
      type="text"
      :value="inputValue"
      :data-id="id"
      :name="id"
      autocomplete="off"
      tabindex="0"
      :placeholder="placeholder"
      :disabled="disabled"
      class="search-input"
      :class="{ 'is-open': isOpen }"
      @input="handleInputChange"
      @keydown="handleKeyDown"
      @focus="handleFocus"
      @click="handleClick"
      @blur="handleBlur"
    />

    <Teleport to="body">
      <div
        v-if="isOpen && !disabled"
        class="dropdown-overlay"
        :style="{
          top: dropdownStyle.top + 'px',
          left: dropdownStyle.left + 'px',
          width: dropdownStyle.width + 'px',
          maxHeight: dropdownStyle.maxHeight + 'px',
          overflowY: filteredData.length > 5 ? 'auto' : 'visible',
        }"
        @mouseenter="isDropdownHover = true"
        @mouseleave="isDropdownHover = false"
      >
        <div
          v-for="(item, index) in filteredData"
          :key="`${id}-item-${index}`"
          :ref="(el) => { itemRefs[index] = el; }"
          class="dropdown-item"
          :class="{ 'is-highlighted': index === highlightedIndex }"
          @mousedown.prevent="handleItemClick(item)"
        >
          <div class="item-primary-row">
            <span class="item-bold">{{ item.work_type }}</span>
            <span class="item-dimmed">{{ item.category }}</span>
          </div>
          <span class="item-secondary">{{ item.description }}</span>
        </div>

        <div v-if="filteredData.length === 0" class="dropdown-status">
          검색 결과가 없습니다
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { getAllWorkTypes } from '../constants/workTypes';

const props = defineProps({
  placeholder: { type: String, default: '작업 유형 검색' },
  initialValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  id: String,
  filterFn: { type: Function, default: null }
});

const emit = defineEmits(['select']);

const allTypes = getAllWorkTypes ? getAllWorkTypes() : [];
const workTypes = allTypes.filter(wt => wt.category !== '신규');

const inputRef = ref(null);
const inputValue = ref(props.initialValue);
const filteredData = ref([]);
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const isDropdownHover = ref(false);
const itemRefs = ref([]);
const isSelecting = ref(false);
const blurTimeout = ref(null);

const dropdownStyle = reactive({
  top: 0,
  left: 0,
  width: 0,
  maxHeight: 320
});

const updateDropdownPosition = () => {
  if (!isOpen.value || !inputRef.value) return;
  const rect = inputRef.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const bottomSpace = viewportHeight - rect.bottom;
  const topSpace = rect.top;
  const itemHeight = 52;
  const maxVisibleItems = 6;
  const maxDropdownHeight = itemHeight * maxVisibleItems;

  let contentHeight = filteredData.value.length > 0 ? Math.min(itemHeight * filteredData.value.length, maxDropdownHeight) : itemHeight;
  const shouldShowAbove = bottomSpace < contentHeight && topSpace >= contentHeight;
  const top = shouldShowAbove ? rect.top - contentHeight - 4 : rect.bottom + 4;

  dropdownStyle.top = Math.max(10, top);
  dropdownStyle.left = Math.max(10, rect.left);
  dropdownStyle.width = Math.max(280, rect.width);
  dropdownStyle.maxHeight = Math.min(maxDropdownHeight, Math.max(itemHeight, contentHeight));
};

watch(highlightedIndex, (newIndex) => {
  if (isOpen.value && newIndex >= 0 && itemRefs.value[newIndex]) {
    nextTick(() => { itemRefs.value[newIndex]?.scrollIntoView({ block: 'nearest', behavior: 'auto' }); });
  }
});

const selectValue = (value, focusDirection = 0) => {
  if (isSelecting.value) return;
  isSelecting.value = true;
  if (blurTimeout.value) { clearTimeout(blurTimeout.value); blurTimeout.value = null; }

  const selectedValue = value.work_type;
  inputValue.value = selectedValue;
  if (inputRef.value) inputRef.value.value = selectedValue;
  
  isOpen.value = false;
  isDropdownHover.value = false;
  highlightedIndex.value = -1;
  filteredData.value = [];
  emit('select', value);
  
  if (focusDirection !== 0) {
    setTimeout(() => {
      const currentInput = inputRef.value;
      if (currentInput) {
        const inputs = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
        const idx = inputs.indexOf(currentInput);
        if (idx !== -1) {
          const next = idx + focusDirection;
          if (next >= 0 && next < inputs.length) inputs[next].focus();
        }
      }
      isSelecting.value = false;
    }, 50);
  } else {
    isSelecting.value = false;
  }
};

const handleItemClick = (value) => selectValue(value);

const filterData = (query) => {
  const baseList = props.filterFn ? workTypes.filter(props.filterFn) : workTypes;
  if (!query || query.trim() === '') {
    filteredData.value = [...baseList];
  } else {
    const q = query.toLowerCase().trim();
    filteredData.value = baseList.filter(item => 
      (item.work_type || '').toLowerCase().includes(q) || 
      (item.category || '').toLowerCase().includes(q) || 
      (item.description || '').toLowerCase().includes(q)
    );
  }
  nextTick(updateDropdownPosition);
};

const handleInputChange = (e) => {
  inputValue.value = e.target.value;
  highlightedIndex.value = -1;
  filterData(e.target.value);
  isOpen.value = true;
};

const handleFocus = () => { filterData(inputValue.value); isOpen.value = true; nextTick(updateDropdownPosition); };
const handleClick = () => { filterData(inputValue.value); isOpen.value = true; nextTick(updateDropdownPosition); };

const handleBlur = () => {
  blurTimeout.value = setTimeout(() => {
    if (isSelecting.value || !isOpen.value) return;
    if (!isDropdownHover.value) {
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) selectValue(filteredData.value[highlightedIndex.value], 0);
      else if (filteredData.value.length === 1) selectValue(filteredData.value[0], 0);
      else isOpen.value = false;
    }
    blurTimeout.value = null;
  }, 150);
};

const handleKeyDown = (e) => {
  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredData.value.length - 1); break;
    case 'ArrowUp': e.preventDefault(); highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0); break;
    case 'Enter': e.preventDefault(); if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) selectValue(filteredData.value[highlightedIndex.value]); break;
    case 'Tab': 
      if (isOpen.value && filteredData.value.length > 0) {
        const idx = highlightedIndex.value >= 0 ? highlightedIndex.value : (filteredData.value.length === 1 ? 0 : -1);
        if (idx >= 0) { e.preventDefault(); selectValue(filteredData.value[idx], e.shiftKey ? -1 : 1); }
      }
      break;
    case 'Escape': isOpen.value = false; break;
  }
};

watch(() => props.initialValue, (v) => { if (v !== undefined && v !== null) inputValue.value = String(v); });
watch(isOpen, () => { nextTick(updateDropdownPosition); });
watch(filteredData, () => { nextTick(updateDropdownPosition); });

onMounted(() => {
  window.addEventListener('resize', updateDropdownPosition);
  window.addEventListener('scroll', updateDropdownPosition, true);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateDropdownPosition);
  window.removeEventListener('scroll', updateDropdownPosition, true);
});
</script>

<style scoped>
.autocomplete-container {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--text-main);
  background-color: white;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-md);
  outline: none;
  transition: all 0.2s;
}

.search-input:focus, .search-input.is-open {
  border-color: var(--brand-blue);
  box-shadow: 0 0 0 3px rgba(78, 126, 255, 0.1);
}

.dropdown-overlay {
  position: fixed;
  background: white;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 10000;
}

.dropdown-status {
  padding: 15px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.dropdown-item {
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid var(--bg-muted);
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: background 0.15s;
}

.dropdown-item:last-child { border-bottom: none; }

.dropdown-item.is-highlighted {
  background-color: var(--brand-blue);
  color: white;
}

.item-primary-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.item-bold {
  font-weight: 600;
  font-size: 14px;
}

.item-dimmed {
  font-size: 12px;
  opacity: 0.7;
}

.item-secondary {
  font-size: 11px;
  opacity: 0.6;
}

.is-highlighted .item-dimmed,
.is-highlighted .item-secondary {
  opacity: 0.9;
}
</style>