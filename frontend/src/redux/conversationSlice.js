import { createSlice } from "@reduxjs/toolkit";
import { clearUser } from "./userSlice.js";

const initialState={
  conversations:[],
  selectedConversation:null
}

const conversationSlice=createSlice({
    name:"conversation",
    initialState,
    reducers:{
       setConversations:(state,action)=>{
        state.conversations=action.payload
       },
       addConversation:(state,action)=>{
        state.conversations.unshift(action.payload)
       },
        setSelectedConversation:(state,action)=>{
        state.selectedConversation=action.payload
       },

      setConvTitle:(state,action)=>{
           const {title,conversationId}=action.payload
           state.conversations=state.conversations.map((conv)=>(
            conv._id==conversationId?(
             { ...conv,title}
            ):conv
           )) 

           if(state.selectedConversation?._id==conversationId){
               state.selectedConversation={...state.selectedConversation,title}
           }
      }

    },
    // Logout has to wipe this too, or the next user to sign in on this tab
    // sees the previous user's conversation list until their own fetch lands.
    extraReducers:(builder)=>{
      builder.addCase(clearUser,()=>initialState)
    }

})

export const {setConversations,addConversation,setSelectedConversation,setConvTitle}=conversationSlice.actions 
export default conversationSlice.reducer

