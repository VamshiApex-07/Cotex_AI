import mongoose from "mongoose";

const userSchema=new mongoose.Schema({
    firebaseUid:{
        type:String,
        required:true,
        unique:true,
        index:true
    },
    name:String,
    email:{
        type:String,
        index:true
    },
    avatar:String,
    plan:{
        type:String,
        enum:["free","starter","pro"],
        default:"free"
    },
    // min:0 is a last-resort guard. The debit itself is a conditional
    // findOneAndUpdate that only matches when credits >= cost, so a negative
    // balance would mean that filter was bypassed.
    credits:{
        type:Number,
        default:100,
        min:0
    },
    totalCredits:{
        type:Number,
        default:100,
        min:0
    },
    planExpiresAt:Date

},{
    timestamps:true
})

const User=mongoose.model("User",userSchema)
export default User
