import { useEffect, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { motion, useReducedMotion } from "motion/react"
import { RefreshCw } from "lucide-react"

import Home from "./pages/Home"
import AuthPage from "./pages/AuthPage"
import BrandMark from "./components/BrandMark"
import { ToastProvider } from "./components/Toast"
import getCurrentUser from "./features/getCurrentUser"
import { setAuthStatus, setAuthError, signedIn } from "./redux/userSlice"

// Held on screen while /api/me resolves. Without it, the first paint has to
// guess, and it guessed "signed out" — which is why the login UI used to flash
// at users who were already signed in.
const BootSplash = () => {
    const reduceMotion = useReducedMotion()

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0f14]">
            <motion.div
                animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
                <BrandMark size={38} />
            </motion.div>
        </div>
    )
}

// Only reached when the session check itself failed — a 5xx or a dead network,
// never a plain "no session". Showing the sign-in page here would be a lie:
// the user may well be signed in and we simply couldn't tell.
const BootError = ({ onRetry }) => (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0f14] px-5 text-slate-100">
        <div className="w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#13151c] p-7 text-center">
            <BrandMark size={30} className="mx-auto" />
            <h1 className="mt-5 text-[16px] font-semibold tracking-tight">
                Couldn't verify your session
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                We couldn't confirm whether you're signed in. Check your
                connection — this usually clears on its own.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-6 flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 text-[13px] font-medium text-white transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151c]"
            >
                <RefreshCw size={14} />
                Try again
            </button>
        </div>
    </div>
)

function App() {
    const dispatch = useDispatch()
    const { authStatus, authError } = useSelector((state) => state.user)
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let cancelled = false

        const bootstrap = async () => {
            try {
                const user = await getCurrentUser()
                if (cancelled) return
                if (user) dispatch(signedIn(user))
                else dispatch(setAuthStatus("guest"))
            } catch (error) {
                if (cancelled) return
                console.error("[auth] session check failed", error)
                dispatch(setAuthError(error))
            }
        }

        dispatch(setAuthStatus("checking"))
        bootstrap()

        return () => {
            cancelled = true
        }
    }, [dispatch, attempt])

    if (authError) return <BootError onRetry={() => {
        dispatch(setAuthError(null))
        setAttempt((n) => n + 1)
    }} />
    if (authStatus === "checking") return <BootSplash />
    if (authStatus === "authenticated") return <ToastProvider><Home /></ToastProvider>

    return <ToastProvider><AuthPage /></ToastProvider>
}

export default App
