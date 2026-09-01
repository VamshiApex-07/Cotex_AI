import { createSlice } from "@reduxjs/toolkit"

const initialState = {
    userData: null,
    // Stays "checking" until /api/me resolves. Without this, userData === null
    // means both "still checking" and "definitely signed out", which is what
    // made the login UI flash at already-signed-in users on every reload.
    authStatus: "checking", // "checking" | "guest" | "authenticating" | "authenticated"
    authError: null,
}

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setAuthStatus: (state, action) => {
            state.authStatus = action.payload
        },
        setAuthError: (state, action) => {
            state.authError = action.payload
        },
        // userData and authStatus always move together, in one dispatch, so no
        // render can observe a half-applied signed-in state. The old
        // setUserdata action is gone for that reason: setting userData without
        // authStatus is how logout used to strand the user on an empty shell.
        signedIn: (state, action) => {
            state.userData = action.payload
            state.authStatus = "authenticated"
            state.authError = null
        },
        // Lands on "guest", not on initialState. After a logout we already know
        // the answer — there is no session — whereas "checking" means "asking
        // the server", and nothing re-runs that check outside App's mount
        // effect. Resetting to initialState left the boot splash spinning until
        // the user refreshed.
        //
        // conversationSlice and messageSlice also listen for this action and do
        // reset to their own initialState: signing in as someone else must not
        // leave the previous user's conversations on screen.
        clearUser: () => ({ userData: null, authStatus: "guest", authError: null }),
    },
})

export const { setAuthStatus, setAuthError, signedIn, clearUser } =
    userSlice.actions
export default userSlice.reducer
