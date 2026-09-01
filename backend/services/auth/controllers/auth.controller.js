import { getAuth } from "firebase-admin/auth"
import { app } from "../config/firebase.js"
import User from "../models/user.model.js"
import redis from "../../../shared/redis/redis.js"

// The one definition of what a session looks like. It is what gets cached in
// Redis, what the gateway hands downstream as req.user, and what /api/me
// returns — so login must return it too, or the client sees a different shape
// after signing in than it does after a reload. It also keeps firebaseUid and
// __v off the wire.
const toSessionUser = (user) => ({
    userId: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    plan: user.plan,
    credits: user.credits,
    totalCredits: user.totalCredits,
    planExpiresAt: user.planExpiresAt
})

export const login = async (req, res) => {
    const { token } = req.body

    if (!token) {
        return res.status(400).json({
            code: "missing_token",
            message: "Sign-in token missing. Please try again."
        })
    }

    // Verification needs its own try/catch. A bad or expired token is a 401 the
    // client recovers from by reopening the popup; everything below it is a 500
    // it can only retry later. A single catch around both cannot tell them
    // apart, so both used to come back as 500.
    let decoded
    try {
        decoded = await getAuth(app).verifyIdToken(token)
    } catch (error) {
        console.error("[auth] verifyIdToken failed:", error?.code || error?.message)
        return res.status(401).json({
            code: "invalid_token",
            message: "Your sign-in session expired. Please try again."
        })
    }

    try {
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
        await redis.set(`session-${sessionId}`, JSON.stringify(toSessionUser(user)), "EX", 7 * 24 * 60 * 60)




        res.cookie("session", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.status(200).json(toSessionUser(user))

    } catch (error) {
        // Logged server-side, never echoed: the old response interpolated the
        // raw error into the body and shipped internal text to the browser.
        console.error("[auth] login failed:", error)
        return res.status(500).json({
            code: "login_failed",
            message: "We couldn't complete sign-in. Please try again."
        })
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
        await redis.set(`session-${sessionId}`, JSON.stringify(toSessionUser(updatedUser)), "EX", 7 * 24 * 60 * 60)

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
        await redis.set(`session-${sessionId}`, JSON.stringify(toSessionUser(updatedUser)), "EX", 7 * 24 * 60 * 60)

        return res.status(200).json({ success: true ,credits:updatedUser.credits})
    } catch (error) {
  return res.status(500).json({ message: `deduct credits error ${error}` })
    }
}