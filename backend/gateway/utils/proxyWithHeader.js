import proxy from "express-http-proxy"
import { INTERNAL_HEADER, internalSecret } from "../../shared/auth/internalAuth.js"

const BODY_LIMIT = "50mb"

// Node lowercases inbound header names, but express-http-proxy copies the header
// object verbatim and a decorator could see a differently-cased key, so match
// case-insensitively rather than assuming.
const stripHeader = (headers, name) => {
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === name) {
            delete headers[key]
        }
    }
}

// The gateway is the only writer of x-user-id, and no downstream service
// authenticates independently — they trust the header. So a client-supplied
// x-user-id (or x-internal-secret) must be deleted before the request is
// forwarded, otherwise anyone could impersonate any user by setting a header.
// The previous decorator only overwrote x-user-id on authenticated routes and
// left it untouched on /api/auth, which the proxy forwarded verbatim.
export const proxyWithHeader = (serviceUrl, { authenticated = true } = {}) =>
    proxy(serviceUrl, {
        limit: BODY_LIMIT,
        proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
            stripHeader(proxyReqOpts.headers, "x-user-id")
            stripHeader(proxyReqOpts.headers, INTERNAL_HEADER)

            if (authenticated) {
                const userId = srcReq.user?.userId
                if (!userId) {
                    // Unreachable while `protect` runs first; a throw here is
                    // the fail-closed backstop if a route is ever mounted
                    // without it.
                    throw Object.assign(new Error("proxy reached without a resolved session"), { status: 401 })
                }
                proxyReqOpts.headers["x-user-id"] = String(userId)
            }

            proxyReqOpts.headers[INTERNAL_HEADER] = internalSecret()
            return proxyReqOpts
        }
    })
