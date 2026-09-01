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

// The session cookie is httpOnly, so JS can't read it — the returning-user
// greeting has to come from localStorage. Profile fields only, never a token.
const REMEMBERED_KEY = "cortex:lastUser"
const REMEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000

const readRemembered = () => {
    try {
        const raw = localStorage.getItem(REMEMBERED_KEY)
        if (!raw) return null
        const saved = JSON.parse(raw)
        // Expire it. This is PII sitting on a possibly shared machine, and a
        // months-old greeting is stale anyway.
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
        // Private browsing or storage disabled. The greeting is a nicety.
    }
}

const forgetRemembered = () => {
    try {
        localStorage.removeItem(REMEMBERED_KEY)
    } catch {
        // as above
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

const RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13151c]"

const AuthPage = () => {
    const dispatch = useDispatch()
    const { authStatus, authError } = useSelector((state) => state.user)
    const reduceMotion = useReducedMotion()

    // Read once on mount — re-reading on every render would fight the
    // "Use a different account" button.
    const [remembered, setRemembered] = useState(readRemembered)
    const [popupBlocked, setPopupBlocked] = useState(false)

    const busy = authStatus === "authenticating"

    // Reduced motion still gets a fade; only the movement is dropped.
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
            // Sets userData, flips authStatus, clears authError in one go, so
            // App can't observe a half-applied signed-in state.
            dispatch(signedIn(user))
        } catch (error) {
            // Closing the Google window is a decision, not a failure. Going
            // quietly back to rest is the whole point of this branch.
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

    const meshDrift = (x, y, duration) =>
        reduceMotion
            ? {}
            : {
                  animate: { x, y },
                  transition: {
                      duration,
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut",
                  },
              }

    return (
        <div className="min-h-screen w-full bg-[#0d0f14] flex text-slate-100">
            {/* ── Left: brand panel. Hidden below lg, where the card's own
                 header becomes the only branding. ───────────────────────── */}
            <aside className="relative hidden lg:flex flex-col justify-between w-[46%] max-w-[640px] shrink-0 overflow-hidden border-r border-white/[0.06] px-14 py-14">
                <motion.div
                    aria-hidden="true"
                    {...meshDrift(40, -30, 14)}
                    className="pointer-events-none absolute -top-24 -left-16 h-[420px] w-[420px] rounded-full bg-indigo-600/20 blur-[110px]"
                />
                <motion.div
                    aria-hidden="true"
                    {...meshDrift(-30, 40, 18)}
                    className="pointer-events-none absolute -bottom-32 left-24 h-[380px] w-[380px] rounded-full bg-violet-600/20 blur-[110px]"
                />

                <motion.div
                    {...enter()}
                    className="relative flex items-center gap-2.5"
                >
                    <BrandMark size={30} />
                    <span className="text-[17px] font-semibold tracking-tight">
                        CortexAI
                    </span>
                </motion.div>

                <div className="relative">
                    <motion.h2
                        {...enter(0.04)}
                        className="text-[34px] leading-[1.15] font-semibold tracking-tight max-w-[440px]"
                    >
                        Your AI-powered{" "}
                        <span className="bg-linear-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                            productivity suite
                        </span>
                    </motion.h2>

                    <motion.p
                        {...enter(0.09)}
                        className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-slate-400"
                    >
                        Chat, research, code, documents, slides and images — each
                        request routed to the agent built for it.
                    </motion.p>

                    <div className="mt-9 grid grid-cols-2 gap-2.5 max-w-[440px]">
                        {AGENTS.map(({ icon: Icon, label }, i) => (
                            <motion.div
                                key={label}
                                {...enter(0.14 + i * 0.04)}
                                className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5"
                            >
                                <Icon
                                    size={14}
                                    className="shrink-0 text-indigo-300/80"
                                />
                                <span className="text-[12.5px] text-slate-400">
                                    {label}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <motion.p
                    {...enter(0.4)}
                    className="relative text-[12px] text-slate-600"
                >
                    Free plan includes 100 credits to start.
                </motion.p>
            </aside>

            {/* ── Right: the card ───────────────────────────────────────── */}
            <main className="flex flex-1 items-center justify-center overflow-y-auto px-5 py-12">
                <motion.div
                    {...enter(0.1)}
                    className="w-full max-w-[380px] rounded-2xl border border-white/[0.08] bg-[#13151c] p-7 shadow-2xl shadow-black/40 backdrop-blur-sm"
                >
                    <div className="flex items-center gap-2.5">
                        <BrandMark size={26} />
                        <span className="text-[15px] font-semibold tracking-tight">
                            CortexAI
                        </span>
                    </div>

                    <h1 className="mt-6 text-[19px] font-semibold tracking-tight">
                        {remembered ? "Welcome back" : "Sign in to CortexAI"}
                    </h1>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                        {remembered
                            ? "Pick up where you left off."
                            : "Sign in with Google to start using your agents."}
                    </p>

                    {remembered && (
                        <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            {remembered.avatar ? (
                                <img
                                    src={remembered.avatar}
                                    alt=""
                                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                                />
                            ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-indigo-500 to-violet-500 text-[13px] font-medium">
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
                                    className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-3"
                                >
                                    <AlertCircle
                                        size={15}
                                        className="mt-px shrink-0 text-red-400"
                                    />
                                    <p className="text-[12.5px] leading-relaxed text-red-200/90">
                                        {authError}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* The gradient lives behind the button, not on it: Google's
                        brand guidelines require the button itself stay white,
                        Google-blue or black with the official mark. */}
                    <div className="group relative mt-5">
                        <div
                            aria-hidden="true"
                            className="absolute -inset-0.5 rounded-xl bg-linear-to-r from-indigo-500 to-violet-500 opacity-0 blur transition-opacity duration-300 group-hover:opacity-40"
                        />
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={busy}
                            aria-busy={busy}
                            className={`relative flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-white text-sm font-medium text-black/90 transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 ${RING}`}
                        >
                            {busy ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Signing you in…
                                </>
                            ) : (
                                <>
                                    <FcGoogle size={17} />
                                    Continue with Google
                                </>
                            )}
                        </button>
                    </div>

                    {remembered && (
                        <button
                            type="button"
                            onClick={handleUseDifferentAccount}
                            disabled={busy}
                            className={`mt-3 w-full cursor-pointer rounded-lg py-2 text-[12.5px] text-slate-500 transition-colors duration-150 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-60 ${RING}`}
                        >
                            Use a different account
                        </button>
                    )}

                    {popupBlocked && (
                        <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
                            <p className="text-[12px] leading-relaxed text-slate-400">
                                Look for the blocked-popup icon in your address
                                bar and choose{" "}
                                <span className="text-slate-300">
                                    always allow popups
                                </span>{" "}
                                for this site, then press the button again.
                            </p>
                        </div>
                    )}

                    <div className="mt-7 border-t border-white/[0.06] pt-5">
                        <div className="flex items-center gap-2 text-[12px] text-slate-500">
                            <Lock size={12} className="shrink-0" />
                            We never see your Google password.
                        </div>
                        <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-600">
                            By continuing you agree to our{" "}
                            <a
                                href="/terms"
                                className={`rounded text-slate-400 underline decoration-white/20 underline-offset-2 transition-colors hover:text-slate-300 ${RING}`}
                            >
                                Terms
                            </a>{" "}
                            and{" "}
                            <a
                                href="/privacy"
                                className={`rounded text-slate-400 underline decoration-white/20 underline-offset-2 transition-colors hover:text-slate-300 ${RING}`}
                            >
                                Privacy Policy
                            </a>
                            .
                        </p>
                    </div>
                </motion.div>
            </main>
        </div>
    )
}

export default AuthPage
