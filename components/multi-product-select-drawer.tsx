"use client"

import { Drawer } from "vaul"

import Checkbox from "@/components/checkbox"
import ProductTile, { type ProductTileData } from "@/components/product-tile"
import QuantitySelector from "@/components/quantity-selector"

// productId -> quantity, shared with the parent so the list and the drawer
// always stay in sync.
export type Selection = Record<string, number>

type MultiProductSelectDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tiles: ProductTileData[]
  selected: Selection
  onSelectedChange: (next: Selection) => void
}

export default function MultiProductSelectDrawer({
  open,
  onOpenChange,
  tiles,
  selected,
  onSelectedChange,
}: MultiProductSelectDrawerProps) {
  const anySelected = Object.keys(selected).length > 0

  const toggle = (id: string) => {
    const next = { ...selected }
    if (id in next) delete next[id]
    else next[id] = 1
    onSelectedChange(next)
  }

  const setQty = (id: string, qty: number) => onSelectedChange({ ...selected, [id]: qty })

  const byId = new Map(tiles.map(t => [t.id, t]))
  const totalPieces = Object.values(selected).reduce((a, b) => a + b, 0)
  const totalPrice = Object.entries(selected).reduce(
    (sum, [id, qty]) => sum + (byId.get(id)?.priceValue ?? 0) * qty,
    0
  )
  const eur = (n: number) => n.toFixed(2).replace(".", ",") + " €"

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[9998] bg-black/40" />
        <Drawer.Content className="fixed right-0 bottom-0 left-0 z-[9999] flex h-[calc(100dvh-32px)] flex-col rounded-t-2xl bg-white outline-none">
          <Drawer.Title className="sr-only">Select products and quantities</Drawer.Title>
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-3 px-4 pt-5 pb-4 sm:px-6">
            <span className="font-display text-[16px] font-medium text-black">
              Select products and quantities
            </span>
            {/* fixed-height control area prevents layout shift between X and buttons */}
            <div className="flex items-center justify-end sm:h-11">
            {anySelected ? (
              <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                <span className="text-sm text-black sm:text-base">
                  {totalPieces} {totalPieces === 1 ? "piece" : "pieces"} in total ={" "}
                  <span className="font-bold">{eur(totalPrice)}</span>
                </span>
                {/* secondary (kit ghost) */}
                <button
                  type="button"
                  onClick={() => onSelectedChange({})}
                  className="cursor-pointer border-2 border-black px-3 py-2 text-sm font-semibold text-black transition-colors hover:border-transparent hover:bg-neutral-900 hover:text-white sm:px-5 sm:py-2.5"
                >
                  Clear all selection
                </button>
                {/* primary */}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="cursor-pointer bg-black px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 sm:px-5 sm:py-2.5"
                >
                  Show full calculation
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer"
              >
                <img src="/icons/icon-close-x.svg" alt="" className="h-6 w-6" />
              </button>
            )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map(t => {
                const checked = t.id in selected
                return (
                  <div
                    key={t.id}
                    onClick={() => toggle(t.id)}
                    className="cursor-pointer"
                  >
                    <ProductTile
                      t={t}
                      selected={checked}
                      quantity={checked ? selected[t.id] : undefined}
                      topLeft={
                        <span onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onChange={() => toggle(t.id)}
                            label={t.name}
                          />
                        </span>
                      }
                      bottomCenter={
                        checked ? (
                          <div
                            className="flex justify-center bg-black py-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <QuantitySelector
                              quantity={selected[t.id]}
                              onChange={q => setQty(t.id, q)}
                              onDelete={() => toggle(t.id)}
                            />
                          </div>
                        ) : undefined
                      }
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
