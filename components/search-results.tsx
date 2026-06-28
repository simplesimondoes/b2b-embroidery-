"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"

// Where the embroidery business results lead — the local landing page,
// so the demo journey (search → landing → designer) stays inside this app.
const LANDING = "/emb-landing"

type SiteLink = { label: string; sub?: string; href: string }

const sponsored: {
  display: string
  title: string
  href: string
  desc: string
  links: SiteLink[]
}[] = [
  {
    display: "www.spreadshirt.co.uk › business › embroidered-polos",
    title: "Embroidered Polo Shirts for Business — Spreadshirt",
    href: LANDING,
    desc: "Custom embroidered polos for your team. Premium fabrics, fast turnaround & bulk discounts. Upload your logo and get a free digital mockup today.",
    links: [
      { label: "Get a Free Quote", sub: "No-obligation pricing in minutes", href: LANDING },
      { label: "Bulk Pricing", sub: "Save more on larger orders", href: LANDING },
      { label: "Design Online", sub: "Add your logo & preview live", href: LANDING },
      { label: "Free Mockup", sub: "See it before you buy", href: LANDING },
    ],
  },
  {
    display: "www.spreadshirt.co.uk › embroidery › quick-turnaround",
    title: "Quality Custom Embroidered Polos — Quick Turnaround",
    href: LANDING,
    desc: "Need branded polos fast? Professional logo embroidery with a quick turnaround and a quality guarantee. Trusted by thousands of UK businesses.",
    links: [
      { label: "Order Now", href: LANDING },
      { label: "Fabric Options", href: LANDING },
      { label: "Contact Sales", href: LANDING },
    ],
  },
]

const organic: {
  initial: string
  color: string
  site: string
  display: string
  title: string
  href: string
  desc: string
  links?: SiteLink[]
}[] = [
  {
    initial: "S",
    color: "#1a73e8",
    site: "Spreadshirt",
    display: "https://www.spreadshirt.co.uk › business › polos",
    title: "Custom Embroidered Polo Shirts for Your Business | Spreadshirt",
    href: LANDING,
    desc: 'Searching for "custom embroidery uk"? Kit out your team with professionally embroidered polo shirts. Premium cotton & performance fabrics, vibrant logo stitching, and bulk pricing for businesses.',
    links: [
      { label: "Bulk Orders", href: LANDING },
      { label: "Logo Setup", href: LANDING },
      { label: "Delivery Times", href: LANDING },
      { label: "Get a Quote", href: LANDING },
    ],
  },
  {
    initial: "S",
    color: "#34a853",
    site: "Spreadshirt Blog",
    display: "https://www.spreadshirt.co.uk › guides › embroidered-polos",
    title: "How to Choose the Best Embroidered Polos for Your Team",
    href: LANDING,
    desc: "A simple guide to picking fabrics, colours and logo placement for business polo shirts — plus how to get a fast, accurate quote for your order.",
  },
  {
    initial: "W",
    color: "#fbbc05",
    site: "Workwear Reviews",
    display: "https://www.workwearreviews.co.uk › best-embroidered-polos",
    title: "Best Embroidered Polo Shirt Suppliers (2026) — Ranked",
    href: "#",
    desc: "We compared the top suppliers for custom embroidered business polos on quality, price and turnaround. Spreadshirt comes out on top for value and speed.",
  },
  {
    initial: "B",
    color: "#ea4335",
    site: "Business Uniforms UK",
    display: "https://www.businessuniforms.co.uk › embroidered-polo-shirts",
    title: "Embroidered Polo Shirts — Branded Workwear for Companies",
    href: "#",
    desc: "Smart, durable branded polos for staff uniforms and corporate events. Add your company logo and order in bulk with quick delivery across the UK.",
  },
  {
    initial: "Q",
    color: "#1a73e8",
    site: "Quote My Kit",
    display: "https://www.quotemykit.co.uk › polos › embroidery",
    title: "Get an Instant Quote for Embroidered Business Polos",
    href: "#",
    desc: "Compare prices for quality customised embroidered polos. Upload your logo, choose quantities and receive an instant quote with a free mockup.",
  },
]

const tabs = ["All", "Images", "Shopping", "News", "Maps", "Videos"]

function Favicon({ initial, color }: { initial: string; color: string }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  )
}

function SiteLinks({ links }: { links: SiteLink[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-3">
      {links.map((l) => (
        <div key={l.label}>
          <Link href={l.href} className="text-[#1a0dab] hover:underline">
            {l.label}
          </Link>
          {l.sub && <div className="text-sm text-[#4d5156]">{l.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export default function SearchResults() {
  const params = useSearchParams()
  const router = useRouter()
  const initial = params.get("q") ?? "custom embroidery uk"
  const [query, setQuery] = useState(initial)

  return (
    <div className="min-h-screen bg-white text-[#202124]">
      {/* Header: logo + search bar */}
      <header className="border-b border-[#ebebeb]">
        <div className="flex flex-col gap-4 px-6 pt-5 sm:flex-row sm:items-center sm:gap-8 lg:px-[140px]">
          <Link href="/google" className="flex items-center pt-1">
            <svg viewBox="0 0 272 92" className="h-7 w-[92px]" aria-label="Google">
              <path fill="#4285F4" d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" />
              <path fill="#EA4335" d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" />
              <path fill="#FBBC05" d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z" />
              <path fill="#4285F4" d="M225 3v65h-9.5V3h9.5z" />
              <path fill="#34A853" d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.04zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z" />
              <path fill="#EA4335" d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z" />
            </svg>
          </Link>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              router.push(`/search?q=${encodeURIComponent(query.trim() || initial)}`)
            }}
            className="w-full max-w-[640px]"
          >
            <div className="flex items-center gap-3 rounded-full border border-[#dfe1e5] px-4 py-2.5 shadow-[0_1px_6px_rgba(32,33,36,0.18)] hover:shadow-[0_1px_8px_rgba(32,33,36,0.25)]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-base outline-none"
              />
              <button type="submit" aria-label="Search">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285f4">
                  <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Tabs */}
        <nav className="mt-3 flex gap-6 px-6 text-sm text-[#5f6368] lg:px-[152px]">
          {tabs.map((t, i) => (
            <span
              key={t}
              className={
                i === 0
                  ? "border-b-[3px] border-[#1a73e8] pb-3 text-[#1a73e8]"
                  : "pb-3 hover:text-[#202124]"
              }
            >
              {t}
            </span>
          ))}
        </nav>
      </header>

      {/* Results */}
      <main className="max-w-[652px] px-6 py-5 lg:ml-[152px] lg:px-0">
        <p className="mb-5 text-sm text-[#70757a]">
          About 2,340,000 results (0.41 seconds)
        </p>

        {/* Sponsored */}
        {sponsored.map((ad) => (
          <div key={ad.title} className="mb-7">
            <div className="text-sm font-bold text-[#202124]">Sponsored</div>
            <div className="text-sm text-[#202124]">{ad.display}</div>
            <Link
              href={ad.href}
              className="text-xl text-[#1a0dab] hover:underline"
            >
              {ad.title}
            </Link>
            <p className="mt-1 text-sm leading-relaxed text-[#4d5156]">{ad.desc}</p>
            <SiteLinks links={ad.links} />
          </div>
        ))}

        {/* Organic */}
        {organic.map((r) => (
          <div key={r.title} className="mb-7">
            <div className="flex items-center gap-3">
              <Favicon initial={r.initial} color={r.color} />
              <div className="leading-tight">
                <div className="text-sm text-[#202124]">{r.site}</div>
                <div className="text-xs text-[#4d5156]">{r.display}</div>
              </div>
            </div>
            <Link
              href={r.href}
              className="mt-1 block text-xl text-[#1a0dab] hover:underline"
            >
              {r.title}
            </Link>
            <p className="mt-1 text-sm leading-relaxed text-[#4d5156]">{r.desc}</p>
            {r.links && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {r.links.map((l) => (
                  <Link key={l.label} href={l.href} className="text-sm text-[#1a0dab] hover:underline">
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  )
}
