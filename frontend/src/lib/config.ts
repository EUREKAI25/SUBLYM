// Configuration de l'API
// Switcher entre dev et prod via variable d'environnement

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Pricing
export const PRICE_VIDEO = 17; // euros
export const PRICE_PHOTO = 5; // euros (future feature)

// App settings
export const MIN_PHOTOS_REQUIRED = 1;
export const MAX_PHOTOS_USER = 5;
export const MAX_PHOTOS_OTHER = 5;
export const MAX_PHOTOS_DECOR = 3;
export const MIN_DREAM_LENGTH = 20;

export const API_ENDPOINTS = {
  // Auth
  requestMagicLink: `${API_BASE_URL}/auth/magic-link`,
  verifyToken: `${API_BASE_URL}/auth/verify`,
  me: `${API_BASE_URL}/auth/me`,
  logout: `${API_BASE_URL}/auth/logout`,

  // Photos
  uploadPhoto: `${API_BASE_URL}/photos/upload`,
  photos: `${API_BASE_URL}/photos`,
  photo: (id: string) => `${API_BASE_URL}/photos/${id}`,
  verifyPhotos: `${API_BASE_URL}/photos/verify`,

  // Dreams
  dreams: `${API_BASE_URL}/dreams`,
  dream: (id: string) => `${API_BASE_URL}/dreams/${id}`,
  generateDream: (id: string) => `${API_BASE_URL}/dreams/${id}/generate`,

  // Runs
  runStatus: (runId: string) => `${API_BASE_URL}/runs/${runId}`,
  cancelRun: (runId: string) => `${API_BASE_URL}/runs/${runId}/cancel`,
  runVideo: (runId: string) => `${API_BASE_URL}/runs/${runId}/video`,
  runTeaser: (runId: string) => `${API_BASE_URL}/runs/${runId}/teaser`,
  runKeyframes: (runId: string) => `${API_BASE_URL}/runs/${runId}/keyframes`,

  // Payment
  createPayment: `${API_BASE_URL}/payment/create-session`,
  paymentStatus: (sessionId: string) => `${API_BASE_URL}/payment/status/${sessionId}`,
  paymentHistory: `${API_BASE_URL}/payment/history`,

  // Subscription
  subscription: `${API_BASE_URL}/subscription`,
  cancelSubscription: `${API_BASE_URL}/subscription/cancel`,
  reactivateSubscription: `${API_BASE_URL}/subscription/reactivate`,
  billingPortal: `${API_BASE_URL}/subscription/portal`,
  invoices: `${API_BASE_URL}/subscription/invoices`,

  // Runs (list)
  runs: `${API_BASE_URL}/runs`,

  // Contact
  contact: `${API_BASE_URL}/contact`,

  // Legal
  legalDocument: (type: string) => `${API_BASE_URL}/legal/${type}`,
  legalDocumentDownload: (type: string) => `${API_BASE_URL}/legal/${type}/download`,

  // Smile
  smileStatus: `${API_BASE_URL}/smile/status`,
  uploadReaction: `${API_BASE_URL}/smile/upload`,
  smileComment: `${API_BASE_URL}/smile/comment`,
};

// Helpers pour les requêtes
export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  return response;
};

export const fetchUpload = async (url: string, formData: FormData) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
    },
    body: formData,
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  return response;
};
