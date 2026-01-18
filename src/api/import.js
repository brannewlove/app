import client from './client';

export default {
    /**
     * 자산 데이터 임포트 (Upsert)
     * @param {Array} data 자산 데이터 배열
     */
    importAssets(data) {
        return client.post('/import/assets', data);
    },

    /**
     * 사용자 데이터 임포트 (Upsert)
     * @param {Array} data 사용자 데이터 배열
     */
    importUsers(data) {
        return client.post('/import/users', data);
    }
};
