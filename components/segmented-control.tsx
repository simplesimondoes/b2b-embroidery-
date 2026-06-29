"use client"

import { cn } from "@/lib/utils"

type SegmentedControlProps = {
  items: string[]
  active: number
  onChange: (index: number) => void
  stuck?: boolean
}

export default function SegmentedControl({
  items,
  active,
  onChange,
  stuck = false,
}: SegmentedControlProps) {
  return (
    <div
      className={cn(
        "inline-flex max-w-full flex-wrap items-center justify-center gap-1 p-1.5 transition-colors duration-200 sm:p-2",
        // kit has no neutral-150 (jumps 100 #f4f4f4 → 200 #dedede); use the midpoint
        stuck ? "bg-[#e9e9e9]" : "bg-neutral-100"
      )}
    >
      {items.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(i)}
          aria-pressed={active === i}
          className={cn(
            "cursor-pointer px-3 py-2 text-sm font-semibold transition-[background-color,box-shadow] duration-200 ease-in-out sm:px-5 sm:py-2.5 sm:text-base",
            active === i
              ? "bg-white text-black shadow-sm"
              : "bg-transparent text-neutral-800 hover:text-black"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
