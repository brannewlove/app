import { ref, computed, watch } from 'vue';
import { parseAndFilter } from '../utils/QueryParser';

export function useTable(data, options = {}) {
    // itemsPerPage를 반응형으로 관리 (Ref나 Computed가 들어오면 .value로 접근)
    const itemsPerPage = computed(() => {
        const val = options.itemsPerPage;
        return (val && typeof val === 'object' && 'value' in val) ? val.value : (val || 20);
    });

    const {
        initialSortColumn = null,
        initialSortDirection = 'asc',
        searchFields = [],
        filterFn = null,
        nullsFirst = false,
        stableSort = false // 새로운 옵션: true일 경우 데이터 내부 수정시 정렬을 유지함
    } = options;

    const currentPage = ref(1);
    const sortColumn = ref(initialSortColumn);
    const sortDirection = ref(initialSortDirection);
    const searchQuery = ref('');
    const isManualSort = ref(false);

    // Reset page when search or sort changes
    watch([searchQuery, sortColumn, sortDirection], () => {
        currentPage.value = 1;
    });

    // 정렬 로직을 함수로 분리
    const getSortedArray = (rawData) => {
        if (!sortColumn.value || !rawData) return rawData;

        return [...rawData].sort((a, b) => {
            const columns = Array.isArray(sortColumn.value) ? sortColumn.value : [sortColumn.value];

            for (const col of columns) {
                let aRaw = a[col];
                let bRaw = b[col];

                if (nullsFirst) {
                    const aEmpty = aRaw === null || aRaw === undefined || aRaw === '';
                    const bEmpty = bRaw === null || bRaw === undefined || bRaw === '';

                    if (aEmpty && !bEmpty) return -1;
                    if (!aEmpty && bEmpty) return 1;
                    if (aEmpty && bEmpty) continue;
                }

                let aValue = aRaw === null || aRaw === undefined ? '' : aRaw;
                let bValue = bRaw === null || bRaw === undefined ? '' : bRaw;

                let comparison = 0;
                if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
                    const numA = parseFloat(aValue);
                    const numB = parseFloat(bValue);
                    comparison = numA - numB;
                } else {
                    aValue = String(aValue).toLowerCase();
                    bValue = String(bValue).toLowerCase();
                    comparison = aValue.localeCompare(bValue);
                }

                if (comparison !== 0) {
                    return sortDirection.value === 'asc' ? comparison : -comparison;
                }
            }
            return 0;
        });
    };

    // stableSort인 경우 ref와 shallow watch 사용, 아니면 computed 사용
    let sortedData;
    if (stableSort) {
        const sortedRef = ref([]);
        const updateSort = () => {
            sortedRef.value = getSortedArray(data.value);
        };
        // 데이터 배열 자체가 바뀌거나 정렬 조건이 바뀔 때만 재정렬 (deep: false)
        watch([data, sortColumn, sortDirection], updateSort, { deep: false, immediate: true });
        sortedData = sortedRef;
    } else {
        sortedData = computed(() => getSortedArray(data.value));
    }

    const filteredData = computed(() => {
        let result = sortedData.value;

        // Apply custom filter if provided
        if (filterFn) {
            result = result.filter(filterFn);
        }

        if (!searchQuery.value) return result;

        return result.filter(item => parseAndFilter(item, searchQuery.value, searchFields));
    });

    const paginatedData = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage.value;
        const end = start + itemsPerPage.value;
        return filteredData.value.slice(start, end);
    });

    const totalPages = computed(() => {
        return Math.ceil(filteredData.value.length / itemsPerPage.value);
    });

    const pageNumbers = computed(() => {
        const pages = [];
        const maxPages = 5;
        let start = Math.max(1, currentPage.value - 2);
        let end = Math.min(totalPages.value, start + maxPages - 1);

        if (end - start < maxPages - 1) {
            start = Math.max(1, end - maxPages + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    });

    const handleSort = (column) => {
        isManualSort.value = true;
        if (sortColumn.value === column) {
            sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn.value = column;
            sortDirection.value = 'asc';
        }
    };

    const getSortIcon = (column) => {
        if (sortColumn.value !== column) return '⇳';
        return sortDirection.value === 'asc' ? '⇧' : '⇩';
    };

    const prevPage = () => {
        if (currentPage.value > 1) currentPage.value--;
    };

    const nextPage = () => {
        if (currentPage.value < totalPages.value) currentPage.value++;
    };

    const goToPage = (page) => {
        currentPage.value = page;
    };

    return {
        currentPage,
        sortColumn,
        sortDirection,
        isManualSort,
        searchQuery,
        sortedData,
        filteredData,
        paginatedData,
        totalPages,
        pageNumbers,
        handleSort,
        getSortIcon,
        prevPage,
        nextPage,
        goToPage
    };
}
