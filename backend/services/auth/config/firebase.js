import { cert, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

// 1. Parse JSON string from environment variable (Amplify / Production)
// Fallback to local file only for local development
let serviceAccount

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
} else {
  // Local development fallback
  const localKey = await import("./serviceAccountKey.json", { with: { type: "json" } })
  serviceAccount = localKey.default
}

// 2. Initialize App
export const app = initializeApp({
  credential: cert(serviceAccount)
})

export const adminAuth = getAuth(app)