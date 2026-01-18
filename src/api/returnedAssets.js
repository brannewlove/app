import client from './client';

export const getReturnedAssets = (params = '') => client.get(`/returned-assets${params}`);
export const addReturnedAsset = (data) => client.post('/returned-assets', data);
export const updateReturnedAsset = (id, data) => client.put(`/returned-assets/${id}`, data);
export const cancelReturnedAsset = (id, data) => client.post(`/returned-assets/cancel/${id}`, data);
export const deleteReturnedAsset = (id) => client.delete(`/returned-assets/${id}`);

export default {
    getReturnedAssets,
    addReturnedAsset,
    updateReturnedAsset,
    cancelReturnedAsset,
    deleteReturnedAsset,
};
