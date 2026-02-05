import { useAuthStore } from './store';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiError {
  error: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = useAuthStore.getState().token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders();

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'An error occurred',
      }));

      // Handle 401 - token expired
      if (response.status === 401) {
        useAuthStore.getState().logout();
      }

      throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = useAuthStore.getState().token;
    const headers: HeadersInit = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: 'Upload failed',
      }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }
}

export const api = new ApiClient(API_URL);

// ===========================================
// API TYPES
// ===========================================

export interface User {
  id: string;
  navigationMode: 'scroll' | 'swipe';
  gestureSensitivity: number;
  useDreamTheme: boolean;
  themePreference: 'system' | 'light' | 'dark';
  createdAt: string;
}

export interface Dream {
  id: string;
  title: string | null;
  description: string;
  rejectText: string | null;
  status: 'active' | 'inactive' | 'realized';
  isActive: boolean;
  palette: Record<string, string> | null;
  backgroundAssetId: string | null;
  thumbnailUrl: string | null;
  imagesCount: number;
  markersCount: number;
  createdAt: string;
  realizedAt: string | null;
}

export interface ImageAsset {
  id: string;
  kind: 'user_photo' | 'dream_image' | 'wallpaper';
  source: 'upload' | 'ai' | 'webcam';
  url: string;
  width: number | null;
  height: number | null;
  isEnabled: boolean;
  isFavorite: boolean;
  createdAt: string;
}

export interface ViewerData {
  id: string;
  title: string | null;
  palette: Record<string, string> | null;
  backgroundAssetId: string | null;
  navigationMode: 'scroll' | 'swipe';
  images: Array<{
    id: string;
    url: string;
    width: number | null;
    height: number | null;
    isFavorite: boolean;
  }>;
  loop: boolean;
}

// ===========================================
// API FUNCTIONS
// ===========================================

// Auth
export const authApi = {
  validateAccessCode: (code: string) =>
    api.post<{
      status: 'new_user' | 'existing_user';
      accessCodeId?: string;
      userId?: string;
      source?: string;
    }>('/auth/access-code', { code }),

  createPin: (accessCodeId: string, pin: string) =>
    api.post<{ status: string; token: string; user: User }>('/auth/create-pin', {
      accessCodeId,
      pin,
    }),

  verifyPin: (userId: string, pin: string) =>
    api.post<{ status: string; token: string; user: User }>('/auth/verify-pin', {
      userId,
      pin,
    }),

  lock: () => api.post('/auth/lock'),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<User>('/auth/me'),
};

// Dreams
export const dreamsApi = {
  list: () => api.get<{ dreams: Dream[] }>('/dreams'),

  get: (id: string) => api.get<{ dream: Dream }>(`/dreams/${id}`),

  create: (data: { title?: string; description: string; rejectText?: string }) =>
    api.post<{ dream: Dream }>('/dreams', data),

  update: (id: string, data: Partial<Dream>) =>
    api.patch<{ dream: Dream }>(`/dreams/${id}`, data),

  delete: (id: string) => api.delete(`/dreams/${id}`),

  generate: (id: string) =>
    api.post<{ status: string; jobId: string; traceId: string }>(
      `/dreams/${id}/generate`
    ),

  getViewer: (id: string) => api.get<ViewerData>(`/dreams/${id}/viewer`),
};

// Assets
export const assetsApi = {
  list: (params?: { kind?: string; dreamId?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.kind) searchParams.set('kind', params.kind);
    if (params?.dreamId) searchParams.set('dreamId', params.dreamId);
    const query = searchParams.toString();
    return api.get<{ assets: ImageAsset[] }>(`/assets${query ? `?${query}` : ''}`);
  },

  upload: (file: File, dreamId?: string, kind?: string, source?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (dreamId) formData.append('dreamId', dreamId);
    if (kind) formData.append('kind', kind);
    if (source) formData.append('source', source);
    return api.upload<{ asset: ImageAsset }>('/assets/upload', formData);
  },

  update: (id: string, data: { isEnabled?: boolean; isFavorite?: boolean }) =>
    api.patch<{ asset: ImageAsset }>(`/assets/${id}`, data),

  delete: (id: string) => api.delete(`/assets/${id}`),

  setBackground: (id: string) => api.post(`/assets/${id}/set-background`),

  getWallpaper: (id: string) =>
    api.get<{ url: string; instructions: { ios: string; android: string } }>(
      `/assets/${id}/wallpaper`
    ),
};

// Users
export const usersApi = {
  getSettings: () => api.get<User>('/users/settings'),

  updateSettings: (data: Partial<User>) =>
    api.patch<User>('/users/settings', data),

  changePin: (currentPin: string, newPin: string) =>
    api.post('/users/change-pin', { currentPin, newPin }),

  getStats: () =>
    api.get<{
      dreams: { total: number; realized: number };
      photos: { uploaded: number; maxAllowed: number };
      generated: { images: number };
      markers: number;
      memberSince: string;
    }>('/users/stats'),

  deleteAccount: (pin: string) =>
    api.delete('/users/account'),

  exportData: () => api.get('/users/export'),
};
