"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// Ported from create-omat's upload panel (desktop). Self-contained: native
// drag-and-drop + file input, local object URLs, simulated upload progress.
// Placing an upload on the canvas reuses the designer's graphic-placement.

const SUPPORTED_MIME_TYPES = new Set([
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "image/svg+xml",
    "image/bmp",
])
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const MAX_FILES_LIMIT = 10

type UploadStatus = "uploading" | "uploaded" | "error"
type UploadError = "size_too_large" | "unsupported"

type UploadEntry = {
    id: string
    name: string
    url: string
    status: UploadStatus
    progress: number
    error?: UploadError
    sizeMB?: number
}

const UploadIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M9 5C9.55228 5 10 5.44772 10 6C10 6.51284 9.61396 6.93551 9.11662 6.99327L9 7H3C2.44772 7 2 6.55228 2 6C2 5.48716 2.38604 5.06449 2.88338 5.00673L3 5H9Z"
            fill="currentColor"
        />
        <path
            d="M6.15039 2C6.66323 2 7.0859 2.38604 7.14366 2.88338L7.15039 3V9C7.15039 9.55228 6.70268 10 6.15039 10C5.63755 10 5.21488 9.61396 5.15712 9.11662L5.15039 9V3C5.15039 2.44772 5.59811 2 6.15039 2Z"
            fill="currentColor"
        />
        <path
            d="M6 13V19C6 20.6569 7.34315 22 9 22H19C20.6569 22 22 20.6569 22 19V9C22 7.34315 20.6569 6 19 6H13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
        <path
            d="M17.01 10C17.5623 10 18.01 10.4477 18.01 11C18.01 11.5128 17.624 11.9355 17.1266 11.9933L17 12C16.4477 12 16 11.5523 16 11C16 10.4872 16.386 10.0645 16.8834 10.0067L17.01 10Z"
            fill="currentColor"
        />
        <path
            d="M9.30662 13.2797C10.5733 12.0608 12.2485 12.0157 13.5577 13.1563L13.7071 13.2931L18.7071 18.2931C19.0976 18.6836 19.0976 19.3168 18.7071 19.7073C18.3466 20.0678 17.7794 20.0955 17.3871 19.7905L17.2929 19.7073L12.3066 14.7208C11.8017 14.2349 11.3053 14.2025 10.8126 14.6127L10.7071 14.7073L6.70711 18.7073C6.31658 19.0979 5.68342 19.0979 5.29289 18.7073C4.93241 18.3468 4.90468 17.7796 5.2097 17.3873L5.29289 17.2931L9.30662 13.2797Z"
            fill="currentColor"
        />
        <path
            d="M16.3066 15.2797C17.5733 14.0608 19.2485 14.0157 20.5577 15.1563L20.7071 15.2931L22.7071 17.2931C23.0976 17.6836 23.0976 18.3168 22.7071 18.7073C22.3466 19.0678 21.7794 19.0955 21.3871 18.7905L21.2929 18.7073L19.3066 16.7208C18.8017 16.2349 18.3053 16.2025 17.8126 16.6127L17.7071 16.7073L16.7071 17.7073C16.3166 18.0979 15.6834 18.0979 15.2929 17.7073C14.9324 17.3469 14.9047 16.7796 15.2097 16.3873L15.2929 16.2931L16.3066 15.2797Z"
            fill="currentColor"
        />
    </svg>
)

const CloseIcon = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M6 6L18 18M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
)

const CheckIcon = ({ size = 20 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M5 12.5L10 17.5L19 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
)

function UploadCard({
    image,
    onRemove,
    onPlace,
}: {
    image: UploadEntry
    onRemove: () => void
    onPlace: () => void
}) {
    const uploading = image.status === "uploading"
    const error = image.status === "error"
    const done = image.status === "uploaded"
    return (
        <div
            className={cn(
                "group relative flex h-auto cursor-pointer flex-col gap-2 rounded-lg p-3",
                error
                    ? "items-center border-2 border-red-600"
                    : "border border-neutral-200 bg-neutral-100 hover:bg-neutral-200"
            )}
            onClick={() => done && onPlace()}
        >
            {!error && (
                <img
                    src={image.url}
                    alt={image.name}
                    className={cn("h-[130px] w-full object-contain", uploading && "opacity-50")}
                />
            )}

            {uploading && (
                <div className="absolute bottom-0 left-0 h-2 w-full rounded bg-neutral-200">
                    <div
                        className="h-2 rounded bg-blue-500 transition-[width] duration-150"
                        style={{ width: `${image.progress}%` }}
                    />
                </div>
            )}

            {error && (
                <p className="px-1 text-xs whitespace-pre-line text-red-600">
                    {image.error === "size_too_large"
                        ? `Your file is ${Math.floor(image.sizeMB ?? 0)}MB. Maximum allowed size is ${
                              MAX_FILE_SIZE / (1024 * 1024)
                          }MB.`
                        : "We don’t support this file type. Please upload PNG, JPG or SVG."}
                </p>
            )}

            {done && image.progress === 100 && (
                <div className="absolute top-0 right-0 z-[2] rounded-lg bg-neutral-200 p-1.5">
                    <span className="text-green-700">
                        <CheckIcon size={20} />
                    </span>
                </div>
            )}

            <button
                type="button"
                aria-label="Remove"
                onClick={e => {
                    e.stopPropagation()
                    onRemove()
                }}
                className={cn(
                    "absolute top-0 right-0 cursor-pointer rounded-[6px] bg-neutral-200 p-1.5 transition-opacity hover:bg-white",
                    uploading
                        ? "opacity-100"
                        : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:bg-neutral-300 group-hover:opacity-100",
                    error && "bg-red-600 text-white opacity-100 hover:bg-red-600 hover:text-black"
                )}
            >
                <CloseIcon size={20} />
            </button>
        </div>
    )
}

export function UploadPanel({ onPlaceImage }: { onPlaceImage: (url: string) => void }) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [images, setImages] = useState<UploadEntry[]>([])
    const [dragActive, setDragActive] = useState(false)
    const dragDepth = useRef(0)
    // Keep the latest placement callback without re-creating addFiles.
    const onPlaceRef = useRef(onPlaceImage)
    onPlaceRef.current = onPlaceImage
    // Mirror images in a ref (to read count at completion) and track which
    // uploads have already been auto-placed, so placement happens exactly once.
    const imagesRef = useRef<UploadEntry[]>([])
    useEffect(() => {
        imagesRef.current = images
    }, [images])
    const placedRef = useRef<Set<string>>(new Set())

    const addFiles = useCallback((files: File[]) => {
        const accepted = files.slice(0, MAX_FILES_LIMIT)
        accepted.forEach((file, i) => {
            const id = `${file.name}-${i}-${performance.now()}`
            if (!SUPPORTED_MIME_TYPES.has(file.type)) {
                setImages(prev => [
                    ...prev,
                    { id, name: file.name, url: "", status: "error", progress: 0, error: "unsupported" },
                ])
                return
            }
            if (file.size > MAX_FILE_SIZE) {
                setImages(prev => [
                    ...prev,
                    {
                        id,
                        name: file.name,
                        url: "",
                        status: "error",
                        progress: 0,
                        error: "size_too_large",
                        sizeMB: file.size / (1024 * 1024),
                    },
                ])
                return
            }
            const url = URL.createObjectURL(file)
            setImages(prev => [...prev, { id, name: file.name, url, status: "uploading", progress: 0 }])
            // Simulate an upload. Progress lives in a local so the state updater
            // stays pure; completion side-effects run once, outside the updater.
            let prog = 0
            const iv = setInterval(() => {
                prog += 14 + Math.random() * 18
                if (prog < 100) {
                    setImages(prev => prev.map(im => (im.id === id ? { ...im, progress: prog } : im)))
                    return
                }
                clearInterval(iv)
                setImages(prev =>
                    prev.map(im => (im.id === id ? { ...im, progress: 100, status: "uploaded" } : im))
                )
                // Hide the success tick after a moment (like create-omat).
                setTimeout(() => {
                    setImages(prev => prev.map(im => (im.id === id ? { ...im, progress: 0 } : im)))
                }, 2000)
                // Auto-place exactly once, only when this is the single design.
                if (!placedRef.current.has(id) && imagesRef.current.length === 1) {
                    placedRef.current.add(id)
                    onPlaceRef.current(url)
                }
            }, 90)
        })
    }, [])

    const removeImage = (id: string) =>
        setImages(prev => {
            const target = prev.find(im => im.id === id)
            if (target?.url) URL.revokeObjectURL(target.url)
            return prev.filter(im => im.id !== id)
        })

    const openFilePicker = () => inputRef.current?.click()

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragActive(false)
        const files = Array.from(e.dataTransfer.files ?? [])
        if (files.length) addFiles(files)
    }

    return (
        <div
            className="relative flex flex-1 flex-col overflow-hidden"
            onDragEnter={e => {
                e.preventDefault()
                dragDepth.current += 1
                setDragActive(true)
            }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={e => {
                e.preventDefault()
                dragDepth.current -= 1
                if (dragDepth.current <= 0) setDragActive(false)
            }}
            onDrop={onDrop}
        >
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={[...SUPPORTED_MIME_TYPES].join(",")}
                className="hidden"
                onChange={e => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length) addFiles(files)
                    e.target.value = ""
                }}
            />

            <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="flex w-full flex-col items-center gap-9">
                    <div
                        className="flex w-full cursor-pointer flex-col items-center gap-9"
                        onClick={openFilePicker}
                    >
                        <span className="mt-4 text-neutral-200">
                            <UploadIcon size={64} />
                        </span>
                        <div className="flex w-full flex-col items-center gap-3">
                            <p className="text-sm leading-5 text-black">Drop your design here</p>
                            <p className="text-xs font-semibold text-neutral-600 uppercase">or</p>
                            <button
                                type="button"
                                onClick={e => {
                                    e.stopPropagation()
                                    openFilePicker()
                                }}
                                className="w-full cursor-pointer rounded-none bg-black px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                            >
                                Upload
                            </button>
                            <p className="text-sm leading-5 text-neutral-500">
                                SVG, JPEG, PNG allowed
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 text-center">
                        <a
                            className="cursor-pointer text-xs leading-4 font-semibold text-neutral-700 underline"
                            href="#"
                            target="_blank"
                            rel="noreferrer"
                        >
                            How to optimise your file for print
                        </a>
                        <p className="text-xs leading-4 text-neutral-700">
                            Designs must follow{" "}
                            <a className="cursor-pointer underline" href="#" target="_blank" rel="noreferrer">
                                Spreadshirt policies
                            </a>
                            .
                        </p>
                    </div>
                </div>

                {images.length > 0 && (
                    <div className="mt-6 border-t border-neutral-200 pt-6">
                        <div className="grid grid-cols-2 gap-2">
                            {images.map(img => (
                                <UploadCard
                                    key={img.id}
                                    image={img}
                                    onRemove={() => removeImage(img.id)}
                                    onPlace={() => onPlaceImage(img.url)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {dragActive && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[10px] border-2 border-dashed border-black bg-white/85">
                    <div className="flex flex-col items-center gap-3 text-black">
                        <UploadIcon size={48} />
                        <p className="text-sm font-medium">Drop your design here</p>
                    </div>
                </div>
            )}
        </div>
    )
}
