import BeforeAfterCompare from "@/components/before-after-compare"
import EmbLandingHeader from "@/components/emb-landing-header"
import GradientButton from "@/components/gradient-button"

export default function EmbLandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <EmbLandingHeader />
      <section className="relative flex h-[560px] w-full items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80"
          style={{ backgroundImage: "url('/images/emb-bg.png')" }}
        />
        {/* Floating product images — scattered, varied position, tilt, size and
            depth-of-field. Far/smaller items are blurrier. */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-0 w-full max-w-[1600px] -translate-x-1/2">
          {/* tote — nature — 2x larger */}
          <img
            src="/products/56/404/1.webp"
            alt=""
            className="hero-float-a absolute top-[9%] left-[6%] w-[22rem] rotate-[10deg] blur-[2px]"
          />
          {/* baseball cap — white — right side */}
          <img
            src="/products/15/10/1.webp"
            alt=""
            className="hero-float-b absolute right-[3%] bottom-[-16%] w-100 -rotate-[-32deg] blur-[0px]"
          />
          {/* polo — soft ecru */}
          <img
            src="/products/2116/947/1.webp"
            alt=""
            className="hero-float-c absolute top-[2%] right-[16%] w-62 rotate-[6deg] blur-[5px]"
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-2/3 bg-gradient-to-t from-gray-800/45 to-gray-800/0" />
        <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
          <BeforeAfterCompare />
          <h1 className="font-display text-3xl font-[900] tracking-tight text-white sm:text-4xl">
            KLEIDUNG BESTICKEN LASSEN
          </h1>
          <GradientButton>Dein Stickdesign gestalten</GradientButton>
        </div>
      </section>
    </main>
  )
}
