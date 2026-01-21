import client from './client';

export const getUsers = () => client.get('/users');
export const getUserById = (id) => client.get(`/users/${id}`);
export const updateUser = (id, data) => client.put(`/users/${id}`, data);
export const createTemporaryUser = (name) => client.post('/users/temporary', { name });
export const finalizeUser = (id, data) => client.patch(`/users/${id}/finalize`, data);
export const getTempUserCount = () => client.get('/users/temporary/count');
export const deleteUser = (id) => client.delete(`/users/${id}`);

export default {
    getUsers,
    getUserById,
    updateUser,
    createTemporaryUser,
    finalizeUser,
    getTempUserCount,
    deleteUser,
};
