"use client"

import Link from "next/link"
import { useRef } from "react"

import ProductTile, { type ProductTileData } from "@/components/product-tile"

export type { ProductTileData }

export default function ProductCarousel({ tiles }: { tiles: ProductTileData[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const next = () =>
    ref.current?.scrollBy({ left: ref.current.clientWidth * 0.8, behavior: "smooth" })

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-6 overflow-x-auto scroll-smooth pr-[90px] pb-2 pl-[90px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tiles.map(t => (
          <Link
            key={t.id}
            href={`/?product=${t.id}`}
            className="w-[clamp(200px,22vw,272px)] shrink-0"
          >
            <ProductTile t={t} />
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={next}
        aria-label="Next"
        className="absolute top-[40%] right-6 flex h-14 w-14 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-105"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
