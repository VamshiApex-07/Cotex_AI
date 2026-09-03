import express from "express"
import { login, logOut } from "../controllers/auth.controller.js"

// Public surface. Only these two are proxied by the gateway; everything else
// lives in internal.route.js behind the shared internal secret.
const router = express.Router()

router.post("/login", login)
router.post("/logout", logOut)

export default router
