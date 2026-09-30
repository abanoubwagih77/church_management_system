import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'kingly-blend-pxjsq',
  firestoreDatabaseId: 'ai-studio-churchservantsma-bc52da4f-f7ee-4431-b656-15d224f5a4eb',
};

let db: Firestore | null = null;
let adminApp: any = null;

try {
  let firebaseConfig = { ...DEFAULT_FIREBASE_CONFIG };
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.projectId) firebaseConfig.projectId = parsed.projectId;
      if (parsed.firestoreDatabaseId) firebaseConfig.firestoreDatabaseId = parsed.firestoreDatabaseId;
    } catch {}
  }

  // Priority to environment overrides if provided
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || firebaseConfig.projectId;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId;

  // Check if explicit service account credentials are provided via environment
  let credentialOption: any = undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const keyObj = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      credentialOption = cert(keyObj);
    } catch {
      console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT_KEY environment variable as JSON.');
    }
  }

  const appOptions: any = {
    projectId,
  };
  if (credentialOption) {
    appOptions.credential = credentialOption;
  }

  adminApp = getApps().length > 0 ? getApp() : initializeApp(appOptions);
  db = getFirestore(adminApp, databaseId);
  console.log(`✅ Privileged Firebase Admin Firestore initialized for project [${projectId}] and database [${databaseId}]`);
} catch (err: any) {
  console.warn('⚠️ Could not initialize Firebase Admin Firestore in server:', err.message);
}

/**
 * Normalizes document snapshots so that snap.exists() can be called as a function (Web SDK API)
 * or accessed as a boolean (Admin SDK API) without error.
 */
function wrapDocumentSnapshot(snap: any) {
  if (!snap) return snap;
  const isExisting = Boolean(snap.exists);
  if (typeof snap.exists !== 'function') {
    Object.defineProperty(snap, 'exists', {
      value: () => isExisting,
      writable: true,
      configurable: true,
    });
  }
  return snap;
}

export function doc(dbOrRef: any, ...pathSegments: string[]) {
  if (!dbOrRef) return null;
  const fullPath = pathSegments.filter(Boolean).join('/');
  if (typeof dbOrRef.doc === 'function') {
    return dbOrRef.doc(fullPath);
  }
  if (typeof dbOrRef.collection === 'function') {
    const parts = fullPath.split('/');
    if (parts.length === 1) {
      return dbOrRef.doc(parts[0]);
    }
  }
  return null;
}

export function collection(dbOrRef: any, ...pathSegments: string[]) {
  if (!dbOrRef) return null;
  const fullPath = pathSegments.filter(Boolean).join('/');
  if (typeof dbOrRef.collection === 'function') {
    return dbOrRef.collection(fullPath);
  }
  return null;
}

export async function getDoc(docRef: any) {
  if (!docRef || typeof docRef.get !== 'function') return null;
  const snap = await docRef.get();
  return wrapDocumentSnapshot(snap);
}

export async function getDocs(queryOrColl: any) {
  if (!queryOrColl || typeof queryOrColl.get !== 'function') {
    return { empty: true, size: 0, docs: [] };
  }
  const snap = await queryOrColl.get();
  if (snap && Array.isArray(snap.docs)) {
    snap.docs.forEach((d: any) => wrapDocumentSnapshot(d));
  }
  return snap;
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  if (!docRef || typeof docRef.set !== 'function') return;
  return docRef.set(data, options || {});
}

export async function updateDoc(docRef: any, data: any) {
  if (!docRef || typeof docRef.update !== 'function') return;
  return docRef.update(data);
}

export async function deleteDoc(docRef: any) {
  if (!docRef || typeof docRef.delete !== 'function') return;
  return docRef.delete();
}

export function writeBatch(database?: any) {
  const targetDb = database || db;
  if (!targetDb || typeof targetDb.batch !== 'function') {
    throw new Error('Firestore database instance required for writeBatch');
  }
  const batch = targetDb.batch();
  return {
    set: (docRef: any, data: any, options?: { merge?: boolean }) => {
      if (options && options.merge !== undefined) {
        return batch.set(docRef, data, { merge: options.merge });
      }
      return batch.set(docRef, data);
    },
    update: (docRef: any, data: any) => batch.update(docRef, data),
    delete: (docRef: any) => batch.delete(docRef),
    commit: () => batch.commit(),
  };
}

export async function runTransaction(database: any, updateFunction: (transaction: any) => Promise<any>) {
  const targetDb = database || db;
  if (!targetDb || typeof targetDb.runTransaction !== 'function') {
    throw new Error('Firestore database instance required for runTransaction');
  }
  return targetDb.runTransaction(async (transaction: any) => {
    const transactionWrapper = {
      get: async (docRef: any) => {
        const snap = await transaction.get(docRef);
        return wrapDocumentSnapshot(snap);
      },
      set: (docRef: any, data: any, options?: { merge?: boolean }) => {
        if (options && options.merge !== undefined) {
          return transaction.set(docRef, data, { merge: options.merge });
        }
        return transaction.set(docRef, data);
      },
      update: (docRef: any, data: any) => transaction.update(docRef, data),
      delete: (docRef: any) => transaction.delete(docRef),
    };
    return updateFunction(transactionWrapper);
  });
}

export const increment = (n: number) => FieldValue.increment(n);

export { db, adminApp };
