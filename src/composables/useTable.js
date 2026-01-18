import { ref, computed, watch } from 'vue';

export function useTable(data, options = {}) {
    const {
        itemsPerPage = 20,
        initialSortColumn = null,
        initialSortDirection = 'asc',
        searchFields = [],
        filterFn = null,
        nullsFirst = false
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

    const sortedData = computed(() => {
        if (!sortColumn.value) return data.value;

        return [...data.value].sort((a, b) => {
            const columns = Array.isArray(sortColumn.value) ? sortColumn.value : [sortColumn.value];

            for (const col of columns) {
                let aRaw = a[col];
                let bRaw = b[col];

                // Check for empty values if nullsFirst is enabled
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
                // Number comparison
                if (!isNaN(aValue) && !isNaN(bValue) && aValue !== '' && bValue !== '') {
                    const numA = parseFloat(aValue);
                    const numB = parseFloat(bValue);
                    comparison = numA - numB;
                } else {
                    // String comparison
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
    });

    const filteredData = computed(() => {
        let result = sortedData.value;

        // Apply custom filter if provided
        if (filterFn) {
            result = result.filter(filterFn);
        }

        if (!searchQuery.value) return result;

        const keywords = searchQuery.value
            .toLowerCase()
            .split(/\s+/)
            .filter(k => k.length > 0);

        if (keywords.length === 0) return result;

        return result.filter(item => {
            const itemString = (searchFields.length > 0
                ? searchFields.map(f => item[f])
                : Object.values(item)
            ).map(v => String(v).toLowerCase()).join(' ');

            return keywords.every(keyword => itemString.includes(keyword));
        });
    });

    const paginatedData = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredData.value.slice(start, end);
    });

    const totalPages = computed(() => {
        return Math.ceil(filteredData.value.length / itemsPerPage);
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
