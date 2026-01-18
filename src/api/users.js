import client from './client';

export const getUsers = () => client.get('/users');
export const getUserById = (id) => client.get(`/users/${id}`);
export const updateUser = (id, data) => client.put(`/users/${id}`, data);

export default {
    getUsers,
    getUserById,
    updateUser,
};
