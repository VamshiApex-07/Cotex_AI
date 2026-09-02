import mongoose from "mongoose";

const paymentSchema=new mongoose.Schema({
    userId:{
        type:String,
        required:true
    },
    // unique is what makes verification replay-proof at the storage layer: it
    // guarantees one row per Razorpay order, so the conditional status
    // transition in verifyPayment is a genuine compare-and-swap on a single
    // document. Without it a duplicate row could be claimed a second time.
    orderId:{
        type:String,
        required:true,
        unique:true,
        index:true
    },
    paymentId:{
        type:String,
        // sparse because it is only set once a payment is actually verified;
        // unique stops the same Razorpay payment being applied to two orders.
        unique:true,
        sparse:true
    },
    amount:Number,
    currency:{
        type:String,
        default:"INR"
    },
    credits:{
        type:Number
    },
    plan:{
        type:String
    },
    // "reconcile" means the money is verified but granting the credits failed —
    // the user has paid and is owed something, which needs to be findable rather
    // than indistinguishable from a completed payment.
    status:{
        type:String,
        enum:["created","paid","failed","reconcile"],
        default:"created"
    },
    failureReason:{
        type:String
    }
},{timestamps:true})

paymentSchema.index({ userId: 1, createdAt: -1 })

const Payment=mongoose.model("Payment",paymentSchema)
export default Payment
