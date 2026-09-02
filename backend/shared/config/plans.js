// Shared by billing (to price the Razorpay order) and auth (to decide how many
// credits a paid plan grants). Auth must never take a credit amount from a
// request body — it looks the plan up here instead, so the wire only ever
// carries a plan id.
export const PLANS = Object.freeze({
    free: Object.freeze({ id: "free", name: "Free", amount: 0, credits: 100, validity: 30 }),
    starter: Object.freeze({ id: "starter", name: "Starter", amount: 199, credits: 500, validity: 30 }),
    pro: Object.freeze({ id: "pro", name: "Pro", amount: 499, credits: 1000, validity: 30 })
})

// "free" is not purchasable: Razorpay rejects a zero-amount order, so an order
// for it used to surface as an opaque 500.
export const PURCHASABLE_PLAN_IDS = Object.freeze(
    Object.values(PLANS).filter((plan) => plan.amount > 0).map((plan) => plan.id)
)

export const isPurchasablePlan = (planId) => PURCHASABLE_PLAN_IDS.includes(planId)

export const getPlan = (planId) =>
    typeof planId === "string" && Object.prototype.hasOwnProperty.call(PLANS, planId)
        ? PLANS[planId]
        : null
