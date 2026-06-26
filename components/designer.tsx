"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import * as Popover from "@radix-ui/react-popover"
import { Basket, type BasketItem } from "@/components/basket"
import EmbroideryPreview from "@/components/embroidery-preview"
import ProductsDrawer, { type SelectedProduct } from "@/components/products-drawer"
import { allTiles } from "@/lib/tiles"
import SiteHeader from "@/components/site-header"
import { IconsScroller } from "@/components/ui/icons-scroller"
import { EditorBar } from "@/components/ui/editor-bar"
import { GraphicEditorBar } from "@/components/ui/editor-bar/GraphicEditorBar"
import { WedgeSlider } from "@/components/ui/editor-bar/WedgeSlider"
import {
  ScopedDialog,
  ScopedDialogClose,
  ScopedDialogTitle,
} from "@/components/ui/scoped-dialog"
import { FontPanel } from "@/components/ui/font-panel/FontPanel"
import { TextColorPanel } from "@/components/ui/text-color-panel/TextColorPanel"
import { UploadPanel } from "@/components/ui/upload-panel/UploadPanel"
import {
  buildOutOfStockMap,
  getPrintAreaOverlay,
  getProductType,
  type ProductTypeData,
} from "@/lib/spreadshirt"

/**
 * Changes made (minimal):
 * - #size-buttons-row now WRAPS (no horizontal scroll)
 * - Removed ALL size-row scroll logic (rowRef, canScrollLeft/Right, observers, arrows, fades, scrollByPx)
 * - Dropdown/tooltip repositioning no longer listens to #size-buttons-row scroll (keeps window scroll/resize)
 * - ✅ Kept ALL SVG syntax exactly as-is
 * - ✅ Kept the plus icon inside size buttons
 * - ✅ Kept "30-Day easy returns" and Shipping rows in place
 */

type DesignerPanel = "graphics" | "uploads" | "ai"

const DEFAULT_PRODUCT_ID = "2116" // Stanley/Stella Unisex Organic Polo Shirt PREPSTER

// Monotonic unique id — Date.now() alone collides when two elements are created
// in the same millisecond (e.g. uploading/placing several at once).
let uidCounter = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(uidCounter++).toString(36)}`

// Treat a product color as "dark" only when very close to black.
// Returns true only for near-black colors (e.g., #1A1A1A, #2F3031), so non-dark
// hues (red, blue, etc.) get black text and white products get black text.
const isDarkProductColor = (hex?: string): boolean => {
  if (!hex) return false
  const h = hex.replace("#", "")
  if (h.length !== 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return false
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness < 80
}

// Embroidery can't stitch arbitrarily large designs. Ported from the dock-change
// prototype: clamp the design to at most 1/7 of the print area (by area),
// anchored to its center. Returns the same bbox if it already fits.
const EMBROIDERY_MAX_AREA_FRACTION = 1 / 7
type DesignBbox = { x: number; y: number; w: number; h: number }
function clampEmbroideryBbox(b: DesignBbox): DesignBbox {
  const area = b.w * b.h
  if (area <= EMBROIDERY_MAX_AREA_FRACTION) return b
  const scale = Math.sqrt(EMBROIDERY_MAX_AREA_FRACTION / area)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const w = b.w * scale
  const h = b.h * scale
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export default function Designer() {
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null)
  const productId = selectedProduct?.id ?? DEFAULT_PRODUCT_ID
  const productData: ProductTypeData | null = useMemo(() => getProductType(productId), [productId])
  const [activeColorIndex, setActiveColorIndex] = useState(0)
  // Canvas zoom (1 = fit, up to 3x) controlled by the slider at the bottom-left.
  // When zoomed in, the canvas area scrolls so different parts of the product
  // can be reached; the controls stay fixed.
  const [zoom, setZoom] = useState(1)
  // Animate the zoom only for the +/- buttons (a discrete step). Continuous
  // gestures (pinch, slider drag) keep it off so they don't feel laggy.
  const [zoomAnimate, setZoomAnimate] = useState(false)
  const canvasScrollRef = useRef<HTMLDivElement>(null)
  // While a pinch is in flight, the zoom anchors on the cursor's content point
  // instead of the design's group centre. Recomputing the group centre on every
  // tick reads object rects that depend on the scroll we just set — a feedback
  // loop that makes the product tremble. Cursor-anchoring has no such loop.
  const pinchAnchorRef = useRef<{
    fracX: number
    fracY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const pinchEndTimerRef = useRef<number | null>(null)
  // Zoom via wheel: a trackpad pinch arrives as a wheel event with ctrlKey set,
  // and the same path covers mouse Ctrl/⌘ + scroll. Plain wheel is left alone so
  // it still pans the canvas. Prevent the browser's page zoom. Needs a
  // non-passive listener so preventDefault is honoured.
  useEffect(() => {
    const el = canvasScrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      // Capture the content point under the cursor so the centering effect can
      // keep it fixed across the zoom (stable; no group-centre feedback loop).
      const rect = el.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top
      pinchAnchorRef.current = {
        fracX: el.scrollWidth ? (el.scrollLeft + offsetX) / el.scrollWidth : 0.5,
        fracY: el.scrollHeight ? (el.scrollTop + offsetY) / el.scrollHeight : 0.5,
        offsetX,
        offsetY,
      }
      if (pinchEndTimerRef.current) window.clearTimeout(pinchEndTimerRef.current)
      pinchEndTimerRef.current = window.setTimeout(() => {
        pinchAnchorRef.current = null
      }, 200)
      setZoomAnimate(false)
      setZoom(z => {
        const next = z * Math.exp(-e.deltaY * 0.01)
        return Math.min(6, Math.max(1, Math.round(next * 100) / 100))
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false)
  // Close the view dropdown when clicking outside of it.
  useEffect(() => {
    if (!viewDropdownOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-view-dropdown]")) setViewDropdownOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [viewDropdownOpen])
  // On zoom, keep the design centered: anchor on the centre of the combined
  // bounding box of all objects in the print area (treat them as one group).
  // Falls back to the product centre when there's no design. Runs in a layout
  // effect so the scroll is set before paint — using useEffect would paint the
  // zoomed product at the old scroll first, then correct it (visible shake).
  useLayoutEffect(() => {
    const el = canvasScrollRef.current
    if (!el) return
    // Predict the zoomed content size rather than reading scrollWidth/Height:
    // during the +/- height transition those are still mid-animation, which
    // would leave the scroll off-centre. Mirrors the inner div's height calc
    // (`calc(60*zoom% + 100*zoom px)`) and aspect-ratio derived width.
    const cw = el.clientWidth
    const ch = el.clientHeight
    const aspect = currentView ? currentView.canvas.width / currentView.canvas.height : 1
    const innerH = 0.6 * zoom * ch + 100 * zoom
    const innerW = innerH * aspect
    const scrollW = Math.max(innerW, cw)
    const scrollH = Math.max(innerH, ch)

    // During a pinch, the cursor's content point is the only thing that drives
    // the scroll — the group-centre logic (which reads object rects that move
    // with the scroll we set, a feedback loop) is ruled out entirely.
    const anchor = pinchAnchorRef.current
    let targetLeft: number
    let targetTop: number
    if (anchor) {
      targetLeft = anchor.fracX * scrollW - anchor.offsetX
      targetTop = anchor.fracY * scrollH - anchor.offsetY
    } else {
      let fx = 0.5
      let fy = 0.5
      const pa = printAreaBoxRef.current
      if (pa && printAreaOverlay) {
        const rects: DOMRect[] = []
        for (const t of visibleTextElements) {
          const n = textElementRefs.current[t.id]
          if (n) rects.push(n.getBoundingClientRect())
        }
        for (const g of visibleGraphicElements) {
          const n = graphicElementRefs.current[g.id]
          if (n) rects.push(n.getBoundingClientRect())
        }
        if (rects.length) {
          const paRect = pa.getBoundingClientRect()
          const minX = Math.min(...rects.map(r => r.left))
          const maxX = Math.max(...rects.map(r => r.right))
          const minY = Math.min(...rects.map(r => r.top))
          const maxY = Math.max(...rects.map(r => r.bottom))
          // group centre as a fraction of the print area, then of the content
          const gcx = paRect.width ? ((minX + maxX) / 2 - paRect.left) / paRect.width : 0.5
          const gcy = paRect.height ? ((minY + maxY) / 2 - paRect.top) / paRect.height : 0.5
          fx = (printAreaOverlay.left + gcx * printAreaOverlay.width) / 100
          fy = (printAreaOverlay.top + gcy * printAreaOverlay.height) / 100
        }
      }
      targetLeft = fx * scrollW - cw / 2
      targetTop = fy * scrollH - ch / 2
    }
    el.scrollTo({
      left: Math.max(0, Math.min(scrollW - cw, targetLeft)),
      top: Math.max(0, Math.min(scrollH - ch, targetTop)),
      // Only the +/- buttons animate; a pinch must land instantly each tick.
      behavior: zoomAnimate && !anchor ? "smooth" : "auto",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])
  const [activeViewId, setActiveViewId] = useState("1")
  const [productsDrawerOpen, setProductsDrawerOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<DesignerPanel | null>(null)
  const [welcomeOpen, setWelcomeOpen] = useState(true)
  // Deep link from the landing page: ?product=<id> loads that product and skips
  // the welcome popup so the user lands straight in the editor.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("product")
    if (!id) return
    const tile = allTiles.find(t => t.id === id)
    if (!tile) return
    setSelectedProduct({
      id: tile.id,
      src: tile.image,
      name: tile.name,
      appearanceId: tile.appearanceId,
    })
    setWelcomeOpen(false)
  }, [])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [sizePopoverOpen, setSizePopoverOpen] = useState(false)
  const sizePopoverScrollRef = useRef<HTMLDivElement | null>(null)
  const [sizePopoverOverflowTop, setSizePopoverOverflowTop] = useState(false)
  const [sizePopoverOverflowBottom, setSizePopoverOverflowBottom] = useState(false)
  const [basketItems, setBasketItems] = useState<BasketItem[]>([])
  const [basketOpen, setBasketOpen] = useState(false)
  const [addingToBasket, setAddingToBasket] = useState(false)
  const ADD_TO_BASKET_DELAY = 2000
  const LOADING_TEXTS = [
    "Getting things ready…",
    "Checking details…",
    "Just a moment…",
    "Wrapping it up…",
    "Getting closer…",
  ]
  const [loadingTextIdx, setLoadingTextIdx] = useState(0)
  useEffect(() => {
    if (!addingToBasket) return
    setLoadingTextIdx(0)
    const interval = setInterval(() => {
      setLoadingTextIdx(i => (i + 1) % LOADING_TEXTS.length)
    }, 900)
    return () => clearInterval(interval)
  }, [addingToBasket])
  const [flashSize, setFlashSize] = useState(false)

  // Text elements placed inside a specific print area. Positions are % of that print area.
  type TextElement = {
    id: string
    printAreaId: string
    content: string
    x: number
    y: number
    color: string
    fontSize: number
    fontFamily: string
  }
  const DEFAULT_FONT_FAMILY = "Inter"
  const [textElements, setTextElements] = useState<TextElement[]>([])
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [textColorPanelOpen, setTextColorPanelOpen] = useState(false)
  const [fontPanelOpen, setFontPanelOpen] = useState(false)
  const [snapGuides, setSnapGuides] = useState<{ h: boolean; v: boolean }>({
    h: false,
    v: false,
  })
  const selectedText = textElements.find(t => t.id === selectedTextId) ?? null

  // Graphic elements placed inside a print area. Position and size are % of that print area.
  type GraphicElement = {
    id: string
    printAreaId: string
    src: string
    x: number
    y: number
    width: number
    height: number
  }
  const [graphicElements, setGraphicElements] = useState<GraphicElement[]>([])
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(null)
  const graphicElementRefs = useRef<Record<string, HTMLElement>>({})
  // True while actively dragging/resizing an element — the on-canvas embroidery
  // preview drops to the live, flat element during manipulation, then returns.
  const [isManipulating, setIsManipulating] = useState(false)
  // On-canvas embroidery: after the design settles, wait ~1s (showing a spinner
  // over the design) before revealing the stitched render — no opacity fade.
  const [embroideryShown, setEmbroideryShown] = useState(false)
  const [embroideryLoading, setEmbroideryLoading] = useState(false)
  // Only the very first embroidery render of the session gets the
  // "Embroidery preview…" label next to the spinner; later renders show just
  // the spinner.
  const embroideryEverShownRef = useRef(false)
  // The first reveal is held an extra second (even after the render is ready)
  // so the "Embroidery preview…" label is readable.
  const [embroideryFirstDelayPassed, setEmbroideryFirstDelayPassed] = useState(false)
  // Source image fed to the embroidery renderer. Only updated when the design's
  // *appearance* (not its position) changes, so moving never regenerates it.
  const [embroiderySrc, setEmbroiderySrc] = useState<string | null>(null)
  const lastEmbroiderySigRef = useRef<string | null>(null)
  // True between a drag/resize release and the next flatten completing — keeps
  // the flat element visible (no spinner) until the position settles, so the
  // stitched render appears at the final spot with no jump.
  const [embroiderySettling, setEmbroiderySettling] = useState(false)
  // True while a new stitched render is being computed (appearance changed) —
  // shows the spinner until the render is ready.
  const [embroideryRenderStale, setEmbroideryRenderStale] = useState(false)

  // Print technique (only relevant for embroidery-suitable products).
  const [printTechnique, setPrintTechnique] = useState<"standard" | "embroidery">("embroidery")
  const [printTechniqueOpen, setPrintTechniqueOpen] = useState(false)
  const [printTechniqueMenuOpen, setPrintTechniqueMenuOpen] = useState(false)
  // Some products (stickers, posters, mugs, …) can't be embroidered. For those
  // the technique is forced to standard print — without overwriting the user's
  // saved preference, so it returns when they switch back to a textile product.
  const embroiderySupported = !!productData?.embroidery
  const effectivePrintTechnique = embroiderySupported ? printTechnique : "standard"
  const [previewLoading, setPreviewLoading] = useState(false)
  // Flattened design (text + graphics combined) for the print-technique close-up,
  // and its embroidery-rendered counterpart.
  const [designDataUrl, setDesignDataUrl] = useState<string | null>(null)
  const [embroideryRenderedUrl, setEmbroideryRenderedUrl] = useState<string | null>(null)
  // Design's content bounding box as fractions (0-1) of the print area — used to
  // size/position the design accurately on the model image.
  const [designBbox, setDesignBbox] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)

  const [printAreaPxSize, setPrintAreaPxSize] = useState({ width: 0, height: 0 })
  const printAreaBoxRef = useRef<HTMLDivElement>(null)
  const textElementRefs = useRef<Record<string, HTMLElement>>({})
  const dragStateRef = useRef<{
    kind: "text" | "graphic"
    id: string
    startX: number
    startY: number
    elX: number
    elY: number
    moved: boolean
  } | null>(null)
  const resizeStateRef = useRef<{
    kind: "text" | "graphic"
    id: string
    initialFontSize: number
    initialDist: number
    oppX: number
    oppY: number
    corner: "nw" | "ne" | "sw" | "se"
    initialWidthPct: number
    initialHeightPct: number
    anchorXPct: number
    anchorYPct: number
  } | null>(null)

  const addTextElement = () => {
    if (!currentPrintAreaId) return
    const id = uid("text")
    const content = "Your text here"
    let fontSize = 32
    let x = 25
    let y = 40
    if (
      printAreaPxSize.width > 0 &&
      printAreaPxSize.height > 0 &&
      typeof document !== "undefined"
    ) {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.font = '100px "Inter", sans-serif'
        const widthAt100 = ctx.measureText(content).width
        if (widthAt100 > 0) {
          // Polo front: place new elements on the left chest (smaller) instead
          // of centred in the large front print area.
          const leftChest = productId === "2116" && currentPrintAreaId === "6322"
          const targetWidthPx = printAreaPxSize.width * (leftChest ? 0.26 : 0.5)
          const computedFontSize = (targetWidthPx / widthAt100) * 100
          fontSize = Math.max(
            14,
            Math.floor(Math.min(computedFontSize, printAreaPxSize.height))
          )
          const actualWidthPx = (widthAt100 / 100) * fontSize
          const elWidthPct = (actualWidthPx / printAreaPxSize.width) * 100
          const elHeightPct = (fontSize / printAreaPxSize.height) * 100
          if (leftChest) {
            x = Math.max(0, Math.min(100 - elWidthPct, 76 - elWidthPct / 2))
            y = Math.max(0, Math.min(100 - elHeightPct, 15 - elHeightPct / 2))
          } else {
            x = (100 - elWidthPct) / 2
            y = (100 - elHeightPct) / 2
          }
        }
      }
    }
    const productColor = appearances[activeColorIndex]?.color
    const color = isDarkProductColor(productColor) ? "#FFFFFF" : "#000000"
    setTextElements(prev => [
      ...prev,
      {
        id,
        printAreaId: currentPrintAreaId,
        content,
        x,
        y,
        color,
        // Stored at zoom-1 scale; rendered as fontSize * zoom.
        fontSize: fontSize / zoom,
        fontFamily: DEFAULT_FONT_FAMILY,
      },
    ])
    // Defer to next tick so the document click handler (firing in the same
    // event's bubble phase) doesn't clear the selection we're about to set.
    setTimeout(() => {
      setSelectedTextId(id)
      setEditingTextId(id)
    }, 0)
  }

  const updateSelectedText = (patch: Partial<TextElement>) => {
    if (!selectedTextId) return
    setTextElements(prev =>
      prev.map(t => (t.id === selectedTextId ? { ...t, ...patch } : t))
    )
  }

  const duplicateSelectedText = () => {
    if (!selectedTextId) return
    const src = textElements.find(t => t.id === selectedTextId)
    if (!src) return
    const newId = uid("text")
    const newEl: TextElement = {
      ...src,
      id: newId,
      x: Math.min(100, src.x + 5),
      y: Math.min(100, src.y + 5),
    }
    setTextElements(prev => [...prev, newEl])
    setSelectedTextId(newId)
  }

  const deleteSelectedText = () => {
    if (!selectedTextId) return
    setTextElements(prev => prev.filter(t => t.id !== selectedTextId))
    setSelectedTextId(null)
    setTextColorPanelOpen(false)
    setFontPanelOpen(false)
  }

  // Adds a graphic into the current print area, centred and sized to ~40% of the
  // print-area width while preserving the image's aspect ratio.
  const addGraphicElement = (
    src: string,
    opts?: { centerX?: number; centerY?: number; widthPct?: number }
  ) => {
    if (!currentPrintAreaId) return
    const printAreaId = currentPrintAreaId
    const id = uid("graphic")
    // Polo front: default new elements to the left chest unless an explicit
    // placement is passed.
    const placement =
      opts ??
      (productId === "2116" && currentPrintAreaId === "6322"
        ? { centerX: 76, centerY: 15, widthPct: 26 }
        : undefined)
    const clampPos = (v: number, size: number) => Math.max(0, Math.min(100 - size, v))
    const place = (width: number, height: number) => {
      const x =
        placement?.centerX != null
          ? clampPos(placement.centerX - width / 2, width)
          : (100 - width) / 2
      const y =
        placement?.centerY != null
          ? clampPos(placement.centerY - height / 2, height)
          : (100 - height) / 2
      setGraphicElements(prev => [...prev, { id, printAreaId, src, x, y, width, height }])
      setActivePanel(null)
      // Defer so the same click's document handler doesn't clear the new selection.
      setTimeout(() => {
        setSelectedGraphicId(id)
        setSelectedTextId(null)
      }, 0)
    }
    const targetWidthPct = placement?.widthPct ?? 40
    if (typeof window !== "undefined") {
      const img = new window.Image()
      img.onload = () => {
        const aspect =
          img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
        let width = targetWidthPct
        let height = targetWidthPct
        if (printAreaPxSize.width > 0 && printAreaPxSize.height > 0) {
          const widthPx = (targetWidthPct / 100) * printAreaPxSize.width
          const heightPx = widthPx / aspect
          height = (heightPx / printAreaPxSize.height) * 100
          // Shrink to fit if the natural aspect would overflow the print area.
          if (height > 80) {
            const s = 80 / height
            width *= s
            height = 80
          }
        }
        place(width, height)
      }
      img.onerror = () => place(targetWidthPct, targetWidthPct)
      img.src = src
    } else {
      place(targetWidthPct, targetWidthPct)
    }
  }

  const deleteSelectedGraphic = () => {
    if (!selectedGraphicId) return
    setGraphicElements(prev => prev.filter(g => g.id !== selectedGraphicId))
    setSelectedGraphicId(null)
  }

  const duplicateSelectedGraphic = () => {
    if (!selectedGraphicId) return
    const src = graphicElements.find(g => g.id === selectedGraphicId)
    if (!src) return
    const newId = uid("graphic")
    setGraphicElements(prev => [
      ...prev,
      {
        ...src,
        id: newId,
        x: Math.max(0, Math.min(100 - src.width, src.x + 5)),
        y: Math.max(0, Math.min(100 - src.height, src.y + 5)),
      },
    ])
    setSelectedGraphicId(newId)
  }

  // Backspace / Delete removes the selected text — only when not actively typing
  // and not inside any input/contenteditable element.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((!selectedTextId && !selectedGraphicId) || editingTextId) return
      if (e.key !== "Backspace" && e.key !== "Delete") return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return
      }
      e.preventDefault()
      if (selectedGraphicId) deleteSelectedGraphic()
      else deleteSelectedText()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [selectedTextId, selectedGraphicId, editingTextId])

  // Deselect text on clicks anywhere outside the text element / editor bar / color panel.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (
        target.closest("[data-text-element]") ||
        target.closest("[data-graphic-element]") ||
        target.closest("[data-editor-bar]") ||
        target.closest("[data-text-color-panel]") ||
        target.closest("[data-font-panel]")
      ) {
        return
      }
      setSelectedTextId(null)
      setSelectedGraphicId(null)
      setTextColorPanelOpen(false)
      setFontPanelOpen(false)
    }
    document.addEventListener("click", onDocClick)
    return () => document.removeEventListener("click", onDocClick)
  }, [])

  // Reset texts and graphics when switching products. The print technique is
  // intentionally NOT reset — embroidery is the default, and once the user
  // switches to standard print that choice persists across products.
  useEffect(() => {
    setTextElements([])
    setEditingTextId(null)
    setGraphicElements([])
    setSelectedGraphicId(null)
    setPrintTechniqueOpen(false)
  }, [productData])

  // Document-level mousemove/up so dragging and resizing keep working when cursor leaves the element.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rs = resizeStateRef.current
      if (rs) {
        setIsManipulating(true)
        if (rs.initialDist > 0) {
          const newDist = Math.hypot(e.clientX - rs.oppX, e.clientY - rs.oppY)
          const scale = newDist / rs.initialDist
          // Scale uniformly from the dragged corner, preserving aspect ratio.
          // Text drives off font size; graphics scale width/height directly.
          let nextFontSize = rs.initialFontSize
          let sizeScale: number
          if (rs.kind === "graphic") {
            sizeScale = Math.max(MIN_GRAPHIC_WIDTH_PCT / rs.initialWidthPct, scale)
          } else {
            nextFontSize = Math.max(MIN_TEXT_FONT_SIZE, rs.initialFontSize * scale)
            sizeScale = nextFontSize / rs.initialFontSize
          }
          const newWidthPct = rs.initialWidthPct * sizeScale
          const newHeightPct = rs.initialHeightPct * sizeScale
          let newX = rs.anchorXPct
          let newY = rs.anchorYPct
          switch (rs.corner) {
            case "nw":
              newX = rs.anchorXPct - newWidthPct
              newY = rs.anchorYPct - newHeightPct
              break
            case "ne":
              newX = rs.anchorXPct
              newY = rs.anchorYPct - newHeightPct
              break
            case "sw":
              newX = rs.anchorXPct - newWidthPct
              newY = rs.anchorYPct
              break
            case "se":
              newX = rs.anchorXPct
              newY = rs.anchorYPct
              break
          }
          if (rs.kind === "graphic") {
            setGraphicElements(prev =>
              prev.map(g =>
                g.id === rs.id
                  ? { ...g, width: newWidthPct, height: newHeightPct, x: newX, y: newY }
                  : g
              )
            )
          } else {
            setTextElements(prev =>
              prev.map(t =>
                t.id === rs.id ? { ...t, fontSize: nextFontSize, x: newX, y: newY } : t
              )
            )
          }
        }
        return
      }
      const ds = dragStateRef.current
      if (!ds) return
      const pa = printAreaBoxRef.current
      if (!pa) return
      const paRect = pa.getBoundingClientRect()
      const dx = e.clientX - ds.startX
      const dy = e.clientY - ds.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        ds.moved = true
        setIsManipulating(true)
      }
      const newXPct = ds.elX + (dx / paRect.width) * 100
      const newYPct = ds.elY + (dy / paRect.height) * 100
      const SNAP_THRESHOLD_PX = 8
      const draggedNode = (
        ds.kind === "graphic" ? graphicElementRefs : textElementRefs
      ).current[ds.id]
      const elWidthPct = draggedNode
        ? (draggedNode.getBoundingClientRect().width / paRect.width) * 100
        : 0
      const elHeightPct = draggedNode
        ? (draggedNode.getBoundingClientRect().height / paRect.height) * 100
        : 0
      const clampedX = Math.max(0, Math.min(100 - elWidthPct, newXPct))
      const clampedY = Math.max(0, Math.min(100 - elHeightPct, newYPct))
      const centerXpct = clampedX + elWidthPct / 2
      const centerYpct = clampedY + elHeightPct / 2
      const snapVThresholdPct = (SNAP_THRESHOLD_PX / paRect.width) * 100
      const snapHThresholdPct = (SNAP_THRESHOLD_PX / paRect.height) * 100
      const snapV = Math.abs(centerXpct - 50) < snapVThresholdPct
      const snapH = Math.abs(centerYpct - 50) < snapHThresholdPct
      setSnapGuides(prev =>
        prev.h === snapH && prev.v === snapV ? prev : { h: snapH, v: snapV }
      )
      const snappedX = snapV ? (100 - elWidthPct) / 2 : clampedX
      const snappedY = snapH ? (100 - elHeightPct) / 2 : clampedY
      if (ds.kind === "graphic") {
        setGraphicElements(prev =>
          prev.map(g => (g.id === ds.id ? { ...g, x: snappedX, y: snappedY } : g))
        )
      } else {
        setTextElements(prev =>
          prev.map(t => (t.id === ds.id ? { ...t, x: snappedX, y: snappedY } : t))
        )
      }
    }
    const onUp = () => {
      setIsManipulating(false)
      if (resizeStateRef.current) {
        resizeStateRef.current = null
        // Resize changed the design — wait for the flatten before revealing.
        setEmbroiderySettling(true)
        return
      }
      const ds = dragStateRef.current
      if (!ds) return
      // A move happened — wait for the flatten to settle the position so the
      // stitched render reappears at the final spot without jumping.
      if (ds.moved) setEmbroiderySettling(true)
      // Always select on mouseup so a drag keeps the element as the active selection.
      if (ds.kind === "graphic") {
        setSelectedGraphicId(ds.id)
        setSelectedTextId(null)
      } else {
        setSelectedTextId(ds.id)
        setSelectedGraphicId(null)
      }
      setSnapGuides({ h: false, v: false })
      dragStateRef.current = null
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [])

  const startTextDrag = (e: React.MouseEvent, el: TextElement) => {
    if (editingTextId === el.id) return
    e.preventDefault()
    dragStateRef.current = {
      kind: "text",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      elX: el.x,
      elY: el.y,
      moved: false,
    }
  }
  const startGraphicDrag = (e: React.MouseEvent, el: GraphicElement) => {
    e.preventDefault()
    dragStateRef.current = {
      kind: "graphic",
      id: el.id,
      startX: e.clientX,
      startY: e.clientY,
      elX: el.x,
      elY: el.y,
      moved: false,
    }
  }
  const startResize = (
    e: React.MouseEvent,
    el: { id: string; x: number; y: number; fontSize?: number },
    corner: "nw" | "ne" | "sw" | "se",
    kind: "text" | "graphic" = "text"
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const node = (kind === "graphic" ? graphicElementRefs : textElementRefs).current[el.id]
    const pa = printAreaBoxRef.current
    if (!node || !pa) return
    const rect = node.getBoundingClientRect()
    const paRect = pa.getBoundingClientRect()
    const oppX = corner.endsWith("e") ? rect.left : rect.right
    const oppY = corner.startsWith("s") ? rect.top : rect.bottom
    const initialDist = Math.hypot(e.clientX - oppX, e.clientY - oppY)
    const initialWidthPct = (rect.width / paRect.width) * 100
    const initialHeightPct = (rect.height / paRect.height) * 100
    // Anchor corner = opposite of the dragged corner, in print-area % coordinates.
    let anchorXPct = el.x
    let anchorYPct = el.y
    switch (corner) {
      case "nw": // anchor = SE
        anchorXPct = el.x + initialWidthPct
        anchorYPct = el.y + initialHeightPct
        break
      case "ne": // anchor = SW
        anchorXPct = el.x
        anchorYPct = el.y + initialHeightPct
        break
      case "sw": // anchor = NE
        anchorXPct = el.x + initialWidthPct
        anchorYPct = el.y
        break
      case "se": // anchor = NW
        anchorXPct = el.x
        anchorYPct = el.y
        break
    }
    resizeStateRef.current = {
      kind,
      id: el.id,
      initialFontSize: el.fontSize ?? 0,
      initialDist,
      oppX,
      oppY,
      corner,
      initialWidthPct,
      initialHeightPct,
      anchorXPct,
      anchorYPct,
    }
  }
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => {
    setHasMounted(true)
  }, [])
  const creatomatRef = useRef<HTMLDivElement>(null)
  const [creatomatContainer, setCreatomatContainer] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setCreatomatContainer(creatomatRef.current)
  }, [])

  // Collapse the desktop dock (left column) labels into tooltips when the
  // creatomat container gets narrow.
  const [isDockCompact, setIsDockCompact] = useState(false)
  useEffect(() => {
    const el = creatomatRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height ?? 0
      setIsDockCompact(height < 521)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Pressing the browser back button after entering a panel/drawer from the
  // onboarding popup reverts to the popup. We push a history entry when the
  // user picks an action; popstate restores state.
  const openFromOnboarding = (action: () => void) => {
    setWelcomeOpen(false)
    setTimeout(() => {
      action()
      window.history.pushState({ from: "onboarding" }, "")
    }, 280)
  }
  useEffect(() => {
    const onPop = () => {
      setActivePanel(null)
      setProductsDrawerOpen(false)
      setWelcomeOpen(true)
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  useEffect(() => {
    if (!productData) return
    // Prefer the colour previewed in the products drawer; fall back to default.
    const wanted = selectedProduct?.appearanceId
    let idx = wanted ? productData.appearances.findIndex(a => a.id === wanted) : -1
    if (idx < 0) idx = productData.appearances.findIndex(a => a.id === productData.defaultAppearanceId)
    setActiveColorIndex(idx >= 0 ? idx : 0)
    setActiveViewId(productData.defaultViewId)
  }, [productData, selectedProduct?.appearanceId])

  const appearances = productData?.appearances ?? []
  const sizes = useMemo(
    () => (productData?.sizes ?? []).map(s => s.name),
    [productData]
  )
  const BASE_PRICE = productData?.price ?? 0

  const outOfStockMap = useMemo(
    () =>
      productData
        ? buildOutOfStockMap(productData.id, productData.appearances, productData.sizes)
        : {},
    [productData]
  )
  const togglePanel = (panel: DesignerPanel) =>
    setActivePanel(p => (p === panel ? null : panel))
  const productImages = appearances.map(a => ({
    src: a.image,
    alt: a.name,
    color: a.color,
  }))

  // Active view determines the canvas image and the print-area overlay.
  const currentAppearance = appearances[activeColorIndex]
  const currentViewImage =
    currentAppearance?.views.find(v => v.id === activeViewId)?.image ??
    currentAppearance?.image ??
    ""
  // Model image in the selected colour; fall back to the product's default shot
  // when the chosen colour has no dedicated model photo.
  const currentModelImage = currentAppearance?.modelImage ?? productData?.modelImageFront ?? null
  const currentView = productData?.views.find(v => v.id === activeViewId)
  const canvasAspect = currentView
    ? `${currentView.canvas.width} / ${currentView.canvas.height}`
    : "1 / 1"
  const printAreaOverlay = productData ? getPrintAreaOverlay(productData, activeViewId) : null
  const currentPrintAreaId = currentView?.viewMaps[0]?.printAreaId ?? null
  const visibleTextElements = currentPrintAreaId
    ? textElements.filter(t => t.printAreaId === currentPrintAreaId)
    : []
  const visibleGraphicElements = currentPrintAreaId
    ? graphicElements.filter(g => g.printAreaId === currentPrintAreaId)
    : []
  // The live canvas content's on-screen square size (px) — fontSize is relative
  // to this, so the view-thumbnail previews use it to scale the design down.
  const liveCanvasContentSize =
    printAreaOverlay && printAreaPxSize.width > 0
      ? (printAreaPxSize.width * 100) / printAreaOverlay.width
      : 0
  // Signature of the current print area's design — drives re-flattening for the
  // on-canvas embroidery preview when text/graphics change.
  const designSignature = JSON.stringify({
    t: visibleTextElements.map(t => [t.x, t.y, t.content, t.fontSize, t.fontFamily, t.color]),
    g: visibleGraphicElements.map(g => [g.x, g.y, g.width, g.height, g.src]),
  })
  // Appearance signature, normalized to the design's top-left so a pure
  // translation (single element, or whole design) leaves it unchanged — used to
  // decide when the stitched render actually needs regenerating.
  const designEls = [...visibleTextElements, ...visibleGraphicElements]
  const designMinX = designEls.length ? Math.min(...designEls.map(e => e.x)) : 0
  const designMinY = designEls.length ? Math.min(...designEls.map(e => e.y)) : 0
  const embroiderySignature = JSON.stringify({
    t: visibleTextElements.map(t => [
      t.x - designMinX,
      t.y - designMinY,
      t.content,
      t.fontSize,
      t.fontFamily,
      t.color,
    ]),
    g: visibleGraphicElements.map(g => [
      g.x - designMinX,
      g.y - designMinY,
      g.width,
      g.height,
      g.src,
    ]),
  })
  // Decide what shows on the canvas for the embroidery technique:
  //  - manipulating/editing  -> flat element (no spinner)
  //  - settling (just released) -> flat element, wait for the position to settle
  //  - render stale / not ready -> spinner (a new stitched render is computing)
  //  - otherwise -> the stitched render
  useEffect(() => {
    const shouldEmbroider =
      effectivePrintTechnique === "embroidery" && !!designBbox && !isManipulating && !editingTextId
    if (!shouldEmbroider || embroiderySettling) {
      setEmbroideryShown(false)
      setEmbroideryLoading(false)
      return
    }
    if (embroideryRenderStale || !embroideryRenderedUrl) {
      setEmbroideryShown(false)
      setEmbroideryLoading(true)
      return
    }
    // Render is ready. On the very first reveal of the session, keep the
    // labelled loader up an extra second so the user can read it.
    if (!embroideryEverShownRef.current && !embroideryFirstDelayPassed) {
      setEmbroideryShown(false)
      setEmbroideryLoading(true)
      const t = setTimeout(() => setEmbroideryFirstDelayPassed(true), 1000)
      return () => clearTimeout(t)
    }
    setEmbroideryShown(true)
    setEmbroideryLoading(false)
    embroideryEverShownRef.current = true
  }, [
    printTechnique,
    embroiderySupported,
    designBbox,
    embroideryRenderedUrl,
    isManipulating,
    editingTextId,
    embroiderySettling,
    embroideryRenderStale,
    embroideryFirstDelayPassed,
  ])

  // Embroidery clamps the design to a max area; warn when that shrinks it by >20%.
  const embroiderySizeWarning = (() => {
    if (!designBbox || effectivePrintTechnique !== "embroidery") return false
    const clamped = clampEmbroideryBbox(designBbox)
    const s = Math.sqrt((clamped.w * clamped.h) / (designBbox.w * designBbox.h))
    return s < 0.8
  })()

  // Flatten the current print area's text + graphics into a single PNG when the
  // print-technique modal opens (combines text and graphic like dock-change).
  useEffect(() => {
    // Flatten when the technique modal is open OR embroidery is the live
    // technique (so the stitched preview can render on the canvas).
    const wantPreview = printTechniqueOpen || effectivePrintTechnique === "embroidery"
    if (!wantPreview) {
      setDesignDataUrl(null)
      setEmbroiderySrc(null)
      lastEmbroiderySigRef.current = null
      setEmbroideryRenderedUrl(null)
      setDesignBbox(null)
      setPreviewLoading(false)
      setEmbroiderySettling(false)
      setEmbroideryRenderStale(false)
      return
    }
    // On the canvas, don't regenerate while an element is being edited/dragged —
    // the live editable element is shown instead of the stitched overlay.
    if (!printTechniqueOpen && (isManipulating || editingTextId)) {
      return
    }
    // Appearance changed (not just a move) — a new stitched render is needed, so
    // flag it stale up front to show the spinner immediately.
    if (embroiderySignature !== lastEmbroiderySigRef.current) {
      setEmbroideryRenderStale(true)
    }
    let cancelled = false
    if (printTechniqueOpen) {
      setEmbroideryRenderedUrl(null)
      setPreviewLoading(true)
    }
    const loadingTimer = setTimeout(() => {
      if (!cancelled) setPreviewLoading(false)
    }, 900)

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((res, rej) => {
        const im = new Image()
        im.crossOrigin = "anonymous"
        im.onload = () => res(im)
        im.onerror = rej
        im.src = src
      })

    const flatten = async () => {
      const texts = visibleTextElements
      const graphics = visibleGraphicElements
      // Normalize to zoom-1 so the rendered design (designBbox fractions) is
      // zoom-independent and matches the flat text (which renders at fontSize*zoom).
      const baseW = printAreaPxSize.width / zoom
      const baseH = printAreaPxSize.height / zoom
      if ((texts.length === 0 && graphics.length === 0) || baseW <= 1 || baseH <= 1) {
        if (!cancelled) {
          setDesignDataUrl(null)
          setEmbroiderySrc(null)
          lastEmbroiderySigRef.current = null
          setDesignBbox(null)
          setEmbroiderySettling(false)
          setEmbroideryRenderStale(false)
        }
        return
      }
      // Render the design at a higher resolution than the on-screen print area so
      // the close-up preview stays crisp and large (the editor px size is tiny).
      const RENDER_TARGET = 900
      // Cap the canvas at RENDER_TARGET (no max(1,…)) so a zoomed-in print area
      // doesn't blow the measure pass up to thousands of pixels.
      const scale = RENDER_TARGET / Math.max(baseW, baseH)
      const W = Math.round(baseW * scale)
      const H = Math.round(baseH * scale)
      try {
        await document.fonts.ready
      } catch {}
      const canvas = document.createElement("canvas")
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      // Text first, graphics on top — matches the editor's layer order. Draw
      // positions are rounded so a pure move yields a byte-identical crop (the
      // stitched render is then reused instead of regenerated).
      for (const t of texts) {
        ctx.fillStyle = t.color
        ctx.textBaseline = "top"
        const fontSize = t.fontSize * scale
        ctx.font = `${fontSize}px "${t.fontFamily}"`
        const x = Math.round((t.x / 100) * W)
        let y = (t.y / 100) * H
        for (const line of t.content.split("\n")) {
          ctx.fillText(line, x, Math.round(y))
          y += fontSize
        }
      }
      for (const g of graphics) {
        const img = await loadImage(g.src).catch(() => null)
        if (!img) continue
        ctx.drawImage(
          img,
          Math.round((g.x / 100) * W),
          Math.round((g.y / 100) * H),
          Math.round((g.width / 100) * W),
          Math.round((g.height / 100) * H)
        )
      }
      // Crop to the design's content bounding box.
      const { data } = ctx.getImageData(0, 0, W, H)
      let minX = W,
        minY = H,
        maxX = 0,
        maxY = 0,
        found = false
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (data[(y * W + x) * 4 + 3] > 10) {
            found = true
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
      if (!found) {
        if (!cancelled) {
          setDesignDataUrl(null)
          setEmbroiderySrc(null)
          lastEmbroiderySigRef.current = null
          setDesignBbox(null)
          setEmbroiderySettling(false)
          setEmbroideryRenderStale(false)
        }
        return
      }
      const cw = maxX - minX + 1
      const ch = maxY - minY + 1
      const cropped = document.createElement("canvas")
      cropped.width = cw
      cropped.height = ch
      cropped.getContext("2d")!.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
      if (cancelled) return
      const url = cropped.toDataURL("image/png")
      setDesignDataUrl(url)
      // Bounding box as fractions of the print area, for accurate placement.
      const fx = minX / W,
        fy = minY / H,
        fw = cw / W,
        fh = ch / H
      setDesignBbox({ x: fx, y: fy, w: fw, h: fh })
      // Position has now settled at the final spot.
      setEmbroiderySettling(false)
      // Only feed a new image to the embroidery renderer when the appearance
      // changed — a pure move keeps the same render (it just repositions, and
      // is therefore not stale).
      if (embroiderySignature !== lastEmbroiderySigRef.current) {
        // Re-render ONLY the design region at a high, size-independent target
        // resolution. The first pass scales to the whole print area, so a small
        // design lands on few pixels and the stitch effect looks rough; here the
        // design's long edge is normalised to ~TARGET_HI px so the embroidery
        // renderer always gets a crisp, well-sized source.
        const TARGET_HI = 620
        const designLongPx = Math.max(fw * baseW, fh * baseH)
        const scaleHi = Math.min(40, Math.max(1, TARGET_HI / Math.max(designLongPx, 1)))
        const WF = baseW * scaleHi
        const HF = baseH * scaleHi
        const cropW = Math.max(1, Math.round(fw * WF))
        const cropH = Math.max(1, Math.round(fh * HF))
        const hi = document.createElement("canvas")
        hi.width = cropW
        hi.height = cropH
        const hctx = hi.getContext("2d")
        if (hctx) {
          hctx.imageSmoothingEnabled = true
          hctx.imageSmoothingQuality = "high"
          hctx.translate(-fx * WF, -fy * HF)
          for (const t of texts) {
            hctx.fillStyle = t.color
            hctx.textBaseline = "top"
            const fs = t.fontSize * scaleHi
            hctx.font = `${fs}px "${t.fontFamily}"`
            const x = Math.round((t.x / 100) * WF)
            let y = (t.y / 100) * HF
            for (const line of t.content.split("\n")) {
              hctx.fillText(line, x, Math.round(y))
              y += fs
            }
          }
          for (const g of graphics) {
            const img = await loadImage(g.src).catch(() => null)
            if (!img) continue
            hctx.drawImage(
              img,
              Math.round((g.x / 100) * WF),
              Math.round((g.y / 100) * HF),
              Math.round((g.width / 100) * WF),
              Math.round((g.height / 100) * HF)
            )
          }
        }
        if (cancelled) return
        lastEmbroiderySigRef.current = embroiderySignature
        setEmbroiderySrc(hctx ? hi.toDataURL("image/png") : url)
      } else {
        setEmbroideryRenderStale(false)
      }
    }

    void flatten()
    return () => {
      cancelled = true
      clearTimeout(loadingTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // NOTE: printAreaPxSize is intentionally NOT a dependency — the embroidery
    // overlay is positioned by fractions and scales with the print-area box via
    // CSS, so it must not re-flatten on zoom (that was the zoom lag).
  }, [
    printTechniqueOpen,
    printTechnique,
    embroiderySupported,
    designSignature,
    embroiderySignature,
    isManipulating,
    editingTextId,
  ])

  // When switching views (print areas), clear any stale selection / editing
  // that points to an element that doesn't live in the new print area.
  useEffect(() => {
    if (!selectedTextId) return
    const t = textElements.find(x => x.id === selectedTextId)
    if (!t || t.printAreaId !== currentPrintAreaId) {
      setSelectedTextId(null)
      setEditingTextId(null)
      setTextColorPanelOpen(false)
      setFontPanelOpen(false)
    }
  }, [currentPrintAreaId, selectedTextId, textElements])

  useEffect(() => {
    if (!selectedGraphicId) return
    const g = graphicElements.find(x => x.id === selectedGraphicId)
    if (!g || g.printAreaId !== currentPrintAreaId) setSelectedGraphicId(null)
  }, [currentPrintAreaId, selectedGraphicId, graphicElements])

  useEffect(() => {
    const el = printAreaBoxRef.current
    if (!el) return
    const update = () => {
      const r = el.getBoundingClientRect()
      setPrintAreaPxSize(prev =>
        prev.width === r.width && prev.height === r.height
          ? prev
          : { width: r.width, height: r.height }
      )
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [productId, activeViewId])
  // Computes the largest font size at which `text` fits in `areaWidth × areaHeight`.
  const computeMaxFontSize = (text: string, areaWidth: number, areaHeight: number) => {
    if (areaWidth <= 0 || areaHeight <= 0) return 14
    const safeText = text || "A"
    if (typeof document === "undefined") return Math.floor(areaHeight)
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return Math.floor(areaHeight)
    ctx.font = '100px "Inter", sans-serif'
    const widthAt100 = ctx.measureText(safeText).width
    if (widthAt100 <= 0) return Math.floor(areaHeight)
    const maxByWidth = (areaWidth / widthAt100) * 100
    return Math.max(14, Math.floor(Math.min(maxByWidth, areaHeight)))
  }
  // Measures a text run's pixel width at the given fontSize/fontFamily.
  const measureTextWidth = (text: string, fontSize: number, fontFamily: string) => {
    if (typeof document === "undefined") return 0
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return 0
    ctx.font = `${fontSize}px "${fontFamily}"`
    return ctx.measureText(text || " ").width
  }
  // Measures a multi-line text block; width = widest line, height = lines * fontSize (leading-none).
  const measureTextBox = (text: string, fontSize: number, fontFamily: string) => {
    const lines = (text || " ").split("\n")
    let width = 0
    for (const line of lines) {
      width = Math.max(width, measureTextWidth(line || " ", fontSize, fontFamily))
    }
    return { width, height: lines.length * fontSize }
  }
  const MIN_TEXT_FONT_SIZE = 14
  const MIN_GRAPHIC_WIDTH_PCT = 5
  const maxFontSize = useMemo(
    () =>
      // /zoom: fontSize is stored at zoom-1 scale but printAreaPxSize is measured
      // at the current zoom.
      computeMaxFontSize(
        selectedText?.content ?? "",
        printAreaPxSize.width,
        printAreaPxSize.height
      ) / zoom,
    [selectedText?.content, printAreaPxSize.width, printAreaPxSize.height, zoom]
  )

  // Auto-clamp the selected text's fontSize if its content makes the current size overflow.
  useEffect(() => {
    if (!selectedTextId) return
    setTextElements(prev => {
      const t = prev.find(x => x.id === selectedTextId)
      if (!t || t.fontSize <= maxFontSize) return prev
      return prev.map(x =>
        x.id === selectedTextId ? { ...x, fontSize: maxFontSize } : x
      )
    })
  }, [maxFontSize, selectedTextId])

  // Per-size selected quantities; total derived from the sum.
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({})
  const totalSelected = useMemo(
    () => Object.values(sizeQuantities).reduce((a, b) => a + b, 0),
    [sizeQuantities]
  )

  // Reset when color changes
  useEffect(() => {
    setSizeQuantities({})
  }, [activeColorIndex])

  // If the user selects a size while the "no size" flash is still active, end the flash early.
  useEffect(() => {
    if (flashSize && totalSelected > 0) setFlashSize(false)
  }, [flashSize, totalSelected])

  // Track scroll overflow inside the size popover so we can fade top/bottom edges.
  useEffect(() => {
    if (!sizePopoverOpen) return
    const el = sizePopoverScrollRef.current
    if (!el) return
    const update = () => {
      const max = el.scrollHeight - el.clientHeight
      setSizePopoverOverflowTop(el.scrollTop > 1)
      setSizePopoverOverflowBottom(el.scrollTop < max - 1)
    }
    update()
    el.addEventListener("scroll", update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [sizePopoverOpen])

  const setSizeQuantity = (size: string, qty: number) => {
    setSizeQuantities(prev => ({ ...prev, [size]: Math.max(0, Math.floor(qty) || 0) }))
  }

  // Tier hint string driven by current totalSelected and the discount tiers.
  const discountTierHint = (() => {
    const tiers: { min: number; pct: number }[] = [
      { min: 5, pct: 10 },
      { min: 20, pct: 20 },
      { min: 40, pct: 30 },
      { min: 60, pct: 40 },
      { min: 100, pct: 50 },
    ]
    const nextTier = tiers.find(t => totalSelected < t.min)
    if (nextTier) return `From ${nextTier.min} items -${nextTier.pct}% reduction`
    const last = tiers[tiers.length - 1]
    return `${last.pct}% reduction applied`
  })()

  const selectedSizes = sizes
    .map(size => ({ size, qty: sizeQuantities[size] ?? 0 }))
    .filter(s => s.qty > 0)

  // Track pills (selected + recently-removed) so exits can animate. A pill
  // marked `exiting` stays in the DOM for the exit animation, then is removed.
  type RenderPill = { size: string; qty: number; exiting: boolean }
  const [renderPills, setRenderPills] = useState<RenderPill[]>([])
  useEffect(() => {
    const selectedMap = new Map(selectedSizes.map(s => [s.size, s.qty]))
    setRenderPills(prev => {
      const next: RenderPill[] = prev.map(p => {
        const qty = selectedMap.get(p.size)
        if (qty !== undefined && qty > 0) return { ...p, qty, exiting: false }
        return p.exiting ? p : { ...p, exiting: true }
      })
      const existingSet = new Set(prev.map(p => p.size))
      selectedSizes.forEach(s => {
        if (!existingSet.has(s.size))
          next.push({ size: s.size, qty: s.qty, exiting: false })
      })
      next.sort((a, b) => sizes.indexOf(a.size) - sizes.indexOf(b.size))
      return next
    })
  }, [sizeQuantities, sizes])
  useEffect(() => {
    if (!renderPills.some(p => p.exiting)) return
    const timer = setTimeout(() => {
      setRenderPills(prev => prev.filter(p => !p.exiting))
    }, 320)
    return () => clearTimeout(timer)
  }, [renderPills])
  const sizeButtonLabel =
    selectedSizes.length === 0 ? (
      <span>Choose size</span>
    ) : (
      <span
        className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap"
        style={{
          maskImage:
            "linear-gradient(to right, #000 0, #000 calc(100% - 16px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, #000 0, #000 calc(100% - 16px), transparent 100%)",
        }}
      >
        <span className="flex-shrink-0">Sizes:</span>
        {renderPills.map(({ size, qty, exiting }) => (
          <SizePill key={size} size={size} qty={qty} exiting={exiting} />
        ))}
      </span>
    )

  // Calculate discount percentage based on volume
  const getDiscountPercentage = (qty: number): number => {
    if (qty >= 100) return 0.5 // 50% discount
    if (qty >= 60) return 0.4 // 40% discount
    if (qty >= 40) return 0.3 // 30% discount
    if (qty >= 20) return 0.2 // 20% discount
    if (qty >= 5) return 0.1 // 10% discount
    return 0 // No discount
  }

  // Per-decorated-print-area surcharge (mirrors dock-change's per-side pricing):
  // each used print area adds a surcharge; embroidery costs +5/area over standard.
  const SURCHARGE_STANDARD_PER_AREA = 2
  const SURCHARGE_EMBROIDERY_PER_AREA = 7
  const decoratedPrintAreaCount = new Set([
    ...textElements.map(t => t.printAreaId),
    ...graphicElements.map(g => g.printAreaId),
  ]).size
  const perAreaSurcharge =
    effectivePrintTechnique === "embroidery"
      ? SURCHARGE_EMBROIDERY_PER_AREA
      : SURCHARGE_STANDARD_PER_AREA
  const unitPrice = BASE_PRICE + decoratedPrintAreaCount * perAreaSurcharge
  const originalPrice = totalSelected > 0 ? unitPrice * totalSelected : unitPrice
  const discountPercent = getDiscountPercentage(totalSelected)
  const discountedPrice = originalPrice * (1 - discountPercent)

  const formattedOriginalPrice = originalPrice.toFixed(2).replace(".", ",")
  const formattedDiscountedPrice = discountedPrice.toFixed(2).replace(".", ",")

  const colorRowRef = useRef<HTMLDivElement | null>(null)
  const [canScrollColorLeft, setCanScrollColorLeft] = useState(false)
  const [canScrollColorRight, setCanScrollColorRight] = useState(false)
  const [isColorScrollable, setIsColorScrollable] = useState(false)

  const rightSectionRef = useRef<HTMLDivElement | null>(null)

  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  useEffect(() => {
    const checkRightSectionHeight = () => {
      const rightSection = rightSectionRef.current
      if (!rightSection) return

      const height = rightSection.clientHeight
      const shouldScroll = height < 471
      setIsColorScrollable(shouldScroll)
    }

    checkRightSectionHeight()
    window.addEventListener("resize", checkRightSectionHeight)
    return () => window.removeEventListener("resize", checkRightSectionHeight)
  }, [])

  const updateColorScrollButtons = () => {
    const row = colorRowRef.current
    if (!row) return

    const maxScrollLeft = row.scrollWidth - row.clientWidth
    const eps = 1

    setCanScrollColorLeft(row.scrollLeft > eps)
    setCanScrollColorRight(maxScrollLeft > eps && row.scrollLeft < maxScrollLeft - eps)
  }

  useEffect(() => {
    if (!isColorScrollable) return

    const row = colorRowRef.current
    if (!row) return

    updateColorScrollButtons()

    const onScroll = () => updateColorScrollButtons()
    row.addEventListener("scroll", onScroll, { passive: true })

    const onResize = () => updateColorScrollButtons()
    window.addEventListener("resize", onResize)

    const hasRO = typeof (window as any).ResizeObserver !== "undefined"
    const ro: ResizeObserver | null = hasRO
      ? new ResizeObserver(() => {
          requestAnimationFrame(() => updateColorScrollButtons())
        })
      : null

    if (ro) {
      ro.observe(row)
      Array.from(row.children).forEach((child) => {
        if (child instanceof HTMLElement) ro.observe(child)
      })
    }

    return () => {
      row.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      ro?.disconnect()
    }
  }, [isColorScrollable, productData])

  const scrollColorByPx = (dx: number) => {
    const row = colorRowRef.current
    if (!row) return
    row.scrollBy({ left: dx, behavior: "smooth" })
  }

  const selectedColor = productImages[activeColorIndex]?.alt ?? ""

  return (
    <>
      <style>{`
        #color-buttons-row::-webkit-scrollbar{display:none;}
        #color-buttons-row{scrollbar-width:none;}
      `}</style>

      <div className="h-screen w-full flex flex-col">
        <SiteHeader
          hidden={productsDrawerOpen}
          onCartClick={() => setBasketOpen(true)}
          cartCount={basketItems.reduce((sum, it) => sum + it.qty, 0)}
        />
        <div className="flex flex-1 flex-col px-8 py-[16px] min-h-0">
        <div className="flex flex-1 items-center justify-center min-h-0">
        <div ref={creatomatRef} id="creatomat-container" className="relative flex items-stretch gap-2 w-full max-w-[1920px] h-full justify-center">
          <div
            id="left-section"
            className="shrink-0 w-[100px] p-[6px] px-1.5 h-full bg-[#F4F4F4] rounded-[12px] flex flex-col"
          >
            {/* Top Section - Products */}
            <div id="left-section-top-side" className="flex-shrink-0">
              <button
                type="button"
                onMouseEnter={() => setHoveredButton("products")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => setProductsDrawerOpen(true)}
                className={
                  "w-[88px] h-auto flex flex-col items-center gap-[8px] p-[8px] rounded-[10px] transition-all duration-200 cursor-pointer " +
                  (hoveredButton === "products" ? "bg-[#E9E9E9]" : "bg-transparent")
                }
              >
                <img src="/images/blankproduct.png" alt="Products" className="size-14" />
                <div className="text-[12px] font-[600] text-black text-center">Products</div>
              </button>
            </div>

            {/* Middle Section - Action Buttons */}
            <div id="left-section-middle-side" className="flex-1 flex flex-col justify-center gap-[8px]">
              {/* AI Image Button */}
              <button
                type="button"
                onMouseEnter={() => setHoveredButton("ai")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => togglePanel("ai")}
                className={
                  "relative w-[88px] h-auto flex flex-col items-center gap-[8px] rounded-[10px] transition-all duration-200 cursor-pointer " +
                  (isDockCompact ? "px-[8px] py-[10px] " : "p-[8px] ") +
                  (activePanel === "ai"
                    ? "bg-white"
                    : hoveredButton === "ai"
                      ? "bg-[#E9E9E9]"
                      : "bg-transparent")
                }
              >
                <img src="/icons/icon-sparkles-ai.svg" alt="" className="h-6 w-6" />

                {!isDockCompact && (
                  <div className="text-[12px] font-[600] text-black text-center">AI Image</div>
                )}
                {isDockCompact && hoveredButton === "ai" && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                    AI Image
                  </span>
                )}
              </button>

              {/* Uploads Button */}
              <button
                type="button"
                onMouseEnter={() => setHoveredButton("upload")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => togglePanel("uploads")}
                className={
                  "relative w-[88px] h-auto flex flex-col items-center gap-[8px] rounded-[10px] transition-all duration-200 cursor-pointer " +
                  (isDockCompact ? "px-[8px] py-[10px] " : "p-[8px] ") +
                  (activePanel === "uploads"
                    ? "bg-white"
                    : hoveredButton === "upload"
                      ? "bg-[#E9E9E9]"
                      : "bg-transparent")
                }
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 5C9.55228 5 10 5.44772 10 6C10 6.51284 9.61396 6.93551 9.11662 6.99327L9 7H3C2.44772 7 2 6.55228 2 6C2 5.48716 2.38604 5.06449 2.88338 5.00673L3 5H9Z"
                    fill="black"
                  />
                  <path
                    d="M6.1499 2C6.66274 2 7.08541 2.38604 7.14317 2.88338L7.1499 3V9C7.1499 9.55228 6.70219 10 6.1499 10C5.63707 10 5.2144 9.61396 5.15663 9.11662L5.1499 9V3C5.1499 2.44772 5.59762 2 6.1499 2Z"
                    fill="black"
                  />
                  <path
                    d="M5 19V13C5 12.4477 5.44772 12 6 12C6.55228 12 7 12.4477 7 13V19C7 20.1046 7.89543 21 9 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7H13C12.4477 7 12 6.55228 12 6C12 5.44772 12.4477 5 13 5H19C21.2091 5 23 6.79086 23 9V19C23 21.2091 21.2091 23 19 23H9C6.79086 23 5 21.2091 5 19Z"
                    fill="black"
                  />
                  <path
                    d="M17.01 10C17.5623 10 18.01 10.4477 18.01 11C18.01 11.5128 17.624 11.9355 17.1266 11.9933L17.01 10Z"
                    fill="black"
                  />
                  <path
                    d="M9.30662 13.2797C10.5733 12.0608 12.2485 12.0157 13.5577 13.1563L13.7071 13.2931L18.7071 18.2931C19.0976 18.6836 19.0976 19.3168 18.7071 19.7073C18.3466 20.0678 17.7794 20.0955 17.3871 19.7905L17.2929 19.7073L12.3066 14.7208C11.8017 14.2349 11.3053 14.2025 10.8126 14.6127L10.7071 14.7073L6.70711 18.7073C6.31658 19.0979 5.68342 19.0979 5.29289 18.7073C4.93241 18.3468 4.90468 17.7796 5.2097 17.3873L5.29289 17.2931L9.30662 13.2797Z"
                    fill="black"
                  />
                  <path
                    d="M16.3066 15.2797C17.5733 14.0608 19.2485 14.0157 20.5577 15.1563L20.7071 15.2931L22.7071 17.2931C23.0976 17.6836 23.0976 18.3168 22.7071 18.7073C22.3466 19.0678 21.7794 19.0955 21.3871 18.7905L21.2929 18.7073L19.3066 16.7208C18.8017 16.2349 18.3053 16.2025 17.8126 16.6127L17.7071 16.7073L16.7071 17.7073C16.3166 18.0979 15.6834 18.0979 15.2929 17.7073C14.9324 17.3469 14.9047 16.7796 15.2097 16.3873L15.2929 16.2931L16.3066 15.2797Z"
                    fill="black"
                  />
                </svg>
                {!isDockCompact && (
                  <div className="text-[12px] font-[600] text-black text-center">Uploads</div>
                )}
                {isDockCompact && hoveredButton === "upload" && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                    Uploads
                  </span>
                )}
              </button>

              {/* Text Button */}
              <button
                type="button"
                onMouseEnter={() => setHoveredButton("text")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={addTextElement}
                className={
                  "relative w-[88px] h-auto flex flex-col items-center gap-[8px] rounded-[10px] transition-all duration-200 cursor-pointer " +
                  (isDockCompact ? "px-[8px] py-[10px] " : "p-[8px] ") +
                  (hoveredButton === "text" ? "bg-[#E9E9E9]" : "bg-transparent")
                }
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M13 3C13.353 3 13.6761 3.18574 13.8555 3.48242L13.916 3.59961L20.6533 19H21C21.5523 19 22 19.4477 22 20C22 20.5128 21.6135 20.9354 21.1162 20.9932L21 21H14C13.4477 21 13 20.5523 13 20C13 19.4872 13.3865 19.0646 13.8838 19.0068L14 19H14.4912L13.2207 16H7.56836L6.44336 19H7C7.55228 19 8 19.4477 8 20C8 20.5128 7.61355 20.9354 7.11621 20.9932L7 21H4C3.44772 21 3 20.5523 3 20C3 19.4872 3.38645 19.0646 3.88379 19.0068L4 19H4.30664L10.0635 3.64844C10.1952 3.29749 10.5106 3.05335 10.876 3.00781L11 3H13ZM11.2432 6.19922L16.6621 19H18.4707L12.3447 5H11.6934L11.2432 6.19922ZM8.31836 14H12.374L10.2227 8.91895L8.31836 14Z"
                    fill="black"
                  />
                </svg>
                {!isDockCompact && (
                  <div className="text-[12px] font-[600] text-black text-center">Text</div>
                )}
                {isDockCompact && hoveredButton === "text" && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                    Text
                  </span>
                )}
              </button>

              {/* Graphics Button */}
              <button
                type="button"
                onMouseEnter={() => setHoveredButton("graphics")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => togglePanel("graphics")}
                className={
                  "relative w-[88px] h-auto flex flex-col items-center gap-[8px] rounded-[10px] transition-all duration-200 cursor-pointer " +
                  (isDockCompact ? "px-[8px] py-[10px] " : "p-[8px] ") +
                  (activePanel === "graphics"
                    ? "bg-white"
                    : hoveredButton === "graphics"
                      ? "bg-[#E9E9E9]"
                      : "bg-transparent")
                }
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8.49998 13.0004C9.88069 13.0004 11 14.1197 11 15.5004V20.5004C10.9998 21.8809 9.88057 23.0004 8.49998 23.0004H3.49998C2.11949 23.0003 1.00019 21.8809 0.999983 20.5004V15.5004C0.999983 14.1197 2.11936 13.0005 3.49998 13.0004H8.49998ZM2.99998 21.0004H8.99998V15.0004H2.99998V21.0004Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M18 13.0004C20.7614 13.0004 23 15.239 23 18.0004C22.9998 20.7616 20.7613 23.0004 18 23.0004C15.2388 23.0003 13.0002 20.7616 13 18.0004C13 15.239 15.2386 13.0005 18 13.0004ZM18 15.0004C16.3432 15.0005 15 16.3436 15 18.0004C15.0002 19.657 16.3433 21.0003 18 21.0004C19.6567 21.0004 20.9998 19.6571 21 18.0004C21 16.3435 19.6568 15.0004 18 15.0004Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.85838 1.27089C7.99316 0.877739 9.26801 1.10931 10.1465 1.9369C10.9859 2.72814 11.2908 3.90489 10.9824 5.00331L10.9726 5.03456L10.9433 5.12538L10.9346 5.15272L10.9258 5.17909L10.918 5.19374L8.93553 11.0736L2.90721 9.49843L2.88963 9.49354L2.76463 9.45839L2.73631 9.45058C1.64397 9.10904 0.82264 8.20731 0.6201 7.06776C0.408388 5.87545 0.916702 4.67775 1.87303 3.94472C2.69941 3.31146 3.77647 3.08987 4.76854 3.35097C5.09875 2.38274 5.87752 1.61087 6.85838 1.27089ZM8.7744 3.39296C8.47376 3.10973 7.99182 2.99448 7.51268 3.16054C7.03145 3.32743 6.69477 3.7308 6.61522 4.1703C6.43507 5.16403 5.3576 5.74287 4.42967 5.34218C4.01879 5.16479 3.49455 5.22164 3.08885 5.53261C2.68532 5.84218 2.51648 6.31042 2.58885 6.71815C2.65622 7.09696 2.92761 7.41223 3.32811 7.53944L3.41307 7.56288L7.63573 8.6664L9.03221 4.53065L9.03905 4.49452L9.0449 4.47694L9.04783 4.46913L9.05565 4.44374C9.16902 4.03883 9.05457 3.6395 8.7744 3.39296Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16.5928 1.55995C17.0194 0.814059 18.0948 0.814105 18.5215 1.55995L22.9668 9.33827C23.3894 10.0788 22.8547 11.0002 22.0019 11.0004H13.1123C12.2596 11 11.7256 10.0788 12.1484 9.33827L16.5928 1.55995ZM14.7002 9.07655H20.414L17.5576 4.07655L14.7002 9.07655Z"
                    fill="currentColor"
                  />
                </svg>

                {!isDockCompact && (
                  <div className="text-[12px] font-[600] text-black text-center">Graphics</div>
                )}
                {isDockCompact && hoveredButton === "graphics" && (
                  <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                    Graphics
                  </span>
                )}
              </button>
            </div>

            {/* Bottom Section - Undo/Redo */}
            <div id="left-section-bottom-side" className="flex-shrink-0 flex flex-col gap-[2px]">
              {/* Undo Button - Disabled */}
              <div className="relative group/tooltip flex justify-center">
                <button
                  type="button"
                  disabled
                  aria-label="Undo"
                  className="w-[88px] h-auto flex flex-col items-center p-[8px] cursor-not-allowed opacity-50 pointer-events-none"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M9.70711 13.2929C10.0676 13.6534 10.0953 14.2206 9.7903 14.6129L9.70711 14.7071C9.34662 15.0676 8.77939 15.0953 8.3871 14.7903L8.29289 14.7071L4.29289 10.7071C4.2575 10.6717 4.22531 10.6343 4.19633 10.5953L4.12467 10.4841L4.07123 10.3713L4.03585 10.266L4.01102 10.1485L4.00398 10.0898L4 10L4.00279 9.92476L4.02024 9.79927L4.04974 9.68786L4.09367 9.57678L4.146 9.47929L4.2097 9.3871L4.29289 9.29289L8.29289 5.29289C8.68342 4.90237 9.31658 4.90237 9.70711 5.29289C10.0676 5.65338 10.0953 6.22061 9.7903 6.6129L9.70711 6.70711L7.415 9H16C18.7614 9 21 11.2386 21 14C21 16.6888 18.8777 18.8818 16.2169 18.9954L16 19H15C14.4477 19 14 18.5523 14 18C14 17.4872 14.386 17.0645 14.8834 17.0067L15 17H16C17.6569 17 19 15.6569 19 14C19 12.4023 17.7511 11.0963 16.1763 11.0051L16 11H7.415L9.70711 13.2929Z"
                      fill="#989898"
                    />
                  </svg>
                </button>
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                  Undo
                </span>
              </div>

              {/* Redo Button - Disabled */}
              <div className="relative group/tooltip flex justify-center">
                <button
                  type="button"
                  disabled
                  aria-label="Redo"
                  className="w-[88px] h-auto flex flex-col items-center p-[8px] cursor-not-allowed opacity-50 pointer-events-none"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M10 19H9C6.23 19 4 16.7618 4 14.0039C4 11.2361 6.23 9.00785 9 9.00785H17.59L15.29 6.71965V6.71865C14.89 6.31896 14.89 5.68946 15.29 5.29976C15.68 4.90008 16.31 4.90008 16.71 5.29976L20.71 9.29662V9.29563C20.8 9.38555 20.87 9.49547 20.92 9.62537C20.97 9.74527 20.99 9.86518 21 10.0051C20.99 10.135 20.97 10.2549 20.92 10.3848C20.87 10.5047 20.8 10.6146 20.71 10.7145L16.71 14.7114C16.31 15.1011 15.68 15.1011 15.29 14.7114C14.89 14.3117 14.89 13.6822 15.289 13.2925L17.589 11.0043H8.99C7.33 11.0043 5.99 12.3432 5.99 14.0019C5.99 15.6506 7.33 16.9996 8.99 16.9996H9.99C10.54 16.9996 10.99 17.4392 10.99 17.9988C10.99 18.5484 10.54 18.998 9.99 18.998L10 19Z"
                      fill="#989898"
                    />
                  </svg>
                </button>
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-neutral-900 p-3 text-sm text-neutral-100 shadow-sm opacity-0 group-hover/tooltip:opacity-100 transition-opacity z-50 before:content-[''] before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:w-0 before:h-0 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900">
                  Redo
                </span>
              </div>
            </div>
          </div>

          <div
            id="canvas-section"
            className="relative overflow-hidden flex-1 min-w-0 h-full bg-[#F4F4F4] rounded-[12px]"
          >
            <div
              ref={canvasScrollRef}
              className="absolute inset-0 flex overflow-auto"
              onClick={e => {
                if (e.target !== e.currentTarget) return
                if (activePanel) setActivePanel(null)
                setSelectedTextId(null)
                setTextColorPanelOpen(false)
                setFontPanelOpen(false)
              }}
            >
            <div
              className="relative m-auto shrink-0"
              style={{
                aspectRatio: canvasAspect,
                height: `calc(${60 * zoom}% + ${100 * zoom}px)`,
                transition: zoomAnimate ? "height 250ms ease-out" : "none",
              }}
              onClick={() => activePanel && setActivePanel(null)}
            >
              <img
                src={currentViewImage || "/placeholder.svg"}
                alt={productImages[activeColorIndex]?.alt || ""}
                className="h-full w-full object-contain"
              />
              {printAreaOverlay && (selectedTextId || editingTextId || selectedGraphicId) && (
                <svg
                  className="pointer-events-none absolute"
                  overflow="visible"
                  style={{
                    left: `${printAreaOverlay.left}%`,
                    top: `${printAreaOverlay.top}%`,
                    width: `${printAreaOverlay.width}%`,
                    height: `${printAreaOverlay.height}%`,
                  }}
                >
                  <rect
                    width="100%"
                    height="100%"
                    fill="none"
                    stroke="#6366F1"
                    strokeWidth="1"
                    strokeDasharray="10 4"
                  />
                </svg>
              )}

              {/* Text elements layer — same box as the print area, but interactive. */}
              {printAreaOverlay && (
                <div
                  ref={printAreaBoxRef}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${printAreaOverlay.left}%`,
                    top: `${printAreaOverlay.top}%`,
                    width: `${printAreaOverlay.width}%`,
                    height: `${printAreaOverlay.height}%`,
                  }}
                >
                  {snapGuides.v && (
                    <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 w-px bg-[#FF3B30] -translate-x-1/2" />
                  )}
                  {snapGuides.h && (
                    <div className="pointer-events-none absolute top-1/2 left-0 right-0 h-px bg-[#FF3B30] -translate-y-1/2" />
                  )}
                  {visibleTextElements.map(el =>
                    editingTextId === el.id ? (
                      (() => {
                        const box = measureTextBox(el.content, el.fontSize * zoom, el.fontFamily)
                        return (
                          <textarea
                            key={el.id}
                            autoFocus
                            value={el.content}
                            rows={1}
                            onChange={e => {
                              const v = e.target.value
                              setTextElements(prev =>
                                prev.map(t => (t.id === el.id ? { ...t, content: v } : t))
                              )
                            }}
                            onBlur={() => setEditingTextId(null)}
                            onKeyDown={e => {
                              if (e.key === "Escape")
                                (e.target as HTMLTextAreaElement).blur()
                            }}
                            onMouseDown={e => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              color: el.color,
                              fontSize: `${el.fontSize * zoom}px`,
                              fontFamily: `"${el.fontFamily}"`,
                              width: `${box.width + 4}px`,
                              height: `${box.height}px`,
                              minWidth: `${el.fontSize * zoom * 0.5}px`,
                              padding: 0,
                              margin: 0,
                              border: "none",
                              resize: "none",
                              overflow: "hidden",
                              whiteSpace: "pre",
                              boxShadow: "0 0 0 1px #6366F1",
                            }}
                            ref={node => {
                              if (!node) return
                              if (node.dataset.initialSelectDone === "1") return
                              node.setSelectionRange(0, node.value.length)
                              node.dataset.initialSelectDone = "1"
                            }}
                            data-text-element="true"
                            className="pointer-events-auto bg-transparent outline-none leading-none"
                          />
                        )
                      })()
                    ) : (
                      <div
                        key={el.id}
                        data-text-element="true"
                        ref={node => {
                          if (node) textElementRefs.current[el.id] = node
                          else delete textElementRefs.current[el.id]
                        }}
                        onMouseDown={e => startTextDrag(e, el)}
                        onDoubleClick={() => setEditingTextId(el.id)}
                        style={{
                          position: "absolute",
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          // Hide the flat glyphs while the stitched overlay is
                          // shown (avoids the flat/render double-image); keep the
                          // selection outline + handles visible.
                          color: embroideryShown ? "transparent" : el.color,
                          fontSize: `${el.fontSize * zoom}px`,
                          fontFamily: `"${el.fontFamily}"`,
                          whiteSpace: "pre",
                          // Size exactly to the text so the selection box + handles
                          // always wrap the rendered glyphs (no shrink-to-fit wrap
                          // from the absolutely-positioned containing block).
                          width: "max-content",
                          maxWidth: "none",
                          boxShadow:
                            selectedTextId === el.id ? "0 0 0 1px #6366F1" : undefined,
                        }}
                        className="pointer-events-auto select-none cursor-move leading-none"
                      >
                        {el.content}
                        {selectedTextId === el.id &&
                          (["nw", "ne", "sw", "se"] as const).map(corner => {
                            const cursor =
                              corner === "nw" || corner === "se"
                                ? "cursor-nwse-resize"
                                : "cursor-nesw-resize"
                            const pos =
                              corner === "nw"
                                ? "-top-[7.5px] -left-[7.5px]"
                                : corner === "ne"
                                  ? "-top-[7.5px] -right-[7.5px]"
                                  : corner === "sw"
                                    ? "-bottom-[7.5px] -left-[7.5px]"
                                    : "-bottom-[7.5px] -right-[7.5px]"
                            return (
                              <span
                                key={corner}
                                onMouseDown={e => startResize(e, el, corner)}
                                className={`absolute ${pos} ${cursor} z-30 block size-[15px] rounded-full border-2 border-[#6366F1] bg-white`}
                              />
                            )
                          })}
                      </div>
                    )
                  )}
                  {visibleGraphicElements.map(el => (
                    <div
                      key={el.id}
                      data-graphic-element="true"
                      ref={node => {
                        if (node) graphicElementRefs.current[el.id] = node
                        else delete graphicElementRefs.current[el.id]
                      }}
                      onMouseDown={e => startGraphicDrag(e, el)}
                      style={{
                        position: "absolute",
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                        boxShadow:
                          selectedGraphicId === el.id ? "0 0 0 1px #6366F1" : undefined,
                      }}
                      className="pointer-events-auto select-none cursor-move"
                    >
                      <img
                        src={el.src}
                        alt=""
                        draggable={false}
                        className={`pointer-events-none h-full w-full select-none object-contain ${
                          embroideryShown ? "opacity-0" : ""
                        }`}
                      />
                      {selectedGraphicId === el.id &&
                        (["nw", "ne", "sw", "se"] as const).map(corner => {
                          const cursor =
                            corner === "nw" || corner === "se"
                              ? "cursor-nwse-resize"
                              : "cursor-nesw-resize"
                          const pos =
                            corner === "nw"
                              ? "-top-[7.5px] -left-[7.5px]"
                              : corner === "ne"
                                ? "-top-[7.5px] -right-[7.5px]"
                                : corner === "sw"
                                  ? "-bottom-[7.5px] -left-[7.5px]"
                                  : "-bottom-[7.5px] -right-[7.5px]"
                          return (
                            <span
                              key={corner}
                              onMouseDown={e => startResize(e, el, corner, "graphic")}
                              className={`absolute ${pos} ${cursor} block size-[15px] rounded-full border-2 border-[#6366F1] bg-white`}
                            />
                          )
                        })}
                    </div>
                  ))}
                  {/* Stitched embroidery preview, overlaid on the design's
                      footprint. Pointer-events pass through so clicking an
                      element beneath selects it and reveals the editable version. */}
                  {embroideryShown && designBbox && embroideryRenderedUrl && (
                    <img
                      src={embroideryRenderedUrl}
                      alt=""
                      draggable={false}
                      // Purely visual: pointer-events pass straight through to the
                      // real (hidden) element wrappers underneath, so select / drag
                      // / delete work exactly like standard print — no fragile
                      // reverse hit-testing of a flattened bitmap.
                      className="pointer-events-none absolute select-none"
                      style={{
                        left: `${designBbox.x * 100}%`,
                        top: `${designBbox.y * 100}%`,
                        width: `${designBbox.w * 100}%`,
                        height: `${designBbox.h * 100}%`,
                      }}
                    />
                  )}
                  {/* While waiting to reveal the stitched render, a loader sits at
                      the top of the design (so it isn't hidden behind it): a black
                      circle with a light spinner. */}
                  {embroideryLoading && designBbox && (
                    <div
                      className={
                        embroideryEverShownRef.current
                          ? "pointer-events-none absolute flex items-center justify-center rounded-full bg-black p-2.5 shadow-lg"
                          : "pointer-events-none absolute flex items-center gap-2.5 rounded-full bg-black py-2.5 pr-4 pl-2.5 shadow-lg"
                      }
                      style={{
                        left: `${(designBbox.x + designBbox.w / 2) * 100}%`,
                        top: `${designBbox.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    >
                      <div className="h-7 w-7 shrink-0 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                      {!embroideryEverShownRef.current && (
                        <span className="text-sm font-medium whitespace-nowrap text-white">
                          Embroidery preview…
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Off-screen embroidery renderer — turns the flattened design into
                the stitched look whenever embroidery is the chosen technique. */}
            {effectivePrintTechnique === "embroidery" && embroiderySrc && (
              <EmbroideryPreview
                src={embroiderySrc}
                maxSize={620}
                onRendered={url => {
                  setEmbroideryRenderedUrl(url)
                  setEmbroideryRenderStale(false)
                }}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 1,
                  height: 1,
                }}
              />
            )}

            {/* Zoom control — vertical, bottom-left of the canvas area. Plus on
                top, minus at the bottom; the WedgeSlider is rotated upright. */}
            <div className="absolute bottom-6 left-6 z-[5] flex w-[48px] flex-col items-center gap-1 rounded-full bg-white py-2.5 shadow-xs">
              <div className="group/tooltip relative flex">
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => {
                    setZoomAnimate(true)
                    setZoom(z => Math.min(6, Math.round((z + 0.25) * 100) / 100))
                  }}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-black hover:bg-neutral-100"
                >
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10.8277 4.06952C10.7796 3.65507 10.4273 3.33337 9.99998 3.33337C9.53974 3.33337 9.16665 3.70647 9.16665 4.16671V9.16671H4.16665L4.06946 9.17231C3.65501 9.22045 3.33331 9.57268 3.33331 10C3.33331 10.4603 3.70641 10.8334 4.16665 10.8334H9.16665V15.8334L9.17225 15.9306C9.22039 16.345 9.57262 16.6667 9.99998 16.6667C10.4602 16.6667 10.8333 16.2936 10.8333 15.8334V10.8334H15.8333L15.9305 10.8278C16.3449 10.7796 16.6666 10.4274 16.6666 10C16.6666 9.5398 16.2935 9.16671 15.8333 9.16671H10.8333V4.16671L10.8277 4.06952Z"
                    />
                  </svg>
                </button>
                <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-neutral-900 p-3 text-sm whitespace-nowrap text-neutral-100 shadow-sm opacity-0 transition-opacity group-hover/tooltip:opacity-100 before:absolute before:top-1/2 before:right-full before:h-0 before:w-0 before:-translate-y-1/2 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900 before:content-['']">
                  Zoom in
                </span>
              </div>
              <div className="flex h-24 w-6 items-center justify-center">
                <div className="-rotate-90">
                  <WedgeSlider
                    min={1}
                    max={6}
                    value={zoom}
                    onChange={v => {
                      setZoomAnimate(false)
                      setZoom(v)
                    }}
                    width={96}
                  />
                </div>
              </div>
              <div className="group/tooltip relative flex">
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => {
                    setZoomAnimate(true)
                    setZoom(z => Math.max(1, Math.round((z - 0.25) * 100) / 100))
                  }}
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-black hover:bg-neutral-100"
                >
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M15.8333 9.16663C16.2935 9.16663 16.6666 9.53972 16.6666 9.99996C16.6666 10.4273 16.3449 10.7795 15.9305 10.8277L15.8333 10.8333H4.16665C3.70641 10.8333 3.33331 10.4602 3.33331 9.99996C3.33331 9.5726 3.65501 9.22037 4.06946 9.17223L4.16665 9.16663H15.8333Z"
                    />
                  </svg>
                </button>
                <span className="pointer-events-none absolute top-1/2 left-full z-50 ml-2 -translate-y-1/2 rounded-md bg-neutral-900 p-3 text-sm whitespace-nowrap text-neutral-100 shadow-sm opacity-0 transition-opacity group-hover/tooltip:opacity-100 before:absolute before:top-1/2 before:right-full before:h-0 before:w-0 before:-translate-y-1/2 before:border-y-[4px] before:border-y-transparent before:border-r-[4px] before:border-r-neutral-900 before:content-['']">
                  Zoom out
                </span>
              </div>
            </div>

            {/* View selector — single rounded button + dropdown of all views. */}
            {productData && productData.views.length > 1 && (
              <div
                data-view-dropdown
                className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
              >
                <div
                  className={`absolute bottom-full left-1/2 mb-2 flex origin-bottom -translate-x-1/2 gap-2 rounded-2xl bg-white p-6 shadow-xl transition-all duration-150 ease-out ${
                    viewDropdownOpen
                      ? "scale-100 opacity-100"
                      : "pointer-events-none scale-95 opacity-0"
                  }`}
                >
                    {productData.views.map(view => {
                      const thumb = currentAppearance?.views.find(v => v.id === view.id)?.image
                      const selected = activeViewId === view.id
                      const viewPaId = view.viewMaps[0]?.printAreaId
                      const viewOverlay = getPrintAreaOverlay(productData, view.id)
                      const viewTexts = textElements.filter(t => t.printAreaId === viewPaId)
                      const viewGraphics = graphicElements.filter(g => g.printAreaId === viewPaId)
                      return (
                        <button
                          key={view.id}
                          type="button"
                          onClick={() => {
                            setActiveViewId(view.id)
                            setViewDropdownOpen(false)
                          }}
                          className="group flex w-28 cursor-pointer flex-col items-center gap-1.5"
                        >
                          <div
                            className={`flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-[8px] border-2 px-1 py-2 ${
                              selected
                                ? "border-black bg-neutral-100"
                                : "border-transparent bg-neutral-100 group-hover:bg-neutral-200"
                            }`}
                          >
                            {thumb && (
                              <div className="relative h-[100px] w-[100px]">
                                <ViewDesignThumb
                                  image={thumb}
                                  overlay={viewOverlay}
                                  textElements={viewTexts}
                                  graphicElements={viewGraphics}
                                  displaySize={liveCanvasContentSize / zoom}
                                  size={100}
                                />
                              </div>
                            )}
                          </div>
                          <span
                            className={`text-center text-sm ${
                              selected
                                ? "font-semibold text-black"
                                : "text-neutral-800 group-hover:text-black"
                            }`}
                          >
                            {view.name}
                          </span>
                        </button>
                      )
                    })}
                </div>
                <button
                  type="button"
                  onClick={() => setViewDropdownOpen(o => !o)}
                  className="flex h-[48px] items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black shadow-xs hover:bg-neutral-50 cursor-pointer"
                >
                  <span>{currentView?.name ?? productData.views[0]?.name}</span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`text-neutral-500 transition-transform ${viewDropdownOpen ? "rotate-180" : ""}`}
                  >
                    <path
                      d="M2.5 4.5L6 8L9.5 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
            {/* Model circle (left) + print-technique selection (right), grouped
                at the bottom-right of the canvas. */}
            {(currentModelImage || productData?.embroidery) && (
              <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2">
                {currentModelImage && (
                  <div className="group/tooltip relative flex h-[48px] w-[48px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white p-1 shadow-xs">
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-neutral-900 p-3 text-sm whitespace-nowrap text-neutral-100 shadow-sm opacity-0 transition-opacity group-hover/tooltip:opacity-100 after:absolute after:top-full after:left-1/2 after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[4px] after:border-x-transparent after:border-t-[4px] after:border-t-neutral-900 after:content-['']">
                      See all pictures
                    </span>
                    <div className="h-full w-full overflow-hidden rounded-full bg-neutral-100">
                      <img
                        src={currentModelImage}
                        alt={`${productData?.name} on model`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                )}
                {productData?.embroidery && (
                  <Popover.Root
                    open={printTechniqueMenuOpen}
                    onOpenChange={setPrintTechniqueMenuOpen}
                  >
                    <Popover.Trigger asChild>
                      <button
                        type="button"
                        className="flex h-[48px] cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black shadow-xs hover:bg-neutral-50"
                      >
                        <span>
                          {printTechnique === "embroidery" ? "Embroidery" : "Standard print"}
                        </span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className={`text-neutral-500 transition-transform duration-200 ${
                            printTechniqueMenuOpen ? "rotate-180" : ""
                          }`}
                        >
                          <path
                            d="M2.5 4.5L6 8L9.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        side="top"
                        align="end"
                        sideOffset={8}
                        className="z-[100] w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg outline-none"
                      >
                        {(["embroidery", "standard"] as const).map(tech => (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => {
                              setPrintTechnique(tech)
                              setPrintTechniqueMenuOpen(false)
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-neutral-50 ${
                              printTechnique === tech ? "bg-neutral-100 font-semibold" : ""
                            }`}
                          >
                            <span>{tech === "embroidery" ? "Embroidery" : "Standard print"}</span>
                            {printTechnique === tech && (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M5 12.5L10 17.5L19 7"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        ))}
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}
              </div>
            )}

            {/* Print technique modal — same ScopedDialog infrastructure as product details. */}
            <ScopedDialog
              open={printTechniqueOpen}
              onOpenChange={setPrintTechniqueOpen}
              container={creatomatContainer}
              overlayClassName="rounded-[12px]"
              className="flex max-h-[85%] w-[480px] max-w-[90%] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 shadow-xl"
            >
              <div className="flex items-start justify-between gap-4 p-[24px] pb-[16px]">
                <ScopedDialogTitle className="font-display text-[18px] font-[800] leading-tight text-black">
                  Print technique
                </ScopedDialogTitle>
                <ScopedDialogClose
                  aria-label="Close"
                  className="shrink-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                >
                  <img src="/icons/icon-close-x.svg" alt="" className="h-6 w-6" />
                </ScopedDialogClose>
              </div>
              <div className="flex flex-col overflow-y-auto px-[24px] pb-[24px]">
                {/* Pills — sticky at the top of the scrollable body */}
                <div className="sticky top-0 z-10 -mx-[24px] bg-white px-[24px] pb-4">
                  <div className="flex w-full gap-1 rounded-full bg-[#f0f0f0] p-1">
                    {(["standard", "embroidery"] as const).map(technique => (
                      <button
                        key={technique}
                        type="button"
                        onClick={() => setPrintTechnique(technique)}
                        className={`flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full text-sm font-medium text-black transition-colors ${
                          printTechnique === technique ? "bg-white shadow-sm" : "bg-transparent"
                        }`}
                      >
                        {technique === "standard" ? "Standard print" : "Embroidery"}
                      </button>
                    ))}
                  </div>
                </div>

                {previewLoading ? (
                  <>
                    <div className="mb-4 h-[272px] w-full shrink-0 animate-pulse bg-neutral-200" />
                    <div className="aspect-square w-full shrink-0 animate-pulse bg-neutral-200" />
                  </>
                ) : (
                  <>
                    {/* Close-up: zoomed garment + flattened design (embroidery-rendered when selected).
                        Hidden when there's no design in the current print area. */}
                    {designDataUrl && printAreaOverlay && (
                  <div className="relative mb-4 h-[272px] w-full shrink-0 overflow-hidden bg-[#F4F4F4]">
                    <img
                      src={currentViewImage || "/placeholder.svg"}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{
                        transform: "scale(6)",
                        transformOrigin: `${printAreaOverlay.left + printAreaOverlay.width / 2}% ${printAreaOverlay.top + printAreaOverlay.height / 2}%`,
                      }}
                    />
                    {(() => {
                      const url =
                        printTechnique === "embroidery" ? embroideryRenderedUrl : designDataUrl
                      return url ? (
                        <div className="absolute inset-0 flex items-center justify-center p-10">
                          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-black">
                          Processing…
                        </span>
                      )
                    })()}
                  </div>
                )}

                {/* Full-width model image. For the Women's Premium Organic Top (943) the
                    rendered design is composited onto the model's chest; other products
                    show the plain model image. */}
                {currentModelImage && (
                  <div className="relative w-full shrink-0">
                    <img
                      src={currentModelImage}
                      alt={`${productData?.name} model`}
                      className="block w-full bg-[#F4F4F4]"
                    />
                    {productData?.id === "943" &&
                      designDataUrl &&
                      designBbox &&
                      (() => {
                        const url =
                          printTechnique === "embroidery" ? embroideryRenderedUrl : designDataUrl
                        if (!url) return null
                        // The 943 chest print-area footprint on the model image (% of image).
                        // Height derives from the print-area aspect so the design isn't distorted.
                        const paAspect =
                          printAreaPxSize.width > 0 && printAreaPxSize.height > 0
                            ? printAreaPxSize.height / printAreaPxSize.width
                            : 1.25
                        const regionW = 20 // % of image width — restricted chest print zone
                        const regionH = regionW * paAspect
                        const regionLeft = 48 - regionW / 2
                        const regionTop = 51 - regionH / 2
                        // Embroidery clamps the design to the max stitchable size.
                        const bbox =
                          printTechnique === "embroidery"
                            ? clampEmbroideryBbox(designBbox)
                            : designBbox
                        // Place the design at its true position/size within that region.
                        return (
                          <img
                            src={url}
                            alt=""
                            className="absolute"
                            style={{
                              left: `${regionLeft + bbox.x * regionW}%`,
                              top: `${regionTop + bbox.y * regionH}%`,
                              width: `${bbox.w * regionW}%`,
                              height: `${bbox.h * regionH}%`,
                              objectFit: "fill",
                            }}
                          />
                        )
                      })()}
                    {/* Embroidery size warning — overlaid on top of the model image. */}
                    {embroiderySizeWarning && (
                      <div className="pointer-events-none absolute top-2.5 right-2.5 left-2.5 flex flex-col gap-2 border border-[#EA580C] bg-white p-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#EA580C] text-[11px] leading-none font-bold text-white">
                            !
                          </span>
                          <span className="font-semibold text-[#C2410C]">Attention</span>
                        </div>
                        <span className="text-black">
                          We have to stitch your design smaller. This is the maximum size allowed.
                          Adjust your design if you are not happy with the result.
                        </span>
                      </div>
                    )}
                  </div>
                    )}
                  </>
                )}
              </div>
            </ScopedDialog>

            {(["graphics", "uploads", "ai"] as const).map(panel => (
              <div
                key={panel}
                className={`absolute z-30 inset-y-[2px] left-[2px] w-[375px] rounded-[12px] bg-white shadow-[32px_0px_50px_0px_rgba(0,0,0,0.05)] flex flex-col transition-transform duration-300 ease-out ${
                  activePanel === panel ? "translate-x-0" : "-translate-x-[calc(100%+100px)]"
                }`}
              >
                <h2 className="font-display text-[18px] font-medium text-black px-6 pt-6 pb-4 capitalize flex-shrink-0">
                  {panel === "ai" ? "AI Image" : panel}
                </h2>
                {panel === "uploads" && <UploadPanel onPlaceImage={addGraphicElement} />}
                {panel === "graphics" && (
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-3 gap-0">
                      {[
                        "/img/graphics/croco.png",
                        ...Array.from({ length: 16 }, (_, i) => `/img/graphics/graphics${i + 1}.png`),
                        ...Array.from({ length: 32 }, (_, i) => `/img/graphics/graphics${i + 17}.webp`),
                      ].map(src => (
                        <button
                          key={src}
                          type="button"
                          onClick={() => addGraphicElement(src)}
                          className="aspect-square flex items-center justify-center p-3 cursor-pointer overflow-hidden border-r border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                        >
                          <img
                            src={src}
                            alt=""
                            className="max-h-full max-w-full object-contain select-none"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Close ${panel} panel`}
                  onClick={() => setActivePanel(null)}
                  className="absolute -right-3.5 top-1/2 -translate-y-1/2 cursor-pointer rounded-2xl border border-neutral-200 bg-white px-0.5 py-3 hover:bg-neutral-50"
                >
                  <img src="/icons/icon-chevron-left.svg" alt="" className="size-6" />
                </button>
              </div>
            ))}

            <EditorBar
              show={!!selectedText}
              fontSize={selectedText?.fontSize ?? 32}
              fontFamily={selectedText?.fontFamily ?? DEFAULT_FONT_FAMILY}
              color={selectedText?.color ?? "#000000"}
              maxFontSize={maxFontSize}
              onFontSizeChange={size => updateSelectedText({ fontSize: size })}
              onFontFamilyClick={() =>
                setFontPanelOpen(o => {
                  const next = !o
                  if (next) setTextColorPanelOpen(false)
                  return next
                })
              }
              onColorClick={() =>
                setTextColorPanelOpen(o => {
                  const next = !o
                  if (next) setFontPanelOpen(false)
                  return next
                })
              }
              onDuplicate={duplicateSelectedText}
              onDelete={deleteSelectedText}
            />

            <GraphicEditorBar
              show={!!selectedGraphicId && !selectedText}
              onDuplicate={duplicateSelectedGraphic}
              onDelete={deleteSelectedGraphic}
            />

            <TextColorPanel
              open={textColorPanelOpen && !!selectedText}
              onClose={() => setTextColorPanelOpen(false)}
              currentColor={selectedText?.color ?? "#000000"}
              onChange={color => updateSelectedText({ color })}
            />

            <FontPanel
              open={fontPanelOpen && !!selectedText}
              onClose={() => setFontPanelOpen(false)}
              currentFontFamily={selectedText?.fontFamily ?? DEFAULT_FONT_FAMILY}
              onChange={family => updateSelectedText({ fontFamily: family })}
            />
          </div>

          <div
            ref={rightSectionRef}
            id="right-section"
            className="shrink-0 w-[470px] p-[24px] pb-3 overflow-y-auto h-full bg-[#F4F4F4] rounded-[12px] flex flex-col"
          >
            <div id="top-part" className="flex-shrink-0">
              <div className="flex items-start justify-between mb-[8px]">
                <h1 className="font-display text-[20px] font-[800] text-black leading-tight line-clamp-2">
                  {productData?.name ?? ""}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className="text-[14px] text-black underline cursor-pointer"
              >
                See product details
              </button>

              <div id="select-color" className="mb-8">
                <div className="w-full text-left text-[12px] uppercase font-bold text-[#6A6A6A] mb-[12px] tracking-[0.08em] mt-6">
                  COLOR: <span className="text-[#000000]">{selectedColor.toUpperCase()}</span>
                </div>
                {isColorScrollable ? (
                  <div className="relative">
                    <div
                      id="color-buttons-row"
                      ref={colorRowRef}
                      className="flex flex-nowrap gap-[6px] overflow-x-auto"
                    >
                      {productImages.map((img, index) => (
                        <button
                          key={index}
                          type="button"
                          className={
                            "shrink-0 w-[50px] h-[50px] p-[6px] box-border rounded-[8px] flex items-center justify-center overflow-hidden cursor-pointer select-none border " +
                            (activeColorIndex === index
                              ? "bg-white border-black rounded-[8px]"
                              : "bg-transparent border-transparent hover:bg-[#E9E9E9]")
                          }
                          onClick={() => setActiveColorIndex(index)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setActiveColorIndex(index)
                            }
                          }}
                          tabIndex={0}
                        >
                          <img
                            src={img.src || "/placeholder.svg"}
                            alt={img.alt}
                            className="max-w-full max-h-full object-contain block"
                          />
                        </button>
                      ))}
                    </div>

                    {/* Edge fades for color row */}
                    {canScrollColorLeft ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 top-0 h-full w-[64px] z-[10]"
                        style={{
                          background: "linear-gradient(to right, rgba(244,244,244,1), rgba(244,244,244,0))",
                        }}
                      />
                    ) : null}

                    {canScrollColorRight ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute right-0 top-0 h-full w-[64px] z-[10]"
                        style={{
                          background: "linear-gradient(to right, rgba(244,244,244,0), rgba(244,244,244,1))",
                        }}
                      />
                    ) : null}

                    {/* Scroll arrows for color row */}
                    {canScrollColorLeft ? (
                      <button
                        type="button"
                        aria-label="Scroll left"
                        onClick={() => scrollColorByPx(-100)}
                        className={
                          "absolute left-[-16px] top-1/2 -translate-y-1/2 z-[20] " +
                          "h-[32px] w-[32px] rounded-full bg-white " +
                          "border border-[#DEDEDE] shadow-sm " +
                          "flex items-center justify-center cursor-pointer"
                        }
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M8.75 3.5L5.25 7L8.75 10.5"
                            stroke="black"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : null}

                    {canScrollColorRight ? (
                      <button
                        type="button"
                        aria-label="Scroll right"
                        onClick={() => scrollColorByPx(100)}
                        className={
                          "absolute right-[-16px] top-1/2 -translate-y-1/2 z-[20] " +
                          "h-[32px] w-[32px] rounded-full bg-white " +
                          "border border-[#DEDEDE] shadow-sm " +
                          "flex items-center justify-center cursor-pointer"
                        }
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M5.25 3.5L8.75 7L5.25 10.5"
                            stroke="black"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-8 gap-[6px]">
                    {productImages.map((img, index) => (
                      <button
                        key={index}
                        type="button"
                        className={
                          "aspect-square w-full p-[6px] box-border flex items-center justify-center overflow-hidden cursor-pointer select-none border rounded-[8px] " +
                          (activeColorIndex === index
                            ? "bg-white border-black rounded-[8px]"
                            : "bg-transparent border-transparent hover:bg-[#E9E9E9]")
                        }
                        onClick={() => setActiveColorIndex(index)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setActiveColorIndex(index)
                          }
                        }}
                        tabIndex={0}
                      >
                        <img
                          src={img.src || "/placeholder.svg"}
                          alt={img.alt}
                          className="max-w-full max-h-full object-contain block"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div id="bottom-part" className="flex-shrink-0 mt-auto">
              

              <div className="flex mb-[12px] flex-row items-end justify-between gap-x-2 ml-0">
  {totalSelected > 0 ? (
    <span className="min-w-0 text-[14px] font-medium font-sans tracking-[0] text-[#DC2626]">
      {getVolumeDiscountText(totalSelected)}
    </span>
  ) : (
    (outOfStockMap[appearances[activeColorIndex]?.id] ?? []).length > 0 ? (
      <span className="min-w-0 text-[14px] font-medium font-sans tracking-[0] text-[var(--sprd-neutral-700)]">
        {(outOfStockMap[appearances[activeColorIndex]?.id] ?? []).join(", ")} out of stock
      </span>
    ) : <span />
  )}

  <button
    type="button"
    className="shrink-0 whitespace-nowrap text-[14px] font-sans underline text-black hover:cursor-pointer font-normal"
    onClick={(e) => e.preventDefault()}
  >
    Size guide
  </button>
</div>


              {/* Size buttons commented out — replaced by "Choose size" placeholder.
              <div id="size-buttons-row" className="flex flex-wrap gap-[8px] overflow-x-hidden mb-0">
                {sizes.map((label) => (
                  <SizeSelectorButton
                    key={`${label}-${activeColorIndex}`}
                    label={label}
                    disabled={outOfStockMap[appearances[activeColorIndex]?.id]?.includes(label)}
                    onQuantityChange={(delta) => setTotalSelected((t) => Math.max(0, t + delta))}
                    showCaret={totalSelected > 0}
                  />
                ))}
              </div>
              */}
              {!hasMounted ? (
                <button
                  type="button"
                  className="inline-flex w-full h-12 items-center justify-between gap-3 cursor-pointer font-sans text-sm font-semibold px-3 border-2 border-[var(--sprd-neutral-300)] bg-transparent text-black outline-none transition-colors hover:border-black focus:border-black focus-visible:border-black active:border-black"
                >
                  {sizeButtonLabel}
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 7.5L10 12.5L15 7.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              ) : (
              <Popover.Root open={sizePopoverOpen} onOpenChange={setSizePopoverOpen}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className={`inline-flex w-full h-12 items-center justify-between gap-3 cursor-pointer font-sans text-sm font-semibold px-3 border-2 ${
                      selectedSizes.length > 0
                        ? "border-black font-bold bg-white"
                        : "border-[var(--sprd-neutral-300)] bg-transparent hover:border-black focus:border-black focus-visible:border-black active:border-black data-[state=open]:border-black"
                    } ${flashSize ? "flash-red-border" : ""} text-black outline-none focus:outline-none focus-visible:outline-none focus-within:outline-none`}
                  >
                    {sizeButtonLabel}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={`size-5 flex-shrink-0 ${
                        sizePopoverOpen ? "rotate-180" : "rotate-0"
                      }`}
                      aria-hidden="true"
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    side="top"
                    sideOffset={isDockCompact ? -48 : 0}
                    align="start"
                    collisionPadding={12}
                    collisionBoundary={
                      rightSectionRef.current ? [rightSectionRef.current] : undefined
                    }
                    className="relative z-50 flex flex-col bg-white shadow-lg outline-none overflow-hidden rounded-t-[12px]"
                    style={{
                      width: "var(--radix-popover-trigger-width)",
                      maxHeight: "var(--radix-popover-content-available-height)",
                    }}
                  >
                    <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 bg-white">
                      <div className="text-[14px] font-medium text-[var(--sprd-red-600)]">
                        {discountTierHint}
                      </div>
                      <Popover.Close
                        aria-label="Close"
                        className="cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                      >
                        <img src="/icons/icon-close-x.svg" alt="" className="h-6 w-6" />
                      </Popover.Close>
                    </div>
                    <div
                      ref={sizePopoverScrollRef}
                      className="flex-1 overflow-y-auto"
                    >
                      {sizes.map(label => {
                        const isOOS = outOfStockMap[
                          appearances[activeColorIndex]?.id
                        ]?.includes(label)
                        const qty = sizeQuantities[label] ?? 0
                        return (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-2 border-b border-neutral-200 px-6 py-3"
                          >
                            <span
                              className={`text-md font-bold text-black ${
                                isOOS ? "opacity-30" : ""
                              }`}
                            >
                              {label}
                            </span>
                            <div className="flex items-center gap-4">
                              {isOOS && (
                                <span className="text-sm text-[var(--sprd-neutral-700)]">
                                  Out of stock
                                </span>
                              )}
                              <div
                                className={`flex w-fit items-center border border-neutral-200 ${
                                  isOOS ? "opacity-60 pointer-events-none" : ""
                                }`}
                              >
                              <button
                                type="button"
                                aria-label="Decrease"
                                disabled={qty <= 0}
                                onClick={() => setSizeQuantity(label, qty - 1)}
                                className="p-1.5 border-r border-neutral-200 cursor-pointer hover:bg-neutral-100 active:bg-white disabled:opacity-50 disabled:pointer-events-none"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  className="w-5 h-5"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M15.8333 9.16663C16.2935 9.16663 16.6666 9.53972 16.6666 9.99996C16.6666 10.4273 16.3449 10.7795 15.9305 10.8277L15.8333 10.8333H4.16665C3.70641 10.8333 3.33331 10.4602 3.33331 9.99996C3.33331 9.5726 3.65501 9.22037 4.06946 9.17223L4.16665 9.16663H15.8333Z"
                                  />
                                </svg>
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={qty === 0 ? "" : String(qty)}
                                placeholder="0"
                                aria-label={`${label} quantity`}
                                onChange={e => {
                                  const digits = e.target.value
                                    .replace(/[^0-9]/g, "")
                                    .slice(0, 5)
                                  setSizeQuantity(label, digits === "" ? 0 : Number(digits))
                                }}
                                className="w-12 self-stretch text-center text-sm outline-none placeholder:text-black focus:placeholder:text-transparent"
                              />
                              <button
                                type="button"
                                aria-label="Increase"
                                onClick={() => setSizeQuantity(label, qty + 1)}
                                className="p-1.5 border-l border-neutral-200 cursor-pointer hover:bg-neutral-100 active:bg-white"
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  className="w-5 h-5"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M10.8277 4.06952C10.7796 3.65507 10.4273 3.33337 9.99998 3.33337C9.53974 3.33337 9.16665 3.70647 9.16665 4.16671V9.16671H4.16665L4.06946 9.17231C3.65501 9.22045 3.33331 9.57268 3.33331 10C3.33331 10.4603 3.70641 10.8334 4.16665 10.8334H9.16665V15.8334L9.17225 15.9306C9.22039 16.345 9.57262 16.6667 9.99998 16.6667C10.4602 16.6667 10.8333 16.2936 10.8333 15.8334V10.8334H15.8333L15.9305 10.8278C16.3449 10.7796 16.6666 10.4274 16.6666 10C16.6666 9.5398 16.2935 9.16671 15.8333 9.16671H10.8333V4.16671L10.8277 4.06952Z"
                                  />
                                </svg>
                              </button>
                            </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              )}

              {/* Price and CTA section */}
              <div className="flex items-center justify-between gap-[16px] mt-5 mb-3">
                <div className="flex flex-col relative">
                  {totalSelected >= 5 && discountPercent > 0 ? (
                    <span className="text-[12px] text-[#6A6A6A] line-through mb-1 absolute mt-[-16px] font-medium">
                      {formattedOriginalPrice} €
                    </span>
                  ) : null}
                  <span
                    className={`text-[24px] font-medium leading-7 ${
                      totalSelected >= 5 && discountPercent > 0 ? "text-[#DC2626]" : "text-black"
                    }`}
                  >
                    {formattedDiscountedPrice} €
                  </span>
                  <span className="text-[14px] text-black underline cursor-pointer font-normal leading-5">Price details</span>
                </div>
                <button
                  type="button"
                  disabled={addingToBasket || flashSize}
                  onClick={() => {
                    if (addingToBasket || flashSize) return
                    if (totalSelected === 0) {
                      setFlashSize(true)
                      setTimeout(() => setFlashSize(false), 2000)
                      return
                    }
                    if (!productData) return
                    const currentApp = appearances[activeColorIndex]
                    if (!currentApp) return
                    const designSnapshot =
                      printAreaOverlay && printAreaPxSize.width > 0 && printAreaPxSize.height > 0
                        ? {
                            textElements: visibleTextElements.map(t => ({ ...t })),
                            graphicElements: visibleGraphicElements.map(g => ({ ...g })),
                            printAreaOverlay,
                            displayWidth:
                              (printAreaPxSize.width * 100) / printAreaOverlay.width,
                            displayHeight:
                              (printAreaPxSize.height * 100) / printAreaOverlay.height,
                          }
                        : undefined
                    setAddingToBasket(true)
                    setTimeout(() => {
                      const newItems: BasketItem[] = Object.entries(sizeQuantities)
                        .filter(([, qty]) => qty > 0)
                        .map(([size, qty]) => ({
                          id: `cart-${Date.now()}-${size}`,
                          productName: productData.name,
                          appearanceName: currentApp.name,
                          image: currentViewImage || currentApp.image,
                          size,
                          qty,
                          price: unitPrice,
                          design: designSnapshot,
                        }))
                      setBasketItems(prev => [...prev, ...newItems])
                      setSizeQuantities({})
                      setAddingToBasket(false)
                      setBasketOpen(true)
                    }, ADD_TO_BASKET_DELAY)
                  }}
                  className={`flex-1 text-white font-sans text-[14px] font-semibold px-[24px] flex items-center justify-center transition-colors h-12 overflow-hidden ${
                    flashSize
                      ? "bg-[#999] cursor-not-allowed"
                      : addingToBasket
                        ? "bg-black cursor-not-allowed"
                        : "bg-black cursor-pointer hover:bg-[#333]"
                  }`}
                >
                  {addingToBasket ? (
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="flex-1" />
                      <span
                        key={loadingTextIdx}
                        className="inline-block text-sm animate-in fade-in duration-200"
                      >
                        {LOADING_TEXTS[loadingTextIdx]}
                      </span>
                      <span className="flex flex-1 justify-end">
                        <IconsScroller />
                      </span>
                    </span>
                  ) : (
                    "Add to basket"
                  )}
                </button>
              </div>

{/* Divider */}
              

{/* Returns section */}
              

              {/* Divider */}
              <div className="w-full h-px bg-[#E9E9E9] mb-3" />
              

              {/* Shipping + return info as two columns */}
              <div className="flex flex-row items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[14px] text-black py-0.5 rounded-xs text-left px-0 font-medium">
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.66602 2.66699C9.00787 2.66699 9.28957 2.92435 9.32812 3.25586L9.33301 3.33398H12C12.2048 3.33408 12.3961 3.42801 12.5215 3.58594L12.5713 3.65723L14.5713 6.99023L14.5957 7.03516L14.624 7.10059L14.6504 7.18848L14.6631 7.2666L14.666 7.33398V11.334C14.6659 11.6757 14.4086 11.9576 14.0771 11.9961L14 12H13.2168C12.9421 12.7766 12.2036 13.334 11.333 13.334C10.4624 13.334 9.72391 12.7766 9.44922 12H6.5498C6.27509 12.7765 5.53662 13.334 4.66602 13.334C3.79548 13.3338 3.05685 12.7765 2.78223 12H2C1.65811 12 1.3764 11.7427 1.33789 11.4111L1.33301 11.334V4C1.33318 3.29739 1.87682 2.722 2.56641 2.6709L2.66602 2.66699H8.66602ZM4.66602 10.667C4.30015 10.6672 4.00252 10.9621 3.99902 11.3271L4 11.334C4 11.3356 3.99904 11.3372 3.99902 11.3389C4.00182 11.7046 4.29971 12.0008 4.66602 12.001C5.0341 12.001 5.33283 11.702 5.33301 11.334C5.33301 10.9658 5.03421 10.667 4.66602 10.667ZM11.333 10.667C10.9648 10.667 10.666 10.9658 10.666 11.334C10.6662 11.702 10.9649 12.001 11.333 12.001C11.7011 12.001 11.9998 11.702 12 11.334C12 10.9658 11.7012 10.667 11.333 10.667ZM9.33301 10.667H9.44922C9.72399 9.89059 10.4625 9.33398 11.333 9.33398C12.2035 9.33398 12.942 9.89059 13.2168 10.667H13.333V8H9.33301V10.667ZM2.66602 10.667H2.78223C3.05693 9.89064 3.79559 9.33412 4.66602 9.33398C5.53651 9.33398 6.275 9.89065 6.5498 10.667H8V4H2.66602V10.667ZM9.33301 6.66699H12.8223L11.6221 4.66699H9.33301V6.66699Z" fill="#000000"/>
                  </svg>
                  Dec. 13-15 or
                  <span className="text-[14px] text-black font-regular underline px-0 py-0">
                    faster
                  </span>
                </span>

                <span className="flex items-center gap-1.5 text-[14px] text-black py-0.5 rounded-xs text-left px-0 font-medium">
                  <img src="/icons/icon-refresh.svg" alt="" className="h-5 w-5" />
                  30-Day easy returns
                </span>
              </div>

              

            </div>
          </div>

          <ScopedDialog
            open={welcomeOpen}
            onOpenChange={open => {
              if (!open) window.history.pushState({ from: "onboarding" }, "")
              setWelcomeOpen(open)
            }}
            container={creatomatContainer}
            overlayClassName="rounded-[12px]"
            className="w-[440px] max-w-[90%] rounded-2xl bg-white p-[24px] shadow-xl"
          >
            <div className="flex items-center justify-between">
              <ScopedDialogTitle
                className="font-display text-[16px] font-medium leading-tight bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #DC2626 -0.88%, #1D4ED8 49.94%, #16A34A 101.36%)",
                }}
              >
                Start here to customize
              </ScopedDialogTitle>
              <ScopedDialogClose aria-label="Close" className="cursor-pointer outline-none focus:outline-none focus-visible:outline-none">
                <img src="/icons/icon-close-x.svg" alt="" className="h-6 w-6" />
              </ScopedDialogClose>
            </div>

            <div className="mt-5 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => openFromOnboarding(() => setProductsDrawerOpen(true))}
                className="flex flex-col items-center gap-[10px] rounded-[12px] bg-neutral-100 px-[29px] py-[17px] cursor-pointer transition-colors hover:bg-neutral-200"
              >
                <img
                  src="/images/blankproduct.png"
                  alt=""
                  className="h-14 w-14 object-contain"
                />
                <span className="text-[14px] font-semibold text-black">Choose Product</span>
              </button>

              <span className="text-[14px] font-medium text-[#6A6A6A]">or</span>

              <div className="flex gap-1 rounded-[12px] bg-neutral-100 p-2">
                {(
                  [
                    { id: "graphics", label: "Graphics", icon: "/icons/icon-graphics.svg", panel: "graphics" as const },
                    { id: "upload", label: "Upload", icon: "/icons/icon-upload.svg", panel: "uploads" as const },
                    { id: "text", label: "Text", icon: "/icons/icon-text.svg" },
                    { id: "ai", label: "AI Image", icon: "/icons/icon-sparkles-ai.svg", panel: "ai" as const },
                  ] as const
                ).map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      if (a.id === "text") {
                        openFromOnboarding(() => addTextElement())
                        return
                      }
                      if (!("panel" in a)) return
                      openFromOnboarding(() => setActivePanel(a.panel))
                    }}
                    className="flex flex-col items-center gap-[6px] min-w-[88px] cursor-pointer rounded-[8px] px-3 py-2 transition-colors hover:bg-white"
                  >
                    <img src={a.icon} alt="" className="h-6 w-6" />
                    <span className="text-[14px] font-semibold text-black">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </ScopedDialog>

          <ScopedDialog
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            container={creatomatContainer}
            overlayClassName="rounded-[12px]"
            className="flex max-h-[80%] w-[480px] max-w-[90%] flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 p-[24px] pb-[16px]">
              <ScopedDialogTitle className="font-display text-[18px] font-[800] leading-tight text-black">
                {productData?.name ?? "Product details"}
              </ScopedDialogTitle>
              <ScopedDialogClose
                aria-label="Close"
                className="shrink-0 cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
              >
                <img src="/icons/icon-close-x.svg" alt="" className="h-6 w-6" />
              </ScopedDialogClose>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto px-[24px] pb-[24px] text-[14px] text-black">
              {productData?.details.shortDescription && (
                <p className="leading-relaxed text-neutral-700">
                  {productData.details.shortDescription}
                </p>
              )}

              {productData?.details.description && (
                <div
                  className="leading-relaxed text-neutral-700 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: productData.details.description }}
                />
              )}

              <dl className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
                {productData?.details.brand && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Brand</dt>
                    <dd className="text-right font-medium">{productData.details.brand}</dd>
                  </div>
                )}
                {productData?.details.sizeFitHint && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Fit</dt>
                    <dd className="text-right font-medium capitalize">
                      {productData.details.sizeFitHint}
                    </dd>
                  </div>
                )}
                {!!productData?.details.weight && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Weight</dt>
                    <dd className="text-right font-medium">
                      {Math.round(productData.details.weight)} g
                    </dd>
                  </div>
                )}
                {!!productData?.sizes.length && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Sizes</dt>
                    <dd className="text-right font-medium">
                      {productData.sizes.map(s => s.name).join(", ")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </ScopedDialog>
        </div>
        </div>
        </div>
      </div>

      <Basket
        open={basketOpen}
        onClose={() => setBasketOpen(false)}
        items={basketItems}
        onQuantityChange={(id, qty) =>
          setBasketItems(prev => prev.map(it => (it.id === id ? { ...it, qty } : it)))
        }
        onRemove={id => setBasketItems(prev => prev.filter(it => it.id !== id))}
      />

      <ProductsDrawer
        open={productsDrawerOpen}
        onOpenChange={setProductsDrawerOpen}
        onSelect={setSelectedProduct}
      />

    </>
  )
}

// Miniature preview of a view with its placed design composited on the print
// area — same approach as the basket's DesignThumbnail. Renders the product at
// its on-screen display size, then scales the whole thing down to `size`.
function ViewDesignThumb({
  image,
  overlay,
  textElements,
  graphicElements,
  displaySize,
  size,
}: {
  image: string
  overlay: { left: number; top: number; width: number; height: number } | null
  textElements: { id: string; x: number; y: number; color: string; fontSize: number; fontFamily: string; content: string }[]
  graphicElements: { id: string; x: number; y: number; width: number; height: number; src: string }[]
  displaySize: number
  size: number
}) {
  const hasDesign =
    overlay && displaySize > 0 && (textElements.length > 0 || graphicElements.length > 0)
  if (!hasDesign) {
    return <img src={image} alt="" className="h-full w-full object-contain" />
  }
  const scale = size / displaySize
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: displaySize,
        height: displaySize,
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <img
        src={image}
        alt=""
        className="pointer-events-none h-full w-full object-contain select-none"
      />
      <div
        style={{
          position: "absolute",
          left: `${overlay.left}%`,
          top: `${overlay.top}%`,
          width: `${overlay.width}%`,
          height: `${overlay.height}%`,
        }}
      >
        {textElements.map(el => (
          <div
            key={el.id}
            style={{
              position: "absolute",
              left: `${el.x}%`,
              top: `${el.y}%`,
              color: el.color,
              fontSize: `${el.fontSize}px`,
              fontFamily: `"${el.fontFamily}"`,
              whiteSpace: "pre",
              lineHeight: 1,
            }}
          >
            {el.content}
          </div>
        ))}
        {graphicElements.map(el => (
          <img
            key={el.id}
            src={el.src}
            alt=""
            className="pointer-events-none select-none"
            style={{
              position: "absolute",
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              objectFit: "contain",
            }}
          />
        ))}
      </div>
    </div>
  )
}

// Pill shown inside the "Choose size" trigger button. Latches the displayed
// quantity for the duration of the collapse transition so the layout has
// something to clip while the wrapper's max-width animates down to 0.
function SizePill({
  size,
  qty,
  exiting,
}: {
  size: string
  qty: number
  exiting: boolean
}) {
  const [displayQty, setDisplayQty] = useState(qty)
  useEffect(() => {
    if (qty > 1) {
      setDisplayQty(qty)
      return
    }
    // qty just dropped to <= 1: keep displaying the previous value so the
    // max-width transition has content to clip, then update after 300ms.
    const timer = setTimeout(() => setDisplayQty(qty), 300)
    return () => clearTimeout(timer)
  }, [qty])
  return (
    <span
      className={`${
        exiting ? "size-pill-pop-out" : "size-pill-pop"
      } flex flex-shrink-0 items-center bg-black text-white rounded-none px-2 py-1`}
    >
      <span>{size}</span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          overflow: "hidden",
          maxWidth: qty > 1 ? 80 : 0,
          transition: "max-width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          whiteSpace: "nowrap",
        }}
      >
        {displayQty > 1 && (
          <>
            <span
              aria-hidden="true"
              className="mx-[6px] h-3 w-px bg-[var(--sprd-neutral-800)]"
            />
            <span className="font-normal opacity-70">{displayQty}x</span>
          </>
        )}
      </span>
    </span>
  )
}

type SizeSelectorButtonProps = {
  label: string
  disabled?: boolean
  onQuantityChange: (delta: number) => void
  showCaret?: boolean
}

function SizeSelectorButton({ label, disabled = false, onQuantityChange, showCaret = false }: SizeSelectorButtonProps) {
  const [value, setValue] = useState("")
  const [isRemoved, setIsRemoved] = useState(true)
  const prevQtyRef = useRef(0)

  useEffect(() => {
    const qty = isRemoved ? 0 : Number.parseInt(value || "0", 10) || 0
    const prev = prevQtyRef.current
    if (qty !== prev) {
      onQuantityChange(qty - prev)
      prevQtyRef.current = qty
    }
  }, [value, isRemoved, onQuantityChange])

  return (
    <XLButton
      label={label}
      value={value}
      onValueChange={setValue}
      isRemoved={isRemoved}
      setIsRemoved={setIsRemoved}
      disabled={disabled}
      showCaret={showCaret}
    />
  )
}

type XLButtonProps = {
  label: string
  value: string
  onValueChange: (next: string) => void
  isRemoved: boolean
  setIsRemoved: (next: boolean) => void
  disabled?: boolean
  showCaret?: boolean
}

type DropdownPos = {
  top: number
  left: number
  width: number
}

type TooltipPos = {
  top: number
  left: number
}

export function XLButton({ label, value, onValueChange, isRemoved, setIsRemoved, disabled = false, showCaret = false }: XLButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [isInputHover, setIsInputHover] = useState(false)
  const [isInputActive, setIsInputActive] = useState(false)
  const [isDisabledHover, setIsDisabledHover] = useState(false)

  const rootRef = useRef<HTMLButtonElement | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const measureRef = useRef<HTMLSpanElement | null>(null)
  const [inputPxWidth, setInputPxWidth] = useState<number>(0)

  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos | null>(null)

  const options = useMemo(() => {
    const nums = Array.from({ length: 5 }, (_, i) => String(i + 1))
    nums.push("More")
    return hasSelection ? ["Remove", ...nums] : nums
  }, [hasSelection])

  useEffect(() => {
    if (disabled) return
    if (isRemoved) {
      if (hasSelection) setHasSelection(false)
    } else {
      if (!hasSelection) setHasSelection(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRemoved, disabled])

  useLayoutEffect(() => {
    if (isRemoved || disabled) return
    const el = measureRef.current
    if (!el) return

    const text = value.length ? value : "0"
    el.textContent = text

    const w = Math.ceil(el.getBoundingClientRect().width)
    setInputPxWidth(w)
  }, [value, isRemoved, disabled])

  const recomputeDropdownPos = () => {
    const btn = rootRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setDropdownPos({
      top: Math.round(r.top) - 6,
      left: Math.round(r.right),
      width: Math.round(r.width),
    })
  }

  const recomputeTooltipPos = () => {
    const btn = rootRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    setTooltipPos({
      top: Math.round(r.top) - 8,
      left: Math.round(r.left + r.width / 2),
    })
  }

  useEffect(() => {
    if (!isOpen) return

    recomputeDropdownPos()

    const onDocMouseDown = (e: MouseEvent) => {
      const root = rootRef.current
      const dd = dropdownRef.current
      if (!root) return

      if (e.target instanceof Node) {
        if (root.contains(e.target)) return
        if (dd && dd.contains(e.target)) return
      }
      setIsOpen(false)
    }

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }

    const onReposition = () => recomputeDropdownPos()

    // ✅ removed #size-buttons-row scroll listener
    window.addEventListener("scroll", onReposition, { passive: true })
    window.addEventListener("resize", onReposition)

    document.addEventListener("mousedown", onDocMouseDown)
    document.addEventListener("keydown", onDocKeyDown)

    return () => {
      window.removeEventListener("scroll", onReposition)
      window.removeEventListener("resize", onReposition)
      document.removeEventListener("mousedown", onDocMouseDown)
      document.removeEventListener("keydown", onDocKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!disabled || !isDisabledHover) {
      setTooltipPos(null)
      return
    }

    recomputeTooltipPos()

    const onReposition = () => recomputeTooltipPos()

    // ✅ removed #size-buttons-row scroll listener
    window.addEventListener("scroll", onReposition, { passive: true })
    window.addEventListener("resize", onReposition)

    return () => {
      window.removeEventListener("scroll", onReposition)
      window.removeEventListener("resize", onReposition)
    }
  }, [disabled, isDisabledHover])

  const toggleDropdown = () => setIsOpen((v) => !v)

  const pick = (opt: string) => {
    if (opt === "More") {
      setIsRemoved(false)
      setHasSelection(true)
      onValueChange("")
      setIsOpen(false)
      // Focus the input after state updates
      setTimeout(() => {
        inputRef.current?.focus()
      }, 0)
      return
    }

    const next = applyDropdownPick(opt)

    if (next.removed) {
      setIsRemoved(true)
      setIsInputHover(false)
      setHasSelection(false)
      onValueChange("")
    } else {
      setIsRemoved(false)
      setHasSelection(true)
      onValueChange(next.value)
    }

    setIsOpen(false)
  }

  const isLockedActive = isOpen && !disabled
  const isSelectedState = hasSelection && !isOpen && !disabled && !isInputHover && !isInputActive

  return (
    <>
      <button
        ref={rootRef}
        type="button"
        onMouseEnter={() => {
          if (disabled) setIsDisabledHover(true)
        }}
        onMouseLeave={() => {
          if (disabled) setIsDisabledHover(false)
        }}
        onMouseDown={(e) => {
          if (disabled) return
          if (!isRemoved && (isInputHover || isInputActive)) return
          e.preventDefault()
          toggleDropdown()
        }}
        className={
          "group relative inline-flex items-center justify-center gap-[4px] " +
          "h-[36px] min-w-[36px] px-[8px] py-[2px] " +
          (disabled
            ? "bg-[#E8E8E8] "
            : isLockedActive
              ? "bg-white "
              : (isInputHover || isInputActive)
                ? "bg-white "
                : isSelectedState
                  ? "bg-white "
                  : "bg-[#F4F4F4] ") +
          "border-2 rounded-none transition-colors duration-200 ease-out " +
          (disabled ? "cursor-not-allowed border-[#E8E8E8] " : "border-[#dedede] cursor-pointer ") +
          (isLockedActive
            ? "border-black "
            : (isInputHover || isInputActive)
              ? "border-black "
              : isSelectedState
                ? "border-black "
                : !disabled && isRemoved
                  ? "hover:bg-white hover:border-black "
                  : "")
        }
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className={
            "text-[12px] font-semibold font-sans transition-colors duration-200 ease-out text-center " +
            (disabled
              ? "text-[#B9B9B9]"
              : isLockedActive
                ? "text-black"
                : isSelectedState
                  ? "text-black"
                  : !isInputHover
                    ? (isRemoved ? "text-black group-hover:text-black" : "text-black")
                    : "text-black")
          }
        >
          {label}
        </span>

        {!isRemoved && !disabled ? (
          <>
            <span
              ref={measureRef}
              aria-hidden="true"
              className="absolute -left-[99999px] top-0 whitespace-pre text-[12px] font-medium font-sans"
            />

            <span
              className={
                "inline-flex items-center justify-center px-[2px] rounded-full transition-colors duration-200 ease-out " +
                "text-white " +
                (isInputHover || isInputActive ? "bg-transparent h-[28px]" : "bg-[#EDEDED] h-[20px]")
              }
            >
              <input
                ref={inputRef}
                inputMode="numeric"
                pattern="[0-9]*"
                type="text"
                value={value}
                onChange={(e) => onValueChange(onlyDigits(e.target.value))}
                onMouseEnter={() => setIsInputHover(true)}
                onMouseLeave={() => setIsInputHover(false)}
                onFocus={() => setIsInputActive(true)}
                onBlur={(e) => {
                  setIsInputActive(false)
                  const raw = e.currentTarget.value.trim()
                  if (shouldTriggerRemoveOnBlur(raw)) {
                    setIsRemoved(true)
                    setHasSelection(false)
                    setIsInputHover(false)
                    onValueChange("")
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter") {
                    inputRef.current?.blur()
                  }
                }}
                style={{
                  width: inputPxWidth ? String(Math.max(20, inputPxWidth)) + "px" : "20px",
                }}
                className={
                  (isInputHover || isInputActive ? "h-[28px] " : "h-[20px] ") +
                  "px-0 text-[12px] font-sans text-center font-bold " +
                  "bg-transparent text-black " +
                  "border border-transparent rounded-none outline-none " +
                  "hover:border-[#6A6A6A] focus:border-transparent hover:bg-white transition-colors duration-200 ease-out"
                }
                aria-label="Number" placeholder="0"
              />
            </span>
          </>
        ) : null}

      </button>

      {/* Tooltip (portal) */}
      {disabled && isDisabledHover && tooltipPos
        ? createPortal(
            <div
              role="tooltip"
              className={
                "pointer-events-none fixed z-[99999] " +
                "bg-black text-white text-[14px] font-medium font-sans " +
                "px-[10px] py-[6px] whitespace-nowrap shadow-sm rounded-[4px]"
              }
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                transform: "translate(-50%, -100%)",
              }}
            >
              Currently out of stock
            </div>,
            document.body,
          )
        : null}

      {/* Dropdown (portal) */}
      {isOpen && !disabled && dropdownPos
        ? createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              aria-label="Options"
              className={"fixed z-[9999] bg-white border border-[#DEDEDE] rounded-none shadow-sm py-[4px]"}
              style={{
                top: dropdownPos.top,
                left: dropdownPos.left,
                transform: "translate(-100%, -100%)",
                minWidth: dropdownPos.width,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              {/* QUANTITY title - only show when Remove is not in options */}
              {!hasSelection ? (
                <div className="px-[8px] mb-[10px] mt-[4px]">
                  <span className="text-[12px] font-bold text-[#818181]">QUANTITY</span>
                </div>
              ) : null}

              {options.map((opt) => {
                const selected = (!isRemoved ? value : "") === opt
                const isRemove = opt === "Remove"
                const isMore = opt === "More"

                return (
                  <div
                    key={opt}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setIsInputHover(false)}
                    onClick={() => pick(opt)}
                    className={
                      "px-[8px] h-[28px] flex items-center cursor-pointer gap-[6px] " +
                      "text-[14px] font-medium font-sans " +
                      (selected ? "bg-[#E9E9E9] text-black " : isRemove ? "text-[#D92D20] " : "text-black ") +
                      "hover:bg-[#F4F4F4] hover:text-black transition-colors duration-200 ease-out"
                    }
                  >
                    {isRemove ? (
                      <span className="text-[#D92D20]">Remove</span>
                    ) : isMore ? (
                      <>
                        <span>More</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path
                            d="M9.19531 3.19434C10.192 2.19796 11.808 2.19796 12.8047 3.19434C13.767 4.1567 13.8003 5.69704 12.9043 6.69922L12.8047 6.80469L5.80469 13.8047C5.70053 13.9087 5.56526 13.975 5.4209 13.9941L5.33301 14H2.66699C2.3251 14 2.04339 13.7417 2.00488 13.4102L2 13.333V10.666C2.00004 10.5187 2.04912 10.3764 2.1377 10.2607L2.19531 10.1943L9.19531 3.19434ZM3.33301 10.9424V12.666H5.05664L10.7236 6.99902L8.99902 5.27539L3.33301 10.9424ZM11.8623 4.1377C11.4127 3.68811 10.6986 3.66287 10.2197 4.0625L10.1377 4.1377L9.94238 4.33203L11.666 6.05664L11.8623 5.86133C12.3116 5.41173 12.3361 4.69853 11.9365 4.21973L11.8623 4.1377Z"
                            fill="#989898"
                          />
                        </svg>
                      </>
                    ) : (
                      opt
                    )}
                  </div>
                )
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

// ----------------------
// Helpers
// ----------------------

export function getVolumeDiscountText(totalSelected: number) {
  const n = Math.max(0, Math.floor(totalSelected || 0))

  if (n <= 5) return "From 5 items -10% reduction"
  if (n <= 19) return "From 20 items -15% reduction"
  if (n <= 49) return "From 50 items -25% reduction"
  return `For ${n} items -50% reduction`
}

export function onlyDigits(input: string) {
  // Keep digits only, max 5 chars.
  const digits = input.replace(/[^0-9]+/g, "").slice(0, 5)
  if (digits === "") return ""

  // Remove leading zeros if there's a non-zero number at the end (e.g. 01 -> 1, 004 -> 4).
  const trimmed = digits.replace(/^0+/, "")

  // If input was all zeros, keep a single 0.
  return trimmed === "" ? "0" : trimmed
}

export function shouldTriggerRemoveOnBlur(rawValue: string) {
  const v = rawValue.trim()
  // Empty OR any all-zero value should behave like selecting "Remove".
  return v === "" || /^0+$/.test(v)
}

export function applyDropdownPick(opt: string): { removed: boolean; value: string } {
  if (opt === "Remove") return { removed: true, value: "" }
  return { removed: false, value: opt }
}
