type GraphicEditorBarProps = {
  show: boolean
  onDuplicate: () => void
  onDelete: () => void
}

// Minimal editor bar for selected graphics/uploads: duplicate + delete, in the
// same rounded pill style as the text EditorBar.
export function GraphicEditorBar({ show, onDuplicate, onDelete }: GraphicEditorBarProps) {
  if (!show) return null

  return (
    <div
      data-editor-bar="true"
      className="shadow-xs absolute top-8 left-1/2 z-[5] flex h-[48px] -translate-x-1/2 items-center overflow-hidden rounded-full bg-white"
    >
      <div className="flex h-full items-center gap-1 px-2">
        {/* Duplicate */}
        <button
          type="button"
          aria-label="Duplicate"
          onClick={onDuplicate}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 hover:bg-neutral-100"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M9.33691 2C10.4019 2 11.273 2.83212 11.334 3.88184L11.3369 4V4.66602H12.0059C13.1101 4.66618 14.0055 5.56183 14.0059 6.66602V12C14.0057 13.1043 13.1102 13.9998 12.0059 14H6.67188C5.56774 13.9996 4.67206 13.1042 4.67188 12V11.333H4.00391C2.93879 11.333 2.06767 10.5001 2.00684 9.4502L2.00391 9.33301V4C2.00391 2.93501 2.83605 2.06395 3.88574 2.00293L4.00391 2H9.33691ZM6.6709 6C6.30297 6.00019 6.00407 6.29906 6.00391 6.66699V12C6.00391 12.3681 6.30287 12.6668 6.6709 12.667H12.0039C12.3721 12.667 12.6709 12.3682 12.6709 12V6.66699C12.6707 6.29894 12.372 6 12.0039 6H6.6709ZM4.00391 3.33301C3.66206 3.33301 3.38036 3.59037 3.3418 3.92188L3.33691 4V9.33301C3.33691 9.67485 3.59428 9.95655 3.92578 9.99512L4.00391 10H4.67188V6.66602C4.6722 5.56196 5.56783 4.66639 6.67188 4.66602H10.0039V4C10.0039 3.65823 9.74643 3.37656 9.41504 3.33789L9.33691 3.33301H4.00391Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[12px] font-semibold">Duplicate</span>
        </button>

        {/* divider */}
        <div className="bg-neutral-200 -my-1.5 w-px self-stretch" />

        {/* Delete */}
        <button
          type="button"
          aria-label="Delete"
          onClick={onDelete}
          className="flex h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[#DC2626] hover:bg-neutral-100"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.9945 3.85074C15.9182 2.81588 15.0544 2 14 2H10L9.85074 2.00549C8.81588 2.08183 8 2.94564 8 4V6H5.01169H4.99054H4L3.88338 6.00673C3.38604 6.06449 3 6.48716 3 7C3 7.55228 3.44772 8 4 8H4.07987L5.00345 19.083L5.00819 19.2507C5.09634 20.7511 6.40232 22 8 22H16L16.1763 21.9949C17.7511 21.9037 19 20.5977 19 19L19.9199 8H20L20.1166 7.99327C20.614 7.93551 21 7.51284 21 7C21 6.44772 20.5523 6 20 6H16V4L15.9945 3.85074ZM14 6V4H10V6H14ZM9 8H6.08649L7 19C7 19.5128 7.38604 19.9355 7.88338 19.9933L8 20H16C16.5155 20 16.9398 19.61 16.9969 19.0414L17.0035 18.917L17.9132 8H15H9ZM10 10C10.5128 10 10.9355 10.386 10.9933 10.8834L11 11V17C11 17.5523 10.5523 18 10 18C9.48716 18 9.06449 17.614 9.00673 17.1166L9 17V11C9 10.4477 9.44772 10 10 10ZM14.9933 10.8834C14.9355 10.386 14.5128 10 14 10C13.4477 10 13 10.4477 13 11V17L13.0067 17.1166C13.0645 17.614 13.4872 18 14 18C14.5523 18 15 17.5523 15 17V11L14.9933 10.8834Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[12px] font-semibold">Delete</span>
        </button>
      </div>
    </div>
  )
}
