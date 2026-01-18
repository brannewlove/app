import client from './client';

export const getAssets = () => client.get('/assets');
export const getAssetById = (id) => client.get(`/assets/${id}`);
export const updateAsset = (id, data) => client.put(`/assets/${id}`, data);
export const returnAsset = (data) => client.post('/returned-assets', data);

export default {
    getAssets,
    getAssetById,
    updateAsset,
    returnAsset,
};
