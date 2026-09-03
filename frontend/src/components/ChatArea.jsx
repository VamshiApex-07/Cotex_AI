import { useEffect } from 'react'
import Nav from './Nav'
import ChatInput from './ChatInput'
import { useDispatch, useSelector } from 'react-redux'
import getMessages from '../features/getMessages'
import { setArtifacts, setMessages } from '../redux/messageSlice'
import MessageList from './MessageList'

function ChatArea() {
  const {selectedConversation}=useSelector(state=>state.conversation)
  const dispatch=useDispatch()
  const conversationId = selectedConversation?._id
  const conversationTitle = selectedConversation?.title

  useEffect(()=>{
    const abortController=new AbortController()
    const getMesg=async () => {

    if(conversationId){
      if(conversationTitle==="New Chat"){
        dispatch(setMessages([]))
        dispatch(setArtifacts([]))
        return;
      }
      const data=await getMessages(conversationId, abortController.signal)
      if(!abortController.signal.aborted && Array.isArray(data)){
        console.log(data)
        dispatch(setMessages(data))
        const allArtifacts = data
            .filter(msg => msg.artifacts?.length > 0)
            .flatMap(msg => msg.artifacts)
        dispatch(setArtifacts(allArtifacts))
      }
    }

    }

    getMesg()
    return ()=>{
      abortController.abort()
    }
  },[conversationId, dispatch])
  return (
    <div className='flex-1 flex flex-col min-w-0'>
      <Nav/>
      <MessageList/>
      <ChatInput/>
    </div>
  )
}

export default ChatArea
