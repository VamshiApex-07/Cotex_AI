import express from "express"
import multer from "multer"
import {agent} from "../controllers/agent.controller.js"

const upload=multer()
const router=express.Router()

router.post("/chat",upload.single("file"),agent)

export default router
