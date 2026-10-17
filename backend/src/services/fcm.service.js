import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

let isInitialized = false;
let isConfigured = false;

function maskToken(token) {
  if (!token || typeof token !== 'string') return '***';
  if (token.length <= 12) return '***';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

/**
 * Initializes Firebase Admin SDK using available environment credentials:
 * 1. FIREBASE_SERVICE_ACCOUNT (JSON string or base64 encoded JSON string)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH (Absolute or relative filepath to service account JSON)
 * 3. Default Application Credentials (GOOGLE_APPLICATION_CREDENTIALS)
 * Gracefully falls back to mock/simulation mode if not configured, never crashes.
 */
export function initFirebaseAdmin() {
  if (isInitialized) return isConfigured;
  isInitialized = true;

  try {
    let serviceAccount = null;

    // Option 1: Inline JSON or base64 string
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawCredentials && rawCredentials.trim()) {
      const trimmed = rawCredentials.trim();
      try {
        if (trimmed.startsWith('{')) {
          serviceAccount = JSON.parse(trimmed);
        } else {
          const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
          serviceAccount = JSON.parse(decoded);
        }
      } catch (err) {
        logger.push.error('Failed to parse FIREBASE_SERVICE_ACCOUNT credentials JSON:', err.message);
      }
    }

    // Option 2: File path
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (fs.existsSync(filePath)) {
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          serviceAccount = JSON.parse(fileContent);
        } catch (err) {
          logger.push.error('Failed to read FIREBASE_SERVICE_ACCOUNT_PATH file:', err.message);
        }
      } else {
        logger.push.warn(`FIREBASE_SERVICE_ACCOUNT_PATH file not found at: ${filePath}`);
      }
    }

    if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      isConfigured = true;
      logger.push.success(`Firebase Admin SDK initialized successfully for project: ${serviceAccount.project_id}`);
      return true;
    }

    // Option 3: Default application credentials check
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp();
      isConfigured = true;
      logger.push.success('Firebase Admin SDK initialized via GOOGLE_APPLICATION_CREDENTIALS');
      return true;
    }

    isConfigured = false;
    logger.push.info('Firebase Admin credentials not provided. Push notifications are running in simulated/mock mode.');
    return false;
  } catch (err) {
    isConfigured = false;
    logger.push.warn(`Firebase Admin SDK initialization skipped: ${err.message}`);
    return false;
  }
}

export function isFCMConfigured() {
  if (!isInitialized) {
    initFirebaseAdmin();
  }
  return isConfigured;
}

/**
 * Sends FCM push notification to multiple device tokens using batching (<= 500 per batch).
 * Handles invalid/unregistered token reporting for clean lifecycle deactivation.
 *
 * @param {Object} params
 * @param {string[]} params.tokens - FCM device registration tokens
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body
 * @param {Object} [params.data] - Key-value string pairs payload
 * @param {string} [params.category] - Notification category / channel ID
 * @returns {Promise<{ successCount: number, failureCount: number, invalidTokens: string[], isSimulated: boolean }>}
 */
export async function sendMulticastPush({
  tokens = [],
  title,
  body,
  data = {},
  category = 'komazi_orders',
}) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [], isSimulated: false };
  }

  // Ensure Firebase Admin is initialized
  if (!isInitialized) {
    initFirebaseAdmin();
  }

  // Prepare stringified data values (FCM requires all data payload entries to be strings)
  const stringifiedData = {};
  for (const [key, val] of Object.entries(data || {})) {
    if (val !== undefined && val !== null) {
      stringifiedData[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
  }

  // Simulated Mode (Dev/Testing without real credentials)
  if (!isConfigured) {
    logger.push.info(
      `[SIMULATED] PUSH.SEND | recipients=${tokens.length} title="${title}" category=${category}`,
      {
        tokensCount: tokens.length,
        sampleToken: maskToken(tokens[0]),
        title,
        body,
        category,
      }
    );
    return {
      successCount: tokens.length,
      failureCount: 0,
      invalidTokens: [],
      isSimulated: true,
    };
  }

  // Real FCM Mode
  const MAX_BATCH_SIZE = 500;
  let totalSuccess = 0;
  let totalFailure = 0;
  const invalidTokens = [];

  for (let i = 0; i < tokens.length; i += MAX_BATCH_SIZE) {
    const batchTokens = tokens.slice(i, i + MAX_BATCH_SIZE);

    const message = {
      tokens: batchTokens,
      notification: {
        title,
        body,
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          channelId: category,
          icon: 'ic_launcher',
          color: '#FF5722',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK', // standard click handler
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode = resp.error.code || '';
          const failedToken = batchTokens[idx];

          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(failedToken);
            logger.push.warn(`PUSH.INVALID_TOKEN | token=${maskToken(failedToken)} code=${errorCode}`, {
              code: errorCode,
              token: maskToken(failedToken),
            });
          } else {
            logger.push.warn(`PUSH.FAIL | code=${errorCode} message="${resp.error.message}"`, {
              code: errorCode,
              token: maskToken(failedToken),
            });
          }
        }
      });
    } catch (batchErr) {
      totalFailure += batchTokens.length;
      logger.push.error(`PUSH.FAIL batch error: ${batchErr.message}`, {
        error: batchErr.message,
        batchSize: batchTokens.length,
      });
    }
  }

  logger.push.info(
    `PUSH.SEND summary | success=${totalSuccess} failure=${totalFailure} invalid=${invalidTokens.length}`,
    {
      successCount: totalSuccess,
      failureCount: totalFailure,
      invalidCount: invalidTokens.length,
    }
  );

  return {
    successCount: totalSuccess,
    failureCount: totalFailure,
    invalidTokens,
    isSimulated: false,
  };
}

export const fcmService = {
  initFirebaseAdmin,
  isFCMConfigured,
  sendMulticastPush,
};

export default fcmService;
