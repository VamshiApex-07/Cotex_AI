
import api from "../../utils/axios"

// Resolves to the user when a session is live, or null when there simply isn't
// one. Anything else — network down, or a Redis blip surfacing as a 500 — is
// re-thrown, so App can tell "signed out" apart from "couldn't check" and show
// a message instead of silently presenting the sign-in screen.
const getCurrentUser=async () => {

    try {
        const {data}=await api.get("/api/me")
        return data
    } catch (error) {
        // The gateway answers 400 for a missing or expired session today, 401
        // once that's corrected. Both mean the same thing here.
        const status=error?.response?.status
        if(status===400 || status===401) return null
        throw error
    }
}

export default getCurrentUser
