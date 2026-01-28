import client from './client';

class AssetAPI {
    getAssets(params = {}) {
        return client.get('/assets', { params });
    }

    getAssetById(id) {
        return client.get(`/assets/${id}`);
    }

    getAssetByNumber(number) {
        return client.get(`/assets/number/${number}`);
    }

    updateAsset(id, data) {
        return client.put(`/assets/${id}`, data);
    }

    bulkInsert(data) {
        return client.post('/assets/bulk', data);
    }

    returnAsset(data) {
        return client.post('/returned-assets', data);
    }
}

export default new AssetAPI();
