"use client"

import { useState } from "react"

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

// Selection (productId -> quantity) is shared with the drawer so both stay in sync.
export default function PriceCalculator({ tiles }: { tiles: ProductTileData[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [discountInfoOpen, setDiscountInfoOpen] = useState(false)
  const [shippingOpen, setShippingOpen] = useState(false)
  const [shippingId, setShippingId] = useState<ShippingId>("standard")
  const [selection, setSelection] = useState<Selection>({})

  const shippingOption =
    SHIPPING_OPTIONS.find(o => o.id === shippingId) ?? SHIPPING_OPTIONS[0]

  const setRowQty = (id: string, qty: number) => setSelection(prev => ({ ...prev, [id]: qty }))

  const removeRow = (id: string) =>
    setSelection(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })

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

  return (
    <div className={cn("mx-auto w-full", empty ? "max-w-[500px]" : "max-w-[1200px]")}>
      <h2 className={cn("font-display text-2xl font-[900] text-black", empty && "text-center")}>
        CALCULATE PRICE
      </h2>

      <div className="mt-6 border-2 border-neutral-200 p-6">
        <div className={cn("flex items-center", empty ? "justify-center" : "justify-between")}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex w-fit cursor-pointer items-center gap-4 border-2 border-dashed border-neutral-300 px-6 py-5 text-black transition-colors hover:border-neutral-500"
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
              onClick={() => setSelection({})}
              className="cursor-pointer border-2 border-black px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:border-transparent hover:bg-neutral-900 hover:text-white"
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
                className="flex items-center justify-between gap-4 border-b border-neutral-200 py-4 last:border-b-0"
              >
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
                <div className="flex shrink-0 items-center gap-5">
                  <QuantitySelector
                    quantity={qty}
                    onChange={q => setRowQty(tile.id, q)}
                    onDelete={() => removeRow(tile.id)}
                  />
                  <span className="w-24 text-right text-base font-bold whitespace-nowrap text-black">
                    {eur(tile.priceValue * qty)}
                  </span>
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
    </div>
  )
}
