import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { authenticateJwt, requirePermission, getEffectiveChurchId, AuthenticatedRequest } from '../auth.js';

export const auditRouter = Router();

auditRouter.use(authenticateJwt);

// GET /api/audit - List audit logs with filters
auditRouter.get('/', requirePermission('view_history'), (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const db = getDb();
  const churchId = getEffectiveChurchId(req);
  let logs = [...db.audit_logs];

  if (user.role !== 'super_admin') {
    // Church users only see logs belonging strictly to their own church, never platform or other church operations
    if (churchId) {
      logs = logs.filter(
        (l) =>
          l.church_id === churchId &&
          l.target_type !== 'CHURCH' &&
          !l.action.startsWith('SUPER_ADMIN')
      );
    } else {
      logs = [];
    }
  } else {
    // Super admin can filter by a specific church if requested or if managing a church
    const filterChurchId = req.query.church_id ? String(req.query.church_id) : (churchId || '');
    if (filterChurchId) {
      logs = logs.filter((l) => l.church_id === filterChurchId);
    }
  }

  const username = req.query.username ? String(req.query.username).trim().toLowerCase() : '';
  if (username) {
    logs = logs.filter((l) => l.username.toLowerCase().includes(username));
  }

  const action = req.query.action ? String(req.query.action).trim() : '';
  if (action) {
    logs = logs.filter((l) => l.action === action);
  }

  const targetType = req.query.target_type ? String(req.query.target_type).trim() : '';
  if (targetType) {
    logs = logs.filter((l) => l.target_type === targetType);
  }

  const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
  if (search) {
    logs = logs.filter(
      (l) =>
        l.description.toLowerCase().includes(search) ||
        (l.target_name && l.target_name.toLowerCase().includes(search)) ||
        l.action.toLowerCase().includes(search)
    );
  }

  const fromDate = req.query.from_date ? String(req.query.from_date) : '';
  if (fromDate) {
    logs = logs.filter((l) => l.timestamp >= fromDate);
  }

  const toDate = req.query.to_date ? String(req.query.to_date) : '';
  if (toDate) {
    logs = logs.filter((l) => l.timestamp <= `${toDate}T23:59:59.999Z`);
  }

  // Privacy rule: Only Super Admin or users with manage_permissions can view IP addresses
  const canViewIp = user.role === 'super_admin' || user.permissions.includes('manage_permissions');

  const sanitizedLogs = logs.map((l) => ({
    ...l,
    ip_address: canViewIp ? l.ip_address : undefined,
  }));

  res.json({
    success: true,
    total: sanitizedLogs.length,
    logs: sanitizedLogs.slice(0, 200), // Return top 200 latest for performance
  });
});
