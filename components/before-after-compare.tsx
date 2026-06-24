"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export default function BeforeAfterCompare() {
  const [pos, setPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  // Intro teaser: on load, ease the handle ~24px left, then right, then back to
  // center — hinting that it's draggable. Stops if the user grabs it first.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.getBoundingClientRect().width || 1
    const d = (24 / width) * 100 // ~24px expressed as a percentage
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
    // [elapsedMs, posValue]
    const kf: [number, number][] = [
      [0, 50],
      [550, 50 - d],
      [1200, 50 + d],
      [1850, 50],
    ]
    let raf = 0
    let startTs = 0
    const tick = (ts: number) => {
      if (draggingRef.current) return // user took over — leave it
      if (!startTs) startTs = ts
      const elapsed = ts - startTs
      if (elapsed >= kf[kf.length - 1][0]) {
        setPos(50)
        return
      }
      let i = 0
      while (i < kf.length - 1 && elapsed > kf[i + 1][0]) i++
      const [t0, v0] = kf[i]
      const [t1, v1] = kf[i + 1]
      const local = Math.max(0, Math.min(1, (elapsed - t0) / (t1 - t0)))
      setPos(v0 + (v1 - v0) * ease(local))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.max(0, Math.min(100, pct)))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    updateFromClientX(e.clientX)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return
    updateFromClientX(e.clientX)
  }
  const stopDragging = (e: React.PointerEvent) => {
    draggingRef.current = false
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      role="slider"
      aria-label="Compare graphic and embroidery"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      className="relative aspect-[1203/1019] h-[340px] max-h-full max-w-full cursor-ew-resize touch-none overflow-hidden rounded-2xl select-none"
    >
      {/* Embroidery — clipped to the right of the handle only, so it never
          shows through any transparent areas of the graphic on the left. */}
      <img
        src="/images/example-embroidery.png"
        alt="Embroidered result"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      />
      {/* Graphic — clipped to the left of the handle. */}
      <img
        src="/images/example-graphic.png"
        alt="Original graphic"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Divider line */}
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.35)]"
        style={{ left: `${pos}%` }}
      />

      {/* Handle */}
      <div
        className="pointer-events-none absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-0.5 rounded-full bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        style={{ left: `${pos}%` }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 6L9 12L15 18"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 6L15 12L9 18"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
