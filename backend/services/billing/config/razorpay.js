import Razorpay from "razorpay"

// index.js loads dotenv as its first import, so process.env is populated before
// this module is evaluated. The previous local dotenv.config() call here was a
// no-op for the same reason it was needed: ESM evaluates imports before
// statements.
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

export default razorpay
