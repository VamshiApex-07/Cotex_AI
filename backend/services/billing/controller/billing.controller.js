import crypto from "node:crypto"
import axios from "axios"
import razorpay from "../config/razorpay.js"
import Payment from "../models/payment.model.js"
import { getPlan, isPurchasablePlan } from "../../../shared/config/plans.js"
import { internalHeaders } from "../../../shared/auth/internalAuth.js"

const AUTH_TIMEOUT_MS = 8000
const ORDER_ID = /^[A-Za-z0-9_-]{6,64}$/
const PAYMENT_ID = /^[A-Za-z0-9_-]{6,64}$/
const SIGNATURE = /^[a-f0-9]{64}$/i

// timingSafeEqual throws on a length mismatch, and that throw is itself an
// oracle, so the signature is length-checked by regex first and then compared
// over fixed-width buffers.
const signatureMatches = (expectedHex, providedHex) => {
    if (!SIGNATURE.test(providedHex)) {
        return false
    }
    return crypto.timingSafeEqual(
        Buffer.from(expectedHex, "hex"),
        Buffer.from(providedHex, "hex")
    )
}

export const createOrder = async (req, res) => {
    try {
        const { plan } = req.body
        const userId = req.userId

        const selectedPlan = getPlan(plan)
        if (!selectedPlan) {
            return res.status(404).json({ code: "plan_not_found", message: "plan not found" })
        }
        // Razorpay rejects a zero-amount order, so asking for the free plan used
        // to surface as an opaque 500 rather than "this isn't purchasable".
        if (!isPurchasablePlan(selectedPlan.id)) {
            return res.status(400).json({ code: "plan_not_purchasable", message: "That plan cannot be purchased." })
        }

        const order = await razorpay.orders.create({
            amount: selectedPlan.amount * 100,
            currency: "INR",
            // Date.now() collides under concurrency; the receipt is the only
            // idempotency handle Razorpay gives us on the order side.
            receipt: `rcpt-${crypto.randomUUID()}`,
            notes: { userId, planId: selectedPlan.id }
        })

        await Payment.create({
            userId,
            orderId: order.id,
            amount: selectedPlan.amount,
            credits: selectedPlan.credits,
            plan: selectedPlan.id,
            currency: order.currency,
            status: "created"
        })

        return res.status(200).json({ order, plan: selectedPlan })
    } catch (error) {
        console.error("[billing] create order failed:", error?.message)
        return res.status(500).json({ code: "create_order_failed", message: "Could not start checkout." })
    }
}

export const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    const userId = req.userId

    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((v) => typeof v === "string")) {
        return res.status(400).json({ code: "invalid_payload", message: "Payment Verification Failed" })
    }
    if (!ORDER_ID.test(razorpay_order_id) || !PAYMENT_ID.test(razorpay_payment_id)) {
        return res.status(400).json({ code: "invalid_payload", message: "Payment Verification Failed" })
    }

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex")

    if (!signatureMatches(expectedSignature, razorpay_signature)) {
        return res.status(400).json({ code: "bad_signature", message: "Payment Verification Failed" })
    }

    let payment
    try {
        // The compare-and-swap that makes this endpoint replay-safe. The old code
        // did findOne then payment.status = "paid" then save(), with no check that
        // the status was still "created" — so replaying one valid signature
        // granted the plan again on every call, unboundedly. Matching on
        // status:"created" means the second caller updates nothing.
        // userId is scoped in too so an order can only be settled by its owner.
        payment = await Payment.findOneAndUpdate(
            { orderId: razorpay_order_id, userId, status: "created" },
            { $set: { status: "paid", paymentId: razorpay_payment_id } },
            { new: true }
        )
    } catch (error) {
        // A duplicate-key error here means this razorpay_payment_id is already
        // attached to another order — a replay across orders.
        if (error?.code === 11000) {
            return res.status(400).json({ code: "already_processed", message: "Payment already processed" })
        }
        console.error("[billing] claim order failed:", error?.message)
        return res.status(500).json({ code: "verify_failed", message: "Could not verify the payment." })
    }

    if (!payment) {
        // Either no such order for this user, or it is no longer "created" —
        // i.e. already settled. Both are a client error, and neither should
        // reach the credit grant.
        return res.status(400).json({ code: "already_processed", message: "Payment already processed" })
    }

    // Only now, holding an exclusive claim, ask Razorpay what actually happened.
    // A valid HMAC only proves the two ids were signed with our key; it says
    // nothing about whether money was captured or how much.
    let captured
    try {
        captured = await razorpay.payments.fetch(razorpay_payment_id)
    } catch (error) {
        // Transient: release the claim so a retry can succeed rather than
        // stranding a real payment.
        console.error("[billing] razorpay fetch failed:", error?.message)
        await Payment.updateOne(
            { _id: payment._id, status: "paid" },
            { $set: { status: "created" }, $unset: { paymentId: "" } }
        ).catch((e) => console.error("[billing] could not release claim:", e?.message))
        return res.status(503).json({ code: "verify_unavailable", message: "Could not verify the payment. Please retry." })
    }

    const expectedPaise = payment.amount * 100
    const mismatch =
        captured?.order_id !== razorpay_order_id ? "order_mismatch"
        : captured?.status !== "captured" ? `not_captured:${captured?.status}`
        : Number(captured?.amount) !== expectedPaise ? "amount_mismatch"
        : String(captured?.currency).toUpperCase() !== String(payment.currency).toUpperCase() ? "currency_mismatch"
        : null

    if (mismatch) {
        console.error(`[billing] payment ${razorpay_payment_id} rejected: ${mismatch}`)
        await Payment.updateOne(
            { _id: payment._id },
            { $set: { status: "failed", failureReason: mismatch } }
        ).catch((e) => console.error("[billing] could not mark failed:", e?.message))
        return res.status(400).json({ code: "payment_not_captured", message: "Payment Verification Failed" })
    }

    // The plan snapshot is read back off our own record, not off the request, and
    // auth re-derives the credit amount from the shared plan table — so the
    // number of credits granted is never influenced by the wire.
    try {
        await axios.post(
            `${process.env.AUTH_SERVICE}/internal/update-plan`,
            { userId: payment.userId, plan: payment.plan },
            { headers: internalHeaders(), timeout: AUTH_TIMEOUT_MS }
        )
    } catch (error) {
        // The money is real and verified but the grant did not land. Flagging it
        // rather than returning 500 means the row is findable for reconciliation
        // instead of looking identical to a completed payment.
        console.error(
            `[billing] RECONCILE order=${payment.orderId} user=${payment.userId} plan=${payment.plan}:`,
            error?.response?.status ?? error?.message
        )
        await Payment.updateOne(
            { _id: payment._id },
            { $set: { status: "reconcile", failureReason: "credit_grant_failed" } }
        ).catch((e) => console.error("[billing] could not mark reconcile:", e?.message))
        return res.status(502).json({
            code: "grant_pending",
            message: "Your payment went through but we couldn't apply the plan yet. It will be applied shortly."
        })
    }

    return res.status(200).json({ message: "Payment Verified", plan: payment.plan, credits: payment.credits })
}
