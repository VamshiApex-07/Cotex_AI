import mongoose from "mongoose";

const fileSchema=new mongoose.Schema({
    name:String,
    content:String
},{
    _id:false
})

const artifactSchema=new mongoose.Schema({
    id:Number,
    type:String,
    title:String,
    files:[fileSchema],

},{
    _id:false
})


const messageSchema=new mongoose.Schema({
    conversationId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Conversation",
        required:true
    },
    // Denormalised from the parent conversation so a message can be scoped to an
    // owner without a join. Pre-existing documents predate this field and need a
    // backfill before any query is allowed to filter on it.
    userId:{
        type:String,
        required:true,
        index:false
    },
    role:{
        type:String,
        enum:["user","assistant"],
        required:true
    },
    content:{
        type:String,
        maxlength:200000
    },
    images:[String],
    artifacts:[artifactSchema]

},{
    timestamps:true
})

// Exact access pattern of getMessages (filter conversationId, sort createdAt desc).
messageSchema.index({conversationId:1,createdAt:-1})
// Cursor-based pagination with tiebreaker on _id for deterministic ordering.
messageSchema.index({conversationId:1,createdAt:-1,_id:-1})

const Message=mongoose.model("Message",messageSchema)
export default Message
