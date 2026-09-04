import { useState, useEffect, useCallback, useRef } from 'react'
import { Coins, Loader2, LogOut, Menu, MessageSquare, PanelLeftIcon, PanelRight, PenSquare, Plus, Search, Trash, User, X } from "lucide-react"
import { useDispatch, useSelector } from 'react-redux'
import { getConversations } from '../features/getConversations'
import { createConversation } from '../features/createConversation'
import { deleteConversation } from '../features/deleteConversation'
import logOut from '../features/logOut'
import { addConversation, appendConversations, removeConversation, setConversations, setSelectedConversation, setLoadingConversations } from '../redux/conversationSlice'
import { clearUser } from '../redux/userSlice'
import BillingDrawer from './BillingDrawer.jsx'
import BrandMark from './BrandMark.jsx'
import { useToast } from '../hooks/useToast'

function SideBar() {
    const [collapsed, setCollapsed] = useState(false)
    const [imageError, setImageError] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [showBilling, setShowBilling] = useState(false)
    const [loggingOut, setLoggingOut] = useState(false)
    const [deletingConversationId, setDeletingConversationId] = useState(null)
    const [searchInput, setSearchInput] = useState("")
    const toast = useToast()

    const dispatch = useDispatch()
    const { conversations, selectedConversation, hasMore, currentPage, searchQuery, loadingConversations } = useSelector(state => state.conversation)
    const { userData } = useSelector(state => state.user)

    const searchTimeoutRef = useRef(null)
    const abortControllerRef = useRef(null)
    const loadMoreRef = useRef(false)

    const fetchConversations = useCallback(async ({ page = 1, search = "", append = false } = {}) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()
        if (!append) {
            dispatch(setLoadingConversations(true))
        }
        const data = await getConversations({
            page,
            limit: 15,
            search,
            signal: abortControllerRef.current.signal
        })
        if (!abortControllerRef.current.signal.aborted && data) {
            if (append) {
                dispatch(appendConversations(data))
            } else {
                dispatch(setConversations(data))
            }
        }
        dispatch(setLoadingConversations(false))
        return data
    }, [dispatch])

    useEffect(() => {
        if (userData?.userId) {
            fetchConversations({ page: 1, search: "" })
        }
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
        }
    }, [userData?.userId, fetchConversations])

    const handleSearchChange = (e) => {
        const value = e.target.value
        setSearchInput(value)
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }
        searchTimeoutRef.current = setTimeout(() => {
            fetchConversations({ page: 1, search: value.trim() })
        }, 250)
    }

    const handleLoadMore = async () => {
        if (loadMoreRef.current || !hasMore || loadingConversations) return
        loadMoreRef.current = true
        await fetchConversations({ page: currentPage + 1, search: searchQuery, append: true })
        loadMoreRef.current = false
    }

    const handleCreateConversation = async () => {
        const data = await createConversation()
        if (data) {
            dispatch(addConversation(data))
            dispatch(setSelectedConversation(data))
            toast.success("New conversation created")
        } else {
            dispatch(setSelectedConversation(null))
            toast.error("Failed to create conversation")
        }
        setMobileOpen(false)
    }

    const handleSelectConversation = (conv) => {
        dispatch(setSelectedConversation(conv))
        setMobileOpen(false)
    }

    const handleDeleteConversation = async (e, conv) => {
        e.stopPropagation()
        if (!window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
            return
        }
        setDeletingConversationId(conv._id)
        const data = await deleteConversation(conv._id)
        setDeletingConversationId(null)
        if (data?.success) {
            dispatch(removeConversation(conv._id))
            toast.success("Conversation deleted")
        } else {
            toast.error("Failed to delete conversation")
        }
    }

    const handleLogout = async () => {
        if (loggingOut) return
        setLoggingOut(true)
        await logOut()
        dispatch(clearUser())
        toast.success("Logged out successfully")
    }

    useEffect(() => {
        const handleKeyDown = (e) => {
            const target = e.target
            const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
            if (isInput) return
            if ((e.metaKey || e.ctrlKey) && e.key === "n") {
                e.preventDefault()
                handleCreateConversation()
            }
            if ((e.metaKey || e.ctrlKey) && (e.key === "Delete" || e.key === "Backspace")) {
                if (selectedConversation) {
                    e.preventDefault()
                    handleDeleteConversation(e, selectedConversation)
                }
            }
            if (e.key === "Escape" && mobileOpen) {
                e.preventDefault()
                setMobileOpen(false)
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [selectedConversation, mobileOpen])

    return (
        <>
            <button
                className='lg:hidden fixed top-3.5 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-violet-500/30 transition-all cursor-pointer'
                onClick={() => setMobileOpen(true)}
            >
                <Menu size={16} />
            </button>
            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className='lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm'
                />
            )}

            {collapsed ? (
                <aside className='hidden lg:flex flex-col items-center w-[64px] h-screen shrink-0 bg-[#08090d] border-r border-slate-800/50 py-4 gap-3'>
                    <button
                        className='flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer'
                        onClick={() => setCollapsed(false)}
                        title="Expand Sidebar"
                    >
                        <PanelRight size={18} />
                    </button>

                    <button
                        className='flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer'
                        onClick={handleCreateConversation}
                        title="New Chat"
                    >
                        <Plus size={18} />
                    </button>

                    <div className='flex-1 overflow-y-auto px-2 py-2 space-y-1 w-full'>
                        {conversations?.slice(0, 8).map((conv, i) => {
                            const isActive = selectedConversation?._id === conv?._id
                            return (
                                <button
                                    key={conv?._id || i}
                                    onClick={() => handleSelectConversation(conv)}
                                    className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all cursor-pointer
                                        ${isActive
                                            ? 'bg-gradient-to-br from-violet-600/20 to-indigo-600/20 text-violet-400 border border-violet-500/30'
                                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/50'
                                        }`}
                                    title={conv?.title || "New Chat"}
                                >
                                    <MessageSquare size={16} />
                                </button>
                            )
                        })}
                    </div>

                    <div className='mt-auto space-y-2'>
                        <button
                            onClick={() => setShowBilling(true)}
                            className='flex items-center justify-center w-10 h-10 rounded-xl text-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer'
                            title="Billing & Account"
                        >
                            <Coins size={18} />
                        </button>
                        {userData?.avatar && !imageError ? (
                            <img
                                className='w-10 h-10 rounded-xl object-cover border-2 border-slate-700 hover:border-violet-500/50 transition-all cursor-pointer'
                                src={userData?.avatar}
                                alt="User avatar"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className='w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center'>
                                <User size={16} className="text-slate-500" />
                            </div>
                        )}
                    </div>
                </aside>
            ) : (
                <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[280px] h-screen shrink-0 bg-[#08090d] border-r border-slate-800/50 transition-transform duration-300 ${
                    mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                }`}>
                    <div className='flex flex-col h-full'>
                        <div className='flex items-center gap-3 px-4 py-4 border-b border-slate-800/50'>
                            <button
                                className='hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer'
                                onClick={() => setCollapsed(true)}
                                title="Collapse Sidebar"
                            >
                                <PanelLeftIcon size={16} />
                            </button>

                            <button
                                onClick={() => setMobileOpen(false)}
                                className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer"
                            >
                                <X size={16}/>
                            </button>

                            <div className="flex items-center gap-2 flex-1">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                    <BrandMark size={18} />
                                </div>
                                <span className='text-[15px] font-semibold tracking-tight'>
                                    CortexAI
                                </span>
                            </div>

                            <span className='badge-premium text-[10px] font-medium px-2 py-0.5 rounded-full'>
                                {userData?.plan || "free"}
                            </span>

                            <button
                                className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer'
                                onClick={handleCreateConversation}
                                title="New Chat"
                            >
                                <PenSquare size={15} />
                            </button>
                        </div>

                        <div className='px-4 pt-4 pb-2'>
                            <button
                                className='w-full btn-premium flex items-center justify-center gap-2 text-sm font-medium text-white rounded-xl py-2.5 shadow-lg shadow-violet-500/20'
                                onClick={handleCreateConversation}
                            >
                                <Plus size={16} />
                                New Chat
                            </button>
                        </div>

                        <div className='px-4 pt-4 pb-2'>
                            <div className="relative">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search conversations..."
                                    value={searchInput}
                                    onChange={handleSearchChange}
                                    className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50"
                                />
                            </div>
                        </div>

                        <div className='px-4 py-2'>
                            <span className='text-[10px] font-semibold uppercase tracking-widest text-slate-600'>
                                {loadingConversations ? "Loading..." : conversations?.length === 0 ? "No conversations" : "Recent"}
                            </span>
                        </div>

                        <div className='flex-1 overflow-y-auto px-3 pb-3 space-y-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                            {loadingConversations && conversations.length === 0 ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={16} className="animate-spin text-slate-500" />
                                </div>
                            ) : (
                                conversations?.map((conv, i) => {
                                    const isActive = selectedConversation?._id === conv?._id
                                    return (
                                        <div
                                            key={conv?._id || i}
                                            onClick={() => handleSelectConversation(conv)}
                                            className={`w-full flex items-center gap-3 cursor-pointer rounded-xl px-3 py-2.5 transition-all text-left group
                                                ${isActive
                                                    ? 'bg-gradient-to-r from-violet-600/15 to-indigo-600/15 border border-violet-500/30'
                                                    : 'hover:bg-slate-800/50 border border-transparent'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors
                                                ${isActive
                                                    ? 'bg-violet-600/30 text-violet-400'
                                                    : 'bg-slate-800/80 text-slate-500'
                                                }`}>
                                                <MessageSquare size={14} />
                                            </div>
                                            <span className={`text-[13px] truncate transition-colors flex-1
                                                ${isActive ? 'text-white font-medium' : 'text-slate-400'}`}>
                                                {conv?.title || "New Chat"}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, conv)}
                                                disabled={deletingConversationId === conv._id}
                                                className='opacity-0 group-hover:opacity-100 disabled:opacity-50 flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:cursor-not-allowed'
                                                title="Delete conversation"
                                            >
                                                {deletingConversationId === conv._id ? (
                                                    <Loader2 size={13} className='animate-spin' />
                                                ) : (
                                                    <Trash size={13} />
                                                )}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                            {hasMore && (
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loadingConversations}
                                    className="w-full flex items-center justify-center gap-1.5 text-[12px] text-slate-400 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600/50 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {loadingConversations ? (
                                        <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                        "Load more"
                                    )}
                                </button>
                            )}
                        </div>

                        <div className='mx-3 h-px bg-slate-800/50' />

                        <div className='px-3 py-3'>
                            <div className='flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-800/50 transition-colors'>
                                <div className='relative shrink-0'>
                                    {userData?.avatar && !imageError ? (
                                        <img
                                            className='w-9 h-9 rounded-xl object-cover ring-2 ring-slate-700'
                                            src={userData?.avatar}
                                            alt="User avatar"
                                            onError={() => setImageError(true)}
                                        />
                                    ) : (
                                        <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center'>
                                            <User size={15} className="text-white" />
                                        </div>
                                    )}
                                    <div className='absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#08090d]' />
                                </div>
                                <div className='flex-1 min-w-0'>
                                    <p className='text-[13px] font-medium text-slate-200 truncate'>{userData?.name || "User"}</p>
                                    <p className='text-[11px] text-slate-500'>{(userData?.credits || 0)} credits</p>
                                </div>
                                <div className='flex gap-1.5'>
                                    <button
                                        onClick={() => setShowBilling(true)}
                                        className='flex items-center justify-center w-8 h-8 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-all cursor-pointer'
                                        title="Billing"
                                    >
                                        <Coins size={16} />
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        disabled={loggingOut}
                                        className='flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
                                        title="Log Out"
                                    >
                                        {loggingOut ? <Loader2 size={16} className='animate-spin' /> : <LogOut size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            )}

            <BillingDrawer
                open={showBilling}
                onClose={() => setShowBilling(false)}
            />
        </>
    )
}

export default SideBar