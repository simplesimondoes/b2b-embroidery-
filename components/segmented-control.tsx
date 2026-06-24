"use client"

import { cn } from "@/lib/utils"

type SegmentedControlProps = {
  items: string[]
  active: number
  onChange: (index: number) => void
}

export default function SegmentedControl({ items, active, onChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 bg-neutral-100 p-2">
      {items.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(i)}
          aria-pressed={active === i}
          className={cn(
            "cursor-pointer px-5 py-2.5 text-base font-semibold transition-[background-color,box-shadow] duration-200 ease-in-out",
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
