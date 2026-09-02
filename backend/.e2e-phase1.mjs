// Throwaway end-to-end harness for the Phase 1 gateway patches. Runs the real
// gateway/index.js against a fake Redis and a stub downstream, then asserts the
// exact attacks the audit found. Deleted after use.
import net from "node:net"
import http from "node:http"
import { spawn } from "node:child_process"

const REDIS_PORT = 6399
const STUB_PORT = 6401
const GW_PORT = 6402

// ─── fake Redis (RESP) ───────────────────────────────────────────────────────
const store = new Map()
const bulk = (s) => (s === null ? "$-1\r\n" : `$${Buffer.byteLength(s)}\r\n${s}\r\n`)

const runCmd = ([cmd, ...args]) => {
    switch ((cmd || "").toUpperCase()) {
        case "GET": return bulk(store.has(args[0]) ? store.get(args[0]) : null)
        case "SET": store.set(args[0], args[1]); return "+OK\r\n"
        case "DEL": {
            let n = 0
            for (const k of args) if (store.delete(k)) n++
            return `:${n}\r\n`
        }
        case "TTL": return `:${store.has(args[0]) ? 3600 : -2}\r\n`
        case "INFO": return bulk("# Server\r\nredis_version:7.4.0\r\nloading:0\r\n# Replication\r\nrole:master\r\nconnected_slaves:0\r\n")
        case "PING": return "+PONG\r\n"
        default: return "+OK\r\n"
    }
}

const redisServer = net.createServer((sock) => {
    let buf = Buffer.alloc(0)
    let queue = null
    sock.on("data", (chunk) => {
        buf = Buffer.concat([buf, chunk])
        for (;;) {
            if (buf[0] !== 0x2a) break                       // '*'
            const head = buf.indexOf("\r\n")
            if (head < 0) break
            const n = parseInt(buf.slice(1, head), 10)
            let off = head + 2
            const parts = []
            let ok = true
            for (let i = 0; i < n; i++) {
                if (buf[off] !== 0x24) { ok = false; break }  // '$'
                const lenEnd = buf.indexOf("\r\n", off)
                if (lenEnd < 0) { ok = false; break }
                const len = parseInt(buf.slice(off + 1, lenEnd), 10)
                if (buf.length < lenEnd + 2 + len + 2) { ok = false; break }
                parts.push(buf.slice(lenEnd + 2, lenEnd + 2 + len).toString())
                off = lenEnd + 2 + len + 2
            }
            if (!ok) break
            buf = buf.slice(off)

            const verb = (parts[0] || "").toUpperCase()
            if (verb === "MULTI") { queue = []; sock.write("+OK\r\n") }
            else if (verb === "EXEC") {
                const replies = (queue || []).map(runCmd)
                queue = null
                sock.write(`*${replies.length}\r\n` + replies.join(""))
            } else if (queue) { queue.push(parts); sock.write("+QUEUED\r\n") }
            else sock.write(runCmd(parts))
        }
    })
    sock.on("error", () => {})
})

// ─── stub downstream service: echoes what the gateway actually forwarded ─────
const stub = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({
        sawPath: req.url,
        sawUserId: req.headers["x-user-id"] ?? null,
        sawInternal: req.headers["x-internal-secret"] ? "present" : null
    }))
})

const listen = (srv, port) => new Promise((r) => srv.listen(port, "127.0.0.1", r))
await listen(redisServer, REDIS_PORT)
await listen(stub, STUB_PORT)

// Seed: one legitimate session, plus the two artifacts the old bug created.
const VALID_SID = "b1b2c3d4-1111-4222-8333-444455556666"
const REAL_USER = "507f1f77bcf86cd799439011"
const ATTACKER = "aaaaaaaaaaaaaaaaaaaaaaaa"
store.set(`session-${VALID_SID}`, JSON.stringify({ userId: REAL_USER, name: "Real User", plan: "pro" }))
store.set("session-null", JSON.stringify({ userId: "507f1f77bcf86cd799439099", name: "Victim" }))
store.set("session-undefined", JSON.stringify({ userId: "507f1f77bcf86cd799439098", name: "Victim2" }))

const SECRET = "s".repeat(48)
const gw = spawn(process.execPath, ["gateway/index.js"], {
    env: {
        ...process.env,
        PORT: String(GW_PORT),
        AUTH_SERVICE: `http://127.0.0.1:${STUB_PORT}`,
        CHAT_SERVICE: `http://127.0.0.1:${STUB_PORT}`,
        AGENT_SERVICE: `http://127.0.0.1:${STUB_PORT}`,
        BILLING_SERVICE: `http://127.0.0.1:${STUB_PORT}`,
        FRONTEND_URL: "http://localhost:5173",
        REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`,
        INTERNAL_API_SECRET: SECRET
    },
    stdio: ["ignore", "pipe", "pipe"]
})
let gwLog = ""
gw.stdout.on("data", (d) => { gwLog += d })
gw.stderr.on("data", (d) => { gwLog += d })

const waitUp = async () => {
    for (let i = 0; i < 60; i++) {
        try { await fetch(`http://127.0.0.1:${GW_PORT}/`); return true } catch { await new Promise((r) => setTimeout(r, 250)) }
    }
    return false
}
if (!await waitUp()) {
    console.log("gateway did not start:\n" + gwLog)
    process.exit(1)
}

const call = async (path, { method = "GET", cookie, headers = {} } = {}) => {
    const res = await fetch(`http://127.0.0.1:${GW_PORT}${path}`, {
        method, headers: { ...headers, ...(cookie ? { cookie } : {}) },
        body: method === "POST" ? "{}" : undefined,
        ...(method === "POST" ? { headers: { "content-type": "application/json", ...headers, ...(cookie ? { cookie } : {}) } } : {})
    })
    let body
    try { body = await res.json() } catch { body = await res.text() }
    return { status: res.status, body }
}

let pass = 0, fail = 0
const check = (name, actual, expected) => {
    const ok = expected(actual)
    if (ok) { pass++; console.log(`  PASS  ${name}`) }
    else { fail++; console.log(`  FAIL  ${name}\n        got: ${JSON.stringify(actual)}`) }
}

console.log("\nC2 — credit-grant endpoints must be unreachable from the internet:")
check("POST /api/auth/update-plan     -> 404", await call("/api/auth/update-plan", { method: "POST" }), (r) => r.status === 404)
check("POST /api/auth/deduct-credits  -> 404", await call("/api/auth/deduct-credits", { method: "POST" }), (r) => r.status === 404)
check("POST /api/auth/reserve-credits -> 404", await call("/api/auth/reserve-credits", { method: "POST" }), (r) => r.status === 404)
check("POST /api/auth/internal/update-plan -> 404", await call("/api/auth/internal/update-plan", { method: "POST" }), (r) => r.status === 404)
check("path-tricks /api/auth/./update-plan -> 404", await call("/api/auth/./update-plan", { method: "POST" }), (r) => r.status === 404)
check("POST /api/auth/login still proxied", await call("/api/auth/login", { method: "POST" }), (r) => r.status === 200 && r.body.sawPath === "/login")
check("POST /api/auth/logout still proxied", await call("/api/auth/logout", { method: "POST" }), (r) => r.status === 200 && r.body.sawPath === "/logout")

console.log("\nC4 — session forgery:")
check("no cookie                 -> 401", await call("/api/chat/get-conversations"), (r) => r.status === 401)
check('cookie session=null       -> 401 (session-null key EXISTS in redis)', await call("/api/chat/get-conversations", { cookie: "session=null" }), (r) => r.status === 401)
check('cookie session=undefined  -> 401 (key exists too)', await call("/api/chat/get-conversations", { cookie: "session=undefined" }), (r) => r.status === 401)
check("cookie session=notauuid   -> 401", await call("/api/chat/get-conversations", { cookie: "session=notauuid" }), (r) => r.status === 401)
check("valid session             -> 200 + correct x-user-id", await call("/api/chat/get-conversations", { cookie: `session=${VALID_SID}` }), (r) => r.status === 200 && r.body.sawUserId === REAL_USER)

console.log("\nC2 — client-supplied identity headers must not survive the proxy:")
check("forged x-user-id on protected route is replaced",
    await call("/api/chat/get-conversations", { cookie: `session=${VALID_SID}`, headers: { "x-user-id": ATTACKER } }),
    (r) => r.status === 200 && r.body.sawUserId === REAL_USER)
check("forged x-user-id on PUBLIC /api/auth/login is stripped",
    await call("/api/auth/login", { method: "POST", headers: { "x-user-id": ATTACKER } }),
    (r) => r.status === 200 && r.body.sawUserId === null)
check("forged x-internal-secret is replaced, not passed through",
    await call("/api/auth/login", { method: "POST", headers: { "x-internal-secret": "attacker-value" } }),
    (r) => r.status === 200 && r.body.sawInternal === "present")
check("gateway stamps internal secret on protected routes",
    await call("/api/chat/get-conversations", { cookie: `session=${VALID_SID}` }),
    (r) => r.body.sawInternal === "present")

console.log("\nboot-time guard:")
const bad = spawn(process.execPath, ["gateway/index.js"], {
    env: { ...process.env, PORT: "6403", AUTH_SERVICE: "x", CHAT_SERVICE: "x", AGENT_SERVICE: "x", BILLING_SERVICE: "x", FRONTEND_URL: "x", REDIS_URL: `redis://127.0.0.1:${REDIS_PORT}`, INTERNAL_API_SECRET: "tooshort" },
    stdio: ["ignore", "pipe", "pipe"]
})
let badOut = ""
bad.stdout.on("data", (d) => { badOut += d }); bad.stderr.on("data", (d) => { badOut += d })
const badCode = await new Promise((r) => bad.on("exit", r))
check("short INTERNAL_API_SECRET -> non-zero exit", { badCode, msg: badOut.trim().split("\n")[0] }, (r) => r.badCode !== 0)

console.log(`\n${pass} passed, ${fail} failed`)
gw.kill(); redisServer.close(); stub.close()
process.exit(fail ? 1 : 0)
