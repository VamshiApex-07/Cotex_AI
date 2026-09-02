import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useToast } from '../hooks/useToast'

function MessageBubble({ role, content, images }) {
  const isUser = role === "user"
  const [lightBox, setLightBox] = useState(null)
  const [copiedCode, setCopiedCode] = useState("")
  const toast = useToast()

  const copyCode = async (code) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success("Copied to clipboard")
    setTimeout(() => {
      setCopiedCode("")
    }, 2000)
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`w-fit max-w-[92vw] md:max-w-[72%]
        px-4 py-3 rounded-2xl
        break-words overflow-hidden
        leading-relaxed
        ${isUser
          ? "bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 text-white shadow-lg shadow-violet-500/20"
          : "bg-slate-800/60 backdrop-blur-sm text-slate-200 border border-slate-700/50"
        }`}>

        {images.length > 0 && (
          <div className='flex flex-wrap gap-2 mb-3'>
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setLightBox(img)}
                loading="lazy"
                onError={(e) => e.currentTarget.remove()}
                className="w-32 h-24 rounded-xl object-cover ring-2 ring-slate-700/50 cursor-zoom-in hover:ring-violet-500/50 transition-all"
              />
            ))}
          </div>
        )}

        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            h1: ({ children }) => (
              <h1 className='text-xl font-bold mt-4 mb-2 text-inherit'>{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className='text-lg font-semibold mt-3 mb-2 text-inherit'>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className='text-base font-semibold mt-2 mb-1 text-inherit'>{children}</h3>
            ),
            p: ({ children }) => (
              <p className='mb-3 whitespace-pre-wrap break-words last:mb-0'>{children}</p>
            ),
            ul: ({ children }) => (
              <ul className='list-disc pl-5 space-y-1 my-2'>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className='list-decimal pl-5 space-y-1 my-2'>{children}</ol>
            ),
            li: ({ children }) => (
              <li className='text-inherit opacity-90'>{children}</li>
            ),
            table: ({ children }) => (
              <div className='overflow-x-auto my-4 rounded-lg border border-slate-700/50'>
                <table className='min-w-full'>{children}</table>
              </div>
            ),
            th: ({ children }) => (
              <th className='bg-slate-700/50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>{children}</th>
            ),
            td: ({ children }) => (
              <td className='px-4 py-2 text-sm border-t border-slate-700/50'>{children}</td>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
              >
                {children}
                <ExternalLink size={12} />
              </a>
            ),
            code: ({ className, children, ...props }) => {
              const value = String(children).trim()

              if (!className) {
                return (
                  <code className='px-1.5 py-0.5 rounded bg-slate-700/60 text-violet-300 text-[13px] font-mono' {...props}>
                    {value}
                  </code>
                )
              }

              const language = className.replace("language-", "")

              return (
                <div className='my-4 overflow-hidden rounded-xl border border-slate-700/50 bg-[#0d1117]'>
                  <div className='flex items-center justify-between bg-slate-800/80 border-b border-slate-700/50 px-4 py-2'>
                    <span className='text-[11px] font-medium text-slate-400 uppercase tracking-wider'>
                      {language}
                    </span>
                    <button
                      className='flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer'
                      onClick={() => copyCode(value)}
                    >
                      {copiedCode == value ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <SyntaxHighlighter
                    language={language}
                    style={oneDark}
                    wrapLongLines
                    showLineNumbers
                    customStyle={{
                      margin: 0,
                      padding: "16px",
                      background: "#0d1117",
                      fontSize: "13px",
                    }}
                  >
                    {value}
                  </SyntaxHighlighter>
                </div>
              )
            },
            img: ({ src }) => {
              if (!src) return null
              return (
                <img
                  src={src}
                  onClick={() => setLightBox(src)}
                  loading="lazy"
                  onError={(e) => e.currentTarget.remove()}
                  className="w-32 h-24 rounded-xl object-cover cursor-zoom-in hover:ring-2 hover:ring-violet-500/50 transition-all my-2"
                />
              )
            },
            blockquote: ({ children }) => (
              <blockquote className='border-l-2 border-violet-500/50 pl-4 my-2 italic text-slate-400'>{children}</blockquote>
            ),
            hr: () => <hr className='border-slate-700/50 my-4' />,
            strong: ({ children }) => <strong className='font-semibold text-inherit'>{children}</strong>,
            em: ({ children }) => <em className='italic opacity-90'>{children}</em>,
          }}
        >
          {content}
        </Markdown>
      </div>

      {lightBox && (
        <div className='fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6'>
          <button
            className='absolute top-4 right-4 w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer'
            onClick={() => setLightBox(null)}
          >
            <X size={18} />
          </button>
          <img
            src={lightBox}
            className="max-w-[90vw] max-h-[85vh] rounded-2xl border border-slate-700/50 shadow-2xl object-contain"
            alt="Preview"
          />
        </div>
      )}
    </div>
  )
}

export default MessageBubble