import axios from 'axios';

// Keep API calls on the same host/port the user opened. Vite proxies /api to
// Flask, so LAN and private-tunnel visitors reach the owner's backend rather
// than trying to contact localhost on their own device.
export const API_BASE_URL = '/api';
const API = axios.create({ baseURL: API_BASE_URL });

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('token');
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
