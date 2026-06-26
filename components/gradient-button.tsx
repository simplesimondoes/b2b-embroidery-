import Link from "next/link"
import type { ButtonHTMLAttributes, ReactNode } from "react"

// Mirrors @sprd/sprd-component-kit v2 Button, variant="gradient", size="l":
// white semibold text on the kit's --gradient-default, square corners, with the
// background-position hover animation across a 200%-wide gradient.
type GradientButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  /** When set, the button renders as a link to this route. */
  href?: string
}

const CLASS_NAME =
  "inline-flex h-12 w-fit cursor-pointer items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-[background-position] duration-500 ease-in-out [background-position:0_0] [background-size:200%_100%] hover:[background-position:100%_0]"

const GRADIENT_STYLE = {
  backgroundImage:
    "linear-gradient(90deg, #dc2626 0%, #4d52d2 30%, #149744 50%, #10843b 65%, #4d52d2 80%, #dc2626 100%)",
}

export default function GradientButton({
  children,
  type = "button",
  href,
  ...props
}: GradientButtonProps) {
  if (href) {
    return (
      <Link href={href} className={CLASS_NAME} style={GRADIENT_STYLE}>
        {children}
      </Link>
    )
  }
  return (
    <button type={type} className={CLASS_NAME} style={GRADIENT_STYLE} {...props}>
      {children}
    </button>
  )
}
