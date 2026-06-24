export default function EmbLandingHeader() {
  return (
    <header className="relative z-10 w-full bg-white shadow-sm">
      {/* Newsletter promo bar */}
      <div className="flex h-10 w-full items-center justify-center bg-[#FF6038] px-4 text-center">
        <span className="text-[14px] font-medium text-black">
          Newsletter abonnieren &amp; 5-€-Gutschein sichern{" "}
          <span aria-hidden className="font-semibold">
            »
          </span>
        </span>
      </div>

      {/* Logo row: centered logo, account + cart on the right */}
      <div className="mx-auto w-full max-w-[1920px] px-8">
        <div className="grid h-16 w-full grid-cols-[1fr_auto_1fr] items-center">
          <div aria-hidden />
          <a href="#" aria-label="Spreadshirt" className="justify-self-center">
            <img src="/icons/Logo.svg" alt="Spreadshirt" className="h-[34px]" />
          </a>
          <div className="flex items-center justify-end gap-6">
            <button type="button" aria-label="Account" className="cursor-pointer text-black">
              <img src="/icons/icon-user.svg" alt="" className="h-[26px] w-[26px]" />
            </button>
            <button type="button" aria-label="Cart" className="cursor-pointer text-black">
              <img src="/icons/icon-cart.svg" alt="" className="h-[26px] w-[26px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Nav row: primary links left, "Selber verkaufen" right */}
      <div className="mx-auto w-full max-w-[1920px] px-8">
        <nav className="flex h-12 w-full items-center justify-between">
          <ul className="flex items-center gap-8 text-[18px] font-medium text-black">
            <li>
              <a href="#" className="hover:underline hover:decoration-2 underline-offset-4">
                Gestalten
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline hover:decoration-2 underline-offset-4">
                Shoppen
              </a>
            </li>
            <li>
              <a href="#" className="hover:underline hover:decoration-2 underline-offset-4">
                Pro
              </a>
            </li>
          </ul>
          <a
            href="#"
            className="inline-flex items-center gap-1 text-[18px] font-medium text-black hover:underline hover:decoration-2 underline-offset-4"
          >
            Selber verkaufen
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 17 17 7" />
              <path d="M8 7h9v9" />
            </svg>
          </a>
        </nav>
      </div>
    </header>
  )
}
