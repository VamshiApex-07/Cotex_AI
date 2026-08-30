import { getAuth } from "firebase-admin/auth"
import { app } from "../config/firebase.js"
import User from "../models/user.model.js"
import redis from "../../../shared/redis/redis.js"

export const login = async (req, res) => {
    try {
        const { token } = req.body
        const decoded = await getAuth(app).verifyIdToken(token)
        let user = await User.findOne({
            firebaseUid: decoded.uid
        })

        if (!user) {
            user = await User.create({
                firebaseUid: decoded.uid,
                name: decoded.name,
                email: decoded.email,
                avatar: decoded.picture
            })
        }

        const sessionId = crypto.randomUUID()
        await redis.set(`user-session-${user?._id}`,
            sessionId
            , "EX", 7 * 24 * 60 * 60)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: user._id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            plan: user.plan,
            credits: user.credits,
            totalCredits: user.totalCredits,
            planExpiresAt: user.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)




        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(user)

    } catch (error) {
        return res.status(500).json({ message: `login error ${error}` })
    }
}


export const logOut = async (req, res) => {
    try {
        const sessionId = req.cookies?.session
        await redis.del(`session-${sessionId}`)

        res.clearCookie("session")
        return res.status(200).json({ message: "logout successfully" })
    } catch (error) {
        return res.status(500).json({ message: `logout error ${error}` })
    }
}


export const updateUserPayment = async (req, res) => {
    try {
        const { plan, credits, userId } = req.body
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $inc: { credits: credits, totalCredits: credits },
                $set: { plan: plan, planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
            },
            { new: true }
        )
        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" })
        }

        const sessionId = await redis.get(`user-session-${updatedUser?._id}`)
        console.log("sessionId", sessionId)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            plan: updatedUser.plan,
            credits: updatedUser.credits,
            totalCredits: updatedUser.totalCredits,
            planExpiresAt: updatedUser.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)

        return res.status(200).json({ success: true })

    } catch (error) {
        return res.status(500).json({ message: `update user payment error ${error}` })
    }
}


export const deductCredits = async (req, res) => {
    try {
        const { userId, agent } = req.body
        
        const COST = {

            chat: 1,

            search: 5,

            coding: 10,

            pdf: 10,

            ppt: 10,

            vision: 10

        };

        const requiredCredits=COST[agent] || 1

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, credits: { $gte: requiredCredits } },
            { $inc: { credits: -requiredCredits } },
            { new: true }
        )

        if(!updatedUser){
            return res.status(400).json({message:"Not enough credits."})
        }

        const sessionId = await redis.get(`user-session-${updatedUser?._id}`)
        console.log("sessionId", sessionId)
        await redis.set(`session-${sessionId}`, JSON.stringify({
            userId: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatar: updatedUser.avatar,
            plan: updatedUser.plan,
            credits: updatedUser.credits,
            totalCredits: updatedUser.totalCredits,
            planExpiresAt: updatedUser.planExpiresAt
        }), "EX", 7 * 24 * 60 * 60)

        return res.status(200).json({ success: true ,credits:updatedUser.credits})
    } catch (error) {
  return res.status(500).json({ message: `deduct credits error ${error}` })
    }
}