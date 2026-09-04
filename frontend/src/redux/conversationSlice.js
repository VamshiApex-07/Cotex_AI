import { createSlice } from "@reduxjs/toolkit";
import { clearUser } from "./userSlice.js";

const initialState={
  conversations:[],
  selectedConversation:null,
  loadingConversationId:null,
  hasMore:true,
  totalConversations:0,
  currentPage:1,
  searchQuery:"",
  loadingConversations:false
}

const conversationSlice=createSlice({
    name:"conversation",
    initialState,
    reducers:{
       setConversations:(state,action)=>{
        state.conversations=action.payload.conversations||[]
        state.hasMore=action.payload.hasMore??true
        state.totalConversations=action.payload.total??0
        state.currentPage=action.payload.page??1
       },
       appendConversations:(state,action)=>{
        const existingIds=new Set(state.conversations.map(c=>c._id))
        const newConversations=(action.payload.conversations||[]).filter(c=>!existingIds.has(c._id))
        state.conversations.push(...newConversations)
        state.hasMore=action.payload.hasMore??true
        state.totalConversations=action.payload.total??state.totalConversations
        state.currentPage=action.payload.page??state.currentPage
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
        },
        removeConversation:(state,action)=>{
            const conversationId=action.payload
            state.conversations=state.conversations.filter((conv)=>conv._id!==conversationId)
            if(state.selectedConversation?._id===conversationId){
                state.selectedConversation=null
            }
        },
       setLoadingConversationId:(state,action)=>{
         state.loadingConversationId=action.payload
       },
       setSearchQuery:(state,action)=>{
         state.searchQuery=action.payload
       },
       resetConversations:(state)=>{
         state.conversations=[]
         state.hasMore=true
         state.currentPage=1
         state.totalConversations=0
       },
       setLoadingConversations:(state,action)=>{
         state.loadingConversations=action.payload
       }

    },
    // Logout has to wipe this too, or the next user to sign in on this tab
    // sees the previous user's conversation list until their own fetch lands.
    extraReducers:(builder)=>{
      builder.addCase(clearUser,()=>initialState)
    }

})

export const {setConversations,appendConversations,addConversation,setSelectedConversation,setConvTitle,setLoadingConversationId,removeConversation,setSearchQuery,resetConversations,setLoadingConversations}=conversationSlice.actions
export default conversationSlice.reducer

