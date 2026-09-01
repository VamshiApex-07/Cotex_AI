// Every message the auth UI shows the user comes through here, so the copy
// stays consistent whether the failure came from Firebase or from our own API.

// Deliberate cancels: the user closed the Google window on purpose. Showing a
// red banner for these reads as a bug, so callers check this first and stay
// quiet.
const SILENT_CODES = new Set([
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/user-cancelled",
])

const FIREBASE_MESSAGES = {
    "auth/popup-blocked":
        "Your browser blocked the sign-in window. Allow popups for this site, then try again.",
    "auth/network-request-failed":
        "Can't reach Google right now. Check your connection and try again.",
    "auth/too-many-requests":
        "Too many sign-in attempts. Wait a moment before trying again.",
    "auth/account-exists-with-different-credential":
        "This email is already registered with a different sign-in method.",
    "auth/unauthorized-domain":
        "This domain isn't authorised for sign-in. Add it in Firebase → Authentication → Settings.",
    "auth/web-storage-unsupported":
        "Sign-in needs browser storage. Turn off private browsing, or allow cookies for this site.",
    "auth/internal-error": "Google sign-in failed unexpectedly. Please try again.",
}

export const isSilentAuthError = (error) => SILENT_CODES.has(error?.code)

export const isPopupBlocked = (error) => error?.code === "auth/popup-blocked"

export const toAuthMessage = (error) => {
    if (FIREBASE_MESSAGES[error?.code]) return FIREBASE_MESSAGES[error.code]

    // axios hangs the server payload off error.response, not error.data.
    const status = error?.response?.status
    if (status === 400 || status === 401)
        return "Your sign-in expired before we could finish. Please try again."
    if (status === 429) return "Too many sign-in attempts. Please wait a minute."
    if (status >= 500)
        return "We couldn't complete sign-in. Please try again in a moment."

    if (error?.code === "ERR_NETWORK")
        return "Can't reach CortexAI. Check your connection and try again."

    return "Something went wrong signing you in. Please try again."
}
