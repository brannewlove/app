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
          fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans, sans-serif',
          overflowY: filteredData.length > 5 ? 'auto' : 'visible',
          zIndex: 999999,
          pointerEvents: 'auto'
        }"
        @mouseenter="isDropdownHover = true"
        @mouseleave="isDropdownHover = false"
      >
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
          <!-- 작업 유형명 -->
          <div style="width: 100%; overflow: hidden; display: flex; align-items: baseline; gap: 6px;">
            <span
              style="
                font-weight: 600;
                line-height: 1.3;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
              "
            >
              {{ item.work_type }}
            </span>
            <span
              style="
                font-size: 12px;
                opacity: 0.75;
                line-height: 1.2;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', sans-serif;
                white-space: nowrap;
              "
              :style="{ opacity: highlightedIndex === index ? 0.9 : 0.75 }"
            >
              {{ item.category }}
            </span>
          </div>

          <!-- 설명 -->
          <span
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
            {{ item.description }}
          </span>
        </div>

        <!-- 검색 결과 없음 -->
        <div
          v-if="filteredData.length === 0"
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
import { ref, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  placeholder: {
    type: String,
    default: '작업 유형 검색'
  },
  initialValue: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  id: String
});

const emit = defineEmits(['select']);

// 작업 유형 로컬 데이터
const workTypes = [
  { work_type: '출고-신규지급', description: '신규입고자산을 사용자에게 지급' },
  { work_type: '출고-재고지급', description: '전산실재고를 사용자에게 지급' },
  { work_type: '출고-사용자변경', description: '사용자에서 타사용자로 변경' },
  { work_type: '출고-재고교체', description: '전산실재고를 교체요청자에게 출고' },
  { work_type: '출고-신규교체', description: '신규입고자산을 교체요청자에게 출고' },
  { work_type: '출고-대여', description: '자산 대여' },
  { work_type: '출고-수리', description: '수리 보내기' },
  { work_type: '입고-노후교체', description: '노후자산 교체 후 입고' },
  { work_type: '입고-불량교체', description: '불량자산 교체 후 입고' },
  { work_type: '입고-퇴사반납', description: '퇴사자 자산 반납' },
  { work_type: '입고-휴직반납', description: '휴직자 자산 보관' },
  { work_type: '입고-재입사예정', description: '재입사 예정자 자산 보관' },
  { work_type: '입고-임의반납', description: '사용자 임의 반납' },
  { work_type: '입고-대여반납', description: '대여자산 반납' },
  { work_type: '입고-수리반납', description: '수리완료 반납' },
  { work_type: '반납-노후반납', description: '노후자산 렌탈사 반납' },
  { work_type: '반납-고장교체', description: '고장자산 교체 반납' },
  { work_type: '반납-조기반납', description: '조기 반납' },
  { work_type: '반납-폐기', description: '자산 폐기' }
];

// Ref 정의
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

// 드롭박스 위치 업데이트
const updateDropdownPosition = () => {
  if (!isOpen.value || !inputRef.value) return;

  const rect = inputRef.value.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const bottomSpace = viewportHeight - rect.bottom;
  const topSpace = rect.top;
  const itemHeight = 52;
  const maxVisibleItems = 5;
  const maxDropdownHeight = itemHeight * maxVisibleItems;

  let contentHeight = 0;
  if (filteredData.value.length > 0) {
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

  const selectedValue = value.work_type;
  inputValue.value = selectedValue;
  if (inputRef.value) {
    inputRef.value.value = selectedValue;
  }
  
  isOpen.value = false;
  isDropdownHover.value = false;
  highlightedIndex.value = -1;
  filteredData.value = []; // 데이터 즉시 초기화하여 handleBlur 중복 실행 방지
  
  emit('select', value);
  
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

// 데이터 필터링
const filterData = (query) => {
  console.log('Filtering with query:', query);
  
  if (!query || query.trim() === '') {
    filteredData.value = [...workTypes];
    console.log('No query - showing all:', filteredData.value.length);
  } else {
    const lowerQuery = query.toLowerCase().trim();
    filteredData.value = workTypes.filter(item => {
      // 안전성 체크 추가
      const workType = (item.work_type || '').toLowerCase();
      const category = (item.category || '').toLowerCase();
      const description = (item.description || '').toLowerCase();
      
      const matchWorkType = workType.includes(lowerQuery);
      const matchCategory = category.includes(lowerQuery);
      const matchDescription = description.includes(lowerQuery);
      
      return matchWorkType || matchCategory || matchDescription;
    });
    console.log('Filtered results:', filteredData.value.length, 'for query:', lowerQuery);
  }
  
  nextTick(() => {
    updateDropdownPosition();
  });
};

// 입력값 변경
const handleInputChange = (e) => {
  const value = e.target.value;
  inputValue.value = value;
  highlightedIndex.value = -1;
  filterData(value);
  isOpen.value = true; // 드롭다운 열기
};

// 포커스 핸들러
const handleFocus = () => {
  console.log('Focus - current value:', inputValue.value);
  filterData(inputValue.value);
  isOpen.value = true;
  nextTick(() => {
    updateDropdownPosition();
  });
};

// 클릭 핸들러
const handleClick = () => {
  console.log('Click - current value:', inputValue.value);
  filterData(inputValue.value);
  isOpen.value = true;
  nextTick(() => {
    updateDropdownPosition();
  });
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

// 마운트
onMounted(() => {
  window.addEventListener('resize', updateDropdownPosition);
  window.addEventListener('scroll', updateDropdownPosition, true);
});

// 언마운트
onUnmounted(() => {
  window.removeEventListener('resize', updateDropdownPosition);
  window.removeEventListener('scroll', updateDropdownPosition, true);
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