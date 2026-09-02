import mongoose from "mongoose"

const connectDb=async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("db connected")
    } catch (error) {
        // Swallowing this let the service bind its port with no database, so
        // every request answered 500 and the healthcheck said it was fine.
        console.error(`[auth] db connection failed: ${error?.message}`)
        process.exit(1)
    }
}

export default connectDb
