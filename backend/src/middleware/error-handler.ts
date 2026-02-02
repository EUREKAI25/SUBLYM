// SUBLYM Backend - Error Handler Middleware

import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

// ============================================
// CUSTOM ERRORS
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('RATE_LIMIT', message, 429);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super('SERVICE_UNAVAILABLE', message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

// ============================================
// ERROR HANDLER
// ============================================

export function errorHandler(err: Error, c: Context) {
  console.error('Error:', err);

  // AppError (custom errors)
  if (err instanceof AppError) {
    return c.json({
      error: err.code,
      message: err.message,
      details: err.details,
    }, err.statusCode as any);
  }

  // Hono HTTPException
  if (err instanceof HTTPException) {
    return c.json({
      error: 'HTTP_ERROR',
      message: err.message,
    }, err.status);
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    
    // Unique constraint violation
    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field';
      return c.json({
        error: 'DUPLICATE_ENTRY',
        message: `A record with this ${field} already exists`,
      }, 409);
    }
    
    // Record not found
    if (prismaError.code === 'P2025') {
      return c.json({
        error: 'NOT_FOUND',
        message: 'Record not found',
      }, 404);
    }
    
    // Foreign key constraint
    if (prismaError.code === 'P2003') {
      return c.json({
        error: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
      }, 400);
    }
  }

  // Validation errors (Zod, etc.)
  if (err.name === 'ZodError') {
    const zodError = err as any;
    return c.json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: {
        errors: zodError.errors,
      },
    }, 400);
  }

  // JWT errors
  if (err.name === 'JwtTokenExpired') {
    return c.json({
      error: 'TOKEN_EXPIRED',
      message: 'Token has expired',
    }, 401);
  }

  if (err.name === 'JwtTokenInvalid') {
    return c.json({
      error: 'INVALID_TOKEN',
      message: 'Invalid token',
    }, 401);
  }

  // Generic error (don't expose details in production)
  const isDev = process.env.NODE_ENV === 'development';
  
  return c.json({
    error: 'INTERNAL_ERROR',
    message: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  }, 500);
}
