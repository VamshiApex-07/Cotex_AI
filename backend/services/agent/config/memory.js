import redis from "../../../shared/redis/redis.js"
import { getMessages } from "../utils/getMessages.js"

const MEMORY_TTL_SECONDS = 24 * 60 * 60
const MEMORY_WINDOW = 20

const memoryKey = (conversationId) => `messages-${conversationId}`

// The window used to be a single JSON blob under this key. LRANGE/RPUSHX against
// a leftover string fails with WRONGTYPE, and those same keys are the ones the
// old TTL-less SET left immortal, so they are deleted on first touch: the leak
// gets collected rather than orphaned under a new namespace, and the read falls
// through and rebuilds from the chat service.
const isWrongType = (error) => typeof error?.message === "string" && error.message.includes("WRONGTYPE")

const dropKey = async (key) => {
    try {
        await redis.del(key)
    } catch (error) {
        console.error("[memory] could not invalidate", key, error?.message)
    }
}

const encode = (role, content) => JSON.stringify({ role, content })

const decode = (raw) => {
    try {
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
        return { role: parsed.role, content: parsed.content }
    } catch {
        return null
    }
}

const readWindow = async (key) => {
    let entries
    try {
        entries = await redis.lrange(key, 0, -1)
    } catch (error) {
        if (isWrongType(error)) {
            await dropKey(key)
        } else {
            console.error("[memory] read failed for", key, error?.message)
        }
        return null
    }

    if (!Array.isArray(entries) || entries.length === 0) return null

    const messages = []
    for (const entry of entries) {
        const message = decode(entry)
        if (!message) {
            // A truncated or hand-edited entry used to throw straight out of
            // JSON.parse and take the request down with it. Treat the whole window
            // as poisoned and rebuild it instead.
            await dropKey(key)
            return null
        }
        messages.push(message)
    }

    return messages
}

export const getMemory = async (conversationId, userId) => {
    const key = memoryKey(conversationId)
    const cached = await readWindow(key)
    if (cached) return cached

    let history
    try {
        history = await getMessages(conversationId, userId)
    } catch (error) {
        // Deliberately not cached. Seeding the [] fallback turned a transient
        // chat-service blip into a full TTL of amnesia, because the empty key then
        // looked authoritative to every later read.
        console.error("[memory] history fetch failed for", conversationId, error?.message)
        return []
    }

    if (!Array.isArray(history)) {
        console.error("[memory] history fetch returned a non-array for", conversationId)
        return []
    }

    const messages = history
        .slice(-MEMORY_WINDOW)
        .map((message) => ({ role: message?.role, content: message?.content }))

    if (messages.length > 0) {
        try {
            const results = await redis
                .multi()
                // DEL in the same transaction so two concurrent seeds cannot leave
                // two interleaved copies of the history behind, and so a legacy
                // blob at this key is replaced instead of colliding.
                .del(key)
                .rpush(key, ...messages.map((message) => encode(message.role, message.content)))
                .expire(key, MEMORY_TTL_SECONDS)
                .exec()
            const failure = results?.find(([error]) => error)?.[0]
            if (failure) throw failure
        } catch (error) {
            console.error("[memory] seed failed for", conversationId, error?.message)
            await dropKey(key)
        }
    }

    return messages
}

export const addMessage = async (conversationId, role, content) => {
    const key = memoryKey(conversationId)

    try {
        const results = await redis
            .multi()
            // RPUSHX appends only if the window is already there. The cache is a
            // read-through view of the chat service, so a write must never be what
            // creates it: a one-entry key would shadow the real history for a whole
            // TTL. When it is absent, getMemory rebuilds from the chat service,
            // which already holds this turn.
            .rpushx(key, encode(role, content))
            // Keeps the newest MEMORY_WINDOW entries. Each command is atomic, which
            // is the point: the old GET/parse/push/SET was a read-modify-write and
            // dropped one of two messages that landed together.
            .ltrim(key, -MEMORY_WINDOW, -1)
            // SET with neither EX nor KEEPTTL clears the key's TTL, so the first
            // append after getMemory seeded a 24h expiry made the key permanent.
            // Re-arming it here also rolls the window forward from last activity.
            .expire(key, MEMORY_TTL_SECONDS)
            .exec()
        const failure = results?.find(([error]) => error)?.[0]
        if (failure) throw failure
    } catch (error) {
        if (!isWrongType(error)) {
            console.error("[memory] append failed for", conversationId, error?.message)
        }
        // The window is either a legacy blob or now missing a turn, so drop it and
        // let the next read rebuild from the chat service. Never rethrow: the turn
        // is already persisted and the caller has an answer to return.
        await dropKey(key)
    }
}
