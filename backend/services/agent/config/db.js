import mongoose from "mongoose"

const connectDb=async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("db connected")
    } catch (error) {
        // Logging and returning left the service listening with no database, so
        // every request failed opaquely instead of the container being restarted.
        console.error(`db error ${error}`)
        process.exit(1)
    }
}

export default connectDb