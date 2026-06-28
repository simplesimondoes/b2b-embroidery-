"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import GoogleLogo from "@/components/google-logo"

export default function GoogleHomePage() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  function search(q: string) {
    const term = q.trim() || "custom embroidery uk"
    router.push(`/search?q=${encodeURIComponent(term)}`)
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#202124]">
      {/* Top bar */}
      <header className="flex items-center justify-end gap-4 px-5 py-3 text-sm">
        <a className="text-[#202124] hover:underline" href="#">
          Gmail
        </a>
        <a className="text-[#202124] hover:underline" href="#">
          Images
        </a>
        <button aria-label="Google apps" className="rounded-full p-2 hover:bg-black/5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#5f6368">
            <path d="M6 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6-8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a73e8] text-sm font-medium text-white">
          B
        </div>
      </header>

      {/* Center */}
      <main className="flex flex-1 flex-col items-center px-4 pt-[12vh]">
        <GoogleLogo className="mb-7 h-[92px] w-[272px] max-w-[90vw]" />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            search(query)
          }}
          className="w-full max-w-[584px]"
        >
          <div className="flex items-center gap-3 rounded-full border border-[#dfe1e5] px-4 py-2.5 shadow-[0_1px_6px_rgba(32,33,36,0.18)] hover:shadow-[0_1px_8px_rgba(32,33,36,0.25)] focus-within:shadow-[0_1px_8px_rgba(32,33,36,0.25)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#9aa0a6">
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 10-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z" />
            </svg>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Google or type a URL"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-[#5f6368]"
            />
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#4285f4" d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
              <path fill="#34a853" d="M11 18.08h2V21h-2z" />
              <path
                fill="#fbbc05"
                d="M7.05 11.05a4.95 4.95 0 009.9 0H19a7 7 0 01-14 0z"
              />
              <path fill="#ea4335" d="M12 16.5a5.5 5.5 0 005.5-5.45h-1.55A3.95 3.95 0 0112 15a3.95 3.95 0 01-3.95-3.95H6.5A5.5 5.5 0 0012 16.5z" />
            </svg>
          </div>

          <div className="mt-7 flex justify-center gap-3">
            <button
              type="submit"
              className="rounded border border-transparent bg-[#f8f9fa] px-4 py-2 text-sm text-[#3c4043] hover:border-[#dadce0] hover:shadow-sm"
            >
              Google Search
            </button>
            <button
              type="button"
              onClick={() => search(query)}
              className="rounded border border-transparent bg-[#f8f9fa] px-4 py-2 text-sm text-[#3c4043] hover:border-[#dadce0] hover:shadow-sm"
            >
              I&apos;m Feeling Lucky
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-[#f2f2f2] text-sm text-[#70757a]">
        <div className="border-b border-[#dadce0] px-6 py-3">United Kingdom</div>
        <div className="flex flex-col justify-between gap-2 px-6 py-3 sm:flex-row">
          <div className="flex gap-6">
            <a className="hover:underline" href="#">About</a>
            <a className="hover:underline" href="#">Advertising</a>
            <a className="hover:underline" href="#">Business</a>
          </div>
          <div className="flex gap-6">
            <a className="hover:underline" href="#">Privacy</a>
            <a className="hover:underline" href="#">Terms</a>
            <a className="hover:underline" href="#">Settings</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
