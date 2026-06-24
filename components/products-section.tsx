"use client"

import { useState } from "react"

import ProductCarousel, { type ProductTileData } from "@/components/product-carousel"
import SegmentedControl from "@/components/segmented-control"

const TABS = ["Our products", "Get sample", "Calculate price", "See examples", "FAQ"]

export default function ProductsSection({ tiles }: { tiles: ProductTileData[] }) {
  const [active, setActive] = useState(0)

  return (
    <section className="w-full pb-12">
      {/* Tabs centered */}
      <div className="flex justify-center px-[90px]">
        <SegmentedControl items={TABS} active={active} onChange={setActive} />
      </div>

      <div className="mt-10">
        {active === 0 ? (
          // Full-bleed carousel: first tile aligns to the 90px gutter, the rest
          // bleed off-screen when scrolled.
          <ProductCarousel tiles={tiles} />
        ) : (
          <div className="px-[90px]">
            <p className="text-neutral-500">Coming soon.</p>
          </div>
        )}
      </div>
    </section>
  )
}
