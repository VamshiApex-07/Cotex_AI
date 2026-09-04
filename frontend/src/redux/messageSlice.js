import { createSlice } from "@reduxjs/toolkit";
import { clearUser } from "./userSlice.js";

const initialState={
  messages:[],
  artifacts:[],
  activeAgent:"auto",
  hasMoreMessages:true,
  loadingOlderMessages:false
}

const messageSlice=createSlice({
    name:"message",
    initialState,
    reducers:{
       setMessages:(state,action)=>{
        state.messages=action.payload
       },
        addMessage:(state,action)=>{
        state.messages.push(action.payload)
       },
       prependMessages:(state,action)=>{
        const existingIds=new Set(state.messages.map(m=>m._id))
        const newMessages=action.payload.filter(m=>!existingIds.has(m._id))
        state.messages.unshift(...newMessages)
       },
        setArtifacts:(state,action)=>{
        state.artifacts=action.payload
       },

       setActiveAgent:(state,action)=>{
        state.activeAgent=action.payload
       },
       setHasMoreMessages:(state,action)=>{
        state.hasMoreMessages=action.payload
       },
       setLoadingOlderMessages:(state,action)=>{
        state.loadingOlderMessages=action.payload
       }
    },
    // Same reason as conversationSlice: a stale transcript must not survive
    // into the next session on this tab.
    extraReducers:(builder)=>{
      builder.addCase(clearUser,()=>initialState)
    }

})

export const {setMessages,addMessage,setArtifacts,setActiveAgent,prependMessages,setHasMoreMessages,setLoadingOlderMessages}=messageSlice.actions
export default messageSlice.reducer


