import axios, { AxiosError, AxiosInstance } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { ApiError } from '@/types';

const API_BASE_URL = '/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - unwrap { success, data } envelope and handle errors
    this.client.interceptors.response.use(
      (response) => {
        // Unwrap the API envelope: { success, data, meta } -> data
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          const envelope = response.data;
          // Preserve meta for paginated responses
          if (envelope.meta) {
            response.data = { data: envelope.data, meta: envelope.meta };
          } else {
            response.data = envelope.data;
          }
        }
        return response;
      },
      async (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          const refreshToken = useAuthStore.getState().refreshToken;
          if (refreshToken) {
            try {
              // Prevent multiple concurrent refresh attempts
              if (!this.refreshPromise) {
                this.refreshPromise = this.refreshAccessToken(refreshToken);
              }
              const response = await this.refreshPromise;
              this.refreshPromise = null;
              useAuthStore.getState().setTokens(response.accessToken, response.refreshToken);
              // Retry original request
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${response.accessToken}`;
                return this.client.request(error.config);
              }
            } catch {
              this.refreshPromise = null;
              useAuthStore.getState().logout();
            }
          }
        }
        throw error;
      }
    );
  }

  private async refreshAccessToken(refreshToken: string) {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
    return response.data?.data ?? response.data;
  }

  // ============================================
  // AUTH
  // ============================================

  async register(data: { organizationName: string; email: string; password: string; name: string }) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  async logout() {
    await this.client.post('/auth/logout');
  }

  async updateAiSettings(data: { defaultProvider?: string; anthropicApiKey?: string; openaiApiKey?: string }) {
    const response = await this.client.put('/auth/ai-settings', data);
    return response.data;
  }

  async forgotPassword(email: string) {
    await this.client.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string) {
    await this.client.post('/auth/reset-password', { token, password });
  }

  // ============================================
  // ORGANIZATION
  // ============================================

  async getOrganization(id: string) {
    const response = await this.client.get(`/organizations/${id}`);
    return response.data;
  }

  async updateOrganization(id: string, data: Partial<{ name: string; settings: object }>) {
    const response = await this.client.put(`/organizations/${id}`, data);
    return response.data;
  }

  async getOrganizationUsers(orgId: string) {
    const response = await this.client.get(`/organizations/${orgId}/users`);
    return response.data;
  }

  async inviteUser(orgId: string, data: { email: string; name: string; role: string }) {
    const response = await this.client.post(`/organizations/${orgId}/users`, data);
    return response.data;
  }

  async removeUser(orgId: string, userId: string) {
    await this.client.delete(`/organizations/${orgId}/users/${userId}`);
  }

  async updateUserRole(orgId: string, userId: string, role: string) {
    const response = await this.client.put(`/organizations/${orgId}/users/${userId}`, { role });
    return response.data;
  }

  // ============================================
  // API KEYS
  // ============================================

  async getApiKeys() {
    const response = await this.client.get('/api-keys');
    return response.data;
  }

  async createApiKey(data: { name: string; permissions?: object; rateLimits?: object; expiresAt?: string }) {
    const response = await this.client.post('/api-keys', data);
    return response.data;
  }

  async updateApiKey(id: string, data: { name?: string; permissions?: object; rateLimits?: object }) {
    const response = await this.client.put(`/api-keys/${id}`, data);
    return response.data;
  }

  async revokeApiKey(id: string) {
    await this.client.delete(`/api-keys/${id}`);
  }

  async rotateApiKey(id: string) {
    const response = await this.client.post(`/api-keys/${id}/rotate`);
    return response.data;
  }

  // ============================================
  // MEDIA
  // ============================================

  async uploadMedia(file: File, onProgress?: (progress: number) => void) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
    return response.data;
  }

  async uploadMediaFromUrl(url: string) {
    const response = await this.client.post('/media/upload-url', { url });
    return response.data;
  }

  async getMediaList(params?: { page?: number; limit?: number; mediaType?: string }) {
    const response = await this.client.get('/media', { params });
    return response.data;
  }

  async getMedia(id: string) {
    const response = await this.client.get(`/media/${id}`);
    return response.data;
  }

  async deleteMedia(id: string) {
    await this.client.delete(`/media/${id}`);
  }

  getMediaDownloadUrl(id: string) {
    return `${API_BASE_URL}/media/${id}/download`;
  }

  async downloadMedia(id: string, filename?: string) {
    const response = await this.client.get(`/media/${id}/download`, {
      responseType: 'blob',
    });
    // Try to get filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    const headerFilename = contentDisposition?.match(/filename="?(.+?)"?$/)?.[1];
    const finalFilename = headerFilename || filename || 'download';
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async downloadJobResult(id: string) {
    // First get the job result metadata to find the media ID
    const result = await this.client.get(`/jobs/${id}/result`);
    const data = result.data;
    if (data?.mediaId) {
      // Download the actual file via media endpoint
      await this.downloadMedia(data.mediaId, data.data?.filename || 'result');
    } else {
      // JSON result - download as JSON file
      const blob = new Blob([JSON.stringify(data?.data || data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'result.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  // ============================================
  // ACTIONS
  // ============================================

  async getActions() {
    const response = await this.client.get('/actions');
    return response.data;
  }

  async getActionsByMediaType(mediaType: string) {
    const response = await this.client.get(`/actions/${mediaType}`);
    return response.data;
  }

  async getAction(mediaType: string, actionId: string) {
    const response = await this.client.get(`/actions/${mediaType}/${actionId}`);
    return response.data;
  }

  // ============================================
  // JOBS
  // ============================================

  async submitJob(data: { mediaId: string; actionId: string; parameters: object }) {
    const response = await this.client.post('/process', data);
    return response.data;
  }

  async getJobs(params?: { page?: number; limit?: number; status?: string }) {
    const response = await this.client.get('/jobs', { params });
    return response.data;
  }

  async getJob(id: string) {
    const response = await this.client.get(`/jobs/${id}`);
    return response.data;
  }

  async cancelJob(id: string) {
    await this.client.delete(`/jobs/${id}`);
  }

  async deleteJob(id: string, deleteResultFile = false) {
    await this.client.delete(`/jobs/${id}`, {
      params: { permanent: 'true', deleteResultFile: deleteResultFile ? 'true' : 'false' },
    });
  }

  getJobResultUrl(id: string) {
    return `${API_BASE_URL}/jobs/${id}/result`;
  }

  // ============================================
  // USAGE
  // ============================================

  async getUsageSummary() {
    const response = await this.client.get('/usage');
    return response.data;
  }

  async getUsageDetailed(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get('/usage/detailed', { params });
    return response.data;
  }

  async getUsageByApiKey(keyId: string) {
    const response = await this.client.get(`/usage/by-key/${keyId}`);
    return response.data;
  }

  async exportUsage(format: 'csv' | 'json') {
    const response = await this.client.get('/usage/export', { params: { format } });
    return response.data;
  }

  // ============================================
  // ADMIN (Super Admin)
  // ============================================

  async adminGetOrganizations(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/admin/organizations', { params });
    return response.data;
  }

  async adminCreateOrganization(data: {
    name: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
  }) {
    const response = await this.client.post('/admin/organizations', data);
    return response.data;
  }

  async adminDeleteOrganization(orgId: string) {
    await this.client.delete(`/admin/organizations/${orgId}`);
  }

  async adminGetOrgUsers(orgId: string, params?: { page?: number; limit?: number }) {
    const response = await this.client.get(`/admin/organizations/${orgId}/users`, { params });
    return response.data;
  }

  async adminDeleteUser(orgId: string, userId: string) {
    await this.client.delete(`/admin/organizations/${orgId}/users/${userId}`);
  }

  // ============================================
  // SYSTEM
  // ============================================

  async getHealth() {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getSupportedFormats() {
    const response = await this.client.get('/supported-formats');
    return response.data;
  }

  async getRateLimits() {
    const response = await this.client.get('/rate-limits');
    return response.data;
  }
}

export const api = new ApiClient();
