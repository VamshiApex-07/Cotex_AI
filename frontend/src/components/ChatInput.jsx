import { Code2, FileText, Globe, ImageIcon, MessageSquare, Mic, MicOff, Paperclip, Presentation, Send, X, Zap } from 'lucide-react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import sendMessage from '../features/sendMessage'
import { createConversation } from '../features/createConversation'
import { updateConversation } from '../features/updateConversation'
import { addMessage, setArtifacts, setIsLoading } from '../redux/messageSlice'
import { addConversation, setConvTitle, setSelectedConversation } from '../redux/conversationSlice'

function ChatInput() {
  const [value, setValue] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("Auto")
  const [selectedFile, setSelectedFile] = useState(null)
  const [listening, setListening] = useState(false)

  const { selectedConversation } = useSelector(state => state.conversation)
  const { isLoading } = useSelector(state => state.message)

  const recognitionRef = useRef(null)
  const fileRef = useRef(null)
  const dispatch = useDispatch()

  // Safely memoize image preview URL to avoid memory leaks on re-renders
  const previewUrl = useMemo(() => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      return URL.createObjectURL(selectedFile)
    }
    return null
  }, [selectedFile])

  // Revoke object URL when file changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Speech recognition initialization
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = true

    recognition.onresult = (event) => {
      let transcript = ""
      for (let index = event.resultIndex; index < event.results.length; index++) {
        transcript += event.results[index][0].transcript
      }
      setValue(transcript)
    }

    recognition.onend = () => {
      setListening(false)
    }

    recognitionRef.current = recognition
  }, [])

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.")
      return
    }

    if (listening) {
      recognitionRef.current.stop()
      setListening(false)
    } else {
      recognitionRef.current.start()
      setListening(true)
    }
  }

  const handleSendMessage = async () => {
    if ((!value.trim() && !selectedFile) || isLoading) return

    dispatch(setIsLoading(true))
    let conversation = selectedConversation

    if (!conversation) {
      const conv = await createConversation()
      dispatch(setSelectedConversation(conv))
      dispatch(addConversation(conv))
      conversation = conv
    }

    if (conversation?.title === "New Chat" && value.trim()) {
      await updateConversation({ id: conversation?._id, title: value.trim() })
      dispatch(setConvTitle({ conversationId: conversation?._id, title: value.slice(0, 40) }))
    }

    const formData = new FormData()
    formData.append("prompt", value.trim())
    formData.append("conversationId", conversation?._id)
    formData.append("agent", selectedAgent.toLowerCase())
    if (selectedFile) {
      formData.append("file", selectedFile)
    }

    dispatch(addMessage({ role: "user", content: value.trim() }))
    
    // Clear inputs
    setValue("")
    setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ""

    const data = await sendMessage(formData)
    dispatch(setIsLoading(false))
    dispatch(setArtifacts(data?.artifacts || []))
    dispatch(addMessage({ role: "assistant", content: data?.answer, images: data?.images }))
  }

  const agents = [
    { id: "auto", icon: Zap, label: "Auto" },
    { id: "chat", icon: MessageSquare, label: "Chat" },
    { id: "coding", icon: Code2, label: "Coding" },
    { id: "pdf", icon: FileText, label: "PDF" },
    { id: "ppt", icon: Presentation, label: "PPT" },
    { id: "vision", icon: ImageIcon, label: "Vision" },
    { id: "search", icon: Globe, label: "Search" }
  ]

  const formatFileSize = (bytes) => {
    if (!bytes) return "0 KB"
    const kb = bytes / 1024
    if (kb > 1024) {
      return `${(kb / 1024).toFixed(1)} MB`
    }
    return `${Math.round(kb)} KB`
  }

  const isSendDisabled = (!value.trim() && !selectedFile) || isLoading

  return (
    <div className='w-full overflow-hidden px-3 md:px-5 py-4 border-t border-white/[0.06] bg-[#0d0f14]'>
      <div className='flex flex-col gap-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 pt-3.5 pb-3'>

        {/* Agent Selector */}
        <div className='flex w-full md:w-[80%] gap-2 pr-2 flex-wrap'>
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label
            const Icon = agent.icon
            return (
              <div
                key={agent.id}
                onClick={() => setSelectedAgent(agent.label)}
                className={`
                  flex-shrink-0 cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-all
                  ${isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-transparent shadow-[0_1px_8px_rgba(99,102,241,.35)]"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:bg-white/[0.07]"
                  }
                `}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-500"} />
                {agent.label}
              </div>
            )
          })}
        </div>

        {/* File Preview Section */}
        {selectedFile && (
          <div className='my-2'>
            <div className='inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5'>
              {selectedFile.type === "application/pdf" ? (
                <FileText size={20} className="text-red-400 shrink-0" />
              ) : previewUrl ? (
                <img src={previewUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover shrink-0" />
              ) : null}

              <div className='min-w-0 flex-1'>
                <p className='text-xs text-white truncate max-w-[200px]'>
                  {selectedFile.name}
                </p>
                <p className='text-[10px] text-slate-500'>
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <button 
                type="button"
                className='ml-1 p-1 hover:bg-white/10 rounded-lg transition-colors cursor-pointer' 
                onClick={() => { 
                  setSelectedFile(null)
                  if (fileRef.current) fileRef.current.value = "" 
                }}
              >
                <X size={14} className='text-slate-400 hover:text-white' />
              </button>
            </div>
          </div>
        )}

        {/* Text Input */}
        <textarea
          placeholder='Ask Anything...'
          onChange={(e) => setValue(e.target.value)}
          value={value}
          disabled={isLoading}
          className="w-full bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSendMessage()
            }
          }}
        />

        {/* Action Buttons */}
        <div className='flex items-center justify-between pt-1'>
          <div className='flex items-center gap-1'>
            <input 
              type="file" 
              accept='.pdf,image/*' 
              hidden 
              ref={fileRef} 
              onChange={(e) => {
                const file = e.target.files[0]
                if (file) {
                  setSelectedFile(file)
                }
              }} 
            />

            <button 
              type="button"
              className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] transition-all bg-transparent cursor-pointer' 
              onClick={() => fileRef.current?.click()}
              title="Attach File"
            >
              <Paperclip size={16} />
            </button>

            <button
              type="button"
              onClick={toggleMic}
              title={listening ? "Stop Listening" : "Start Voice Input"}
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer ${
                listening ? "bg-red-500 text-white" : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"
              }`}
            >
              {listening ? <Mic size={16} /> : <MicOff size={16} />} 
            </button>
          </div>

          <button
            type="button"
            disabled={isSendDisabled}
            onClick={handleSendMessage}
            className={`flex items-center justify-center w-8 h-8 rounded-lg border-none transition-all duration-150 ${
              !isSendDisabled 
                ? "bg-gradient-to-br from-indigo-500 to-violet-700 hover:opacity-90 text-white cursor-pointer" 
                : "bg-white/[0.05] text-slate-600 cursor-not-allowed"
            }`}
          >
            <Send size={15} />
          </button>
        </div>

      </div>
    </div>
  )
}

export default ChatInput