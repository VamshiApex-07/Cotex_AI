// Single source of truth for what each agent costs. The auth service is
// authoritative — it owns the balance — but the agent service imports the same
// table so a reservation and its compensating refund can never disagree about
// the amount, which is what makes the saga safe to retry.
export const AGENT_COSTS = Object.freeze({
    chat: 1,
    search: 5,
    coding: 10,
    pdf: 10,
    ppt: 10,
    vision: 10
})

export const isKnownAgent = (agent) =>
    typeof agent === "string" && Object.prototype.hasOwnProperty.call(AGENT_COSTS, agent)

// Fails closed: an agent name that is not in the table is a bug or a probe, not
// a request to bill one credit. The old `COST[agent] || 1` fallback meant a
// typo'd or injected name silently downgraded a 10-credit call to 1.
export const costFor = (agent) => {
    if (!isKnownAgent(agent)) {
        throw Object.assign(new Error(`Unknown agent "${agent}"`), { status: 400 })
    }
    return AGENT_COSTS[agent]
}
