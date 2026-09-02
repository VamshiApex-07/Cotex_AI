import crypto from "node:crypto"

// Header the gateway stamps on every proxied request and that services require
// before they will honour x-user-id. Services listen on 8001-8004 with no
// network isolation (docker-compose only defines redis), so without this any
// process that can reach the port could forge an identity header.
export const INTERNAL_HEADER = "x-internal-secret"

const MIN_SECRET_LENGTH = 32

// timingSafeEqual throws when the buffers differ in length, and that throw is
// itself a length oracle. Hashing both sides first makes every comparison
// fixed-width so only the constant-time compare is observable.
const safeEqual = (a, b) => {
    const left = crypto.createHash("sha256").update(a, "utf8").digest()
    const right = crypto.createHash("sha256").update(b, "utf8").digest()
    return crypto.timingSafeEqual(left, right)
}

export const assertInternalSecret = () => {
    const secret = process.env.INTERNAL_API_SECRET
    if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `INTERNAL_API_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters. ` +
            `Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
        )
    }
    return secret
}

export const internalSecret = () => process.env.INTERNAL_API_SECRET ?? ""

// Spread onto outbound service-to-service requests.
export const internalHeaders = (extra = {}) => ({
    [INTERNAL_HEADER]: internalSecret(),
    ...extra
})

export const requireInternal = (req, res, next) => {
    const provided = req.headers[INTERNAL_HEADER]
    const expected = internalSecret()

    if (expected.length < MIN_SECRET_LENGTH) {
        console.error("[internal-auth] INTERNAL_API_SECRET is missing or too short; refusing all internal calls")
        return res.status(500).json({ code: "server_misconfigured", message: "Server misconfigured" })
    }
    if (typeof provided !== "string" || provided.length === 0) {
        return res.status(401).json({ code: "internal_auth_required", message: "Unauthorized" })
    }
    if (!safeEqual(provided, expected)) {
        return res.status(401).json({ code: "internal_auth_invalid", message: "Unauthorized" })
    }
    return next()
}

// Every user-scoped handler reads identity from here and nowhere else. The
// gateway is the only writer of x-user-id (it deletes any inbound copy first),
// so a present-and-well-formed value is a value it vouched for.
const OBJECT_ID = /^[0-9a-fA-F]{24}$/

export const requireUser = (req, res, next) => {
    const userId = req.headers["x-user-id"]
    if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
        return res.status(401).json({ code: "unauthorized", message: "Unauthorized" })
    }
    req.userId = userId
    return next()
}
