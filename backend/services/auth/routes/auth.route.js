import express from "express"
import { login, logOut } from "../controllers/auth.controller.js"

// Public surface. Only these two are proxied by the gateway; everything else
// lives in internal.route.js behind the shared internal secret.
const router = express.Router()

router.post("/login", login)
router.get("/logout", logOut)
// GET /logout is CSRF-triggerable under SameSite=Lax (a top-level navigation
// sends the cookie), so the worst case is a forced sign-out. POST is registered
// alongside it for the frontend to migrate onto; drop the GET once it has.
router.post("/logout", logOut)

export default router
