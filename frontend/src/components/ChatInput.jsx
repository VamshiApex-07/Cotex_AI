import { Code2, FileText, Globe, ImageIcon, MessageSquare, Mic, MicOff, Paperclip, Presentation, Send, X, Zap } from 'lucide-react'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import sendMessage from '../features/sendMessage'
import { createConversation } from '../features/createConversation'
import { updateConversation } from '../features/updateConversation'
import { addMessage, setArtifacts, setIsLoading, setActiveAgent } from '../redux/messageSlice'
import { addConversation, setConvTitle, setSelectedConversation } from '../redux/conversationSlice'
import { useToast } from '../hooks/useToast'

function ChatInput() {
  const [value, setValue] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("Auto")
  const [selectedFile, setSelectedFile] = useState(null)
  const [listening, setListening] = useState(false)

  const { selectedConversation } = useSelector(state => state.conversation)
  const { isLoading } = useSelector(state => state.message)
  const toast = useToast()

  const recognitionRef = useRef(null)
  const fileRef = useRef(null)
  const dispatch = useDispatch()

  const previewUrl = useMemo(() => {
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      return URL.createObjectURL(selectedFile)
    }
    return null
  }, [selectedFile])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

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

    dispatch(setActiveAgent(selectedAgent.toLowerCase()))
    dispatch(setIsLoading(true))
    let conversation = selectedConversation

    try {
        if (!conversation) {
            const conv = await createConversation()
            if(conv){
                dispatch(setSelectedConversation(conv))
                dispatch(addConversation(conv))
                conversation = conv
            } else {
                dispatch(setIsLoading(false))
                return
            }
        }

        if (conversation?.title === "New Chat" && value.trim()) {
            const title = value.trim().slice(0, 200)
            const updated = await updateConversation({ id: conversation?._id, title })
            if (updated) {
                dispatch(setConvTitle({ conversationId: conversation?._id, title }))
            } else {
                toast.error("Failed to save conversation title")
            }
        }

        const formData = new FormData()
        formData.append("prompt", value.trim())
        formData.append("conversationId", conversation?._id)
        formData.append("agent", selectedAgent.toLowerCase())
        if (selectedFile) {
            formData.append("file", selectedFile)
        }

        dispatch(addMessage({ role: "user", content: value.trim() }))

        setValue("")
        setSelectedFile(null)
        if (fileRef.current) fileRef.current.value = ""

        const data = await sendMessage(formData)
        dispatch(setIsLoading(false))
        if (data?.error) {
            toast.error(data.message || "Failed to send message. Please try again.")
            return
        }
        if (data?.agent) dispatch(setActiveAgent(data.agent))
        dispatch(setArtifacts(data?.artifacts || []))
        dispatch(addMessage({ role: "assistant", content: data?.answer, images: data?.images }))
    } catch (error) {
        console.error("Failed to send message:", error)
        dispatch(setIsLoading(false))
        toast.error("Failed to send message. Please try again.")
    }
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
    <div className='w-full px-4 md:px-6 py-4 border-t border-slate-800/50 bg-gradient-to-t from-[#08090d] to-transparent'>
      <div className='flex flex-col gap-3 rounded-2xl border border-slate-800/50 bg-slate-900/50 backdrop-blur-xl px-4 pt-3.5 pb-3 shadow-xl shadow-black/20'>

        <div className='flex w-full gap-2 flex-wrap'>
          {agents.map((agent) => {
            const isActive = selectedAgent === agent.label
            const Icon = agent.icon
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.label)}
                className={`
                  flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer
                  ${isActive
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-transparent shadow-lg shadow-violet-500/25'
                    : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600/50'
                  }
                `}
              >
                <Icon size={13} className={isActive ? 'text-white' : 'text-slate-500'} />
                {agent.label}
              </button>
            )
          })}
        </div>

        {selectedFile && (
          <div className='flex items-center gap-3 rounded-xl bg-slate-800/50 border border-slate-700/50 p-2.5'>
            {selectedFile.type === "application/pdf" ? (
              <div className='w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center'>
                <FileText size={18} className="text-red-400" />
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover ring-2 ring-slate-700" />
            ) : null}

            <div className='flex-1 min-w-0'>
              <p className='text-xs text-slate-200 truncate font-medium'>{selectedFile.name}</p>
              <p className='text-[10px] text-slate-500'>{formatFileSize(selectedFile.size)}</p>
            </div>

            <button
              type="button"
              className='w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all cursor-pointer'
              onClick={() => {
                setSelectedFile(null)
                if (fileRef.current) fileRef.current.value = ""
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className='flex items-end gap-2'>
          <textarea
            placeholder='Ask Anything...'
            onChange={(e) => setValue(e.target.value)}
            value={value}
            disabled={isLoading}
            className="flex-1 bg-transparent outline-none resize-none text-[14px] text-slate-200 placeholder:text-slate-600 leading-relaxed [scrollbar-width:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />

          <div className='flex items-center gap-1.5 pb-0.5'>
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
              className='w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-slate-800/80 transition-all cursor-pointer disabled:opacity-50'
              onClick={() => fileRef.current?.click()}
              title="Attach File"
            >
              <Paperclip size={16} />
            </button>

            <button
              type="button"
              onClick={toggleMic}
              title={listening ? "Stop Listening" : "Start Voice Input"}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                listening
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              {listening ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button
              type="button"
              disabled={isSendDisabled}
              onClick={handleSendMessage}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                !isSendDisabled
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105'
                  : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
              }`}
            >
              <Send size={15} />
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

export default ChatInput