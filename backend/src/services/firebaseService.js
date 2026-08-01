const admin = require("firebase-admin");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

let initialized = false;

function initialize() {
  if (initialized) return;
  if (!env.firebaseServiceAccountJson) {
    throw new ApiError(503, "Google sign-in is not configured", "GOOGLE_AUTH_NOT_CONFIGURED");
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.firebaseServiceAccountJson);
  } catch {
    throw new ApiError(500, "Invalid Firebase service account configuration", "FIREBASE_CONFIG_INVALID");
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  initialized = true;
}

async function verifyFirebaseToken(idToken) {
  initialize();
  return admin.auth().verifyIdToken(idToken, true);
}

module.exports = { verifyFirebaseToken };
