/**
 * Animated gold shimmer text for luxury display headings.
 * Inspired by 21st.dev TextShimmer component pattern.
 * Uses CSS background-clip + animated background-position for pure CSS shimmer.
 *
 * Usage:
 *   <TextShimmer as="h1" className="text-3xl serif-display">My Wardrobe</TextShimmer>
 *
 * The shimmer sweeps a gold highlight from left to right, then repeats.
 * Cycle: 6 seconds. Restrained — feels like light catching fabric.
 */
export default function TextShimmer({ children, className = '', as: Tag = 'h1' }) {
  return (
    <Tag className={`text-shimmer ${className}`}>
      {children}
    </Tag>
  )
}
