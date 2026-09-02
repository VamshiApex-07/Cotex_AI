// Minimal Cookie header parser. The auth service does not depend on
// cookie-parser (it is not in services/auth/package.json), which is why
// logOut's `req.cookies?.session` was always undefined and it spent its life
// deleting the literal key "session-undefined" — logout never invalidated
// anything. Parsing the raw header here fixes that without adding a dependency.
export const parseCookies = (cookieHeader) => {
    const jar = Object.create(null)
    if (typeof cookieHeader !== "string" || cookieHeader.length === 0) {
        return jar
    }
    for (const pair of cookieHeader.split(";")) {
        const eq = pair.indexOf("=")
        if (eq < 1) {
            continue
        }
        const name = pair.slice(0, eq).trim()
        if (!name || name in jar) {
            continue
        }
        let value = pair.slice(eq + 1).trim()
        if (value.length >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.slice(1, -1)
        }
        try {
            jar[name] = decodeURIComponent(value)
        } catch {
            jar[name] = value
        }
    }
    return jar
}

export const readCookie = (req, name) => {
    if (req.cookies && typeof req.cookies[name] === "string") {
        return req.cookies[name]
    }
    return parseCookies(req.headers?.cookie)[name]
}
