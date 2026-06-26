<template>
  <div class="autocomplete-container">
    <div class="input-wrapper">
      <input
        ref="inputRef"
        type="text"
        :value="inputValue"
        :data-id="id"
        :name="id"
        autocomplete="one-time-code"
        tabindex="0"
        :placeholder="placeholder"
        :disabled="disabled"
        readonly
        class="search-input"
        style="cursor: pointer;"
        :class="{ 'is-open': isOpen }"
        @input="e => traceEvent(e, 'input')"
        @change="e => traceEvent(e, 'change')"
        @keydown="e => { handleKeyDown(e); traceEvent(e, 'keydown'); }"
        @focus="e => { handleFocus(e); traceEvent(e, 'focus'); }"
        @click="e => { handleClick(e); traceEvent(e, 'click'); }"
        @blur="e => { handleBlur(e); traceEvent(e, 'blur'); }"
      />
      <div class="arrow-container">
        <span class="chevron" :class="{ 'up': isOpen }"></span>
      </div>
    </div>

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
          @mousedown.prevent
          @click.stop="handleItemClick(item)"
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

const traceEvent = (e, eventName) => {
  const el = e.target;
  const elementValue = el ? el.value : 'N/A';
  const vueStateValue = inputValue.value;
  const activeEl = document.activeElement;
  
  const logData = {
    type: 'work-type-change',
    prevValue: `VueState: "${vueStateValue}"`,
    newValue: `ElementValue: "${elementValue}"`,
    activeElement: activeEl ? {
      tagName: activeEl.tagName || '',
      id: activeEl.id || '',
      name: activeEl.name || '',
      className: activeEl.className || ''
    } : null,
    triggerContext: `Raw Event: ${eventName} (isTrusted: ${e.isTrusted}, key: ${e.key || 'N/A'})`,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };

  fetch('/api/system-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(logData)
  }).catch(err => {
    console.error('Failed to log trace event:', err);
  });
};

const logWorkTypeChange = (prevValue, newValue, triggerContext) => {
  const el = document.activeElement;
  const activeElementInfo = el ? {
    tagName: el.tagName || '',
    id: el.id || '',
    name: el.name || '',
    className: el.className || ''
  } : null;

  const logData = {
    type: 'work-type-change',
    prevValue,
    newValue,
    activeElement: activeElementInfo,
    triggerContext,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  };

  fetch('/api/system-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(logData)
  }).catch(err => {
    console.error('Failed to log work type change:', err);
  });
};

const selectValue = (value, focusDirection = 0, triggerContext = 'Manual select') => {
  if (isSelecting.value) return;
  isSelecting.value = true;
  if (blurTimeout.value) { clearTimeout(blurTimeout.value); blurTimeout.value = null; }

  const selectedValue = value.work_type;
  const prevValue = inputValue.value;

  if (prevValue !== selectedValue) {
    logWorkTypeChange(prevValue, selectedValue, triggerContext);
  }

  inputValue.value = selectedValue;
  if (inputRef.value) inputRef.value.value = selectedValue;
  
  emit('select', value);
  
  isOpen.value = false;
  isDropdownHover.value = false;
  highlightedIndex.value = -1;
  filteredData.value = [];
  
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
    }, 60);
  } else {
    setTimeout(() => {
      isSelecting.value = false;
    }, 60);
  }
};

const handleItemClick = (value) => selectValue(value, 0, 'Mouse click item');

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



const handleFocus = (e) => {
  filterData('');
  // 포커싱 시 자동 오픈 제거 (브라우저 가상 포커스로 인한 드롭다운 오작동 방지)
  // isOpen.value = true;
  nextTick(updateDropdownPosition);
};

const handleClick = (e) => {
  filterData('');
  isOpen.value = true;
  nextTick(updateDropdownPosition);
};

const handleBlur = (e) => {
  blurTimeout.value = setTimeout(() => {
    if (isSelecting.value || !isOpen.value) return;
    if (!isDropdownHover.value) {
      isOpen.value = false;
    }
    blurTimeout.value = null;
  }, 150);
};

const handleKeyDown = (e) => {
  if (document.activeElement !== inputRef.value) return;
  
  // 드롭다운이 닫혀있는 상태에서 키 입력 시 오픈 유도
  if (!isOpen.value && ['ArrowDown', 'ArrowUp', ' ', 'Enter'].includes(e.key)) {
    e.preventDefault();
    isOpen.value = true;
    filterData('');
    highlightedIndex.value = 0;
    return;
  }

  switch (e.key) {
    case 'ArrowDown': e.preventDefault(); highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredData.value.length - 1); break;
    case 'ArrowUp': e.preventDefault(); highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0); break;
    case 'Enter': e.preventDefault(); if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) selectValue(filteredData.value[highlightedIndex.value], 0, 'Keyboard Enter'); break;
    case ' ': 
      e.preventDefault(); 
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) {
        selectValue(filteredData.value[highlightedIndex.value], 0, 'Keyboard Space');
      }
      break;
    case 'Tab': 
      if (isOpen.value && filteredData.value.length > 0) {
        const idx = highlightedIndex.value >= 0 ? highlightedIndex.value : (filteredData.value.length === 1 ? 0 : -1);
        if (idx >= 0) { e.preventDefault(); selectValue(filteredData.value[idx], e.shiftKey ? -1 : 1, `Keyboard Tab${e.shiftKey ? ' (Shift)' : ''}`); }
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

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.arrow-container {
  position: absolute;
  right: 12px;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.chevron {
  display: block;
  width: 8px;
  height: 8px;
  border-right: 2px solid #999;
  border-bottom: 2px solid #999;
  transform: rotate(45deg);
  transition: transform 0.2s ease;
  margin-top: -4px;
}

.chevron.up {
  transform: rotate(-135deg);
  margin-top: 4px;
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