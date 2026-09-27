import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'kingly-blend-pxjsq',
  appId: '1:278322559017:web:5449dbb7d7179d7d930438',
  apiKey: 'AIzaSyBj1emGOIS0W01NlpHcpqmezdDHBp_76HY',
  authDomain: 'kingly-blend-pxjsq.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-churchservantsma-bc52da4f-f7ee-4431-b656-15d224f5a4eb',
  storageBucket: 'kingly-blend-pxjsq.firebasestorage.app',
  messagingSenderId: '278322559017',
};

let db: any = null;

try {
  let firebaseConfig = DEFAULT_FIREBASE_CONFIG;
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      firebaseConfig = { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(raw) };
    } catch {}
  }
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  console.log('✅ Firebase Firestore connected in server with database ID:', firebaseConfig.firestoreDatabaseId);
} catch (err: any) {
  console.warn('⚠️ Could not initialize Firebase Firestore in server:', err.message);
}

export { db, doc, getDoc, setDoc };
