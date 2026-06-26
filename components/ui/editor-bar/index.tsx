"use client"

import { WedgeSlider } from "./WedgeSlider"

type EditorBarProps = {
  show: boolean
  fontSize: number
  fontFamily: string
  color: string
  maxFontSize?: number
  onFontSizeChange: (next: number) => void
  onFontFamilyClick: () => void
  onColorClick: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}

const MIN_FONT_SIZE = 14
const ABS_MAX_FONT_SIZE = 320

export function EditorBar({
  show,
  fontSize,
  fontFamily,
  color,
  maxFontSize = ABS_MAX_FONT_SIZE,
  onFontSizeChange,
  onFontFamilyClick,
  onColorClick,
  onDuplicate,
  onDelete,
}: EditorBarProps) {
  if (!show) return null
  const max = Math.max(MIN_FONT_SIZE, Math.min(ABS_MAX_FONT_SIZE, Math.floor(maxFontSize)))
  const clamp = (n: number) => Math.max(MIN_FONT_SIZE, Math.min(max, Math.round(n)))

  return (
    <div
      data-editor-bar="true"
      className="shadow-xs absolute top-8 left-1/2 z-[5] flex h-[48px] -translate-x-1/2 items-center overflow-hidden rounded-full bg-white"
    >
      <div className="flex h-full min-w-0 items-center gap-2 px-1.5 py-1.5">
        {/* Font family */}
        <button
          type="button"
          aria-label="Font family"
          title={fontFamily}
          onClick={onFontFamilyClick}
          className="flex h-9 max-w-[100px] min-w-[100px] cursor-pointer items-center justify-start truncate rounded-md rounded-l-[24px] px-2 text-left text-[12px] font-semibold hover:bg-neutral-100"
        >
          {fontFamily}
        </button>

        {/* divider */}
        <div className="bg-neutral-200 -my-1.5 w-px self-stretch" />

        {/* Font size: decrease */}
        <button
          type="button"
          aria-label="Decrease font size"
          onClick={() => onFontSizeChange(clamp(fontSize - 1))}
          className="group/dec relative flex h-9 cursor-pointer items-center rounded-md px-2 hover:bg-neutral-100"
        >
          <span className="text-[10px] font-semibold group-hover/dec:opacity-0">Small</span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover/dec:opacity-100">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.8333 9.16663C16.2935 9.16663 16.6666 9.53972 16.6666 9.99996C16.6666 10.4273 16.3449 10.7795 15.9305 10.8277L15.8333 10.8333H4.16665C3.70641 10.8333 3.33331 10.4602 3.33331 9.99996C3.33331 9.5726 3.65501 9.22037 4.06946 9.17223L4.16665 9.16663H15.8333Z"
              />
            </svg>
          </span>
        </button>

        {/* Font size slider */}
        <WedgeSlider
          min={MIN_FONT_SIZE}
          max={max}
          value={Math.min(fontSize, max)}
          onChange={v => onFontSizeChange(clamp(v))}
        />

        {/* Font size: increase */}
        <button
          type="button"
          aria-label="Increase font size"
          onClick={() => onFontSizeChange(clamp(fontSize + 1))}
          className="group/inc relative flex h-9 cursor-pointer items-center rounded-md px-2 hover:bg-neutral-100"
        >
          <span className="text-sm font-semibold group-hover/inc:opacity-0">Large</span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover/inc:opacity-100">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.8277 4.06952C10.7796 3.65507 10.4273 3.33337 9.99998 3.33337C9.53974 3.33337 9.16665 3.70647 9.16665 4.16671V9.16671H4.16665L4.06946 9.17231C3.65501 9.22045 3.33331 9.57268 3.33331 10C3.33331 10.4603 3.70641 10.8334 4.16665 10.8334H9.16665V15.8334L9.17225 15.9306C9.22039 16.345 9.57262 16.6667 9.99998 16.6667C10.4602 16.6667 10.8333 16.2936 10.8333 15.8334V10.8334H15.8333L15.9305 10.8278C16.3449 10.7796 16.6666 10.4274 16.6666 10C16.6666 9.5398 16.2935 9.16671 15.8333 9.16671H10.8333V4.16671L10.8277 4.06952Z"
              />
            </svg>
          </span>
        </button>

        {/* divider */}
        <div className="bg-neutral-200 -my-1.5 w-px self-stretch" />

        {/* Color */}
        <button
          type="button"
          aria-label="Text color"
          onClick={onColorClick}
          className="flex h-9 items-center gap-2 cursor-pointer rounded-md px-2 hover:bg-neutral-100"
        >
          <span
            aria-hidden="true"
            className="inline-block h-5 w-5 rounded-full border border-neutral-300"
            style={{ backgroundColor: color }}
          />
          <span className="text-[12px] font-semibold">Color</span>
        </button>

        {/* divider */}
        <div className="bg-neutral-200 -my-1.5 w-px self-stretch" />

        {/* Duplicate */}
        <button
          type="button"
          aria-label="Duplicate text"
          onClick={onDuplicate}
          className="flex h-9 w-9 items-center justify-center cursor-pointer rounded-md hover:bg-neutral-100"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M9.33691 2C10.4019 2 11.273 2.83212 11.334 3.88184L11.3369 4V4.66602H12.0059C13.1101 4.66618 14.0055 5.56183 14.0059 6.66602V12C14.0057 13.1043 13.1102 13.9998 12.0059 14H6.67188C5.56774 13.9996 4.67206 13.1042 4.67188 12V11.333H4.00391C2.93879 11.333 2.06767 10.5001 2.00684 9.4502L2.00391 9.33301V4C2.00391 2.93501 2.83605 2.06395 3.88574 2.00293L4.00391 2H9.33691ZM6.6709 6C6.30297 6.00019 6.00407 6.29906 6.00391 6.66699V12C6.00391 12.3681 6.30287 12.6668 6.6709 12.667H12.0039C12.3721 12.667 12.6709 12.3682 12.6709 12V6.66699C12.6707 6.29894 12.372 6 12.0039 6H6.6709ZM4.00391 3.33301C3.66206 3.33301 3.38036 3.59037 3.3418 3.92188L3.33691 4V9.33301C3.33691 9.67485 3.59428 9.95655 3.92578 9.99512L4.00391 10H4.67188V6.66602C4.6722 5.56196 5.56783 4.66639 6.67188 4.66602H10.0039V4C10.0039 3.65823 9.74643 3.37656 9.41504 3.33789L9.33691 3.33301H4.00391Z"
              fill="currentColor"
            />
          </svg>
        </button>

        {/* Delete */}
        <button
          type="button"
          aria-label="Delete text"
          onClick={onDelete}
          className="-ml-1.5 flex h-9 w-9 items-center justify-center cursor-pointer rounded-md rounded-r-[24px] text-[#DC2626] hover:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.9945 3.85074C15.9182 2.81588 15.0544 2 14 2H10L9.85074 2.00549C8.81588 2.08183 8 2.94564 8 4V6H5.01169H4.99054H4L3.88338 6.00673C3.38604 6.06449 3 6.48716 3 7C3 7.55228 3.44772 8 4 8H4.07987L5.00345 19.083L5.00819 19.2507C5.09634 20.7511 6.40232 22 8 22H16L16.1763 21.9949C17.7511 21.9037 19 20.5977 19 19L19.9199 8H20L20.1166 7.99327C20.614 7.93551 21 7.51284 21 7C21 6.44772 20.5523 6 20 6H16V4L15.9945 3.85074ZM14 6V4H10V6H14ZM9 8H6.08649L7 19C7 19.5128 7.38604 19.9355 7.88338 19.9933L8 20H16C16.5155 20 16.9398 19.61 16.9969 19.0414L17.0035 18.917L17.9132 8H15H9ZM10 10C10.5128 10 10.9355 10.386 10.9933 10.8834L11 11V17C11 17.5523 10.5523 18 10 18C9.48716 18 9.06449 17.614 9.00673 17.1166L9 17V11C9 10.4477 9.44772 10 10 10ZM14.9933 10.8834C14.9355 10.386 14.5128 10 14 10C13.4477 10 13 10.4477 13 11V17L13.0067 17.1166C13.0645 17.614 13.4872 18 14 18C14.5523 18 15 17.5523 15 17V11L14.9933 10.8834Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
