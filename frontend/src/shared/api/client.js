import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ?? (import.meta.env.DEV ? 'http://localhost:8000/api/v1' : '/api/v1')

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
})
