import express from "express"
import { createOrder, verifyPayment } from "../controller/billing.controller.js"
import { requireUser } from "../../../shared/auth/internalAuth.js"

const router = express.Router()

// requireUser is what stops these handlers running with an undefined userId.
// createOrder wrote `userId: undefined` into the Payment row, which then failed
// the required validator as an opaque 500; verifyPayment could not scope the
// order to an owner at all.
router.post("/create", requireUser, createOrder)
router.post("/verify", requireUser, verifyPayment)

export default router
