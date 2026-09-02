import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info, AlertTriangle, X } from 'lucide-react'
import { ToastContext } from '../contexts/ToastContext'

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, message, type }])
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id))
            }, duration)
        }
        return id
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const toast = {
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    )
}

function ToastIcon({ type }) {
    switch (type) {
        case 'success':
            return (
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check size={14} className="text-emerald-400" />
                </div>
            )
        case 'error':
            return (
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X size={14} className="text-red-400" />
                </div>
            )
        case 'warning':
            return (
                <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <AlertTriangle size={14} className="text-amber-400" />
                </div>
            )
        default:
            return (
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Info size={14} className="text-blue-400" />
                </div>
            )
    }
}

function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                        layout
                        className="pointer-events-auto"
                    >
                        <div
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl border shadow-lg
                                min-w-[320px] max-w-[380px]
                                ${t.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                    : t.type === 'error'
                                    ? 'bg-red-500/10 border-red-500/30'
                                    : t.type === 'warning'
                                    ? 'bg-amber-500/10 border-amber-500/30'
                                    : 'bg-blue-500/10 border-blue-500/30'}
                            `}
                        >
                            <ToastIcon type={t.type} />
                            <p className="flex-1 text-[13px] text-slate-200 leading-snug">{t.message}</p>
                            <button
                                onClick={() => onRemove(t.id)}
                                className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer"
                            >
                                <X size={14} className="text-slate-400 hover:text-slate-200" />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
