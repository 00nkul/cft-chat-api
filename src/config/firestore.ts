import { readFileSync } from 'node:fs';
import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from './env';

function init(): void {
  if (getApps().length > 0) return;

  if (env.FIREBASE_SERVICE_ACCOUNT && !env.FIRESTORE_EMULATOR_HOST) {
    const serviceAccount = JSON.parse(
      readFileSync(env.FIREBASE_SERVICE_ACCOUNT, 'utf8'),
    ) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount), projectId: env.FIREBASE_PROJECT_ID });
  } else {
    initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  }
}

init();

export const db = getFirestore();