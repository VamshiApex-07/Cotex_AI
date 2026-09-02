import express from "express"
import { refundCredits, reserveCredits, updateUserPayment } from "../controllers/auth.controller.js"

// Service-to-service only. Mounted in index.js behind `requireInternal`, and
// deliberately NOT proxied by the gateway. These four handlers move money: the
// whole auth router used to be mounted publicly and unauthenticated, so one
// curl to /api/auth/update-plan granted any userId a paid plan and arbitrary
// credits.
const router = express.Router()

router.post("/update-plan", updateUserPayment)
router.post("/reserve-credits", reserveCredits)
router.post("/refund-credits", refundCredits)
// Alias for callers that have not moved to /reserve-credits yet.
router.post("/deduct-credits", reserveCredits)

export default router
