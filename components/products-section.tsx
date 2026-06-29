"use client"

import { useEffect, useRef, useState } from "react"

import GradientButton from "@/components/gradient-button"
import CustomerReviews from "@/components/customer-reviews"
import DeliveryTimes from "@/components/delivery-times"
import FaqSection from "@/components/faq-section"
import PriceCalculator from "@/components/price-calculator"
import ProductCarousel, { type ProductTileData } from "@/components/product-carousel"
import SegmentedControl from "@/components/segmented-control"
import { cn } from "@/lib/utils"

const TABS = [
  { label: "Our products", id: "our-products" },
  { label: "Get sample", id: "get-sample" },
  { label: "Calculate price", id: "calculate-price" },
  { label: "Delivery times", id: "delivery-times" },
  { label: "Customer reviews", id: "customer-reviews" },
  { label: "FAQ", id: "faq" },
]

export default function ProductsSection({ tiles }: { tiles: ProductTileData[] }) {
  const [active, setActive] = useState(0)
  const [stuck, setStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // While a click-triggered scroll is in flight, ignore the scroll-spy so it
  // doesn't fight the click and land on the wrong tab.
  const lockRef = useRef(false)
  const lockTimer = useRef<number | null>(null)

  const goTo = (i: number) => {
    setActive(i)
    lockRef.current = true
    if (lockTimer.current) window.clearTimeout(lockTimer.current)
    lockTimer.current = window.setTimeout(() => {
      lockRef.current = false
    }, 1000)
    document.getElementById(TABS[i].id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  // Toggle the tab bar's bottom border only once it's stuck to the top.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Scroll-spy: highlight the last section whose top has passed under the
  // sticky bar. Deterministic (no ratio races) and skipped during click-scroll.
  useEffect(() => {
    const OFFSET = 120 // sticky bar height + a little breathing room
    const update = () => {
      if (lockRef.current) return
      let cur = 0
      for (let i = 0; i < TABS.length; i++) {
        const el = document.getElementById(TABS[i].id)
        if (el && el.getBoundingClientRect().top <= OFFSET) cur = i
      }
      setActive(cur)
    }
    const onScrollEnd = () => {
      lockRef.current = false
      update()
    }
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("scrollend", onScrollEnd)
    update()
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("scrollend", onScrollEnd)
    }
  }, [])

  return (
    <div className="relative">
      {/* Sentinel: marks the tab bar's natural top position */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      {/* Sticky tab bar — border only appears once stuck */}
      <div
        className={cn(
          "sticky top-0 z-30 bg-white/95 py-4 backdrop-blur",
          stuck && "border-b border-neutral-200"
        )}
      >
        <div className="flex justify-center px-3 sm:px-[90px]">
          <SegmentedControl
            items={TABS.map(t => t.label)}
            active={active}
            onChange={goTo}
            stuck={stuck}
          />
        </div>
      </div>

      {/* Our products — full-bleed carousel */}
      <section id="our-products" className="scroll-mt-[110px] pt-10 pb-16">
        <ProductCarousel tiles={tiles} />
      </section>

      {/* Get sample — image with magnifier + copy */}
      <section id="get-sample" className="mt-9 scroll-mt-[110px] bg-neutral-100 px-6 py-12 sm:px-[90px] sm:py-16">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
            <img
              src="/images/sample.png"
              alt="Embroidered garment"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="font-display text-xl font-[900] text-black">Order 20 or more products</p>
            <h2 className="font-display mt-1 text-3xl font-[900] tracking-tight text-black sm:text-4xl">
              to SEE A SAMPLE
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-700">
              We'll send you a close-up photo of your design embroidered on the product you order, so you can see the quality and details before before we continue with your order.
            </p>
            <div className="mt-8">
              <GradientButton href="/">Create now</GradientButton>
            </div>
          </div>
        </div>
      </section>

      {/* Placeholder sections for the remaining tabs */}
      <section id="calculate-price" className="mt-9 scroll-mt-[110px] px-6 py-12 sm:px-[90px] sm:py-16">
        <PriceCalculator tiles={tiles} />
      </section>
      <section id="delivery-times" className="mt-9 scroll-mt-[110px] bg-neutral-100 px-6 py-12 sm:px-[90px] sm:py-16">
        <DeliveryTimes />
      </section>
      <section id="customer-reviews" className="mt-9 scroll-mt-[110px] px-6 py-12 sm:px-[90px] sm:py-16">
        <h2 className="font-display text-2xl font-[900] text-black">CUSTOMER REVIEWS</h2>
        <div className="mt-8">
          <CustomerReviews />
        </div>
      </section>
      {/* min-h-screen so the last tab can scroll its top under the sticky bar */}
      <section id="faq" className="mt-9 min-h-screen scroll-mt-[110px] px-6 py-12 sm:px-[90px] sm:py-16">
        <FaqSection />
      </section>
    </div>
  )
}
