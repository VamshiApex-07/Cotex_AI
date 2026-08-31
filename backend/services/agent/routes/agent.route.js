import express from "express"
import multer from "../config/multer.js"
import {agent} from "../controllers/agent.controller.js"

const router=express.Router()

router.post("/chat",multer.single("file"),agent)

export default router
