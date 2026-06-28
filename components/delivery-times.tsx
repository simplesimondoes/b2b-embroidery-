"use client"

import { useEffect, useState } from "react"

import GradientButton from "@/components/gradient-button"
import { addWorkingDays, formatDeliveryDate } from "@/lib/shipping"

// Print-on-demand means each item is made to order, so turnaround stays
// dependable as volume grows — production scales rather than queueing. These are
// current working-day estimates (production + dispatch), excluding weekends.
const BANDS = [
  {
    range: "1–20",
    label: "items",
    min: 3,
    max: 5,
    note: "Ideal for a small team or a first sample order.",
    highlight: false,
    sampleCta: false,
  },
  {
    range: "21–50",
    label: "items",
    min: 4,
    max: 6,
    note: "Our most popular size for branded team kit.",
    highlight: true,
    sampleCta: false,
  },
  {
    range: "50+",
    label: "items",
    min: 5,
    max: 7,
    note: "Bulk orders for events, uniforms and rollouts.",
    highlight: false,
    sampleCta: true,
  },
]

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 17h4V5H2v12h2" />
      <path d="M14 9h4l3 3v5h-3" />
      <circle cx="7.5" cy="17.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  )
}

export default function DeliveryTimes() {
  // Concrete delivery dates are computed client-side after mount so server and
  // client markup match (no hydration mismatch from `new Date()`).
  const [arriveBy, setArriveBy] = useState<string[]>([])
  useEffect(() => {
    const today = new Date()
    setArriveBy(BANDS.map(b => formatDeliveryDate(addWorkingDays(today, b.max))))
  }, [])

  return (
    <div>
      <div className="max-w-2xl">
        <h2 className="font-display text-2xl font-[900] tracking-tight text-black sm:text-3xl">
          DELIVERY TIMES
        </h2>
        <p className="mt-4 text-base leading-relaxed text-neutral-700">
          Because every order is embroidered on demand, our turnaround stays
          dependable whether you need 5 polos or 500 — production scales with
          your order instead of queueing behind it.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
        {BANDS.map((b, i) => (
          <div
            key={b.range}
            className={
              "relative flex flex-col rounded-2xl border p-7 transition-shadow " +
              (b.highlight
                ? "border-indigo-500 bg-white shadow-[0_8px_30px_rgba(77,82,210,0.12)]"
                : "border-neutral-200 bg-white hover:shadow-sm")
            }
          >
            {b.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-display text-2xl font-[900] text-black">{b.range}</span>{" "}
                <span className="text-sm text-neutral-500">{b.label}</span>
              </div>
              <TruckIcon className={"h-6 w-6 " + (b.highlight ? "text-indigo-500" : "text-neutral-400")} />
            </div>

            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display whitespace-nowrap text-4xl font-[900] leading-none text-black">
                {b.min}–{b.max}
              </span>
              <span className="text-sm font-medium text-neutral-600">working days</span>
            </div>
            <p className="mt-2 text-sm text-neutral-500">Production &amp; dispatch combined</p>

            {/* Concrete "order today" date — the most persuasive bit for buyers
                working to a deadline. */}
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm">
              <svg className="h-4 w-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className="text-neutral-700">
                Order today, get it by{" "}
                <span className="font-semibold text-black">
                  {arriveBy[i] ?? "…"}
                </span>
              </span>
            </div>

            <p className="mt-5 border-t border-neutral-100 pt-4 text-sm leading-relaxed text-neutral-600">
              {b.note}
            </p>

            {b.sampleCta && (
              <a
                href="#get-sample"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                Order a sample first
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-neutral-100 p-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-700">
          <span className="font-semibold text-black">Need it sooner?</span> Express
          production and shipping options are available at checkout. Estimates are
          based on current production capacity and exclude weekends and public
          holidays.
        </p>
        <GradientButton href="/?product=2116">Start your order</GradientButton>
      </div>
    </div>
  )
}
