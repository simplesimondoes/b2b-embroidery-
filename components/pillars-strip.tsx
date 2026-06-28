// The three buyer pillars, stated upfront under the hero. Each links to the
// section that proves it, so the first scroll answers the B2B checklist.
const PILLARS = [
  {
    href: "#get-sample",
    title: "Quality you can check",
    body: "Order 20+ and we send a real photo of your design stitched on the product — before we make the full run.",
    icon: (
      <>
        <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16.5 7.1 18.2l.9-5.5-4-3.9L9.5 8 12 3z" />
      </>
    ),
  },
  {
    href: "#calculate-price",
    title: "Transparent pricing",
    body: "See your full price instantly — product, embroidery and volume discounts, with no hidden setup fees.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.5c-.6-.7-1.6-1-2.5-1-1.4 0-2.5.7-2.5 1.8 0 2.7 5 1.3 5 4 0 1.1-1.1 1.9-2.5 1.9-1 0-2-.4-2.6-1.1M12 7v10" />
      </>
    ),
  },
  {
    href: "#delivery-times",
    title: "Dependable delivery",
    body: "Made on demand, so turnaround stays consistent — from a single sample to 500+ pieces.",
    icon: (
      <>
        <path d="M10 17h4V5H2v12h2" />
        <path d="M14 9h4l3 3v5h-3" />
        <circle cx="7.5" cy="17.5" r="2" />
        <circle cx="17.5" cy="17.5" r="2" />
      </>
    ),
  },
]

export default function PillarsStrip() {
  return (
    <section aria-label="Why choose us" className="mx-auto max-w-[1280px] px-6 sm:px-[90px]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PILLARS.map(p => (
          <a
            key={p.title}
            href={p.href}
            className="group flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                {p.icon}
              </svg>
            </span>
            <span>
              <span className="block font-display text-base font-[900] tracking-tight text-black">
                {p.title}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-neutral-600">{p.body}</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
