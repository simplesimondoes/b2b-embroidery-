"use client"

import { useEffect, useState } from "react"

import * as Popover from "@radix-ui/react-popover"

import MultiProductSelectDrawer, {
  type Selection,
} from "@/components/multi-product-select-drawer"
import type { ProductTileData } from "@/components/product-tile"
import QuantitySelector from "@/components/quantity-selector"
import VolumeDiscountDialog from "@/components/volume-discount-dialog"
import {
  SHIPPING_OPTIONS,
  deliveryWindow,
  productionDaysForQty,
  type ShippingId,
} from "@/lib/shipping"
import { cn } from "@/lib/utils"

const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €"

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const
// Per-product size breakdown: productId -> { size -> qty }.
type SizeMatrix = Record<string, Partial<Record<(typeof SIZES)[number], number>>>
const sizeSum = (row: SizeMatrix[string] | undefined) =>
  row ? Object.values(row).reduce((a, b) => a + (b ?? 0), 0) : 0

// Selection (productId -> quantity) is shared with the drawer so both stay in sync.
export default function PriceCalculator({ tiles }: { tiles: ProductTileData[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [discountInfoOpen, setDiscountInfoOpen] = useState(false)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [shippingId, setShippingId] = useState<ShippingId>("standard")
  const [selection, setSelection] = useState<Selection>({})
  // Optional per-size split for each product. When a product's breakdown is
  // open, its sizes drive the row quantity.
  const [sizeMatrix, setSizeMatrix] = useState<SizeMatrix>({})
  const [sizeOpen, setSizeOpen] = useState<Record<string, boolean>>({})
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [quoteRef, setQuoteRef] = useState("")
  const [quoteDate, setQuoteDate] = useState("")
  const [quoteCopied, setQuoteCopied] = useState(false)

  const shippingOption =
    SHIPPING_OPTIONS.find(o => o.id === shippingId) ?? SHIPPING_OPTIONS[0]

  const setRowQty = (id: string, qty: number) => setSelection(prev => ({ ...prev, [id]: qty }))

  const clearAll = () => {
    setSelection({})
    setSizeMatrix({})
    setSizeOpen({})
  }

  const removeRow = (id: string) => {
    setSelection(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSizeMatrix(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setSizeOpen(prev => ({ ...prev, [id]: false }))
  }

  // Open/close a product's size breakdown. When opening for the first time,
  // seed the current quantity into "M" so the total is preserved.
  const toggleSize = (id: string) => {
    const willOpen = !sizeOpen[id]
    if (willOpen && !sizeMatrix[id]) {
      setSizeMatrix(prev => ({ ...prev, [id]: { M: selection[id] ?? 0 } }))
    }
    setSizeOpen(prev => ({ ...prev, [id]: willOpen }))
  }

  const setSize = (id: string, size: (typeof SIZES)[number], qty: number) => {
    setSizeMatrix(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), [size]: Math.max(0, qty) },
    }))
  }

  // Keep the row quantity in sync with the size breakdown while it's open.
  useEffect(() => {
    setSelection(prev => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(sizeOpen)) {
        if (!sizeOpen[id]) continue
        const sum = sizeSum(sizeMatrix[id])
        if (next[id] !== sum) {
          next[id] = sum
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [sizeMatrix, sizeOpen])

  const byId = new Map(tiles.map(t => [t.id, t]))
  const rows = Object.entries(selection)
    .map(([id, qty]) => ({ tile: byId.get(id), qty }))
    .filter((r): r is { tile: ProductTileData; qty: number } => Boolean(r.tile))
  const grandTotal = rows.reduce((sum, r) => sum + r.tile.priceValue * r.qty, 0)

  // Volume discount tiers (mirrors the designer's getDiscountPercentage),
  // based on the total quantity across all selected products.
  const totalPieces = rows.reduce((sum, r) => sum + r.qty, 0)
  const discountPct =
    totalPieces >= 100
      ? 0.5
      : totalPieces >= 60
        ? 0.4
        : totalPieces >= 40
          ? 0.3
          : totalPieces >= 20
            ? 0.2
            : totalPieces >= 5
              ? 0.1
              : 0
  const discountAmount = grandTotal * discountPct
  // Embroidery: 12 € per piece, added on top after the product discount.
  const EMBROIDERY_UNIT_PRICE = 12
  const embroideryCost = totalPieces * EMBROIDERY_UNIT_PRICE
  const shippingCost = totalPieces > 0 ? shippingOption.price : 0
  const finalTotal = grandTotal - discountAmount + embroideryCost + shippingCost
  const perPiece = totalPieces > 0 ? finalTotal / totalPieces : 0

  // Estimated delivery = production lead time (scales with quantity) + the
  // selected shipping speed. Recomputes as quantity or shipping changes.
  const production = productionDaysForQty(totalPieces)
  const delivery = deliveryWindow(
    production.min,
    production.max,
    shippingOption.minDays,
    shippingOption.maxDays
  )

  const empty = rows.length === 0

  // Compact "S×5  M×10" label for a product's size split (quote + row summary).
  const sizeLabel = (id: string) => {
    const row = sizeMatrix[id]
    if (!row) return ""
    return SIZES.filter(s => (row[s] ?? 0) > 0)
      .map(s => `${s}×${row[s]}`)
      .join("  ")
  }

  const openQuote = () => {
    const now = new Date()
    setQuoteRef(`SPQ-${now.getFullYear()}-${String(now.getTime() % 100000).padStart(5, "0")}`)
    setQuoteDate(now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))
    setQuoteCopied(false)
    setQuoteOpen(true)
  }

  const buildQuoteText = () => {
    const lines: string[] = [
      `Spreadshirt embroidery quote ${quoteRef}`,
      `Date: ${quoteDate}`,
      "",
    ]
    rows.forEach(r => {
      lines.push(`${r.qty}× ${r.tile.brand} ${r.tile.name} — ${eur(r.tile.priceValue * r.qty)}`)
      const sl = sizeLabel(r.tile.id)
      if (sl) lines.push(`   Sizes: ${sl}`)
    })
    lines.push("")
    lines.push(`Subtotal: ${eur(grandTotal)}`)
    if (discountPct > 0)
      lines.push(`Volume discount (−${Math.round(discountPct * 100)}%): −${eur(discountAmount)}`)
    lines.push(`Embroidery (${totalPieces} pcs): ${eur(embroideryCost)}`)
    lines.push(`${shippingOption.label} shipping: ${eur(shippingCost)}`)
    lines.push(`Estimated delivery: ${delivery.fromLabel} – ${delivery.toLabel}`)
    lines.push(`Total: ${eur(finalTotal)}`)
    return lines.join("\n")
  }

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(buildQuoteText())
      setQuoteCopied(true)
      setTimeout(() => setQuoteCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={cn("mx-auto w-full", empty ? "max-w-[500px]" : "max-w-[1200px]")}>
      <h2 className={cn("font-display text-2xl font-[900] text-black", empty && "text-center")}>
        CALCULATE PRICE
      </h2>

      <div className="mt-6 border-2 border-neutral-200 p-6">
        <div className={cn("flex gap-3", empty ? "justify-center" : "flex-col sm:flex-row sm:items-center sm:justify-between")}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex w-full cursor-pointer items-center gap-4 border-2 border-dashed border-neutral-300 px-4 py-4 text-black transition-colors hover:border-neutral-500 sm:w-fit sm:px-6 sm:py-5"
        >
          <svg viewBox="0 0 20 20" fill="none" className="size-10 shrink-0" aria-hidden>
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10.8277 4.06952C10.7796 3.65507 10.4273 3.33337 9.99998 3.33337C9.53974 3.33337 9.16665 3.70647 9.16665 4.16671V9.16671H4.16665L4.06946 9.17231C3.65501 9.22045 3.33331 9.57268 3.33331 10C3.33331 10.4603 3.70641 10.8334 4.16665 10.8334H9.16665V15.8334L9.17225 15.9306C9.22039 16.345 9.57262 16.6667 9.99998 16.6667C10.4602 16.6667 10.8333 16.2936 10.8333 15.8334V10.8334H15.8333L15.9305 10.8278C16.3449 10.7796 16.6666 10.4274 16.6666 10C16.6666 9.5398 16.2935 9.16671 15.8333 9.16671H10.8333V4.16671L10.8277 4.06952Z"
              fill="currentColor"
            />
          </svg>
          <span className="font-display text-left text-lg font-[900] leading-tight">
            {empty ? (
              <>
                CHOOSE
                <br />
                PRODUCTS
              </>
            ) : (
              <>
                ADD MORE
                <br />
                PRODUCTS
              </>
            )}
          </span>
        </button>

          {!empty && (
            <button
              type="button"
              onClick={clearAll}
              className="shrink-0 cursor-pointer border-2 border-black px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:border-transparent hover:bg-neutral-900 hover:text-white"
            >
              Clear all selection
            </button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="mt-6 border-t border-neutral-200">
            {rows.map(({ tile, qty }) => (
              <div
                key={tile.id}
                className="border-b border-neutral-200 py-4 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-14 w-14 shrink-0 overflow-hidden bg-neutral-100">
                      <img src={tile.image} alt="" className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-black">{tile.brand}</p>
                      <p className="truncate text-sm text-neutral-700">{tile.name}</p>
                      <p className="mt-0.5 text-sm font-medium text-neutral-500">{tile.price}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-5">
                    {sizeOpen[tile.id] ? (
                      <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700">
                        {qty} {qty === 1 ? "pc" : "pcs"}
                        <button
                          type="button"
                          onClick={() => removeRow(tile.id)}
                          aria-label="Remove product"
                          className="cursor-pointer text-neutral-400 hover:text-neutral-700"
                        >
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                        </button>
                      </span>
                    ) : (
                      <QuantitySelector
                        quantity={qty}
                        onChange={q => setRowQty(tile.id, q)}
                        onDelete={() => removeRow(tile.id)}
                      />
                    )}
                    <span className="w-20 text-right text-base font-bold whitespace-nowrap text-black sm:w-24">
                      {eur(tile.priceValue * qty)}
                    </span>
                  </div>
                </div>

                {/* Size / quantity matrix */}
                <div className="mt-2 sm:pl-[72px]">
                  <button
                    type="button"
                    onClick={() => toggleSize(tile.id)}
                    className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    <svg viewBox="0 0 24 24" className={cn("size-4 transition-transform", sizeOpen[tile.id] && "rotate-90")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                    {sizeOpen[tile.id] ? "Hide size breakdown" : "Add size breakdown"}
                  </button>
                  {sizeOpen[tile.id] && (
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-7">
                      {SIZES.map(sz => {
                        const q = sizeMatrix[tile.id]?.[sz] ?? 0
                        return (
                          <div
                            key={sz}
                            className={cn(
                              "flex min-w-0 flex-col items-center rounded-lg border px-1 py-1.5",
                              q > 0 ? "border-indigo-300 bg-indigo-50/50" : "border-neutral-200"
                            )}
                          >
                            <span className="text-xs font-bold text-neutral-600">{sz}</span>
                            <div className="mt-1 flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => setSize(tile.id, sz, q - 1)}
                                aria-label={`Decrease ${sz}`}
                                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
                                disabled={q === 0}
                              >
                                −
                              </button>
                              <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums">{q}</span>
                              <button
                                type="button"
                                onClick={() => setSize(tile.id, sz, q + 1)}
                                aria-label={`Increase ${sz}`}
                                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* full-width neutral band holding the breakdown + total */}
        <div className="-mx-6 -mb-6 mt-6 bg-neutral-100 px-6 py-4">
          {rows.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="font-semibold text-black">
                {totalPieces} {totalPieces === 1 ? "piece" : "pieces"} total
              </span>
              <span className="text-base font-bold whitespace-nowrap text-black">
                {eur(grandTotal)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <button
              type="button"
              onClick={() => setDiscountInfoOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 font-semibold text-[#DC2626]"
            >
              <span className="underline underline-offset-2">
                Volume discount{discountPct > 0 ? ` (−${Math.round(discountPct * 100)}%)` : ""}
              </span>
              <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0" aria-hidden>
                <path
                  d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM12 11C12.5128 11 12.9354 11.3865 12.9932 11.8838L13 12V15L13.1162 15.0068C13.5753 15.0602 13.9398 15.4247 13.9932 15.8838L14 16C14 16.5128 13.6136 16.9354 13.1162 16.9932L13 17H12C11.4872 17 11.0646 16.6136 11.0068 16.1162L11 16V13C10.4477 13 10 12.5523 10 12C10 11.4872 10.3865 11.0646 10.8838 11.0068L11 11H12ZM12.0098 7C12.562 7 13.0098 7.44772 13.0098 8C13.0098 8.51272 12.6241 8.93525 12.127 8.99316L12 9C11.4477 9 11 8.55228 11 8C11 7.48716 11.3865 7.0646 11.8838 7.00684L12.0098 7Z"
                  fill="currentColor"
                />
              </svg>
            </button>
            <span className="text-base font-bold whitespace-nowrap text-[#DC2626]">
              {discountPct > 0 ? `−${eur(discountAmount)}` : eur(0)}
            </span>
          </div>

          {totalPieces > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="font-semibold text-black">
                Your design embroidered (on {totalPieces} {totalPieces === 1 ? "piece" : "pieces"})
              </span>
              <span className="text-base font-bold whitespace-nowrap text-black">
                {eur(embroideryCost)}
              </span>
            </div>
          )}

          {totalPieces > 0 && (
            <div className="flex items-center justify-between py-2">
              <Popover.Root open={shippingOpen} onOpenChange={setShippingOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center gap-1 font-semibold text-black"
                  >
                    {shippingOption.label} shipping
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className={cn(
                        "size-4 transition-transform duration-200",
                        shippingOpen && "rotate-180"
                      )}
                      aria-hidden
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="start"
                    sideOffset={8}
                    className="z-[100] w-72 border border-neutral-200 bg-white shadow-lg outline-none"
                  >
                    {SHIPPING_OPTIONS.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setShippingId(o.id)
                          setShippingOpen(false)
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50",
                          o.id === shippingId && "bg-neutral-100"
                        )}
                      >
                        <span>
                          <span className={cn("block font-semibold", o.color)}>{o.label}</span>
                          <span className="block text-sm text-neutral-500">
                            {o.minDays}–{o.maxDays} days
                          </span>
                        </span>
                        <span className="font-bold whitespace-nowrap text-black">{eur(o.price)}</span>
                      </button>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <span className="text-base font-bold whitespace-nowrap text-black">
                {eur(shippingCost)}
              </span>
            </div>
          )}

          {totalPieces > 0 && (
            <div className="mt-1 flex items-center gap-2 border-t border-neutral-200 py-3">
              <svg className="size-5 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span className="text-sm text-neutral-700">
                Estimated delivery{" "}
                <span className="font-semibold text-black">
                  {delivery.fromLabel} – {delivery.toLabel}
                </span>{" "}
                with {shippingOption.label.toLowerCase()} shipping
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="text-lg font-bold text-black">Total</span>
            <div className="text-right">
              <span className="font-display text-3xl font-[900] text-black">
                {eur(finalTotal)}
              </span>
              {rows.length === 1 && totalPieces > 1 && (
                <p className="mt-1 text-md text-neutral-600">({eur(perPiece)} per piece)</p>
              )}
            </div>
          </div>

          {totalPieces > 0 && (
            <button
              type="button"
              onClick={openQuote}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 border-2 border-black py-3 text-sm font-semibold text-black transition-colors hover:bg-neutral-900 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
              Save &amp; share quote
            </button>
          )}
        </div>
      </div>

      <MultiProductSelectDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        tiles={tiles}
        selected={selection}
        onSelectedChange={setSelection}
      />

      <VolumeDiscountDialog open={discountInfoOpen} onOpenChange={setDiscountInfoOpen} />

      {/* Quote summary — a shareable, procurement-friendly snapshot of the order. */}
      {quoteOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setQuoteOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-neutral-200 px-6 py-5">
              <div>
                <h3 className="font-display text-xl font-[900] text-black">YOUR QUOTE</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Ref <span className="font-semibold text-black">{quoteRef}</span> · {quoteDate}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setQuoteOpen(false)}
                className="cursor-pointer text-neutral-400 hover:text-neutral-700"
              >
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {rows.map(({ tile, qty }) => (
                <div key={tile.id} className="flex justify-between gap-4 border-b border-neutral-100 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-black">
                      {qty}× {tile.brand} {tile.name}
                    </p>
                    {sizeLabel(tile.id) && (
                      <p className="mt-0.5 text-sm text-neutral-500">Sizes: {sizeLabel(tile.id)}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-bold whitespace-nowrap text-black">
                    {eur(tile.priceValue * qty)}
                  </span>
                </div>
              ))}

              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Subtotal</dt>
                  <dd className="font-medium text-black">{eur(grandTotal)}</dd>
                </div>
                {discountPct > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-[#DC2626]">Volume discount (−{Math.round(discountPct * 100)}%)</dt>
                    <dd className="font-medium text-[#DC2626]">−{eur(discountAmount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Embroidery ({totalPieces} pcs)</dt>
                  <dd className="font-medium text-black">{eur(embroideryCost)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-600">{shippingOption.label} shipping</dt>
                  <dd className="font-medium text-black">{eur(shippingCost)}</dd>
                </div>
                <div className="flex justify-between border-t border-neutral-200 pt-2 text-base">
                  <dt className="font-bold text-black">Total</dt>
                  <dd className="font-display font-[900] text-black">{eur(finalTotal)}</dd>
                </div>
              </dl>

              <p className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                <svg className="size-4 shrink-0 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Estimated delivery{" "}
                <span className="font-semibold text-black">
                  {delivery.fromLabel} – {delivery.toLabel}
                </span>
              </p>
              <p className="mt-3 text-xs text-neutral-500">
                Indicative quote based on current pricing and capacity. VAT shown
                at checkout. Valid for 14 days.
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-neutral-200 px-6 py-4 sm:flex-row">
              <button
                type="button"
                onClick={copyQuote}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 border-2 border-black py-3 text-sm font-semibold text-black transition-colors hover:bg-neutral-900 hover:text-white"
              >
                {quoteCopied ? "Copied!" : "Copy quote"}
              </button>
              <button
                type="button"
                onClick={() => setQuoteOpen(false)}
                className="flex-1 cursor-pointer bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
