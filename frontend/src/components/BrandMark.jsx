import { useId } from "react"

// Three satellites orbiting a hub — a neural-network motif rather than a
// literal brain, which reads better at 20px than any anatomical shape does.
const BrandMark = ({ size = 28, className = "" }) => {
    // SVG gradient ids are document-global, so give each instance its own.
    // The raw useId() value contains punctuation that varies by React version;
    // stripping it keeps the url(#...) reference safe either way.
    const gradientId = `brandmark-${useId().replace(/[^a-zA-Z0-9]/g, "")}`

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className={className}
        >
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="3"
                    y1="2"
                    x2="21"
                    y2="21"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#818cf8" />
                    <stop offset="1" stopColor="#a78bfa" />
                </linearGradient>
            </defs>

            <g
                stroke={`url(#${gradientId})`}
                strokeWidth="1.35"
                strokeLinecap="round"
            >
                {/* hub to satellites */}
                <path
                    d="M12 6.5V9.4M10.1 13.6 7.3 15.4M13.9 13.6 16.7 15.4"
                    opacity="0.75"
                />
                {/* the outer ring, at lower weight so the hub stays dominant */}
                <path
                    d="M10.6 6.1 6.9 14.9M13.4 6.1 17.1 14.9M7.7 16.8h8.6"
                    opacity="0.3"
                />
            </g>

            <g fill={`url(#${gradientId})`}>
                <circle cx="12" cy="11.6" r="2.6" />
                <circle cx="12" cy="4.7" r="1.85" />
                <circle cx="5.9" cy="16.8" r="1.85" />
                <circle cx="18.1" cy="16.8" r="1.85" />
            </g>
        </svg>
    )
}

export default BrandMark
