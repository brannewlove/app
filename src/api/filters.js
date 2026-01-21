import axios from './client';

const filterApi = {
    getFilters: async (page) => {
        return await axios.get(`/saved-filters`, { params: { page } });
    },
    saveFilter: async (filterData) => {
        return await axios.post('/saved-filters', filterData);
    },
    deleteFilter: async (id) => {
        return await axios.delete(`/saved-filters/${id}`);
    },
    updateFilter: async (id, data) => {
        return await axios.patch(`/saved-filters/${id}`, data);
    },
    reorderFilters: async (orders) => {
        return await axios.put('/saved-filters/reorder', { orders });
    }
};

export default filterApi;
