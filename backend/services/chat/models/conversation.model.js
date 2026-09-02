import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    title:{
        type:String,
        default:"New Chat",
        trim:true,
        maxlength:200
    },
    userId:{
        type:String,
        required:true
    }
},{
    timestamps:true
})

// Exact access pattern of getConversations. A prefix of this index also serves
// plain userId lookups (the ownership checks), so userId gets no second index.
conversationSchema.index({userId:1,updatedAt:-1})

const Conversation= mongoose.model("conversation",conversationSchema)
export default Conversation
