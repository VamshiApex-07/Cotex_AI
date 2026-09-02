import redis from "../../shared/redis/redis.js"

// login issues session ids from crypto.randomUUID(), so anything that is not a
// v4 UUID cannot be a session this system minted. Checking the shape before the
// Redis lookup is what closes the session-null hole: updateUserPayment wrote a
// literal "session-null" key whenever the reverse mapping was missing, and a
// cookie whose value was the four characters "null" then resolved to that key
// and authenticated as the paying user. It also keeps unbounded attacker-chosen
// strings out of the keyspace.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const unauthorized = (res, code) =>
    res.status(401).json({ code, message: code === "session_expired" ? "Session Expired" : "Unauthorized" })

const protect = async (req, res, next) => {
    const sessionId = req.cookies?.session

    if (typeof sessionId !== "string" || !UUID_V4.test(sessionId)) {
        return unauthorized(res, "unauthorized")
    }

    let raw
    try {
        raw = await redis.get(`session-${sessionId}`)
    } catch (error) {
        // Redis being unreachable is not the caller's fault and must not read
        // as "bad credentials" — 503 so clients back off instead of logging out.
        console.error("[gateway] session lookup failed:", error?.message)
        return res.status(503).json({ code: "session_unavailable", message: "Service temporarily unavailable." })
    }

    if (!raw) {
        return unauthorized(res, "session_expired")
    }

    let session
    try {
        session = JSON.parse(raw)
    } catch {
        console.error("[gateway] discarding unparseable session blob")
        await redis.del(`session-${sessionId}`).catch(() => {})
        return unauthorized(res, "session_expired")
    }

    // Downstream services derive the acting user entirely from x-user-id, so a
    // session missing a userId must not be allowed to proxy — Mongoose would
    // strip the resulting undefined out of query filters and the request would
    // run unscoped.
    if (!session || typeof session.userId !== "string" || !/^[0-9a-fA-F]{24}$/.test(session.userId)) {
        return unauthorized(res, "session_expired")
    }

    req.user = session
    return next()
}

export default protect
