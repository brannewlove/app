<template>
  <div class="relative w-full" style="position: relative">
    <!-- 검색 입력 필드 -->
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
      class="w-full"
      style="
        padding: 10px 12px;
        font-size: 14px;
        color: #1e293b;
        background-color: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        outline: none;
        transition: border-color 200ms ease;
        box-sizing: border-box;
      "
      :style="{ borderColor: isOpen ? '#3b82f6' : '#cbd5e1' }"
      @input="handleInputChange"
      @keydown="handleKeyDown"
      @focus="handleFocus"
      @click="handleClick"
      @blur="handleBlur"
    />

    <!-- 유효성 검사 메시지 -->
    <p
      v-if="!isValid && inputValue && inputValue.length > 0 && !isOpen"
      style="margin-top: 6px; font-size: 12px; color: #dc2626"
    >
      유효한 값을 입력해주세요
    </p>

    <!-- 드롭다운 -->
    <Teleport to="body">
      <div
        v-if="isOpen && !disabled"
        class="fixed bg-white rounded-lg shadow-xl"
        :style="{
          position: 'fixed',
          top: dropdownStyle.top + 'px',
          left: dropdownStyle.left + 'px',
          width: dropdownStyle.width + 'px',
          maxHeight: dropdownStyle.maxHeight + 'px',
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans, sans-serif, Apple Color Emoji, Segoe UI Emoji',
          overflowY: filteredData.length > 5 ? 'auto' : 'visible',
          zIndex: 999999,
          pointerEvents: 'auto'
        }"
        @mouseenter="isDropdownHover = true"
        @mouseleave="isDropdownHover = false"
      >
        <!-- 로딩 상태 -->
        <div
          v-if="loading"
          style="
            padding: 12px 16px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
          "
        >
          로딩 중...
        </div>

        <!-- 검색 결과 목록 -->
        <div
          v-for="(item, index) in filteredData"
          :key="`${id}-item-${index}`"
          :ref="(el) => { itemRefs[index] = el; }"
          style="
            padding: 8px 12px;
            cursor: pointer;
            user-select: none;
            border-bottom: 1px solid #f1f5f9;
            min-height: 52px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 2px;
            font-size: 14px;
            line-height: 1.3;
            overflow: hidden;
          "
          :style="{
            backgroundColor: index === highlightedIndex ? '#3b82f6' : '#ffffff',
            color: index === highlightedIndex ? '#ffffff' : '#1e293b',
            borderBottom: index < filteredData.length - 1 ? '1px solid #f1f5f9' : 'none'
          }"
          @mousedown.prevent="handleItemClick(item)"
        >
          <!-- 첫 번째 줄: cj_id/asset_number 와 이름/model 정보 -->
          <div
            v-if="apiColumn && item[apiColumn]"
            style="
              width: 100%;
              overflow: hidden;
              display: flex;
              align-items: baseline;
              gap: 6px;
            "
          >
            <!-- Users의 경우: name (bold) 먼저 표시 -->
            <span
              v-if="item['name']"
              style="
                font-weight: 600;
                line-height: 1.3;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
              "
            >
              {{ item['name'] }}
            </span>
            <!-- Assets의 경우: asset_number (bold) 먼저 표시 -->
            <span
              v-else
              style="
                font-weight: 600;
                line-height: 1.3;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
              "
            >
              {{ String(item[apiColumn]) }}
            </span>
            <!-- Users의 경우: cj_id 두 번째 표시 -->
            <span
              v-if="item['name']"
              style="
                font-size: 12px;
                opacity: 0.75;
                line-height: 1.2;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
              :style="{ opacity: highlightedIndex === index ? 0.9 : 0.75 }"
            >
              {{ String(item[apiColumn]) }}
            </span>
            <!-- Assets의 경우: category 두 번째 표시 -->
            <span
              v-else-if="item['category']"
              style="
                font-size: 12px;
                opacity: 0.75;
                line-height: 1.2;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              "
              :style="{ opacity: highlightedIndex === index ? 0.9 : 0.75 }"
            >
              {{ item['category'] }}
            </span>
          </div>

          <!-- apiColumn이 없는 경우 -->
          <span
            v-if="!apiColumn || !item[apiColumn]"
            style="
              font-weight: 500;
              width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              line-height: 1.3;
              font-size: 14px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
            "
          >
            {{ String(Object.values(item)[0] || '') }}
          </span>

          <!-- 두 번째 줄: 부서(part) 또는 카테고리(category) 정보 -->
          <span
            v-if="item['part']"
            style="
              font-size: 11px;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
            "
            :style="{ opacity: highlightedIndex === index ? 0.85 : 0.65 }"
          >
            {{ item['part'] }}
          </span>
          <span
            v-else-if="item['model']"
            style="
              font-size: 11px;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
            "
            :style="{ opacity: highlightedIndex === index ? 0.85 : 0.65 }"
          >
            {{ item['model'] }}
          </span>
        </div>

        <!-- 검색 결과 없음 -->
        <div
          v-if="!loading && (!filteredData || filteredData.length === 0)"
          style="
            padding: 12px 16px;
            text-align: center;
            color: #64748b;
            font-size: 14px;
          "
        >
          검색 결과가 없습니다
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  placeholder: {
    type: String,
    default: '검색어를 입력하세요'
  },
  label: {
    type: String,
    default: '검색'
  },
  onSelect: Function,
  onChange: Function,
  onFocus: Function,
  initialValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: String,
  apiTable: {
    type: String,
    default: 'users'
  },
  apiColumn: String,
  extraFields: {
    type: Array,
    default: () => []
  },
  validateItem: Function,
  apiParams: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:modelValue', 'select']);

// Ref 정의
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

// 드롭박스 위치 업데이트
const updateDropdownPosition = () => {
  if (!isOpen.value || !inputRef.value) return;

  const rect = inputRef.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const bottomSpace = viewportHeight - rect.bottom;
  const topSpace = rect.top;
  const itemHeight = 40;
  const maxVisibleItems = 5;
  const maxDropdownHeight = itemHeight * maxVisibleItems;

  let contentHeight = 0;
  if (loading.value) {
    contentHeight = itemHeight;
  } else if (filteredData.value.length > 0) {
    contentHeight = Math.min(itemHeight * filteredData.value.length, maxDropdownHeight);
  } else {
    contentHeight = itemHeight;
  }

  const shouldShowAbove = bottomSpace < contentHeight && topSpace >= contentHeight;
  const top = shouldShowAbove ? rect.top - contentHeight - 4 : rect.bottom + 4;

  dropdownStyle.top = Math.max(10, top);
  dropdownStyle.left = Math.max(10, rect.left);
  dropdownStyle.width = Math.max(100, rect.width);
  dropdownStyle.maxHeight = Math.min(maxDropdownHeight, Math.max(itemHeight, contentHeight));
};

// 하이라이트 자동 스크롤
watch(highlightedIndex, (newIndex) => {
  if (isOpen.value && newIndex >= 0 && itemRefs.value[newIndex]) {
    nextTick(() => {
      itemRefs.value[newIndex]?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
  }
});

// 값 선택
const selectValue = (value, focusDirection = 0) => {
  if (isSelecting.value) return;
  isSelecting.value = true;
  
  // 블러 예약 취소
  if (blurTimeout.value) {
    clearTimeout(blurTimeout.value);
    blurTimeout.value = null;
  }

  let selectedDisplayValue = '';
  
  if (value && typeof value === 'object') {
    // Users의 경우: name 표시, Assets의 경우: apiColumn 값 표시
    if (value['name']) {
      selectedDisplayValue = String(value['name']);
    } else if (props.apiColumn && value[props.apiColumn]) {
      selectedDisplayValue = String(value[props.apiColumn]);
    } else {
      selectedDisplayValue = String(Object.values(value)[0] || '');
    }
    inputValue.value = selectedDisplayValue;
    if (inputRef.value) {
      inputRef.value.value = selectedDisplayValue;
    }
  } else {
    selectedDisplayValue = String(value || '');
    inputValue.value = selectedDisplayValue;
    if (inputRef.value) {
      inputRef.value.value = selectedDisplayValue;
    }
  }
  
  isOpen.value = false;
  isDropdownHover.value = false;  // 드롭다운 호버 상태 초기화
  highlightedIndex.value = -1;
  filteredData.value = []; // 데이터 즉시 초기화하여 handleBlur 중복 실행 방지

  // 선택된 값이 유효한지 확인
  isValid.value = selectedDisplayValue.trim().length > 0;
  
  if (props.onSelect) props.onSelect(value);
  emit('select', value);
  
  // 포커스 이동 처리 (focusDirection: 1=정방향, -1=역방향)
  if (focusDirection !== 0) {
    setTimeout(() => {
      const currentInput = inputRef.value;
      if (currentInput) {
        const inputs = Array.from(document.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
        const currentIndex = inputs.indexOf(currentInput);
        if (currentIndex !== -1) {
          const nextIndex = currentIndex + focusDirection;
          if (nextIndex >= 0 && nextIndex < inputs.length) {
            inputs[nextIndex].focus();
          }
        }
      }
      isSelecting.value = false;
    }, 50);
  } else {
    isSelecting.value = false;
  }
};

// 아이템 클릭
const handleItemClick = (value) => {
  selectValue(value);
};

// API 호출
const fetchData = async (query) => {
  if (loadingTimerRef) clearTimeout(loadingTimerRef);
  loadingTimerRef = setTimeout(() => {
    loading.value = true;
  }, 400);

  try {
    let url = `/api/selectBar?query=${encodeURIComponent(query)}`;
    if (props.apiTable) url += `&table=${encodeURIComponent(props.apiTable)}`;
    if (props.apiColumn) url += `&column=${encodeURIComponent(props.apiColumn)}`;
    
    // apiParams 추가
    if (props.apiParams && typeof props.apiParams === 'object') {
      Object.entries(props.apiParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }
      });
    }
    
    const res = await fetch(url);
    const result = await res.json();

    if (result.success === false || result.error) {
      filteredData.value = [];
      isValid.value = false;
    } else {
      // 신규 표준 응답 형식 { success: true, data: [...] } 대응
      let data = [];
      if (result.data && Array.isArray(result.data)) {
        data = result.data;
      } else if (Array.isArray(result)) {
        data = result;
      }

      if (!query || query.trim().length === 0) {
        data = data.sort((a, b) => {
          const nameA = String(a[props.apiColumn || '이름'] || '').trim();
          const nameB = String(b[props.apiColumn || '이름'] || '').trim();
          if (!nameA) return 1;
          if (!nameB) return -1;
          return nameA.localeCompare(nameB, 'ko-KR', { sensitivity: 'base' });
        });
      }

      // validateItem 함수가 있으면 유효한 아이템만 필터링
      if (props.validateItem) {
        console.log(`[${props.id}] validateItem filtering: before=${data.length}`);
        data = data.filter(item => {
          const validation = props.validateItem(item);
          return validation.valid === true;
        });
        console.log(`[${props.id}] validateItem filtering: after=${data.length}`);
      }

      // 검색 결과를 10개로 제한
      data = data.slice(0, 10);

      filteredData.value = data;
      isOpen.value = true;

      // 검색 결과 유효성 판별
      if (query.trim().length > 0) {
        if (data.length === 1) {
          highlightedIndex.value = 0;
          isValid.value = true;  // 검색 결과가 1개 → 유효
        } else if (data.length > 0) {
          // 검색 결과가 여러 개 → 사용자가 선택 가능하므로 유효
          isValid.value = true;
        } else {
          // 검색 결과가 0개 → 무효
          isValid.value = false;
        }
      } else {
        // 검색어 없음 → 사용자가 선택 가능
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

// 입력값 변경
const handleInputChange = async (e) => {
  const value = e.target.value;
  inputValue.value = value;
  highlightedIndex.value = -1;
  await fetchData(value);
  if (props.onChange) props.onChange(value);
};

// 포커스 핸들러
const handleFocus = async () => {
  if (props.onFocus) props.onFocus();
  isOpen.value = true;
  await fetchData(inputValue.value);
};

// 클릭 핸들러
const handleClick = async () => {
  isOpen.value = true;
  await fetchData(inputValue.value);
};

// 블러 핸들러
const handleBlur = () => {
  blurTimeout.value = setTimeout(() => {
    // 이미 선택 중이거나 드롭다운이 닫혀 있으면 중단
    if (isSelecting.value || !isOpen.value) {
      blurTimeout.value = null;
      return;
    }

    // 드롭다운 호버 상태가 아니고, 하이라이트된 항목이 있으면 자동 선택
    if (!isDropdownHover.value) {
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) {
        selectValue(filteredData.value[highlightedIndex.value], 0);
      } else if (filteredData.value.length === 1) {
        // 검색 결과가 1개만 있으면 자동 선택
        selectValue(filteredData.value[0], 0);
      } else {
        isOpen.value = false;
      }
    }
    blurTimeout.value = null;
  }, 100);
};

// 키보드 이벤트
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
      if (highlightedIndex.value >= 0 && filteredData.value[highlightedIndex.value]) {
        selectValue(filteredData.value[highlightedIndex.value], false);
      }
      break;
    case 'Tab':
      if (isOpen.value && filteredData.value.length > 0) {
        const indexToSelect = highlightedIndex.value >= 0 ? highlightedIndex.value : (filteredData.value.length === 1 ? 0 : -1);
        
        if (indexToSelect >= 0) {
          e.preventDefault();
          selectValue(filteredData.value[indexToSelect], e.shiftKey ? -1 : 1);
        }
        // 그 외의 경우(결과가 여러개인데 하이라이트가 없는 경우 등)는 기본 Tab 동작(이동) 허용
      }
      break;
    case 'Escape':
      isOpen.value = false;
      break;
  }
};

// 초기값 변경 감시
watch(() => props.initialValue, (newValue) => {
  if (newValue !== undefined && newValue !== null) {
    inputValue.value = String(newValue);
    if (inputRef.value) {
      inputRef.value.value = String(newValue);
    }
  }
});

// 드롭다운 열림 상태 변경시
watch(isOpen, () => {
  nextTick(() => {
    updateDropdownPosition();
  });
});

// 데이터 변경시
watch(filteredData, () => {
  nextTick(() => {
    updateDropdownPosition();
  });
});

// 로딩 상태 변경시
watch(loading, () => {
  nextTick(() => {
    updateDropdownPosition();
  });
});

// 초기화 메서드 (ref로 노출)
const reset = () => {
  inputValue.value = '';
  filteredData.value = [];
  isOpen.value = false;
  isValid.value = true;
  if (inputRef.value) inputRef.value.value = '';
};

const clearSearch = () => {
  filteredData.value = [];
  isOpen.value = false;
};

// expose 메서드
defineExpose({
  reset,
  clearSearch
});

// 마운트
onMounted(() => {
  window.addEventListener('resize', updateDropdownPosition);
  window.addEventListener('scroll', updateDropdownPosition, true);
});

// 언마운트
onUnmounted(() => {
  window.removeEventListener('resize', updateDropdownPosition);
  window.removeEventListener('scroll', updateDropdownPosition, true);
  if (loadingTimerRef) clearTimeout(loadingTimerRef);
});
</script>

<style scoped>
.relative {
  position: relative;
}

.w-full {
  width: 100%;
}

.fixed {
  position: fixed;
}

.bg-white {
  background-color: #ffffff;
}

.rounded-lg {
  border-radius: 8px;
}

.shadow-xl {
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
</style>
