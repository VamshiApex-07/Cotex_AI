import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/* ─────────────────────────────────────────────
   SHARED HELPERS
───────────────────────────────────────────── */
function CyclingLabel({ labels, interval = 1800, className = '' }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % labels.length), interval)
    return () => clearInterval(t)
  }, [labels.length, interval])

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={labels[idx]}
        className={`text-[13px] font-medium tracking-wide ${className}`}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.22 }}
      >
        {labels[idx]}
      </motion.span>
    </AnimatePresence>
  )
}

/* ─────────────────────────────────────────────
   AUTO — Routing Animation
   3 branching dots fan out suggesting decision-making
───────────────────────────────────────────── */
function RoutingLoader() {
  const branches = [
    { angle: -30, color: '#818cf8' },
    { angle: 0,   color: '#a78bfa' },
    { angle: 30,  color: '#c084fc' },
  ]
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
        {/* Central node */}
        <motion.div
          className="w-2 h-2 rounded-full bg-indigo-400 absolute"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ boxShadow: '0 0 8px rgba(129,140,248,0.7)' }}
        />
        {/* Branching arms */}
        {branches.map(({ angle, color }, i) => (
          <motion.div
            key={i}
            className="absolute w-[18px] h-[1.5px] rounded-full origin-left"
            style={{
              background: color,
              left: '50%',
              top: '50%',
              marginTop: -0.75,
              rotate: angle,
            }}
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: [0, 1, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
        {/* Tip dots */}
        {branches.map(({ angle, color }, i) => (
          <motion.div
            key={`dot-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              background: color,
              left: '50%',
              top: '50%',
              marginTop: -3,
              marginLeft: -3,
              transformOrigin: '3px 3px',
              rotate: angle,
            }}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: [0, 18, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <CyclingLabel
        labels={['Routing prompt', 'Picking agent', 'Deciding...']}
        interval={1200}
        className="text-indigo-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   AUTO / CHAT — Neural Pulse
   3 dots wave cyan→violet
───────────────────────────────────────────── */
function NeuralPulseLoader() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex items-end gap-[5px] h-5">
        {[0, 0.18, 0.36].map((delay, i) => (
          <motion.span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: `hsl(${190 + i * 30}, 80%, 65%)` }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <CyclingLabel
        labels={['Thinking', 'Processing', 'Almost there']}
        className="text-slate-400"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   CODING — Terminal Blink
   Blinking cursor + scrolling compile lines
───────────────────────────────────────────── */
const COMPILE_LINES = [
  '> resolving dependencies...',
  '> compiling modules...',
  '> running static analysis...',
  '> linking output...',
  '> optimizing bundle...',
  '> checking types...',
]
function TerminalBlinkLoader() {
  const [lineIdx, setLineIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLineIdx(p => (p + 1) % COMPILE_LINES.length), 1400)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-start gap-3 py-1">
      <div
        className="flex flex-col gap-1 rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed min-w-[220px]"
        style={{ background: 'rgba(10,20,10,0.6)', border: '1px solid rgba(74,222,128,0.15)' }}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={lineIdx}
            className="text-green-400"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {COMPILE_LINES[lineIdx]}
          </motion.span>
        </AnimatePresence>
        <span className="flex items-center gap-1 text-green-500">
          <span>$</span>
          <motion.span
            className="inline-block w-[7px] h-[13px] bg-green-400 rounded-[1px]"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />
        </span>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   PDF RAG — Document Scanner
   Horizontal scan line sweeps over doc icon
───────────────────────────────────────────── */
function DocumentScannerLoader() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative w-9 h-10 shrink-0 overflow-hidden">
        <svg viewBox="0 0 36 44" className="absolute inset-0 w-full h-full" fill="none">
          <rect x="2" y="2" width="28" height="40" rx="3" stroke="rgba(248,113,113,0.3)" strokeWidth="1.5"/>
          <line x1="7" y1="12" x2="27" y2="12" stroke="rgba(248,113,113,0.2)" strokeWidth="1"/>
          <line x1="7" y1="18" x2="27" y2="18" stroke="rgba(248,113,113,0.2)" strokeWidth="1"/>
          <line x1="7" y1="24" x2="22" y2="24" stroke="rgba(248,113,113,0.2)" strokeWidth="1"/>
          <line x1="7" y1="30" x2="20" y2="30" stroke="rgba(248,113,113,0.2)" strokeWidth="1"/>
        </svg>
        <motion.div
          className="absolute left-0 right-0 h-[2px] rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #f87171, transparent)', boxShadow: '0 0 8px rgba(248,113,113,0.7)' }}
          animate={{ top: ['8%', '88%', '8%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <CyclingLabel
        labels={['Reading PDF', 'Extracting context', 'Searching chunks']}
        className="text-red-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   PDF GENERATE — Page Builder
   Doc SVG draws itself, lines appear one by one
───────────────────────────────────────────── */
function PageBuilderLoader() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative w-9 h-10 shrink-0">
        <svg viewBox="0 0 36 44" className="w-full h-full" fill="none">
          <motion.rect
            x="2" y="2" width="28" height="40" rx="3"
            stroke="#fb923c" strokeWidth="1.5" fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.4 }}
          />
          {[12, 18, 24, 30].map((y, i) => (
            <motion.line
              key={y} x1="7" y1={y} x2={i % 2 === 0 ? 27 : 22} y2={y}
              stroke="#fdba74" strokeWidth="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.3, repeat: Infinity, repeatDelay: 1.6 }}
            />
          ))}
        </svg>
      </div>
      <CyclingLabel
        labels={['Writing document', 'Structuring sections', 'Formatting PDF']}
        className="text-orange-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   PPT — Slide Stack
   3 cards fan out then spring-snap back
───────────────────────────────────────────── */
const SLIDE_COLORS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#8b5cf6,#a855f7)',
  'linear-gradient(135deg,#a855f7,#ec4899)',
]
function SlideStackLoader() {
  const [fanned, setFanned] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setFanned(p => !p), 1200)
    return () => clearInterval(t)
  }, [])

  const rotations = fanned ? [-16, 0, 16] : [0, 0, 0]
  const xOffsets  = fanned ? [-18, 0, 18]  : [0, 0, 0]

  return (
    <div className="flex items-center gap-5 py-1">
      <div className="relative w-10 h-8 shrink-0">
        {SLIDE_COLORS.map((bg, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-[4px]"
            style={{ background: bg, originX: '50%', originY: '100%', zIndex: i }}
            animate={{ rotate: rotations[i], x: xOffsets[i] }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
          />
        ))}
      </div>
      <CyclingLabel
        labels={['Designing slides', 'Adding content', 'Building deck']}
        className="text-purple-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   SEARCH — Web Crawl
   Rotating globe SVG + orbiting ping dot
───────────────────────────────────────────── */
function WebCrawlLoader() {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
        <motion.svg
          viewBox="0 0 36 36" className="w-full h-full" fill="none"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx="18" cy="18" r="14" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5"/>
          <ellipse cx="18" cy="18" rx="7" ry="14" stroke="rgba(56,189,248,0.2)" strokeWidth="1"/>
          <line x1="4" y1="18" x2="32" y2="18" stroke="rgba(56,189,248,0.2)" strokeWidth="1"/>
          <line x1="18" y1="4" x2="18" y2="32" stroke="rgba(56,189,248,0.15)" strokeWidth="1"/>
        </motion.svg>
        {/* Orbiting dot — rotate the container, the dot sits offset */}
        <motion.div
          className="absolute"
          style={{ width: '100%', height: '100%', top: 0, left: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="absolute w-2 h-2 rounded-full bg-sky-400"
            style={{ top: '4%', left: '50%', transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(56,189,248,0.9)' }}
          />
        </motion.div>
      </div>
      <CyclingLabel
        labels={['Searching the web', 'Scanning sources', 'Gathering results']}
        className="text-sky-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   VISION / IMAGE ANALYZER — Eye Scan
   Pulsing iris + biometric grid flash
───────────────────────────────────────────── */
function EyeScanLoader() {
  const [scanning, setScanning] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setScanning(p => !p), 1600)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="relative w-11 h-7 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 44 24" className="w-full h-full" fill="none">
          <path
            d="M2 12 C10 2, 34 2, 42 12 C34 22, 10 22, 2 12 Z"
            stroke="rgba(52,211,153,0.4)" strokeWidth="1.5"
          />
          <motion.circle
            cx="22" cy="12" r="5"
            stroke="#34d399" strokeWidth="1.5" fill="rgba(52,211,153,0.08)"
            animate={{ r: [5, 7, 5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="22" cy="12" r="2"
            fill="#34d399"
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
        </svg>
        <AnimatePresence>
          {scanning && (
            <motion.div
              className="absolute inset-0 rounded"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg,rgba(52,211,153,0.1) 0px,transparent 1px,transparent 5px),' +
                  'repeating-linear-gradient(90deg,rgba(52,211,153,0.1) 0px,transparent 1px,transparent 5px)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </AnimatePresence>
      </div>
      <CyclingLabel
        labels={['Analyzing image', 'Detecting elements', 'Generating insights']}
        className="text-emerald-400/80"
      />
    </div>
  )
}

/* ─────────────────────────────────────────────
   ROUTER — maps agent string → component
───────────────────────────────────────────── */
const ANIMATIONS = {
  auto:          <RoutingLoader />,
  chat:          <NeuralPulseLoader />,
  coding:        <TerminalBlinkLoader />,
  pdf:           <PageBuilderLoader />,
  pdfrag:        <DocumentScannerLoader />,
  ppt:           <SlideStackLoader />,
  search:        <WebCrawlLoader />,
  vision:        <EyeScanLoader />,
  imageanalyzer: <EyeScanLoader />,
}

export default function LoadingAnimation({ agent = 'auto' }) {
  const key = (agent ?? 'auto').toLowerCase().replace(/\s+/g, '')
  return (
    <div className="flex items-center gap-3 max-w-[72%] py-1">
      {ANIMATIONS[key] ?? ANIMATIONS['auto']}
    </div>
  )
}
