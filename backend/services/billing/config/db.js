import mongoose from "mongoose"

const connectDb=async ()=>{
    try {
       await mongoose.connect(process.env.MONGODB_URI)
       console.log("db connected")
    } catch (error) {
       // Fatal: a billing service that cannot write Payment rows must not accept
       // checkout traffic, because the Razorpay order would exist with nothing
       // recording it.
       console.error(`[billing] db connection failed: ${error?.message}`)
       process.exit(1)
    }
}

export default connectDb
