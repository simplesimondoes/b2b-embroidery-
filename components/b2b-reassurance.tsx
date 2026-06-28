// B2B trust layer — the operational reassurances procurement buyers look for,
// distinct from the consumer-facing pillars above.
const ITEMS = [
  {
    title: "VAT invoices & PO friendly",
    body: "Itemised VAT invoices on every order, with purchase-order references and net payment terms for approved accounts.",
    icon: (
      <>
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M15 2v5h5" />
        <path d="M9 13h6M9 17h6M9 9h2" />
      </>
    ),
  },
  {
    title: "One-click reorders",
    body: "Your designs and products are saved to your account, so restocking team kit takes seconds — same artwork, same fit.",
    icon: (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" />
        <path d="M21 3v5h-5" />
      </>
    ),
  },
  {
    title: "A named account contact",
    body: "Orders over 50 pieces get a dedicated contact for artwork, approvals and deadlines — a real person, not a ticket queue.",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
      </>
    ),
  },
  {
    title: "Brand colour matching",
    body: "We match thread colours to your brand palette and keep them on file, so every reorder stays perfectly on-brand.",
    icon: (
      <>
        <circle cx="13.5" cy="6.5" r="1.5" />
        <circle cx="17.5" cy="10.5" r="1.5" />
        <circle cx="8.5" cy="7.5" r="1.5" />
        <circle cx="6.5" cy="12.5" r="1.5" />
        <path d="M12 22a10 10 0 1 1 10-10c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22z" />
      </>
    ),
  },
]

export default function B2BReassurance() {
  return (
    <section className="bg-neutral-900 px-6 py-16 text-white sm:px-[90px]">
      <div className="mx-auto max-w-[1280px]">
        <p className="font-display text-sm font-[900] uppercase tracking-wide text-indigo-300">
          Built for business
        </p>
        <h2 className="font-display mt-2 max-w-2xl text-2xl font-[900] tracking-tight sm:text-3xl">
          EVERYTHING YOUR PROCUREMENT TEAM NEEDS
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(it => (
            <div key={it.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  {it.icon}
                </svg>
              </span>
              <h3 className="mt-4 font-semibold">{it.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-300">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
