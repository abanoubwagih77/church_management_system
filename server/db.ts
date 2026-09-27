import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db as firestoreDb } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  runTransaction,
  increment,
} from 'firebase/firestore';
import {
  User,
  Servant,
  ChurchService,
  ServiceAssignment,
  AttendanceRecord,
  AuditLog,
  ScannerDevice,
  DeviceRegistrationCode,
  GeneralMeetingRecord,
  GeneralMeeting,
  Church,
} from '../src/types/index.js';

export interface DatabaseSchema {
  churches: Church[];
  users: User[];
  servants: Servant[];
  services: ChurchService[];
  assignments: ServiceAssignment[];
  attendance: AttendanceRecord[];
  audit_logs: AuditLog[];
  scanner_devices: ScannerDevice[];
  registration_codes: DeviceRegistrationCode[];
  general_meeting_records: GeneralMeetingRecord[];
  general_meetings: GeneralMeeting[];
  rate_limits: Record<string, { count: number; reset_time: number }>;
}

// In Vercel serverless environment, the filesystem is read-only except for /tmp
const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
const DB_DIR = isVercel ? '/tmp' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'database.json');
const SEED_FILE = path.join(process.cwd(), 'data', 'database.json');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbData: DatabaseSchema;
let pendingFirestoreWrite: Promise<any> | null = null;
let isInitialSyncDone = false;
let syncPromise: Promise<void> | null = null;
let lastSyncedAt: number = 0;
let lastPushedAt: number = 0;
let lastSyncError: string | null = null;
let isFirestoreQuotaExhausted = false;
let firestoreQuotaResetTime = 0;
let firestorePushTimeout: NodeJS.Timeout | null = null;

export function getCloudSyncInfo() {
  return {
    isCloudConnected: Boolean(firestoreDb),
    databaseId: 'ai-studio-churchservantsma-bc52da4f-f7ee-4431-b656-15d224f5a4eb',
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
    lastPushedAt: lastPushedAt ? new Date(lastPushedAt).toISOString() : null,
    lastSyncError,
    isQuotaExhausted: isFirestoreQuotaExhausted && Date.now() < firestoreQuotaResetTime,
    churchesCount: dbData?.churches?.length || 0,
    usersCount: dbData?.users?.length || 0,
    servantsCount: dbData?.servants?.length || 0,
    attendanceCount: dbData?.attendance?.length || 0,
  };
}

// Deleted items tracker to prevent resurrection of locally deleted items by background sync
const recentlyDeletedIds = new Map<string, number>();

export function recordDeletedId(id: string): void {
  recentlyDeletedIds.set(id, Date.now());
}

// Smart merge helpers: guarantees remote Firestore remains the source of truth,
// while protecting newly created/updated local items from being prematurely discarded.
function mergeCollection<T extends { id: string; updated_at?: string; created_at?: string }>(
  localItems: T[] = [],
  remoteItems: T[] = []
): T[] {
  const map = new Map<string, T>();
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  // Clean expired deleted ids
  for (const [id, time] of recentlyDeletedIds.entries()) {
    if (time < tenMinutesAgo) {
      recentlyDeletedIds.delete(id);
    }
  }

  // 1. Remote items first (excluding locally confirmed deletions)
  for (const item of remoteItems) {
    if (item && item.id && !recentlyDeletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }

  // 2. Evaluate local items
  for (const local of localItems) {
    if (!local || !local.id || recentlyDeletedIds.has(local.id)) continue;
    const remote = map.get(local.id);
    if (!remote) {
      // If item was created or updated recently, preserve it so sync never drops newly added items!
      const createdTime = local.created_at ? new Date(local.created_at).getTime() : 0;
      const updatedTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (createdTime > tenMinutesAgo || updatedTime > tenMinutesAgo || !isProduction) {
        map.set(local.id, local);
      }
    } else {
      // Item exists in both: compare updated_at timestamps
      const localTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      const remoteTime = remote.updated_at ? new Date(remote.updated_at).getTime() : 0;
      if (localTime > remoteTime) {
        map.set(local.id, local);
      }
    }
  }
  return Array.from(map.values());
}

function mergeById<T extends { id: string; created_at?: string; updated_at?: string }>(
  localItems: T[] = [],
  remoteItems: T[] = []
): T[] {
  const map = new Map<string, T>();
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

  for (const item of remoteItems) {
    if (item && item.id && !recentlyDeletedIds.has(item.id)) {
      map.set(item.id, item);
    }
  }
  for (const local of localItems) {
    if (!local || !local.id || recentlyDeletedIds.has(local.id)) continue;
    if (!map.has(local.id)) {
      const createdTime = local.created_at ? new Date(local.created_at).getTime() : 0;
      const updatedTime = local.updated_at ? new Date(local.updated_at).getTime() : 0;
      if (createdTime > tenMinutesAgo || updatedTime > tenMinutesAgo || !isProduction) {
        map.set(local.id, local);
      }
    }
  }
  return Array.from(map.values());
}

export async function syncFromFirestore(): Promise<void> {
  if (!firestoreDb) return;
  try {
    // Timeout promise to ensure requests never hang indefinitely on Firestore network latency.
    const timeoutMs = (!isInitialSyncDone && isProduction) ? 8000 : 5000;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

    // 1. Try partitioned documents in collection 'system_data'
    const usersDocRef = doc(firestoreDb, 'system_data', 'users');
    const churchesDocRef = doc(firestoreDb, 'system_data', 'churches');
    const servantsDocRef = doc(firestoreDb, 'system_data', 'servants');
    const servicesDocRef = doc(firestoreDb, 'system_data', 'services');
    const attendanceDocRef = doc(firestoreDb, 'system_data', 'attendance');
    const metaDocRef = doc(firestoreDb, 'system_data', 'meta');

    const [usersSnap, churchesSnap, servantsSnap, servicesSnap, attendanceSnap, metaSnap] = await Promise.race([
      Promise.all([
        getDoc(usersDocRef).catch(() => null),
        getDoc(churchesDocRef).catch(() => null),
        getDoc(servantsDocRef).catch(() => null),
        getDoc(servicesDocRef).catch(() => null),
        getDoc(attendanceDocRef).catch(() => null),
        getDoc(metaDocRef).catch(() => null),
      ]),
      timeoutPromise.then(() => [null, null, null, null, null, null] as any[]),
    ]);

    if (usersSnap && usersSnap.exists() && churchesSnap && churchesSnap.exists()) {
      const usersData = usersSnap.data()?.items || [];
      const churchesData = churchesSnap.data()?.items || [];
      const servantsData = servantsSnap?.data()?.items || [];
      const servicesData = servicesSnap?.data()?.items || [];
      const legacyAttendanceData: AttendanceRecord[] = attendanceSnap?.data()?.items || [];
      const metaData = metaSnap?.data()?.items || {};

      // Phase 1: Load independent documents from 'attendance' and 'general_meeting_records'
      let indepAttendanceData: AttendanceRecord[] = [];
      let indepMeetingRecordsData: GeneralMeetingRecord[] = [];

      try {
        const [attColSnap, gmrColSnap] = await Promise.all([
          getDocs(collection(firestoreDb, 'attendance')).catch(() => null),
          getDocs(collection(firestoreDb, 'general_meeting_records')).catch(() => null),
        ]);

        if (attColSnap && !attColSnap.empty) {
          attColSnap.forEach((d) => {
            const data = d.data() as AttendanceRecord;
            if (data && data.servant_id && data.date && data.service_id) {
              indepAttendanceData.push(data);
            }
          });
        }

        if (gmrColSnap && !gmrColSnap.empty) {
          gmrColSnap.forEach((d) => {
            const data = d.data() as GeneralMeetingRecord;
            if (data && data.servant_id && data.date && data.meeting_id) {
              indepMeetingRecordsData.push(data);
            }
          });
        }
      } catch (err) {
        console.warn('⚠️ Could not load independent collections in syncFromFirestore:', err);
      }

      // Merge legacy array items with new independent documents (independent wins on collision)
      const mergedAttendanceMap = new Map<string, AttendanceRecord>();
      for (const item of legacyAttendanceData) {
        if (item && item.service_id && item.servant_id && item.date) {
          const key = `${item.service_id}_${item.servant_id}_${item.date}`;
          mergedAttendanceMap.set(key, item);
        } else if (item && item.id) {
          mergedAttendanceMap.set(item.id, item);
        }
      }
      for (const item of indepAttendanceData) {
        if (item && item.service_id && item.servant_id && item.date) {
          const key = `${item.service_id}_${item.servant_id}_${item.date}`;
          mergedAttendanceMap.set(key, item);
        } else if (item && item.id) {
          mergedAttendanceMap.set(item.id, item);
        }
      }
      const finalAttendance = Array.from(mergedAttendanceMap.values());

      const mergedGmrMap = new Map<string, GeneralMeetingRecord>();
      const legacyGmr: GeneralMeetingRecord[] = metaData.general_meeting_records || [];
      for (const item of legacyGmr) {
        if (item && item.meeting_id && item.servant_id && item.date) {
          const key = `${item.meeting_id}_${item.servant_id}_${item.date}`;
          mergedGmrMap.set(key, item);
        } else if (item && item.id) {
          mergedGmrMap.set(item.id, item);
        }
      }
      for (const item of indepMeetingRecordsData) {
        if (item && item.meeting_id && item.servant_id && item.date) {
          const key = `${item.meeting_id}_${item.servant_id}_${item.date}`;
          mergedGmrMap.set(key, item);
        } else if (item && item.id) {
          mergedGmrMap.set(item.id, item);
        }
      }
      const finalGmr = Array.from(mergedGmrMap.values());

      dbData = {
        ...dbData,
        users: mergeCollection(dbData.users, usersData),
        churches: mergeCollection(dbData.churches, churchesData),
        servants: mergeCollection(dbData.servants, servantsData),
        services: mergeCollection(dbData.services, servicesData),
        attendance: mergeCollection(dbData.attendance, finalAttendance),
        assignments: mergeById(dbData.assignments, metaData.assignments),
        general_meetings: mergeById(dbData.general_meetings, metaData.general_meetings),
        general_meeting_records: mergeById(dbData.general_meeting_records, finalGmr),
        scanner_devices: mergeById(dbData.scanner_devices, metaData.scanner_devices),
        audit_logs: mergeById(dbData.audit_logs, metaData.audit_logs),
      };

      lastSyncedAt = Date.now();
      lastSyncError = null;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
      } catch {}
      console.log('☁️ Database successfully synced from Cloud Firestore (Partitioned).');
      return;
    }

    // 2. Fallback to monolithic document 'system/app_database'
    const legacyDocRef = doc(firestoreDb, 'system', 'app_database');
    const snap = await getDoc(legacyDocRef);
    if (snap.exists()) {
      const remote = snap.data() as DatabaseSchema;
      if (remote && Array.isArray(remote.churches) && Array.isArray(remote.users)) {
        dbData = {
          ...dbData,
          ...remote,
        };
        lastSyncedAt = Date.now();
        lastSyncError = null;
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
        } catch {}
        console.log('☁️ Database synced successfully from Cloud Firestore (Legacy doc).');

        // Migrate to partitioned storage for infinite scalability and no 1MB doc ceiling (only if not in production startup)
        if (!isProduction) {
          pushToFirestoreImmediate().catch(() => {});
        }
      }
    } else {
      // First-time seed into Cloud Firestore if remote doc doesn't exist yet (NEVER auto-seed in production to prevent accidental overwrites)
      if (!isProduction && dbData && Array.isArray(dbData.churches) && dbData.churches.length > 0) {
        await pushToFirestoreImmediate();
        console.log('☁️ Successfully seeded Cloud Firestore with initial database data.');
      }
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    if (errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('Quota limit exceeded') || err?.code === 8 || err?.code === 'resource-exhausted') {
      isFirestoreQuotaExhausted = true;
      firestoreQuotaResetTime = Date.now() + 60 * 60 * 1000;
    }
    lastSyncError = errMsg;
    console.warn('⚠️ Cloud Firestore sync warning:', errMsg);
  }
}

export function scheduleFirestorePush(delayMs = 3000): void {
  if (isFirestoreQuotaExhausted && Date.now() < firestoreQuotaResetTime) {
    return;
  }
  if (firestorePushTimeout) {
    clearTimeout(firestorePushTimeout);
  }
  firestorePushTimeout = setTimeout(() => {
    pushToFirestoreImmediate().catch(() => {});
  }, delayMs);
}

export function pushToFirestoreImmediate(): Promise<void> {
  if (!firestoreDb || !dbData) return Promise.resolve();

  // If daily write quota is exhausted, skip remote Firestore calls completely
  if (isFirestoreQuotaExhausted && Date.now() < firestoreQuotaResetTime) {
    return Promise.resolve();
  }

  const writePromise = (async () => {
    try {
      const sanitized = JSON.parse(JSON.stringify(dbData));

      // 1. Write partitioned documents to avoid the 1MB Firestore document limit
      const usersDocRef = doc(firestoreDb, 'system_data', 'users');
      const churchesDocRef = doc(firestoreDb, 'system_data', 'churches');
      const servantsDocRef = doc(firestoreDb, 'system_data', 'servants');
      const servicesDocRef = doc(firestoreDb, 'system_data', 'services');
      const attendanceDocRef = doc(firestoreDb, 'system_data', 'attendance');
      const metaDocRef = doc(firestoreDb, 'system_data', 'meta');

      const partitionedWrites = [
        setDoc(usersDocRef, { items: sanitized.users || [] }),
        setDoc(churchesDocRef, { items: sanitized.churches || [] }),
        setDoc(servantsDocRef, { items: sanitized.servants || [] }),
        setDoc(servicesDocRef, { items: sanitized.services || [] }),
        // Note: Individual attendance documents are managed via atomic writeBatch in 'attendance' collection.
        // We write system_data/attendance only if it exists, preserving legacy while prioritizing independent docs.
        setDoc(metaDocRef, {
          items: {
            assignments: sanitized.assignments || [],
            general_meetings: sanitized.general_meetings || [],
            scanner_devices: sanitized.scanner_devices || [],
            audit_logs: (sanitized.audit_logs || []).slice(-300),
          },
          updated_at: new Date().toISOString(),
        }),
      ];

      // Also update monolithic doc if within safe size (< 850 KB)
      const legacyDocRef = doc(firestoreDb, 'system', 'app_database');
      const rawString = JSON.stringify(sanitized);
      if (rawString.length < 850000) {
        partitionedWrites.push(setDoc(legacyDocRef, sanitized));
      }

      await Promise.all(partitionedWrites);
      lastPushedAt = Date.now();
      lastSyncedAt = Date.now();
      lastSyncError = null;
      isFirestoreQuotaExhausted = false;
      console.log('☁️ Changes persisted to Cloud Firestore successfully.');
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isQuota =
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('Quota limit exceeded') ||
        err?.code === 'resource-exhausted' ||
        err?.code === 8;

      if (isQuota) {
        isFirestoreQuotaExhausted = true;
        // Pause for 1 hour to prevent flooding the logs and grpc errors
        firestoreQuotaResetTime = Date.now() + 60 * 60 * 1000;
        lastSyncError = 'تم بلوغ الحد اليومي المجاني للكتابة في فايربيز (Quota Exceeded) - التخزين المحلي مستمر';
        console.warn('⚠️ Cloud Firestore write quota limit exceeded for today. Cloud writes paused; local file database remains fully operational.');
      } else {
        lastSyncError = errMsg;
        console.warn('⚠️ Could not push changes to Cloud Firestore:', errMsg);
      }
    }
  })();
  pendingFirestoreWrite = writePromise;
  return writePromise;
}

export async function waitForPendingWrites(): Promise<void> {
  if (isFirestoreQuotaExhausted && Date.now() < firestoreQuotaResetTime) {
    return;
  }
  if (pendingFirestoreWrite) {
    try {
      const timeout = new Promise<void>((res) => setTimeout(res, 500));
      await Promise.race([pendingFirestoreWrite, timeout]);
    } catch (e) {
      // ignore
    }
  }
}

export async function ensureDatabaseReady(force = false): Promise<void> {
  // If already initialized and last sync was less than 8 seconds ago, skip network call
  if (!force && isInitialSyncDone && dbData && (Date.now() - lastSyncedAt < 8000)) {
    return;
  }

  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        if (!dbData) {
          initDatabase();
        }
        await syncFromFirestore();
        isInitialSyncDone = true;
      } finally {
        syncPromise = null;
      }
    })();
  }
  await syncPromise;
}

export function initDatabase(): void {
  // If in Vercel and /tmp/database.json doesn't exist yet, copy from seed data
  if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_FILE)) {
    try {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } catch (e) {
      console.warn('Could not copy seed database to /tmp:', e);
    }
  }

  const targetFile = fs.existsSync(DB_FILE) ? DB_FILE : (fs.existsSync(SEED_FILE) ? SEED_FILE : null);

  if (targetFile && fs.existsSync(targetFile)) {
    try {
      const content = fs.readFileSync(targetFile, 'utf-8');
      dbData = JSON.parse(content);
      if (!dbData.churches) dbData.churches = [];
      if (!dbData.scanner_devices) dbData.scanner_devices = [];
      if (!dbData.registration_codes) dbData.registration_codes = [];
      if (!dbData.general_meeting_records) dbData.general_meeting_records = [];
      if (!dbData.general_meetings) dbData.general_meetings = [];

      // Ensure dbData collections exist
      if (!dbData.churches) dbData.churches = [];
      if (!dbData.users) dbData.users = [];
      if (!dbData.servants) dbData.servants = [];
      if (!dbData.services) dbData.services = [];
      if (!dbData.assignments) dbData.assignments = [];
      if (!dbData.attendance) dbData.attendance = [];
      if (!dbData.audit_logs) dbData.audit_logs = [];
      if (!dbData.scanner_devices) dbData.scanner_devices = [];
      if (!dbData.registration_codes) dbData.registration_codes = [];
      if (!dbData.general_meeting_records) dbData.general_meeting_records = [];
      if (!dbData.general_meetings) dbData.general_meetings = [];

      // Ensure at least one Super Admin user exists for initial setup if none exists
      const existingSuperAdmin = dbData.users?.find((u) => u.role === 'super_admin');
      if (!existingSuperAdmin) {
        const salt = bcrypt.genSaltSync(10);
        const newSuperAdmin: User = {
          id: 'user_superadmin_01',
          username: 'admin',
          name: 'م/ أبانوب وجيه (Super Admin)',
          email: 'abanoub.wagih77@gmail.com',
          role: 'super_admin',
          church_id: null,
          scope: 'all',
          permissions: [
            'view_servants',
            'add_servant',
            'edit_servant',
            'delete_servant',
            'view_servant_details',
            'view_users',
            'add_user',
            'edit_user',
            'disable_user',
            'delete_user',
            'view_services',
            'add_service',
            'edit_service',
            'delete_service',
            'view_attendance',
            'add_attendance',
            'edit_attendance',
            'delete_attendance',
            'view_reports',
            'export_reports',
            'view_history',
            'manage_permissions',
            'manage_roles',
            'manage_scanner',
            'full_access',
          ],
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          password_hash: bcrypt.hashSync('admin', salt),
        };
        dbData.users.push(newSuperAdmin);
      } else if (!existingSuperAdmin.email) {
        existingSuperAdmin.email = 'abanoub.wagih77@gmail.com';
      }
      return;
    } catch (e) {
      console.error('Failed to read existing database.json, initializing fresh', e);
    }
  }

  // Initialize state with strictly ONLY Super Admin user, 0 services, and 0 servants
  const defaultSalt = bcrypt.genSaltSync(10);
  const defaultHash = bcrypt.hashSync('admin', defaultSalt);

  const superAdminUser: User = {
    id: 'user_superadmin_01',
    username: 'admin',
    name: 'المدير العام (Super Admin)',
    email: 'abanoub.wagih77@gmail.com',
    role: 'super_admin',
    church_id: null,
    scope: 'all',
    permissions: [
      'view_servants',
      'add_servant',
      'edit_servant',
      'delete_servant',
      'view_servant_details',
      'view_users',
      'add_user',
      'edit_user',
      'disable_user',
      'delete_user',
      'view_services',
      'add_service',
      'edit_service',
      'delete_service',
      'view_attendance',
      'add_attendance',
      'edit_attendance',
      'delete_attendance',
      'view_reports',
      'export_reports',
      'view_history',
      'manage_permissions',
      'manage_roles',
      'manage_scanner',
      'full_access',
    ],
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    password_hash: defaultHash,
  };

  const initialAuditLog: AuditLog = {
    id: `audit_${Date.now()}`,
    username: 'system',
    action: 'SYSTEM_INITIALIZATION',
    target_type: 'SYSTEM',
    target_name: 'نظام إدارة خدام الكنيسة',
    description: 'تمت تهيئة قاعدة البيانات بنجاح بحساب المدير العام فقط (Super Admin) دون أي خدمات أو خدام افتراضية',
    timestamp: new Date().toISOString(),
  };

  dbData = {
    churches: [],
    users: [superAdminUser],
    servants: [],
    services: [],
    assignments: [],
    attendance: [],
    audit_logs: [initialAuditLog],
    scanner_devices: [],
    registration_codes: [],
    general_meeting_records: [],
    general_meetings: [],
    rate_limits: {},
  };

  // In production, never write local fallback directly to Firestore on startup.
  if (!isProduction) {
    saveDatabase();
  }
  syncFromFirestore().catch(() => {});
}

export function saveDatabase(): void {
  saveLocalDatabaseOnly();
  if (isProduction) {
    pushToFirestoreImmediate().catch((err) => {
      console.warn('⚠️ Cloud Firestore push error:', err);
    });
  } else {
    scheduleFirestorePush(1000);
  }
}

/**
 * Save database locally without scheduling a delayed full Firestore push.
 * Used by isolated Phase 1 routes (Attendance & QR Scanner) to keep local JSON in sync
 * without triggering legacy system_data overwrite.
 */
export function saveLocalDatabaseOnly(): void {
  try {
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(dbData, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (e) {
    console.error('Error saving local database:', e);
  }
}

export async function saveDatabaseAsync(): Promise<void> {
  saveLocalDatabaseOnly();
  await pushToFirestoreImmediate();
}

export function getDb(): DatabaseSchema {
  if (!dbData) {
    initDatabase();
  }
  return dbData;
}

// ============================================================================
// PHASE 1: ATOMIC FIRESTORE MUTATION HELPERS (ATTENDANCE & QR SCANNER)
// ============================================================================

export function getAttendanceDocId(serviceId: string, servantId: string, date: string): string {
  return `${serviceId}_${servantId}_${date}`;
}

export function getGeneralMeetingRecordDocId(meetingId: string, servantId: string, date: string): string {
  return `${meetingId}_${servantId}_${date}`;
}

/**
 * Atomic bulk write for Attendance records using Firestore writeBatch.
 * All-or-nothing: if any document write fails, the entire batch fails.
 * On success, synchronously updates in-memory dbData.attendance cache.
 */
export async function writeAttendanceBatch(
  recordsToUpsert: AttendanceRecord[]
): Promise<{ success: boolean; count: number }> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const batch = writeBatch(firestoreDb);

  for (const record of recordsToUpsert) {
    const docId = getAttendanceDocId(record.service_id, record.servant_id, record.date);
    const docRef = doc(firestoreDb, 'attendance', docId);
    batch.set(docRef, { ...record }, { merge: true });
  }

  // Atomic write to Firestore
  await batch.commit();

  // On confirmed Firestore success, update in-memory dbData cache
  if (dbData) {
    if (!dbData.attendance) dbData.attendance = [];
    for (const record of recordsToUpsert) {
      const idx = dbData.attendance.findIndex(
        (r) =>
          (r.service_id === record.service_id && r.servant_id === record.servant_id && r.date === record.date) ||
          r.id === record.id
      );
      if (idx !== -1) {
        dbData.attendance[idx] = { ...dbData.attendance[idx], ...record };
      } else {
        dbData.attendance.push(record);
      }
    }
    saveLocalDatabaseOnly();
  }

  return { success: true, count: recordsToUpsert.length };
}

/**
 * Atomic update for a single Attendance record.
 * Writes directly to the independent attendance document in Firestore.
 * On success, updates in-memory dbData.attendance cache.
 */
export async function updateAttendanceRecordAtomic(
  record: AttendanceRecord
): Promise<AttendanceRecord> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const docId = getAttendanceDocId(record.service_id, record.servant_id, record.date);
  const docRef = doc(firestoreDb, 'attendance', docId);

  await setDoc(docRef, { ...record }, { merge: true });

  // On confirmed Firestore success, update in-memory cache
  if (dbData) {
    if (!dbData.attendance) dbData.attendance = [];
    const idx = dbData.attendance.findIndex(
      (r) =>
        (r.service_id === record.service_id && r.servant_id === record.servant_id && r.date === record.date) ||
        r.id === record.id
    );
    if (idx !== -1) {
      dbData.attendance[idx] = { ...record };
    } else {
      dbData.attendance.push(record);
    }
    saveLocalDatabaseOnly();
  }

  return record;
}

/**
 * Atomic delete for a single Attendance record.
 * Deletes the independent attendance document in Firestore.
 * On success, removes from in-memory dbData.attendance cache.
 */
export async function deleteAttendanceRecordAtomic(
  serviceId: string,
  servantId: string,
  date: string,
  originalId?: string
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const docId = getAttendanceDocId(serviceId, servantId, date);
  const docRef = doc(firestoreDb, 'attendance', docId);

  await deleteDoc(docRef);

  // On confirmed Firestore success, remove from in-memory cache
  if (dbData && dbData.attendance) {
    const idx = dbData.attendance.findIndex(
      (r) =>
        (r.service_id === serviceId && r.servant_id === servantId && r.date === date) ||
        (originalId && r.id === originalId)
    );
    if (idx !== -1) {
      dbData.attendance.splice(idx, 1);
    }
    saveLocalDatabaseOnly();
  }
}

/**
 * Atomic Firestore Transaction for QR Quick Check-in.
 * Handles concurrency across multiple Cloud Run instances.
 * Reads existing general meeting record and scanner device within transaction,
 * applies check-in / check-out / duplicate-warning logic atomically,
 * increments scanner_devices.total_scans, and writes back.
 */
export interface ScannerCheckinResult {
  actionType: 'check_in' | 'late_absent' | 'duplicate_warning' | 'check_out';
  record: GeneralMeetingRecord;
  diffMinutes?: number;
  durationText?: string;
  isLate?: boolean;
}

export async function runScannerCheckinTransaction(params: {
  meeting: GeneralMeeting;
  servant: Servant;
  serviceName: string;
  device: ScannerDevice;
  today: string;
  nowIso: string;
  currentHourMin: string;
  cutoff: string;
  ip: string;
}): Promise<ScannerCheckinResult> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const {
    meeting,
    servant,
    serviceName,
    device,
    today,
    nowIso,
    currentHourMin,
    cutoff,
  } = params;

  const gmrDocId = getGeneralMeetingRecordDocId(meeting.id, servant.id, today);
  const gmrDocRef = doc(firestoreDb, 'general_meeting_records', gmrDocId);
  const metaDocRef = doc(firestoreDb, 'system_data', 'meta');

  const result = await runTransaction(firestoreDb, async (transaction) => {
    // 1. Read existing record for this meeting + servant + date inside transaction
    const gmrSnap = await transaction.get(gmrDocRef);

    // 2. Read meta doc to get latest scanner device data if present
    const metaSnap = await transaction.get(metaDocRef);
    let metaItems = metaSnap.exists() ? (metaSnap.data()?.items || {}) : {};
    let scannerDevicesList: ScannerDevice[] = metaItems.scanner_devices || [];

    const isPastCutoff = currentHourMin > cutoff;

    if (!gmrSnap.exists()) {
      // CASE 1: No previous record in Firestore -> First scan (Check-in or Late Absent)
      const isLate = isPastCutoff;
      const initialStatus = isLate ? 'late_absent' : 'checked_in';

      const newRecord: GeneralMeetingRecord = {
        id: `gmr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        meeting_id: meeting.id,
        meeting_title: meeting.title,
        meeting_speaker: meeting.speaker,
        servant_id: servant.id,
        servant_name: servant.full_name,
        servant_phone: servant.phone,
        servant_national_id: servant.national_id,
        service_id: servant.current_service_id,
        service_name: serviceName,
        date: today,
        check_in_time: nowIso,
        status: initialStatus,
        is_late: isLate,
        scanner_device_id: device.id,
        scanner_device_name: device.name,
        notes: isLate ? `تم المسح بعد آخر موعد حضور مسموح (${cutoff})` : 'حضور في الموعد',
        created_at: nowIso,
        updated_at: nowIso,
      };

      transaction.set(gmrDocRef, newRecord);

      // Update scanner device in meta
      const devIdx = scannerDevicesList.findIndex((d) => d.id === device.id);
      if (devIdx !== -1) {
        scannerDevicesList[devIdx].total_scans = (scannerDevicesList[devIdx].total_scans || 0) + 1;
        scannerDevicesList[devIdx].last_used_at = nowIso;
      }
      transaction.update(metaDocRef, {
        'items.scanner_devices': scannerDevicesList,
        updated_at: nowIso,
      });

      return {
        actionType: (isLate ? 'late_absent' : 'check_in') as 'check_in' | 'late_absent',
        record: newRecord,
        isLate,
      };
    }

    // Record already exists in Firestore!
    const existing = gmrSnap.data() as GeneralMeetingRecord;
    const checkInDate = existing.check_in_time ? new Date(existing.check_in_time).getTime() : Date.now();
    const diffMs = Date.now() - checkInDate;
    const diffMinutes = Math.floor(diffMs / (60 * 1000));

    // CASE 2: Duplicate scan within 5 minutes
    if (diffMinutes < 5) {
      return {
        actionType: 'duplicate_warning' as const,
        record: existing,
        diffMinutes,
      };
    }

    // CASE 3: Check-out after 5 minutes
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    let durationText = '';
    if (hours > 0) {
      durationText = `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ''}`;
    } else {
      durationText = `${mins} دقيقة`;
    }

    const updatedRecord: GeneralMeetingRecord = {
      ...existing,
      check_out_time: nowIso,
      duration_minutes: diffMinutes,
      status: existing.is_late ? 'late_absent' : 'completed',
      updated_at: nowIso,
    };

    transaction.set(gmrDocRef, updatedRecord, { merge: true });

    // Update scanner device in meta
    const devIdx = scannerDevicesList.findIndex((d) => d.id === device.id);
    if (devIdx !== -1) {
      scannerDevicesList[devIdx].total_scans = (scannerDevicesList[devIdx].total_scans || 0) + 1;
      scannerDevicesList[devIdx].last_used_at = nowIso;
    }
    transaction.update(metaDocRef, {
      'items.scanner_devices': scannerDevicesList,
      updated_at: nowIso,
    });

    return {
      actionType: 'check_out' as const,
      record: updatedRecord,
      diffMinutes,
      durationText,
    };
  });

  // On confirmed transaction success, update local in-memory cache
  if (dbData) {
    if (!dbData.general_meeting_records) dbData.general_meeting_records = [];
    const idx = dbData.general_meeting_records.findIndex(
      (r) =>
        (r.meeting_id === meeting.id && r.servant_id === servant.id && r.date === today) ||
        r.id === result.record.id
    );
    if (idx !== -1) {
      dbData.general_meeting_records[idx] = result.record;
    } else {
      dbData.general_meeting_records.push(result.record);
    }

    // Update in-memory scanner device
    if (result.actionType !== 'duplicate_warning') {
      const dev = dbData.scanner_devices?.find((d) => d.id === device.id);
      if (dev) {
        dev.total_scans = (dev.total_scans || 0) + 1;
        dev.last_used_at = nowIso;
      }
    }

    saveLocalDatabaseOnly();
  }

  return result;
}
