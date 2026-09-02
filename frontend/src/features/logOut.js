import { signOut } from "firebase/auth"
import api from "../../utils/axios"
import { auth } from "../../utils/firebase"

// Clears both halves of the session: our Redis-backed cookie, and the Firebase
// client session, which otherwise survives in IndexedDB and silently signs the
// same account straight back in on the next attempt.
//
// Never throws — a failed logout must not trap the user in a signed-in shell,
// so the caller clears local state regardless.
async function logOut() {
    try {
        await api.post("/api/auth/logout")
    } catch (error) {
        console.error("[auth] server logout failed", error)
    }

    try {
        await signOut(auth)
    } catch (error) {
        console.error("[auth] firebase signOut failed", error)
    }
}

export default logOut
