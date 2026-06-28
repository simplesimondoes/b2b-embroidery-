"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

// Polo Shirt PREPSTER — the hero product for the embroidery journey.
const POLO_PRODUCT_ID = "2116"
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
// Below this (longest edge, px) a raster logo tends to stitch fuzzy. SVGs are
// vector, so they're always fine.
const MIN_RASTER_EDGE = 600

export default function UploadLogoButton() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A low-res file the user can still choose to use. Held until they confirm.
  const [lowResSrc, setLowResSrc] = useState<string | null>(null)

  function pick() {
    setError(null)
    setLowResSrc(null)
    inputRef.current?.click()
  }

  function goToDesigner(dataUrl: string) {
    try {
      sessionStorage.setItem("uploadedLogo", dataUrl)
    } catch {
      setBusy(false)
      setError("Couldn't process that file. Please try a smaller image.")
      return
    }
    router.push(`/?product=${POLO_PRODUCT_ID}`)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file later
    if (!file) return
    setError(null)
    setLowResSrc(null)
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file — PNG, JPG or SVG.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError("That file is over 10 MB — please choose a smaller image.")
      return
    }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      // SVGs are vector — no resolution check needed.
      if (file.type === "image/svg+xml") {
        goToDesigner(dataUrl)
        return
      }
      // Raster: check the resolution before committing.
      const img = new window.Image()
      img.onload = () => {
        const longestEdge = Math.max(img.naturalWidth, img.naturalHeight)
        if (longestEdge < MIN_RASTER_EDGE) {
          setBusy(false)
          setLowResSrc(dataUrl) // offer "use anyway"
          return
        }
        goToDesigner(dataUrl)
      }
      img.onerror = () => {
        setBusy(false)
        setError("Couldn't read that image. Please try another file.")
      }
      img.src = dataUrl
    }
    reader.onerror = () => {
      setBusy(false)
      setError("Couldn't read that file. Please try again.")
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="hidden"
        onChange={onFile}
      />

      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className="inline-flex h-12 w-fit cursor-pointer items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-[background-position] duration-500 ease-in-out [background-position:0_0] [background-size:200%_100%] hover:[background-position:100%_0] disabled:cursor-wait disabled:opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #dc2626 0%, #4d52d2 30%, #149744 50%, #10843b 65%, #4d52d2 80%, #dc2626 100%)",
        }}
      >
        {busy ? (
          <>
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Opening designer…
          </>
        ) : (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload logo
          </>
        )}
      </button>

      {/* Guidance — vector/transparent art stitches cleanest. */}
      <p className="text-xs font-medium text-white/90 drop-shadow">
        See it embroidered on a polo in seconds. For the cleanest stitch, use a
        vector (SVG) or a PNG with a transparent background.
      </p>

      {error && (
        <p className="rounded-md bg-red-600/90 px-3 py-2 text-xs font-semibold text-white">
          {error}
        </p>
      )}

      {lowResSrc && (
        <div className="w-full rounded-lg bg-white/95 p-3 text-left shadow-lg">
          <p className="text-xs font-semibold text-neutral-900">
            This logo looks low-resolution
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            It may appear soft or pixelated when embroidered. For best results,
            upload a larger image or a vector (SVG).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setBusy(true)
                goToDesigner(lowResSrc)
              }}
              className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-700"
            >
              Use it anyway
            </button>
            <button
              type="button"
              onClick={pick}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100"
            >
              Choose another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
