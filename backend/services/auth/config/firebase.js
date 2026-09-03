import { cert, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

let serviceAccount

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT.trim()

    // Strip leading/trailing single quotes if passed literally by shell/dotenv
    if (rawKey.startsWith("'") && rawKey.endsWith("'")) {
      rawKey = rawKey.slice(1, -1)
    }

    serviceAccount = JSON.parse(rawKey)
  } catch (err) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", err.message)
    throw err
  }
} else {
  // Local development fallback
  const localKey = await import("./serviceAccountKey.json", { with: { type: "json" } })
  serviceAccount = localKey.default
}

// Replace escaped newlines in RSA private key
if (serviceAccount && serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n")
}

export const app = initializeApp({
  credential: cert(serviceAccount)
})

export const adminAuth = getAuth(app)