import crypto from "node:crypto"
import { getAuth } from "firebase-admin/auth"
import { app } from "../config/firebase.js"
import User from "../models/user.model.js"
import redis from "../../../shared/redis/redis.js"
import { readCookie } from "../../../shared/http/cookies.js"
import { costFor, isKnownAgent } from "../../../shared/config/agentCosts.js"
import { getPlan } from "../../../shared/config/plans.js"

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
const RESERVATION_TTL_SECONDS = 15 * 60
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OBJECT_ID = /^[0-9a-fA-F]{24}$/

const sessionKey = (sessionId) => `session-${sessionId}`
const userSessionKey = (userId) => `user-session-${userId}`
const reservationKey = (reservationId) => `reservation-${reservationId}`

// The one definition of what a session looks like. It is what gets cached in
// Redis, what the gateway hands downstream as req.user, and what /api/me
// returns — so login must return it too, or the client sees a different shape
// after signing in than it does after a reload. It also keeps firebaseUid and
// __v off the wire.
const toSessionUser = (user) => ({
    userId: String(user._id),
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    plan: user.plan,
    credits: user.credits,
    totalCredits: user.totalCredits,
    planExpiresAt: user.planExpiresAt
})

// A session cookie travelling over plaintext HTTP is the whole account, so
// `secure` defaults on and only a deliberate opt-out turns it off for local
// development. It was previously hardcoded `false`.
const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000
})

// Rewrites the cached session blob after a balance or plan change. Writing
// `session-${undefined}` or `session-${null}` used to create a real, readable
// key — a cookie of the literal text "null" then authenticated as that user —
// so the reverse mapping must be validated, not just truthy-checked. KEEPTTL
// preserves the remaining window so this key and user-session-<id> continue to
// expire together instead of drifting apart on every write.
const refreshSessionCache = async (user) => {
    const userId = String(user._id)
    let sessionId
    try {
        sessionId = await redis.get(userSessionKey(userId))
    } catch (error) {
        console.error("[auth] could not read session mapping:", error?.message)
        return
    }
    if (typeof sessionId !== "string" || !UUID_V4.test(sessionId)) {
        return
    }
    try {
        await redis.set(sessionKey(sessionId), JSON.stringify(toSessionUser(user)), "KEEPTTL")
    } catch (error) {
        // A stale cached balance is recoverable; failing the request the caller
        // already paid for is not.
        console.error("[auth] could not refresh session cache:", error?.message)
    }
}

export const login = async (req, res) => {
    const { token } = req.body
    if (typeof token !== "string" || token.length === 0) {
        return res.status(400).json({ code: "missing_token", message: "Sign-in token missing. Please try again." })
    }
    let decoded
    try {
        decoded = await getAuth(app).verifyIdToken(token)
    } catch (error) {
        console.error("[auth] verifyIdToken failed:", error?.code || error?.message)
        return res.status(401).json({ code: "invalid_token", message: "Your sign-in session expired. Please try again." })
    }
    try {
        // Upsert rather than findOne-then-create: two tabs signing in at once
        // both missed the read and both called create, and only the unique
        // index on firebaseUid turned the second into a 500.
        const user = await User.findOneAndUpdate(
            { firebaseUid: decoded.uid },
            {
                $setOnInsert: {
                    firebaseUid: decoded.uid,
                    name: decoded.name,
                    email: decoded.email,
                    avatar: decoded.picture
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        )

        const userId = String(user._id)
        const previousSessionId = await redis.get(userSessionKey(userId))
        const sessionId = crypto.randomUUID()

        // One pipeline so a crash cannot leave the reverse mapping pointing at a
        // session blob that was never written.
        const pipeline = redis.multi()
        if (typeof previousSessionId === "string" && UUID_V4.test(previousSessionId)) {
            pipeline.del(sessionKey(previousSessionId))
        }
        pipeline.set(userSessionKey(userId), sessionId, "EX", SESSION_TTL_SECONDS)
        pipeline.set(sessionKey(sessionId), JSON.stringify(toSessionUser(user)), "EX", SESSION_TTL_SECONDS)
        await pipeline.exec()

        res.cookie("session", sessionId, cookieOptions())
        return res.status(200).json(toSessionUser(user))
    } catch (error) {
        console.error("[auth] login failed:", error)
        return res.status(500).json({ code: "login_failed", message: "We couldn't complete sign-in. Please try again." })
    }
}

export const logOut = async (req, res) => {
    // This service has no cookie-parser dependency, so req.cookies is undefined
    // here and the old `req.cookies?.session` meant logout only ever deleted the
    // literal key "session-undefined" — no session was ever invalidated.
    const sessionId = readCookie(req, "session")

    // Clear the cookie regardless of what we find server-side; a caller asking
    // to log out should always end up logged out locally.
    res.clearCookie("session", { ...cookieOptions(), maxAge: undefined })

    if (typeof sessionId !== "string" || !UUID_V4.test(sessionId)) {
        return res.status(200).json({ message: "logout successfully" })
    }

    try {
        const raw = await redis.get(sessionKey(sessionId))
        const pipeline = redis.multi()
        pipeline.del(sessionKey(sessionId))

        // The reverse mapping is what enforces single-session-per-user. Leaving
        // it behind meant the next login deleted an already-dead session id and
        // the orphaned mapping survived for the full 7 days.
        if (raw) {
            try {
                const { userId } = JSON.parse(raw)
                if (typeof userId === "string" && OBJECT_ID.test(userId)) {
                    pipeline.del(userSessionKey(userId))
                }
            } catch {
                console.error("[auth] unparseable session blob during logout")
            }
        }
        await pipeline.exec()
        return res.status(200).json({ message: "logout successfully" })
    } catch (error) {
        console.error("[auth] logout failed:", error?.message)
        // The cookie is already cleared, so report success rather than telling
        // the user they are still signed in.
        return res.status(200).json({ message: "logout successfully" })
    }
}

// Internal only. Called by the billing service after it has verified a Razorpay
// signature and atomically claimed the order, so `userId` here comes from
// billing's own Payment record rather than from an end user. `credits` is no
// longer accepted from the wire at all — it is looked up from the shared plan
// table, because the previous version took plan, credits AND userId straight
// from an unauthenticated request body.
export const updateUserPayment = async (req, res) => {
    try {
        const { plan, userId } = req.body

        if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
            return res.status(400).json({ code: "invalid_user", message: "Invalid user id." })
        }
        const selectedPlan = getPlan(plan)
        if (!selectedPlan) {
            return res.status(400).json({ code: "invalid_plan", message: "Unknown plan." })
        }

        const validityMs = selectedPlan.validity * 24 * 60 * 60 * 1000
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { credits: selectedPlan.credits, totalCredits: selectedPlan.credits },
                $set: { plan: selectedPlan.id, planExpiresAt: new Date(Date.now() + validityMs) }
            },
            { new: true }
        )
        if (!updatedUser) {
            return res.status(404).json({ code: "user_not_found", message: "User not found" })
        }

        await refreshSessionCache(updatedUser)
        return res.status(200).json({ success: true, credits: updatedUser.credits, plan: updatedUser.plan })
    } catch (error) {
        console.error("[auth] update plan failed:", error)
        return res.status(500).json({ code: "update_plan_failed", message: "Could not apply the plan." })
    }
}

// Internal only. Debits up front so an out-of-credit user cannot make us pay a
// provider first and discover the shortfall afterwards. The conditional
// findOneAndUpdate is itself atomic — the previous version wrapped the same
// statement in a mongoose transaction, which added a replica-set requirement,
// and performed a Redis write inside the transaction that a later rollback
// could not undo.
export const reserveCredits = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        const { agent } = req.body

        if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
            return res.status(401).json({ code: "unauthorized", message: "Unauthorized" })
        }
        if (!isKnownAgent(agent)) {
            return res.status(400).json({ code: "unknown_agent", message: "Unknown agent." })
        }

        const cost = costFor(agent)
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, credits: { $gte: cost } },
            { $inc: { credits: -cost } },
            { new: true }
        )

        if (!updatedUser) {
            // Either the user is gone or the balance is short. Distinguishing
            // them costs an extra read and tells a caller nothing actionable.
            return res.status(402).json({
                code: "insufficient_credits",
                message: "Not enough credits."
            })
        }

        // Lets a refund be applied exactly once. Without it a retried refund
        // would credit twice; the refund path also clamps to totalCredits, so an
        // unaccompanied refund is bounded rather than unbounded.
        const reservationId = crypto.randomUUID()
        try {
            await redis.set(reservationKey(reservationId), `${userId}:${agent}`, "EX", RESERVATION_TTL_SECONDS)
        } catch (error) {
            console.error("[auth] could not record reservation:", error?.message)
        }

        await refreshSessionCache(updatedUser)
        return res.status(200).json({
            success: true,
            credits: updatedUser.credits,
            cost,
            reservationId
        })
    } catch (error) {
        console.error("[auth] reserve credits failed:", error)
        return res.status(500).json({ code: "reserve_failed", message: "Could not reserve credits." })
    }
}

// Internal only. Compensating half of the reservation saga: the agent service
// calls this when the provider call it reserved for threw.
export const refundCredits = async (req, res) => {
    try {
        const userId = req.headers["x-user-id"]
        const { agent, reservationId } = req.body

        if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
            return res.status(401).json({ code: "unauthorized", message: "Unauthorized" })
        }
        if (!isKnownAgent(agent)) {
            return res.status(400).json({ code: "unknown_agent", message: "Unknown agent." })
        }

        if (typeof reservationId !== "string" || !UUID_V4.test(reservationId)) {
            return res.status(400).json({ code: "invalid_reservation", message: "A valid reservationId is required for refunds." })
        }

        // Claim the reservation before crediting. Claiming first can lose a
        // refund if the write below fails, which is the safer direction to
        // fail than crediting twice — and it is logged either way.
        const claimed = await redis.del(reservationKey(reservationId))
        if (claimed === 0) {
            return res.status(200).json({
                success: false,
                code: "reservation_not_found",
                message: "Reservation already settled or expired."
            })
        }

        const cost = costFor(agent)

        // An aggregation-pipeline update so the refund can never mint credits
        // beyond what the account was actually granted, however many times it
        // arrives.
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            [
                {
                    $set: {
                        credits: {
                            $min: [{ $add: ["$credits", cost] }, "$totalCredits"]
                        }
                    }
                }
            ],
            { new: true }
        )

        if (!updatedUser) {
            console.error(`[auth] refund target user ${userId} not found; ${cost} credits dropped`)
            return res.status(404).json({ code: "user_not_found", message: "User not found" })
        }

        await refreshSessionCache(updatedUser)
        return res.status(200).json({ success: true, credits: updatedUser.credits })
    } catch (error) {
        console.error("[auth] refund credits failed:", error)
        return res.status(500).json({ code: "refund_failed", message: "Could not refund credits." })
    }
}

// Kept so a missed call site keeps working; the semantics are identical now
// that the debit happens before the provider call rather than after it.

