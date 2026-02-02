// SUBLYM Backend - Types
// Global TypeScript types

import type { User, AdminUser } from '@prisma/client';

// ============================================
// AUTH
// ============================================

export interface JWTPayload {
  sub: number; // User ID
  email: string;
  type: 'access' | 'refresh';
  jti: string; // JWT ID for revocation
  iat: number;
  exp: number;
}

export interface AdminJWTPayload {
  sub: number; // Admin ID
  email: string;
  role: 'admin' | 'superadmin';
  type: 'admin_access';
  jti: string;
  iat: number;
  exp: number;
}

// ============================================
// CONTEXT
// ============================================

export interface AuthContext {
  user: User;
  jti: string;
}

export interface AdminContext {
  admin: AdminUser;
  jti: string;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// ============================================
// AUTH REQUESTS
// ============================================

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  lang?: string;
  invitationCode?: string;
  rgpdConsent: boolean;
  marketingConsent?: boolean;
}

export interface MagicLinkRequest {
  email: string;
  lang?: string;
}

export interface VerifyTokenRequest {
  token: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ============================================
// DREAM REQUESTS
// ============================================

export interface CreateDreamRequest {
  description: string;
  reject?: string[];
}

export interface UpdateDreamRequest {
  description?: string;
  reject?: string[];
}

export interface GenerateDreamRequest {
  subliminalText?: string;
}

// ============================================
// PAYMENT REQUESTS
// ============================================

export interface CreateCheckoutRequest {
  level: number;
  period: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

// ============================================
// TESTIMONIAL REQUESTS
// ============================================

export interface CreateTestimonialRequest {
  text: string;
  rating?: number;
  consentDisplay: boolean;
  consentMarketing?: boolean;
}

// ============================================
// CONTACT REQUESTS
// ============================================

export interface ContactRequest {
  email: string;
  name?: string;
  subject?: string;
  message: string;
}

// ============================================
// ADMIN REQUESTS
// ============================================

export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface CreateInvitationRequest {
  description?: string;
  maxUses?: number;
  freeGenerations?: number;
  expiresInDays?: number;
  targetEmail?: string;
  targetPhone?: string;
}

export interface UpdateConfigRequest {
  configs: Array<{
    key: string;
    value: string;
  }>;
}

export interface UpdateTextsRequest {
  texts: Array<{
    lang: string;
    key: string;
    value: string;
  }>;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  subscriptionLevel?: number;
  freeGenerations?: number;
  isTestAccount?: boolean;
}

// ============================================
// GENERATION
// ============================================

export interface ProgressData {
  progress: number;
  step: string;
  message: string;
}

export interface GenerationResult {
  success: boolean;
  videoPath?: string;
  teaserPath?: string;
  keyframesZipPath?: string;
  scenarioName?: string;
  scenesCount?: number;
  duration?: number;
  costEur?: number;
  costDetails?: Record<string, number>;
  error?: string;
}

// ============================================
// SMILE
// ============================================

export interface SmileStartRequest {
  // No body required
}

export interface SmileConfirmRequest {
  // No body required
}

// ============================================
// FILTERS
// ============================================

export interface UserFilters {
  email?: string;
  country?: string;
  lang?: string;
  subscriptionLevel?: number;
  createdAfter?: string;
  createdBefore?: string;
  isTestAccount?: boolean;
  deleted?: boolean;
}

export interface TestimonialFilters {
  status?: 'pending' | 'approved' | 'rejected';
  userId?: number;
}

export interface PaymentFilters {
  status?: string;
  userId?: number;
  createdAfter?: string;
  createdBefore?: string;
}

export interface InvitationFilters {
  enabled?: boolean;
  expired?: boolean;
}
