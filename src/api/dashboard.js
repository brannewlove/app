import client from './client';

const getDashboardStats = async () => {
    return client.get('/dashboard');
};

export default {
    getDashboardStats
};
