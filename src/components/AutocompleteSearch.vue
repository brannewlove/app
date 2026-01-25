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
      :class="{ 'is-open': isOpen, 'is-invalid': !isValid && inputValue }"
      @input="handleInputChange"
      @keydown="handleKeyDown"
      @focus="handleFocus"
      @click="handleClick"
      @blur="handleBlur"
    />

    <p v-if="!isValid && inputValue && inputValue.length > 0 && !isOpen" class="validation-msg">
      유효한 값을 입력해주세요
    </p>

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
        <div v-if="loading" class="dropdown-status">로딩 중...</div>

        <div
          v-for="(item, index) in filteredData"
          :key="`${id}-item-${index}`"
          :ref="(el) => { itemRefs[index] = el; }"
          class="dropdown-item"
          :class="{ 'is-highlighted': index === highlightedIndex }"
          @mousedown.prevent="handleItemClick(item)"
        >
          <div v-if="apiColumn && item[apiColumn]" class="item-primary-row">
            <span v-if="item['name']" class="item-bold">{{ item['name'] }}</span>
            <span v-else class="item-bold">{{ String(item[apiColumn]) }}</span>
            
            <span v-if="item['name']" class="item-dimmed">{{ String(item[apiColumn]) }}</span>
            <span v-else-if="item['category']" class="item-dimmed">{{ item['category'] }}</span>
          </div>

          <span v-if="!apiColumn || !item[apiColumn]" class="item-fallback">
            {{ String(Object.values(item)[0] || '') }}
          </span>

          <span v-if="item['part']" class="item-secondary">{{ item['part'] }}</span>
          <span v-else-if="item['model']" class="item-secondary">{{ item['model'] }}</span>
        </div>

        <div v-if="!loading && (!filteredData || filteredData.length === 0)" class="dropdown-status">
          검색 결과가 없습니다
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  placeholder: { type: String, default: '검색어를 입력하세요' },
  label: { type: String, default: '검색' },
  onSelect: Function,
  onChange: Function,
  onFocus: Function,
  initialValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  id: String,
  apiTable: { type: String, default: 'users' },
  apiColumn: String,
  extraFields: { type: Array, default: () => [] },
  validateItem: Function,
  apiParams: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:modelValue', 'select']);

const inputRef = ref(null);
const inputValue = ref(props.initialValue);
const filteredData = ref([]);
const loading = ref(false);
const isOpen = ref(false);
const highlightedIndex = ref(-1);
const isValid = ref(true);
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

let loadingTimerRef = null;

const updateDropdownPosition = () => {
  if (!isOpen.value || !inputRef.value) return;

  const rect = inputRef.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const bottomSpace = viewportHeight - rect.bottom;
  const topSpace = rect.top;
  const itemHeight = 52;
  const maxVisibleItems = 6;
  const maxDropdownHeight = itemHeight * maxVisibleItems;

  let contentHeight = 0;
  if (loading.value) contentHeight = itemHeight;
  else if (filteredData.value.length > 0) contentHeight = Math.min(itemHeight * filteredData.value.length, maxDropdownHeight);
  else contentHeight = itemHeight;

  const shouldShowAbove = bottomSpace < contentHeight && topSpace >= contentHeight;
  const top = shouldShowAbove ? rect.top - contentHeight - 4 : rect.bottom + 4;

  dropdownStyle.top = Math.max(10, top);
  dropdownStyle.left = Math.max(10, rect.left);
  dropdownStyle.width = Math.max(100, rect.width);
  dropdownStyle.maxHeight = Math.min(maxDropdownHeight, Math.max(itemHeight, contentHeight));
};

watch(highlightedIndex, (newIndex) => {
  if (isOpen.value && newIndex >= 0 && itemRefs.value[newIndex]) {
    nextTick(() => {
      itemRefs.value[newIndex]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }
});

const selectValue = (value, focusDirection = 0) => {
  if (isSelecting.value) return;
  isSelecting.value = true;
  
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }

  let selectedDisplayValue = '';
  
  if (value && typeof value === 'object') {
    if (value['name']) selectedDisplayValue = String(value['name']);
    else if (props.apiColumn && value[props.apiColumn]) selectedDisplayValue = String(value[props.apiColumn]);
    else selectedDisplayValue = String(Object.values(value)[0] || '');
    
    inputValue.value = selectedDisplayValue;
    if (inputRef.value) inputRef.value.value = selectedDisplayValue;
  } else {
    selectedDisplayValue = String(value || '');
    inputValue.value = selectedDisplayValue;
    if (inputRef.value) inputRef.value.value = selectedDisplayValue;
  }
  
  isOpen.value = false;
  isDropdownHover.value = false;
  highlightedIndex.value = -1;
  filteredData.value = [];
  isValid.value = selectedDisplayValue.trim().length > 0;
  
  if (props.onSelect) props.onSelect(value);
  emit('select', value);
  
  if (focusDirection !== 0) {
    setTimeout(() => {
      const currentInput = inputRef.value;
      if (currentInput) {
        const inputs = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
        const currentIndex = inputs.indexOf(currentInput);
        if (currentIndex !== -1) {
          const nextIndex = currentIndex + focusDirection;
          if (nextIndex >= 0 && nextIndex < inputs.length) inputs[nextIndex].focus();
        }
      }
      isSelecting.value = false;
    }, 50);
  } else {
    isSelecting.value = false;
  }
};

const handleItemClick = (value) => selectValue(value);

const fetchData = async (query) => {
  if (loadingTimerRef) clearTimeout(loadingTimerRef);
  loadingTimerRef = setTimeout(() => { loading.value = true; }, 400);

  try {
    let url = `/api/selectBar?query=${encodeURIComponent(query)}`;
    if (props.apiTable) url += `&table=${encodeURIComponent(props.apiTable)}`;
    if (props.apiColumn) url += `&column=${encodeURIComponent(props.apiColumn)}`;
    
    if (props.apiParams && typeof props.apiParams === 'object') {
      Object.entries(props.apiParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      });
    }
    
    const res = await fetch(url);
    const result = await res.json();

    if (result.success === false || result.error) {
      filteredData.value = [];
      isValid.value = false;
    } else {
      let data = result.data || result || [];
      if (!query || query.trim().length === 0) {
        data = data.sort((a, b) => {
          const nameA = String(a[props.apiColumn || '이름'] || '').trim();
          const nameB = String(b[props.apiColumn || '이름'] || '').trim();
          return nameA.localeCompare(nameB, 'ko-KR', { sensitivity: 'base' });
        });
      }

      if (props.validateItem) {
        data = data.filter(item => props.validateItem(item).valid === true);
      }

      data = data.slice(0, 10);
      filteredData.value = data;
      isOpen.value = true;

      if (query.trim().length > 0) {
        isValid.value = data.length > 0;
        if (data.length === 1) highlightedIndex.value = 0;
      } else {
        isValid.value = data.length > 0;
      }
    }
  } catch (err) {
    filteredData.value = [];
    isValid.value = false;
  } finally {
    if (loadingTimerRef) clearTimeout(loadingTimerRef);
    loading.value = false;
  }
};

const handleInputChange = async (e) => {
  const value = e.target.value;
  inputValue.value = value;
  highlightedIndex.value = -1;
  await fetchData(value);
  if (props.onChange) props.onChange(value);
};

const handleFocus = async () => {
  if (props.onFocus) props.onFocus();
  isOpen.value = true;
  await fetchData(inputValue.value);
};

const handleClick = async () => {
  isOpen.value = true;
  await fetchData(inputValue.value);
};

const handleBlur = () => {
  blurTimeout.value = setTimeout(() => {
    if (isSelecting.value || !isOpen.value) return;
    if (!isDropdownHover.value) {
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) {
        selectValue(filteredData.value[highlightedIndex.value], 0);
      } else if (filteredData.value.length === 1) {
        selectValue(filteredData.value[0], 0);
      } else {
        isOpen.value = false;
      }
    }
    blurTimeout.value = null;
  }, 150);
};

const handleKeyDown = (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredData.value.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) selectValue(filteredData.value[highlightedIndex.value]);
      break;
    case 'Tab':
      if (isOpen.value && filteredData.value.length > 0) {
        const idx = highlightedIndex.value >= 0 ? highlightedIndex.value : (filteredData.value.length === 1 ? 0 : -1);
        if (idx >= 0) {
          e.preventDefault();
          selectValue(filteredData.value[idx], e.shiftKey ? -1 : 1);
        }
      }
      break;
    case 'Escape':
      isOpen.value = false;
      break;
  }
};

watch(() => props.initialValue, (v) => { if (v !== undefined && v !== null) inputValue.value = String(v); });
watch(isOpen, () => { nextTick(updateDropdownPosition); });
watch(filteredData, () => { nextTick(updateDropdownPosition); });
watch(loading, () => { nextTick(updateDropdownPosition); });

defineExpose({ reset: () => { inputValue.value = ''; filteredData.value = []; isOpen.value = false; isValid.value = true; }, clearSearch: () => { filteredData.value = []; isOpen.value = false; } });

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

.search-input.is-invalid {
  border-color: var(--confirm-color);
}

.validation-msg {
  margin-top: 6px;
  font-size: 11px;
  color: var(--confirm-color);
  font-weight: 500;
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

.item-fallback {
  font-weight: 500;
  font-size: 14px;
}
</style>
