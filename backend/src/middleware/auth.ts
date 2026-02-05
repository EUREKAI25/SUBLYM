// SUBLYM Backend - Auth Middleware
// JWT authentication middleware

import { Context, Next } from 'hono';
import { verify } from 'hono/jwt';
import { prisma } from '../db';
import type { JWTPayload, AdminJWTPayload, AuthContext, AdminContext } from '../types';

// ============================================
// USER AUTH MIDDLEWARE
// ============================================

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as JWTPayload;

    // Check token type
    if (payload.type !== 'access') {
      return c.json({
        error: 'INVALID_TOKEN',
        message: 'Invalid token type',
      }, 401);
    }
    
    // Check if token is revoked
    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });
    
    if (revoked) {
      return c.json({
        error: 'TOKEN_REVOKED',
        message: 'Token has been revoked',
      }, 401);
    }
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    
    if (!user) {
      return c.json({
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      }, 401);
    }
    
    // Check if user is soft deleted
    if (user.deletedAt) {
      return c.json({
        error: 'USER_DELETED',
        message: 'Account has been deleted',
      }, 401);
    }
    
    // Set user in context
    const authContext: AuthContext = {
      user,
      jti: payload.jti,
    };
    c.set('auth', authContext);
    
    await next();
  } catch (error) {
    return c.json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token',
    }, 401);
  }
}

// ============================================
// ADMIN AUTH MIDDLEWARE
// ============================================

export async function adminMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid authorization header',
    }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as AdminJWTPayload;
    
    // Check token type
    if (payload.type !== 'admin_access') {
      return c.json({
        error: 'INVALID_TOKEN',
        message: 'Invalid token type',
      }, 401);
    }
    
    // Check if token is revoked
    const revoked = await prisma.revokedToken.findUnique({
      where: { jti: payload.jti },
    });
    
    if (revoked) {
      return c.json({
        error: 'TOKEN_REVOKED',
        message: 'Token has been revoked',
      }, 401);
    }
    
    // Get admin
    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    
    if (!admin) {
      return c.json({
        error: 'ADMIN_NOT_FOUND',
        message: 'Admin not found',
      }, 401);
    }
    
    // Set admin in context
    const adminContext: AdminContext = {
      admin,
      jti: payload.jti,
    };
    c.set('admin', adminContext);
    
    await next();
  } catch (error) {
    return c.json({
      error: 'INVALID_TOKEN',
      message: 'Invalid or expired token',
    }, 401);
  }
}

// ============================================
// SUPERADMIN MIDDLEWARE
// ============================================

export async function superadminMiddleware(c: Context, next: Next) {
  // First run admin middleware
  const adminContext = c.get('admin') as AdminContext | undefined;
  
  if (!adminContext) {
    return c.json({
      error: 'UNAUTHORIZED',
      message: 'Admin authentication required',
    }, 401);
  }
  
  if (adminContext.admin.role !== 'superadmin') {
    return c.json({
      error: 'FORBIDDEN',
      message: 'Superadmin access required',
    }, 403);
  }
  
  await next();
}

// ============================================
// OPTIONAL AUTH MIDDLEWARE
// ============================================

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth, continue without user
    await next();
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verify(token, process.env.JWT_SECRET!, 'HS256') as JWTPayload;

    if (payload.type === 'access') {
      const revoked = await prisma.revokedToken.findUnique({
        where: { jti: payload.jti },
      });
      
      if (!revoked) {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
        });
        
        if (user && !user.deletedAt) {
          const authContext: AuthContext = {
            user,
            jti: payload.jti,
          };
          c.set('auth', authContext);
        }
      }
    }
  } catch {
    // Invalid token, continue without user
  }
  
  await next();
}

// ============================================
// SUBSCRIPTION CHECK MIDDLEWARE
// ============================================

export function requireSubscription(minLevel: number = 1) {
  return async (c: Context, next: Next) => {
    const authContext = c.get('auth') as AuthContext | undefined;
    
    if (!authContext) {
      return c.json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      }, 401);
    }
    
    const { user } = authContext;
    
    // Check subscription level
    if (user.subscriptionLevel < minLevel) {
      // Check if user has free generations
      if (user.freeGenerations > 0) {
        await next();
        return;
      }
      
      return c.json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: `Subscription level ${minLevel} or higher required`,
      }, 403);
    }
    
    // Check subscription expiry
    if (user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) {
      return c.json({
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired',
      }, 403);
    }
    
    await next();
  };
}

// ============================================
// HELPERS
// ============================================

export function getAuthContext(c: Context): AuthContext {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) {
    throw new Error('Auth context not found');
  }
  return auth;
}

export function getAdminContext(c: Context): AdminContext {
  const admin = c.get('admin') as AdminContext | undefined;
  if (!admin) {
    throw new Error('Admin context not found');
  }
  return admin;
}

export function getOptionalAuthContext(c: Context): AuthContext | undefined {
  return c.get('auth') as AuthContext | undefined;
}
