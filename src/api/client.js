import axios from 'axios';

const client = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Response interceptor to handle the standardized { success, data, error } format
client.interceptors.response.use(
    (response) => {
        const { success, data, error } = response.data;
        if (success) {
            return data;
        }
        return Promise.reject(new Error(error || 'Unknown error occurred'));
    },
    (error) => {
        const errorMessage = error.response?.data?.error || error.message;
        return Promise.reject(new Error(errorMessage));
    }
);

export default client;
