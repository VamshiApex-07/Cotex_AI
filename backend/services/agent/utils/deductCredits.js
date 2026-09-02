import axios from "axios"
import { internalHeaders } from "../../../shared/auth/internalAuth.js"

// Without an explicit timeout a hung auth service holds the agent request open
// forever, since axios defaults to no timeout at all.
const CREDITS_TIMEOUT_MS = 5000

// Reserved BEFORE the provider call so a user at zero credits never gets the
// expensive work done for free. userId travels in the header, not the body --
// the auth service reads identity only from x-user-id. Returns the full auth
// payload ({ success, credits, cost, reservationId }); the caller must keep
// reservationId and hand it to refundCredits to make the refund exactly-once.
export const reserveCredits = async (userId, agent) => {
    try {
        const { data } = await axios.post(
            `${process.env.AUTH_SERVICE}/internal/reserve-credits`,
            { agent },
            {
                headers: internalHeaders({ "x-user-id": userId }),
                timeout: CREDITS_TIMEOUT_MS
            }
        )
        return data
    } catch (error) {
        const status = error?.response?.status

        if (status === 402) {
            const message = error?.response?.data?.message || "Not enough credits."
            const insufficient = new Error(message)
            // Same synthetic { status, data } shape config/agentLimit.js throws,
            // which is what the agents and the error middleware already read.
            insufficient.status = 402
            insufficient.data = {
                code: "insufficient_credits",
                message
            }
            throw insufficient
        }

        // Never log the axios error object itself: it serialises the request
        // config, and that includes the internal secret header.
        if (status === 400) {
            // Auth fails closed on an unrecognised cost key rather than quietly
            // charging 1 credit, so this is a bug in the calling agent, not a
            // user-facing condition. Name the key so it is greppable.
            console.error(`[credits] reserve rejected unknown cost key "${agent}" userId=${userId} -- valid keys: chat, search, coding, pdf, ppt, vision`)
        } else {
            console.error(`[credits] reserve failed userId=${userId} agent=${agent} status=${status} message=${error?.message}`)
        }

        throw error
    }
}

// Compensating half of the saga. This runs inside a catch, so it must never
// throw: a refund error would replace the provider error the caller is already
// handling and the user would be shown the wrong failure. A dropped refund is
// logged with userId and agent instead so it can be reconciled by hand.
//
// reservationId is optional but strongly preferred: with it auth claims the
// reservation key and the refund is exactly-once. Without it auth falls back to
// a totalCredits clamp, which merely bounds a double-refund.
export const refundCredits = async (userId, agent, reservationId) => {
    try {
        const { data } = await axios.post(
            `${process.env.AUTH_SERVICE}/internal/refund-credits`,
            reservationId ? { agent, reservationId } : { agent },
            {
                headers: internalHeaders({ "x-user-id": userId }),
                timeout: CREDITS_TIMEOUT_MS
            }
        )
        return data
    } catch (error) {
        console.error(`[credits] REFUND DROPPED userId=${userId} agent=${agent} reservationId=${reservationId ?? "none"} status=${error?.response?.status} message=${error?.message}`)
        return null
    }
}
