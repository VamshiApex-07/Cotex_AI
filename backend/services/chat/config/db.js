import mongoose from "mongoose"

const connectDb=async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("db connected")
    } catch (error) {
        // Without this the process kept listening with no database and every
        // request answered 500.
        console.log(`db error ${error}`)
        process.exit(1)
    }
}

export default connectDb
