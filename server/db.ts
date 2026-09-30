import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  db as firestoreDb,
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
} from './firebase.js';
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
let isInitialSyncSuccessful = false;
let syncPromise: Promise<void> | null = null;
let lastSyncedAt: number = 0;
let lastPushedAt: number = 0;
let lastSyncError: string | null = null;
let isFirestoreQuotaExhausted = false;
let firestoreQuotaResetTime = 0;
let firestorePushTimeout: NodeJS.Timeout | null = null;

export function isFirestoreSyncReady(): boolean {
  return isInitialSyncSuccessful;
}

export function getCloudSyncInfo() {
  return {
    isCloudConnected: Boolean(firestoreDb),
    databaseId: 'ai-studio-churchservantsma-bc52da4f-f7ee-4431-b656-15d224f5a4eb',
    isInitialSyncSuccessful,
    isInitialSyncDone,
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
      if (createdTime > tenMinutesAgo || updatedTime > tenMinutesAgo) {
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
      if (createdTime > tenMinutesAgo || updatedTime > tenMinutesAgo) {
        map.set(local.id, local);
      }
    }
  }
  return Array.from(map.values());
}

export async function syncFromFirestore(): Promise<void> {
  if (!firestoreDb) return;
  if (!dbData) {
    initDatabase();
  }
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

      // Phase 1, 2B, 2C, 2D & 2E: Load independent documents from all isolated collections
      let indepAttendanceData: AttendanceRecord[] = [];
      let indepMeetingRecordsData: GeneralMeetingRecord[] = [];
      let indepServantsData: Servant[] = [];
      let indepServicesData: ChurchService[] = [];
      let indepUsersData: User[] = [];
      let indepChurchesData: Church[] = [];
      let indepAssignmentsData: ServiceAssignment[] = [];
      let indepGeneralMeetingsData: GeneralMeeting[] = [];
      let indepScannerDevicesData: ScannerDevice[] = [];

      try {
        const [
          attColSnap,
          gmrColSnap,
          srvColSnap,
          srvcColSnap,
          usersColSnap,
          churchesColSnap,
          asgColSnap,
          gmColSnap,
          scanColSnap,
        ] = await Promise.all([
          getDocs(collection(firestoreDb, 'attendance')).catch(() => null),
          getDocs(collection(firestoreDb, 'general_meeting_records')).catch(() => null),
          getDocs(collection(firestoreDb, 'servants')).catch(() => null),
          getDocs(collection(firestoreDb, 'services')).catch(() => null),
          getDocs(collection(firestoreDb, 'users')).catch(() => null),
          getDocs(collection(firestoreDb, 'churches')).catch(() => null),
          getDocs(collection(firestoreDb, 'assignments')).catch(() => null),
          getDocs(collection(firestoreDb, 'general_meetings')).catch(() => null),
          getDocs(collection(firestoreDb, 'scanner_devices')).catch(() => null),
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

        if (srvColSnap && !srvColSnap.empty) {
          srvColSnap.forEach((d) => {
            const data = d.data() as Servant;
            if (data && data.id) {
              indepServantsData.push(data);
            }
          });
        }

        if (srvcColSnap && !srvcColSnap.empty) {
          srvcColSnap.forEach((d) => {
            const data = d.data() as ChurchService;
            if (data && data.id) {
              indepServicesData.push(data);
            }
          });
        }

        if (usersColSnap && !usersColSnap.empty) {
          usersColSnap.forEach((d) => {
            const data = d.data() as User;
            if (data && data.id) {
              indepUsersData.push(data);
            }
          });
        }

        if (churchesColSnap && !churchesColSnap.empty) {
          churchesColSnap.forEach((d) => {
            const data = d.data() as Church;
            if (data && data.id) {
              indepChurchesData.push(data);
            }
          });
        }

        if (asgColSnap && !asgColSnap.empty) {
          asgColSnap.forEach((d) => {
            const data = d.data() as ServiceAssignment;
            if (data && data.id) {
              indepAssignmentsData.push(data);
            }
          });
        }

        if (gmColSnap && !gmColSnap.empty) {
          gmColSnap.forEach((d) => {
            const data = d.data() as GeneralMeeting;
            if (data && data.id) {
              indepGeneralMeetingsData.push(data);
            }
          });
        }

        if (scanColSnap && !scanColSnap.empty) {
          scanColSnap.forEach((d) => {
            const data = d.data() as ScannerDevice;
            if (data && data.id) {
              indepScannerDevicesData.push(data);
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

      // Phase 2B, 2C, 2D & 2E: Independent collections for servants, services, users, churches, assignments, general_meetings, scanner_devices are authoritative
      const localServants = dbData?.servants || [];
      const localServices = dbData?.services || [];
      const localUsers = dbData?.users || [];
      const localChurches = dbData?.churches || [];
      const localAssignments = dbData?.assignments || [];
      const localMeetings = dbData?.general_meetings || [];
      const localScanners = dbData?.scanner_devices || [];

      const finalServants = indepServantsData.length > 0
        ? mergeCollection(localServants, indepServantsData)
        : mergeCollection(localServants, servantsData);

      const finalServices = indepServicesData.length > 0
        ? mergeCollection(localServices, indepServicesData)
        : mergeCollection(localServices, servicesData);

      const finalUsers = indepUsersData.length > 0
        ? mergeCollection(localUsers, indepUsersData)
        : mergeCollection(localUsers, usersData);

      const finalChurches = indepChurchesData.length > 0
        ? mergeCollection(localChurches, indepChurchesData)
        : mergeCollection(localChurches, churchesData);

      const finalAssignments = indepAssignmentsData.length > 0
        ? mergeById(localAssignments, indepAssignmentsData)
        : mergeById(localAssignments, metaData.assignments);

      const finalGeneralMeetings = indepGeneralMeetingsData.length > 0
        ? mergeById(localMeetings, indepGeneralMeetingsData)
        : mergeById(localMeetings, metaData.general_meetings);

      const finalScannerDevices = indepScannerDevicesData.length > 0
        ? mergeById(localScanners, indepScannerDevicesData)
        : mergeById(localScanners, metaData.scanner_devices);

      dbData = {
        ...dbData,
        users: finalUsers,
        churches: finalChurches,
        servants: finalServants,
        services: finalServices,
        attendance: mergeCollection(dbData.attendance, finalAttendance),
        assignments: finalAssignments,
        general_meetings: finalGeneralMeetings,
        general_meeting_records: mergeById(dbData.general_meeting_records, finalGmr),
        scanner_devices: finalScannerDevices,
        audit_logs: mergeById(dbData.audit_logs, metaData.audit_logs),
      };

      isInitialSyncSuccessful = true;
      isInitialSyncDone = true;
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
        isInitialSyncSuccessful = true;
        isInitialSyncDone = true;
        lastSyncedAt = Date.now();
        lastSyncError = null;
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
        } catch {}
        console.log('☁️ Database synced successfully from Cloud Firestore (Legacy doc).');
      }
    }
  } catch (err: any) {
    isInitialSyncSuccessful = false;
    isInitialSyncDone = false;
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
  // Startup Safety Guard: NEVER push before initial sync has succeeded!
  if (!isInitialSyncSuccessful) {
    console.warn('⚠️ Blocked scheduleFirestorePush: Initial Firestore sync is not completed yet.');
    return;
  }
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

  // Startup Safety Guard: NEVER push to Firestore before initial sync has succeeded!
  if (!isInitialSyncSuccessful) {
    console.warn('⚠️ Blocked pushToFirestoreImmediate: Initial Firestore sync has not completed successfully yet. Remote production data is protected.');
    return Promise.resolve();
  }

  // If daily write quota is exhausted, skip remote Firestore calls completely
  if (isFirestoreQuotaExhausted && Date.now() < firestoreQuotaResetTime) {
    return Promise.resolve();
  }

  const writePromise = (async () => {
    try {
      const sanitized = JSON.parse(JSON.stringify(dbData));

      // 1. Write partitioned documents to avoid the 1MB Firestore document limit
      const metaDocRef = doc(firestoreDb, 'system_data', 'meta');

      const partitionedWrites = [
        // Note: Users, Servants, Services, Churches, Assignments, General Meetings, and Scanner Devices are managed via isolated documents (Phase 2B, 2C, 2D & 2E).
        // Legacy system_data/* documents remain preserved as historical backups and are NOT overwritten here.
        // Individual attendance documents are managed via atomic writeBatch in 'attendance' collection.
        setDoc(metaDocRef, {
          items: {
            audit_logs: (sanitized.audit_logs || []).slice(-300),
          },
          updated_at: new Date().toISOString(),
        }, { merge: true }),
      ];

      // Also update monolithic doc if within safe size (< 850 KB) without overwriting isolated entities
      const legacyDocRef = doc(firestoreDb, 'system', 'app_database');
      const sanitizedForLegacy = { ...sanitized };
      delete sanitizedForLegacy.users;
      delete sanitizedForLegacy.servants;
      delete sanitizedForLegacy.services;
      delete sanitizedForLegacy.churches;
      delete sanitizedForLegacy.assignments;
      delete sanitizedForLegacy.general_meetings;
      delete sanitizedForLegacy.scanner_devices;
      const rawString = JSON.stringify(sanitizedForLegacy);
      if (rawString.length < 850000) {
        partitionedWrites.push(setDoc(legacyDocRef, sanitizedForLegacy, { merge: true }));
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
  if (!force && isInitialSyncDone && isInitialSyncSuccessful && dbData && (Date.now() - lastSyncedAt < 8000)) {
    return;
  }

  if (!syncPromise) {
    syncPromise = (async () => {
      try {
        if (!dbData) {
          initDatabase();
        }
        await syncFromFirestore();
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
          created_at: '1970-01-01T00:00:00.000Z',
          updated_at: '1970-01-01T00:00:00.000Z',
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
    created_at: '1970-01-01T00:00:00.000Z',
    updated_at: '1970-01-01T00:00:00.000Z',
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

  syncFromFirestore().catch(() => {});
}

export function saveDatabase(): void {
  saveLocalDatabaseOnly();
  if (!isInitialSyncSuccessful) {
    console.warn('⚠️ Blocked saveDatabase cloud push: Initial Firestore sync is not completed yet.');
    return;
  }
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
  if (!isInitialSyncSuccessful) {
    console.warn('⚠️ Blocked saveDatabaseAsync cloud push: Initial Firestore sync is not completed yet.');
    return;
  }
  await pushToFirestoreImmediate();
}

/**
 * Isolated update for user last_login.
 * Updates in-memory user and local file, and writes directly to users/{userId} in Firestore.
 * NEVER calls pushToFirestoreImmediate and NEVER touches any other collection.
 */
export async function updateUserLastLogin(userId: string, lastLoginIso: string): Promise<void> {
  // 1. Update in-memory user and local file
  if (dbData && Array.isArray(dbData.users)) {
    const user = dbData.users.find((u) => u.id === userId);
    if (user) {
      user.last_login = lastLoginIso;
    }
    saveLocalDatabaseOnly();
  }

  // 2. Isolated Firestore update on users/{userId} directly
  if (firestoreDb && isInitialSyncSuccessful) {
    try {
      const userDocRef = doc(firestoreDb, 'users', userId);
      await setDoc(userDocRef, { last_login: lastLoginIso }, { merge: true });
    } catch (err) {
      console.warn('Non-blocking user last_login Firestore update warning:', err);
    }
  }
}

export function getDb(): DatabaseSchema {
  if (!dbData) {
    initDatabase();
  }
  return dbData;
}

// ============================================================================
// PHASE 2B: ATOMIC FIRESTORE MUTATION HELPERS (SERVANTS & SERVICES)
// ============================================================================

export async function createServantAtomic(
  servant: Servant,
  initialAssignment?: ServiceAssignment
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const batch = writeBatch(firestoreDb);
  const servantDocRef = doc(firestoreDb, 'servants', servant.id);
  batch.set(servantDocRef, servant);

  if (initialAssignment) {
    const asgDocRef = doc(firestoreDb, 'assignments', initialAssignment.id);
    batch.set(asgDocRef, initialAssignment);
  }

  await batch.commit();

  if (dbData) {
    if (!dbData.servants) dbData.servants = [];
    dbData.servants.push(servant);
    if (initialAssignment) {
      if (!dbData.assignments) dbData.assignments = [];
      dbData.assignments.push(initialAssignment);
    }
    saveLocalDatabaseOnly();
  }
}

export async function updateServantAtomic(
  servant: Servant,
  updatedAssignments?: ServiceAssignment[]
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const batch = writeBatch(firestoreDb);
  const servantDocRef = doc(firestoreDb, 'servants', servant.id);
  batch.set(servantDocRef, servant, { merge: true });

  if (updatedAssignments) {
    for (const asg of updatedAssignments) {
      const asgDocRef = doc(firestoreDb, 'assignments', asg.id);
      batch.set(asgDocRef, asg);
    }
  }

  await batch.commit();

  if (dbData) {
    if (!dbData.servants) dbData.servants = [];
    const idx = dbData.servants.findIndex((s) => s.id === servant.id);
    if (idx !== -1) {
      dbData.servants[idx] = { ...dbData.servants[idx], ...servant };
    } else {
      dbData.servants.push(servant);
    }
    if (updatedAssignments) {
      dbData.assignments = updatedAssignments;
    }
    saveLocalDatabaseOnly();
  }
}

export async function updateServantStatusAtomic(
  servantId: string,
  newStatus: 'active' | 'inactive',
  updatedAt: string
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const servantDocRef = doc(firestoreDb, 'servants', servantId);
  await updateDoc(servantDocRef, {
    status: newStatus,
    updated_at: updatedAt,
  });

  if (dbData && dbData.servants) {
    const s = dbData.servants.find((item) => item.id === servantId);
    if (s) {
      s.status = newStatus;
      s.updated_at = updatedAt;
    }
    saveLocalDatabaseOnly();
  }
}

export async function transferServantAtomic(params: {
  servant: Servant;
  newAssignment: ServiceAssignment;
  updatedAssignments: ServiceAssignment[];
  linkedUser?: User;
}): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const { servant, newAssignment, updatedAssignments, linkedUser } = params;
  const batch = writeBatch(firestoreDb);

  const servantDocRef = doc(firestoreDb, 'servants', servant.id);
  batch.update(servantDocRef, {
    current_service_id: servant.current_service_id,
    current_role: servant.current_role,
    updated_at: servant.updated_at,
  });

  const newAsgDocRef = doc(firestoreDb, 'assignments', newAssignment.id);
  batch.set(newAsgDocRef, newAssignment);

  if (updatedAssignments) {
    for (const asg of updatedAssignments) {
      const asgDocRef = doc(firestoreDb, 'assignments', asg.id);
      batch.set(asgDocRef, asg);
    }
  }

  if (linkedUser) {
    const linkedUserDocRef = doc(firestoreDb, 'users', linkedUser.id);
    batch.set(linkedUserDocRef, {
      scope: linkedUser.scope,
      updated_at: linkedUser.updated_at,
    }, { merge: true });
  }

  await batch.commit();

  if (dbData) {
    if (!dbData.servants) dbData.servants = [];
    const idx = dbData.servants.findIndex((s) => s.id === servant.id);
    if (idx !== -1) {
      dbData.servants[idx] = { ...dbData.servants[idx], ...servant };
    }
    dbData.assignments = updatedAssignments;
    if (linkedUser && dbData.users) {
      const uIdx = dbData.users.findIndex((u) => u.id === linkedUser.id);
      if (uIdx !== -1) {
        dbData.users[uIdx] = { ...dbData.users[uIdx], ...linkedUser };
      }
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteServantAtomic(servantId: string): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const batch = writeBatch(firestoreDb);
  const servantDocRef = doc(firestoreDb, 'servants', servantId);
  batch.delete(servantDocRef);

  const remainingAssignments = (dbData?.assignments || []).filter((a) => a.servant_id !== servantId);
  const deletedAssignments = (dbData?.assignments || []).filter((a) => a.servant_id === servantId);
  for (const asg of deletedAssignments) {
    const asgDocRef = doc(firestoreDb, 'assignments', asg.id);
    batch.delete(asgDocRef);
  }

  await batch.commit();

  if (dbData) {
    recordDeletedId(servantId);
    if (dbData.servants) {
      dbData.servants = dbData.servants.filter((s) => s.id !== servantId);
    }
    dbData.assignments = remainingAssignments;
    if (dbData.attendance) {
      dbData.attendance = dbData.attendance.filter((a) => a.servant_id !== servantId);
    }
    saveLocalDatabaseOnly();
  }
}

export async function createServiceAtomic(service: ChurchService): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const serviceDocRef = doc(firestoreDb, 'services', service.id);
  await setDoc(serviceDocRef, service);

  if (dbData) {
    if (!dbData.services) dbData.services = [];
    dbData.services.push(service);
    saveLocalDatabaseOnly();
  }
}

export async function updateServiceAtomic(service: ChurchService): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const serviceDocRef = doc(firestoreDb, 'services', service.id);
  await setDoc(serviceDocRef, service, { merge: true });

  if (dbData) {
    if (!dbData.services) dbData.services = [];
    const idx = dbData.services.findIndex((s) => s.id === service.id);
    if (idx !== -1) {
      dbData.services[idx] = { ...dbData.services[idx], ...service };
    } else {
      dbData.services.push(service);
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteServiceAtomic(serviceId: string): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const serviceDocRef = doc(firestoreDb, 'services', serviceId);
  await deleteDoc(serviceDocRef);

  if (dbData) {
    recordDeletedId(serviceId);
    if (dbData.services) {
      dbData.services = dbData.services.filter((s) => s.id !== serviceId);
    }
    saveLocalDatabaseOnly();
  }
}

// ============================================================================
// PHASE 2C: ATOMIC FIRESTORE MUTATION HELPERS (USERS & ACCOUNTS)
// ============================================================================

export async function createUserAtomic(user: User): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const userDocRef = doc(firestoreDb, 'users', user.id);
  await setDoc(userDocRef, user);

  if (dbData) {
    if (!dbData.users) dbData.users = [];
    dbData.users.push(user);
    saveLocalDatabaseOnly();
  }
}

export async function updateUserAtomic(userId: string, updates: Partial<User>): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const userDocRef = doc(firestoreDb, 'users', userId);
  const nowIso = updates.updated_at || new Date().toISOString();
  const payloadToSave = { ...updates, updated_at: nowIso };

  await setDoc(userDocRef, payloadToSave, { merge: true });

  if (dbData && dbData.users) {
    const idx = dbData.users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      dbData.users[idx] = { ...dbData.users[idx], ...payloadToSave };
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteUserAtomic(userId: string): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const userDocRef = doc(firestoreDb, 'users', userId);
  await deleteDoc(userDocRef);

  if (dbData) {
    recordDeletedId(userId);
    if (dbData.users) {
      dbData.users = dbData.users.filter((u) => u.id !== userId);
    }
    saveLocalDatabaseOnly();
  }
}

export async function updateUserPasswordAtomic(
  userId: string,
  newHash: string,
  plainPasswordHint?: string
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const userDocRef = doc(firestoreDb, 'users', userId);
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    password_hash: newHash,
    must_change_password: false,
    updated_at: nowIso,
  };
  if (plainPasswordHint !== undefined) {
    updatePayload.plain_password_hint = plainPasswordHint;
  }

  await setDoc(userDocRef, updatePayload, { merge: true });

  if (dbData && dbData.users) {
    const user = dbData.users.find((u) => u.id === userId);
    if (user) {
      user.password_hash = newHash;
      user.must_change_password = false;
      user.updated_at = nowIso;
      if (plainPasswordHint !== undefined) {
        user.plain_password_hint = plainPasswordHint;
      }
    }
    saveLocalDatabaseOnly();
  }
}

export async function updateUserFaceAtomic(
  userId: string,
  biometricData: string | undefined,
  enrolledAt: string | undefined
): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const userDocRef = doc(firestoreDb, 'users', userId);
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    face_biometric_data: biometricData ?? null,
    face_enrolled_at: enrolledAt ?? null,
    updated_at: nowIso,
  };

  await setDoc(userDocRef, updatePayload, { merge: true });

  if (dbData && dbData.users) {
    const user = dbData.users.find((u) => u.id === userId);
    if (user) {
      user.face_biometric_data = biometricData;
      user.face_enrolled_at = enrolledAt;
      user.updated_at = nowIso;
    }
    saveLocalDatabaseOnly();
  }
}

export async function bulkCreateUsersAtomic(newUsers: User[]): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }
  if (!newUsers || newUsers.length === 0) return;

  const batch = writeBatch(firestoreDb);
  for (const u of newUsers) {
    const userDocRef = doc(firestoreDb, 'users', u.id);
    batch.set(userDocRef, u);
  }

  await batch.commit();

  if (dbData) {
    if (!dbData.users) dbData.users = [];
    dbData.users.push(...newUsers);
    saveLocalDatabaseOnly();
  }
}

// ============================================================================
// PHASE 2D: ATOMIC FIRESTORE MUTATION HELPERS (CHURCHES & TENANTS)
// ============================================================================

export async function createChurchAtomic(church: Church): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const churchDocRef = doc(firestoreDb, 'churches', church.id);
  await setDoc(churchDocRef, church);

  if (dbData) {
    if (!dbData.churches) dbData.churches = [];
    dbData.churches.push(church);
    saveLocalDatabaseOnly();
  }
}

export async function updateChurchAtomic(churchId: string, updates: Partial<Church>): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const churchDocRef = doc(firestoreDb, 'churches', churchId);
  const nowIso = updates.updated_at || new Date().toISOString();
  const payloadToSave = { ...updates, updated_at: nowIso };

  await setDoc(churchDocRef, payloadToSave, { merge: true });

  if (dbData && dbData.churches) {
    const idx = dbData.churches.findIndex((c) => c.id === churchId);
    if (idx !== -1) {
      dbData.churches[idx] = { ...dbData.churches[idx], ...payloadToSave };
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteChurchAtomic(churchId: string): Promise<void> {
  if (!firestoreDb) {
    throw new Error('قاعدة بيانات فايربيز غير متصلة');
  }

  const churchDocRef = doc(firestoreDb, 'churches', churchId);
  await deleteDoc(churchDocRef);

  if (dbData) {
    recordDeletedId(churchId);
    if (dbData.churches) {
      dbData.churches = dbData.churches.filter((c) => c.id !== churchId);
    }
    saveLocalDatabaseOnly();
  }
}

// ============================================================================
// PHASE 2E: ATOMIC FIRESTORE MUTATION HELPERS (ASSIGNMENTS, GENERAL MEETINGS, SCANNERS)
// ============================================================================

export async function createAssignmentAtomic(assignment: ServiceAssignment): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const asgRef = doc(firestoreDb, 'assignments', assignment.id);
  await setDoc(asgRef, assignment);
  if (dbData) {
    if (!dbData.assignments) dbData.assignments = [];
    dbData.assignments.push(assignment);
    saveLocalDatabaseOnly();
  }
}

export async function updateAssignmentAtomic(
  assignmentId: string,
  updates: Partial<ServiceAssignment>
): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const asgRef = doc(firestoreDb, 'assignments', assignmentId);
  await setDoc(asgRef, updates, { merge: true });
  if (dbData && dbData.assignments) {
    const idx = dbData.assignments.findIndex((a) => a.id === assignmentId);
    if (idx !== -1) {
      dbData.assignments[idx] = { ...dbData.assignments[idx], ...updates };
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteAssignmentAtomic(assignmentId: string): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const asgRef = doc(firestoreDb, 'assignments', assignmentId);
  await deleteDoc(asgRef);
  if (dbData) {
    recordDeletedId(assignmentId);
    if (dbData.assignments) {
      dbData.assignments = dbData.assignments.filter((a) => a.id !== assignmentId);
    }
    saveLocalDatabaseOnly();
  }
}

export async function createGeneralMeetingAtomic(meeting: GeneralMeeting): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'general_meetings', meeting.id);
  await setDoc(ref, meeting);
  if (dbData) {
    if (!dbData.general_meetings) dbData.general_meetings = [];
    dbData.general_meetings.push(meeting);
    saveLocalDatabaseOnly();
  }
}

export async function updateGeneralMeetingAtomic(
  meetingId: string,
  updates: Partial<GeneralMeeting>
): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'general_meetings', meetingId);
  const nowIso = updates.updated_at || new Date().toISOString();
  const payload = { ...updates, updated_at: nowIso };
  await setDoc(ref, payload, { merge: true });
  if (dbData && dbData.general_meetings) {
    const idx = dbData.general_meetings.findIndex((m) => m.id === meetingId);
    if (idx !== -1) {
      dbData.general_meetings[idx] = { ...dbData.general_meetings[idx], ...payload };
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteGeneralMeetingAtomic(meetingId: string): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'general_meetings', meetingId);
  await deleteDoc(ref);
  if (dbData) {
    recordDeletedId(meetingId);
    if (dbData.general_meetings) {
      dbData.general_meetings = dbData.general_meetings.filter((m) => m.id !== meetingId);
    }
    saveLocalDatabaseOnly();
  }
}

export async function createScannerDeviceAtomic(device: ScannerDevice): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'scanner_devices', device.id);
  await setDoc(ref, device);
  if (dbData) {
    if (!dbData.scanner_devices) dbData.scanner_devices = [];
    dbData.scanner_devices.push(device);
    saveLocalDatabaseOnly();
  }
}

export async function updateScannerDeviceAtomic(
  deviceId: string,
  updates: Partial<ScannerDevice>
): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'scanner_devices', deviceId);
  await setDoc(ref, updates, { merge: true });
  if (dbData && dbData.scanner_devices) {
    const idx = dbData.scanner_devices.findIndex((d) => d.id === deviceId);
    if (idx !== -1) {
      dbData.scanner_devices[idx] = { ...dbData.scanner_devices[idx], ...updates };
    }
    saveLocalDatabaseOnly();
  }
}

export async function deleteScannerDeviceAtomic(deviceId: string): Promise<void> {
  if (!firestoreDb) throw new Error('قاعدة بيانات فايربيز غير متصلة');
  const ref = doc(firestoreDb, 'scanner_devices', deviceId);
  await deleteDoc(ref);
  if (dbData) {
    recordDeletedId(deviceId);
    if (dbData.scanner_devices) {
      dbData.scanner_devices = dbData.scanner_devices.filter((d) => d.id !== deviceId);
    }
    saveLocalDatabaseOnly();
  }
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
