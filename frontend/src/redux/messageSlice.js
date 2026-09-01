import { createSlice } from "@reduxjs/toolkit";
import { clearUser } from "./userSlice.js";

const initialState={
  messages:[],
  artifacts:[],
  isLoading:false,
  activeAgent:"auto"
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
       setArtifacts:(state,action)=>{
        state.artifacts=action.payload
       },
       setIsLoading:(state,action)=>{
        state.isLoading=action.payload
       },
       setActiveAgent:(state,action)=>{
        state.activeAgent=action.payload
       }
    },
    // Same reason as conversationSlice: a stale transcript must not survive
    // into the next session on this tab.
    extraReducers:(builder)=>{
      builder.addCase(clearUser,()=>initialState)
    }

})

export const {setMessages,addMessage,setArtifacts,setIsLoading,setActiveAgent}=messageSlice.actions 
export default messageSlice.reducer


