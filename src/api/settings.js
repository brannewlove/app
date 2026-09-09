import client from './client';

export const getSettings = () => {
    return client.get('/settings');
};

export const getSetting = (key) => {
    return client.get(`/settings/${key}`);
};

export const saveSetting = (key, value) => {
    return client.post(`/settings/${key}`, { value });
};

export default {
    getSettings,
    getSetting,
    saveSetting
};
