"use client"

import { useRef } from "react"

export type ProductTileData = {
  id: string
  image: string
  price: string
  brand: string
  name: string
  colors: string[]
}

// Tile modeled on @sprd/sprd-component-kit v2 ProductCard: gray image area,
// price + multi-line title (brand / name), and a row of colour swatches (+N).
function ProductTile({ t }: { t: ProductTileData }) {
  const shown = t.colors.slice(0, 5)
  const extra = t.colors.length - shown.length
  return (
    <div className="w-[clamp(200px,22vw,272px)] shrink-0">
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-neutral-100">
        <img src={t.image} alt={t.name} className="h-full w-full object-contain" />
      </div>
      <p className="mt-3 text-base font-bold text-black">{t.price}</p>
      <p className="mt-1.5 text-base font-bold text-black">{t.brand}</p>
      <p className="truncate text-base text-neutral-700">{t.name}</p>
      <ul className="mt-2 flex items-center gap-1">
        {shown.map((c, i) => (
          <li key={i}>
            <span
              className="block h-4 w-4 rounded-full border border-black/15"
              style={{ backgroundColor: c }}
            />
          </li>
        ))}
        {extra > 0 && <li className="ml-1 text-sm text-neutral-700">+{extra}</li>}
      </ul>
    </div>
  )
}

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
          <ProductTile key={t.id} t={t} />
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
