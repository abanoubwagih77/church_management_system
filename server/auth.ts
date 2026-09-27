import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import { User, PermissionKey } from '../src/types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'st_george_church_servants_secure_jwt_2026';

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantChurchId?: string;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      scope: user.scope,
      church_id: user.church_id || null,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function authenticateJwt(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const db = getDb();
    const user = db.users.find((u) => u.id === decoded.id);

    if (!user) {
      res.status(401).json({ error: 'المستخدم غير موجود' });
      return;
    }

    if (user.status === 'disabled') {
      res.status(403).json({ error: 'تم تعطيل هذا الحساب من قبل الإدارة' });
      return;
    }

    // Tenant check: if user belongs to a church, verify church is not suspended
    if (user.church_id) {
      const church = db.churches?.find((c) => c.id === user.church_id);
      if (church && (church.status === 'suspended' || church.status === 'inactive')) {
        res.status(403).json({
          error: 'تم إيقاف حساب هذه الكنيسة مؤقتاً من قبل إدارة المنصة. يرجى التواصل مع الإدارة المركزية.',
          church_status: church.status,
        });
        return;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'جلسة تسجيل الدخول منتهية أو غير صالحة' });
  }
}

export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'صلاحية الإدارة المركزية (Super Admin) مطلوبة لتنفيذ هذا الإجراء' });
    return;
  }
  next();
}

/**
 * Resolves the effective church_id for the request:
 * - For normal users, it is strictly their own user.church_id.
 * - For super_admin, they can provide 'x-church-id' header or query param if inspecting a church.
 */
export function getEffectiveChurchId(req: AuthenticatedRequest): string | null {
  if (!req.user) return null;
  if (req.user.church_id) {
    return req.user.church_id;
  }
  if (req.user.role === 'super_admin') {
    const customHeader = (req.headers['x-church-id'] as string) || (req.headers['x-tenant-id'] as string);
    if (customHeader && customHeader !== 'null' && customHeader !== 'undefined') {
      return customHeader;
    }
    const queryChurch = req.query.church_id as string;
    if (queryChurch && queryChurch !== 'null' && queryChurch !== 'undefined') {
      return queryChurch;
    }
    return null;
  }
  return null;
}

export function requirePermission(...permissions: PermissionKey[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'غير مصرح' });
      return;
    }

    // Super Admin or Church Admin or Priest with full_access bypasses
    if (
      req.user.role === 'super_admin' ||
      req.user.role === 'church_admin' ||
      req.user.role === 'priest' ||
      req.user.permissions.includes('full_access')
    ) {
      next();
      return;
    }

    const hasAny = permissions.some((p) => req.user?.permissions.includes(p));
    if (!hasAny) {
      res.status(403).json({
        error: 'ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء',
        required_permissions: permissions,
      });
      return;
    }

    next();
  };
}

export function checkScopeAccess(user: User, serviceId?: string): boolean {
  if (
    user.role === 'super_admin' ||
    user.role === 'priest' ||
    user.role === 'general_secretary' ||
    user.scope === 'all' ||
    !serviceId
  ) {
    return true;
  }
  return user.scope === serviceId;
}
