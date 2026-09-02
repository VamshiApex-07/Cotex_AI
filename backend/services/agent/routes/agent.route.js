import express from "express"
import multerLib from "multer"
import upload from "../config/multer.js"
import { agent } from "../controllers/agent.controller.js"

const router = express.Router()

// multer reports limit violations and fileFilter rejections through its
// callback, not by throwing. Passing them straight to next() surfaced a 20MB
// upload and an internal fault as the same opaque 500, so the client could not
// tell the user what to do differently.
const uploadSingle = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (!error) {
            return next()
        }
        if (error instanceof multerLib.MulterError) {
            const isTooLarge = error.code === "LIMIT_FILE_SIZE"
            return res.status(isTooLarge ? 413 : 400).json({
                code: error.code,
                message: isTooLarge
                    ? "That file is too large. The limit is 20 MB."
                    : "We couldn't accept that upload."
            })
        }
        // fileFilter rejections carry the { status, data } shape used across
        // this service (see config/agentLimit.js).
        if (typeof error.status === "number") {
            return res.status(error.status).json(
                error.data ?? { code: "upload_rejected", message: "We couldn't accept that upload." }
            )
        }
        return next(error)
    })
}

router.post("/chat", uploadSingle, agent)

export default router
