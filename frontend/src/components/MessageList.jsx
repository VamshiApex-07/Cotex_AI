import { useEffect, useRef, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { ChevronUp, Loader2 } from 'lucide-react'
import MessageBubble from './MessageBubble'
import LoadingAnimation from './LoadingAnimation'
import getMessages from '../features/getMessages'
import { prependMessages, setLoadingOlderMessages } from '../redux/messageSlice'

function MessageList() {
    const dispatch=useDispatch()
    const {selectedConversation,loadingConversationId}=useSelector(state=>state.conversation)
    const {messages,activeAgent,hasMoreMessages,loadingOlderMessages}=useSelector(state=>state.message)
    const bottemRef=useRef(null)
    const topRef=useRef(null)
    const loadMoreRef=useRef(false)
   
   useEffect(()=>{
       requestAnimationFrame(()=>{
        bottemRef?.current?.scrollIntoView({
          behavior:"smooth",
          block:"end"
        })
       })
   },[messages?.length,loadingConversationId])

   const handleLoadOlderMessages=useCallback(async () => {
       if(loadMoreRef.current || !hasMoreMessages || !selectedConversation || messages.length===0){
           return
       }
       loadMoreRef.current=true
       dispatch(setLoadingOlderMessages(true))
       const oldestMessage=messages[0]
       const cursor=btoa(JSON.stringify({
           createdAt:oldestMessage.createdAt,
           _id:oldestMessage._id
       }))
       const abortController=new AbortController()
       const data=await getMessages({
           id:selectedConversation._id,
           before:cursor,
           signal:abortController.signal
       })
       if(data?.messages && data.messages.length>0){
           dispatch(prependMessages(data.messages))
       }
       if(data?.hasMore!==undefined){
           const hasMore=data.hasMore
           dispatch({type:"message/setHasMoreMessages",payload:hasMore})
       }
       dispatch(setLoadingOlderMessages(false))
       loadMoreRef.current=false
       requestAnimationFrame(()=>{
           topRef?.current?.scrollIntoView({ behavior:"instant", block:"end" })
       })
   },[hasMoreMessages,messages,selectedConversation,dispatch])


  return (
    <div className='flex-1 overflow-y-auto px-6 py-6 space-y-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
      {hasMoreMessages && (
          <div ref={topRef} className="flex justify-center pb-2">
              <button
                  onClick={handleLoadOlderMessages}
                  disabled={loadingOlderMessages}
                  className="flex items-center gap-1.5 text-[12px] text-slate-400 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 hover:border-slate-600/50 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                  {loadingOlderMessages ? (
                      <Loader2 size={12} className="animate-spin" />
                  ) : (
                      <ChevronUp size={12} />
                  )}
                  Load earlier messages
              </button>
          </div>
      )}
      
      {messages.length==0 || !selectedConversation ?(
        <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
           <div className='flex flex-col gap-1.5'>
               <h1 className='text-[20px] font-semibold text-slate-200 tracking-tight'>CortexAI</h1>
               <p className='text-[15px] font-semibold text-slate-400 tracking-tight'>How can I help you?</p>
               <p className='text-[13px] text-slate-600 max-w-[260px] leading-relaxed'>Ask me anything — code, ideas, explanations, or just a quick question.</p>
           </div>
           <div className='flex flex-wrap justify-center gap-2 mt-1'>
            {["Write a Netflix clone", "Explain Redis", "Build a dashboard"].map((s)=>(
              <button key={s} className='text-[12px] text-slate-400 bg-white/[0.04] border border-white/[0.07] px-3.5 py-1.5 rounded-lg hover:bg-white/[0.08] hover:text-slate-200 transition-colors duration-150 cursor-pointer'>
                {s}
              </button>
            ))}
           </div>
        </div>
      ):
      <div className='space-y-5'>

        {messages?.map((msg)=>(
            <div>
               <MessageBubble role={msg?.role} content={msg?.content} images={msg.images || []} />
            </div>
        ))}

        {selectedConversation && selectedConversation._id === loadingConversationId && <LoadingAnimation agent={activeAgent}/>}

        
      </div>
      }
      <div ref={bottemRef}/>
    </div>
  )
}

export default MessageList
