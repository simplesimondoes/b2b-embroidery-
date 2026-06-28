export type ShippingId = "standard" | "premium" | "express"

export const SHIPPING_OPTIONS: {
  id: ShippingId
  label: string
  price: number
  minDays: number
  maxDays: number
  color: string
}[] = [
  { id: "standard", label: "Standard", price: 3.99, minDays: 5, maxDays: 7, color: "text-neutral-500" },
  { id: "premium", label: "Premium", price: 7.99, minDays: 2, maxDays: 3, color: "text-indigo-500" },
  { id: "express", label: "Express", price: 15.99, minDays: 1, maxDays: 2, color: "text-green-500" },
]

// Delivery window calculated from today + min/max days. Runs client-side.
export function deliveryDateRange(minDays: number, maxDays: number): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const from = new Date()
  from.setDate(from.getDate() + minDays)
  const to = new Date()
  to.setDate(to.getDate() + maxDays)
  return from.getMonth() === to.getMonth()
    ? `${fmt(from)} – ${to.getDate()}`
    : `${fmt(from)} – ${fmt(to)}`
}

// Add N working days (skipping Sat/Sun) to a date. Used for delivery estimates.
export function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++
  }
  return d
}

// "Thu 3 Jul" — concise, weekday-led delivery date for B2B buyers.
export function formatDeliveryDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
}

// Production lead time (working days) by total order quantity. Print-on-demand
// keeps this tight as volume grows — it scales rather than queueing.
export function productionDaysForQty(qty: number): { min: number; max: number } {
  if (qty <= 20) return { min: 2, max: 3 }
  if (qty <= 50) return { min: 3, max: 4 }
  return { min: 4, max: 5 }
}

// Combined production + shipping delivery window, formatted as "Thu 3 – Mon 7 Jul".
export function deliveryWindow(
  prodMin: number,
  prodMax: number,
  shipMin: number,
  shipMax: number,
  from: Date = new Date()
): { fromLabel: string; toLabel: string } {
  return {
    fromLabel: formatDeliveryDate(addWorkingDays(from, prodMin + shipMin)),
    toLabel: formatDeliveryDate(addWorkingDays(from, prodMax + shipMax)),
  }
}
