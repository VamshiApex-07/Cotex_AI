import { AnimatePresence, motion } from "motion/react"
import { Crown, Check, X, Sparkles, Zap, Shield } from 'lucide-react'
import { useSelector } from 'react-redux'
import { createOrder } from '../features/createOrder.js'
import { verifyPayment } from '../features/verifyPayment.js'
import { useToast } from '../hooks/useToast'

// Mirrors backend/shared/config/plans.js — values must stay in sync.
// Used for display only; actual plan credits come from verifyPayment response.
const PLANS = {
    starter: {
        name: 'Starter',
        price: '₹199',
        credits: 500,
        features: [
            '500 AI credits',
            'Priority support',
            'Access to all agents',
            'Standard response time'
        ]
    },
    pro: {
        name: 'Pro',
        price: '₹499',
        credits: 1000,
        popular: true,
        features: [
            '1000 AI credits',
            'Priority support',
            'Access to all agents',
            'Fast response time',
            'Early access to new features'
        ]
    }
}

function BillingDrawer({ open, onClose }) {
    const { userData } = useSelector(state => state.user)
    const toast = useToast()

    const handleUpgrade = async (plan) => {
        try {
            const data = await createOrder(plan)
            if (data?.error) {
                toast.error(data.message || "Failed to initiate payment. Please try again.")
                return
            }
            if (!data?.order?.id) {
                toast.error("Failed to initiate payment. Please try again.")
                return
            }
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: data?.order?.amount,
                currency: data?.order?.currency,
                name: "CortexAI",
                description: `${data?.plan?.name} Plan`,
                order_id: data?.order?.id,
                handler: async (response) => {
                    try {
                        const result = await verifyPayment(response)
                        if (result?.message === "Payment Verified" || result?.plan) {
                            toast.success("Payment successful! Credits added.")
                        } else {
                            toast.error(result?.message || "Payment verification failed")
                        }
                    } catch {
                        toast.error("Payment verification failed")
                    }
                },
                prefill: {
                    name: userData?.name,
                    email: userData?.email
                },
                theme: {
                    color: "#7c3aed"
                }
            }

            const razorpay = new window.Razorpay(options)
            razorpay.open()
        } catch {
            toast.error("Failed to initiate payment. Please try again.")
        }
    }

    const creditPercent = userData?.totalCredits > 0
        ? (userData.credits / userData.totalCredits) * 100
        : 100

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 z-50 h-screen w-[400px] bg-[#08090d] border-l border-slate-800/50 shadow-2xl flex flex-col"
                    >
                        <div className='flex items-center justify-between p-5 border-b border-slate-800/50'>
                            <div className='flex items-center gap-3'>
                                <div className='w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30'>
                                    <Crown size={18} className="text-white" />
                                </div>
                                <div>
                                    <h2 className='text-white text-lg font-bold'>Billing</h2>
                                    <p className='text-slate-500 text-sm'>Plans & Credits</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className='p-5'>
                            <div className='card-premium rounded-2xl p-5'>
                                <div className='flex justify-between items-start'>
                                    <div>
                                        <p className='text-slate-500 text-sm'>Current Plan</p>
                                        <h3 className='text-white text-2xl font-bold capitalize mt-1'>
                                            {userData?.plan || "free"}
                                        </h3>
                                    </div>
                                    <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 flex items-center justify-center'>
                                        <Zap size={20} className="text-violet-400" />
                                    </div>
                                </div>

                                <div className='mt-5'>
                                    <div className='flex justify-between text-xs text-slate-400 mb-2'>
                                        <span>Credits Remaining</span>
                                        <span className='text-white font-medium'>{userData?.credits || 0} / {userData?.totalCredits || 100}</span>
                                    </div>
                                    <div className='h-2.5 rounded-full bg-slate-800/80 overflow-hidden'>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${creditPercent}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full shadow-lg shadow-violet-500/30"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className='flex-1 overflow-y-auto px-5 pb-5 space-y-4'>
                            <div className='flex items-center gap-2'>
                                <Sparkles size={16} className="text-violet-400" />
                                <span className='text-sm font-medium text-slate-300'>Available Plans</span>
                            </div>

                            {Object.entries(PLANS).map(([key, plan]) => (
                                <div
                                    key={key}
                                    className={`relative rounded-2xl border p-5 transition-all ${
                                        plan.popular
                                            ? 'bg-gradient-to-br from-violet-600/10 to-indigo-600/10 border-violet-500/40'
                                            : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700/50'
                                    }`}
                                >
                                    {plan.popular && (
                                        <div className='absolute -top-2.5 left-4'>
                                            <span className='badge-premium text-[10px] font-bold px-3 py-0.5 rounded-full'>
                                                MOST POPULAR
                                            </span>
                                        </div>
                                    )}

                                    <div className='flex items-start justify-between mb-4'>
                                        <div>
                                            <h3 className='text-white font-bold text-lg'>{plan.name}</h3>
                                            <p className='text-3xl font-bold gradient-text mt-1'>{plan.price}</p>
                                            <p className='text-slate-500 text-sm mt-0.5'>{plan.credits} credits</p>
                                        </div>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                            plan.popular
                                                ? 'bg-violet-600/30'
                                                : 'bg-slate-800/80'
                                        }`}>
                                            {plan.popular
                                                ? <Crown size={20} className="text-amber-400" />
                                                : <Shield size={20} className="text-slate-400" />
                                            }
                                        </div>
                                    </div>

                                    <ul className='space-y-2.5 mb-5'>
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className='flex items-center gap-2.5 text-sm text-slate-400'>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                                    plan.popular ? 'bg-violet-600/30' : 'bg-slate-800/80'
                                                }`}>
                                                    <Check size={12} className={plan.popular ? 'text-violet-400' : 'text-slate-500'} />
                                                </div>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={() => handleUpgrade(key)}
                                        className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                                            plan.popular
                                                ? 'btn-premium text-white'
                                                : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700/50'
                                        }`}
                                    >
                                        Upgrade to {plan.name}
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className='p-5 border-t border-slate-800/50'>
                            <p className='text-[11px] text-slate-600 text-center leading-relaxed'>
                                All plans include a 7-day money-back guarantee.
                                <br />
                                Questions? Contact support@cortexai.com
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

export default BillingDrawer