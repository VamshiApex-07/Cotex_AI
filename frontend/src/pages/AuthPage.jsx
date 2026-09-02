import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { signInWithPopup } from "firebase/auth"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { FcGoogle } from "react-icons/fc"
import {
    AlertCircle,
    Code2,
    FileText,
    Globe,
    Image as ImageIcon,
    Loader2,
    Lock,
    MessageSquare,
    Presentation,
} from "lucide-react"

import BrandMark from "../components/BrandMark"
import login from "../features/login"
import { auth, googleProvider } from "../../utils/firebase"
import {
    isPopupBlocked,
    isSilentAuthError,
    toAuthMessage,
} from "../../utils/authErrors"
import { setAuthError, setAuthStatus, signedIn } from "../redux/userSlice"

const REMEMBERED_KEY = "cortex:lastUser"
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000

const readRemembered = () => {
    try {
        const raw = localStorage.getItem(REMEMBERED_KEY)
        if (!raw) return null
        const saved = JSON.parse(raw)
        if (!saved?.email || Date.now() - (saved.savedAt || 0) > REMEMBER_TTL_MS) {
            localStorage.removeItem(REMEMBERED_KEY)
            return null
        }
        return saved
    } catch {
        return null
    }
}

const writeRemembered = ({ email, name, avatar }) => {
    try {
        localStorage.setItem(
            REMEMBERED_KEY,
            JSON.stringify({ email, name, avatar, savedAt: Date.now() })
        )
    } catch {
        // Storage write failed - silently ignore
    }
}

const forgetRemembered = () => {
    try {
        localStorage.removeItem(REMEMBERED_KEY)
    } catch {
        // Storage remove failed - silently ignore
    }
}

const AGENTS = [
    { icon: MessageSquare, label: "Conversational chat" },
    { icon: Globe, label: "Live web research" },
    { icon: Code2, label: "Code generation" },
    { icon: FileText, label: "Ask your PDFs" },
    { icon: Presentation, label: "Slide decks" },
    { icon: ImageIcon, label: "Image generation" },
]

const EASE = [0.16, 1, 0.3, 1]

const AuthPage = () => {
    const dispatch = useDispatch()
    const { authStatus, authError } = useSelector((state) => state.user)
    const reduceMotion = useReducedMotion()

    const [remembered, setRemembered] = useState(readRemembered)
    const [popupBlocked, setPopupBlocked] = useState(false)

    const busy = authStatus === "authenticating"

    const enter = (delay = 0) =>
        reduceMotion
            ? {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  transition: { duration: 0.2, delay },
              }
            : {
                  initial: { opacity: 0, y: 12, scale: 0.98 },
                  animate: { opacity: 1, y: 0, scale: 1 },
                  transition: { duration: 0.35, ease: EASE, delay },
              }

    const handleGoogleLogin = async () => {
        dispatch(setAuthError(null))
        setPopupBlocked(false)
        dispatch(setAuthStatus("authenticating"))

        try {
            const cred = await signInWithPopup(auth, googleProvider)
            const token = await cred.user.getIdToken()
            const user = await login(token)

            writeRemembered(user)
            dispatch(signedIn(user))
        } catch (error) {
            if (isSilentAuthError(error)) {
                dispatch(setAuthStatus("guest"))
                return
            }

            console.error("[auth] sign-in failed", error)
            if (isPopupBlocked(error)) setPopupBlocked(true)
            dispatch(setAuthError(toAuthMessage(error)))
            dispatch(setAuthStatus("guest"))
        }
    }

    const handleUseDifferentAccount = () => {
        forgetRemembered()
        setRemembered(null)
        dispatch(setAuthError(null))
    }

    return (
        <div className="min-h-screen w-full bg-[#050507] flex text-slate-100 relative overflow-hidden">
            <div aria-hidden="true" className="fixed inset-0 pointer-events-none">
                <div className="orb orb-1 absolute opacity-30" />
                <div className="orb orb-2 absolute opacity-25" />
                <div className="orb orb-3 absolute opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-transparent to-indigo-950/30" />
            </div>

            <aside className="relative hidden lg:flex flex-col justify-between w-[46%] max-w-[640px] shrink-0 overflow-hidden px-14 py-14 z-10">
                <motion.div
                    {...enter()}
                    className="relative flex items-center gap-3"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <BrandMark size={22} className="text-white" />
                    </div>
                    <span className="text-[18px] font-bold tracking-tight">
                        CortexAI
                    </span>
                </motion.div>

                <div className="relative">
                    <motion.h2
                        {...enter(0.04)}
                        className="text-[36px] leading-[1.15] font-bold tracking-tight max-w-[440px]"
                    >
                        Your AI-powered{" "}
                        <span className="gradient-text">productivity suite</span>
                    </motion.h2>

                    <motion.p
                        {...enter(0.09)}
                        className="mt-5 max-w-[420px] text-[14px] leading-relaxed text-slate-400"
                    >
                        Chat, research, code, documents, slides and images — each
                        request routed to the agent built for it.
                    </motion.p>

                    <div className="mt-10 grid grid-cols-2 gap-3 max-w-[440px]">
                        {AGENTS.map(({ icon: Icon, label }, i) => (
                            <motion.div
                                key={label}
                                {...enter(0.14 + i * 0.04)}
                                className="card-premium flex items-center gap-3 rounded-xl px-4 py-3 group cursor-pointer"
                            >
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center group-hover:from-violet-600/30 group-hover:to-indigo-600/30 transition-all">
                                    <Icon
                                        size={15}
                                        className="text-violet-400"
                                    />
                                </div>
                                <span className="text-[12.5px] text-slate-300 group-hover:text-white transition-colors">
                                    {label}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <motion.p
                    {...enter(0.4)}
                    className="relative text-[12px] text-slate-500"
                >
                    Free plan includes 100 credits to start.
                </motion.p>
            </aside>

            <main className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12 z-10">
                <motion.div
                    {...enter(0.1)}
                    className="w-full max-w-[400px]"
                >
                    <div className="gradient-border p-8 rounded-2xl">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                <BrandMark size={18} className="text-white" />
                            </div>
                            <span className="text-[15px] font-semibold tracking-tight">
                                CortexAI
                            </span>
                        </div>

                        <h1 className="mt-6 text-[22px] font-bold tracking-tight">
                            {remembered ? "Welcome back" : "Sign in to CortexAI"}
                        </h1>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                            {remembered
                                ? "Pick up where you left off."
                                : "Sign in with Google to start using your agents."}
                        </p>

                        {remembered && (
                            <div className="mt-5 flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700/50 p-3">
                                {remembered.avatar ? (
                                    <img
                                        src={remembered.avatar}
                                        alt=""
                                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-violet-500/30"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-[14px] font-semibold">
                                        {(remembered.name || remembered.email)
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    {remembered.name && (
                                        <p className="truncate text-[13px] font-medium text-slate-200">
                                            {remembered.name}
                                        </p>
                                    )}
                                    <p className="truncate text-[12px] text-slate-500">
                                        {remembered.email}
                                    </p>
                                </div>
                            </div>
                        )}

                        <AnimatePresence initial={false}>
                            {authError && (
                                <motion.div
                                    key="auth-error"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div
                                        role="alert"
                                        aria-live="polite"
                                        className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3"
                                    >
                                        <AlertCircle
                                            size={16}
                                            className="mt-px shrink-0 text-red-400"
                                        />
                                        <p className="text-[12.5px] leading-relaxed text-red-200/90">
                                            {authError}
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-5">
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={busy}
                                aria-busy={busy}
                                className="btn-premium relative flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl text-[14px] font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <span className="flex items-center gap-3">
                                    {busy ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Signing you in…
                                        </>
                                    ) : (
                                        <>
                                            <FcGoogle size={20} className="group-hover:scale-110 transition-transform" />
                                            Continue with Google
                                        </>
                                    )}
                                </span>
                            </button>
                        </div>

                        {remembered && (
                            <button
                                type="button"
                                onClick={handleUseDifferentAccount}
                                disabled={busy}
                                className="mt-3 w-full cursor-pointer rounded-lg py-2.5 text-[12.5px] text-slate-400 transition-colors hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Use a different account
                            </button>
                        )}

                        {popupBlocked && (
                            <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                                <p className="text-[12px] leading-relaxed text-amber-200/80">
                                    Look for the blocked-popup icon in your address
                                    bar and choose{" "}
                                    <span className="text-amber-100 font-medium">
                                        always allow popups
                                    </span>{" "}
                                    for this site, then press the button again.
                                </p>
                            </div>
                        )}

                        <div className="mt-6 border-t border-slate-800 pt-5">
                            <div className="flex items-center gap-2 text-[12px] text-slate-500">
                                <Lock size={13} className="shrink-0 text-violet-500" />
                                We never see your Google password.
                            </div>
                            <p className="mt-3 text-[11.5px] leading-relaxed text-slate-600">
                                By continuing you agree to our{" "}
                                <a
                                    href="/terms"
                                    className="rounded text-slate-400 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-300"
                                >
                                    Terms
                                </a>{" "}
                                and{" "}
                                <a
                                    href="/privacy"
                                    className="rounded text-slate-400 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-300"
                                >
                                    Privacy Policy
                                </a>
                                .
                            </p>
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    )
}

export default AuthPage