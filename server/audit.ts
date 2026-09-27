import { getDb, saveLocalDatabaseOnly } from './db.js';
import { db as firestoreDb } from './firebase.js';
import { doc, updateDoc } from 'firebase/firestore';
import { AuditLog } from '../src/types/index.js';

export interface AuditParams {
  userId?: string;
  username: string;
  churchId?: string | null;
  action: string;
  targetType: string;
  targetId?: string;
  targetName?: string;
  description: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
}

export function logAudit(params: AuditParams): AuditLog {
  const db = getDb();
  
  // Resolve church_id: explicit param or user's church_id
  let resolvedChurchId: string | null = null;
  if (params.churchId !== undefined && params.churchId !== null) {
    resolvedChurchId = params.churchId;
  } else if (params.userId) {
    const user = db.users?.find((u) => u.id === params.userId);
    resolvedChurchId = user?.church_id || null;
  }

  // Sanitize changes to strictly prevent sensitive info like passwords or full national IDs from appearing in logs
  const sanitize = (obj?: Record<string, any>) => {
    if (!obj) return undefined;
    const clean: Record<string, any> = { ...obj };
    const sensitiveKeys = ['password', 'password_hash', 'token', 'secret', 'national_id'];
    for (const key of Object.keys(clean)) {
      if (sensitiveKeys.includes(key.toLowerCase())) {
        clean[key] = '[HIDDEN_PROTECTED_DATA]';
      }
    }
    return clean;
  };

  const newLog: AuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: params.userId,
    username: params.username,
    church_id: resolvedChurchId || undefined,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    target_name: params.targetName,
    description: params.description,
    ip_address: params.ipAddress,
    metadata: sanitize(params.metadata),
    changes: params.changes
      ? {
          before: sanitize(params.changes.before),
          after: sanitize(params.changes.after),
        }
      : undefined,
    timestamp: new Date().toISOString(),
  };

  // Prepend so latest appears first
  db.audit_logs.unshift(newLog);
  // Cap at 20,000 logs to preserve performance while retaining rich historical audit
  if (db.audit_logs.length > 20000) {
    db.audit_logs = db.audit_logs.slice(0, 20000);
  }
  
  saveLocalDatabaseOnly();

  // Safely update Firestore meta document directly for audit logs without overwriting other collections
  if (firestoreDb) {
    try {
      const sanitizedLogs = JSON.parse(JSON.stringify(db.audit_logs.slice(0, 300)));
      const metaDocRef = doc(firestoreDb, 'system_data', 'meta');
      updateDoc(metaDocRef, {
        'items.audit_logs': sanitizedLogs,
        updated_at: new Date().toISOString(),
      }).catch((err) => {
        console.warn('Non-blocking Firestore audit log update warning:', err?.message || err);
      });
    } catch (e) {
      console.warn('Failed to dispatch Firestore audit log update:', e);
    }
  }

  return newLog;
}
